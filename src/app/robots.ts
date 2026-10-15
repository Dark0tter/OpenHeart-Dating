import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/mod",
        "/owner",
        "/members",
        "/messages",
        "/profile",
        "/feed",
        "/search",
        "/settings",
        "/waitlist/confirm",
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
