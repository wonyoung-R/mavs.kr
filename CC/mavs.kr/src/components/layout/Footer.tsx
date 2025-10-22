export function Footer() {
  return (
    <footer className="border-t bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-full bg-mavs-blue" />
              <span className="text-lg font-bold text-mavs-navy">MAVS.KR</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              달라스 매버릭스 한국 팬 커뮤니티
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-mavs-navy">뉴스</h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><a href="/news" className="hover:text-mavs-blue">최신 뉴스</a></li>
              <li><a href="/news/espn" className="hover:text-mavs-blue">ESPN</a></li>
              <li><a href="/news/mavsmoneyball" className="hover:text-mavs-blue">Mavs Moneyball</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-mavs-navy">경기</h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><a href="/games/live" className="hover:text-mavs-blue">라이브 스코어</a></li>
              <li><a href="/games/schedule" className="hover:text-mavs-blue">경기 일정</a></li>
              <li><a href="/games/results" className="hover:text-mavs-blue">경기 결과</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-mavs-navy">커뮤니티</h3>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li><a href="/forum" className="hover:text-mavs-blue">포럼</a></li>
              <li><a href="/forum/game-thread" className="hover:text-mavs-blue">게임 스레드</a></li>
              <li><a href="/forum/trade-rumors" className="hover:text-mavs-blue">트레이드 루머</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            © 2024 MAVS.KR. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
