'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';

interface PlayerStats {
  name: string;
  position: string;
  jerseyNumber: number;
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    fieldGoalPercentage: number;
    threePointPercentage: number;
    plusMinus: number;
  };
  imageUrl?: string;
  isLeader: boolean;
}

export function StatsDashboard() {
  const leaderStats: PlayerStats[] = [
    {
      name: 'Luka Dončić',
      position: 'Guard',
      jerseyNumber: 77,
      stats: {
        points: 32.4,
        rebounds: 8.5,
        assists: 8.8,
        fieldGoalPercentage: 45.7,
        threePointPercentage: 34.3,
        plusMinus: 15
      },
      isLeader: true
    },
    {
      name: 'Dereck Lively II',
      position: 'Center',
      jerseyNumber: 2,
      stats: {
        points: 8.9,
        rebounds: 7.8,
        assists: 1.1,
        fieldGoalPercentage: 74.7,
        threePointPercentage: 0,
        plusMinus: 8
      },
      isLeader: false
    },
    {
      name: 'Kyrie Irving',
      position: 'Guard',
      jerseyNumber: 11,
      stats: {
        points: 25.1,
        rebounds: 5.0,
        assists: 5.2,
        fieldGoalPercentage: 48.5,
        threePointPercentage: 41.1,
        plusMinus: 12
      },
      isLeader: false
    }
  ];

  const statCategories = [
    { key: 'points', label: '득점', unit: 'PPG', icon: '🏀' },
    { key: 'rebounds', label: '리바운드', unit: 'RPG', icon: '📊' },
    { key: 'assists', label: '어시스트', unit: 'APG', icon: '🎯' }
  ];

  const getStatColor = (value: number, category: string) => {
    if (category === 'points') {
      if (value >= 30) return 'text-red-400';
      if (value >= 20) return 'text-orange-400';
      return 'text-blue-400';
    }
    if (category === 'rebounds') {
      if (value >= 10) return 'text-green-400';
      if (value >= 7) return 'text-yellow-400';
      return 'text-blue-400';
    }
    if (category === 'assists') {
      if (value >= 8) return 'text-purple-400';
      if (value >= 5) return 'text-pink-400';
      return 'text-blue-400';
    }
    return 'text-blue-400';
  };

  const getGradientClass = (index: number) => {
    const gradients = [
      'from-blue-900/50 to-gray-900/50 border-blue-500/20',
      'from-green-900/50 to-gray-900/50 border-green-500/20',
      'from-purple-900/50 to-gray-900/50 border-purple-500/20'
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="space-y-6">
      {/* Team Leaders */}
      <div className="grid md:grid-cols-3 gap-6">
        {statCategories.map((category, index) => {
          const leader = leaderStats.find(player =>
            player.stats[category.key as keyof typeof player.stats] ===
            Math.max(...leaderStats.map(p => p.stats[category.key as keyof typeof p.stats]))
          );

          return (
            <motion.div
              key={category.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <Card className={`bg-gradient-to-br ${getGradientClass(index)} hover:border-opacity-40 transition-all duration-300`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1 flex items-center space-x-2">
                        <span>{category.icon}</span>
                        <span>{category.label} 리더</span>
                      </p>
                      <p className={`text-3xl font-bold ${getStatColor(leader?.stats[category.key as keyof typeof leader.stats] || 0, category.key)}`}>
                        {leader?.stats[category.key as keyof typeof leader.stats] || 0}
                      </p>
                      <p className="text-sm text-gray-400">{category.unit}</p>
                    </div>
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {leader?.jerseyNumber || '?'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-white">{leader?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-400">#{leader?.jerseyNumber} • {leader?.position}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <span className={`text-sm font-medium ${leader?.stats.plusMinus && leader.stats.plusMinus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {leader?.stats.plusMinus && leader.stats.plusMinus > 0 ? '+' : ''}{leader?.stats.plusMinus || 0}
                      </span>
                      <span className="text-xs text-gray-500">+/-</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Advanced Stats Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-br from-gray-900/50 to-blue-900/50 border-blue-500/20">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-white mb-6">선수 비교</h3>

            <div className="space-y-4">
              {leaderStats.map((player, index) => (
                <motion.div
                  key={player.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{player.name}</p>
                      <p className="text-sm text-gray-400">#{player.jerseyNumber} • {player.position}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-400">{player.stats.points}</p>
                      <p className="text-xs text-gray-500">PPG</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-400">{player.stats.rebounds}</p>
                      <p className="text-xs text-gray-500">RPG</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-purple-400">{player.stats.assists}</p>
                      <p className="text-xs text-gray-500">APG</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-yellow-400">{player.stats.fieldGoalPercentage}%</p>
                      <p className="text-xs text-gray-500">FG%</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${player.stats.plusMinus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {player.stats.plusMinus > 0 ? '+' : ''}{player.stats.plusMinus}
                      </p>
                      <p className="text-xs text-gray-500">+/-</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Team Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid md:grid-cols-2 gap-6"
      >
        <Card className="bg-gradient-to-br from-gray-900/50 to-green-900/50 border-green-500/20">
          <CardContent className="p-6">
            <h4 className="font-bold text-white mb-4">팀 공격 통계</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">평균 득점</span>
                <span className="text-white font-bold">118.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">필드골 성공률</span>
                <span className="text-white font-bold">47.3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">3점 성공률</span>
                <span className="text-white font-bold">36.8%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">자유투 성공률</span>
                <span className="text-white font-bold">78.5%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-900/50 to-blue-900/50 border-blue-500/20">
          <CardContent className="p-6">
            <h4 className="font-bold text-white mb-4">팀 수비 통계</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">평균 실점</span>
                <span className="text-white font-bold">112.8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">평균 리바운드</span>
                <span className="text-white font-bold">44.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">평균 스틸</span>
                <span className="text-white font-bold">7.8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">평균 블록</span>
                <span className="text-white font-bold">4.9</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

