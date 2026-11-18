import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mebundle.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/support", "/terms", "/privacy", "/store/"],
        disallow: [
          "/admin/",
          "/reseller/",
          "/payment/",
          "/track/",
          "/api/",
        ],
      },
    ],
    sitemap: siteUrl + "/sitemap.xml",
    host: siteUrl,
  };
}
