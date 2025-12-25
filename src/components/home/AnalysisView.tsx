'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Eye, MessageCircle, Plus, ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { WritePostForm } from './WritePostForm';
import ColumnContentRenderer from '@/components/column/ColumnContentRenderer';
import { deleteAnalysis } from '@/app/actions/analysis';

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  category: 'ANALYSIS';
  viewCount: number;
  author: {
    username: string;
    image: string | null;
    role: string;
    email: string;
  };
  _count: {
    comments: number;
    votes: number;
  };
}

export function AnalysisView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWriteMode, setIsWriteMode] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editPost, setEditPost] = useState<any>(null);
  const { user, userRole, session } = useAuth();

  const canWrite = userRole === 'admin' || userRole === 'columnist';

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/analysis/list');
      const data = await response.json();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to fetch analysis posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (post: Post) => {
    setEditPost({
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
    });
    setIsWriteMode(true);
    setSelectedPost(null);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteAnalysis(postId, session?.access_token);
      setSelectedPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  const canEditPost = (post: Post) => {
    if (!user) return false;
    return user.email === post.author.email || userRole === 'admin';
  };

  const renderContent = () => {
    // Check if user is logged in
    if (!loading && !user) {
      return (
        <motion.div
          key="login-required"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center min-h-[400px]"
        >
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl max-w-md w-full p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">로그인이 필요합니다</h3>
              <p className="text-slate-400">
                분석글을 읽으려면 로그인이 필요합니다.
              </p>
            </div>
            <Link href="/login?redirect=/?tab=analysis">
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                로그인하기
              </Button>
            </Link>
          </div>
        </motion.div>
      );
    }

    // Write mode
    if (isWriteMode) {
      return (
        <motion.div
          key="write"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <WritePostForm
            session={session}
            editPost={editPost}
            onCancel={() => {
              setIsWriteMode(false);
              setEditPost(null);
            }}
            onSuccess={() => {
              setIsWriteMode(false);
              setEditPost(null);
              fetchPosts();
            }}
          />
        </motion.div>
      );
    }

    // Detail view
    if (selectedPost) {
      return (
        <motion.div
          key="detail"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => setSelectedPost(null)}
            className="text-slate-400 hover:text-white -ml-2 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Button>

          {/* Post Header */}
          <div className="border-b border-white/10 pb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/20">
                Analysis
              </span>
              <span className="text-slate-500 text-sm">
                {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true, locale: ko })}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 mb-6">
              <h1 className="text-2xl md:text-4xl font-bold leading-tight text-white flex-1">
                {selectedPost.title}
              </h1>

              {canEditPost(selectedPost) && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(selectedPost)}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selectedPost.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300 overflow-hidden">
                  {selectedPost.author.image ? (
                    <img src={selectedPost.author.image} alt={selectedPost.author.username} className="w-full h-full object-cover" />
                  ) : (
                    selectedPost.author.username?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">{selectedPost.author.username}</div>
                  <div className="text-xs text-slate-500">애널리스트</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-5 h-5" />
                  <span className="text-sm">{selectedPost.viewCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{selectedPost._count.comments}</span>
                </div>
              </div>
            </div>
          </div>

          {/* JSX Content */}
          <div className="bg-slate-900/30 border border-white/10 rounded-xl p-6">
            {/* 모든 content를 ColumnContentRenderer로 처리 (JSX 블록 자동 추출) */}
            <ColumnContentRenderer htmlContent={selectedPost.content} />
          </div>
        </motion.div>
      );
    }

    // List view
    return (
      <motion.div
        key="list"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              Analysis
            </h2>
            <p className="text-slate-400">
              데이터 기반 심층 분석 및 시각화
            </p>
          </div>

          {canWrite && (
            <Button
              onClick={() => setIsWriteMode(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              글쓰기
            </Button>
          )}
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-900/50 border border-white/10 rounded-xl p-6 animate-pulse"
              >
                <div className="h-6 bg-slate-800 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-slate-800 rounded w-1/2"></div>
              </div>
            ))
          ) : posts.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-12 text-center">
              <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">아직 분석글이 없습니다.</p>
              {canWrite && (
                <Button
                  onClick={() => setIsWriteMode(true)}
                  variant="primary"
                  className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600"
                >
                  첫 글 작성하기
                </Button>
              )}
            </div>
          ) : (
            posts.map((post) => (
              <motion.div
                key={post.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedPost(post)}
                className="bg-slate-900/50 border border-white/10 hover:border-purple-500/50 rounded-xl p-6 transition-all hover:bg-slate-900/70 group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/20">
                        Analysis
                      </span>
                      <span className="text-slate-500 text-sm">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                      {post.title}
                    </h2>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold">
                          {post.author.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span>{post.author.username}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{post.viewCount}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{post._count.comments}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-slate-600 group-hover:text-purple-400 transition-colors">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence mode="wait">
      {renderContent()}
    </AnimatePresence>
  );
}

