import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/settings/", "/sign-in/", "/sign-up/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
