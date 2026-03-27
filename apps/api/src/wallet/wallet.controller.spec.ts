import { Test, TestingModule } from '@nestjs/testing';
import { TransactionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterswitchService } from '../payments/interswitch.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

const mockUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'user@example.com',
};

const makeReq = (user = mockUser) => ({ user } as any);

const virtualAccount = {
  accountNumber: '7120241111',
  bankName: 'Wema Bank',
  bankCode: 'WEMA',
};

describe('WalletController', () => {
  let controller: WalletController;
  let walletService: {
    getWallet: jest.Mock;
    getVirtualAccount: jest.Mock;
    saveVirtualAccount: jest.Mock;
    getUserByVirtualAccount: jest.Mock;
    creditWallet: jest.Mock;
  };
  let interswitchService: {
    createVirtualAccount: jest.Mock;
  };

  beforeEach(async () => {
    walletService = {
      getWallet: jest.fn(),
      getVirtualAccount: jest.fn(),
      saveVirtualAccount: jest.fn(),
      getUserByVirtualAccount: jest.fn(),
      creditWallet: jest.fn(),
    };

    interswitchService = {
      createVirtualAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        { provide: WalletService, useValue: walletService },
        { provide: InterswitchService, useValue: interswitchService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WalletController>(WalletController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getWallet ────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns the wallet for the authenticated user', async () => {
      const wallet = { balance: 1000, transactions: [] };
      walletService.getWallet.mockResolvedValue(wallet);

      const result = await controller.getWallet(makeReq());

      expect(walletService.getWallet).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(wallet);
    });
  });

  // ─── initiateFunding ──────────────────────────────────────────────────────

  describe('initiateFunding', () => {
    it('returns the cached virtual account without calling Interswitch when one exists', async () => {
      walletService.getVirtualAccount.mockResolvedValue(virtualAccount);

      const result = await controller.initiateFunding(makeReq());

      expect(walletService.getVirtualAccount).toHaveBeenCalledWith('user-1');
      expect(interswitchService.createVirtualAccount).not.toHaveBeenCalled();
      expect(walletService.saveVirtualAccount).not.toHaveBeenCalled();
      expect(result).toEqual(virtualAccount);
    });

    it('creates, saves, and returns a new virtual account when none exists', async () => {
      walletService.getVirtualAccount.mockResolvedValue(null);
      interswitchService.createVirtualAccount.mockResolvedValue(virtualAccount);
      walletService.saveVirtualAccount.mockResolvedValue(undefined);

      const result = await controller.initiateFunding(makeReq());

      expect(interswitchService.createVirtualAccount).toHaveBeenCalledWith(
        'John Doe',
      );
      expect(walletService.saveVirtualAccount).toHaveBeenCalledWith(
        'user-1',
        virtualAccount,
      );
      expect(result).toEqual(virtualAccount);
    });
  });

  // ─── handleWebhook ────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    const validWebhook = {
      event: 'TRANSACTION.COMPLETED',
      uuid: 'uuid-001',
      data: {
        retrievalReferenceNumber: '7120241111',
        amount: 50000, // 500 Naira in kobo
        responseCode: '00',
      },
    };

    it('credits wallet with amount in Naira when webhook is valid', async () => {
      walletService.getUserByVirtualAccount.mockResolvedValue({ id: 'user-1' });
      walletService.creditWallet.mockResolvedValue({});

      const result = await controller.handleWebhook(validWebhook);

      expect(walletService.getUserByVirtualAccount).toHaveBeenCalledWith(
        '7120241111',
      );
      expect(walletService.creditWallet).toHaveBeenCalledWith('user-1', 500, {
        type: TransactionType.DEPOSIT,
        reference: 'uuid-001',
      });
      expect(result).toEqual({ received: true });
    });

    it('returns received without crediting when event is not TRANSACTION.COMPLETED', async () => {
      const result = await controller.handleWebhook({
        event: 'OTHER.EVENT',
        uuid: 'uuid-002',
        data: {},
      });

      expect(walletService.getUserByVirtualAccount).not.toHaveBeenCalled();
      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('returns received without crediting when responseCode is not "00"', async () => {
      const result = await controller.handleWebhook({
        ...validWebhook,
        data: { ...validWebhook.data, responseCode: '09' },
      });

      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('returns received without crediting when virtual account is unknown', async () => {
      walletService.getUserByVirtualAccount.mockResolvedValue(null);

      const result = await controller.handleWebhook(validWebhook);

      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('ignores a duplicate webhook (P2002) and returns received', async () => {
      walletService.getUserByVirtualAccount.mockResolvedValue({ id: 'user-1' });
      const dupError = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      walletService.creditWallet.mockRejectedValue(dupError);

      const result = await controller.handleWebhook(validWebhook);

      expect(result).toEqual({ received: true });
    });
  });
});
