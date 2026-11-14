import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResoGuard-AI | Voice Impersonation Defense",
  description:
    "Real-time voice-cloning impersonation defense for high-risk calls and transactions.",
};

export const viewport: Viewport = {
  themeColor: "#030504",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
