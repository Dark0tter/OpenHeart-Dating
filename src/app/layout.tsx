import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenHeart — Dating without artificial paywalls",
  description:
    "Privacy-first dating for LGBTQIA+ people, kink-positive adults, and anyone who needs safer discoverability. Free likes, messages, and matching.",
  robots: { index: false, follow: false },
  other: {
    "X-Robots-Tag": "noindex, nofollow",
  },
};

/** `cover` lets the app shell draw under the iPhone notch and home bar; nav bars pad with safe-area insets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body
        className={`${figtree.variable} ${fraunces.variable} min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
