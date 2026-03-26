import { Injectable } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TRANSACTION_DESCRIPTIONS: Record<TransactionType, string> = {
  DEPOSIT: 'Wallet funded',
  ESCROW_LOCK: 'Stake locked for bet',
  ESCROW_RELEASE: 'Winnings received',
  REFUND: 'Stake refunded',
  FEE: 'Platform fee',
};

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const [user, transactions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      balance: user.walletBalance,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        reference: t.reference,
        betId: t.betId,
        description: TRANSACTION_DESCRIPTIONS[t.type],
        createdAt: t.createdAt,
      })),
    };
  }

  async createPendingDeposit(params: {
    userId: string;
    amount: number;
    reference: string;
  }) {
    return this.prisma.transaction.create({
      data: {
        userId: params.userId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        amount: params.amount,
        reference: params.reference,
      },
    });
  }

  async creditWallet(
    userId: string,
    amount: number,
    transactionData: {
      type: TransactionType;
      reference?: string;
      betId?: string;
    },
  ) {
    const [transaction] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId,
          type: transactionData.type,
          status: TransactionStatus.SUCCESS,
          amount,
          reference: transactionData.reference,
          betId: transactionData.betId,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: amount } },
      }),
    ]);
    return transaction;
  }

  async settleDeposit(reference: string): Promise<{
    alreadySettled: boolean;
    userId: string;
    amount: number;
  } | null> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!transaction) return null;

    if (transaction.status === TransactionStatus.SUCCESS) {
      return {
        alreadySettled: true,
        userId: transaction.userId,
        amount: transaction.amount,
      };
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { reference },
        data: { status: TransactionStatus.SUCCESS },
      }),
      this.prisma.user.update({
        where: { id: transaction.userId },
        data: { walletBalance: { increment: transaction.amount } },
      }),
    ]);

    return {
      alreadySettled: false,
      userId: transaction.userId,
      amount: transaction.amount,
    };
  }

  async getPendingDeposit(reference: string) {
    return this.prisma.transaction.findFirst({
      where: { reference, status: TransactionStatus.PENDING },
    });
  }

  async failDeposit(reference: string) {
    await this.prisma.transaction.updateMany({
      where: { reference, status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.FAILED },
    });
  }
}
