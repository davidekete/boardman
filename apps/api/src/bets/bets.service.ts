import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateBetDto } from './dto/create-bet.dto';
import { VoteDto } from './dto/vote.dto';

const BET_INCLUDE = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatar: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
  ) {}

  async createBet(dto: CreateBetDto, creatorId: string) {
    // Check for duplicate participant usernames up front
    const uniqueUsernames = new Set(dto.participantUsernames);
    if (uniqueUsernames.size !== dto.participantUsernames.length) {
      throw new BadRequestException('Duplicate participants are not allowed');
    }

    // Fetch creator for balance and self-invite check
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (creator.walletBalance < dto.stakeAmount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Resolve each invited username to a user
    const invitedUsers: { id: string }[] = [];
    for (const username of dto.participantUsernames) {
      const user = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true },
      });
      if (!user) throw new BadRequestException(`User @${username} not found`);
      if (user.id === creatorId)
        throw new BadRequestException('You cannot invite yourself');
      invitedUsers.push(user);
    }

    const expiresAt = new Date(Date.now() + dto.expiresInHours * 3_600_000);

    const bet = await this.prisma.bet.create({
      data: {
        title: dto.title,
        terms: dto.terms,
        stakeAmount: dto.stakeAmount,
        status: BetStatus.PENDING,
        creatorId,
        expiresAt,
      },
    });

    // Creator participates immediately (accepted)
    await this.prisma.betParticipant.create({
      data: {
        betId: bet.id,
        userId: creatorId,
        accepted: true,
        joinedAt: new Date(),
      },
    });

    // Invited participants start as pending
    for (const invited of invitedUsers) {
      await this.prisma.betParticipant.create({
        data: { betId: bet.id, userId: invited.id, accepted: null },
      });
    }

    // Lock creator's stake in escrow
    await this.walletService.creditWallet(creatorId, -dto.stakeAmount, {
      type: TransactionType.ESCROW_LOCK,
      betId: bet.id,
    });

    await this.prisma.bet.update({
      where: { id: bet.id },
      data: { escrowAmount: dto.stakeAmount },
    });

    this.logger.log(
      `Bet ${bet.id} created by user ${creatorId} (stake: ${dto.stakeAmount})`,
    );

    return this.prisma.bet.findUnique({
      where: { id: bet.id },
      include: BET_INCLUDE,
    });
  }

  async getMyBets(userId: string) {
    return this.prisma.bet.findMany({
      where: { participants: { some: { userId } } },
      include: BET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBetById(betId: string, userId: string) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: BET_INCLUDE,
    });

    if (!bet) throw new NotFoundException('Bet not found');

    const isParticipant = bet.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException();

    return bet;
  }

  async acceptBet(betId: string, userId: string) {
    const participant = await this.prisma.betParticipant.findFirst({
      where: { betId, userId },
      include: { bet: true },
    });

    if (!participant) throw new NotFoundException();
    if (participant.accepted !== null) {
      throw new BadRequestException('Already responded to this invite');
    }

    const { bet } = participant;

    if (bet.status !== BetStatus.PENDING) {
      throw new BadRequestException('Bet is no longer accepting responses');
    }
    if (bet.expiresAt < new Date()) {
      throw new BadRequestException('This bet has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.walletBalance < bet.stakeAmount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    await this.walletService.creditWallet(userId, -bet.stakeAmount, {
      type: TransactionType.ESCROW_LOCK,
      betId,
    });

    await this.prisma.betParticipant.update({
      where: { id: participant.id },
      data: { accepted: true, joinedAt: new Date() },
    });

    await this.prisma.bet.update({
      where: { id: betId },
      data: { escrowAmount: { increment: bet.stakeAmount } },
    });

    // Activate if everyone has accepted
    const allParticipants = await this.prisma.betParticipant.findMany({
      where: { betId },
    });
    if (allParticipants.every((p) => p.accepted === true)) {
      await this.prisma.bet.update({
        where: { id: betId },
        data: { status: BetStatus.ACTIVE },
      });
      this.logger.log(`Bet ${betId} is now ACTIVE — all participants accepted`);
    }

    return this.prisma.bet.findUnique({
      where: { id: betId },
      include: BET_INCLUDE,
    });
  }

  async declineBet(betId: string, userId: string) {
    const participant = await this.prisma.betParticipant.findFirst({
      where: { betId, userId },
      include: { bet: true },
    });

    if (!participant) throw new NotFoundException();
    if (participant.accepted !== null) {
      throw new BadRequestException('Already responded');
    }

    const { bet } = participant;

    await this.prisma.betParticipant.update({
      where: { id: participant.id },
      data: { accepted: false },
    });

    await this.prisma.bet.update({
      where: { id: betId },
      data: { status: BetStatus.REFUNDED, escrowAmount: 0 },
    });

    // Refund all accepted participants
    const accepted = await this.prisma.betParticipant.findMany({
      where: { betId, accepted: true },
    });

    for (const ap of accepted) {
      await this.walletService.creditWallet(ap.userId, bet.stakeAmount, {
        type: TransactionType.REFUND,
        betId,
      });
    }

    this.logger.log(
      `Bet ${betId} declined by user ${userId} — refunded ${accepted.length} participant(s)`,
    );

    return this.prisma.bet.findUnique({
      where: { id: betId },
      include: BET_INCLUDE,
    });
  }

  async openVoting(betId: string, userId: string) {
    const bet = await this.prisma.bet.findUnique({ where: { id: betId } });

    if (!bet) throw new NotFoundException('Bet not found');
    if (bet.creatorId !== userId) throw new ForbiddenException();
    if (bet.status !== BetStatus.ACTIVE) {
      throw new BadRequestException('Bet must be active to open voting');
    }

    return this.prisma.bet.update({
      where: { id: betId },
      data: { status: BetStatus.VOTING },
      include: BET_INCLUDE,
    });
  }

  async vote(betId: string, userId: string, dto: VoteDto) {
    const participant = await this.prisma.betParticipant.findFirst({
      where: { betId, userId },
      include: { bet: true },
    });

    if (!participant) throw new ForbiddenException();

    if (participant.bet.status !== BetStatus.VOTING) {
      throw new BadRequestException('Voting is not open for this bet');
    }
    if (participant.outcomeVote !== null) {
      throw new BadRequestException('You have already voted');
    }

    // Validate that the nominated winner is actually a participant
    const winnerParticipant = await this.prisma.betParticipant.findFirst({
      where: { betId, userId: dto.winnerId },
    });
    if (!winnerParticipant)
      throw new BadRequestException('Invalid winner selection');

    await this.prisma.betParticipant.update({
      where: { id: participant.id },
      data: { outcomeVote: dto.winnerId, votedAt: new Date() },
    });

    await this.checkConsensus(betId);

    return this.prisma.bet.findUnique({
      where: { id: betId },
      include: BET_INCLUDE,
    });
  }

  private async checkConsensus(betId: string): Promise<void> {
    const participants = await this.prisma.betParticipant.findMany({
      where: { betId },
    });

    if (!participants.every((p) => p.outcomeVote !== null)) return;

    const votes = participants.map((p) => p.outcomeVote);
    const unanimous = votes.every((v) => v === votes[0]);

    const bet = await this.prisma.bet.findUnique({ where: { id: betId } });

    if (unanimous) {
      const winnerId = votes[0]!;
      const feePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 0.03);
      const platformFee = bet.escrowAmount * feePercent;
      const winnings = bet.escrowAmount - platformFee;

      // Transitional CONSENSUS state before payout
      await this.prisma.bet.update({
        where: { id: betId },
        data: { status: BetStatus.CONSENSUS },
      });

      await this.walletService.creditWallet(winnerId, winnings, {
        type: TransactionType.ESCROW_RELEASE,
        betId,
      });

      await this.walletService.creditWallet(bet.creatorId, 0, {
        type: TransactionType.FEE,
        betId,
      });

      await this.prisma.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.SETTLED,
          winnerId,
          settledAt: new Date(),
          escrowAmount: 0,
        },
      });

      this.logger.log(
        `Bet ${betId} SETTLED — winner: ${winnerId}, payout: ${winnings}, fee: ${platformFee}`,
      );
    } else {
      await this.prisma.bet.update({
        where: { id: betId },
        data: { status: BetStatus.DISPUTED },
      });

      this.logger.warn(`Bet ${betId} DISPUTED — votes did not reach consensus`);
    }
  }
}
