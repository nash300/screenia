import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getConfiguredPublicSender,
  getContactInquiryReplyMessageId,
  getContactInquiryReplyAddress,
  getContactInquiryThreadMessageId,
  renderBrandedEmail,
  PUBLIC_COMMUNICATION_FROM_EMAIL,
  sendTransactionalEmail,
} from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("renderBrandedEmail", () => {
  it("creates stable message ids for a contact conversation", () => {
    expect(getContactInquiryThreadMessageId("SC-20261116-ABC123")).toBe(
      "<sc-20261116-abc123@screenia.se>",
    );
    expect(
      getContactInquiryReplyMessageId(
        "SC-20261116-ABC123",
        "3F8A0B4C-1234-5678-9ABC-DEF012345678",
      ),
    ).toBe(
      "<sc-20261116-abc123.3f8a0b4c-1234-5678-9abc-def012345678@screenia.se>",
    );
  });

  it("uses the permanent Screenia theme in every transactional email", () => {
    const html = renderBrandedEmail({
      eyebrow: "Orderbekräftelse",
      title: "Din skärmlösning är på väg",
      intro: "Tack för din beställning.",
      children: "<p>Två enheter</p>",
      showHelper: false,
    });

    expect(html).toContain('lang="sv"');
    expect(html).toContain("background-color:#1457bd");
    expect(html).toContain("background:#073984");
    expect(html).toContain("background:#ffd32a");
    expect(html).toContain("font-family:Arial, sans-serif");
    expect(html).toContain("Din skärmlösning är på väg");
    expect(html).toContain("<p>Två enheter</p>");
    expect(html).not.toContain("Special Elite");
  });

  it("keeps long titles readable on narrow email clients", () => {
    const html = renderBrandedEmail({
      title: "Ett ovanligt långt meddelande om din prenumeration",
      children: "<p>Innehåll</p>",
    });

    expect(html).toContain("@media only screen and (max-width: 520px)");
    expect(html).toContain("overflow-wrap: anywhere !important");
    expect(html).toContain("overflow-wrap:anywhere");
  });

  it("uses the case-specific inbound address only when its domain is configured", () => {
    vi.stubEnv("SCREENIA_INBOUND_REPLY_DOMAIN", "reply.screenia.se");
    expect(getContactInquiryReplyAddress("SC-20260816-ABC123")).toBe(
      "sc-20260816-abc123@reply.screenia.se",
    );

    vi.stubEnv("SCREENIA_INBOUND_REPLY_DOMAIN", "");
    expect(getContactInquiryReplyAddress("SC-20260816-ABC123")).toBe(
      "sc-20260816-abc123@reply.screenia.se",
    );
  });

  it("uses the public sender and footer for visitor communication", () => {
    vi.stubEnv("RESEND_PUBLIC_FROM_EMAIL", "Screenia <info@screenia.se>");
    const html = renderBrandedEmail({
      title: "Vi har tagit emot din fråga",
      children: "<p>Tack!</p>",
      footerEmail: PUBLIC_COMMUNICATION_FROM_EMAIL,
    });

    expect(getConfiguredPublicSender()).toBe("Screenia <info@screenia.se>");
    expect(html).toContain("mailto:info@screenia.se");
    expect(html).not.toContain("mailto:service@screenia.se");
  });

  it("sends with an explicit public sender when requested", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      to: "visitor@example.test",
      from: getConfiguredPublicSender(),
      subject: "Test",
      text: "Test",
      html: "<p>Test</p>",
      replyTo: PUBLIC_COMMUNICATION_FROM_EMAIL,
    });

    expect(result).toEqual({ ok: true, configured: true, id: "email-1" });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.from).toBe("Screenia <info@screenia.se>");
    expect(requestBody.reply_to).toBe("info@screenia.se");
  });

  it("passes threading headers to Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-threaded" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendTransactionalEmail({
      to: "visitor@example.test",
      subject: "Re: SC-20261116-ABC123 – Question",
      text: "Reply",
      html: "<p>Reply</p>",
      headers: {
        "Message-ID": "<reply@screenia.se>",
        "In-Reply-To": "<original@screenia.se>",
        References: "<original@screenia.se> <reply@screenia.se>",
      },
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.headers).toEqual({
      "Message-ID": "<reply@screenia.se>",
      "In-Reply-To": "<original@screenia.se>",
      References: "<original@screenia.se> <reply@screenia.se>",
    });
  });
});
