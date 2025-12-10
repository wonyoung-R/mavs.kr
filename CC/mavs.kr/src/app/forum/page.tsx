'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Heart, Share, TrendingUp, Clock, MapPin, Tag } from 'lucide-react';
import { SNSNewsCard } from '@/components/forum/SNSNewsCard';

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  likes: number;
  comments: number;
  category: 'free' | 'news' | 'market' | 'sharing' | 'meetup';
  isHot?: boolean;
  price?: number; // For market
  location?: string; // For meetup or market
  snsUrl?: string; // For news
}

const CATEGORIES = [
  { id: 'all', name: '전체', icon: '🔥' },
  { id: 'free', name: '자유게시판', icon: '🗣️' },
  { id: 'news', name: 'MAVS NEWS', icon: '📰' },
  { id: 'market', name: '중고장터', icon: '🛒' },
  { id: 'sharing', name: '나눔', icon: '🎁' },
  { id: 'meetup', name: '오프모임', icon: '🍺' },
];

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
      category: 'free',
      isHot: true
    },
    {
      id: '2',
      title: '댈러스 매버릭스 공식 트윗',
      content: '오늘 경기 승리 소식입니다!',
      author: 'MavsOfficial',
      createdAt: '4시간 전',
      likes: 342,
      comments: 45,
      category: 'news',
      snsUrl: 'https://twitter.com/dallasmavs/status/1789012345678901234'
    },
    {
      id: '3',
      title: '돈치치 하이라이트 영상',
      content: '어제 경기 정말 미쳤습니다..',
      author: 'HighlightKing',
      createdAt: '6시간 전',
      likes: 89,
      comments: 12,
      category: 'news',
      snsUrl: 'https://youtu.be/dQw4w9WgXcQ'
    },
    {
      id: '4',
      title: '[판매] 어빙 유니폼(L) 팝니다',
      content: '사이즈 미스로 판매합니다. 택 달린 새상품입니다.',
      author: 'Jerseyman',
      createdAt: '8시간 전',
      likes: 4,
      comments: 8,
      category: 'market',
      price: 120000
    },
    {
      id: '5',
      title: '[나눔] 22-23 시즌 스케줄표 나눔해요',
      content: '직관 갔다가 받아온건데 필요하신 분 드립니다.',
      author: 'KindFan',
      createdAt: '10시간 전',
      likes: 24,
      comments: 15,
      category: 'sharing'
    },
    {
      id: '6',
      title: '이번 주말 홍대입구역 벙개 하실 분?',
      content: '레이커스전 같이 보면서 응원해요!',
      author: 'SeoulMav',
      createdAt: '1일 전',
      likes: 15,
      comments: 32,
      category: 'meetup',
      location: '홍대입구역 3번 출구'
    }
  ];

  const categories = CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'all'
      ? posts.length
      : posts.filter(p => p.category === cat.id).length
  }));

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
                    className={`w-full justify-between ${selectedCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
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
                      placeholder={selectedCategory === 'news' ? "SNS 링크를 입력하세요 (Twitter, YouTube 등)" : "무엇을 공유하고 싶으신가요?"}
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
                              <span className="text-gray-500 text-sm">{post.createdAt}</span>
                              <span className={`text-sm px-2 py-0.5 rounded-full ${post.category === 'news' ? 'bg-blue-900/50 text-blue-300' :
                                post.category === 'market' ? 'bg-green-900/50 text-green-300' :
                                  post.category === 'meetup' ? 'bg-purple-900/50 text-purple-300' :
                                    'bg-gray-800 text-gray-400'
                                }`}>
                                {CATEGORIES.find(c => c.id === post.category)?.name}
                              </span>
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
                      <h3 className="text-xl font-bold text-white mb-3">{post.title}</h3>
                      <p className="text-gray-300 mb-4 whitespace-pre-wrap">{post.content}</p>

                      {/* Special Content based on Category */}
                      {post.category === 'news' && post.snsUrl && (
                        <SNSNewsCard url={post.snsUrl} />
                      )}

                      {(post.category === 'market' && post.price) && (
                        <div className="mb-4 flex items-center gap-2 text-green-400 font-bold text-lg">
                          <Tag className="w-5 h-5" />
                          {post.price.toLocaleString()}원
                        </div>
                      )}

                      {(post.category === 'meetup' && post.location) && (
                        <div className="mb-4 flex items-center gap-2 text-purple-400">
                          <MapPin className="w-4 h-4" />
                          {post.location}
                        </div>
                      )}

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
