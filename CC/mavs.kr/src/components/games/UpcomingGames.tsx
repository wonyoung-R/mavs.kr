'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Game, GameStatus } from '@/types/game';
import { getGameTimeStatus } from '@/lib/utils/date';

interface UpcomingGamesProps {
  games?: Game[];
}

export function UpcomingGames({ games }: UpcomingGamesProps) {
  // Mock data for demonstration
  const mockGames: Game[] = [
    {
      id: '1',
      gameId: '20240112-DAL-GSW',
      homeTeam: 'Dallas Mavericks',
      awayTeam: 'Golden State Warriors',
      homeScore: undefined,
      awayScore: undefined,
      status: GameStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      quarter: undefined,
      timeRemaining: undefined,
      broadcasts: ['ESPN', 'NBA TV'],
      stats: undefined,
      highlights: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      gameId: '20240114-DAL-DEN',
      homeTeam: 'Denver Nuggets',
      awayTeam: 'Dallas Mavericks',
      homeScore: undefined,
      awayScore: undefined,
      status: GameStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      quarter: undefined,
      timeRemaining: undefined,
      broadcasts: ['TNT'],
      stats: undefined,
      highlights: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      gameId: '20240116-DAL-LAL',
      homeTeam: 'Dallas Mavericks',
      awayTeam: 'Los Angeles Lakers',
      homeScore: undefined,
      awayScore: undefined,
      status: GameStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
      quarter: undefined,
      timeRemaining: undefined,
      broadcasts: ['ESPN'],
      stats: undefined,
      highlights: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const upcomingGames = games || mockGames;

  const formatGameTime = (date: Date) => {
    const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanTime.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    });
  };

  const getOpponentLogo = (teamName: string) => {
    // Mock team logos - in real app, these would be actual team logos
    const logos: { [key: string]: string } = {
      'Golden State Warriors': 'GSW',
      'Denver Nuggets': 'DEN',
      'Los Angeles Lakers': 'LAL',
      'Dallas Mavericks': 'DAL'
    };
    return logos[teamName] || 'NBA';
  };

  const getBroadcastIcon = (broadcast: string) => {
    switch (broadcast) {
      case 'ESPN':
        return '📺';
      case 'TNT':
        return '🎬';
      case 'NBA TV':
        return '🏀';
      default:
        return '📡';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/50 to-blue-900/50 border-blue-500/20">
      <CardHeader>
        <CardTitle className="text-blue-400 flex items-center space-x-2">
          <span className="text-xl">📅</span>
          <span>다음 경기 일정</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingGames.map((game, index) => {
          const isHome = game.homeTeam === 'Dallas Mavericks';
          const opponent = isHome ? game.awayTeam : game.homeTeam;
          const gameStatus = getGameTimeStatus(game.scheduledAt, game.status);

          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, x: 5 }}
              className="cursor-pointer"
            >
              <div className="bg-gray-800/50 hover:bg-gray-800/70 rounded-lg p-4 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatGameTime(game.scheduledAt)}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      isHome
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-gray-600/20 text-gray-400'
                    }`}>
                      {isHome ? '홈' : '원정'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {game.broadcasts.map((broadcast, idx) => (
                      <span key={idx} className="text-xs" title={broadcast}>
                        {getBroadcastIcon(broadcast)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {getOpponentLogo(opponent)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {isHome ? 'vs' : '@'} {opponent.split(' ').pop()}
                      </p>
                      <p className="text-sm text-gray-400">
                        {opponent}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400">{gameStatus}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Button size="sm" variant="outline" className="text-xs">
                        예측하기
                      </Button>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        <div className="pt-4 border-t border-gray-800">
          <Button
            variant="outline"
            className="w-full text-sm border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
          >
            전체 일정 보기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
