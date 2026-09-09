import type { Metadata, Viewport } from "next";
import "./globals.css";

const metadataBase = new URL(process.env.OUNWAN_APP_ORIGIN ?? "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: "오운완",
  description: "친구들과 함께하는 비공개 운동 인증 PWA",
  applicationName: "오운완",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "오운완",
    description: "친구들과 함께하는 비공개 운동 인증 PWA",
    siteName: "오운완",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/assets/ounwan-og-thumbnail.webp",
        alt: "오운완",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "오운완",
    description: "친구들과 함께하는 비공개 운동 인증 PWA",
    images: ["/assets/ounwan-og-thumbnail.webp"],
  },
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