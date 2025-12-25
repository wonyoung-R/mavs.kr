'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Clock, TrendingUp, Trash2, Edit } from 'lucide-react';
import DynamicJSXRenderer from '@/components/analysis/DynamicJSXRenderer';
import { deleteAnalysis } from '@/app/actions/analysis';
import { useAuth } from '@/contexts/AuthContext';
import MavericksLoading from '@/components/ui/MavericksLoading';

interface PageProps {
  params: Promise<{
    id: string;
  }>
}

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export default function AnalysisDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user, session, userRole } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string>('');

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/analysis/${id}`);
        if (!response.ok) {
          router.push('/analysis');
          return;
        }
        const data = await response.json();
        setPost(data);
      } catch (error) {
        console.error('Failed to fetch post:', error);
        router.push('/analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('정말로 이 분석글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteAnalysis(id, session?.access_token);
      router.push('/analysis');
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full min-h-screen flex items-center justify-center">
          <MavericksLoading fullScreen={false} />
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  // Check if user can edit/delete (author or admin)
  const canEdit = user ? (
    user.email === post.author.email ||
    userRole === 'admin' ||
    ADMIN_EMAILS.includes(user.email || '')
  ) : false;

  return (
    <div className="min-h-screen w-full bg-[#050510] relative text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#050510] to-[#050510]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-12">
        {/* Header Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/analysis">
            <Button variant="ghost" className="text-slate-400 hover:text-white pl-0 gap-2">
              <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
            </Button>
          </Link>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                onClick={handleDelete}
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 gap-2"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </Button>
            </div>
          )}
        </div>

        {/* Post Header */}
        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/20 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Analysis
            </span>
            <span className="text-slate-500 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300">
                {post.author.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="font-medium text-white">{post.author.username}</div>
                <div className="text-xs text-slate-500 capitalize">{post.author.role}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <span>조회 {post.viewCount}</span>
              <span>댓글 {post._count.comments}</span>
            </div>
          </div>
        </header>

        {/* Dynamic JSX Content */}
        <article className="mb-12">
          <DynamicJSXRenderer jsxCode={post.content} />
        </article>

        {/* Comments Section Placeholder */}
        <div className="border-t border-white/10 pt-12">
          <h3 className="text-xl font-bold mb-6">
            댓글 {post._count.comments}
          </h3>
          <div className="bg-slate-900/50 rounded-xl p-8 text-center text-slate-500 border border-white/5">
            댓글 기능 준비중입니다.
          </div>
        </div>
      </div>
    </div>
  );
}

