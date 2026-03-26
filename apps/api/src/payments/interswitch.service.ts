import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class InterswitchService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  initiatePayment(params: {
    amount: number;
    email: string;
    userId: string;
    merchantReference: string;
  }): { paymentUrl: string } {
    const baseUrl = this.config.get<string>('INTERSWITCH_BASE_URL');
    const merchantCode = this.config.get<string>('INTERSWITCH_MERCHANT_CODE');
    const payItemID = this.config.get<string>('INTERSWITCH_PAY_ITEM_ID');
    const siteRedirectURL = this.config.get<string>('INTERSWITCH_REDIRECT_URL');

    const query = new URLSearchParams({
      merchantCode,
      payItemID,
      amount: String(params.amount),
      transactionReference: params.merchantReference,
      currency: '566',
      siteRedirectURL,
      customerEmail: params.email,
    }).toString();

    const paymentUrl = `${baseUrl}/collections/w/pay?${query}`;
    return { paymentUrl };
  }

  async verifyPayment(
    transactionReference: string,
  ): Promise<{ success: boolean; amount?: number }> {
    const baseUrl = this.config.get<string>('INTERSWITCH_BASE_URL');
    const merchantCode = this.config.get<string>('INTERSWITCH_MERCHANT_CODE');
    const clientId = this.config.get<string>('INTERSWITCH_CLIENT_ID');
    const secretKey = this.config.get<string>('INTERSWITCH_SECRET_KEY');

    const credentials = Buffer.from(`${clientId}:${secretKey}`).toString(
      'base64',
    );

    const url =
      `${baseUrl}/api/v2/purchases` +
      `?merchantcode=${merchantCode}` +
      `&transactionreference=${transactionReference}`;

    try {
      const { data } = await firstValueFrom(
        this.http.get(url, {
          headers: { Authorization: `Basic ${credentials}` },
        }),
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
