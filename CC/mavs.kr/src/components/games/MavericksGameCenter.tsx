'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar, Trophy, MapPin, Target, Users, TrendingUp, Play } from 'lucide-react';
import { getTeamLogo } from '@/lib/utils/team-logos';

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

interface SeasonStats {
  wins: number;
  losses: number;
  winPercentage: number;
  conferenceRank: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  fieldGoalPercentage: number;
}

export function MavericksGameCenter() {
  const [nextGame, setNextGame] = useState<MavericksGame | null>(null);
  const [liveGame, setLiveGame] = useState<MavericksGame | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMavericksData();
  }, []);

  const fetchMavericksData = async () => {
    try {
      setLoading(true);

      // 다음 경기 정보 가져오기
      const scheduleResponse = await fetch('/api/nba/espn-schedule');
      const scheduleData = await scheduleResponse.json();

      if (scheduleData.success && scheduleData.data.upcoming_games.length > 0) {
        setNextGame(scheduleData.data.upcoming_games[0]);
      }

      // 라이브 경기 확인
      const liveResponse = await fetch('/api/nba/live-scores');
      const liveData = await liveResponse.json();

      if (liveData.success) {
        const mavsLiveGame = liveData.data.all_games.find((game: any) => game.is_mavs_game && game.is_live);
        if (mavsLiveGame) {
          setLiveGame(mavsLiveGame);
        }
      }

      // 시즌 통계 (현재는 모크 데이터, 추후 API 연동)
      setSeasonStats({
        wins: 29,
        losses: 13,
        winPercentage: 69.0,
        conferenceRank: 3,
        pointsPerGame: 118.5,
        reboundsPerGame: 44.2,
        assistsPerGame: 25.8,
        fieldGoalPercentage: 47.8
      });

    } catch (error) {
      console.error('Failed to fetch Mavericks data:', error);
    } finally {
      setLoading(false);
    }
  };


  const getStatusText = (game: MavericksGame) => {
    if (game.status === 'live') {
      return `${game.period}쿼터 ${game.time_remaining}`;
    } else if (game.status === 'finished') {
      return '경기 종료';
    } else {
      return `${game.game_date_kst} ${game.game_time_kst} KST`;
    }
  };

  const getStatusColor = (game: MavericksGame) => {
    if (game.status === 'live') return 'text-red-400';
    if (game.status === 'finished') return 'text-green-400';
    return 'text-blue-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 pt-24">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="text-xl">댈러스 매버릭스 데이터 로딩 중...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentGame = liveGame || nextGame;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 pt-24">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center space-x-4 mb-6"
          >
            <img
              src="/images/teams/mavericks.svg"
              alt="Dallas Mavericks"
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              댈러스 매버릭스
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-300"
          >
            Dallas Mavericks Game Center
          </motion.p>
        </div>

        {/* 메인 경기 정보 */}
        {currentGame && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mb-12"
          >
            <Card className="bg-gradient-to-r from-blue-900/50 to-gray-900/50 border-blue-500/30 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl md:text-3xl text-white flex items-center justify-center space-x-3">
                  {liveGame ? (
                    <>
                      <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse"></div>
                      <span>LIVE 경기</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-6 h-6 text-blue-400" />
                      <span>다음 경기</span>
                    </>
                  )}
                </CardTitle>
                <div className={`text-lg font-semibold ${getStatusColor(currentGame)}`}>
                  {getStatusText(currentGame)}
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid md:grid-cols-3 gap-8 items-center">
                  {/* Away Team */}
                  <div className="text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <img
                        src={getTeamLogo(currentGame.is_home ? currentGame.opponent : 'Mavericks')}
                        alt={currentGame.is_home ? currentGame.opponent : 'Mavericks'}
                        className="w-20 h-20 object-contain"
                      />
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Away</p>
                        <p className="text-2xl font-bold text-white">
                          {currentGame.is_home ? currentGame.opponent : '댈러스 매버릭스'}
                        </p>
                        {currentGame.mavs_score !== null && (
                          <p className="text-4xl font-bold text-blue-400 mt-2">
                            {currentGame.is_home ? currentGame.mavs_score : currentGame.opponent_score}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* VS */}
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-400 mb-4">VS</div>
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-400">{currentGame.venue}</span>
                    </div>
                    {currentGame.broadcast && currentGame.broadcast.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2">
                        {currentGame.broadcast.map((channel, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm"
                          >
                            {channel}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Home Team */}
                  <div className="text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <img
                        src={getTeamLogo(currentGame.is_home ? 'Mavericks' : currentGame.opponent)}
                        alt={currentGame.is_home ? 'Mavericks' : currentGame.opponent}
                        className="w-20 h-20 object-contain"
                      />
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Home</p>
                        <p className="text-2xl font-bold text-white">
                          {currentGame.is_home ? '댈러스 매버릭스' : currentGame.opponent}
                        </p>
                        {currentGame.opponent_score !== null && (
                          <p className="text-4xl font-bold text-blue-400 mt-2">
                            {currentGame.is_home ? currentGame.opponent_score : currentGame.mavs_score}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 시즌 통계 */}
        {seasonStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center space-x-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <span>2024-25 시즌 통계</span>
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* 승패 기록 */}
              <Card className="bg-gradient-to-br from-blue-900/50 to-gray-900/50 border-blue-500/20">
                <CardContent className="p-6 text-center">
                  <Trophy className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">{seasonStats.wins}</div>
                  <div className="text-sm text-gray-400 mb-2">승</div>
                  <div className="text-lg font-semibold text-blue-400">{seasonStats.winPercentage}%</div>
                  <div className="text-xs text-gray-500">승률</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-900/50 to-gray-900/50 border-red-500/20">
                <CardContent className="p-6 text-center">
                  <div className="w-8 h-8 bg-red-400 rounded-full mx-auto mb-3"></div>
                  <div className="text-3xl font-bold text-white mb-1">{seasonStats.losses}</div>
                  <div className="text-sm text-gray-400 mb-2">패</div>
                  <div className="text-lg font-semibold text-red-400">{seasonStats.conferenceRank}위</div>
                  <div className="text-xs text-gray-500">서부 컨퍼런스</div>
                </CardContent>
              </Card>

              {/* 공격 통계 */}
              <Card className="bg-gradient-to-br from-green-900/50 to-gray-900/50 border-green-500/20">
                <CardContent className="p-6 text-center">
                  <Target className="w-8 h-8 text-green-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">{seasonStats.pointsPerGame}</div>
                  <div className="text-sm text-gray-400 mb-2">평균 득점</div>
                  <div className="text-lg font-semibold text-green-400">{seasonStats.fieldGoalPercentage}%</div>
                  <div className="text-xs text-gray-500">야투 성공률</div>
                </CardContent>
              </Card>

              {/* 수비 통계 */}
              <Card className="bg-gradient-to-br from-purple-900/50 to-gray-900/50 border-purple-500/20">
                <CardContent className="p-6 text-center">
                  <Users className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-white mb-1">{seasonStats.reboundsPerGame}</div>
                  <div className="text-sm text-gray-400 mb-2">평균 리바운드</div>
                  <div className="text-lg font-semibold text-purple-400">{seasonStats.assistsPerGame}</div>
                  <div className="text-xs text-gray-500">평균 어시스트</div>
                </CardContent>
              </Card>
            </div>

            {/* 추가 통계 */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-orange-900/50 to-gray-900/50 border-orange-500/20">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                  <div className="text-xl font-bold text-white mb-1">118.5</div>
                  <div className="text-sm text-gray-400">평균 득점</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-cyan-900/50 to-gray-900/50 border-cyan-500/20">
                <CardContent className="p-6 text-center">
                  <Play className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
                  <div className="text-xl font-bold text-white mb-1">25.8</div>
                  <div className="text-sm text-gray-400">평균 어시스트</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-pink-900/50 to-gray-900/50 border-pink-500/20">
                <CardContent className="p-6 text-center">
                  <Target className="w-8 h-8 text-pink-400 mx-auto mb-3" />
                  <div className="text-xl font-bold text-white mb-1">47.8%</div>
                  <div className="text-sm text-gray-400">야투 성공률</div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
