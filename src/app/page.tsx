"use client";

import { useState } from "react";
import "./landing.css";

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

const plans = [
  {
    name: "Standard",
    resolution: "FHD",
    setupFee: "1 998 kr",
    monthlyFee: "219 kr",
    description: "For one professional display that needs reliable playback.",
    features: [
      "Full HD display playback",
      "Customer onboarding link",
      "Admin device management",
      "14-day trial on monthly subscription",
      "No binding period",
    ],
  },
  {
    name: "Premium",
    resolution: "4K",
    setupFee: "2 398 kr",
    monthlyFee: "269 kr",
    description: "For premium screens where sharper 4K content matters.",
    features: [
      "4K-ready display playback",
      "Customer onboarding link",
      "Admin device management",
      "14-day trial on monthly subscription",
      "No binding period",
    ],
    featured: true,
  },
];

const stats = [
  { value: "24/7", label: "continuous display playback" },
  { value: "14 days", label: "trial on monthly subscription" },
  { value: "0", label: "binding period" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <a
          className="landing-brand"
          href="#top"
          onClick={() => setMenuOpen(false)}
        >
          <img src="/brand/infosync-logo1.png" alt="" />
          <span>InfoSync</span>
        </a>

        <button
          className="landing-menu-button"
          type="button"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={menuOpen ? "landing-links open" : "landing-links"}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            className="landing-nav-cta"
            href="#contact"
            onClick={() => setMenuOpen(false)}
          >
            Book demo
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Digital signage management</p>
            <h1>Professional screen content, managed from one clean admin panel.</h1>
            <p className="landing-lede">
              InfoSync helps salons, stores, and service businesses turn display
              screens into reliable sales surfaces. Onboard customers, register
              devices, upload playlists, and keep every screen running.
            </p>

            <div className="landing-actions">
              <a href="#pricing" className="landing-button landing-button-primary">
                View plans
              </a>
              <a href="#workflow" className="landing-button landing-button-secondary">
                See workflow
              </a>
            </div>

            <div className="landing-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-hero-media" aria-label="InfoSync display preview">
            <img src="/window_screen1.jpg" alt="Digital signage in a window" />
            <div className="landing-device-panel">
              <span className="landing-panel-status">Live</span>
              <strong>Display / device-code</strong>
              <p>Playlist checked every few seconds, with local cache support.</p>
            </div>
          </div>
        </section>

        <section id="platform" className="landing-section landing-platform">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">What changed</p>
            <h2>Built around the real admin flow</h2>
            <p>
              The product now reflects the operational structure behind
              InfoSync: customers, onboarding, subscriptions, device inventory,
              playlists, and fullscreen display playback.
            </p>
          </div>

          <div className="landing-feature-grid">
            <Feature
              title="Customer onboarding"
              text="Create customer records, send onboarding links, collect profile details, and track acceptance status."
            />
            <Feature
              title="Device management"
              text="Register screens, assign them to customers, store inventory details, and monitor playlist readiness."
            />
            <Feature
              title="Subscription-ready"
              text="Standard and Premium pricing connect to Stripe checkout, trial rules, and customer activation."
            />
            <Feature
              title="Reliable playback"
              text="Each device opens a dedicated display URL that loops assigned MP4 playlists and caches content."
            />
          </div>
        </section>

        <section id="workflow" className="landing-section landing-workflow">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Workflow</p>
            <h2>From first contact to live screen</h2>
          </div>

          <div className="landing-timeline">
            <Step number="01" title="Create customer" text="Start with a draft customer and generate a secure onboarding link." />
            <Step number="02" title="Complete onboarding" text="The customer adds company details, accepts legal terms, and starts payment." />
            <Step number="03" title="Assign devices" text="Register the physical screen, location, warranty details, and device code." />
            <Step number="04" title="Publish playlist" text="Upload MP4 content and preview the exact display route before go-live." />
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Pricing</p>
            <h2>Simple plans for managed displays</h2>
            <p>
              Setup is paid once. The monthly subscription starts with a 14-day
              trial and has no binding period.
            </p>
          </div>

          <div className="landing-price-grid">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={
                  plan.featured
                    ? "landing-price-card featured"
                    : "landing-price-card"
                }
              >
                {plan.featured && <span className="landing-plan-badge">Recommended</span>}
                <div className="landing-plan-heading">
                  <div>
                    <h3>{plan.name}</h3>
                    <p>{plan.resolution}</p>
                  </div>
                  <span>{plan.resolution}</span>
                </div>
                <p className="landing-plan-description">{plan.description}</p>

                <div className="landing-price-row">
                  <span>Setup</span>
                  <strong>{plan.setupFee}</strong>
                </div>
                <div className="landing-price-row">
                  <span>Monthly</span>
                  <strong>{plan.monthlyFee}</strong>
                </div>

                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <a href="#contact" className="landing-button landing-button-primary">
                  Start with {plan.name}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="landing-contact">
          <div>
            <p className="landing-eyebrow">Ready when you are</p>
            <h2>Launch your next display with a cleaner workflow.</h2>
            <p>
              Tell us how many screens you want to manage and what kind of
              content you need to show. We will help you choose the right plan.
            </p>
          </div>
          <a href="mailto:hello@infosync.se" className="landing-button landing-button-primary">
            Contact InfoSync
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <span>InfoSync</span>
        <nav>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </nav>
        <p>{new Date().getFullYear()} InfoSync. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <article className="landing-feature">
      <span />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="landing-step">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}
