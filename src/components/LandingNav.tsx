"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ScreeniaLogo from "@/components/ScreeniaLogo";

const navItems = [
  { href: "/#top", homeHref: "#top", label: "Tj\u00e4nsten" },
  { href: "/sa-fungerar-det", homeHref: "/sa-fungerar-det", label: "S\u00e5 fungerar det" },
  { href: "/#pricing", homeHref: "#pricing", label: "Priser" },
  { href: "/#examples", homeHref: "#examples", label: "Exempel" },
  { href: "/#faq", homeHref: "#faq", label: "FAQ" },
  { href: "/om-oss", homeHref: "/om-oss", label: "Om oss" },
] as const;

type LandingNavProps = {
  currentPath?: "/" | "/sa-fungerar-det" | "/om-oss" | "/kontakt" | "/account";
  accountMode?: boolean;
  onSignOut?: () => void;
  cartCount?: number;
  cartOpen?: boolean;
  onCartClick?: () => void;
};

export function LandingNav({
  currentPath = "/",
  accountMode = false,
  onSignOut,
  cartCount,
  cartOpen = false,
  onCartClick,
}: LandingNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const resolvedPath = (pathname || currentPath) as LandingNavProps["currentPath"];
  const isHome = resolvedPath === "/";

  return (
    <>
      <header className="landing-nav">
      <Link
        className="landing-brand"
        href="/#top"
        aria-label="Screenia – startsida"
        onClick={() => setMenuOpen(false)}
      >
        <ScreeniaLogo className="screenia-logo-nav" />
      </Link>

      <div className="landing-header-controls">
        {typeof cartCount === "number" ? (
          <button
            className={`landing-nav-cart${cartOpen ? " landing-nav-cart-open" : ""}`}
            type="button"
            aria-label={
              cartCount > 0
                ? `Öppna varukorg, ${cartCount} skärm${cartCount === 1 ? "" : "ar"}`
                : "Öppna varukorg"
            }
            title="Varukorg"
            aria-expanded={cartOpen}
            aria-controls="selected-package-summary"
            onClick={onCartClick}
          >
            <span className="landing-nav-cart-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 5h2l1.3 9.1a2 2 0 0 0 2 1.9h7.8a2 2 0 0 0 1.9-1.5L20.5 8H7.1l-.4-3H4V5Zm4.5 5h9.6l-.9 4H9.1l-.6-4Zm1.3 8.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm7 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
              </svg>
            </span>
            <span className="landing-nav-cart-count" aria-hidden="true">
              {cartCount}
            </span>
          </button>
        ) : null}
        <button
          className="landing-menu-button"
          type="button"
          aria-label="\u00d6ppna meny"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav
        className={menuOpen ? "landing-links landing-links-open" : "landing-links"}
        aria-label="Huvudnavigering"
      >
        <div className="landing-nav-primary">
          {navItems.map((item) => {
            const href = isHome ? item.homeHref : item.href;
            const isCurrentPage = !isHome && item.href === resolvedPath;

            return (
              <Link
                key={item.href}
                href={href}
                className="landing-nav-link"
                aria-current={isCurrentPage ? "page" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="landing-nav-actions">
          {accountMode ? (
            <button
              className="landing-nav-login"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onSignOut?.();
              }}
            >
              <span className="landing-nav-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M13 5h6v14h-6v-2h4V7h-4V5Z" />
                  <path d="M10 7 8.6 8.4l2.6 2.6H3v2h8.2l-2.6 2.6L10 17l5-5-5-5Z" />
                </svg>
              </span>
              Logga ut
            </button>
          ) : (
            <Link
              className="landing-nav-login"
              href="/login"
              onClick={() => setMenuOpen(false)}
            >
              <span className="landing-nav-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M10 7 8.6 8.4l2.6 2.6H3v2h8.2l-2.6 2.6L10 17l5-5-5-5Z" />
                  <path d="M13 4h5v16h-5v-2h3V6h-3V4Z" />
                </svg>
              </span>
              Logga in
            </Link>
          )}
        </div>
      </nav>

      </header>

      {!accountMode && resolvedPath !== "/kontakt" ? (
        <Link
          className="landing-floating-contact"
          href="/kontakt"
          onClick={() => setMenuOpen(false)}
        >
          <span className="landing-nav-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7.8L3 22v-4.2A2 2 0 0 1 2 16V7a2 2 0 0 1 2-2Zm0 2v9h1v2.2L7.2 17H20V7H4Zm3 3h10v2H7v-2Zm0 4h7v2H7v-2Z" />
            </svg>
          </span>
          Kontakta oss
        </Link>
      ) : null}
    </>
  );
}
