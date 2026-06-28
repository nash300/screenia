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
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "";

  if (!apiKey || !from) {
    return {
      ok: false,
      configured: false,
      error: "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
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
