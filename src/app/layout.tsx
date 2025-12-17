import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstagramFloatingButton } from "@/components/ui/InstagramFloatingButton";

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
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
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
      </head>
      <body className={`${inter.variable} ${anton.variable} font-sans antialiased bg-[#050510] min-h-screen`}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <InstagramFloatingButton />
        </AuthProvider>
      </body>
    </html>
  );
}
