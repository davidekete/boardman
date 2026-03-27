import { Test, TestingModule } from '@nestjs/testing';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

const userId = 'user-1';

const makeTx = (
  overrides: Partial<{
    id: string;
    userId: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    reference: string | null;
    betId: string | null;
    createdAt: Date;
  }> = {},
) => ({
  id: 'tx-1',
  userId,
  type: TransactionType.DEPOSIT,
  status: TransactionStatus.SUCCESS,
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
    transaction: { findMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      transaction: { findMany: jest.fn(), create: jest.fn() },
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

  // ─── getWallet ────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns balance and last 50 transactions with human-readable descriptions', async () => {
      prisma.user.findUnique.mockResolvedValue({ walletBalance: 1000 });
      prisma.transaction.findMany.mockResolvedValue([
        makeTx({ type: TransactionType.DEPOSIT }),
        makeTx({ id: 'tx-2', type: TransactionType.ESCROW_LOCK }),
      ]);

      const result = await service.getWallet(userId);

      expect(result.balance).toBe(1000);
      expect(result.transactions[0].description).toBe('Wallet funded');
      expect(result.transactions[1].description).toBe('Stake locked for bet');
    });

    it('shapes each transaction to the expected fields', async () => {
      const tx = makeTx();
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

  // ─── getVirtualAccount ────────────────────────────────────────────────────

  describe('getVirtualAccount', () => {
    it('returns mapped account details when the user has a virtual account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        virtualAccountNumber: '7120241111',
        virtualAccountBank: 'Wema Bank',
        virtualAccountBankCode: 'WEMA',
      });

      const result = await service.getVirtualAccount(userId);

      expect(result).toEqual({
        accountNumber: '7120241111',
        bankName: 'Wema Bank',
        bankCode: 'WEMA',
      });
    });

    it('returns null when the user has no virtual account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        virtualAccountNumber: null,
        virtualAccountBank: null,
        virtualAccountBankCode: null,
      });

      const result = await service.getVirtualAccount(userId);

      expect(result).toBeNull();
    });
  });

  // ─── saveVirtualAccount ───────────────────────────────────────────────────

  describe('saveVirtualAccount', () => {
    it('updates the user record with the virtual account fields', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.saveVirtualAccount(userId, {
        accountNumber: '7120241111',
        bankName: 'Wema Bank',
        bankCode: 'WEMA',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          virtualAccountNumber: '7120241111',
          virtualAccountBank: 'Wema Bank',
          virtualAccountBankCode: 'WEMA',
        },
      });
    });
  });

  // ─── getUserByVirtualAccount ──────────────────────────────────────────────

  describe('getUserByVirtualAccount', () => {
    it('returns the user id for a known virtual account number', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId });

      const result = await service.getUserByVirtualAccount('7120241111');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { virtualAccountNumber: '7120241111' },
        select: { id: true },
      });
      expect(result).toEqual({ id: userId });
    });

    it('returns null for an unknown virtual account number', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserByVirtualAccount('0000000000');

      expect(result).toBeNull();
    });
  });

  // ─── creditWallet ─────────────────────────────────────────────────────────

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
});
