import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function Header() {
  return (
    <header className="fixed top-0 w-full bg-black/90 backdrop-blur-md z-50 border-b border-gray-800">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center font-bold text-lg">
                M
              </div>
              <span className="text-xl font-bold text-white">MAVS<span className="text-blue-500">.KR</span></span>
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-white hover:text-blue-400 transition">홈</Link>
              <Link href="/news" className="text-white hover:text-blue-400 transition">뉴스</Link>
              <Link href="/games" className="text-white hover:text-blue-400 transition">경기</Link>
              <Link href="/players" className="text-white hover:text-blue-400 transition">선수</Link>
              <Link href="/forum" className="text-white hover:text-blue-400 transition">커뮤니티</Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-800">
              로그인
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              회원가입
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
