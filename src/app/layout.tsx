import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오운완",
  description: "친구들과 함께하는 비공개 운동 인증 PWA",
  applicationName: "오운완",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/app-icon-white-bg.png",
    apple: "/icons/app-icon-white-bg.png",
  },
  appleWebApp: {
    capable: true,
    title: "오운완",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#5e4ea5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}