import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";
const siteHost = new URL(siteUrl).host;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account/",
        "/admin/",
        "/admin-login/",
        "/api/",
        "/auth/",
        "/display/",
        "/login/",
        "/onboarding/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteHost,
  };
}
