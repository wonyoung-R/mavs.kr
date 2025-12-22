'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  RefreshCw, 
  ExternalLink, 
  Languages, 
  X, 
  Clock, 
  User,
  Eye,
  ChevronRight
} from 'lucide-react';
import MavericksLoading from '@/components/ui/MavericksLoading';

interface NewsArticle {
  id: string;
  title: string;
  titleKr: string | null;
  content: string;
  contentKr: string | null;
  source: string;
  sourceUrl: string;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string;
  viewCount: number;
  isTranslated: boolean;
}

type SourceFilter = 'all' | 'ESPN' | 'MAVS_MONEYBALL' | 'SMOKING_CUBAN';

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: '전체',
  ESPN: 'ESPN',
  MAVS_MONEYBALL: 'Mavs Moneyball',
  SMOKING_CUBAN: 'The Smoking Cuban',
};

export function NewsView() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [showKorean, setShowKorean] = useState(true);
  const [translating, setTranslating] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async (source?: SourceFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (source && source !== 'all') {
        params.set('source', source);
      }
      
      const response = await fetch(`/api/news?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFromSource = async (source: 'espn') => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/news/${source}`);
      const data = await response.json();
      console.log(`Fetched from ${source}:`, data);
      await fetchNews(sourceFilter);
    } catch (error) {
      console.error(`Failed to fetch from ${source}:`, error);
    } finally {
      setRefreshing(false);
    }
  };

  const translateArticle = async (id: string) => {
    setTranslating(id);
    try {
      const response = await fetch(`/api/news/${id}/translate`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        // Update article in list
        setArticles(prev => prev.map(a => 
          a.id === id ? { ...a, titleKr: data.titleKr, isTranslated: true } : a
        ));
        
        // Update selected article if it's the same
        if (selectedArticle?.id === id) {
          // Refetch full article details
          const detailRes = await fetch(`/api/news/${id}`);
          const detailData = await detailRes.json();
          if (detailData.success) {
            setSelectedArticle(detailData.article);
          }
        }
      } else {
        alert(`번역 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('Translation failed:', error);
      alert('번역 중 오류가 발생했습니다.');
    } finally {
      setTranslating(null);
    }
  };

  const openArticleDetail = async (article: NewsArticle) => {
    try {
      const response = await fetch(`/api/news/${article.id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedArticle(data.article);
      } else {
        setSelectedArticle(article);
      }
    } catch {
      setSelectedArticle(article);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    if (sourceFilter !== 'all') {
      fetchNews(sourceFilter);
    }
  }, [sourceFilter, fetchNews]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getDisplayTitle = (article: NewsArticle) => {
    return showKorean && article.titleKr ? article.titleKr : article.title;
  };

  const getDisplayContent = (article: NewsArticle) => {
    return showKorean && article.contentKr ? article.contentKr : article.content;
  };

  if (loading && articles.length === 0) {
    return (
      <div className="w-full min-h-[calc(100vh-200px)] flex items-center justify-center">
        <MavericksLoading fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          📰 매버릭스 뉴스
          <span className="text-sm font-normal text-slate-400">
            ({articles.length}개)
          </span>
        </h1>
        
        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setShowKorean(!showKorean)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showKorean 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Languages className="w-4 h-4" />
            {showKorean ? '한국어' : 'English'}
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={() => fetchFromSource('espn')}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* Translation Notice Banner */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Languages className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-sm text-blue-200">
            <span className="font-semibold">📢 안내:</span> 번역서비스 곧 추가하겠습니다
          </p>
        </div>
      </div>
      
      {/* Source Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-white/10">
        {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map((source) => (
          <button
            key={source}
            onClick={() => setSourceFilter(source)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              sourceFilter === source
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {SOURCE_LABELS[source]}
          </button>
        ))}
      </div>
      
      {/* News Grid */}
      {articles.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-xl mb-2">뉴스가 없습니다</p>
          <p className="text-sm">새로고침 버튼을 눌러 최신 뉴스를 가져오세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, index) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group bg-slate-900/50 rounded-xl overflow-hidden border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer"
              onClick={() => openArticleDetail(article)}
            >
              {/* Thumbnail */}
              {article.imageUrl && (
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  
                  {/* Source Badge */}
                  <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs font-medium text-white">
                    {article.source.replace('_', ' ')}
                  </span>
                  
                  {/* Translation Status */}
                  {!article.isTranslated && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded bg-yellow-500/80 text-xs font-medium text-black">
                      미번역
                    </span>
                  )}
                </div>
              )}
              
              {/* Content */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                  {getDisplayTitle(article)}
                </h3>
                
                <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                  {getDisplayContent(article)?.substring(0, 150)}...
                </p>
                
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(article.publishedAt)}
                    </span>
                    {article.author && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {article.author}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
      
      {/* Article Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedArticle(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-900/95 backdrop-blur border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-medium">
                    {selectedArticle.source.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {selectedArticle.viewCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Translate Button */}
                  {!selectedArticle.isTranslated && (
                    <button
                      onClick={() => translateArticle(selectedArticle.id)}
                      disabled={translating === selectedArticle.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Languages className={`w-4 h-4 ${translating === selectedArticle.id ? 'animate-pulse' : ''}`} />
                      {translating === selectedArticle.id ? '번역 중...' : '번역하기'}
                    </button>
                  )}
                  
                  {/* Original Link */}
                  <a
                    href={selectedArticle.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    원문
                  </a>
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
                {/* Image */}
                {selectedArticle.imageUrl && (
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-6">
                    <Image
                      src={selectedArticle.imageUrl}
                      alt={selectedArticle.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                
                {/* Title */}
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {getDisplayTitle(selectedArticle)}
                </h2>
                
                {/* Show both titles if translated */}
                {selectedArticle.titleKr && showKorean && (
                  <p className="text-slate-500 text-sm mb-4 italic">
                    원제: {selectedArticle.title}
                  </p>
                )}
                
                {/* Meta */}
                <div className="flex items-center gap-4 text-sm text-slate-400 mb-6 pb-4 border-b border-white/10">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(selectedArticle.publishedAt)}
                  </span>
                  {selectedArticle.author && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {selectedArticle.author}
                    </span>
                  )}
                </div>
                
                {/* Content */}
                <div className="prose prose-invert prose-lg max-w-none">
                  <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {getDisplayContent(selectedArticle)}
                  </div>
                  
                  {/* Show original content if showing Korean */}
                  {selectedArticle.contentKr && showKorean && (
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <h4 className="text-lg font-semibold text-slate-400 mb-4">
                        📝 원문 (Original)
                      </h4>
                      <div className="text-slate-500 leading-relaxed whitespace-pre-wrap text-base">
                        {selectedArticle.content}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
