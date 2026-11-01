"use client";

import { useEffect } from "react";

const defaultSelectors = [
  ".landing-section",
  ".landing-section-heading",
  ".landing-feature",
  ".landing-price-card",
  ".landing-gallery-card",
  ".landing-faq-item",
  ".landing-workflow-step",
  ".landing-hero-modern",
  ".landing-contact",
  ".landing-footer",
  ".landing-quick-start",
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

    const workflowSections = elements.filter((element) =>
      element.matches(".landing-workflow"),
    );
    const workflowObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const grid = entry.target.querySelector<HTMLElement>(
            ".landing-workflow-grid",
          );
          if (!grid) return;

          grid.classList.remove("landing-workflow-motion-active");
          if (entry.isIntersecting) {
            void grid.offsetWidth;
            grid.classList.add("landing-workflow-motion-active");
          }
        });
      },
      { threshold: 0.18 },
    );
    workflowSections.forEach((section) => workflowObserver.observe(section));

    const heroSections = elements.filter((element) =>
      element.matches(".landing-hero-modern"),
    );
    const replayHeroMotion = (hero: HTMLElement) => {
      hero
        .querySelectorAll<HTMLElement>(
          ".landing-hero-modern-copy, .landing-hero-modern-visual, .landing-hero-process-card",
        )
        .forEach((target) => target.style.removeProperty("animation"));
      hero.classList.remove("landing-hero-motion-active");
      void hero.offsetWidth;
      hero.classList.add("landing-hero-motion-active");

      // Use replayable CSS animations directly. This works in the embedded
      // browser as well as regular browsers, and the inline priority keeps
      // this intentional hero entrance from being removed by global motion
      // reduction rules.
      const cssFallback = (selector: string, animation: string, delay = "0ms") => {
        const target = hero.querySelector<HTMLElement>(selector);
        if (!target) return;
        target.style.setProperty("animation", `${animation} ${delay} both`, "important");
      };
      cssFallback(
        ".landing-hero-modern-copy",
        "screenia-hero-copy-in 760ms cubic-bezier(0.16, 1, 0.3, 1)",
      );
      cssFallback(
        ".landing-hero-modern-visual",
        "screenia-hero-visual-in 900ms cubic-bezier(0.16, 1, 0.3, 1)",
        "90ms",
      );
      cssFallback(
        ".landing-hero-process-delivery",
        "screenia-hero-card-in 720ms cubic-bezier(0.16, 1, 0.3, 1)",
        "180ms",
      );
      cssFallback(
        ".landing-hero-process-connection",
        "screenia-hero-card-in 720ms cubic-bezier(0.16, 1, 0.3, 1)",
        "300ms",
      );
      cssFallback(
        ".landing-hero-process-display",
        "screenia-hero-card-in 720ms cubic-bezier(0.16, 1, 0.3, 1)",
        "420ms",
      );
    };
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const hero = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            replayHeroMotion(hero);
          } else {
            hero
              .querySelectorAll<HTMLElement>(
                ".landing-hero-modern-copy, .landing-hero-modern-visual, .landing-hero-process-card",
              )
              .forEach((target) => target.style.removeProperty("animation"));
            hero.classList.remove("landing-hero-motion-active");
          }
        });
      },
      { threshold: 0.16 },
    );
    heroSections.forEach((section) => heroObserver.observe(section));
    const initialHeroMotionFrame = window.requestAnimationFrame(() => {
      heroSections.forEach((section) => {
        const bounds = section.getBoundingClientRect();
        if (bounds.top < window.innerHeight && bounds.bottom > 0) {
          replayHeroMotion(section);
        }
      });
    });

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
      window.cancelAnimationFrame(initialHeroMotionFrame);
      window.clearTimeout(initialRevealTimer);
      observer.disconnect();
      workflowObserver.disconnect();
      heroObserver.disconnect();
      workflowSections.forEach((section) => {
        section
          .querySelector(".landing-workflow-grid")
          ?.classList.remove("landing-workflow-motion-active");
      });
      heroSections.forEach((section) => {
        section
          .querySelectorAll<HTMLElement>(
            ".landing-hero-modern-copy, .landing-hero-modern-visual, .landing-hero-process-card",
          )
          .forEach((target) => target.style.removeProperty("animation"));
        section.classList.remove("landing-hero-motion-active");
      });
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
