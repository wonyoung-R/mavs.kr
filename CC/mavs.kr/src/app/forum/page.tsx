'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Heart, Share, TrendingUp, Users, Star, Clock } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  likes: number;
  comments: number;
  category: string;
  isHot?: boolean;
}

export default function CommunityPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const posts: Post[] = [
    {
      id: '1',
      title: '돈치치 MVP 가능성 진지하게 논의해봅시다',
      content: '이번 시즌 돈치치의 활약이 정말 대단하네요. MVP 후보로 거론되고 있는데 여러분 생각은 어떠신가요?',
      author: 'MavsFan2024',
      createdAt: '2시간 전',
      likes: 156,
      comments: 23,
      category: '토론',
      isHot: true
    },
    {
      id: '2',
      title: '달라스 매버릭스의 미래 전망',
      content: '현재 로스터 구성과 향후 트레이드 가능성을 분석해보는 컬럼입니다. 여러분의 의견을 들려주세요!',
      author: 'MavsAnalyst',
      createdAt: '4시간 전',
      likes: 342,
      comments: 45,
      category: '컬럼'
    },
    {
      id: '3',
      title: '어제 경기 하이라이트 모음',
      content: 'Lakers전에서 돈치치의 클러치 플레이 모음입니다. 정말 환상적이었어요!',
      author: 'HighlightKing',
      createdAt: '6시간 전',
      likes: 89,
      comments: 12,
      category: '하이라이트'
    },
    {
      id: '4',
      title: '루카 돈치치의 클러치 타임 분석',
      content: '돈치치의 클러치 타임에서의 활약을 분석해보는 컬럼입니다. 통계와 함께 살펴보겠습니다.',
      author: 'StatsExpert',
      createdAt: '8시간 전',
      likes: 67,
      comments: 18,
      category: '컬럼'
    },
    {
      id: '5',
      title: '키리 어빙 부상 복귀 소식',
      content: '키리가 팀 훈련에 복귀했다는 소식이 들려왔습니다. 빨리 경기에서 봤으면 좋겠어요!',
      author: 'KyrieFan',
      createdAt: '10시간 전',
      likes: 134,
      comments: 28,
      category: '토론'
    }
  ];

  const categories = [
    { id: 'all', name: '전체', count: posts.length },
    { id: '토론', name: '토론', count: posts.filter(p => p.category === '토론').length },
    { id: '컬럼', name: '컬럼', count: posts.filter(p => p.category === '컬럼').length },
    { id: '하이라이트', name: '하이라이트', count: posts.filter(p => p.category === '하이라이트').length }
  ];

  const filteredPosts = selectedCategory === 'all'
    ? posts
    : posts.filter(post => post.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 pt-24">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            💬 커뮤니티
          </h1>
          <p className="text-xl text-gray-300">
            달라스 매버릭스 팬들과 함께 소통하세요
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* 사이드바 */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900/50 border-gray-800 mb-6">
              <CardHeader>
                <CardTitle className="text-white">카테고리</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full justify-between ${
                      selectedCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                      {category.count}
                    </span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">인기 작성자</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">M</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">MavsFan2024</p>
                    <p className="text-gray-400 text-sm">156 포스트</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">M</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">MavsHistory</p>
                    <p className="text-gray-400 text-sm">89 포스트</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">H</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">HighlightKing</p>
                    <p className="text-gray-400 text-sm">67 포스트</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-3">
            {/* 새 글 작성 */}
            <Card className="bg-gray-900/50 border-gray-800 mb-6">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">U</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="무엇을 공유하고 싶으신가요?"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    게시
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 게시글 목록 */}
            <div className="space-y-6">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {post.author.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{post.author}</p>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-500 text-sm">{post.createdAt}</span>
                              <span className="text-blue-400 text-sm">#{post.category}</span>
                              {post.isHot && (
                                <span className="flex items-center text-red-400 text-sm">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  HOT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-3">{post.title}</h3>
                      <p className="text-gray-300 mb-4">{post.content}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                          <button className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition">
                            <Heart className="w-5 h-5" />
                            <span>{post.likes}</span>
                          </button>
                          <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition">
                            <MessageCircle className="w-5 h-5" />
                            <span>{post.comments}</span>
                          </button>
                          <button className="flex items-center space-x-2 text-gray-400 hover:text-green-400 transition">
                            <Share className="w-5 h-5" />
                            <span>공유</span>
                          </button>
                        </div>
                        <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                          자세히 보기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* 더보기 버튼 */}
            <div className="text-center mt-8">
              <Button className="bg-gray-800 hover:bg-gray-700 text-white">
                더 많은 게시글 보기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
