import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BetStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireStalesets(): Promise<void> {
    try {
      const staleBets = await this.prisma.bet.findMany({
        where: {
          status: { in: [BetStatus.PENDING, BetStatus.ACTIVE, BetStatus.VOTING] },
          expiresAt: { lt: new Date() },
        },
      });

      if (staleBets.length === 0) {
        this.logger.log('No stale bets found');
        return;
      }

      for (const bet of staleBets) {
        const participants = await this.prisma.betParticipant.findMany({
          where: { betId: bet.id, accepted: true },
        });

        for (const participant of participants) {
          try {
            await this.walletService.creditWallet(participant.userId, bet.stakeAmount, {
              type: TransactionType.REFUND,
              betId: bet.id,
            });
          } catch (err) {
            this.logger.error(
              `Failed to refund userId=${participant.userId} for betId=${bet.id}: ${(err as Error).message}`,
            );
          }
        }

        await this.prisma.bet.update({
          where: { id: bet.id },
          data: { status: BetStatus.REFUNDED, escrowAmount: 0 },
        });

        this.logger.log(
          `Bet ${bet.id} expired and refunded ${participants.length} participants`,
        );
      }

      this.logger.log(`Cron: expired ${staleBets.length} stale bets`);
    } catch (err) {
      this.logger.error(`expireStalesets failed: ${(err as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async logPlatformHealth(): Promise<void> {
    try {
      const [betCounts, escrowData] = await Promise.all([
        this.prisma.bet.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.bet.aggregate({
          where: { status: { in: [BetStatus.ACTIVE, BetStatus.VOTING] } },
          _sum: { escrowAmount: true },
        }),
      ]);

      const countMap = Object.fromEntries(
        betCounts.map((g) => [g.status, g._count._all]),
      );

      this.logger.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          betCounts: countMap,
          totalLockedEscrow: escrowData._sum.escrowAmount ?? 0,
        }),
      );
    } catch (err) {
      this.logger.error(`logPlatformHealth failed: ${(err as Error).message}`);
    }
  }
}
