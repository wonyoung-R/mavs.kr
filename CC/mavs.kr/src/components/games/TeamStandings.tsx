'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TeamStanding {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  winPercentage: number;
  gamesBehind: number;
  streak: string;
  isMavs: boolean;
}

export function TeamStandings() {
  const standings: TeamStanding[] = [
    {
      rank: 1,
      team: 'Oklahoma City Thunder',
      wins: 34,
      losses: 6,
      winPercentage: 0.850,
      gamesBehind: 0,
      streak: 'W3',
      isMavs: false
    },
    {
      rank: 2,
      team: 'Minnesota Timberwolves',
      wins: 32,
      losses: 8,
      winPercentage: 0.800,
      gamesBehind: 2,
      streak: 'W2',
      isMavs: false
    },
    {
      rank: 3,
      team: 'Dallas Mavericks',
      wins: 29,
      losses: 13,
      winPercentage: 0.690,
      gamesBehind: 5,
      streak: 'W1',
      isMavs: true
    },
    {
      rank: 4,
      team: 'Houston Rockets',
      wins: 27,
      losses: 13,
      winPercentage: 0.675,
      gamesBehind: 7,
      streak: 'L1',
      isMavs: false
    },
    {
      rank: 5,
      team: 'Denver Nuggets',
      wins: 26,
      losses: 14,
      winPercentage: 0.650,
      gamesBehind: 8,
      streak: 'W2',
      isMavs: false
    },
    {
      rank: 6,
      team: 'Phoenix Suns',
      wins: 25,
      losses: 15,
      winPercentage: 0.625,
      gamesBehind: 9,
      streak: 'L1',
      isMavs: false
    }
  ];

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) {
      return 'text-green-400 bg-green-600/20';
    } else if (streak.startsWith('L')) {
      return 'text-red-400 bg-red-600/20';
    }
    return 'text-gray-400 bg-gray-600/20';
  };

  const getRankColor = (rank: number) => {
    if (rank <= 3) return 'text-yellow-400';
    if (rank <= 6) return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/50 to-green-900/50 border-green-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-green-400 flex items-center space-x-2">
            <span className="text-xl">🏆</span>
            <span>서부 컨퍼런스 순위</span>
          </CardTitle>
          <Button size="sm" variant="outline" className="text-xs">
            전체
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {standings.map((team, index) => (
          <motion.div
            key={team.team}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center justify-between py-3 px-3 rounded-lg transition-all duration-200 ${
              team.isMavs
                ? 'bg-blue-600/20 border border-blue-500/30'
                : 'hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-bold w-6 ${getRankColor(team.rank)}`}>
                {team.rank}
              </span>
              <div className="flex-1">
                <p className={`font-medium ${team.isMavs ? 'text-blue-400' : 'text-white'}`}>
                  {team.team.split(' ').pop()}
                </p>
                <p className="text-xs text-gray-400">
                  {team.team}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-white">{team.wins}-{team.losses}</p>
                <p className="text-xs text-gray-500">W-L</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-white">
                  {(team.winPercentage * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">PCT</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-white">
                  {team.gamesBehind === 0 ? '—' : `${team.gamesBehind}GB`}
                </p>
                <p className="text-xs text-gray-500">GB</p>
              </div>
              <div className="text-center">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStreakColor(team.streak)}`}>
                  {team.streak}
                </span>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="pt-4 border-t border-gray-800">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div className="text-center">
              <p className="font-medium text-green-400">플레이오프 진출</p>
              <p>상위 6팀</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-yellow-400">플레이인 토너먼트</p>
              <p>7-10위</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

