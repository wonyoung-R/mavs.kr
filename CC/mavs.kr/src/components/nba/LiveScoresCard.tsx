// src/components/nba/LiveScoresCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, ExternalLink, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    fetchLiveScores();
    // 1분마다 자동 새로고침
    const interval = setInterval(fetchLiveScores, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchLiveScores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nba/live-scores');

      if (!response.ok) throw new Error('Failed to fetch live scores');

      const data = await response.json();
      if (data.success) {
        setGames(data.data.all_games || []);
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to fetch live scores');
      }
    } catch (err) {
      console.error('Live scores fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getTeamLogo = (teamName: string) => {
    // 팀 이름을 기반으로 로고 이미지 경로 반환
    const teamLogos: { [key: string]: string } = {
      'Mavericks': '/images/teams/mavericks.svg',
      'Lakers': '/images/teams/lakers.svg',
      'Warriors': '/images/teams/warriors.svg',
      'Thunder': '/images/teams/thunder.svg',
      'Rockets': '/images/teams/rockets.svg',
      'Spurs': '/images/teams/spurs.svg',
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
      'Hawks': '/images/teams/hawks.svg',
      'Hornets': '/images/teams/hornets.svg',
      'Magic': '/images/teams/magic.svg',
      'Wizards': '/images/teams/wizards.svg',
      'Pistons': '/images/teams/pistons.svg',
      'Cavaliers': '/images/teams/cavaliers.svg',
      'Pacers': '/images/teams/pacers.svg',
      'Bulls': '/images/teams/bulls.svg',
    };

    return teamLogos[teamName] || '/images/teams/mavericks.svg'; // 기본값으로 매버릭스 로고
  };

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
            <span>실시간 점수</span>
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
          games.slice(0, 5).map((game) => (
            <div
              key={game.game_id}
              className={`flex items-center justify-between py-3 px-3 rounded-lg ${
                game.is_mavs_game
                  ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 border border-blue-500/30'
                  : 'bg-slate-700/30'
              }`}
            >
              <div className="flex items-center space-x-3">
                <img
                  src={getTeamLogo(game.away_team)}
                  alt={game.away_team}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    console.log('Image load error for away team:', game.away_team, getTeamLogo(game.away_team));
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully for away team:', game.away_team, getTeamLogo(game.away_team));
                  }}
                />
                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    game.is_mavs_game ? 'text-blue-300' : 'text-white'
                  }`}>
                    {game.away_team}
                  </div>
                  <div className={`text-xs ${
                    game.is_mavs_game ? 'text-blue-400' : 'text-slate-400'
                  }`}>
                    {game.away_score}
                  </div>
                </div>
                <span className="text-slate-500">@</span>
                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    game.is_mavs_game ? 'text-blue-300' : 'text-white'
                  }`}>
                    {game.home_team}
                  </div>
                  <div className={`text-xs ${
                    game.is_mavs_game ? 'text-blue-400' : 'text-slate-400'
                  }`}>
                    {game.home_score}
                  </div>
                </div>
                <img
                  src={getTeamLogo(game.home_team)}
                  alt={game.home_team}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    console.log('Image load error for home team:', game.home_team, getTeamLogo(game.home_team));
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully for home team:', game.home_team, getTeamLogo(game.home_team));
                  }}
                />
              </div>
              <div className="text-right">
                <div className={`text-xs font-medium ${getStatusColor(game)}`}>
                  {getStatusText(game)}
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
