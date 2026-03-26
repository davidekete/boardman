import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterswitchService } from '../payments/interswitch.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

const FRONTEND_URL = 'https://myapp.com';

const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
};

const makeReq = (user = mockUser) => ({ user } as any);

const makeTx = (overrides = {}) => ({
  id: 'tx-1',
  userId: 'user-1',
  type: TransactionType.DEPOSIT,
  status: TransactionStatus.PENDING,
  amount: 500,
  reference: 'REF001',
  betId: null,
  createdAt: new Date(),
  ...overrides,
});

const makeRes = () => ({ redirect: jest.fn() } as any);

describe('WalletController', () => {
  let controller: WalletController;
  let walletService: {
    getWallet: jest.Mock;
    createPendingDeposit: jest.Mock;
    getPendingDeposit: jest.Mock;
    settleDeposit: jest.Mock;
    failDeposit: jest.Mock;
  };
  let interswitchService: {
    initiatePayment: jest.Mock;
    verifyPayment: jest.Mock;
  };

  beforeEach(async () => {
    walletService = {
      getWallet: jest.fn(),
      createPendingDeposit: jest.fn(),
      getPendingDeposit: jest.fn(),
      settleDeposit: jest.fn(),
      failDeposit: jest.fn(),
    };

    interswitchService = {
      initiatePayment: jest.fn(),
      verifyPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        { provide: WalletService, useValue: walletService },
        { provide: InterswitchService, useValue: interswitchService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => key === 'FRONTEND_URL' ? FRONTEND_URL : undefined) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WalletController>(WalletController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getWallet ────────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns the wallet for the authenticated user', () => {
      const wallet = { balance: 1000, transactions: [] };
      walletService.getWallet.mockResolvedValue(wallet);

      const result = controller.getWallet(makeReq());

      expect(walletService.getWallet).toHaveBeenCalledWith('user-1');
      expect(result).resolves.toEqual(wallet);
    });
  });

  // ─── initiateFunding ──────────────────────────────────────────────────────────

  describe('initiateFunding', () => {
    it('converts amount to kobo, initiates payment, creates pending deposit, and returns url + reference', async () => {
      interswitchService.initiatePayment.mockResolvedValue({ paymentUrl: 'https://pay.url', reference: 'REF001' });
      walletService.createPendingDeposit.mockResolvedValue(makeTx());

      const result = await controller.initiateFunding({ amount: 500 }, makeReq());

      expect(interswitchService.initiatePayment).toHaveBeenCalledWith({
        amount: 50000, // 500 * 100
        email: mockUser.email,
        userId: mockUser.id,
      });
      expect(walletService.createPendingDeposit).toHaveBeenCalledWith({
        userId: mockUser.id,
        amount: 500, // original Naira amount
        reference: 'REF001',
      });
      expect(result).toEqual({ paymentUrl: 'https://pay.url', reference: 'REF001' });
    });
  });

  // ─── verifyFunding ────────────────────────────────────────────────────────────

  describe('verifyFunding', () => {
    it('redirects to error=invalid_reference when no pending or existing transaction is found', async () => {
      walletService.getPendingDeposit.mockResolvedValue(null);
      walletService.settleDeposit.mockResolvedValue(null);
      const res = makeRes();

      await controller.verifyFunding('UNKNOWN', res);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/wallet?error=invalid_reference`);
      expect(interswitchService.verifyPayment).not.toHaveBeenCalled();
    });

    it('redirects to funded=true when no pending but transaction was already settled', async () => {
      walletService.getPendingDeposit.mockResolvedValue(null);
      walletService.settleDeposit.mockResolvedValue({ alreadySettled: true, userId: 'user-1', amount: 500 });
      const res = makeRes();

      await controller.verifyFunding('REF001', res);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/wallet?funded=true`);
      expect(interswitchService.verifyPayment).not.toHaveBeenCalled();
    });

    it('fails the deposit and redirects to error=payment_failed when Interswitch verification fails', async () => {
      const pending = makeTx({ amount: 500 });
      walletService.getPendingDeposit.mockResolvedValue(pending);
      interswitchService.verifyPayment.mockResolvedValue({ success: false });
      walletService.failDeposit.mockResolvedValue(undefined);
      const res = makeRes();

      await controller.verifyFunding('REF001', res);

      expect(interswitchService.verifyPayment).toHaveBeenCalledWith('REF001', 50000); // 500 * 100
      expect(walletService.failDeposit).toHaveBeenCalledWith('REF001');
      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/wallet?error=payment_failed`);
    });

    it('settles the deposit and redirects to funded=true when Interswitch verification succeeds', async () => {
      const pending = makeTx({ amount: 500 });
      walletService.getPendingDeposit.mockResolvedValue(pending);
      interswitchService.verifyPayment.mockResolvedValue({ success: true, amount: 50000 });
      walletService.settleDeposit.mockResolvedValue({ alreadySettled: false, userId: 'user-1', amount: 500 });
      const res = makeRes();

      await controller.verifyFunding('REF001', res);

      expect(walletService.settleDeposit).toHaveBeenCalledWith('REF001');
      expect(walletService.failDeposit).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/wallet?funded=true`);
    });
  });
});
