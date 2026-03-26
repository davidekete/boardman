import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { InterswitchService } from './interswitch.service';

@Module({
  imports: [HttpModule],
  providers: [InterswitchService],
  exports: [InterswitchService],
})
export class PaymentsModule {}
