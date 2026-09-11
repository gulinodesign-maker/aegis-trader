import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "Aegis Trader", template: "%s · Aegis Trader" },
  description: "Paper-first AI-assisted trading research PWA with deterministic risk controls.",
  applicationName: "Aegis Trader",
  appleWebApp: { capable: true, title: "Aegis Trader", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#07090d"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
