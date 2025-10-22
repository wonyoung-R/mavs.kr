import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MAVS.KR - 달라스 매버릭스 한국 팬 커뮤니티",
  description: "달라스 매버릭스의 최신 뉴스, 경기 정보, 선수 통계, 그리고 팬 커뮤니티를 만나보세요.",
  keywords: ["달라스 매버릭스", "Dallas Mavericks", "NBA", "루카 돈치치", "키리 어빙"],
  authors: [{ name: "MAVS.KR Team" }],
  openGraph: {
    title: "MAVS.KR - 달라스 매버릭스 한국 팬 커뮤니티",
    description: "달라스 매버릭스의 최신 뉴스, 경기 정보, 선수 통계, 그리고 팬 커뮤니티를 만나보세요.",
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
      <body className={`${inter.variable} font-sans antialiased bg-toss-gray-50`}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 bg-toss-gray-50">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
