import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export interface TransferParams {
  amount: number; // in KOBO (naira * 100)
  accountNumber: string;
  bankCode: string;
  accountName: string; // beneficiary name
  senderPhone: string;
  senderEmail: string;
  senderLastname: string;
  senderOthernames: string;
  transferReference: string;
}

@Injectable()
export class InterswitchService {
  private readonly logger = new Logger(InterswitchService.name);

  // ── Payment collection token cache ────────────────────────────────────────
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  // ── Transfer token cache (separate — different base URL) ──────────────────
  private transferAccessToken: string | null = null;
  private transferTokenExpiresAt = 0;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      this.logger.debug('Using cached access token');
      return this.accessToken;
    }

    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const clientId = this.config.get<string>('INTERSWITCH_CLIENT_ID');
    const secretKey = this.config.get<string>('INTERSWITCH_SECRET_KEY');

    const credentials = Buffer.from(`${clientId}:${secretKey}`).toString(
      'base64',
    );

    this.logger.log('Requesting new OAuth token from Interswitch');

    let data: { access_token: string; expires_in: number };
    try {
      ({ data } = await firstValueFrom(
        this.http.post(
          `${apiUrl}/passport/oauth/token?grant_type=client_credentials`,
          'grant_type=client_credentials',
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      ));
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          `OAuth token request failed — status: ${err.response?.status ?? 'no response'}`,
          JSON.stringify(err.response?.data),
        );
        throw new BadGatewayException({
          message: `Payment gateway auth failed (${err.response?.status ?? 'no response'})`,
          upstream: err.response?.data,
        });
      }
      this.logger.error('OAuth token request threw a non-Axios error', err);
      throw err;
    }

    this.accessToken = data.access_token;
    // Subtract 60s buffer so we refresh before it actually expires
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    this.logger.log(
      `OAuth token acquired — expires in ${data.expires_in}s (buffer: 60s)`,
    );

    return this.accessToken;
  }

  private async getTransferAccessToken(): Promise<string> {
    if (
      this.transferAccessToken &&
      Date.now() < this.transferTokenExpiresAt
    ) {
      this.logger.debug('Using cached transfer access token');
      return this.transferAccessToken;
    }

    const baseUrl = this.config.get<string>('INTERSWITCH_TRANSFER_BASE_URL');
    const clientId = this.config.get<string>('INTERSWITCH_CLIENT_ID');
    const secretKey = this.config.get<string>('INTERSWITCH_SECRET_KEY');

    const credentials = Buffer.from(`${clientId}:${secretKey}`).toString(
      'base64',
    );

    this.logger.log('Requesting new transfer OAuth token from Interswitch');

    let data: { access_token: string; expires_in: number };
    try {
      ({ data } = await firstValueFrom(
        this.http.post(
          `${baseUrl}/passport/oauth/token`,
          'grant_type=client_credentials&scope=profile',
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      ));
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          `Transfer OAuth token request failed — status: ${err.response?.status ?? 'no response'}`,
          JSON.stringify(err.response?.data),
        );
        throw new BadGatewayException({
          message: `Transfer gateway auth failed (${err.response?.status ?? 'no response'})`,
          upstream: err.response?.data,
        });
      }
      this.logger.error(
        'Transfer OAuth token request threw a non-Axios error',
        err,
      );
      throw err;
    }

    this.transferAccessToken = data.access_token;
    this.transferTokenExpiresAt =
      Date.now() + (data.expires_in - 60) * 1000;

    this.logger.log(
      `Transfer OAuth token acquired — expires in ${data.expires_in}s (buffer: 60s)`,
    );

    return this.transferAccessToken;
  }

  private computeMac(amountKobo: string): string {
    // SHA512 of: initiationAmount + "566" + "CA" + terminationAmount + "566" + "AC" + "NG"
    // No separators between values — exactly this concatenation
    const raw = `${amountKobo}566CA${amountKobo}566ACNG`;
    return createHash('sha512').update(raw).digest('hex');
  }

  // ── Pay Bill (active) ────────────────────────────────────────────────────────

  async createBill(params: {
    amount: number; // naira — converted to kobo before sending
    customerId: string;
    customerEmail: string;
    redirectUrl: string;
  }): Promise<{ paymentUrl: string }> {
    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const merchantCode = this.config.get<string>('INTERSWITCH_MERCHANT_CODE');
    const payableCode = this.config.get<string>('INTERSWITCH_PAY_ITEM_ID');

    const token = await this.getAccessToken();

    // Interswitch expects amount in kobo (minor currency unit)
    const amountInKobo = Math.round(params.amount * 100).toString();

    this.logger.log(
      `Creating bill — amount: ${amountInKobo} kobo (₦${params.amount}), customer: ${params.customerId}`,
    );

    let data: Record<string, any>;
    try {
      ({ data } = await firstValueFrom(
        this.http.post(
          `${apiUrl}/paymentgateway/api/v1/paybill`,
          {
            merchantCode,
            payableCode,
            amount: amountInKobo,
            redirectUrl: params.redirectUrl,
            customerId: params.customerId,
            currencyCode: '566', // NGN
            customerEmail: params.customerEmail,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      ));
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          `Bill creation failed — status: ${err.response?.status ?? 'no response'}`,
          JSON.stringify(err.response?.data),
        );
        throw new BadGatewayException({
          message: `Bill creation failed (${err.response?.status ?? 'no response'})`,
          upstream: err.response?.data,
        });
      }
      this.logger.error('Bill creation threw a non-Axios error', err);
      throw err;
    }

    this.logger.debug('Full bill response', JSON.stringify(data));
    this.logger.log(`Bill created — paymentUrl: ${data.paymentUrl}`);

    return { paymentUrl: data.paymentUrl as string };
  }

  // ── Virtual Account ──────────────────────────────────────────────────────────

  async createVirtualAccount(accountName: string): Promise<{
    accountNumber: string;
    bankName: string;
    bankCode: string;
  }> {
    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const merchantCode = this.config.get<string>('INTERSWITCH_MERCHANT_CODE');

    const token = await this.getAccessToken();

    this.logger.log(`Creating virtual account — accountName: ${accountName}`);

    let data: { accountNumber: string; bankName: string; bankCode: string };
    try {
      ({ data } = await firstValueFrom(
        this.http.post(
          `${apiUrl}/paymentgateway/api/v1/payable/virtualaccount`,
          { accountName, merchantCode },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      ));
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          `Virtual account creation failed — status: ${err.response?.status ?? 'no response'}`,
          JSON.stringify(err.response?.data),
        );
        throw new BadGatewayException({
          message: `Virtual account creation failed (${
            err.response?.status ?? 'no response'
          })`,
          upstream: err.response?.data,
        });
      }
      this.logger.error(
        'Virtual account creation threw a non-Axios error',
        err,
      );
      throw err;
    }

    this.logger.log(
      `Virtual account created — accountNumber: ${data.accountNumber}, bank: ${data.bankName}`,
    );

    return {
      accountNumber: data.accountNumber,
      bankName: data.bankName,
      bankCode: data.bankCode,
    };
  }

  // ── Account Name Inquiry ─────────────────────────────────────────────────────

  async accountNameInquiry(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string }> {
    const baseUrl = this.config.get<string>('INTERSWITCH_TRANSFER_BASE_URL');
    const terminalId = this.config.get<string>('INTERSWITCH_TERMINAL_ID');
    const token = await this.getTransferAccessToken();

    this.logger.log(
      `Account name inquiry — accountNumber: ${accountNumber}, bankCode: ${bankCode}`,
    );

    let data: Record<string, any>;
    try {
      ({ data } = await firstValueFrom(
        this.http.get(
          `${baseUrl}/quicktellerservice/api/v5/transactions/DoAccountNameInquiry`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              TerminalId: terminalId,
              bankCode,
              accountId: accountNumber,
              'Content-Type': 'application/json',
            },
          },
        ),
      ));
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          `Account name inquiry failed — status: ${err.response?.status ?? 'no response'}`,
          JSON.stringify(err.response?.data),
        );
        throw new BadRequestException(
          err.response?.data?.message ??
            'Account not found. Check the account number and bank code.',
        );
      }
      this.logger.error(
        'Account name inquiry threw a non-Axios error',
        err,
      );
      throw err;
    }

    this.logger.debug(
      'Account name inquiry response',
      JSON.stringify(data),
    );

    if (data?.responseCode !== '00') {
      this.logger.warn(
        `Account name inquiry non-success code: ${data?.responseCode}`,
      );
      throw new BadRequestException(
        'Account not found. Check the account number and bank code.',
      );
    }

    return { accountName: data.accountName as string };
  }

  // ── Transfer Funds ───────────────────────────────────────────────────────────

  async transferFunds(
    params: TransferParams,
  ): Promise<{ reference: string }> {
    const baseUrl = this.config.get<string>('INTERSWITCH_TRANSFER_BASE_URL');
    const terminalId = this.config.get<string>('INTERSWITCH_TERMINAL_ID');
    const transferCode = this.config.get<string>('INTERSWITCH_TRANSFER_CODE');
    const token = await this.getTransferAccessToken();

    const amountKobo = params.amount.toString();
    const mac = this.computeMac(amountKobo);

    // Split beneficiary name: first word = othernames, rest = lastname
    const spaceIndex = params.accountName.indexOf(' ');
    const beneficiaryOthernames =
      spaceIndex === -1 ? '' : params.accountName.slice(0, spaceIndex);
    const beneficiaryLastname =
      spaceIndex === -1
        ? params.accountName
        : params.accountName.slice(spaceIndex + 1);

    const body = {
      transferCode,
      mac,
      termination: {
        amount: amountKobo,
        accountReceivable: {
          accountNumber: params.accountNumber,
          accountType: '00',
        },
        entityCode: params.bankCode,
        currencyCode: '566',
        paymentMethodCode: 'AC',
        countryCode: 'NG',
      },
      sender: {
        phone: params.senderPhone,
        email: params.senderEmail,
        lastname: params.senderLastname,
        othernames: params.senderOthernames,
      },
      initiatingEntityCode: 'PBL',
      initiation: {
        amount: amountKobo,
        currencyCode: '566',
        paymentMethodCode: 'CA',
        channel: '7',
      },
      beneficiary: {
        lastname: beneficiaryLastname,
        othernames: beneficiaryOthernames,
      },
    };

    this.logger.log(
      `Initiating transfer — amount: ${amountKobo} kobo, account: ${params.accountNumber}, bankCode: ${params.bankCode}, ref: ${params.transferReference}`,
    );

    let data: Record<string, any>;
    try {
      ({ data } = await firstValueFrom(
        this.http.post(
          `${baseUrl}/quicktellerservice/api/v5/transactions/TransferFunds`,
          body,
          {
            headers: {
              Authentication: `Bearer ${token}`,
              terminalId,
              'Content-Type': 'application/json',
            },
          },
        ),
      ));
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          `Transfer failed — status: ${err.response?.status ?? 'no response'}`,
          JSON.stringify(err.response?.data),
        );
        throw new BadRequestException(
          err.response?.data?.message ?? 'Transfer failed. Please try again.',
        );
      }
      this.logger.error('Transfer threw a non-Axios error', err);
      throw err;
    }

    this.logger.debug('Transfer response', JSON.stringify(data));

    if (data?.responseCode !== '00') {
      this.logger.error(
        `Transfer non-success code: ${data?.responseCode}`,
        JSON.stringify(data),
      );
      throw new BadRequestException(
        data?.responseMessage ?? 'Transfer failed. Please try again.',
      );
    }

    this.logger.log(
      `Transfer successful — reference: ${params.transferReference}`,
    );

    return { reference: params.transferReference };
  }
}
