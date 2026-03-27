import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { InterswitchService } from '../payments/interswitch.service';
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

const mockAccount = {
  id: 'acc-1',
  userId,
  accountNumber: '1234567890',
  accountName: 'JOHN DOE',
  bankCode: '058',
  bankName: 'GTBank',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@test.com',
  walletBalance: 5000,
};

const mockPendingTx = makeTx({
  id: 'tx-pending',
  type: TransactionType.WITHDRAWAL,
  status: TransactionStatus.PENDING,
  amount: 1000,
  reference: 'WDR-123-user-1',
});

describe('WalletService', () => {
  let service: WalletService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    transaction: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    withdrawalAccount: { findUnique: jest.Mock; upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let interswitchMock: {
    accountNameInquiry: jest.Mock;
    transferFunds: jest.Mock;
  };
  let mailMock: { sendWithdrawalEmail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      transaction: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      withdrawalAccount: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    interswitchMock = {
      accountNameInquiry: jest.fn(),
      transferFunds: jest.fn(),
    };

    mailMock = {
      sendWithdrawalEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: InterswitchService, useValue: interswitchMock },
        { provide: MailService, useValue: mailMock },
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

  // ─── withdraw ─────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('should throw if user has no saved withdrawal account', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.withdrawalAccount.findUnique.mockResolvedValue(null);

      await expect(service.withdraw(userId, 1000)).rejects.toThrow(
        'Please save a withdrawal account before withdrawing',
      );
    });

    it('should throw if user has insufficient balance', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        walletBalance: 100,
      });
      prisma.withdrawalAccount.findUnique.mockResolvedValue(mockAccount);

      await expect(service.withdraw(userId, 1000)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('should deduct wallet balance before calling transferFunds', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.withdrawalAccount.findUnique.mockResolvedValue(mockAccount);
      prisma.transaction.update.mockResolvedValue({
        ...mockPendingTx,
        status: TransactionStatus.SUCCESS,
      });
      mailMock.sendWithdrawalEmail.mockResolvedValue(undefined);

      const callOrder: string[] = [];
      prisma.$transaction.mockImplementation(async () => {
        callOrder.push('deduct');
        return [mockPendingTx, {}];
      });
      interswitchMock.transferFunds.mockImplementation(async () => {
        callOrder.push('transfer');
        return { reference: mockPendingTx.reference };
      });

      await service.withdraw(userId, 1000);

      expect(callOrder).toEqual(['deduct', 'transfer']);
    });

    it('should update transaction to SUCCESS on successful transfer', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.withdrawalAccount.findUnique.mockResolvedValue(mockAccount);
      prisma.$transaction.mockResolvedValue([mockPendingTx, {}]);
      interswitchMock.transferFunds.mockResolvedValue({
        reference: mockPendingTx.reference,
      });
      prisma.transaction.update.mockResolvedValue({
        ...mockPendingTx,
        status: TransactionStatus.SUCCESS,
      });
      mailMock.sendWithdrawalEmail.mockResolvedValue(undefined);

      await service.withdraw(userId, 1000);

      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPendingTx.id },
          data: { status: TransactionStatus.SUCCESS },
        }),
      );
    });

    it('should update transaction to FAILED if transferFunds throws', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.withdrawalAccount.findUnique.mockResolvedValue(mockAccount);
      prisma.$transaction
        .mockResolvedValueOnce([mockPendingTx, {}]) // initial deduction
        .mockResolvedValue([makeTx({ type: TransactionType.REFUND }), {}]); // reversal creditWallet
      interswitchMock.transferFunds.mockRejectedValue(
        new BadRequestException('Transfer failed'),
      );
      prisma.transaction.update.mockResolvedValue({
        ...mockPendingTx,
        status: TransactionStatus.FAILED,
      });

      await expect(service.withdraw(userId, 1000)).rejects.toThrow(
        'Withdrawal failed. Your balance has been restored.',
      );

      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TransactionStatus.FAILED },
        }),
      );
    });

    it('should reverse the wallet deduction if transferFunds throws', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.withdrawalAccount.findUnique.mockResolvedValue(mockAccount);
      prisma.$transaction
        .mockResolvedValueOnce([mockPendingTx, {}]) // initial deduction
        .mockResolvedValue([makeTx({ type: TransactionType.REFUND }), {}]); // reversal
      interswitchMock.transferFunds.mockRejectedValue(
        new BadRequestException('Transfer failed'),
      );
      prisma.transaction.update.mockResolvedValue({
        ...mockPendingTx,
        status: TransactionStatus.FAILED,
      });

      await expect(service.withdraw(userId, 1000)).rejects.toThrow();

      // $transaction called twice: once for deduction, once for reversal (creditWallet)
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should return success message and reference on completion', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.withdrawalAccount.findUnique.mockResolvedValue(mockAccount);
      prisma.$transaction.mockResolvedValue([mockPendingTx, {}]);
      interswitchMock.transferFunds.mockResolvedValue({
        reference: mockPendingTx.reference,
      });
      prisma.transaction.update.mockResolvedValue({
        ...mockPendingTx,
        status: TransactionStatus.SUCCESS,
      });
      mailMock.sendWithdrawalEmail.mockResolvedValue(undefined);

      const result = await service.withdraw(userId, 1000);

      expect(result.message).toBe('Withdrawal successful');
      expect(result.reference).toMatch(/^WDR-/);
    });
  });
});
