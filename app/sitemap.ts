import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vidsloom.com";

const routes = [
  "",
  "/growth-audit",
  "/pilot",
  "/newsletter",
  "/workspace-demo",
  "/checkout",
  "/privacy",
  "/terms",
  "/refund"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/growth-audit" || route === "/pilot" ? 0.9 : 0.6
  }));
}
