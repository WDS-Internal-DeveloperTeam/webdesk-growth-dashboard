import type { Metadata } from "next";
import type { ReactNode } from "react";
import { toCssCustomProperties } from "@webdesk/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebDesk Growth Dashboard",
  description: "Application shell — 43-module registry, permission-aware navigation.",
};

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
    <html lang="en">
      <head>
        <TokenStyles />
      </head>
      <body>{children}</body>
    </html>
  );
}
