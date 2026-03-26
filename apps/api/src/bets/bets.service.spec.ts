import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BetStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { BetsService } from './bets.service';

// ─── fixtures ────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 3_600_000);
const PAST = new Date(Date.now() - 3_600_000);

const makeCreator = (overrides = {}) => ({
  id: 'creator-1',
  username: 'creator',
  walletBalance: 1000,
  ...overrides,
});

const makeBet = (overrides = {}) => ({
  id: 'bet-1',
  title: 'Test Bet',
  stakeAmount: 100,
  escrowAmount: 100,
  status: BetStatus.PENDING,
  creatorId: 'creator-1',
  expiresAt: FUTURE,
  ...overrides,
});

const makeParticipant = (overrides = {}) => ({
  id: 'part-1',
  betId: 'bet-1',
  userId: 'user-1',
  accepted: null as boolean | null,
  outcomeVote: null as string | null,
  bet: makeBet(),
  ...overrides,
});

const createDto = (overrides = {}) => ({
  title: 'Test Bet',
  stakeAmount: 100,
  participantUsernames: ['player1'],
  expiresInHours: 24 as const,
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const prismaMock = {
  bet: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  betParticipant: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

const walletMock = { creditWallet: jest.fn() };

// ─── setup ───────────────────────────────────────────────────────────────────

describe('BetsService', () => {
  let service: BetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WalletService, useValue: walletMock },
      ],
    }).compile();

    service = module.get<BetsService>(BetsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createBet ─────────────────────────────────────────────────────────────

  describe('createBet', () => {
    it('throws BadRequestException if a participant username does not exist', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeCreator())  // creator fetch
        .mockResolvedValueOnce(null);           // invited user not found

      await expect(service.createBet(createDto({ participantUsernames: ['ghost'] }), 'creator-1'))
        .rejects.toThrow(new BadRequestException('User @ghost not found'));

      expect(prismaMock.bet.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if creator invites themselves', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeCreator())                           // creator fetch
        .mockResolvedValueOnce({ id: 'creator-1', username: 'creator' }); // self lookup

      await expect(service.createBet(createDto({ participantUsernames: ['creator'] }), 'creator-1'))
        .rejects.toThrow(new BadRequestException('You cannot invite yourself'));

      expect(prismaMock.bet.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if creator has insufficient balance', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(makeCreator({ walletBalance: 50 }));

      await expect(service.createBet(createDto({ stakeAmount: 100 }), 'creator-1'))
        .rejects.toThrow(new BadRequestException('Insufficient wallet balance'));

      expect(prismaMock.bet.create).not.toHaveBeenCalled();
    });

    it('creates the bet, locks creator stake, and returns the bet with participants', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeCreator())                          // creator
        .mockResolvedValueOnce({ id: 'player-1', username: 'player1' }); // invited user
      prismaMock.bet.create.mockResolvedValue(makeBet({ escrowAmount: 0 }));
      prismaMock.betParticipant.create.mockResolvedValue({});
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});
      prismaMock.bet.findUnique.mockResolvedValue(makeBet({ participants: [] }));

      const result = await service.createBet(createDto(), 'creator-1');

      expect(prismaMock.bet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ creatorId: 'creator-1', stakeAmount: 100, status: BetStatus.PENDING }),
        }),
      );
      expect(walletMock.creditWallet).toHaveBeenCalledWith('creator-1', -100, {
        type: TransactionType.ESCROW_LOCK,
        betId: 'bet-1',
      });
      expect(prismaMock.betParticipant.create).toHaveBeenCalledTimes(2); // creator + 1 invitee
      expect(result).toBeDefined();
    });
  });

  // ─── acceptBet ─────────────────────────────────────────────────────────────

  describe('acceptBet', () => {
    it('throws NotFoundException if participant record not found', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(null);

      await expect(service.acceptBet('bet-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if user has already responded', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(
        makeParticipant({ accepted: true }),
      );

      await expect(service.acceptBet('bet-1', 'user-1'))
        .rejects.toThrow(new BadRequestException('Already responded to this invite'));
    });

    it('throws BadRequestException if bet is no longer PENDING', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(
        makeParticipant({ bet: makeBet({ status: BetStatus.ACTIVE }) }),
      );

      await expect(service.acceptBet('bet-1', 'user-1'))
        .rejects.toThrow(new BadRequestException('Bet is no longer accepting responses'));
    });

    it('throws BadRequestException if user has insufficient balance', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(makeParticipant());
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', walletBalance: 50 });

      await expect(service.acceptBet('bet-1', 'user-1'))
        .rejects.toThrow(new BadRequestException('Insufficient wallet balance'));

      expect(walletMock.creditWallet).not.toHaveBeenCalled();
    });

    it('sets bet status to ACTIVE when all participants have accepted', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(makeParticipant());
      prismaMock.user.findUnique.mockResolvedValue({ walletBalance: 500 });
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.betParticipant.update.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});
      prismaMock.betParticipant.findMany.mockResolvedValue([
        { accepted: true },
        { accepted: true },
      ]);
      prismaMock.bet.findUnique.mockResolvedValue(makeBet({ status: BetStatus.ACTIVE }));

      await service.acceptBet('bet-1', 'user-1');

      expect(prismaMock.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: BetStatus.ACTIVE }) }),
      );
    });

    it('keeps bet status as PENDING if not all participants have accepted', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(makeParticipant());
      prismaMock.user.findUnique.mockResolvedValue({ walletBalance: 500 });
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.betParticipant.update.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});
      prismaMock.betParticipant.findMany.mockResolvedValue([
        { accepted: true },
        { accepted: null }, // still waiting
      ]);
      prismaMock.bet.findUnique.mockResolvedValue(makeBet());

      await service.acceptBet('bet-1', 'user-1');

      expect(prismaMock.bet.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: BetStatus.ACTIVE }) }),
      );
    });
  });

  // ─── declineBet ────────────────────────────────────────────────────────────

  describe('declineBet', () => {
    it('refunds all accepted participants when someone declines', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(makeParticipant());
      prismaMock.betParticipant.update.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});
      prismaMock.betParticipant.findMany.mockResolvedValue([
        { id: 'p2', userId: 'creator-1', accepted: true },
        { id: 'p3', userId: 'player-1', accepted: true },
      ]);
      walletMock.creditWallet.mockResolvedValue({});
      prismaMock.bet.findUnique.mockResolvedValue(makeBet());

      await service.declineBet('bet-1', 'user-1');

      expect(walletMock.creditWallet).toHaveBeenCalledTimes(2);
      expect(walletMock.creditWallet).toHaveBeenCalledWith('creator-1', 100, {
        type: TransactionType.REFUND,
        betId: 'bet-1',
      });
      expect(walletMock.creditWallet).toHaveBeenCalledWith('player-1', 100, {
        type: TransactionType.REFUND,
        betId: 'bet-1',
      });
    });

    it('sets bet status to REFUNDED', async () => {
      prismaMock.betParticipant.findFirst.mockResolvedValue(makeParticipant());
      prismaMock.betParticipant.update.mockResolvedValue({});
      prismaMock.bet.update.mockResolvedValue({});
      prismaMock.betParticipant.findMany.mockResolvedValue([]);
      prismaMock.bet.findUnique.mockResolvedValue(makeBet());

      await service.declineBet('bet-1', 'user-1');

      expect(prismaMock.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BetStatus.REFUNDED, escrowAmount: 0 }),
        }),
      );
    });
  });

  // ─── checkConsensus (via vote) ──────────────────────────────────────────────

  describe('checkConsensus (via vote)', () => {
    const setupVote = (participants: { outcomeVote: string | null }[]) => {
      prismaMock.betParticipant.findFirst
        .mockResolvedValueOnce(
          makeParticipant({
            accepted: true,
            outcomeVote: null,
            bet: makeBet({ status: BetStatus.VOTING }),
          }),
        )
        .mockResolvedValueOnce({ id: 'pw', userId: 'winner-1' }); // winner validation

      prismaMock.betParticipant.update.mockResolvedValue({});
      prismaMock.betParticipant.findMany.mockResolvedValue(participants);
    };

    it('does not settle if not all participants have voted', async () => {
      setupVote([{ outcomeVote: 'winner-1' }, { outcomeVote: null }]);
      prismaMock.bet.findUnique.mockResolvedValue(makeBet({ status: BetStatus.VOTING }));

      await service.vote('bet-1', 'user-1', { winnerId: 'winner-1' });

      expect(prismaMock.bet.update).not.toHaveBeenCalled();
      expect(walletMock.creditWallet).not.toHaveBeenCalled();
    });

    it('settles with correct payouts on a unanimous vote', async () => {
      setupVote([{ outcomeVote: 'winner-1' }, { outcomeVote: 'winner-1' }]);
      prismaMock.bet.findUnique
        .mockResolvedValueOnce(makeBet({ escrowAmount: 200, creatorId: 'creator-1' })) // in checkConsensus
        .mockResolvedValueOnce(makeBet({ status: BetStatus.SETTLED }));               // final return
      prismaMock.bet.update.mockResolvedValue({});
      walletMock.creditWallet.mockResolvedValue({});

      await service.vote('bet-1', 'user-1', { winnerId: 'winner-1' });

      // platformFee = 200 * 0.03 = 6, winnings = 194
      expect(walletMock.creditWallet).toHaveBeenCalledWith('winner-1', 194, {
        type: TransactionType.ESCROW_RELEASE,
        betId: 'bet-1',
      });
      expect(walletMock.creditWallet).toHaveBeenCalledWith('creator-1', 0, {
        type: TransactionType.FEE,
        betId: 'bet-1',
      });
      expect(prismaMock.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BetStatus.SETTLED, winnerId: 'winner-1' }),
        }),
      );
    });

    it('sets status to DISPUTED on conflicting votes', async () => {
      setupVote([{ outcomeVote: 'winner-1' }, { outcomeVote: 'winner-2' }]);
      prismaMock.bet.findUnique
        .mockResolvedValueOnce(makeBet({ escrowAmount: 200, creatorId: 'creator-1' }))
        .mockResolvedValueOnce(makeBet({ status: BetStatus.DISPUTED }));
      prismaMock.bet.update.mockResolvedValue({});

      await service.vote('bet-1', 'user-1', { winnerId: 'winner-1' });

      expect(prismaMock.bet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BetStatus.DISPUTED } }),
      );
      expect(walletMock.creditWallet).not.toHaveBeenCalled();
    });
  });
});
