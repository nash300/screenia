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

function stripInlineStyles(value: string) {
  return value.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
}

export function renderBrandedEmail({
  eyebrow,
  title,
  intro,
  children,
  footer = "Screenia",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: string;
  footer?: string;
  showHelper?: boolean;
}) {
  const plainChildren = stripInlineStyles(children);

  return `<!doctype html>
    <html lang="sv">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0; padding:0; background:#ffffff; color:#111827; font-family:Arial, Helvetica, sans-serif; line-height:1.6;">
        <div style="max-width:640px; margin:0 auto; padding:28px 20px;">
          <p style="margin:0 0 28px; color:#111827; font-size:18px; font-weight:700;">Screenia</p>
          ${
            eyebrow
              ? `<p style="margin:0 0 8px; color:#4b5563; font-size:13px; font-weight:700;">${eyebrow}</p>`
              : ""
          }
          <h1 style="margin:0; color:#111827; font-family:Arial, Helvetica, sans-serif; font-size:28px; font-weight:700; line-height:1.25; overflow-wrap:anywhere;">${title}</h1>
          ${intro ? `<p style="margin:16px 0 0; color:#374151; font-size:16px;">${intro}</p>` : ""}
          <div style="margin-top:24px; color:#111827; font-size:16px;">
            ${plainChildren}
          </div>
          <p style="margin:30px 0 0; padding-top:18px; border-top:1px solid #e5e7eb; color:#4b5563; font-size:13px;">
            <strong style="color:#111827;">${footer}</strong><br />
            <span>Digital skyltning, tydligt hanterad.</span><br />
            <a href="mailto:${CLIENT_COMMUNICATION_FROM_EMAIL}" style="color:#111827; text-decoration:underline;">${CLIENT_COMMUNICATION_FROM_EMAIL}</a>
          </p>
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
