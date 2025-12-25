import { prisma } from '@/lib/db/prisma';
import { notFound, redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Clock, TrendingUp, Trash2, Edit } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import DynamicJSXRenderer from '@/components/analysis/DynamicJSXRenderer';
import { deleteAnalysis } from '@/app/actions/analysis';

interface PageProps {
  params: Promise<{
    id: string;
  }>
}

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export default async function AnalysisDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Increment view count
  await prisma.post.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          username: true,
          image: true,
          email: true,
          role: true,
        }
      },
      _count: {
        select: {
          comments: true,
          votes: true,
        }
      }
    }
  });

  if (!post) {
    notFound();
  }

  // Get current user
  let user = null;
  let canEdit = false;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const cookieStore = await cookies();
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      });

      const { data } = await supabase.auth.getUser();
      user = data.user;

      // Check if user can edit/delete (author or admin)
      canEdit = user ? (
        user.email === post.author.email ||
        ADMIN_EMAILS.includes(user.email || '')
      ) : false;
    }
  } catch (error) {
    console.error('Auth error:', error);
  }

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
              <form action={deleteAnalysis.bind(null, post.id)}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </Button>
              </form>
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

