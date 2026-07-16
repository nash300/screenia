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
      images: [
        `${siteUrl}/landing/hero-slides/01/image.png`,
        `${siteUrl}/brand/screenia-pricing-devices.png`,
      ],
    },
    {
      url: `${siteUrl}/sa-fungerar-det`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.85,
      images: [
        `${siteUrl}/brand/how-it-works-sv-banner.png`,
        `${siteUrl}/landing/hero-slides/02/image.png`,
      ],
    },
    {
      url: `${siteUrl}/om-oss`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.75,
      images: [
        `${siteUrl}/brand/screenia-pricing-devices.png`,
        `${siteUrl}/brand/screenia-helper.png`,
      ],
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
