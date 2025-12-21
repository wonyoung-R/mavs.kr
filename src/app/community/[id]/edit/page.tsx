import { prisma } from '@/lib/db/prisma';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import EditCommunityForm from './EditForm';

interface PageProps {
  params: {
    id: string;
  }
}

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export default async function CommunityEditPage({ params }: PageProps) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { author: true }
  });

  if (!post) {
    notFound();
  }

  // Auth check
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isAuthor = post.author.email === user.email;
  const isAdmin = ADMIN_EMAILS.includes(user.email || '');

  if (!isAuthor && !isAdmin) {
    redirect(`/community/${params.id}`);
  }

  return <EditCommunityForm post={post} />;
}

