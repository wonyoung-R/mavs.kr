'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { News, NewsSource } from '@/types/news';
import { getSourceColor } from '@/lib/utils/news-utils';

interface NewsCarouselProps {
  news?: News[];
}

export function NewsCarousel({ news }: NewsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Mock data for demonstration
  const mockNews: News[] = [
    {
      id: '1',
      title: 'Dončić, 시즌 10번째 트리플더블 달성 임박',
      titleKr: 'Dončić, 시즌 10번째 트리플더블 달성 임박',
      content: '4쿼터 클러치 타임에서 결정적인 활약을 펼치며 팀을 승리로 이끌고 있는 루카 돈치치가 시즌 10번째 트리플더블을 눈앞에 두고 있다.',
      contentKr: '4쿼터 클러치 타임에서 결정적인 활약을 펼치며 팀을 승리로 이끌고 있는 루카 돈치치가 시즌 10번째 트리플더블을 눈앞에 두고 있다.',
      summary: '루카 돈치치가 시즌 10번째 트리플더블을 달성할 것으로 예상됩니다.',
      source: NewsSource.ESPN,
      sourceUrl: 'https://espn.com/news/doncic-triple-double',
      author: 'Tim MacMahon',
      imageUrl: '/images/doncic-triple-double.jpg',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      crawledAt: new Date(),
      viewCount: 1200,
      tags: []
    },
    {
      id: '2',
      title: 'Kyrie Irving 부상 복귀 임박, 팀 훈련 합류',
      titleKr: 'Kyrie Irving 부상 복귀 임박, 팀 훈련 합류',
      content: '2경기 결장했던 카이리 어빙이 팀 훈련에 완전히 합류하며 곧 복귀할 것으로 예상된다.',
      contentKr: '2경기 결장했던 카이리 어빙이 팀 훈련에 완전히 합류하며 곧 복귀할 것으로 예상된다.',
      summary: '카이리 어빙이 부상에서 회복되어 곧 경기에 복귀할 예정입니다.',
      source: NewsSource.MAVS_MONEYBALL,
      sourceUrl: 'https://mavsmoneyball.com/news/irving-return',
      author: 'Doyle Rader',
      imageUrl: '/images/irving-practice.jpg',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      crawledAt: new Date(),
      viewCount: 856,
      tags: []
    },
    {
      id: '3',
      title: '트레이드 루머: Mavericks, 벤치 강화 움직임',
      titleKr: '트레이드 루머: Mavericks, 벤치 강화 움직임',
      content: '플레이오프를 앞두고 댈러스가 벤치 득점력 강화를 위해 여러 선수들과 트레이드 논의를 진행하고 있다는 소식이 전해졌다.',
      contentKr: '플레이오프를 앞두고 댈러스가 벤치 득점력 강화를 위해 여러 선수들과 트레이드 논의를 진행하고 있다는 소식이 전해졌다.',
      summary: '매버릭스가 플레이오프를 위해 벤치 강화를 모색하고 있습니다.',
      source: NewsSource.SMOKING_CUBAN,
      sourceUrl: 'https://smokingcuban.com/news/trade-rumors',
      author: 'Kirk Henderson',
      imageUrl: '/images/trade-rumors.jpg',
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      crawledAt: new Date(),
      viewCount: 2341,
      tags: []
    }
  ];

  const currentNews = news || mockNews;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % currentNews.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentNews.length]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % currentNews.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + currentNews.length) % currentNews.length);
  };

  // Note: This uses News type with different source enum, keeping separate function
  const getSourceColorClass = (source: string) => {
    switch (source) {
      case 'ESPN':
        return 'bg-red-600/20 text-red-400';
      case 'MAVS_MONEYBALL':
        return 'bg-blue-600/20 text-blue-400';
      case 'SMOKING_CUBAN':
        return 'bg-green-600/20 text-green-400';
      default:
        return 'bg-gray-600/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Featured News Carousel */}
      <div className="relative">
        <div className="overflow-hidden rounded-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-gradient-to-br from-gray-900/95 to-blue-900/95 border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 cursor-pointer group">
                <div className="aspect-video bg-gradient-to-br from-blue-900/50 to-gray-900/50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                  <div className="absolute bottom-4 left-4 z-20">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceColorClass(currentNews[currentIndex].source)}`}>
                        {currentNews[currentIndex].source}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(currentNews[currentIndex].publishedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {currentNews[currentIndex].titleKr}
                    </h3>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-gray-300 mb-4 line-clamp-3">
                    {currentNews[currentIndex].contentKr}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>{currentNews[currentIndex].viewCount.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>86</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span>324</span>
                      </span>
                    </div>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      자세히 보기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Dots indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {currentNews.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex ? 'bg-blue-500' : 'bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* News Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {currentNews.slice(1).map((article, index) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 cursor-pointer group">
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-t-lg mb-3"></div>
                <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceColorClass(article.source)}`}>
                    {article.source}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                  {article.titleKr}
                </h4>
                <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                  {article.contentKr}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{article.viewCount}</span>
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs">
                    읽기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
