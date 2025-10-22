'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Game, GameStatus } from '@/types/game';

interface LiveGameTrackerProps {
  game?: Game;
}

export function LiveGameTracker({ game }: LiveGameTrackerProps) {
  const [isLive, setIsLive] = useState(true);
  const mockGame: Game = {
    id: '1',
    gameId: '20240111-DAL-LAL',
    homeTeam: 'Dallas Mavericks',
    awayTeam: 'Los Angeles Lakers',
    homeScore: 102,
    awayScore: 98,
    status: GameStatus.LIVE,
    scheduledAt: new Date(),
    quarter: 4,
    timeRemaining: '2:35',
    broadcasts: ['ESPN', 'NBA TV'],
    stats: {
      homeTeam: {
        points: 102,
        fieldGoals: { made: 38, attempted: 85, percentage: 44.7 },
        threePointers: { made: 12, attempted: 35, percentage: 34.3 },
        freeThrows: { made: 14, attempted: 18, percentage: 77.8 },
        rebounds: { offensive: 12, defensive: 28, total: 40 },
        assists: 25,
        steals: 8,
        blocks: 4,
        turnovers: 12,
        fouls: 18
      },
      awayTeam: {
        points: 98,
        fieldGoals: { made: 36, attempted: 82, percentage: 43.9 },
        threePointers: { made: 10, attempted: 32, percentage: 31.3 },
        freeThrows: { made: 16, attempted: 20, percentage: 80.0 },
        rebounds: { offensive: 8, defensive: 30, total: 38 },
        assists: 22,
        steals: 6,
        blocks: 3,
        turnovers: 15,
        fouls: 20
      },
      quarters: [
        { quarter: 1, homeScore: 28, awayScore: 25 },
        { quarter: 2, homeScore: 22, awayScore: 27 },
        { quarter: 3, homeScore: 25, awayScore: 23 },
        { quarter: 4, homeScore: 27, awayScore: 23 }
      ]
    },
    highlights: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const currentGame = game || mockGame;

  const getQuarterText = (quarter: number) => {
    if (quarter <= 4) return `Q${quarter}`;
    if (quarter === 5) return 'OT';
    return `OT${quarter - 4}`;
  };

  const getTimeStatus = () => {
    if (currentGame.status === 'LIVE') {
      return `${getQuarterText(currentGame.quarter!)} - ${currentGame.timeRemaining}`;
    }
    return '종료';
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-blue-900 border-blue-500/20">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-gray-500/5"></div>
      </div>

      <CardContent className="relative z-10 p-6 md:p-8">
        {/* Live indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <motion.div
              className="w-3 h-3 bg-red-500 rounded-full"
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-red-500 font-bold text-sm tracking-wide">LIVE NOW</span>
            <span className="text-gray-400 text-sm">Regular Season • Game 42</span>
          </div>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? '중계 보기' : '중계 종료'}
          </Button>
        </div>

        {/* Score display */}
        <div className="grid md:grid-cols-3 gap-6 items-center mb-8">
          {/* Away Team */}
          <motion.div
            className="text-center md:text-right"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex flex-col md:flex-row items-center md:justify-end space-x-4">
              <div>
                <p className="text-gray-400 text-sm">Los Angeles</p>
                <p className="text-2xl font-bold">Lakers</p>
                <p className="text-gray-500 text-sm mt-1">25-17</p>
              </div>
              <motion.div
                className="text-5xl font-bold text-white"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5 }}
              >
                {currentGame.awayScore}
              </motion.div>
            </div>
          </motion.div>

          {/* Game Info */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="text-sm text-gray-400 mb-2">{getTimeStatus()}</div>
            <div className="flex justify-center space-x-2 mb-4">
              {currentGame.stats?.quarters?.map((q, index) => (
                <motion.span
                  key={index}
                  className="px-2 py-1 bg-gray-800 rounded text-xs"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                >
                  Q{q.quarter}: {q.homeScore}-{q.awayScore}
                </motion.span>
              ))}
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              실시간 중계 보기
            </Button>
          </motion.div>

          {/* Home Team (Mavs) */}
          <motion.div
            className="text-center md:text-left"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex flex-col md:flex-row items-center md:justify-start space-x-4">
              <motion.div
                className="text-5xl font-bold text-blue-400"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5 }}
              >
                {currentGame.homeScore}
              </motion.div>
              <div>
                <p className="text-gray-400 text-sm">Dallas</p>
                <p className="text-2xl font-bold">Mavericks</p>
                <p className="text-gray-500 text-sm mt-1">29-13</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Key Players Stats */}
        <div className="pt-6 border-t border-gray-800">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">주요 선수</p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white font-bold">
                    L
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Luka Dončić</p>
                    <p className="text-sm text-gray-400">32pts • 8ast • 10reb</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-400">+15</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center text-white font-bold">
                    K
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Kyrie Irving</p>
                    <p className="text-sm text-gray-400">18pts • 5ast • 3reb</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-400">+8</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-3">경기 하이라이트</p>
              <div className="space-y-2">
                <p className="text-sm">🔥 Dončić 트리플더블 달성!</p>
                <p className="text-sm">⚡ Irving 클러치 3점슛</p>
                <p className="text-sm">🛡️ Lively II 블록킹 쇼</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live updates ticker */}
        <motion.div
          className="mt-6 pt-4 border-t border-gray-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span>실시간 업데이트: Dončić가 4쿼터 클러치 타임에서 결정적인 어시스트를 기록했습니다.</span>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
