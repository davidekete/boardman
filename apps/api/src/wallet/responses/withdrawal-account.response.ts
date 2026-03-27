import { ApiProperty } from '@nestjs/swagger';

export class WithdrawalAccountResponse {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() accountNumber: string;
  @ApiProperty() accountName: string;
  @ApiProperty() bankCode: string;
  @ApiProperty() bankName: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
