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

  async sendVerificationEmail(
    email: string,
    firstName: string,
    token: string,
  ): Promise<void> {
    const appUrl =
      this.config.get<string>('APP_URL') || 'http://localhost:3002';
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
