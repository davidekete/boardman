import { IsString, Matches, MinLength } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, numbers, and underscores',
  })
  username: string;
}
