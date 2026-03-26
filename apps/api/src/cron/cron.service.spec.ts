import { Test, TestingModule } from '@nestjs/testing';
import { BetStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CronService } from './cron.service';

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeBet = (overrides = {}) => ({
  id: 'bet-1',
  stakeAmount: 100,
  status: BetStatus.PENDING,
  expiresAt: new Date(Date.now() - 3_600_000),
  ...overrides,
});

const makeParticipant = (overrides = {}) => ({
  id: 'part-1',
  betId: 'bet-1',
  userId: 'user-1',
  accepted: true,
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const prismaMock = {
  bet: {
    findMany: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  betParticipant: {
    findMany: jest.fn(),
  },
};

const walletMock = { creditWallet: jest.fn() };

// ─── setup ───────────────────────────────────────────────────────────────────

describe('CronService', () => {
  let service: CronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WalletService, useValue: walletMock },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── expireStalesets ───────────────────────────────────────────────────────

  describe('expireStalesets', () => {
    it('should do nothing and log when no stale bets are found', async () => {
      prismaMock.bet.findMany.mockResolvedValue([]);

      await service.expireStalesets();

      expect(prismaMock.betParticipant.findMany).not.toHaveBeenCalled();
      expect(walletMock.creditWallet).not.toHaveBeenCalled();
      expect(prismaMock.bet.update).not.toHaveBeenCalled();
    });

    it('should refund each accepted participant for every stale bet', async () => {
      prismaMock.bet.findMany.mockResolvedValue([makeBet()]);
      prismaMock.betParticipant.findMany.mockResolvedValue([
        makeParticipant({ userId: 'user-1' }),
        makeParticipant({ id: 'part-2', userId: 'user-2' }),
      ]);
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});

      await service.expireStalesets();

      expect(walletMock.creditWallet).toHaveBeenCalledTimes(2);
    });

    it('should call creditWallet with the correct stakeAmount per participant', async () => {
      prismaMock.bet.findMany.mockResolvedValue([makeBet({ id: 'bet-1', stakeAmount: 250 })]);
      prismaMock.betParticipant.findMany.mockResolvedValue([
        makeParticipant({ userId: 'user-1', betId: 'bet-1' }),
      ]);
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});

      await service.expireStalesets();

      expect(walletMock.creditWallet).toHaveBeenCalledWith('user-1', 250, {
        type: TransactionType.REFUND,
        betId: 'bet-1',
      });
    });

    it('should set bet status to REFUNDED and escrowAmount to 0', async () => {
      prismaMock.bet.findMany.mockResolvedValue([makeBet({ id: 'bet-1' })]);
      prismaMock.betParticipant.findMany.mockResolvedValue([]);
      prismaMock.bet.update.mockResolvedValue({});

      await service.expireStalesets();

      expect(prismaMock.bet.update).toHaveBeenCalledWith({
        where: { id: 'bet-1' },
        data: { status: BetStatus.REFUNDED, escrowAmount: 0 },
      });
    });

    it('should not refund participants where accepted is false or null', async () => {
      prismaMock.bet.findMany.mockResolvedValue([makeBet({ id: 'bet-1' })]);
      // DB query uses accepted: true filter — mock returns empty to simulate no accepted participants
      prismaMock.betParticipant.findMany.mockResolvedValue([]);
      prismaMock.bet.update.mockResolvedValue({});

      await service.expireStalesets();

      expect(prismaMock.betParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ accepted: true }) }),
      );
      expect(walletMock.creditWallet).not.toHaveBeenCalled();
    });

    it('should handle multiple stale bets in a single run', async () => {
      prismaMock.bet.findMany.mockResolvedValue([
        makeBet({ id: 'bet-1', stakeAmount: 100 }),
        makeBet({ id: 'bet-2', stakeAmount: 200 }),
      ]);
      prismaMock.betParticipant.findMany
        .mockResolvedValueOnce([makeParticipant({ userId: 'user-1', betId: 'bet-1' })])
        .mockResolvedValueOnce([makeParticipant({ id: 'part-2', userId: 'user-2', betId: 'bet-2' })]);
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});

      await service.expireStalesets();

      expect(walletMock.creditWallet).toHaveBeenCalledTimes(2);
      expect(walletMock.creditWallet).toHaveBeenCalledWith('user-1', 100, {
        type: TransactionType.REFUND,
        betId: 'bet-1',
      });
      expect(walletMock.creditWallet).toHaveBeenCalledWith('user-2', 200, {
        type: TransactionType.REFUND,
        betId: 'bet-2',
      });
      expect(prismaMock.bet.update).toHaveBeenCalledTimes(2);
    });
  });
});
