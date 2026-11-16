import { describe, expect, it } from "vitest";

import { renderBrandedEmail } from "./email";

describe("renderBrandedEmail", () => {
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

});
