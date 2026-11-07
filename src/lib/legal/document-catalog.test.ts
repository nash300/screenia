import { describe, expect, it } from "vitest";
import {
  defaultLegalDocuments,
  legalDocumentTypes,
} from "@/lib/legal/document-catalog";

function documentContent(type: (typeof legalDocumentTypes)[number]) {
  return defaultLegalDocuments.find((document) => document.document_type === type)!
    .content;
}

describe("legal document catalog", () => {
  it("contains one current draft for every public legal document type", () => {
    expect(defaultLegalDocuments.map((document) => document.document_type)).toEqual(
      legalDocumentTypes,
    );
    expect(
      defaultLegalDocuments.every(
        (document) =>
          document.version === "2026-07-27-avtalsutkast" &&
          document.status === "active",
      ),
    ).toBe(true);
  });

  it("keeps customer prices dynamic", () => {
    const combinedContent = defaultLegalDocuments
      .map((document) => document.content)
      .join("\n");

    expect(combinedContent).not.toMatch(/\b\d[\d\s]*\s*kr(?:onor)?\b/i);
    expect(documentContent("subscription_billing")).toContain(
      "kundens aktuella erbjudande",
    );
  });

  it("covers Premium uploads and customer-owned display equipment", () => {
    expect(documentContent("terms")).toContain("kundens egen videouppladdning");
    expect(documentContent("terms")).toContain("kundens egen TV");
    expect(documentContent("terms")).toContain("publiceras inte automatiskt");
    expect(documentContent("support_service")).toContain(
      "aktiva abonnemang innehåller funktionen",
    );
    expect(documentContent("support_service")).toContain(
      "egen TV eller professionell skärm",
    );
  });

  it("covers uploaded-video data and later subscription changes", () => {
    expect(documentContent("privacy")).toContain(
      "videor, ljud, filmetadata",
    );
    expect(documentContent("privacy")).toContain(
      "Kundmaterial, inklusive uppladdade videor",
    );
    expect(documentContent("subscription_billing")).toContain(
      "senare lägger till en skärm",
    );
    expect(documentContent("subscription_billing")).toContain(
      "En ny provperiod gäller endast",
    );
  });
});
