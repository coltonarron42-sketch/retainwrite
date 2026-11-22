import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

// PLAN.md 8.2: Source Sans 3 body and JetBrains Mono. Pages opt in through the
// `font-ds-sans` / `font-ds-mono` utilities; the homepage uses them first.
const dsSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ds-sans",
  weight: ["400", "600", "700"],
});

const dsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-ds-mono",
  weight: ["400"],
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

// The on-screen keyboard resizes the page (Android), so a chat composer docked
// at the bottom stays visible above it. iOS ignores this; the dock lifts itself.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: {
    default: "RetainWrite",
    template: "%s · RetainWrite",
  },
  description:
    "A student paper-writing coach. Six gated stages. You write every sentence.",
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${dsSans.variable} ${dsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
