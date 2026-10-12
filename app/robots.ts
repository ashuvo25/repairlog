import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/support", "/privacy", "/terms"],
      // Private app areas and one-time links are never indexed.
      disallow: ["/api/", "/report/", "/invitation/", "/today", "/tickets", "/equipment", "/settings", "/reports", "/menu-impact", "/onboarding"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
