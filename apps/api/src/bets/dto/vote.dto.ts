import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoteDto {
  @ApiProperty({ example: 'clxyz123', description: 'User ID of the voted winner' })
  @IsString()
  @IsNotEmpty()
  winnerId: string;
}
