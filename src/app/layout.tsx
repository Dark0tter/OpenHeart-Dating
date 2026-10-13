import type { Metadata } from "next";
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
