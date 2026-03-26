import { Test, TestingModule } from '@nestjs/testing';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

const userId = 'user-1';

const makeTx = (overrides: Partial<{
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  reference: string | null;
  betId: string | null;
  createdAt: Date;
}> = {}) => ({
  id: 'tx-1',
  userId,
  type: TransactionType.DEPOSIT,
  status: TransactionStatus.PENDING,
  amount: 500,
  reference: 'REF001',
  betId: null,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('WalletService', () => {
  let service: WalletService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    transaction: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      transaction: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getWallet ────────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns balance and last 50 transactions with human-readable descriptions', async () => {
      prisma.user.findUnique.mockResolvedValue({ walletBalance: 1000 });
      prisma.transaction.findMany.mockResolvedValue([
        makeTx({ type: TransactionType.DEPOSIT, status: TransactionStatus.SUCCESS }),
        makeTx({ id: 'tx-2', type: TransactionType.ESCROW_LOCK }),
      ]);

      const result = await service.getWallet(userId);

      expect(result.balance).toBe(1000);
      expect(result.transactions[0].description).toBe('Wallet funded');
      expect(result.transactions[1].description).toBe('Stake locked for bet');
    });

    it('shapes each transaction to the expected fields', async () => {
      const tx = makeTx({ status: TransactionStatus.SUCCESS });
      prisma.user.findUnique.mockResolvedValue({ walletBalance: 500 });
      prisma.transaction.findMany.mockResolvedValue([tx]);

      const result = await service.getWallet(userId);

      expect(result.transactions[0]).toEqual({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        reference: tx.reference,
        betId: tx.betId,
        description: 'Wallet funded',
        createdAt: tx.createdAt,
      });
    });

    it('queries transactions ordered by createdAt desc, limited to 50', async () => {
      prisma.user.findUnique.mockResolvedValue({ walletBalance: 0 });
      prisma.transaction.findMany.mockResolvedValue([]);

      await service.getWallet(userId);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  // ─── createPendingDeposit ─────────────────────────────────────────────────────

  describe('createPendingDeposit', () => {
    it('creates a PENDING DEPOSIT transaction with the given params', async () => {
      const tx = makeTx();
      prisma.transaction.create.mockResolvedValue(tx);

      const result = await service.createPendingDeposit({ userId, amount: 500, reference: 'REF001' });

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
          amount: 500,
          reference: 'REF001',
        },
      });
      expect(result).toEqual(tx);
    });
  });

  // ─── creditWallet ─────────────────────────────────────────────────────────────

  describe('creditWallet', () => {
    it('runs a prisma transaction that creates a SUCCESS record and increments wallet balance', async () => {
      const tx = makeTx({ status: TransactionStatus.SUCCESS });
      prisma.$transaction.mockResolvedValue([tx, {}]);

      const result = await service.creditWallet(userId, 500, {
        type: TransactionType.ESCROW_RELEASE,
        reference: 'REF-CR',
        betId: 'bet-1',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
      expect(result).toEqual(tx);
    });
  });

  // ─── settleDeposit ────────────────────────────────────────────────────────────

  describe('settleDeposit', () => {
    it('returns null when the reference does not exist', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      const result = await service.settleDeposit('UNKNOWN');

      expect(result).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns alreadySettled: true without touching the DB when already SUCCESS', async () => {
      const tx = makeTx({ status: TransactionStatus.SUCCESS });
      prisma.transaction.findUnique.mockResolvedValue(tx);

      const result = await service.settleDeposit('REF001');

      expect(result).toEqual({ alreadySettled: true, userId, amount: tx.amount });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates status to SUCCESS and credits the wallet when PENDING, returns alreadySettled: false', async () => {
      const tx = makeTx({ status: TransactionStatus.PENDING });
      prisma.transaction.findUnique.mockResolvedValue(tx);
      prisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.settleDeposit('REF001');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
      expect(result).toEqual({ alreadySettled: false, userId, amount: tx.amount });
    });
  });

  // ─── getPendingDeposit ────────────────────────────────────────────────────────

  describe('getPendingDeposit', () => {
    it('queries for a PENDING transaction by reference', async () => {
      const tx = makeTx();
      prisma.transaction.findFirst.mockResolvedValue(tx);

      const result = await service.getPendingDeposit('REF001');

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { reference: 'REF001', status: TransactionStatus.PENDING },
      });
      expect(result).toEqual(tx);
    });

    it('returns null when no pending transaction exists for the reference', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      const result = await service.getPendingDeposit('NONE');

      expect(result).toBeNull();
    });
  });

  // ─── failDeposit ─────────────────────────────────────────────────────────────

  describe('failDeposit', () => {
    it('marks all PENDING transactions for the reference as FAILED', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

      await service.failDeposit('REF001');

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { reference: 'REF001', status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.FAILED },
      });
    });
  });
});
