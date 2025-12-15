'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface TrendingPost {
  id: string;
  title: string;
  category: string;
  author: string;
  comments: number;
  votes: number;
  views: number;
  timeAgo: string;
  isHot: boolean;
  isPinned: boolean;
}

export function CommunityTrending() {
  const [activeTab, setActiveTab] = useState<'trending' | 'hot' | 'recent'>('trending');

  const trendingPosts: TrendingPost[] = [
    {
      id: '1',
      title: '돈치치 MVP 가능성 진지하게 논의해봅시다',
      category: '토론',
      author: 'MavsFan2024',
      comments: 156,
      votes: 89,
      views: 2341,
      timeAgo: '2시간 전',
      isHot: true,
      isPinned: false
    },
    {
      id: '2',
      title: '역대 Mavs 베스트5 라인업 투표',
      category: '투표',
      author: 'DirkForever',
      comments: 342,
      votes: 156,
      views: 4567,
      timeAgo: '4시간 전',
      isHot: true,
      isPinned: true
    },
    {
      id: '3',
      title: '오늘 경기 하이라이트 모음',
      category: '영상',
      author: 'HighlightKing',
      comments: 78,
      votes: 234,
      views: 1234,
      timeAgo: '6시간 전',
      isHot: false,
      isPinned: false
    },
    {
      id: '4',
      title: '어빙 복귀 소식에 대한 반응들',
      category: '뉴스',
      author: 'KyrieLover',
      comments: 92,
      votes: 67,
      views: 1890,
      timeAgo: '8시간 전',
      isHot: false,
      isPinned: false
    },
    {
      id: '5',
      title: '다음 경기 예측 게임 참여하세요!',
      category: '게임',
      author: 'PredictionMaster',
      comments: 45,
      votes: 123,
      views: 987,
      timeAgo: '12시간 전',
      isHot: false,
      isPinned: false
    }
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '토론':
        return 'bg-blue-600/20 text-blue-400';
      case '투표':
        return 'bg-green-600/20 text-green-400';
      case '영상':
        return 'bg-purple-600/20 text-purple-400';
      case '뉴스':
        return 'bg-orange-600/20 text-orange-400';
      case '게임':
        return 'bg-pink-600/20 text-pink-400';
      default:
        return 'bg-gray-600/20 text-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '토론':
        return '💬';
      case '투표':
        return '🗳️';
      case '영상':
        return '🎥';
      case '뉴스':
        return '📰';
      case '게임':
        return '🎮';
      default:
        return '📝';
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return 'text-red-500';
      case 1:
        return 'text-orange-500';
      case 2:
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/50 to-orange-900/50 border-orange-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-orange-400 flex items-center space-x-2">
            <span className="text-xl">🔥</span>
            <span>커뮤니티 인기글</span>
          </CardTitle>
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={activeTab === 'trending' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('trending')}
              className="text-xs"
            >
              트렌딩
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'hot' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('hot')}
              className="text-xs"
            >
              핫
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'recent' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('recent')}
              className="text-xs"
            >
              최신
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {trendingPosts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="cursor-pointer hover:bg-gray-800/50 -mx-2 px-2 py-3 rounded-lg transition-colors group"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <span className={`font-bold text-sm ${getRankColor(index)}`}>
                  {index + 1}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(post.category)}`}>
                    {getCategoryIcon(post.category)} {post.category}
                  </span>
                  {post.isPinned && (
                    <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs font-medium">
                      📌 고정
                    </span>
                  )}
                  {post.isHot && (
                    <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs font-medium">
                      🔥 핫
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors line-clamp-2 mb-2">
                  {post.title}
                </h4>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{post.author}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{post.comments}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span>{post.votes}</span>
                    </span>
                  </div>
                  <span>{post.timeAgo}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="pt-4 border-t border-gray-800">
          <Link href="/?tab=community" className="w-full">
            <Button
              variant="outline"
              className="w-full text-sm border-orange-500/20 text-orange-400 hover:bg-orange-500/10"
            >
              더 많은 게시글 보기
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
