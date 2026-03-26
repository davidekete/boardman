import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { CronService } from './cron.service';

@Module({
  imports: [WalletModule],
  providers: [CronService],
})
export class CronModule {}
