// src/components/nba/LiveScoresCard.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, ExternalLink, RefreshCw, Play, CheckCircle, Calendar } from 'lucide-react';
import { getTeamLogo } from '@/lib/utils/team-logos';

interface LiveGame {
  game_id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  period: number;
  time_remaining: string;
  game_time_kst: string;
  game_date_kst: string;
  is_mavs_game: boolean;
  is_live: boolean;
  is_finished: boolean;
}

interface LiveScoresCardProps {
  className?: string;
}

export function LiveScoresCard({ className = '' }: LiveScoresCardProps) {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLiveScores = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nba/live-scores');

      if (!response.ok) throw new Error('Failed to fetch live scores');

      const data = await response.json();
      if (data.success) {
        const newGames = data.data.all_games || [];
        setGames(newGames);
        setError(null);

        // 모든 경기가 종료되었는지 확인
        const allGamesFinished = newGames.every((game: LiveGame) => game.is_finished);
        const currentHour = new Date().getHours();

        // 오후 2시 이후이고 모든 경기가 종료되었으면 업데이트 중단
        if (currentHour >= 14 && allGamesFinished) {
          setIsUpdating(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } else {
        throw new Error(data.message || 'Failed to fetch live scores');
      }
    } catch (err) {
      console.error('Live scores fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveScores();

    // 자동 업데이트 시작
    intervalRef.current = setInterval(() => {
      fetchLiveScores();
    }, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLiveScores]);

  const getStatusText = (game: LiveGame) => {
    if (game.is_finished) return '종료';
    if (game.is_live) {
      // 라이브 경기: 쿼터와 잔여시간만 표시
      const period = game.period || 1;
      const timeRemaining = game.time_remaining || '0:00';
      return `${period}Q ${timeRemaining}`;
    }
    // 예정 경기: 시간만 표시 (날짜 제거)
    return game.game_time_kst;
  };

  const getStatusColor = (game: LiveGame) => {
    if (game.is_mavs_game) return 'text-blue-400';
    if (game.is_finished) return 'text-slate-400';
    if (game.is_live) return 'text-green-400';
    return 'text-blue-400';
  };


  return (
    <Card className={`bg-slate-800/50 backdrop-blur-sm border-slate-700/50 rounded-2xl ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            <div className="flex flex-col">
              <span>실시간 점수</span>
              {isUpdating && (
                <span className="text-xs text-green-400 flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>자동 업데이트 중</span>
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={fetchLiveScores}
            size="sm"
            className="bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-xl p-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center space-x-2 text-slate-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
              <span className="text-sm">점수 로딩 중...</span>
            </div>
          </div>
        ) : games.length > 0 ? (
          games
            .sort((a, b) => {
              // 1. 댈러스 경기를 최상단으로
              if (a.is_mavs_game && !b.is_mavs_game) return -1;
              if (!a.is_mavs_game && b.is_mavs_game) return 1;

              // 2. 진행 중인 경기를 상단으로
              if (a.is_live && !b.is_live) return -1;
              if (!a.is_live && b.is_live) return 1;

              // 3. 종료된 경기를 하단으로
              if (a.is_finished && !b.is_finished) return 1;
              if (!a.is_finished && b.is_finished) return -1;

              // 4. 같은 상태라면 시간순으로 정렬
              return new Date(a.game_time_kst).getTime() - new Date(b.game_time_kst).getTime();
            })
            .map((game) => (
            <div
              key={game.game_id}
              className={`flex items-center justify-between py-3 px-3 rounded-lg transition-all duration-200 ${
                game.is_mavs_game
                  ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 border border-blue-500/30'
                  : game.is_live
                  ? 'bg-gradient-to-r from-green-600/10 to-green-700/10 border border-green-500/20'
                  : game.is_finished
                  ? 'bg-slate-700/20 opacity-75'
                  : 'bg-slate-700/30'
              }`}
            >
              <div className="flex items-center space-x-3">
                {(() => {
                  const awayLogo = getTeamLogo(game.away_team);
                  return awayLogo ? (
                    <img
                      src={awayLogo}
                      alt={game.away_team}
                      className="w-6 h-6 object-contain flex-shrink-0"
                      style={{
                        minWidth: '24px',
                        minHeight: '24px',
                        display: 'block',
                        visibility: 'visible'
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.warn('Image load error for away team:', {
                          teamName: game.away_team,
                          logoPath: awayLogo
                        });
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white font-bold">
                        {game.away_team.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  );
                })()}
                <div className="text-center">
                  <div className="text-sm font-medium text-white">
                    {game.away_team}
                  </div>
                  <div className="text-xs text-slate-400">
                    {game.away_score}
                  </div>
                </div>
                <span className={`${
                  game.is_mavs_game ? 'text-blue-400' :
                  game.is_live ? 'text-green-400' :
                  game.is_finished ? 'text-slate-500' : 'text-slate-500'
                }`}>@</span>
                <div className="text-center">
                  <div className="text-sm font-medium text-white">
                    {game.home_team}
                  </div>
                  <div className="text-xs text-slate-400">
                    {game.home_score}
                  </div>
                </div>
                {(() => {
                  const homeLogo = getTeamLogo(game.home_team);
                  return homeLogo ? (
                    <img
                      src={homeLogo}
                      alt={game.home_team}
                      className="w-6 h-6 object-contain flex-shrink-0"
                      style={{
                        minWidth: '24px',
                        minHeight: '24px',
                        display: 'block',
                        visibility: 'visible'
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.warn('Image load error for home team:', {
                          teamName: game.home_team,
                          logoPath: homeLogo
                        });
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white font-bold">
                        {game.home_team.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div className="text-right">
                <div className={`text-xs font-medium flex items-center justify-end space-x-1 ${getStatusColor(game)}`}>
                  {game.is_live && <Play className="w-3 h-3" />}
                  {game.is_finished && <CheckCircle className="w-3 h-3" />}
                  {!game.is_live && !game.is_finished && <Calendar className="w-3 h-3" />}
                  <span>{getStatusText(game)}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">오늘 경기가 없습니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
