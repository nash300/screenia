import { Bubblegum_Sans, Geist_Mono, Plus_Jakarta_Sans, Special_Elite } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import "bootstrap/dist/css/bootstrap.min.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bubblegumSans = Bubblegum_Sans({
  variable: "--font-bubblegum-sans",
  subsets: ["latin"],
  weight: "400",
});

const specialElite = Special_Elite({
  variable: "--font-special-elite",
  subsets: ["latin"],
  weight: "400",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Screenia | Digital skyltning för företag i Sverige",
    template: "%s | Screenia",
  },
  description:
    "Screenia hjälper salonger, butiker, restauranger och serviceföretag i Sverige med digital skyltning, skärminnehåll och kampanjer på TV-skärm.",
  applicationName: "Screenia",
  authors: [{ name: "Screenia" }],
  creator: "Screenia",
  publisher: "Screenia",
  category: "Digital signage",
  keywords: [
    "digital skyltning",
    "digital signage Sverige",
    "skärmreklam",
    "menyskärm",
    "informationsskärm",
    "TV skyltning företag",
    "digital skyltning salong",
    "digital skyltning butik",
    "digital skyltning restaurang",
    "skärminnehåll företag",
    "reklamskärm butik",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "sv-SE": "/",
    },
  },
  openGraph: {
    title: "Screenia | Digital skyltning för företag i Sverige",
    description:
      "Professionellt skärminnehåll för lokala företag. Visa menyer, prislistor, erbjudanden och information på TV-skärm.",
    url: "/",
    siteName: "Screenia",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/brand/infosync-logo-full-white-bg.png",
        width: 219,
        height: 66,
        alt: "Screenia",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Screenia | Digital skyltning för företag i Sverige",
    description:
      "Digital signage, skärmreklam och hanterat skärminnehåll för företag i Sverige.",
    images: ["/brand/infosync-logo-full-white-bg.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/infosync-icon.png", sizes: "512x512", type: "image/png" },
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
      className={`${plusJakarta.variable} ${geistMono.variable} ${bubblegumSans.variable} ${specialElite.variable} h-full antialiased notranslate`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
