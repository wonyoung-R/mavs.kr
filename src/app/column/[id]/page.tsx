import { prisma } from '@/lib/db/prisma';
import { notFound, redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Clock, Heart, MessageCircle } from 'lucide-react';
import ShareStoryButton from '@/components/ui/ShareStoryButton';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import DeleteButton from '@/components/column/DeleteButton';
import EditButton from '@/components/column/EditButton';
import ColumnContentRenderer from '@/components/column/ColumnContentRenderer';

interface PageProps {
  params: Promise<{
    id: string;
  }>
}

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export default async function ColumnDetailPage({ params }: PageProps) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          username: true,
          name: true,
          image: true,
          email: true,
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

  // Get current user - 컬럼은 로그인 필수
  let user = null;
  let canDelete = false;
  let canEdit = false;

  try {
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

    if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co') {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
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
        }
      );

      const { data } = await supabase.auth.getUser();
      user = data.user;

      // Check if user can delete or edit (author or admin)
      const hasPermission = user ? (
        user.email === post.author.email ||
        ADMIN_EMAILS.includes(user.email || '')
      ) : false;
      canDelete = hasPermission;
      canEdit = hasPermission;
    } else {
      // Supabase가 설정되지 않은 경우 (개발 모드)
      // 로그인 페이지로 리다이렉트
      redirect('/login?redirect=/column/' + id);
    }
  } catch (error) {
    console.error('Auth error:', error);
    // 인증 실패 시 로그인 페이지로 리다이렉트
    redirect('/login?redirect=/column/' + id);
  }

  return (
    <div className="min-h-screen w-full bg-[#050510] relative text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-24">
        {/* Header Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/?tab=column">
            <Button variant="ghost" className="text-slate-400 hover:text-white pl-0 gap-2">
              <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ShareStoryButton
              title={post.title}
              content={post.content}
              author={post.author.name || post.author.username || '익명'}
              category="컬럼"
              categoryIcon="📝"
              className="p-2 hover:bg-white/10 rounded-lg"
            />
            {canEdit && <EditButton postId={post.id} />}
            {canDelete && <DeleteButton postId={post.id} />}
          </div>
        </div>

        {/* Post Header */}
        <header className="mb-8 border-b border-white/10 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium border border-blue-500/20">
              Column
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
              {/* Author Avatar Placeholder */}
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300">
                {(post.author.name || post.author.username)?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="font-medium text-white">{post.author.name || post.author.username}</div>
                <div className="text-xs text-slate-500">Columnist</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <button className="flex items-center gap-1.5 hover:text-red-400 transition-colors">
                <Heart className="w-5 h-5" />
                <span>{post._count.votes}</span>
              </button>
              <ShareStoryButton
                title={post.title}
                content={post.content}
                author={post.author.name || post.author.username || '익명'}
                category="컬럼"
                categoryIcon="📝"
              />
            </div>
          </div>
        </header>

        {/* Post Content */}
        <article className="mb-12">
          <ColumnContentRenderer htmlContent={post.content} />
        </article>

        {/* Comments Section Placeholder */}
        <div className="border-t border-white/10 pt-12">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
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
