// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Metadata, Viewport } from "next";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll";
import { CopyrightGuard } from "@/components/brand/copyright-guard";
import { WatermarkRail } from "@/components/brand/watermark-rail";
import { COPYRIGHT_NOTICE, STUDIO } from "@/lib/copyright";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// PP Editorial New is a paid Pangram Pangram font we don't have license files for —
// Fraunces is a free variable contrast-serif with the same "editorial" character,
// used only for the italic accent line under each section's bold industrial headline.
const fraunces = Fraunces({
  variable: "--font-editorial",
  subsets: ["latin"],
  style: ["italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KROMA LABS — KL-75 Billet Aluminum Keyboard",
    template: "%s — KROMA LABS",
  },
  description:
    "KL-75: a gasket-mounted 75% keyboard machined from 6063-T6 billet aluminum with a PVD brass ballast. A portfolio concept by HVNF Studios.",
  applicationName: "KROMA LABS",
  authors: [{ name: STUDIO }],
  creator: STUDIO,
  publisher: STUDIO,
  other: {
    copyright: COPYRIGHT_NOTICE,
    "dcterms.rightsHolder": STUDIO,
    "dcterms.rights": COPYRIGHT_NOTICE,
  },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased`}>
      <body className="bg-carbon font-sans text-chalk">
        {/*
          React 19 hoists this into <head>; it's the machine-readable pointer to the license terms
          above. A raw <link> isn't rewritten by Next's basePath the way next/link is, so the path
          is hardcoded to match this site's GitHub Pages project path (/kroma-labs).
        */}
        <link rel="license" href="/kroma-labs/legal/terms" />
        <SmoothScrollProvider>
          {children}
          <WatermarkRail />
          <CopyrightGuard />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
