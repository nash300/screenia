import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
const landingStyles = readFileSync(
  resolve(process.cwd(), "src/app/landing.css"),
  "utf8",
);

describe("landing video gallery", () => {
  it("autoplays muted looping previews while keeping cards accessible", () => {
    expect(pageSource).toContain("landing-video-gallery-video");
    expect(pageSource).toContain("Visa förhandsvisning:");
    expect(pageSource).toContain("autoPlay");
    expect(pageSource).toContain("loop");
    expect(pageSource).toContain("muted");
    expect(pageSource).toContain("playsInline");
    expect(pageSource).not.toContain("landing-video-gallery-play");
  });

  it("uses native horizontal snap scrolling on phones and touch screens", () => {
    expect(landingStyles).toContain(
      "@media (max-width: 760px), (hover: none) and (pointer: coarse)",
    );
    expect(landingStyles).toContain("overflow-x: auto");
    expect(landingStyles).toContain("scroll-snap-type: x proximity");
    expect(landingStyles).toContain("touch-action: pan-x");
    expect(landingStyles).toContain(
      '.landing-video-rail-group[aria-hidden="true"]',
    );
  });

  it("supports moving between enlarged examples without closing the viewer", () => {
    expect(pageSource).toContain("handleExampleSwipeStart");
    expect(pageSource).toContain("handleExampleSwipeEnd");
    expect(pageSource).toContain("showAdjacentExample(distanceX < 0 ? 1 : -1)");
    expect(pageSource).toContain("Visa nästa presentation");
    expect(pageSource).toContain("Visa föregående presentation");
  });

  it("makes all subscription cards horizontally swipeable on mobile", () => {
    expect(pageSource).toContain('aria-label="Abonnemangspaket"');
    expect(pageSource).toContain("Svep åt sidan för att se Standard");
    expect(landingStyles).toContain("grid-auto-flow: column");
    expect(landingStyles).toContain("grid-auto-columns: min(82vw, 360px)");
  });
});
