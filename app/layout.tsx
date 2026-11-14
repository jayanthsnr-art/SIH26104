import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResoGuard-AI | Live Voice Risk Monitor",
  description:
    "Real-time voice-cloning impersonation detection, risk-aware transaction controls, and verifiable audit evidence for banking and enterprise calls.",
};

export const viewport: Viewport = {
  themeColor: "#030504",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
