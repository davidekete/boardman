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

  async getVirtualAccount(userId: string): Promise<{
    accountNumber: string;
    bankName: string;
    bankCode: string;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        virtualAccountNumber: true,
        virtualAccountBank: true,
        virtualAccountBankCode: true,
      },
    });

    if (!user?.virtualAccountNumber) return null;

    return {
      accountNumber: user.virtualAccountNumber,
      bankName: user.virtualAccountBank,
      bankCode: user.virtualAccountBankCode,
    };
  }

  async saveVirtualAccount(
    userId: string,
    account: { accountNumber: string; bankName: string; bankCode: string },
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        virtualAccountNumber: account.accountNumber,
        virtualAccountBank: account.bankName,
        virtualAccountBankCode: account.bankCode,
      },
    });
  }

  async getUserByVirtualAccount(
    accountNumber: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({
      where: { virtualAccountNumber: accountNumber },
      select: { id: true },
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
}
