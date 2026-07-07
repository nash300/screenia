import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/sa-fungerar-det`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.35,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.35,
    },
    {
      url: `${siteUrl}/cookie-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.25,
    },
    {
      url: `${siteUrl}/subscription-billing-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.25,
    },
    {
      url: `${siteUrl}/support-service-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.25,
    },
  ];
}
