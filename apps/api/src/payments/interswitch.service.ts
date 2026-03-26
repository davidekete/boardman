import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class InterswitchService {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const clientId = this.config.get<string>('INTERSWITCH_CLIENT_ID');
    const secretKey = this.config.get<string>('INTERSWITCH_SECRET_KEY');

    const credentials = Buffer.from(`${clientId}:${secretKey}`).toString('base64');

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
        throw new BadGatewayException(
          `Payment gateway auth failed (${err.response?.status ?? 'no response'})`,
        );
      }
      throw err;
    }

    this.accessToken = data.access_token;
    // Subtract 60s buffer so we refresh before it actually expires
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  async initiatePayment(params: {
    amount: number;
    email: string;
    userId: string;
  }): Promise<{ paymentUrl: string; reference: string }> {
    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const merchantCode = this.config.get<string>('INTERSWITCH_MERCHANT_CODE');
    const payableCode = this.config.get<string>('INTERSWITCH_PAY_ITEM_ID');
    const redirectUrl = this.config.get<string>('INTERSWITCH_REDIRECT_URL');

    const token = await this.getAccessToken();

    let data: { paymentUrl: string; reference: string };
    try {
      ({ data } = await firstValueFrom(
        this.http.post(
          `${apiUrl}/collections/api/v1/`,
          {
            merchantCode,
            payableCode,
            amount: String(params.amount),
            redirectUrl,
            customerId: params.userId,
            currencyCode: '566',
            customerEmail: params.email,
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
        throw new BadGatewayException(
          `Payment initiation failed (${err.response?.status ?? 'no response'})`,
        );
      }
      throw err;
    }

    return { paymentUrl: data.paymentUrl, reference: data.reference };
  }

  async verifyPayment(
    transactionReference: string,
    amountInKobo: number,
  ): Promise<{ success: boolean; amount?: number }> {
    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const merchantCode = this.config.get<string>('INTERSWITCH_MERCHANT_CODE');
    const payItemID = this.config.get<string>('INTERSWITCH_PAY_ITEM_ID');
    const macKey = this.config.get<string>('INTERSWITCH_MAC_KEY');

    // SHA-512 of payItemID + transactionReference + macKey (no separators)
    const hash = createHash('sha512')
      .update(`${payItemID}${transactionReference}${macKey}`)
      .digest('hex');

    const url =
      `${apiUrl}/collections/api/v1/gettransaction.json` +
      `?merchantcode=${encodeURIComponent(merchantCode)}` +
      `&transactionreference=${encodeURIComponent(transactionReference)}` +
      `&amount=${amountInKobo}`;

    try {
      const { data } = await firstValueFrom(
        this.http.get(url, { headers: { Hash: hash } }),
      );

      if (data?.ResponseCode === '00') {
        return { success: true, amount: data.Amount };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }
}
