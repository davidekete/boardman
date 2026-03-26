import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';

@Module({
  imports: [WalletModule],
  controllers: [BetsController],
  providers: [BetsService],
})
export class BetsModule {}
