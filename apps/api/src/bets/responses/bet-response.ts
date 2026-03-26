import { ApiProperty } from '@nestjs/swagger';

export class ParticipantResponse {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() username: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ nullable: true }) accepted: boolean | null;
  @ApiProperty({ nullable: true }) outcomeVote: string | null;
  @ApiProperty({ nullable: true }) votedAt: string | null;
}

export class BetResponse {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() terms: string;
  @ApiProperty() stakeAmount: number;
  @ApiProperty() escrowAmount: number;
  @ApiProperty({ description: 'BetStatus enum value' }) status: string;
  @ApiProperty() creatorId: string;
  @ApiProperty({ nullable: true }) winnerId: string | null;
  @ApiProperty() expiresAt: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true }) settledAt: string | null;
  @ApiProperty({ type: [ParticipantResponse] }) participants: ParticipantResponse[];
}
