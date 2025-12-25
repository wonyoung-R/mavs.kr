import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Plus, TrendingUp, Eye, MessageCircle } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export default async function AnalysisPage() {
  const posts = await prisma.post.findMany({
    where: { category: 'ANALYSIS' },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          username: true,
          image: true,
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

  // Check if user can write (admin or columnist)
  let canWrite = false;
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
      if (data.user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: data.user.email! },
        });
        canWrite = dbUser ? ['ADMIN', 'COLUMNIST'].includes(dbUser.role) : false;
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
  }

  return (
    <div className="min-h-screen w-full bg-[#050510] relative flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#050510] to-[#050510]"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="md" className="hover:bg-white/10 text-white p-2 w-10">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-400" />
                Analysis
              </h1>
              <p className="text-slate-400">
                데이터 기반 심층 분석 및 시각화
              </p>
            </div>
          </div>

          {canWrite && (
            <Link href="/analysis/new">
              <Button
                variant="primary"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 gap-2"
              >
                <Plus className="w-5 h-5" />
                새 분석 작성
              </Button>
            </Link>
          )}
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-12 text-center">
              <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">아직 분석글이 없습니다.</p>
            </div>
          ) : (
            posts.map((post) => (
              <Link key={post.id} href={`/analysis/${post.id}`}>
                <div className="bg-slate-900/50 border border-white/10 hover:border-purple-500/50 rounded-xl p-6 transition-all hover:bg-slate-900/70 group">
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
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

