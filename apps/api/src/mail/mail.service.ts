import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: BrevoClient;
  private readonly sender: { email: string; name: string };

  constructor(private readonly config: ConfigService) {
    this.client = new BrevoClient({
      apiKey: this.config.get<string>('BREVO_API_KEY'),
    });
    this.sender = {
      email: this.config.get<string>('MAIL_FROM') || 'noreply@boardman.gg',
      name: 'Boardman',
    };
  }

  async sendWithdrawalEmail(params: {
    email: string;
    firstName: string;
    amount: number;
    accountName: string;
    bankName: string;
    accountNumber: string;
    reference: string;
    timestamp: string;
  }): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(params.amount);

    const lastFour = params.accountNumber.slice(-4);

    await this.client.transactionalEmails.sendTransacEmail({
      to: [{ email: params.email, name: params.firstName }],
      sender: this.sender,
      subject: 'Withdrawal Confirmed — Boardman',
      htmlContent: this.buildWithdrawalTemplate({
        ...params,
        formattedAmount,
        lastFour,
      }),
    });
  }

  private buildWithdrawalTemplate(params: {
    timestamp: string;
    formattedAmount: string;
    accountName: string;
    bankName: string;
    lastFour: string;
    reference: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Withdrawal Confirmed</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;">
  <div style="font-family:'DM Sans',Arial,sans-serif;background:#0D0D0D;color:#F5F5F5;padding:40px;max-width:560px;margin:0 auto;">

    <h1 style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;color:#E8FF47;font-size:36px;margin:0 0 8px;">
      WITHDRAWAL CONFIRMED
    </h1>

    <p style="color:#6B6B6B;font-size:14px;margin:0 0 32px;">
      ${params.timestamp}
    </p>

    <div style="background:#161616;border:1px solid #2A2A2A;border-radius:6px;padding:24px;margin-bottom:24px;">
      <p style="color:#6B6B6B;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Amount Withdrawn</p>
      <p style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;font-size:48px;color:#F5F5F5;margin:0;">
        &#8358;${params.formattedAmount}
      </p>
    </div>

    <div style="background:#161616;border:1px solid #2A2A2A;border-radius:6px;padding:24px;margin-bottom:24px;">
      <p style="color:#6B6B6B;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Sent To</p>
      <p style="font-size:15px;font-weight:600;margin:0 0 4px;">${params.accountName}</p>
      <p style="color:#6B6B6B;font-size:13px;font-family:'JetBrains Mono',monospace;margin:0 0 4px;">${params.bankName}</p>
      <p style="color:#6B6B6B;font-size:13px;font-family:'JetBrains Mono',monospace;margin:0;">
        &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; ${params.lastFour}
      </p>
    </div>

    <div style="border-top:1px solid #2A2A2A;padding-top:16px;">
      <p style="color:#6B6B6B;font-size:11px;font-family:'JetBrains Mono',monospace;margin:0;">
        REF: ${params.reference}
      </p>
    </div>

    <p style="color:#6B6B6B;font-size:12px;margin-top:32px;">
      If you did not request this withdrawal, contact us immediately.
    </p>

  </div>
</body>
</html>`;
  }

  async sendBetInviteEmail(params: {
    recipientEmail: string;
    recipientFirstName: string;
    creatorName: string;
    betId: string;
    betTitle: string;
    betTerms?: string;
    stakeAmount: number;
    expiresAt: Date;
    acceptToken: string;
  }): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const acceptUrl = `${frontendUrl}/bets/${params.betId}?accept_token=${params.acceptToken}`;
    const viewUrl = `${frontendUrl}/bets/${params.betId}`;

    const formattedStake = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(params.stakeAmount);

    const formattedExpiry = params.expiresAt.toLocaleString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    await this.client.transactionalEmails.sendTransacEmail({
      to: [{ email: params.recipientEmail, name: params.recipientFirstName }],
      sender: this.sender,
      subject: `${params.creatorName} challenged you to a bet on Boardman`,
      htmlContent: this.buildBetInviteTemplate({
        ...params,
        formattedStake,
        formattedExpiry,
        acceptUrl,
        viewUrl,
      }),
    });
  }

  private buildBetInviteTemplate(params: {
    recipientFirstName: string;
    creatorName: string;
    betTitle: string;
    betTerms?: string;
    formattedStake: string;
    formattedExpiry: string;
    acceptUrl: string;
    viewUrl: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bet Invite</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#0D0D0D;padding:48px 20px;">
    <tr>
      <td align="center">

        <table width="560" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;width:100%;background-color:#161616;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0D0D0D;padding:24px 40px;">
              <span style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                           font-size:26px;letter-spacing:3px;color:#E8FF47;">
                BOARDMAN
              </span>
            </td>
          </tr>

          <!-- Label bar -->
          <tr>
            <td style="background-color:#131313;padding:12px 40px;">
              <span style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                           font-size:11px;letter-spacing:2.5px;color:#6B6B6B;">
                BET INVITE
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0 40px;">

              <p style="margin:0 0 4px 0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:13px;color:#6B6B6B;">
                ${params.creatorName} challenged you:
              </p>

              <h1 style="margin:0 0 24px 0;
                          font-family:'DM Sans',Arial,sans-serif;
                          font-size:26px;font-weight:700;
                          color:#FFFFFF;line-height:1.25;">
                ${params.betTitle}
              </h1>

              ${
                params.betTerms
                  ? `<p style="margin:0 0 28px 0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:14px;line-height:1.7;color:#9A9A9A;">
                       ${params.betTerms}
                     </p>`
                  : ''
              }

              <!-- Stake / Expiry grid -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color:#0D0D0D;border-radius:4px;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;border-right:1px solid #2A2A2A;width:50%;">
                    <p style="margin:0 0 4px 0;
                               font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                               font-size:10px;letter-spacing:2px;color:#6B6B6B;">
                      YOUR STAKE
                    </p>
                    <p style="margin:0;
                               font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                               font-size:28px;color:#E8FF47;letter-spacing:0.02em;">
                      ${params.formattedStake}
                    </p>
                  </td>
                  <td style="padding:20px 24px;width:50%;">
                    <p style="margin:0 0 4px 0;
                               font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                               font-size:10px;letter-spacing:2px;color:#6B6B6B;">
                      EXPIRES
                    </p>
                    <p style="margin:0;
                               font-family:'DM Sans',Arial,sans-serif;
                               font-size:13px;color:#9A9A9A;line-height:1.4;">
                      ${params.formattedExpiry}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Accept CTA -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td style="background-color:#E8FF47;border-radius:2px;">
                    <a href="${params.acceptUrl}"
                       style="display:inline-block;
                              padding:15px 36px;
                              font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                              font-size:14px;letter-spacing:2.5px;
                              color:#000000;text-decoration:none;">
                      ACCEPT BET
                    </a>
                  </td>
                </tr>
              </table>

              <!-- View link -->
              <p style="margin:0 0 40px 0;">
                <a href="${params.viewUrl}"
                   style="font-family:'DM Sans',Arial,sans-serif;
                          font-size:13px;color:#6B6B6B;text-decoration:underline;">
                  View bet details
                </a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0D0D0D;padding:24px 40px;">
              <p style="margin:0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:12px;line-height:1.6;color:#6B6B6B;">
                If you don&rsquo;t recognise this invite, ignore this email.
                Accepting will lock
                ${params.formattedStake}
                from your Boardman wallet.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
  }

  async sendVerificationEmail(
    email: string,
    firstName: string,
    token: string,
  ): Promise<void> {
    const appUrl =
      this.config.get<string>('APP_URL') ||
      'https://boardman-tqd1.onrender.com';
    const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        to: [{ email, name: firstName }],
        sender: this.sender,
        subject: 'Verify your Boardman account',
        htmlContent: this.buildVerificationTemplate(firstName, verifyUrl),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        err?.body ?? err,
      );
    }
  }

  private buildVerificationTemplate(
    firstName: string,
    verifyUrl: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Boardman account</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#0D0D0D;padding:48px 20px;">
    <tr>
      <td align="center">

        <!-- Main card — Iron Plate surface, 560px -->
        <table width="560" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;width:100%;background-color:#161616;">

          <!-- ─── Header strip ─────────────────────────────────────── -->
          <tr>
            <td style="background-color:#0D0D0D;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                                 font-size:26px;letter-spacing:3px;color:#E8FF47;">
                      BOARDMAN
                    </span>
                  </td>
                  <td align="right" valign="middle">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ─── Label bar ─────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#131313;padding:12px 40px;">
              <span style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                           font-size:11px;letter-spacing:2.5px;color:#6B6B6B;">
                ACCOUNT VERIFICATION
              </span>
            </td>
          </tr>

          <!-- ─── Body ─────────────────────────────────────────────── -->
          <tr>
            <td style="padding:40px 40px 0 40px;">

              <p style="margin:0 0 8px 0;
                         font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                         font-size:11px;letter-spacing:2px;color:#6B6B6B;">
                WELCOME TO THE GAME
              </p>

              <h1 style="margin:0 0 24px 0;
                          font-family:'DM Sans',Arial,sans-serif;
                          font-size:30px;font-weight:700;
                          color:#FFFFFF;line-height:1.15;">
                ${firstName}.
              </h1>

              <p style="margin:0 0 36px 0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:15px;line-height:1.75;color:#9A9A9A;">
                You&rsquo;re one step away from your first bet. Verify your
                email address to activate your account and start placing
                bets against real opponents.
              </p>

              <!-- CTA — Acid Yellow, sharp corners -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#E8FF47;border-radius:2px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;
                              padding:15px 36px;
                              font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;
                              font-size:14px;letter-spacing:2.5px;
                              color:#000000;text-decoration:none;">
                      VERIFY EMAIL
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:16px 0 0 0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:11px;color:#3D3D3D;line-height:1.6;
                         word-break:break-all;">
                Or paste this link in your browser:<br/>
                <span style="color:#6B6B6B;">${verifyUrl}</span>
              </p>

              <p style="margin:20px 0 40px 0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:12px;color:#6B6B6B;">
                This link expires in&nbsp;<strong style="color:#FFFFFF;">24&nbsp;hours</strong>.
              </p>

            </td>
          </tr>

          <!-- ─── Footer ────────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#0D0D0D;padding:24px 40px;">
              <p style="margin:0 0 8px 0;
                         font-family:'DM Sans',Arial,sans-serif;
                         font-size:12px;line-height:1.6;color:#6B6B6B;">
                If you didn&rsquo;t create a Boardman account, you can safely
                ignore this email. No action is required.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
  }
}
