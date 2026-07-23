"use client";

import { useEffect } from "react";

const defaultSelectors = [
  ".landing-section",
  ".landing-section-heading",
  ".landing-feature",
  ".landing-price-card",
  ".landing-gallery-card",
  ".landing-service-film-copy",
  ".landing-film-stage",
  ".landing-faq-item",
  ".landing-contact",
  ".landing-footer",
  ".how-hero",
  ".how-section-heading",
  ".how-reason-card",
  ".about-hero-copy",
  ".about-hero-visual",
  ".about-belief",
  ".about-signal-card",
  ".about-story-panel",
  ".about-value-card",
  ".about-strategy-card",
  ".about-proof-card",
  ".about-closing",
];

type LandingScrollRevealProps = {
  selectors?: string[];
};

const revealClassNames = {
  target: "landing-reveal-target",
  visible: "landing-reveal-visible",
  fromScrollDown: "landing-reveal-from-scroll-down",
  fromScrollUp: "landing-reveal-from-scroll-up",
} as const;

export function LandingScrollReveal({ selectors = defaultSelectors }: LandingScrollRevealProps) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selectors.join(",")),
    );
    let lastScrollY = window.scrollY;

    elements.forEach((element, index) => {
      element.classList.add(revealClassNames.target);
      element.style.setProperty("--reveal-index", String(index % 6));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const isScrollingDown = window.scrollY >= lastScrollY;
        lastScrollY = window.scrollY;

        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          target.classList.toggle(revealClassNames.fromScrollDown, isScrollingDown);
          target.classList.toggle(revealClassNames.fromScrollUp, !isScrollingDown);
          target.classList.toggle(revealClassNames.visible, entry.isIntersecting);
        });
      },
      {
        rootMargin: "0px 0px -4% 0px",
        threshold: 0.08,
      },
    );

    elements.forEach((element) => observer.observe(element));
    const revealInitialViewport = () => {
      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const isInInitialViewport = rect.top < window.innerHeight * 0.96 && rect.bottom > 0;

        if (isInInitialViewport) {
          element.classList.add(revealClassNames.fromScrollDown, revealClassNames.visible);
        }
      });
    };
    window.requestAnimationFrame(revealInitialViewport);
    const initialRevealTimer = window.setTimeout(revealInitialViewport, 120);

    return () => {
      window.clearTimeout(initialRevealTimer);
      observer.disconnect();
      elements.forEach((element) => {
        element.classList.remove(
          revealClassNames.target,
          revealClassNames.visible,
          revealClassNames.fromScrollDown,
          revealClassNames.fromScrollUp,
        );
        element.style.removeProperty("--reveal-index");
      });
    };
  }, [selectors]);

  return null;
}
