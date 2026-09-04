import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { isComingSoonEnabled } from "@/lib/site-gate";

export default function robots(): MetadataRoute.Robots {
  if (isComingSoonEnabled()) {
    // The real pages 307-redirect to /coming-soon for anyone without the
    // preview cookie anyway, so a crawler could never actually reach them —
    // this just says so explicitly rather than leaving it implicit.
    return {
      rules: [{ userAgent: "*", allow: "/coming-soon", disallow: "/" }],
      sitemap: `${siteConfig.website}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/dashboard", "/login", "/signup"],
      },
    ],
    sitemap: `${siteConfig.website}/sitemap.xml`,
  };
}
