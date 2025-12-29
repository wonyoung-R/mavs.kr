'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getTeamLogo } from '@/lib/utils/team-logos';
import { Calendar, MapPin, Users, ArrowLeft, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Player {
  id: string;
  name: string;
  shortName: string;
  headshot?: string;
  jersey?: string;
  position?: string;
  starter: boolean;
  stats: string[];
}

interface TeamBoxscore {
  team: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string;
  };
  labels: string[];
  players: Player[];
  totals: string[];
  teamStats: Array<{ name: string; value: string }>;
}

interface GameData {
  game: {
    id: string;
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    scheduledAt: string;
  };
  boxscore?: {
    teams: TeamBoxscore[];
  };
  leaders?: Array<{
    name: string;
    displayName: string;
    leaders: Array<{
      team: string;
      athlete: { name: string; headshot?: string };
      value: string;
    }>;
  }>;
  gameInfo?: {
    venue?: string;
    attendance?: number;
  };
}

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);

  useEffect(() => {
    fetchGameDetails();
  }, [resolvedParams.id]);

  const fetchGameDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/games/${resolvedParams.id}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch game details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    });
  };

  const isMavericksHome = (game: GameData['game']) => {
    return game.homeTeam.includes('Mavericks');
  };

  const isWin = (game: GameData['game']) => {
    const isHome = isMavericksHome(game);
    const mavsScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    return mavsScore !== null && oppScore !== null && mavsScore > oppScore;
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a1628] to-[#050510] pt-20">
          <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="text-center py-20">
              <div className="inline-flex items-center space-x-3 text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="text-lg">경기 정보 로딩 중...</span>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a1628] to-[#050510] pt-20">
          <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">경기 정보를 찾을 수 없습니다.</p>
              <Link href="/archive/games" className="text-blue-400 hover:underline mt-4 inline-block">
                ← 아카이브로 돌아가기
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const { game, boxscore, leaders, gameInfo } = data;
  const win = isWin(game);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a1628] to-[#050510] pt-20">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          {/* 뒤로가기 */}
          <Link
            href="/archive/games"
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>아카이브로 돌아가기</span>
          </Link>

          {/* 경기 헤더 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className={`bg-gradient-to-r ${win ? 'from-green-900/30 to-[#0f1a2a]' : 'from-red-900/30 to-[#0f1a2a]'} border-0 mb-8`}>
              <CardContent className="p-8">
                {/* 결과 배지 */}
                <div className="flex justify-center mb-6">
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                    win ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {win ? '승리' : '패배'} • {game.status}
                  </span>
                </div>

                {/* 스코어보드 */}
                <div className="grid grid-cols-3 gap-8 items-center">
                  {/* Away Team */}
                  <div className="text-center">
                    <img
                      src={getTeamLogo(game.awayTeam)}
                      alt={game.awayTeam}
                      className="w-24 h-24 mx-auto object-contain mb-4"
                    />
                    <p className="text-xl font-bold text-white mb-2">{game.awayTeam}</p>
                    <p className="text-5xl font-bold text-white">{game.awayScore ?? '-'}</p>
                  </div>

                  {/* VS / Info */}
                  <div className="text-center">
                    <p className="text-gray-500 text-lg mb-4">VS</p>
                    <div className="space-y-2 text-sm text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(game.scheduledAt)}</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <span>{formatTime(game.scheduledAt)} KST</span>
                      </div>
                      {gameInfo?.venue && (
                        <div className="flex items-center justify-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>{gameInfo.venue}</span>
                        </div>
                      )}
                      {gameInfo?.attendance && (
                        <div className="flex items-center justify-center space-x-2">
                          <Users className="w-4 h-4" />
                          <span>{gameInfo.attendance.toLocaleString()}명</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Home Team */}
                  <div className="text-center">
                    <img
                      src={getTeamLogo(game.homeTeam)}
                      alt={game.homeTeam}
                      className="w-24 h-24 mx-auto object-contain mb-4"
                    />
                    <p className="text-xl font-bold text-white mb-2">{game.homeTeam}</p>
                    <p className="text-5xl font-bold text-white">{game.homeScore ?? '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 경기 리더스 */}
          {leaders && leaders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span>경기 리더</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {leaders.slice(0, 3).map((category, index) => (
                  <Card key={index} className="bg-[#0f1a2a]/80 border-blue-500/20">
                    <CardContent className="p-4">
                      <p className="text-gray-400 text-sm mb-3">{category.displayName}</p>
                      <div className="space-y-3">
                        {category.leaders?.slice(0, 2).map((leader, lIndex) => (
                          <div key={lIndex} className="flex items-center space-x-3">
                            {leader.athlete.headshot ? (
                              <img
                                src={leader.athlete.headshot}
                                alt={leader.athlete.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                            )}
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{leader.athlete.name}</p>
                              <p className="text-gray-500 text-xs">{leader.team}</p>
                            </div>
                            <p className="text-blue-400 font-bold">{leader.value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* 박스스코어 */}
          {boxscore && boxscore.teams && boxscore.teams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-[#0f1a2a]/80 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span>박스스코어</span>
                    {/* 팀 선택 탭 */}
                    <div className="flex space-x-2">
                      {boxscore.teams.map((team, index) => (
                        <button
                          key={index}
                          onClick={() => setActiveTeamIndex(index)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTeamIndex === index
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#1a2535] text-gray-400 hover:text-white'
                          }`}
                        >
                          {team.team.abbreviation || team.team.name}
                        </button>
                      ))}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium sticky left-0 bg-[#0f1a2a]">선수</th>
                          {boxscore.teams[activeTeamIndex]?.labels.map((label, index) => (
                            <th key={index} className="text-center py-3 px-2 text-gray-400 font-medium min-w-[50px]">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {boxscore.teams[activeTeamIndex]?.players.map((player, index) => (
                          <tr key={index} className={`border-b border-gray-800 ${player.starter ? '' : 'text-gray-500'}`}>
                            <td className="py-3 px-4 sticky left-0 bg-[#0f1a2a]">
                              <div className="flex items-center space-x-2">
                                {player.headshot ? (
                                  <img
                                    src={player.headshot}
                                    alt={player.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                                )}
                                <div>
                                  <p className={`font-medium ${player.starter ? 'text-white' : 'text-gray-400'}`}>
                                    {player.shortName || player.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{player.position}</p>
                                </div>
                              </div>
                            </td>
                            {player.stats.map((stat, statIndex) => (
                              <td key={statIndex} className={`text-center py-3 px-2 ${
                                statIndex === 1 ? 'font-bold text-blue-400' : // PTS
                                player.starter ? 'text-gray-300' : 'text-gray-500'
                              }`}>
                                {stat}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {/* 팀 총계 */}
                        <tr className="bg-[#1a2535] font-bold">
                          <td className="py-3 px-4 sticky left-0 bg-[#1a2535] text-white">TOTAL</td>
                          {boxscore.teams[activeTeamIndex]?.totals.map((total, index) => (
                            <td key={index} className="text-center py-3 px-2 text-white">
                              {total}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 박스스코어가 없는 경우 */}
          {(!boxscore || !boxscore.teams || boxscore.teams.length === 0) && (
            <Card className="bg-[#0f1a2a]/80 border-blue-500/20">
              <CardContent className="p-8 text-center">
                <p className="text-gray-400">상세 박스스코어 정보가 없습니다.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}


