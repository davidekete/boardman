import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class InterswitchService {
  private readonly logger = new Logger(InterswitchService.name);

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

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
}
