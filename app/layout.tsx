import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

import { LiveStateProvider } from "@/components/live-state-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Mythic Bid — Rank is the bid.",
    template: "%s · Mythic Bid",
  },
  description:
    "The paid leaderboard. No ads, no algorithms, no mercy — pay more than everyone else to stand above them. Get outranked, pay the difference, climb again.",
  openGraph: {
    type: "website",
    siteName: "Mythic Bid",
    title: "Mythic Bid — Rank is the bid.",
    description:
      "The paid leaderboard where money is the only metric. Claim your spot from $5.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mythic Bid — Rank is the bid.",
    description:
      "The paid leaderboard where money is the only metric. Claim your spot from $5.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-bg text-ink min-h-dvh flex flex-col">
        <LiveStateProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </LiveStateProvider>
      </body>
    </html>
  );
}
