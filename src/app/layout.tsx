import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/contexts/AuthContext";
import { InstagramFloatingButton } from "@/components/ui/InstagramFloatingButton";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "MAVS.KR - 댈러스 매버릭스 한국 팬 커뮤니티",
  description: "댈러스 매버릭스의 최신 뉴스, 경기 정보, 선수 통계, 그리고 팬 커뮤니티를 만나보세요.",
  keywords: ["댈러스 매버릭스", "Dallas Mavericks", "NBA", "루카 돈치치", "키리 어빙"],
  authors: [{ name: "MAVS.KR Team" }],
  manifest: "/manifest.json",
  themeColor: "#00538C",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "MAVS.KR",
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  openGraph: {
    title: "MAVS.KR - 댈러스 매버릭스 한국 팬 커뮤니티",
    description: "댈러스 매버릭스의 최신 뉴스, 경기 정보, 선수 통계, 그리고 팬 커뮤니티를 만나보세요.",
    type: "website",
    locale: "ko_KR",
  },
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
          rel="stylesheet"
          as="style"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00538C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="MAVS.KR" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.variable} ${anton.variable} font-sans antialiased bg-[#050510] min-h-screen`}>
        <ServiceWorkerRegistration />
        <AuthProvider>
          <ScrollToTop />
          <main className="min-h-screen">
            {children}
          </main>
          <InstagramFloatingButton />
        </AuthProvider>
      </body>
    </html>
  );
}
