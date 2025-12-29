'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { getTeamLogo } from '@/lib/utils/team-logos';
import { Calendar, Trophy, Filter, ChevronLeft, ChevronRight, BarChart3, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import Link from 'next/link';

interface ArchivedGame {
  id: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string;
  stats: any;
}

interface ArchiveStats {
  totalGames: number;
  wins: number;
  losses: number;
  winPct: string;
}

export default function GameArchivePage() {
  const [games, setGames] = useState<ArchivedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [season, setSeason] = useState<string>('2025-26');
  const [stats, setStats] = useState<ArchiveStats | null>(null);

  useEffect(() => {
    fetchArchiveGames();
  }, [page, season]);

  const fetchArchiveGames = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (season) {
        params.append('season', season);
      }

      const response = await fetch(`/api/games/archive?${params}`);
      const data = await response.json();

      if (data.success) {
        setGames(data.data.games);
        setTotalPages(data.data.pagination.totalPages);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch archive games:', error);
    } finally {
      setLoading(false);
    }
  };

  const isMavericksHome = (game: ArchivedGame) => {
    return game.homeTeam.includes('Mavericks');
  };

  const getMavericksScore = (game: ArchivedGame) => {
    return isMavericksHome(game) ? game.homeScore : game.awayScore;
  };

  const getOpponentScore = (game: ArchivedGame) => {
    return isMavericksHome(game) ? game.awayScore : game.homeScore;
  };

  const getOpponent = (game: ArchivedGame) => {
    return isMavericksHome(game) ? game.awayTeam : game.homeTeam;
  };

  const isWin = (game: ArchivedGame) => {
    const mavsScore = getMavericksScore(game);
    const oppScore = getOpponentScore(game);
    return mavsScore !== null && oppScore !== null && mavsScore > oppScore;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTeamName = (teamName: string) => {
    // 간단한 팀 이름으로 변환
    const shortNames: Record<string, string> = {
      'Dallas Mavericks': '매버릭스',
      'Los Angeles Lakers': '레이커스',
      'Los Angeles Clippers': '클리퍼스',
      'Golden State Warriors': '워리어스',
      'Phoenix Suns': '선즈',
      'Denver Nuggets': '너겟츠',
      'Oklahoma City Thunder': '썬더',
      'Memphis Grizzlies': '그리즐리스',
      'Minnesota Timberwolves': '울브스',
      'New Orleans Pelicans': '펠리컨스',
      'Sacramento Kings': '킹스',
      'Portland Trail Blazers': '블레이저스',
      'San Antonio Spurs': '스퍼스',
      'Houston Rockets': '로켓츠',
      'Utah Jazz': '재즈',
      'Boston Celtics': '셀틱스',
      'Milwaukee Bucks': '벅스',
      'Philadelphia 76ers': '식서스',
      'Miami Heat': '히트',
      'New York Knicks': '닉스',
      'Brooklyn Nets': '네츠',
      'Cleveland Cavaliers': '캐벌리어스',
      'Chicago Bulls': '불스',
      'Atlanta Hawks': '호크스',
      'Toronto Raptors': '랩터스',
      'Charlotte Hornets': '호넷츠',
      'Indiana Pacers': '페이서스',
      'Detroit Pistons': '피스톤즈',
      'Orlando Magic': '매직',
      'Washington Wizards': '위저즈',
    };
    return shortNames[teamName] || teamName;
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a1628] to-[#050510] pt-20">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          {/* 헤더 */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center justify-center space-x-4 mb-4"
            >
              <Trophy className="w-10 h-10 text-yellow-400" />
              <h1 className="text-3xl md:text-5xl font-bold text-white">
                경기 아카이브
              </h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-400"
            >
              댈러스 매버릭스 시즌별 경기 기록
            </motion.p>
          </div>

          {/* 필터 & 통계 */}
          <div className="mb-8 grid md:grid-cols-2 gap-4">
            {/* 시즌 필터 */}
            <Card className="bg-[#0f1a2a]/80 border-blue-500/20 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <Filter className="w-5 h-5 text-blue-400" />
                  <select
                    value={season}
                    onChange={(e) => {
                      setSeason(e.target.value);
                      setPage(1);
                    }}
                    className="flex-1 bg-[#1a2535] text-white px-4 py-2.5 rounded-lg border border-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  >
                    <option value="2025-26">2025-26 시즌 (현재)</option>
                    <option value="2023-24">2023-24 시즌 (파이널 진출)</option>
                    <option value="2022-23">2022-23 시즌</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 시즌 통계 */}
            {stats && (
              <Card className="bg-[#0f1a2a]/80 border-blue-500/20 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      <span className="text-gray-400 text-sm">시즌 성적</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <span className="text-green-400 font-bold text-lg">{stats.wins}</span>
                        <span className="text-gray-500 text-sm ml-1">승</span>
                      </div>
                      <span className="text-gray-600">-</span>
                      <div className="text-center">
                        <span className="text-red-400 font-bold text-lg">{stats.losses}</span>
                        <span className="text-gray-500 text-sm ml-1">패</span>
                      </div>
                      <div className="pl-3 border-l border-gray-700">
                        <span className="text-blue-400 font-bold">{stats.winPct}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 로딩 상태 */}
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center space-x-3 text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="text-lg">경기 기록 로딩 중...</span>
              </div>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">저장된 경기 기록이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 경기 목록 */}
              <div className="space-y-3 mb-8">
                {games.map((game, index) => {
                  const opponent = getOpponent(game);
                  const mavsScore = getMavericksScore(game);
                  const oppScore = getOpponentScore(game);
                  const win = isWin(game);
                  const isHome = isMavericksHome(game);

                  return (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                    >
                      <Link href={`/archive/games/${game.gameId}`}>
                        <Card
                          className={`bg-[#0f1a2a]/60 border-l-4 ${
                            win
                              ? 'border-l-green-500 hover:bg-green-900/10'
                              : 'border-l-red-500 hover:bg-red-900/10'
                          } border-t-0 border-r-0 border-b-0 hover:border-l-4 transition-all cursor-pointer group`}
                        >
                        <CardContent className="p-4">
                          {/* 모바일: 세로 레이아웃, 데스크톱: 가로 레이아웃 */}
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            {/* 날짜 & 홈/원정 */}
                            <div className="flex items-center space-x-2 md:space-x-4 md:min-w-[140px]">
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-gray-400 text-xs md:text-sm whitespace-nowrap">
                                  {formatDate(game.scheduledAt)}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                                isHome
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {isHome ? 'HOME' : 'AWAY'}
                              </span>
                            </div>

                            {/* 매치업 */}
                            <div className="flex items-center space-x-2 md:space-x-4 flex-1 justify-center md:justify-center min-w-0">
                              {/* 매버릭스 */}
                              <div className="flex items-center space-x-1 md:space-x-2 min-w-0">
                                <img
                                  src={getTeamLogo('Mavericks')}
                                  alt="Mavericks"
                                  className="w-6 h-6 md:w-8 md:h-8 object-contain flex-shrink-0"
                                />
                                <span className="text-white font-semibold hidden md:inline">
                                  매버릭스
                                </span>
                                <span className={`text-xl md:text-2xl font-bold whitespace-nowrap ${
                                  win ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {mavsScore ?? '-'}
                                </span>
                              </div>

                              <span className="text-gray-600 text-xs md:text-sm flex-shrink-0">vs</span>

                              {/* 상대팀 */}
                              <div className="flex items-center space-x-1 md:space-x-2 min-w-0">
                                <span className={`text-xl md:text-2xl font-bold whitespace-nowrap ${
                                  !win ? 'text-green-400' : 'text-gray-400'
                                }`}>
                                  {oppScore ?? '-'}
                                </span>
                                <span className="text-gray-300 hidden md:inline text-sm truncate max-w-[100px]">
                                  {formatTeamName(opponent)}
                                </span>
                                <img
                                  src={getTeamLogo(opponent)}
                                  alt={opponent}
                                  className="w-6 h-6 md:w-8 md:h-8 object-contain flex-shrink-0"
                                />
                              </div>
                            </div>

                            {/* 결과 */}
                            <div className="flex justify-end md:justify-end md:min-w-[50px]">
                              <span
                                className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold ${
                                  win
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {win ? 'W' : 'L'}
                              </span>
                            </div>
                          </div>

                          {/* 상세 보기 힌트 */}
                          <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-gray-500 flex items-center space-x-1">
                              <span>상세 보기</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center space-x-1 px-4 py-2 bg-[#1a2535] text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#243040] transition-colors border border-blue-500/20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>이전</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#1a2535] text-gray-400 hover:bg-[#243040] border border-blue-500/20'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center space-x-1 px-4 py-2 bg-[#1a2535] text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#243040] transition-colors border border-blue-500/20"
                  >
                    <span>다음</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

