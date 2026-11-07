import { Geist_Mono, Plus_Jakarta_Sans, Special_Elite } from "next/font/google";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";
import { VercelAnalytics } from "./vercel-analytics";
import "./globals.css";
import "./landing.css";
import "./public-info.css";
import "../styles/screenia-theme.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const specialElite = Special_Elite({
  variable: "--font-special-elite",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Digital skyltning för företag med vanlig TV | Screenia",
    template: "%s | Screenia",
  },
  description:
    "Digital skyltning för företag i Sverige. Visa information och erbjudanden på en vanlig TV eller professionell skärm – Screenia sköter innehåll och teknik.",
  applicationName: "Screenia",
  authors: [{ name: "Screenia" }],
  creator: "Screenia",
  publisher: "Screenia",
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
  category: "Digital skyltning",
  keywords: [
    "digital skyltning",
    "digital skyltning företag",
    "digital skyltning Sverige",
    "digital skyltning TV",
    "digital informationsskärm",
    "reklam på TV-skärm",
    "digitala menytavlor",
    "skärminnehåll för företag",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "sv-SE": "/",
    },
  },
  openGraph: {
    title: "Digital skyltning för företag med vanlig TV | Screenia",
    description:
      "Visa information och erbjudanden på en vanlig TV eller professionell skärm. Screenia sköter innehåll, system och support.",
    url: "/",
    siteName: "Screenia",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/landing/hero-slides/01/image.png",
        width: 1200,
        height: 675,
        alt: "Digital skyltning för företag med Screenia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital skyltning för företag med vanlig TV | Screenia",
    description:
      "Hanterad digital skyltning och professionellt skärminnehåll för företag i Sverige.",
    images: ["/landing/hero-slides/01/image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/screenia-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      translate="no"
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${geistMono.variable} ${specialElite.variable} h-full antialiased notranslate`}
    >
      <body className="screenia-theme min-h-full flex flex-col">
        {children}
        <VercelAnalytics />
      </body>
    </html>
  );
}
