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
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterswitchService } from '../payments/interswitch.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly interswitchService: InterswitchService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getWallet(@Request() req) {
    return this.walletService.getWallet(req.user.id);
  }

  @Post('fund/initiate')
  @UseGuards(JwtAuthGuard)
  async initiateFunding(@Body() dto: FundWalletDto, @Request() req) {
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
  async verifyFunding(@Query('txnref') txnref: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');

    const result = await this.interswitchService.verifyPayment(txnref);

    if (!result.success) {
      await this.walletService.failDeposit(txnref);
      return res.redirect(`${frontendUrl}/wallet?error=payment_failed`);
    }

    const settlement = await this.walletService.settleDeposit(txnref);

    if (!settlement) {
      return res.redirect(`${frontendUrl}/wallet?error=invalid_reference`);
    }

    return res.redirect(`${frontendUrl}/wallet?funded=true`);
  }
}
