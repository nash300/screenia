type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
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
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const emailAssetBase =
    process.env.NEXT_PUBLIC_EMAIL_ASSET_BASE_URL?.replace(/\/$/, "") ||
    `${supabaseUrl}/storage/v1/object/public/email-assets`;
  const logoUrl = `${emailAssetBase}/brand/screenia-logo-full-dark-bg.png`;
  const helperUrl = `${emailAssetBase}/brand/screenia-helper.png`;

  return `<!doctype html>
    <html lang="sv">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0; padding:0; background:#eef6ff;">
    <div style="margin:0; padding:0; background:#eef6ff;">
      <div style="max-width:680px; margin:0 auto; padding:28px 16px; font-family:Arial, sans-serif; color:#102033; line-height:1.6;">
        <div style="overflow:hidden; border:1px solid #d9e5f7; border-radius:22px; background:#ffffff; box-shadow:0 18px 48px rgba(6,25,66,0.12);">
          <div style="background:#061942; padding:22px 24px;">
            <img src="${logoUrl}" alt="Screenia" width="180" style="display:block; max-width:180px; height:auto; color:#ffffff; font-family:Arial, sans-serif; font-size:22px; font-weight:700;" />
            <div style="font-family:'Special Elite', Georgia, serif; color:#ffffff; font-size:0; line-height:0;">Screenia</div>
          </div>
          <div style="padding:26px 24px 8px;">
            ${
              eyebrow
                ? `<p style="margin:0 0 10px; color:#f47a20; font-size:12px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase;">${eyebrow}</p>`
                : ""
            }
            <h1 style="margin:0; font-family:'Special Elite', Georgia, serif; font-size:34px; font-weight:400; line-height:1.1; color:#09244a;">${title}</h1>
            ${
              intro
                ? `<p style="margin:14px 0 0; color:#526579; font-size:16px;">${intro}</p>`
                : ""
            }
          </div>
          ${
            showHelper
              ? `<div style="padding:12px 24px 0; text-align:center;">
                  <img src="${helperUrl}" alt="Screenia hj&auml;lper dig med sk&auml;rmen" width="220" height="331" style="display:inline-block; width:220px !important; max-width:220px !important; height:auto !important; border-radius:16px; background:#0f63f4;" />
                </div>`
              : ""
          }
          <div style="padding:12px 24px 26px;">
            ${children}
          </div>
          <div style="border-top:1px solid #e5eef8; background:#f8fbff; padding:18px 24px; color:#65788d; font-size:13px;">
            ${footer}
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
