"use client";

import { useEffect } from "react";

const defaultSelectors = [
  ".landing-section",
  ".landing-section-heading",
  ".landing-feature",
  ".landing-price-card",
  ".landing-pricing-note",
  ".landing-gallery-card",
  ".landing-service-film-copy",
  ".landing-film-stage",
  ".landing-faq-item",
  ".landing-contact",
  ".landing-footer-company",
  ".landing-footer-card",
  ".how-hero",
  ".how-section-heading",
  ".how-reason-card",
  ".about-hero-copy",
  ".about-hero-visual",
  ".about-belief",
  ".about-story-panel",
  ".about-value-card",
  ".about-strategy-card",
  ".about-proof-card",
  ".about-closing",
];

type LandingScrollRevealProps = {
  selectors?: string[];
};

export function LandingScrollReveal({ selectors = defaultSelectors }: LandingScrollRevealProps) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selectors.join(",")),
    );
    let lastScrollY = window.scrollY;

    elements.forEach((element, index) => {
      element.classList.add("landing-reveal-target");
      element.style.setProperty("--reveal-index", String(index % 6));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const isScrollingDown = window.scrollY >= lastScrollY;
        lastScrollY = window.scrollY;

        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          target.classList.toggle("from-scroll-down", isScrollingDown);
          target.classList.toggle("from-scroll-up", !isScrollingDown);
          target.classList.toggle("is-visible", entry.isIntersecting);
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
          element.classList.add("from-scroll-down", "is-visible");
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
          "landing-reveal-target",
          "is-visible",
          "from-scroll-down",
          "from-scroll-up",
        );
        element.style.removeProperty("--reveal-index");
      });
    };
  }, [selectors]);

  return null;
}
