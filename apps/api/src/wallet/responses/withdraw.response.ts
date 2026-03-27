import { ApiProperty } from '@nestjs/swagger';

export class WithdrawResponse {
  @ApiProperty() message: string;
  @ApiProperty() reference: string;
}
