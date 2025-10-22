'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagneticText } from '@/components/ui/MagneticText';
import { HomeNews } from '@/components/news/HomeNews';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Users, Trophy, Star, ChevronRight, Clock, MapPin } from 'lucide-react';
import { NewsArticle } from '@/types/news';
import { LiveBoxScoreBanner } from '@/components/nba/LiveBoxScoreBanner';
import { MavericksGameSlider } from '@/components/nba/MavericksGameSlider';
import { LiveScoresCard } from '@/components/nba/LiveScoresCard';

interface MavericksGame {
  game_id: string;
  game_date: string;
  game_date_kst: string;
  game_time_kst: string;
  opponent: string;
  is_home: boolean;
  mavs_score: number;
  opponent_score: number | null;
  result: string | null;
  status: 'finished' | 'upcoming' | 'today' | 'live';
  matchup: string;
  venue: string;
  period?: number;
  time_remaining?: string;
  broadcast?: string[];
}

export default function NewHomePage() {
  const [isLive] = useState(true);
  const [initialNews, setInitialNews] = useState<NewsArticle[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<MavericksGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    // 초기 뉴스 데이터 로드 (번역 포함)
    fetch('/api/news/all?limit=6&translate=true')
      .then(res => res.json())
      .then(data => setInitialNews(data.articles || []))
      .catch(err => console.error('Failed to load initial news:', err));

    // NBA 데이터 로드
    fetchNBAData();
  }, []);

  const getTeamLogo = (teamName: string) => {
    const teamLogos: { [key: string]: string } = {
      'Mavericks': '/images/teams/mavericks.svg',
      'Lakers': '/images/teams/lakers.svg',
      'Warriors': '/images/teams/warriors.svg',
      'Thunder': '/images/teams/thunder.svg',
      'Rockets': '/images/teams/rockets.svg',
      'Spurs': '/images/teams/spurs.svg',
      'San Antonio Spurs': '/images/teams/spurs.svg',
      'Nuggets': '/images/teams/nuggets.svg',
      'Jazz': '/images/teams/jazz.svg',
      'Trail Blazers': '/images/teams/trailblazers.svg',
      'Suns': '/images/teams/suns.svg',
      'Kings': '/images/teams/kings.svg',
      'Clippers': '/images/teams/clippers.svg',
      'Timberwolves': '/images/teams/timberwolves.svg',
      'Pelicans': '/images/teams/pelicans.svg',
      'Grizzlies': '/images/teams/grizzlies.svg',
      'Celtics': '/images/teams/celtics.svg',
      'Heat': '/images/teams/heat.svg',
      'Bucks': '/images/teams/bucks.svg',
      '76ers': '/images/teams/76ers.svg',
      'Nets': '/images/teams/nets.svg',
      'Knicks': '/images/teams/knicks.svg',
      'Raptors': '/images/teams/raptors.svg',
      'Toronto Raptors': '/images/teams/raptors.svg',
      'Hawks': '/images/teams/hawks.svg',
      'Hornets': '/images/teams/hornets.svg',
      'Magic': '/images/teams/magic.svg',
      'Wizards': '/images/teams/wizards.svg',
      'Washington Wizards': '/images/teams/wizards.svg',
      'Pistons': '/images/teams/pistons.svg',
      'Cavaliers': '/images/teams/cavaliers.svg',
      'Pacers': '/images/teams/pacers.svg',
      'Bulls': '/images/teams/bulls.svg',
    };

    return teamLogos[teamName] || '/images/teams/mavericks.svg';
  };

  const fetchNBAData = async () => {
    try {
      // ESPN API에서 다음 경기 일정 가져오기
      const gamesResponse = await fetch('/api/nba/espn-schedule');
      const gamesData = await gamesResponse.json();

      if (gamesData.success && gamesData.data) {
        // 다음 3경기만 가져오기
        const upcoming = gamesData.data.upcoming_games?.slice(0, 3) || [];
        setUpcomingGames(upcoming);
      }
      setLoadingGames(false);

    } catch (error) {
      console.error('Failed to fetch NBA data:', error);
      setLoadingGames(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Hero Section with MagneticText */}
      <section className="hero-bg pt-24 pb-12 px-4 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')]"></div>
        </div>

        <div className="container mx-auto max-w-7xl relative z-10">
          {/* MagneticText Title - 임시 비활성화 */}
          <div className="text-center mb-12 relative">
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mb-6">
              MAVERICKS KOREA
            </h1>
            <motion.p
              className="text-xl md:text-3xl text-blue-100 font-medium mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 1 }}
            >
              댈러스 매버릭스 한국 공식 팬 커뮤니티
            </motion.p>
            <motion.div
              className="flex items-center justify-center space-x-6 text-sm text-blue-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5, duration: 1 }}
            >
              <span className="flex items-center space-x-2 bg-blue-800/30 px-4 py-2 rounded-full">
                <Users className="w-4 h-4" />
                <span>12.5K 팬</span>
              </span>
              <span className="flex items-center space-x-2 bg-blue-800/30 px-4 py-2 rounded-full">
                <Trophy className="w-4 h-4" />
                <span>Since 2011</span>
              </span>
              <span className="flex items-center space-x-2 bg-blue-800/30 px-4 py-2 rounded-full">
                <Star className="w-4 h-4" />
                <span>공식 인증</span>
              </span>
            </motion.div>
          </div>

          {/* Mavericks Game Slider - 임시 비활성화 */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mb-12"
          >
            <MavericksGameSlider />
          </motion.div> */}
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
            {/* News Section (2 cols) */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center space-x-3">
                  <span className="w-1 h-6 md:h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
                  <span>최신 뉴스</span>
                </h2>
                <div className="text-xs md:text-sm text-blue-300">
                  실시간 업데이트
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-slate-700/50">
                <HomeNews initialData={initialNews} />
              </div>

            </div>

            {/* Sidebar */}
            <div className="space-y-4 md:space-y-6">
              {/* 1. 매버릭스 경기 일정 */}
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 rounded-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <span>Mavericks Schedule</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingGames ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="bg-slate-700/50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-24 h-4 bg-slate-600/50 rounded animate-pulse"></div>
                            <div className="w-16 h-6 bg-slate-600/50 rounded-full animate-pulse"></div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-slate-600/50 rounded-lg animate-pulse"></div>
                              <div className="w-20 h-4 bg-slate-600/50 rounded animate-pulse"></div>
                            </div>
                            <div className="w-4 h-4 bg-slate-600/50 rounded animate-pulse"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : upcomingGames.length > 0 ? (
                    upcomingGames.map((game, index) => (
                      <div key={game.game_id} className="bg-slate-700/50 rounded-xl p-4 cursor-pointer hover:bg-slate-600/50 transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-slate-400">{game.game_date_kst} {game.game_time_kst} KST</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            game.is_home
                              ? 'bg-blue-600/30 text-blue-300'
                              : 'bg-slate-600/30 text-slate-300'
                          }`}>
                            {game.is_home ? '홈' : '원정'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <img
                              src={getTeamLogo('Mavericks')}
                              alt="Mavericks"
                              className="w-10 h-10 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-white">
                                {game.is_home ? 'vs' : '@'}
                              </span>
                              <img
                                src={getTeamLogo(game.opponent)}
                                alt={game.opponent}
                                className="w-6 h-6 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                              <span className="font-semibold text-white">
                                {game.opponent}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-400 py-8">
                      <p>다음 경기 일정이 없습니다</p>
                    </div>
                  )}

                  <Button className="w-full mt-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-300 text-sm font-medium shadow-lg">
                    전체 일정 보기
                  </Button>
                </CardContent>
              </Card>

              {/* 2. 실시간 점수 */}
              <LiveScoresCard />

              {/* 3. 커뮤니티 인기글 */}
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 rounded-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-sm">커뮤니티 인기글</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="cursor-pointer hover:bg-slate-700/50 -mx-2 px-3 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-start space-x-3">
                      <span className="text-red-400 font-bold text-sm bg-red-500/20 px-2 py-1 rounded-full">1</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white line-clamp-2 mb-2">돈치치 MVP 가능성 진지하게 논의해봅시다</p>
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full">토론</span>
                          <span className="text-xs text-slate-400">💬 156</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="cursor-pointer hover:bg-slate-700/50 -mx-2 px-3 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-start space-x-3">
                      <span className="text-orange-400 font-bold text-sm bg-orange-500/20 px-2 py-1 rounded-full">2</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white line-clamp-2 mb-2">역대 Mavs 베스트5 라인업 투표</p>
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full">투표</span>
                          <span className="text-xs text-slate-400">🗳️ 342</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="cursor-pointer hover:bg-slate-700/50 -mx-2 px-3 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-start space-x-3">
                      <span className="text-yellow-400 font-bold text-sm bg-yellow-500/20 px-2 py-1 rounded-full">3</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white line-clamp-2 mb-2">시즌 개막전 기대감</p>
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full">일반</span>
                          <span className="text-xs text-slate-400">💬 67</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Player Stats Section */}
      <section className="px-4 py-16 border-t border-slate-700/50">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center space-x-3">
              <span className="w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></span>
              <span>팀 리더 스탯</span>
            </h2>
            <p className="text-slate-400">2024-25 시즌 현재</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-gradient-to-br from-blue-900/50 to-slate-800/50 border-blue-500/20 rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-blue-300 mb-2 font-medium">득점 리더</p>
                    <p className="text-4xl font-bold tabular-nums text-white">32.4</p>
                    <p className="text-sm text-blue-400 font-medium">PPG</p>
                  </div>
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">77</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-white text-lg">루카 돈치치(Luka Dončić)</p>
                  <p className="text-sm text-blue-300">#77 • 포인트 가드</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-600/20 rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-slate-300 mb-2 font-medium">리바운드 리더</p>
                    <p className="text-4xl font-bold tabular-nums text-white">8.5</p>
                    <p className="text-sm text-slate-400 font-medium">RPG</p>
                  </div>
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">2</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-white text-lg">데릭 라이블리 2세(Dereck Lively II)</p>
                  <p className="text-sm text-slate-300">#2 • 센터</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-600/20 rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-slate-300 mb-2 font-medium">어시스트 리더</p>
                    <p className="text-4xl font-bold tabular-nums text-white">8.8</p>
                    <p className="text-sm text-slate-400 font-medium">APG</p>
                  </div>
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">77</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-white text-lg">루카 돈치치(Luka Dončić)</p>
                  <p className="text-sm text-slate-300">#77 • 포인트 가드</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <style jsx>{`
        .hero-bg {
          position: relative;
          overflow: hidden;
        }

        .hero-bg::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at center, transparent 0%, rgba(59, 130, 246, 0.15) 50%, transparent 70%);
          animation: rotate-bg 20s linear infinite;
        }

        @keyframes rotate-bg {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .gradient-border {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          padding: 1px;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.7);
        }
      `}</style>

    </div>
  );
}
