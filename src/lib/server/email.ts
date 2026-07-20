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
            .screenia-email-title { font-size: 28px !important; overflow-wrap: anywhere !important; }
            .screenia-email-section { padding-left: 20px !important; padding-right: 20px !important; }
          }
        </style>
      </head>
      <body style="margin:0; padding:0; background:#eaf2ff;">
    <div style="margin:0; padding:0; background:#eaf2ff;">
      <div class="screenia-email-shell" style="max-width:680px; margin:0 auto; padding:32px 16px; font-family:Arial, sans-serif; color:#102033; line-height:1.6;">
        <div style="overflow:hidden; border:1px solid #cadcf5; border-radius:18px; background:#ffffff; box-shadow:0 24px 64px rgba(6,25,66,0.14);">
          <div style="height:5px; background:linear-gradient(90deg,#0f63f4 0%,#20b9e8 58%,#f3b642 100%);"></div>
          <div class="screenia-email-header" style="background:#061942; padding:22px 26px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding:0 12px 0 0; vertical-align:middle;"><img src="${logoUrl}" alt="" width="44" height="44" style="display:block; width:44px; height:44px; border:0;" /></td>
              <td style="vertical-align:middle; font-family:Arial, sans-serif; font-size:24px; font-weight:800; line-height:1; color:#ffffff;">screenia<span style="color:#4ea3ff;">.se</span></td>
            </tr></table>
          </div>
          <div class="screenia-email-section" style="padding:30px 28px 8px;">
            ${
              eyebrow
                ? `<p style="margin:0 0 12px; color:#155ee8; font-size:12px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase;">${eyebrow}</p>`
                : ""
            }
            <h1 class="screenia-email-title" style="margin:0; font-family:'Special Elite', Georgia, serif; font-size:34px; font-weight:400; line-height:1.12; color:#061942; overflow-wrap:anywhere;">${title}</h1>
            ${
              intro
                ? `<p style="margin:15px 0 0; color:#526579; font-size:16px; line-height:1.65;">${intro}</p>`
                : ""
            }
          </div>
          ${
            showHelper
              ? `<div style="padding:18px 28px 0; text-align:center;">
                  <div style="display:inline-block; border:1px solid #d8e7fb; border-radius:16px; background:#f3f8ff; padding:12px 22px 0;">
                    <img src="${helperUrl}" alt="Screenia hj&auml;lper dig med sk&auml;rmen" width="136" height="205" style="display:block; width:136px !important; max-width:136px !important; height:auto !important; border-radius:12px 12px 0 0;" />
                  </div>
                </div>`
              : ""
          }
          <div class="screenia-email-section" style="padding:18px 28px 30px;">
            ${children}
          </div>
          <div style="border-top:1px solid #dce8f8; background:#f4f8fe; padding:18px 28px; color:#65788d; font-size:13px;">
            <strong style="color:#061942;">${footer}</strong><br />
            <span>Digital skyltning, tydligt hanterad.</span><br />
            <a href="mailto:${CLIENT_COMMUNICATION_FROM_EMAIL}" style="color:#155ee8; text-decoration:underline;">${CLIENT_COMMUNICATION_FROM_EMAIL}</a>
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
