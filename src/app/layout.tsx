import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://infosync.se";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "InfoSync | Digital skyltning för företag i Sverige",
    template: "%s | InfoSync",
  },
  description:
    "InfoSync hjälper salonger, butiker, restauranger och serviceföretag i Sverige med digital skyltning, skärmreklam, menyer, prislistor och kampanjer på TV-skärm.",
  applicationName: "InfoSync",
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
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "InfoSync | Digital skyltning för företag i Sverige",
    description:
      "Professionellt skärminnehåll för lokala företag. Visa menyer, prislistor, erbjudanden och information på TV-skärm.",
    url: "/",
    siteName: "InfoSync",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/brand/infosync-logo-full-white-bg.png",
        width: 219,
        height: 66,
        alt: "InfoSync",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "InfoSync | Digital skyltning för företag i Sverige",
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
    },
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
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased notranslate`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
