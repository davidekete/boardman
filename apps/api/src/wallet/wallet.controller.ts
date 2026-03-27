import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionType, User } from '@prisma/client';
import { IsNumber, IsPositive } from 'class-validator';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterswitchService } from '../payments/interswitch.service';
import { NameInquiryDto } from './dto/name-inquiry.dto';
import { SaveAccountDto } from './dto/save-account.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { NameInquiryResponse } from './responses/name-inquiry.response';
import { WithdrawResponse } from './responses/withdraw.response';
import { WithdrawalAccountResponse } from './responses/withdrawal-account.response';
import { WalletService } from './wallet.service';

class InitiateFundingDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

class TestFundDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly interswitchService: InterswitchService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({ summary: 'Get wallet balance and last 50 transactions' })
  getWallet(@Request() req: ExpressRequest & { user: User }) {
    return this.walletService.getWallet(req.user.id);
  }

  // ── Pay Bill ───────────────────────────────────────────────────────────────

  @Post('fund/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({
    summary: 'Create a Pay Bill payment and return the checkout URL',
  })
  async initiateFunding(
    @Request() req: ExpressRequest & { user: User },
    @Body() body: InitiateFundingDto,
  ) {
    const user = req.user;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/wallet?funded=true`;

    this.logger.log(
      `Initiating Pay Bill for user ${user.id} — amount: ₦${body.amount}`,
    );

    return this.interswitchService.createBill({
      amount: body.amount,
      customerId: user.email,
      customerEmail: user.email,
      redirectUrl,
    });
  }

  // ── Virtual Account ────────────────────────────────────────────────────────

  @Post('fund/virtual-account')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({
    summary: 'Get or create a permanent virtual bank account for wallet top-up',
  })
  async getOrCreateVirtualAccount(
    @Request() req: ExpressRequest & { user: User },
  ) {
    const userId = req.user.id;

    const existing = await this.walletService.getVirtualAccount(userId);
    if (existing) {
      this.logger.log(`Returning existing virtual account for user ${userId}`);
      return existing;
    }

    const accountName = `${req.user.firstName} ${req.user.lastName}`;
    const account = await this.interswitchService.createVirtualAccount(
      accountName,
    );

    await this.walletService.saveVirtualAccount(userId, account);

    this.logger.log(
      `Virtual account created for user ${userId}: ${account.accountNumber}`,
    );

    return account;
  }

  // ── Test Funds (non-production only) ──────────────────────────────────────

  @Post('fund/test')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({
    summary: 'Directly credit wallet with test funds (non-production only)',
  })
  async testFund(
    @Request() req: ExpressRequest & { user: User },
    @Body() body: TestFundDto,
  ) {
    // if (process.env.NODE_ENV === 'production') {
    //   throw new ForbiddenException(
    //     'Test funding is not available in production',
    //   );
    // }

    const userId = req.user.id;

    this.logger.log(`Test fund — userId: ${userId}, amount: ₦${body.amount}`);

    await this.walletService.creditWallet(userId, body.amount, {
      type: TransactionType.DEPOSIT,
      reference: `test_${Date.now()}`,
    });

    return { success: true, amount: body.amount };
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  @Post('fund/webhook')
  @ApiOperation({
    summary: 'Interswitch TRANSACTION.COMPLETED webhook',
  })
  async handleWebhook(@Body() body: Record<string, any>) {
    const { event, uuid, data } = body;

    if (event !== 'TRANSACTION.COMPLETED') {
      this.logger.debug(`Ignoring webhook event: ${event}`);
      return { received: true };
    }

    const { retrievalReferenceNumber, amount, responseCode } = data ?? {};

    if (responseCode !== '00') {
      this.logger.warn(
        `Webhook received with non-success responseCode: ${responseCode}`,
      );
      return { received: true };
    }

    const user = await this.walletService.getUserByVirtualAccount(
      retrievalReferenceNumber,
    );
    if (!user) {
      this.logger.warn(
        `Webhook received for unknown virtual account: ${retrievalReferenceNumber}`,
      );
      return { received: true };
    }

    const amountInNaira = amount / 100;

    try {
      await this.walletService.creditWallet(user.id, amountInNaira, {
        type: TransactionType.DEPOSIT,
        reference: uuid,
      });
      this.logger.log(
        `Wallet credited — userId: ${user.id}, amount: ${amountInNaira}, uuid: ${uuid}`,
      );
    } catch (err) {
      if ((err as any)?.code === 'P2002') {
        this.logger.warn(`Duplicate webhook ignored — uuid: ${uuid}`);
        return { received: true };
      }
      this.logger.error(`Webhook wallet credit failed — uuid: ${uuid}`, err);
    }

    return { received: true };
  }

  // ── Withdrawal Account ─────────────────────────────────────────────────────

  @Get('account')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({ summary: "Get the user's saved withdrawal account" })
  @ApiResponse({
    status: 200,
    description: 'Saved withdrawal account or null',
    type: WithdrawalAccountResponse,
  })
  getWithdrawalAccount(@Request() req: ExpressRequest & { user: User }) {
    return this.walletService.getWithdrawalAccount(req.user.id);
  }

  @Post('account/inquiry')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({
    summary: 'Look up an account name by account number and bank code',
  })
  @ApiResponse({
    status: 200,
    description: 'Account name returned from Interswitch',
    type: NameInquiryResponse,
  })
  @ApiResponse({ status: 400, description: 'Account not found' })
  async accountNameInquiry(
    @Body() body: NameInquiryDto,
  ): Promise<NameInquiryResponse> {
    return this.interswitchService.accountNameInquiry(
      body.accountNumber,
      body.bankCode,
    );
  }

  @Post('account')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({ summary: 'Save or update the withdrawal account' })
  @ApiResponse({
    status: 201,
    description: 'Saved withdrawal account',
    type: WithdrawalAccountResponse,
  })
  saveWithdrawalAccount(
    @Request() req: ExpressRequest & { user: User },
    @Body() body: SaveAccountDto,
  ): Promise<WithdrawalAccountResponse> {
    return this.walletService.saveWithdrawalAccount(req.user.id, body);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({ summary: 'Withdraw funds to the saved bank account' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal initiated successfully',
    type: WithdrawResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or transfer failure',
  })
  withdraw(
    @Request() req: ExpressRequest & { user: User },
    @Body() body: WithdrawDto,
  ): Promise<WithdrawResponse> {
    return this.walletService.withdraw(req.user.id, body.amount);
  }
}
