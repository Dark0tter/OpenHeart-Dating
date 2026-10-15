import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/request";

export const dynamic = "force-dynamic";
import { PUBLIC_PAGES } from "@/lib/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return PUBLIC_PAGES.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/register" ? 0.8 : 0.5,
  }));
}
