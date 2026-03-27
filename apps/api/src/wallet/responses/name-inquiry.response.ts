import { ApiProperty } from '@nestjs/swagger';

export class NameInquiryResponse {
  @ApiProperty() accountName: string;
}
