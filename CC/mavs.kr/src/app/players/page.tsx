'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
// import { Button } from '@/components/ui/Button';
import { Trophy, Target, Zap, Shield, TrendingUp, Users } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  nameKr: string;
  position: string;
  number: number;
  age: number;
  height: string;
  weight: string;
  stats: {
    points: number;
    assists: number;
    rebounds: number;
    steals: number;
    blocks: number;
  };
  image?: string;
}

export default function PlayersPage() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const players: Player[] = [
    {
      id: '1',
      name: 'Luka Dončić',
      nameKr: '루카 돈치치',
      position: 'Point Guard',
      number: 77,
      age: 25,
      height: '6\'7"',
      weight: '230 lbs',
      stats: {
        points: 32.4,
        assists: 8.8,
        rebounds: 8.2,
        steals: 1.4,
        blocks: 0.5
      }
    },
    {
      id: '2',
      name: 'Kyrie Irving',
      nameKr: '키리 어빙',
      position: 'Shooting Guard',
      number: 11,
      age: 32,
      height: '6\'2"',
      weight: '195 lbs',
      stats: {
        points: 25.1,
        assists: 5.2,
        rebounds: 5.0,
        steals: 1.3,
        blocks: 0.3
      }
    },
    {
      id: '3',
      name: 'Dereck Lively II',
      nameKr: '데렉 라이블리',
      position: 'Center',
      number: 2,
      age: 20,
      height: '7\'1"',
      weight: '230 lbs',
      stats: {
        points: 8.8,
        assists: 1.1,
        rebounds: 8.5,
        steals: 0.6,
        blocks: 1.4
      }
    },
    {
      id: '4',
      name: 'Tim Hardaway Jr.',
      nameKr: '팀 하더웨이 주니어',
      position: 'Small Forward',
      number: 10,
      age: 32,
      height: '6\'5"',
      weight: '205 lbs',
      stats: {
        points: 14.4,
        assists: 1.8,
        rebounds: 3.6,
        steals: 0.8,
        blocks: 0.2
      }
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 pt-24">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            👥 선수 정보
          </h1>
          <p className="text-xl text-gray-300">
            댈러스 매버릭스 선수들의 상세 정보와 통계를 확인하세요
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 선수 목록 */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-white mb-6">로스터</h2>
            <div className="space-y-4">
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className={`cursor-pointer transition-all ${selectedPlayer?.id === player.id
                        ? 'bg-blue-900/50 border-blue-500'
                        : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                      }`}
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">#{player.number}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white">{player.nameKr}</h3>
                          <p className="text-sm text-gray-400">{player.position}</p>
                          <p className="text-sm text-gray-500">{player.height} • {player.weight}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 선수 상세 정보 */}
          <div className="lg:col-span-2">
            {selectedPlayer ? (
              <motion.div
                key={selectedPlayer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-2xl">#{selectedPlayer.number}</span>
                      </div>
                      <div>
                        <CardTitle className="text-3xl text-white">{selectedPlayer.nameKr}</CardTitle>
                        <p className="text-gray-400">{selectedPlayer.name}</p>
                        <p className="text-gray-500">{selectedPlayer.position} • {selectedPlayer.age}세</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 기본 정보 */}
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4">기본 정보</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-gray-400 text-sm">키</p>
                          <p className="text-white font-bold">{selectedPlayer.height}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-gray-400 text-sm">몸무게</p>
                          <p className="text-white font-bold">{selectedPlayer.weight}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-gray-400 text-sm">나이</p>
                          <p className="text-white font-bold">{selectedPlayer.age}세</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-gray-400 text-sm">등번호</p>
                          <p className="text-white font-bold">#{selectedPlayer.number}</p>
                        </div>
                      </div>
                    </div>

                    {/* 통계 */}
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4">시즌 평균 통계</h3>
                      <div className="grid md:grid-cols-5 gap-4">
                        <div className="bg-gradient-to-br from-blue-900/50 to-gray-900/50 rounded-lg p-4 text-center">
                          <Target className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">{selectedPlayer.stats.points}</div>
                          <div className="text-sm text-gray-400">득점</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-900/50 to-gray-900/50 rounded-lg p-4 text-center">
                          <Zap className="w-6 h-6 text-green-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">{selectedPlayer.stats.assists}</div>
                          <div className="text-sm text-gray-400">어시스트</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-900/50 to-gray-900/50 rounded-lg p-4 text-center">
                          <Shield className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">{selectedPlayer.stats.rebounds}</div>
                          <div className="text-sm text-gray-400">리바운드</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-900/50 to-gray-900/50 rounded-lg p-4 text-center">
                          <TrendingUp className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">{selectedPlayer.stats.steals}</div>
                          <div className="text-sm text-gray-400">스틸</div>
                        </div>
                        <div className="bg-gradient-to-br from-red-900/50 to-gray-900/50 rounded-lg p-4 text-center">
                          <Trophy className="w-6 h-6 text-red-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-white">{selectedPlayer.stats.blocks}</div>
                          <div className="text-sm text-gray-400">블록</div>
                        </div>
                      </div>
                    </div>

                    {/* 하이라이트 */}
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4">최근 하이라이트</h3>
                      <div className="space-y-3">
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-white font-medium">시즌 최고 득점 경기</p>
                          <p className="text-gray-400 text-sm">vs Lakers - 45점, 12어시스트, 9리바운드</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-white font-medium">트리플더블 달성</p>
                          <p className="text-gray-400 text-sm">이번 시즌 9번째 트리플더블 달성</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">선수를 선택하세요</h3>
                  <p className="text-gray-400">왼쪽에서 선수를 선택하면 상세 정보를 확인할 수 있습니다.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
