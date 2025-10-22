'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, MapPin, Trophy, Users, TrendingUp } from 'lucide-react';

interface Game {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: 'upcoming' | 'live' | 'finished';
  venue: string;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'live' | 'finished'>('upcoming');

  useEffect(() => {
    // 더미 데이터 (실제로는 API에서 가져옴)
    setGames([
      {
        id: '1',
        date: '2024-01-12',
        time: '11:30',
        homeTeam: 'Dallas Mavericks',
        awayTeam: 'Golden State Warriors',
        status: 'upcoming',
        venue: 'American Airlines Center'
      },
      {
        id: '2',
        date: '2024-01-10',
        time: '10:00',
        homeTeam: 'Denver Nuggets',
        awayTeam: 'Dallas Mavericks',
        homeScore: 112,
        awayScore: 108,
        status: 'finished',
        venue: 'Ball Arena'
      },
      {
        id: '3',
        date: '2024-01-08',
        time: '09:30',
        homeTeam: 'Dallas Mavericks',
        awayTeam: 'Los Angeles Lakers',
        homeScore: 102,
        awayScore: 98,
        status: 'finished',
        venue: 'American Airlines Center'
      }
    ]);
  }, []);

  const filteredGames = games.filter(game => game.status === selectedTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 pt-24">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            🏀 경기 일정
          </h1>
          <p className="text-xl text-gray-300">
            달라스 매버릭스의 경기 일정과 결과를 확인하세요
          </p>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 rounded-lg p-1">
            <Button
              onClick={() => setSelectedTab('upcoming')}
              className={`px-6 py-2 rounded-md transition ${
                selectedTab === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4 mr-2" />
              예정된 경기
            </Button>
            <Button
              onClick={() => setSelectedTab('live')}
              className={`px-6 py-2 rounded-md transition ${
                selectedTab === 'live'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="w-4 h-4 mr-2 bg-red-500 rounded-full animate-pulse"></div>
              라이브
            </Button>
            <Button
              onClick={() => setSelectedTab('finished')}
              className={`px-6 py-2 rounded-md transition ${
                selectedTab === 'finished'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4 mr-2" />
              경기 결과
            </Button>
          </div>
        </div>

        {/* 경기 목록 */}
        <div className="grid gap-6">
          {filteredGames.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-gray-900/50 border-gray-800 hover:border-blue-500/50 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-400">{game.date} {game.time}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-400">{game.venue}</span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 items-center">
                    {/* Away Team */}
                    <div className="text-center md:text-right">
                      <div className="flex flex-col md:flex-row items-center md:justify-end space-x-4">
                        <div>
                          <p className="text-gray-400 text-sm">Away</p>
                          <p className="text-xl font-bold text-white">{game.awayTeam}</p>
                        </div>
                        {game.homeScore !== undefined && (
                          <div className="text-3xl font-bold text-white">
                            {game.awayScore}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* VS */}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-400 mb-2">VS</div>
                      {game.status === 'upcoming' && (
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          경기 예고
                        </Button>
                      )}
                      {game.status === 'live' && (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-500 font-bold">LIVE</span>
                        </div>
                      )}
                      {game.status === 'finished' && (
                        <div className="text-sm text-gray-400">경기 종료</div>
                      )}
                    </div>

                    {/* Home Team */}
                    <div className="text-center md:text-left">
                      <div className="flex flex-col md:flex-row items-center md:justify-start space-x-4">
                        {game.homeScore !== undefined && (
                          <div className="text-3xl font-bold text-blue-400 order-2 md:order-1">
                            {game.homeScore}
                          </div>
                        )}
                        <div className="order-1 md:order-2">
                          <p className="text-gray-400 text-sm">Home</p>
                          <p className="text-xl font-bold text-white">{game.homeTeam}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 통계 섹션 */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">시즌 통계</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-900/50 to-gray-900/50 border-blue-500/20">
              <CardContent className="p-6 text-center">
                <Trophy className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white">29</div>
                <div className="text-sm text-gray-400">승</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-900/50 to-gray-900/50 border-red-500/20">
              <CardContent className="p-6 text-center">
                <div className="w-8 h-8 bg-red-400 rounded-full mx-auto mb-2"></div>
                <div className="text-3xl font-bold text-white">13</div>
                <div className="text-sm text-gray-400">패</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-900/50 to-gray-900/50 border-green-500/20">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white">69%</div>
                <div className="text-sm text-gray-400">승률</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-900/50 to-gray-900/50 border-purple-500/20">
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <div className="text-3xl font-bold text-white">3</div>
                <div className="text-sm text-gray-400">서부 순위</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
