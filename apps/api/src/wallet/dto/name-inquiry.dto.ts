import { IsNotEmpty, IsString, Length } from 'class-validator';

export class NameInquiryDto {
  @IsString()
  @Length(10, 10)
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  bankCode: string;
}
