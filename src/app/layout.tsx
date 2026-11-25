import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppProviders from "@/components/layout/AppProviders";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "MAVS.KR — A home for Mavericks fans",
  description: "댈러스의 모든 순간, 우리의 시선으로. 매버릭스 팬들의 공간 MAVS.KR.",
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
  openGraph: {
    title: "MAVS.KR — A home for Mavericks fans",
    description: "댈러스의 모든 순간, 우리의 시선으로. 매버릭스 팬들의 공간 MAVS.KR.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = (await headers()).get("x-mavs-language") === "en" ? "en" : "ko";
  return (
    <html lang={language}>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans+KR:wght@400;500;600&family=Archivo+Narrow:wght@600;700&display=swap"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#f9f9f6', overscrollBehavior: 'none' }}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
