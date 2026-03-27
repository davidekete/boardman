import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { InterswitchService } from '../payments/interswitch.service';
import { PrismaService } from '../prisma/prisma.service';

const TRANSACTION_DESCRIPTIONS: Record<TransactionType, string> = {
  DEPOSIT: 'Wallet funded',
  ESCROW_LOCK: 'Stake locked for bet',
  ESCROW_RELEASE: 'Winnings received',
  REFUND: 'Stake refunded',
  FEE: 'Platform fee',
  WITHDRAWAL: 'Withdrawal to bank account',
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interswitchService: InterswitchService,
    private readonly mailService: MailService,
  ) {}

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

  // ── Withdrawal Account ──────────────────────────────────────────────────────

  async getWithdrawalAccount(userId: string) {
    return this.prisma.withdrawalAccount.findUnique({ where: { userId } });
  }

  async saveWithdrawalAccount(
    userId: string,
    data: {
      accountNumber: string;
      bankCode: string;
      bankName: string;
      accountName: string;
    },
  ) {
    return this.prisma.withdrawalAccount.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data },
    });
  }

  // ── Withdraw ────────────────────────────────────────────────────────────────

  async withdraw(userId: string, amount: number) {
    // Fetch user and account upfront — needed for validation and email
    const [user, account] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          walletBalance: true,
        },
      }),
      this.prisma.withdrawalAccount.findUnique({ where: { userId } }),
    ]);

    if (!account) {
      throw new BadRequestException(
        'Please save a withdrawal account before withdrawing',
      );
    }

    if (user.walletBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    if (amount < 500) {
      throw new BadRequestException('Minimum withdrawal is ₦500');
    }

    const transferReference = `WDR-${Date.now()}-${userId.slice(0, 6)}`;

    // Create PENDING transaction + deduct balance atomically (before Interswitch call
    // to prevent double-spend race conditions — reversal on failure is the safety net)
    const [transaction] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          amount,
          reference: transferReference,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: -amount } },
      }),
    ]);

    try {
      await this.interswitchService.transferFunds({
        amount: amount * 100, // convert to kobo
        accountNumber: account.accountNumber,
        bankCode: account.bankCode,
        accountName: account.accountName,
        senderPhone: '',
        senderEmail: user.email,
        senderLastname: user.lastName,
        senderOthernames: user.firstName,
        transferReference,
      });

      // Update transaction to SUCCESS
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.SUCCESS },
      });

      // Send confirmation email — non-critical, never blocks the response
      const timestamp = new Date().toLocaleString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      try {
        await this.mailService.sendWithdrawalEmail({
          email: user.email,
          firstName: user.firstName,
          amount,
          accountName: account.accountName,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          reference: transferReference,
          timestamp,
        });
      } catch (emailErr) {
        this.logger.error(
          `Failed to send withdrawal email to ${user.email}`,
          emailErr,
        );
      }

      return { message: 'Withdrawal successful', reference: transferReference };
    } catch (err) {
      // Update transaction to FAILED
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });

      // Reverse the wallet deduction
      await this.creditWallet(userId, amount, {
        type: TransactionType.REFUND,
        reference: `${transferReference}-REVERSAL`,
      });

      throw new BadRequestException(
        'Withdrawal failed. Your balance has been restored.',
      );
    }
  }
}
