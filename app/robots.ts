import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vidsloom.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/app", "/login", "/portal", "/checkout/success", "/checkout/cancel"]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
