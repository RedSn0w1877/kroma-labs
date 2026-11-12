// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Hanken_Grotesk, Martian_Mono } from "next/font/google";
import "./globals.css";
import { CopyrightGuard } from "@/components/brand/copyright-guard";
import { BASE_PATH } from "@/lib/asset";
import { COPYRIGHT_NOTICE, STUDIO } from "@/lib/copyright";
import { liteScript } from "@/lib/device";

// Martian Mono, variable in weight and width: the display voice (condensed, wdth 75) and every UI legend
// (wdth 100). Latin only, and the page's ONLY font preload.
const martian = Martian_Mono({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
  variable: "--font-martian",
});

// Hanken Grotesk 400 sets body copy. Not preloaded: it swaps in under the size-adjusted fallback next/font
// generates, and the first screen's only body text is the two-line lede.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-hanken",
});

// Headings use the condensed cut, whose metrics next/font's own fallback (tuned to wdth 100) doesn't match,
// so the display stack swaps that fallback for "kroma-display-fallback" (globals.css), sized to wdth 75.
const display = martian.style.fontFamily.split(",")[0].trim();
const htmlStyle = { "--kroma-display": `${display}, "kroma-display-fallback", ui-monospace, monospace` } as CSSProperties;

const SITE_URL = "https://redsn0w1877.github.io/kroma-labs/";
const SHARE_IMAGE = {
  url: `${SITE_URL}share/kl75-share-1200x630.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "The Kroma KL-75 Monolith, a dark aluminum mechanical keyboard with cream and grey keys, on a yellow mat under the headline “a mechanical keyboard you can hear before you buy it.”",
};

export const metadata: Metadata = {
  title: {
    default: "Kroma KL-75 Monolith — a mechanical keyboard you can hear before you buy it",
    template: "%s — Kroma",
  },
  description:
    "The KL-75 Monolith is a 75% mechanical keyboard machined from one block of aluminum. Press any key to hear its three switches, synthesized live in your browser. A portfolio concept by HVNF Studios.",
  applicationName: "Kroma",
  // The share tile (scripts/share-tile.mjs): the first screen at 1200×630. GitHub Pages serves the site at
  // SITE_URL, and share cards need an absolute URL. The legal pages inherit it.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: "Kroma",
    title: "Kroma KL-75 Monolith — a mechanical keyboard you can hear before you buy it",
    description:
      "A 75% mechanical keyboard machined from one block of aluminum. Press any key to hear its three switches. A portfolio concept by HVNF Studios.",
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kroma KL-75 Monolith — a mechanical keyboard you can hear before you buy it",
    description: "A 75% mechanical keyboard machined from one block of aluminum. Press any key to hear its three switches.",
    images: [SHARE_IMAGE],
  },
  authors: [{ name: STUDIO }],
  creator: STUDIO,
  publisher: STUDIO,
  other: {
    copyright: COPYRIGHT_NOTICE,
    "dcterms.rightsHolder": STUDIO,
    "dcterms.rights": COPYRIGHT_NOTICE,
  },
};

// The yolk mat; setMat() (kroma-state) rewrites this meta when another mat goes down.
export const viewport: Viewport = {
  themeColor: "#F2C200",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the head script adds `js`, `data-lite` and `data-embed` to <html> before
    // React hydrates, and the DOM's answer is the one we want kept.
    <html lang="en" className={`${martian.variable} ${hanken.variable}`} style={htmlStyle} suppressHydrationWarning>
      <head>
        {/* Runs while the HTML parses, before first paint (src/lib/device.ts). */}
        <script dangerouslySetInnerHTML={{ __html: liteScript() }} />
      </head>
      <body>
        {/* React hoists this into <head>. A raw <link> isn't basePath-aware, hence BASE_PATH. */}
        <link rel="license" href={`${BASE_PATH}/legal/terms/`} />
        {children}
        <CopyrightGuard />
      </body>
    </html>
  );
}
