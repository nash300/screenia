import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakta oss",
  description:
    "Kontakta Screenia om digital skyltning, paket, skärminnehåll eller support. Varje ärende får ett ärendenummer och besvaras via e-post.",
  alternates: { canonical: "/kontakt" },
};

export default function ContactLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
