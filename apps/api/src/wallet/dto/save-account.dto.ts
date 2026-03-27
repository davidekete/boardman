import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SaveAccountDto {
  @IsString()
  @Length(10, 10)
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;
}
