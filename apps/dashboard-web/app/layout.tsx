import type { Metadata } from "next";
import { Public_Sans, Sora } from "next/font/google";
import type { ReactNode } from "react";
import { toCssCustomProperties } from "@webdesk/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebDesk Growth Dashboard",
  description: "Application shell — 43-module registry, permission-aware navigation.",
};

/**
 * Self-hosted via `next/font/google` (no runtime request to Google, no layout-shift-causing
 * external stylesheet) — each generates a CSS custom property on `<html>` that
 * `@webdesk/ui`'s `typographyTokens.fontFamilyBase`/`fontFamilyDisplay` reference by name
 * (`--font-public-sans`/`--font-sora`, set explicitly below to match). Weights match what the
 * design canvas mockup actually used.
 */
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
});
const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

/**
 * Injects every `@webdesk/ui` design token as a `--webdesk-dashboard-*`
 * custom property on `:root`, once, here — the single source every
 * component (this app and `packages/ui`'s own components) reads from.
 * Values come from a trusted, build-time-known module, never user input.
 */
function TokenStyles() {
  const properties = toCssCustomProperties();
  const css = `:root {\n${Object.entries(properties)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n")}\n}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${sora.variable}`}>
      <head>
        <TokenStyles />
      </head>
      <body>{children}</body>
    </html>
  );
}
