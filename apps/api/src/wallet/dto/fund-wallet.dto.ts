import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class FundWalletDto {
  @ApiProperty({ example: 500, description: 'Amount in Naira (min 100)' })
  @IsNumber()
  @Min(100)
  amount: number;
}
