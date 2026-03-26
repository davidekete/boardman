import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
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
    const webpayUrl = this.config.get<string>('INTERSWITCH_WEBPAY_URL');
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

    const paymentUrl = `${webpayUrl}/collections/w/pay?${query}`;
    return { paymentUrl };
  }

  async verifyPayment(
    transactionReference: string,
    amountInKobo: number,
  ): Promise<{ success: boolean; amount?: number }> {
    const apiUrl = this.config.get<string>('INTERSWITCH_API_URL');
    const payItemID = this.config.get<string>('INTERSWITCH_PAY_ITEM_ID');
    const macKey = this.config.get<string>('INTERSWITCH_MAC_KEY');

    // SHA-512 of payItemID + transactionReference + macKey (no separators)
    const hash = createHash('sha512')
      .update(`${payItemID}${transactionReference}${macKey}`)
      .digest('hex');

    const url =
      `${apiUrl}/collections/api/v1/gettransaction.json` +
      `?productid=${encodeURIComponent(payItemID)}` +
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
