import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterswitchService } from '../payments/interswitch.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly interswitchService: InterswitchService,
    private readonly config: ConfigService,
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
  @ApiOperation({ summary: 'Initiate a wallet top-up via Interswitch Webpay' })
  async initiateFunding(
    @Body() dto: FundWalletDto,
    @Request() req: ExpressRequest & { user: User },
  ) {
    const userId: string = req.user.id;
    const merchantReference = `BMN-${Date.now()}-${userId.slice(0, 6)}`;
    const amountInKobo = dto.amount * 100;

    const { paymentUrl } = this.interswitchService.initiatePayment({
      amount: amountInKobo,
      email: req.user.email,
      userId,
      merchantReference,
    });

    await this.walletService.createPendingDeposit({
      userId,
      amount: dto.amount,
      reference: merchantReference,
    });

    return { paymentUrl, reference: merchantReference };
  }

  @Get('fund/verify')
  @ApiOperation({
    summary: 'Interswitch redirect callback — verifies payment and credits wallet',
  })
  @ApiQuery({ name: 'txnref', description: 'Merchant transaction reference' })
  async verifyFunding(@Query('txnref') txnref: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');

    const pending = await this.walletService.getPendingDeposit(txnref);

    if (!pending) {
      // Already settled or never existed — check for idempotency via settleDeposit
      const settlement = await this.walletService.settleDeposit(txnref);
      if (!settlement) {
        return res.redirect(`${frontendUrl}/wallet?error=invalid_reference`);
      }
      return res.redirect(`${frontendUrl}/wallet?funded=true`);
    }

    const amountInKobo = pending.amount * 100;
    const result = await this.interswitchService.verifyPayment(txnref, amountInKobo);

    if (!result.success) {
      await this.walletService.failDeposit(txnref);
      return res.redirect(`${frontendUrl}/wallet?error=payment_failed`);
    }

    await this.walletService.settleDeposit(txnref);
    return res.redirect(`${frontendUrl}/wallet?funded=true`);
  }
}
