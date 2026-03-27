import { HttpService } from '@nestjs/axios';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
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

  // ─── createVirtualAccount ─────────────────────────────────────────────────

  describe('createVirtualAccount', () => {
    const tokenResponse = {
      data: { access_token: 'tok-abc', expires_in: 3600 },
    };
    const accountResponse = {
      data: {
        accountNumber: '7120241111',
        bankName: 'Wema Bank',
        bankCode: 'WEMA',
      },
    };

    it('fetches an access token and returns the virtual account details', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(of(accountResponse));

      const result = await service.createVirtualAccount('John Doe');

      expect(result).toEqual({
        accountNumber: '7120241111',
        bankName: 'Wema Bank',
        bankCode: 'WEMA',
      });
    });

    it('sends accountName and merchantCode in the request body', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(of(accountResponse));

      await service.createVirtualAccount('John Doe');

      const [, body] = http.post.mock.calls[1];
      expect(body.accountName).toBe('John Doe');
      expect(body.merchantCode).toBe('MERCH001');
    });

    it('authorizes the token request with Basic credentials', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(of(accountResponse));

      await service.createVirtualAccount('John Doe');

      const [, , tokenConfig] = http.post.mock.calls[0];
      const expectedCredentials = Buffer.from('client123:secret456').toString(
        'base64',
      );
      expect(tokenConfig.headers.Authorization).toBe(
        `Basic ${expectedCredentials}`,
      );
    });

    it('caches the access token — only one OAuth call across two creations', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValue(of(accountResponse));

      await service.createVirtualAccount('John Doe');
      await service.createVirtualAccount('Jane Doe');

      const oauthCalls = http.post.mock.calls.filter(([url]) =>
        (url as string).includes('passport/oauth'),
      );
      expect(oauthCalls).toHaveLength(1);
    });

    it('throws BadGatewayException when the token request returns an Axios error', async () => {
      http.post.mockReturnValueOnce(throwError(() => makeAxiosError(401)));

      await expect(service.createVirtualAccount('John Doe')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException when the virtual account request returns an Axios error', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(throwError(() => makeAxiosError(400)));

      await expect(service.createVirtualAccount('John Doe')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('re-throws non-Axios errors as-is', async () => {
      http.post
        .mockReturnValueOnce(of(tokenResponse))
        .mockReturnValueOnce(throwError(() => new Error('unexpected')));

      await expect(service.createVirtualAccount('John Doe')).rejects.toThrow(
        'unexpected',
      );
    });

    it('re-fetches the token after the cached one expires (60s buffer)', async () => {
      http.post
        .mockReturnValueOnce(
          of({ data: { access_token: 'tok-1', expires_in: 61 } }),
        )
        .mockReturnValueOnce(of(accountResponse))
        .mockReturnValueOnce(
          of({ data: { access_token: 'tok-2', expires_in: 3600 } }),
        )
        .mockReturnValueOnce(of(accountResponse));

      await service.createVirtualAccount('John Doe');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);

      await service.createVirtualAccount('Jane Doe');

      const oauthCalls = http.post.mock.calls.filter(([url]) =>
        (url as string).includes('passport/oauth'),
      );
      expect(oauthCalls).toHaveLength(2);

      (Date.now as jest.Mock).mockRestore();
    });
  });
});
