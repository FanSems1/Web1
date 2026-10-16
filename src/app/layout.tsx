import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, Rubik } from "next/font/google";
import "./globals.css";

// chunky display for the torn titles
const rubik = Rubik({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["800", "900"],
  display: "swap",
});

// condensed uppercase for the on-screen copy, like film captions
const barlow = Barlow_Condensed({
  variable: "--font-cap",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// readable body for overlays
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "The Worlds Between",
  description: "Every world begins with an idea. An interactive developer portfolio in five worlds.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E8E0CF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${rubik.variable} ${barlow.variable} ${inter.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
