'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Heart, Share, TrendingUp, Clock, MapPin, Tag, ArrowLeft, Search } from 'lucide-react';
import { SNSNewsCard } from '@/components/forum/SNSNewsCard';
import Link from 'next/link';

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
    <div className="min-h-screen w-full bg-[#050510] relative flex flex-col">
      {/* Background (Consistent with NewHomePage) */}
      <div className="absolute inset-0 z-0 fixed">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Community
              </h1>
              <p className="text-slate-400">
                달라스 매버릭스 팬들과의 소통 공간
              </p>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="게시글 검색..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
            </div>
            <Link href="/forum/new">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
                글쓰기
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* 사이드바 */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">카테고리</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full justify-between h-auto py-3 ${selectedCategory === category.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                      : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <span className="flex items-center gap-3">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === category.id ? 'bg-white/20' : 'bg-slate-800'}`}>
                      {category.count}
                    </span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">인기 작성자</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3 group cursor-pointer">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 group-hover:border-blue-500/50 transition-colors">
                    <span className="text-blue-400 font-bold">M</span>
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-blue-400 transition-colors">MavsFan2024</p>
                    <p className="text-slate-500 text-sm">156 포스트</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 group cursor-pointer">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 group-hover:border-green-500/50 transition-colors">
                    <span className="text-green-400 font-bold">H</span>
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-green-400 transition-colors">MavsHistory</p>
                    <p className="text-slate-500 text-sm">89 포스트</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-3 space-y-6">
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 hover:border-blue-500/30 transition-all group overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-white/10">
                          <span className="text-slate-200 font-bold">
                            {post.author.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium group-hover:text-blue-400 transition-colors">{post.author}</p>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded border ${post.category === 'news' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' :
                              post.category === 'market' ? 'bg-green-500/10 border-green-500/20 text-green-300' :
                                post.category === 'meetup' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' :
                                  'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                              {CATEGORIES.find(c => c.id === post.category)?.name}
                            </span>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-500 text-xs">{post.createdAt}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {post.isHot && (
                        <span className="flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/20 animate-pulse">
                          <TrendingUp className="w-3 h-3" />
                          HOT
                        </span>
                      )}
                    </div>

                    <Link href={`/forum/${post.id}`}>
                      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">{post.title}</h3>
                      <p className="text-slate-300 mb-6 line-clamp-2 leading-relaxed">{post.content}</p>
                    </Link>

                    {/* Special Content based on Category */}
                    {post.category === 'news' && post.snsUrl && (
                      <div className="mb-6">
                        <SNSNewsCard url={post.snsUrl} />
                      </div>
                    )}

                    {(post.category === 'market' && post.price) && (
                      <div className="mb-6 flex items-center gap-2 text-green-400 font-bold text-lg bg-green-500/10 p-3 rounded-lg border border-green-500/20 w-fit">
                        <Tag className="w-5 h-5" />
                        {post.price.toLocaleString()}원
                      </div>
                    )}

                    {(post.category === 'meetup' && post.location) && (
                      <div className="mb-6 flex items-center gap-2 text-purple-400 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20 w-fit">
                        <MapPin className="w-4 h-4" />
                        {post.location}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center space-x-6">
                        {/* Like Button */}
                        <button className="flex items-center space-x-2 text-slate-400 hover:text-red-400 transition group/action">
                          <div className="p-1.5 rounded-full group-hover/action:bg-red-500/10 transition-colors">
                            <Heart className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium">{post.likes}</span>
                        </button>
                        {/* Comment Button */}
                        <button className="flex items-center space-x-2 text-slate-400 hover:text-blue-400 transition group/action">
                          <div className="p-1.5 rounded-full group-hover/action:bg-blue-500/10 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium">{post.comments}</span>
                        </button>
                        {/* Share Button */}
                        <button className="flex items-center space-x-2 text-slate-400 hover:text-green-400 transition group/action">
                          <div className="p-1.5 rounded-full group-hover/action:bg-green-500/10 transition-colors">
                            <Share className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium">공유</span>
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Pagination / More */}
            <div className="flex justify-center pt-8">
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white px-8">
                더보기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
