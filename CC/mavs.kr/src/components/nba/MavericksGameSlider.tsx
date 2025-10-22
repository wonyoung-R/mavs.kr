'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Play,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

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

interface MavericksGamesData {
  all_games: MavericksGame[];
  latest_game: MavericksGame | null;
  next_game: MavericksGame | null;
  today_game: MavericksGame | null;
  recent_games: MavericksGame[];
  upcoming_games: MavericksGame[];
}

interface MavericksGamesResponse {
  success: boolean;
  message: string;
  data: MavericksGamesData;
  last_updated: string;
}

export function MavericksGameSlider() {
  const [gamesData, setGamesData] = useState<MavericksGamesData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGamesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/nba/mavericks-games?command=summary');
      const data: MavericksGamesResponse = await response.json();

      if (data.success) {
        setGamesData(data.data);
        // Set initial index to show the most relevant game
        if (data.data.today_game) {
          setCurrentIndex(data.data.all_games.findIndex(g => g.game_id === data.data.today_game!.game_id));
        } else if (data.data.latest_game) {
          setCurrentIndex(data.data.all_games.findIndex(g => g.game_id === data.data.latest_game!.game_id));
        }
      } else {
        setError(data.message || 'Failed to fetch games data');
      }
    } catch (err) {
      console.error('Error fetching Mavericks games:', err);
      setError('Failed to connect to NBA API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGamesData();
  }, []);

  const getStatusIcon = (game: MavericksGame) => {
    switch (game.status) {
      case 'live':
        return <Play className="w-5 h-5 text-red-500 animate-pulse" />;
      case 'finished':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'today':
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <Calendar className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (game: MavericksGame) => {
    switch (game.status) {
      case 'live':
        return `Q${game.period} - ${game.time_remaining}`;
      case 'finished':
        return game.result === 'W' ? '승리' : '패배';
      case 'today':
        return `오늘 ${game.game_time_kst}`;
      default:
        return `${game.game_date_kst} ${game.game_time_kst}`;
    }
  };

  const getStatusColor = (game: MavericksGame) => {
    switch (game.status) {
      case 'live':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'finished':
        return game.result === 'W' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200';
      case 'today':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTeamLogo = (teamName: string) => {
    const logoMap: { [key: string]: string } = {
      'Dallas Mavericks': '/images/logos/mavericks.png',
      'Los Angeles Lakers': '/images/logos/lakers.png',
      'Golden State Warriors': '/images/logos/warriors.png',
      'Denver Nuggets': '/images/logos/nuggets.png',
      'Phoenix Suns': '/images/logos/suns.png',
    };
    return logoMap[teamName] || null;
  };

  const formatScore = (score: number | null) => {
    return score !== null ? score.toString() : '-';
  };

  const nextGame = () => {
    if (!gamesData) return;
    setCurrentIndex((prev) => (prev + 1) % gamesData.all_games.length);
  };

  const prevGame = () => {
    if (!gamesData) return;
    setCurrentIndex((prev) => (prev - 1 + gamesData.all_games.length) % gamesData.all_games.length);
  };

  if (loading) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-blue-100">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">경기 데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error || !gamesData) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-red-100">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">경기 데이터를 불러올 수 없습니다</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchGamesData} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const currentGame = gamesData.all_games[currentIndex];
  if (!currentGame) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-blue-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Dallas Mavericks</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={prevGame}
            size="sm"
            variant="ghost"
            className="p-2 h-8 w-8 text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-500 min-w-[60px] text-center">
            {currentIndex + 1} / {gamesData.all_games.length}
          </span>
          <Button
            onClick={nextGame}
            size="sm"
            variant="ghost"
            className="p-2 h-8 w-8 text-gray-400 hover:text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Game Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentGame.game_id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Game Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(currentGame)}
              <Badge className={getStatusColor(currentGame)}>
                {getStatusText(currentGame)}
              </Badge>
            </div>
            <div className="text-sm text-gray-500">
              {currentGame.game_date_kst}
            </div>
          </div>

          {/* Teams and Score - Side by Side Layout */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Mavericks */}
            <div className="text-center">
              <div className="flex flex-col items-center space-y-2">
                {getTeamLogo('Dallas Mavericks') ? (
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-white shadow-lg flex items-center justify-center">
                    <img
                      src={getTeamLogo('Dallas Mavericks')!}
                      alt="Dallas Mavericks"
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling!.style.display = 'flex';
                      }}
                    />
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center hidden">
                      <span className="text-white font-bold text-xl">M</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl">M</span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-800 text-sm">Dallas</div>
                  <div className="font-bold text-gray-800 text-sm">Mavericks</div>
                  <div className="text-xs text-gray-500">{currentGame.is_home ? '홈' : '원정'}</div>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {formatScore(currentGame.mavs_score)}
                </div>
                {currentGame.result && (
                  <div className={`text-xs font-medium ${
                    currentGame.result === 'W' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {currentGame.result === 'W' ? '승' : '패'}
                  </div>
                )}
              </div>
            </div>

            {/* VS */}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400 mb-2">VS</div>
              <div className="text-xs text-gray-500">
                {currentGame.status === 'live' && currentGame.period && (
                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
                    Q{currentGame.period} - {currentGame.time_remaining}
                  </div>
                )}
                {currentGame.status === 'finished' && (
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    종료
                  </div>
                )}
                {currentGame.status === 'upcoming' && (
                  <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    예정
                  </div>
                )}
              </div>
            </div>

            {/* Opponent */}
            <div className="text-center">
              <div className="flex flex-col items-center space-y-2">
                {getTeamLogo(currentGame.opponent) ? (
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-white shadow-lg flex items-center justify-center">
                    <img
                      src={getTeamLogo(currentGame.opponent)!}
                      alt={currentGame.opponent}
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling!.style.display = 'flex';
                      }}
                    />
                    <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center hidden">
                      <span className="text-white font-bold text-xl">
                        {currentGame.opponent.split(' ').pop()?.charAt(0) || 'O'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl">
                      {currentGame.opponent.split(' ').pop()?.charAt(0) || 'O'}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {currentGame.opponent.split(' ').slice(0, -1).join(' ')}
                  </div>
                  <div className="font-bold text-gray-800 text-sm">
                    {currentGame.opponent.split(' ').pop()}
                  </div>
                  <div className="text-xs text-gray-500">{!currentGame.is_home ? '홈' : '원정'}</div>
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {formatScore(currentGame.opponent_score)}
                </div>
                {currentGame.result && (
                  <div className={`text-xs font-medium ${
                    currentGame.result === 'W' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {currentGame.result === 'W' ? '패' : '승'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Game Details */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{currentGame.venue}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{currentGame.game_time_kst}</span>
            </div>
          </div>

          {/* Broadcast Info */}
          {currentGame.broadcast && currentGame.broadcast.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                방송: {currentGame.broadcast.join(', ')}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Dots */}
      <div className="flex justify-center space-x-2 mt-6">
        {gamesData.all_games.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
