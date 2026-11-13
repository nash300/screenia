import { contactInquiryReplyAddress } from "@/lib/server/contact-inquiry-inbound";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; configured: true; id?: string }
  | { ok: false; configured: false; error: string }
  | { ok: false; configured: true; status: number; error: string };

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatSek(amount: number | null | undefined) {
  return `${(amount ?? 0).toLocaleString("sv-SE")} kr`;
}

export const CLIENT_COMMUNICATION_FROM_EMAIL = "service@screenia.se";
export const NEWSLETTER_FROM_EMAIL = "info@screenia.se";

export function getContactInquiryReplyAddress(caseNumber: string) {
  return contactInquiryReplyAddress(
    caseNumber,
    process.env.SCREENIA_INBOUND_REPLY_DOMAIN,
    CLIENT_COMMUNICATION_FROM_EMAIL,
  );
}

export function getConfiguredTransactionalSender() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `Screenia <${CLIENT_COMMUNICATION_FROM_EMAIL}>`
  );
}

export function getConfiguredNewsletterSender() {
  return (
    process.env.RESEND_NEWSLETTER_FROM_EMAIL?.trim() ||
    `Screenia <${NEWSLETTER_FROM_EMAIL}>`
  );
}

export function renderBrandedEmail({
  eyebrow,
  title,
  intro,
  children,
  footer = "Screenia",
  showHelper = true,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: string;
  footer?: string;
  showHelper?: boolean;
}) {
  const configuredAppUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se"
  ).replace(/\/$/, "");
  const publicAppUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
    configuredAppUrl,
  )
    ? "https://screenia.se"
    : configuredAppUrl;
  const emailAssetBase =
    process.env.SCREENIA_EMAIL_ASSET_BASE_URL?.replace(/\/$/, "") ||
    `${publicAppUrl}/brand`;
  const logoUrl = `${emailAssetBase}/screenia-icon-512-transparent.png`;
  const helperUrl = `${emailAssetBase}/screenia-helper.png`;

  return `<!doctype html>
    <html lang="sv">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @media only screen and (max-width: 520px) {
            .screenia-email-shell { padding: 14px 8px !important; }
            .screenia-email-header { padding: 18px 20px !important; }
            .screenia-email-graphic { padding: 18px 20px !important; }
            .screenia-email-graphic-table { width: 100% !important; }
            .screenia-email-graphic-screen { width: 150px !important; height: 82px !important; }
            .screenia-email-title { font-size: 28px !important; overflow-wrap: anywhere !important; }
            .screenia-email-section { padding-left: 20px !important; padding-right: 20px !important; }
            .screenia-email-button { display: block !important; width: auto !important; text-align: center !important; }
          }
        </style>
      </head>
      <body style="margin:0; padding:0; background:#f3f7ff;">
    <div style="margin:0; padding:0; background-color:#1457bd; background-image:linear-gradient(rgba(255,255,255,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.055) 1px,transparent 1px); background-size:56px 56px;">
      <div class="screenia-email-shell" style="max-width:680px; margin:0 auto; padding:32px 16px; font-family:Arial, sans-serif; color:#09295f; line-height:1.6;">
        <div style="overflow:hidden; border:1px solid #d6e3f6; border-radius:22px; background:#ffffff; box-shadow:0 28px 72px rgba(4,38,94,0.24);">
          <div style="height:7px; background:#ffd32a;"></div>
          <div class="screenia-email-header" style="background:#073984; padding:22px 26px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding:0 12px 0 0; vertical-align:middle;"><img src="${logoUrl}" alt="" width="44" height="44" style="display:block; width:44px; height:44px; border:0;" /></td>
              <td style="vertical-align:middle; font-family:Arial, sans-serif; font-size:24px; font-weight:800; line-height:1; color:#ffffff;">screenia<span style="color:#ffd32a;">.se</span></td>
            </tr></table>
          </div>
          <div class="screenia-email-graphic" style="padding:20px 28px 0; background:#073984;">
            <table class="screenia-email-graphic-table" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>
              <td style="height:8px; background:#44d7ff; width:20%;"></td>
              <td style="height:8px; background:#2f7df6; width:45%;"></td>
              <td style="height:8px; background:#ffd21f; width:35%;"></td>
            </tr><tr>
              <td colspan="3" style="padding:0;">
                <div class="screenia-email-graphic-screen" style="width:210px; height:108px; margin:0 auto; border:1px solid rgba(180,225,255,.72); border-radius:14px 14px 0 0; background:linear-gradient(145deg,#eaf6ff,#317fe1); box-shadow:0 18px 30px rgba(0,21,64,.32);">
                  <div style="padding:8px 10px; background:#0d4b9f; text-align:left;"><span style="display:inline-block; width:5px; height:5px; margin-right:4px; border-radius:50%; background:#fff;"></span><span style="display:inline-block; width:5px; height:5px; margin-right:4px; border-radius:50%; background:#fff;"></span><span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:#ffd21f;"></span></div>
                  <div style="padding:15px 14px; text-align:left;"><span style="display:inline-block; width:44%; height:35px; margin-right:8%; vertical-align:bottom; border-bottom:4px solid #fff; border-left:8px solid #54aaff; border-right:8px solid #54aaff;"></span><span style="display:inline-block; width:38%; height:8px; border-radius:99px; background:#fff; box-shadow:0 15px 0 rgba(7,57,132,.28), 0 30px 0 rgba(7,57,132,.22);"></span></div>
                </div>
              </td>
            </tr></table>
          </div>
          <div class="screenia-email-section" style="padding:30px 28px 8px;">
            ${
              eyebrow
                ? `<p style="margin:0 0 12px; color:#1457bd; font-size:12px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase;">${eyebrow}</p>`
                : ""
            }
            <h1 class="screenia-email-title" style="margin:0; font-family:Arial, sans-serif; font-size:34px; font-weight:800; letter-spacing:-0.035em; line-height:1.08; color:#09295f; overflow-wrap:anywhere;">${title}</h1>
            ${
              intro
                ? `<p style="margin:15px 0 0; color:#526579; font-size:16px; line-height:1.65;">${intro}</p>`
                : ""
            }
          </div>
          ${
            showHelper
              ? `<div style="padding:18px 28px 0; text-align:center;">
                  <div style="display:inline-block; border:1px solid #d6e3f6; border-radius:18px; background:#f3f7ff; padding:12px 22px 0; box-shadow:0 18px 40px rgba(9,41,95,0.08);">
                    <img src="${helperUrl}" alt="Screenia hj&auml;lper dig med sk&auml;rmen" width="136" height="205" style="display:block; width:136px !important; max-width:136px !important; height:auto !important; border-radius:12px 12px 0 0;" />
                  </div>
                </div>`
              : ""
          }
          <div class="screenia-email-section" style="padding:18px 28px 30px;">
            ${children}
          </div>
          <div style="border-top:1px solid #d6e3f6; background:#f3f7ff; padding:18px 28px; color:#61769a; font-size:13px;">
            <strong style="color:#09295f;">${footer}</strong><br />
            <span>Digital skyltning, tydligt hanterad.</span><br />
            <a href="mailto:${CLIENT_COMMUNICATION_FROM_EMAIL}" style="color:#1457bd; text-decoration:underline;">${CLIENT_COMMUNICATION_FROM_EMAIL}</a>
          </div>
        </div>
      </div>
    </div>
      </body>
    </html>
  `;
}

async function getResendErrorMessage(response: Response) {
  const text = await response.text();

  if (!text.trim()) return `Resend returned ${response.status}.`;

  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object") {
      const message =
        "message" in data && typeof data.message === "string"
          ? data.message
          : null;
      const error =
        "error" in data && typeof data.error === "string" ? data.error : null;

      return message || error || `Resend returned ${response.status}.`;
    }
  } catch {
    return text.trim();
  }

  return `Resend returned ${response.status}.`;
}

export async function sendTransactionalEmail(
  email: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = getConfiguredTransactionalSender();

  if (!apiKey || !from) {
    return {
      ok: false,
      configured: false,
      error: "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.",
    };
  }

  let response: Response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email.to,
        reply_to: email.replyTo || CLIENT_COMMUNICATION_FROM_EMAIL,
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      configured: true,
      status: 0,
      error:
        error instanceof Error
          ? error.message
          : "Resend request failed before a response was received.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      status: response.status,
      error: await getResendErrorMessage(response),
    };
  }

  const data = (await response.json().catch(() => null)) as
    | { id?: string }
    | null;

  return { ok: true, configured: true, id: data?.id };
}
