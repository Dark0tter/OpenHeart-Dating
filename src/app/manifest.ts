import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenHeart",
    short_name: "OpenHeart",
    description: "Privacy-first dating for LGBTQIA+ and interest-positive people.",
    start_url: "/feed",
    display: "standalone",
    background_color: "#2c1239",
    theme_color: "#2c1239",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
