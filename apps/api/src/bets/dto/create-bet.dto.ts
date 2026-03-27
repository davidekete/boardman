import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBetDto {
  @ApiProperty({ example: 'Who scores first?', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ example: 'First goal scorer in the match' })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiProperty({ example: 500, description: 'Stake amount in Naira (min 100)' })
  @IsNumber()
  @Min(100)
  stakeAmount: number;

  @ApiProperty({ type: [String], example: ['alice', 'bob'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsString({ each: true })
  participantUsernames: string[];

  @ApiPropertyOptional({
    example: 24,
    description: 'Bet duration in hours (positive integer)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Bet duration in days (positive integer). Automatically converted to hours.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;
}
