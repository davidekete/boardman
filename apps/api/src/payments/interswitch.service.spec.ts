import { HttpService } from '@nestjs/axios';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { of, throwError } from 'rxjs';
import { InterswitchService } from './interswitch.service';

const makeAxiosError = (status: number) => {
  const err = Object.assign(
    new Error(`Request failed with status code ${status}`),
    {
      isAxiosError: true,
      response: { status, data: {} },
    },
  );
  return err;
};

const CONFIG: Record<string, string> = {
  INTERSWITCH_API_URL: 'https://api.interswitch.com',
  INTERSWITCH_CLIENT_ID: 'client123',
  INTERSWITCH_SECRET_KEY: 'secret456',
  INTERSWITCH_MERCHANT_CODE: 'MERCH001',
  INTERSWITCH_PAY_ITEM_ID: 'ITEM001',
  INTERSWITCH_REDIRECT_URL: 'https://myapp.com/callback',
  INTERSWITCH_MAC_KEY: 'mac-key-xyz',
};

describe('InterswitchService', () => {
  let service: InterswitchService;
  let http: { post: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    http = { post: jest.fn(), get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterswitchService,
        { provide: HttpService, useValue: http },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
      ],
    }).compile();

    service = module.get<InterswitchService>(InterswitchService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── initiatePayment ──────────────────────────────────────────────────────────

  describe('initiatePayment', () => {
    const tokenResponse = {
      data: { access_token: 'tok-abc', expires_in: 3600 },
    };
    const payResponse = {
      data: {
        paymentUrl: 'https://pay.interswitch.com/pay',
        reference: 'REF123',
      },
    };

    it('fetches an access token and returns paymentUrl + reference', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(of(payResponse));

      const result = await service.initiatePayment({
        amount: 50000,
        email: 'user@example.com',
        userId: 'u1',
      });

      expect(result).toEqual({
        paymentUrl: 'https://pay.interswitch.com/pay',
        reference: 'REF123',
      });
    });

    it('sends the amount as a string and includes merchant config in the request body', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(of(payResponse));

      await service.initiatePayment({
        amount: 50000,
        email: 'user@example.com',
        userId: 'u1',
      });

      const [, body] = http.post.mock.calls[1];
      expect(body.amount).toBe('50000');
      expect(body.merchantCode).toBe('MERCH001');
      expect(body.customerEmail).toBe('user@example.com');
      expect(body.customerId).toBe('u1');
      expect(body.currencyCode).toBe('566');
    });

    it('authorizes the token request with Basic credentials', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(of(payResponse));

      await service.initiatePayment({
        amount: 100,
        email: 'a@b.com',
        userId: 'u1',
      });

      const [, , tokenConfig] = http.post.mock.calls[0];
      const expectedCredentials = Buffer.from('client123:secret456').toString(
        'base64',
      );
      expect(tokenConfig.headers.Authorization).toBe(
        `Basic ${expectedCredentials}`,
      );
    });

    it('caches the access token — only one OAuth call across two initiations', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValue(of(payResponse));

      await service.initiatePayment({
        amount: 100,
        email: 'a@b.com',
        userId: 'u1',
      });
      await service.initiatePayment({
        amount: 200,
        email: 'a@b.com',
        userId: 'u1',
      });

      const oauthCalls = http.post.mock.calls.filter(([url]) =>
        (url as string).includes('passport/oauth'),
      );
      expect(oauthCalls).toHaveLength(1);
    });

    it('throws BadGatewayException when the token request returns an Axios error', async () => {
      http.post.mockReturnValueOnce(throwError(() => makeAxiosError(405)));

      await expect(
        service.initiatePayment({
          amount: 100,
          email: 'a@b.com',
          userId: 'u1',
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when the payment initiation request returns an Axios error', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(throwError(() => makeAxiosError(405)));

      await expect(
        service.initiatePayment({
          amount: 100,
          email: 'a@b.com',
          userId: 'u1',
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('re-throws non-Axios errors from initiatePayment as-is', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(throwError(() => new Error('unexpected')));

      await expect(
        service.initiatePayment({
          amount: 100,
          email: 'a@b.com',
          userId: 'u1',
        }),
      ).rejects.toThrow('unexpected');
    });

    it('re-fetches the token after the cached one expires (60s buffer)', async () => {
      // First call: token with 61s lifetime (buffer = 1s, expires immediately)
      http.post
        .mockReturnValueOnce(
          of({ data: { access_token: 'tok-1', expires_in: 61 } }),
        )
        .mockReturnValueOnce(of(payResponse))
        .mockReturnValueOnce(
          of({ data: { access_token: 'tok-2', expires_in: 3600 } }),
        )
        .mockReturnValueOnce(of(payResponse));

      await service.initiatePayment({
        amount: 100,
        email: 'a@b.com',
        userId: 'u1',
      });

      // Force expiry by rewinding the clock
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);

      await service.initiatePayment({
        amount: 200,
        email: 'a@b.com',
        userId: 'u1',
      });

      const oauthCalls = http.post.mock.calls.filter(([url]) =>
        (url as string).includes('passport/oauth'),
      );
      expect(oauthCalls).toHaveLength(2);

      (Date.now as jest.Mock).mockRestore();
    });
  });

  // ─── verifyPayment ────────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('returns { success: true, amount } when ResponseCode is "00"', async () => {
      http.get.mockReturnValueOnce(
        of({ data: { ResponseCode: '00', Amount: 50000 } }),
      );

      const result = await service.verifyPayment('REF001', 50000);

      expect(result).toEqual({ success: true, amount: 50000 });
    });

    it('returns { success: false } when ResponseCode is not "00"', async () => {
      http.get.mockReturnValueOnce(of({ data: { ResponseCode: '09' } }));

      const result = await service.verifyPayment('REF002', 50000);

      expect(result).toEqual({ success: false });
    });

    it('returns { success: false } when the HTTP call throws', async () => {
      http.get.mockReturnValueOnce(
        throwError(() => new Error('network error')),
      );

      const result = await service.verifyPayment('REF003', 50000);

      expect(result).toEqual({ success: false });
    });

    it('sends the correct SHA-512 MAC hash in the Hash header', async () => {
      http.get.mockReturnValueOnce(
        of({ data: { ResponseCode: '00', Amount: 100 } }),
      );

      const txnRef = 'TXN-HASH-TEST';
      const expectedHash = createHash('sha512')
        .update(`ITEM001${txnRef}mac-key-xyz`)
        .digest('hex');

      await service.verifyPayment(txnRef, 100);

      const [, options] = http.get.mock.calls[0];
      expect(options.headers.Hash).toBe(expectedHash);
    });

    it('includes merchantcode, transactionreference and amount in the query string', async () => {
      http.get.mockReturnValueOnce(
        of({ data: { ResponseCode: '00', Amount: 200 } }),
      );

      await service.verifyPayment('REF-QS', 200);

      const [url] = http.get.mock.calls[0];
      expect(url).toContain('merchantcode=MERCH001');
      expect(url).toContain('transactionreference=REF-QS');
      expect(url).toContain('amount=200');
    });
  });
});
