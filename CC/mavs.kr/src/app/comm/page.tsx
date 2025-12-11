'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Heart, Share, TrendingUp, Clock, MapPin, Tag, ArrowLeft, Search } from 'lucide-react';
import { SNSNewsCard } from '@/components/forum/SNSNewsCard';
import Link from 'next/link';
import Masonry from 'react-masonry-css';

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



  const breakpointColumnsObj = {
    default: 3,
    1100: 2,
    700: 1
  };

  const getCardHeight = (id: string, category: string) => {
    // Deterministic random height based on ID for 'all' view visual interest
    if (selectedCategory !== 'all') return 'auto';
    const heights = ['auto', 'auto', 'auto']; // Can be customized for strict Pinterest look, but 'auto' with varied content length is safer
    return 'auto';
  };

  return (
    <div className="min-h-screen w-full bg-[#050510] relative flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 z-0 fixed">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="hover:bg-white/10 text-white p-2">
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
            <Link href="/comm/new?type=column">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
                글쓰기
              </Button>
            </Link>
          </div>
        </div>

        {/* Categories Tab */}
        <div className="flex overflow-x-auto pb-4 mb-8 gap-2 custom-scrollbar">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors border ${selectedCategory === category.id
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900/50 border-white/10 text-slate-400 hover:border-blue-500/50 hover:text-white'
                }`}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
              <span className="ml-1 text-xs opacity-60 bg-black/20 px-1.5 rounded-full">{category.count}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {selectedCategory === 'all' ? (
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {filteredPosts.map((post, index) => (
                <div key={post.id} className="mb-6">
                  <PostCard post={post} />
                </div>
              ))}
            </Masonry>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {filteredPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

      </div>

      <style jsx global>{`
        .my-masonry-grid {
          display: flex;
          margin-left: -24px; /* gutter size offset */
          width: auto;
        }
        .my-masonry-grid_column {
          padding-left: 24px; /* gutter size */
          background-clip: padding-box;
        }
      `}</style>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full"
    >
      <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10 hover:border-blue-500/30 transition-all group overflow-hidden h-full flex flex-col">
        <CardContent className="p-5 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">
                {post.author.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{post.author}</span>
                <span className="text-[10px] text-slate-500">{post.createdAt}</span>
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] border ${post.category === 'market' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
              post.category === 'meetup' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
              {CATEGORIES.find(c => c.id === post.category)?.name}
            </div>
          </div>

          {/* Content */}
          <Link href={`/comm/${post.id}`} className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-blue-300 transition-colors">{post.title}</h3>
            <p className="text-slate-400 text-sm line-clamp-3 mb-4">{post.content}</p>

            {/* Special Content Previews */}
            {post.category === 'market' && post.price && (
              <div className="mb-4 text-green-400 font-bold text-sm bg-green-900/20 px-3 py-1.5 rounded-lg w-fit">
                ₩ {post.price.toLocaleString()}
              </div>
            )}
            {post.category === 'meetup' && post.location && (
              <div className="mb-4 text-purple-400 text-xs bg-purple-900/20 px-3 py-1.5 rounded-lg w-fit flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {post.location}
              </div>
            )}
          </Link>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
            <div className="flex items-center gap-4 text-slate-500 text-xs font-medium">
              <span className="flex items-center gap-1 hover:text-red-400 transition-colors cursor-pointer">
                <Heart className="w-3.5 h-3.5" /> {post.likes}
              </span>
              <span className="flex items-center gap-1 hover:text-blue-400 transition-colors cursor-pointer">
                <MessageCircle className="w-3.5 h-3.5" /> {post.comments}
              </span>
            </div>
            {post.category === 'market' && (
              <button className="text-xs flex items-center gap-1 text-slate-400 hover:text-yellow-400 transition-colors">
                <Heart className="w-3.5 h-3.5" /> 찜하기
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
