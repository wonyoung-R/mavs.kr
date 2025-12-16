import { prisma } from '@/lib/db/prisma';
import { notFound } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Clock, Share, MapPin, Calendar, DollarSign } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import CommunityDeleteButton from '@/components/community/DeleteButton';
import LikeButton from '@/components/community/LikeButton';
import CommentSection from '@/components/community/CommentSection';

interface PageProps {
  params: Promise<{
    id: string;
  }>
}

const CATEGORY_LABELS: Record<string, { name: string; icon: string; color: string }> = {
    FREE: { name: '자유게시판', icon: '🗣️', color: 'bg-blue-600/20 text-blue-400 border-blue-500/20' },
    MARKET: { name: '중고장터', icon: '🛒', color: 'bg-green-600/20 text-green-400 border-green-500/20' },
    MEETUP: { name: '오프라인 모임', icon: '🍺', color: 'bg-purple-600/20 text-purple-400 border-purple-500/20' },
};

const MEETUP_PURPOSE_LABELS: Record<string, string> = {
    DRINK: '🍺 술 한잔',
    MEAL: '🍽️ 식사',
    THUNDER: '⚡ 번개 직관',
    EXERCISE: '🏀 운동',
    MEETING: '🤝 정모',
};

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export default async function CommunityDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  // Fetch post with comments
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          image: true,
          email: true,
        }
      },
      comments: {
        where: { parentId: null }, // Only top-level comments
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              image: true,
              email: true,
            }
          },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  image: true,
                  email: true,
                }
              }
            }
          }
        }
      },
      _count: {
        select: {
          comments: true,
          votes: true,
          likes: true,
        }
      }
    }
  });

  if (!post) {
    notFound();
  }

  // Get current user (안전하게 처리)
  let user = null;
  let canDelete = false;
  let hasLiked = false;

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

      // Check if user can delete
      canDelete = user ? (
        user.email === post.author.email ||
        ADMIN_EMAILS.includes(user.email || '')
      ) : false;

      // Check if user has liked
      if (user) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (dbUser) {
          const like = await prisma.like.findUnique({
            where: { userId_postId: { userId: dbUser.id, postId: post.id } }
          });
          hasLiked = !!like;
        }
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    // 인증 실패 시 계속 진행
  }

  const categoryInfo = CATEGORY_LABELS[post.category] || CATEGORY_LABELS.FREE;

  // Transform comments for the client component
  const transformedComments = post.comments.map(comment => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: {
      id: comment.author.id,
      username: comment.author.username,
      image: comment.author.image,
      email: comment.author.email || undefined,
    },
    replies: comment.replies.map(reply => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      author: {
        id: reply.author.id,
        username: reply.author.username,
        image: reply.author.image,
        email: reply.author.email || undefined,
      },
      replies: [],
    })),
  }));

  return (
    <div className="min-h-screen w-full bg-[#050510] relative text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-24">
        {/* Header Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/?tab=community">
            <Button variant="ghost" className="text-slate-400 hover:text-white pl-0 gap-2">
              <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
            </Button>
          </Link>
          {canDelete && <CommunityDeleteButton postId={post.id} />}
        </div>

        {/* Post Header */}
        <header className="mb-8 border-b border-white/10 pb-8">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${categoryInfo.color}`}>
              {categoryInfo.icon} {categoryInfo.name}
            </span>
            <span className="text-slate-500 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Market: Price Badge */}
          {post.category === 'MARKET' && post.price && (
            <div className="mb-6 inline-flex items-center gap-2 text-green-400 font-bold text-xl bg-green-900/30 px-4 py-2 rounded-xl border border-green-500/20">
              <DollarSign className="w-5 h-5" />
              ₩ {post.price.toLocaleString()}
            </div>
          )}

          {/* Meetup: Details */}
          {post.category === 'MEETUP' && (
            <div className="mb-6 flex flex-wrap gap-4">
              {post.meetupLocation && (
                <div className="inline-flex items-center gap-2 text-purple-400 bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20">
                  <MapPin className="w-4 h-4" />
                  {post.meetupLocation}
                </div>
              )}
              {post.meetupDate && (
                <div className="inline-flex items-center gap-2 text-purple-400 bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(post.meetupDate), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                </div>
              )}
              {post.meetupPurpose && (
                <div className="inline-flex items-center gap-2 text-purple-400 bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20">
                  {MEETUP_PURPOSE_LABELS[post.meetupPurpose] || post.meetupPurpose}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300">
                {post.author.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="font-medium text-white">{post.author.username}</div>
                <div className="text-xs text-slate-500">Member</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <LikeButton postId={post.id} initialLiked={hasLiked} initialCount={post._count.likes} />
              <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                <Share className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Post Content */}
        <article className="prose prose-invert prose-lg max-w-none mb-12">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>

        {/* Comments Section */}
        <CommentSection
          postId={post.id}
          initialComments={transformedComments}
          commentCount={post._count.comments}
        />
      </div>
    </div>
  );
}
