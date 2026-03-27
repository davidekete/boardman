import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransactionType, User } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterswitchService } from '../payments/interswitch.service';
import { WalletService } from './wallet.service';

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

  @Post('fund/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('boardman_token')
  @ApiOperation({
    summary: 'Get or create a permanent virtual bank account for wallet top-up',
  })
  async initiateFunding(@Request() req: ExpressRequest & { user: User }) {
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

  @Post('fund/webhook')
  @ApiOperation({
    summary: 'Interswitch TRANSACTION.COMPLETED webhook for virtual accounts',
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

    // Amount is in kobo — convert to Naira before crediting
    const amountInNaira = amount / 100;

    try {
      await this.walletService.creditWallet(user.id, amountInNaira, {
        type: TransactionType.DEPOSIT,
        reference: uuid, // Unique constraint on Transaction.reference handles idempotency
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
}
