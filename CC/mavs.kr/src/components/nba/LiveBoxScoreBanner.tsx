'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getTeamLogo } from '@/lib/utils/team-logos';
import {
  Clock,
  Play,
  Pause,
  CheckCircle,
  Calendar,
  RefreshCw,
  ExternalLink,
  Trophy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface GameSummary {
  game_id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: number;
  period: number;
  time_remaining: string;
  game_time_kst: string;
  game_date_kst: string;
  is_mavs_game: boolean;
  is_live: boolean;
  is_finished: boolean;
  broadcast: string[];
}

interface BoxScoreResponse {
  success: boolean;
  message: string;
  data: GameSummary[];
  last_updated: string;
}

export function LiveBoxScoreBanner() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [maxVisibleGames] = useState(3); // 최대 표시할 경기 수

  const fetchBoxScores = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const response = await fetch('/api/nba/box-scores');
      const data: BoxScoreResponse = await response.json();

      if (data.success) {
        // Show all games, not just Mavericks games
        setGames(data.data);
        setLastUpdated(data.last_updated);
      } else {
        setError(data.message || 'Failed to fetch box scores');
      }
    } catch (err) {
      console.error('Error fetching box scores:', err);
      setError('Failed to connect to NBA API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoxScores();
  }, [fetchBoxScores]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchBoxScores(false); // Don't show loading spinner for auto-refresh
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [autoRefresh, fetchBoxScores]);

  const getStatusIcon = (game: GameSummary) => {
    if (game.is_finished) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (game.is_live) return <Play className="w-4 h-4 text-red-500 animate-pulse" />;
    return <Clock className="w-4 h-4 text-blue-500" />;
  };

  const getStatusText = (game: GameSummary) => {
    if (game.is_finished) return '종료';
    if (game.is_live) return `Q${game.period} - ${game.time_remaining}`;
    return game.game_time_kst;
  };

  const getStatusColor = (game: GameSummary) => {
    if (game.is_finished) return 'bg-green-100 text-green-800';
    if (game.is_live) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };


  const formatTeamName = (teamName: string) => {
    // Shorten team names for banner display
    const shortNames: { [key: string]: string } = {
      'Dallas Mavericks': 'Mavericks',
      'Los Angeles Lakers': 'Lakers',
      'Golden State Warriors': 'Warriors',
      'Boston Celtics': 'Celtics',
      'Miami Heat': 'Heat',
      'Denver Nuggets': 'Nuggets',
      'Phoenix Suns': 'Suns',
      'Milwaukee Bucks': 'Bucks',
    };
    return shortNames[teamName] || teamName.split(' ').pop() || teamName;
  };

  const nextGames = () => {
    if (games.length <= maxVisibleGames) return;
    setCurrentGameIndex(prev =>
      prev + maxVisibleGames >= games.length ? 0 : prev + maxVisibleGames
    );
  };

  const prevGames = () => {
    if (games.length <= maxVisibleGames) return;
    setCurrentGameIndex(prev =>
      prev - maxVisibleGames < 0
        ? Math.max(0, games.length - maxVisibleGames)
        : prev - maxVisibleGames
    );
  };

  const visibleGames = games.slice(currentGameIndex, currentGameIndex + maxVisibleGames);

  if (loading && games.length === 0) {
    return (
      <Card className="bg-white/95 backdrop-blur-sm border border-blue-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-800 flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>오늘의 경기</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">경기 정보 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && games.length === 0) {
    return (
      <Card className="bg-white/95 backdrop-blur-sm border border-red-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-800 flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>오늘의 경기</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-600 mb-3">{error}</p>
            <Button
              onClick={() => fetchBoxScores()}
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              다시 시도
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/95 backdrop-blur-sm border border-blue-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-800 flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>오늘의 경기</span>
            {games.length > maxVisibleGames && (
              <span className="text-sm text-gray-500">
                ({currentGameIndex + 1}-{Math.min(currentGameIndex + maxVisibleGames, games.length)}/{games.length})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center space-x-1">
            {/* Scroll Navigation */}
            {games.length > maxVisibleGames && (
              <>
                <Button
                  onClick={prevGames}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button
                  onClick={nextGames}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </>
            )}
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              size="sm"
              variant="ghost"
              className={`p-1 h-6 w-6 ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`}
            >
              {autoRefresh ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </Button>
            <Button
              onClick={() => fetchBoxScores()}
              size="sm"
              variant="ghost"
              className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-500">
            마지막 업데이트: {new Date(lastUpdated).toLocaleTimeString('ko-KR')}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleGames.map((game, index) => (
            <motion.div
              key={game.game_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-xl border-2 shadow-sm hover:shadow-md transition-all duration-300 ${game.is_mavs_game
                ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300'
                : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
                }`}
            >
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <Badge className={getStatusColor(game)}>
                  {getStatusText(game)}
                </Badge>
              </div>

              {/* Game Header */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(game)}
                    <span className="text-xs font-medium text-gray-600">
                      {game.game_date_kst} {game.game_time_kst}
                    </span>
                  </div>
                </div>

                {/* Teams and Scores */}
                <div className="space-y-2">
                  {/* Away Team */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                      {getTeamLogo(game.away_team) ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white shadow-sm flex items-center justify-center">
                          <img
                            src={getTeamLogo(game.away_team)!}
                            alt={game.away_team}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }}
                          />
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-sm hidden">
                            <span className="text-white text-sm font-bold">
                              {game.away_team.split(' ').pop()?.charAt(0) || 'A'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-white text-sm font-bold">
                            {game.away_team.split(' ').pop()?.charAt(0) || 'A'}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold ${game.is_mavs_game && game.away_team === 'Dallas Mavericks'
                          ? 'text-blue-600'
                          : 'text-gray-800'
                          }`}>
                          {formatTeamName(game.away_team)}
                        </span>
                        <span className="text-xs text-gray-500">원정</span>
                      </div>
                      {game.is_mavs_game && game.away_team === 'Dallas Mavericks' && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs px-2 py-0">
                          Mavs
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-800">
                        {game.away_score || '-'}
                      </span>
                    </div>
                  </div>

                  {/* VS Divider */}
                  <div className="flex items-center justify-center py-1">
                    <div className="w-8 h-px bg-gray-300"></div>
                    <span className="px-2 text-xs font-bold text-gray-400">VS</span>
                    <div className="w-8 h-px bg-gray-300"></div>
                  </div>

                  {/* Home Team */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                      {getTeamLogo(game.home_team) ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white shadow-sm flex items-center justify-center">
                          <img
                            src={getTeamLogo(game.home_team)!}
                            alt={game.home_team}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }}
                          />
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-sm hidden">
                            <span className="text-white text-sm font-bold">
                              {game.home_team.split(' ').pop()?.charAt(0) || 'H'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-white text-sm font-bold">
                            {game.home_team.split(' ').pop()?.charAt(0) || 'H'}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold ${game.is_mavs_game && game.home_team === 'Dallas Mavericks'
                          ? 'text-blue-600'
                          : 'text-gray-800'
                          }`}>
                          {formatTeamName(game.home_team)}
                        </span>
                        <span className="text-xs text-gray-500">홈</span>
                      </div>
                      {game.is_mavs_game && game.home_team === 'Dallas Mavericks' && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs px-2 py-0">
                          Mavs
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-800">
                        {game.home_score || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Broadcast Info */}
              {game.broadcast.length > 0 && (
                <div className="px-4 pb-3 pt-2 border-t border-gray-200/50 bg-white/50">
                  <div className="flex items-center space-x-1">
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {game.broadcast.join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {games.length === 0 && !loading && (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">오늘 예정된 경기가 없습니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
