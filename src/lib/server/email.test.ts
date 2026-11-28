import { afterEach, describe, expect, it, vi } from "vitest";

import { getContactInquiryReplyAddress, renderBrandedEmail } from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("renderBrandedEmail", () => {
  it("renders a plain, readable transactional email", () => {
    const html = renderBrandedEmail({
      eyebrow: "Orderbekräftelse",
      title: "Din skärmlösning är på väg",
      intro: "Tack för din beställning.",
      children: "<p>Två enheter</p>",
      showHelper: false,
    });

    expect(html).toContain('lang="sv"');
    expect(html).toContain("background:#ffffff");
    expect(html).toContain("font-family:Arial, Helvetica, sans-serif");
    expect(html).toContain("Din skärmlösning är på väg");
    expect(html).toContain("<p>Två enheter</p>");
    expect(html).not.toContain("background-color:#1457bd");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("<img");
  });

  it("removes template-specific visual styling while preserving content", () => {
    const html = renderBrandedEmail({
      title: "Ett ovanligt långt meddelande om din prenumeration",
      children: `<div style="border:1px solid red; background:#f7fbff;"><p style='color:red;'>Innehåll</p><a href="https://screenia.se" style="background:#155ee8;color:#fff;">Öppna länken</a></div>`,
    });

    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain("Innehåll");
    expect(html).toContain("Öppna länken");
    expect(html).not.toContain("style=\"border:1px solid red; background:#f7fbff;\"");
    expect(html).not.toContain("style='color:red;'");
    expect(html).not.toContain("style=\"background:#155ee8;color:#fff;\"");
  });

  it("uses the case-specific inbound address only when its domain is configured", () => {
    vi.stubEnv("SCREENIA_INBOUND_REPLY_DOMAIN", "reply.screenia.se");
    expect(getContactInquiryReplyAddress("SC-20260816-ABC123")).toBe(
      "sc-20260816-abc123@reply.screenia.se",
    );

    vi.stubEnv("SCREENIA_INBOUND_REPLY_DOMAIN", "");
    expect(getContactInquiryReplyAddress("SC-20260816-ABC123")).toBe(
      "service@screenia.se",
    );
  });
});
