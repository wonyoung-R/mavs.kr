import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAVS.KR - 댈러스 매버릭스 한국 팬 커뮤니티",
  description: "댈러스 매버릭스의 최신 뉴스, 경기 일정, 유튜브 영상을 한국어로.",
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
  openGraph: {
    title: "MAVS.KR - 댈러스 매버릭스 한국 팬 커뮤니티",
    description: "댈러스 매버릭스의 최신 뉴스, 경기 일정, 유튜브 영상을 한국어로.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
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
      <body style={{ margin: 0, padding: 0, background: '#0a0a0b', overscrollBehavior: 'none' }}>
        {children}
      </body>
    </html>
  );
}
