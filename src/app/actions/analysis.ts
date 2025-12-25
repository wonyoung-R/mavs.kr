'use server';

import { prisma } from '@/lib/db/prisma';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

async function getUser(token?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

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

  let user;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error) user = data.user;
  } else {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  return user;
}

export async function createAnalysis(formData: FormData, token?: string) {
  const user = await getUser(token);

  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // Check if user is admin or columnist
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (!dbUser || !['ADMIN', 'COLUMNIST'].includes(dbUser.role)) {
    throw new Error('권한이 없습니다.');
  }

  const title = formData.get('title') as string;
  const jsxCode = formData.get('jsxCode') as string;
  const postId = formData.get('id') as string | null;

  if (!title || !jsxCode) {
    throw new Error('제목과 JSX 코드를 입력해주세요.');
  }

  // Update existing post
  if (postId) {
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true }
    });

    if (!existingPost) {
      throw new Error('Post not found');
    }

    // Check permission
    const isAdmin = ADMIN_EMAILS.includes(user.email!);
    const isAuthor = existingPost.author.email === user.email;

    if (!isAdmin && !isAuthor) {
      throw new Error('You do not have permission to edit this post');
    }

    await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        content: jsxCode,
      },
    });

    revalidatePath('/analysis');
    revalidatePath(`/analysis/${postId}`);
    return { success: true, id: postId };
  }

  // Create new post
  const post = await prisma.post.create({
    data: {
      title,
      content: jsxCode, // Store JSX code in content field
      category: 'ANALYSIS',
      authorId: dbUser.id,
    },
  });

  revalidatePath('/analysis');
  revalidatePath('/?tab=column');
  return { success: true, id: post.id };
}

export async function updateAnalysis(id: string, formData: FormData, token?: string) {
  const user = await getUser(token);

  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });

  if (!post) {
    throw new Error('분석글을 찾을 수 없습니다.');
  }

  // Check if user is author or admin
  if (post.author.email !== user.email && !ADMIN_EMAILS.includes(user.email!)) {
    throw new Error('권한이 없습니다.');
  }

  const title = formData.get('title') as string;
  const jsxCode = formData.get('jsxCode') as string;

  await prisma.post.update({
    where: { id },
    data: {
      title,
      content: jsxCode,
    },
  });

  revalidatePath('/analysis');
  revalidatePath(`/analysis/${id}`);
  revalidatePath('/?tab=column');
  return { success: true };
}

export async function deleteAnalysis(id: string, token?: string) {
  const user = await getUser(token);

  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });

  if (!post) {
    throw new Error('분석글을 찾을 수 없습니다.');
  }

  // Check if user is author or admin
  if (post.author.email !== user.email && !ADMIN_EMAILS.includes(user.email!)) {
    throw new Error('권한이 없습니다.');
  }

  await prisma.post.delete({
    where: { id },
  });

  revalidatePath('/analysis');
  revalidatePath('/?tab=column');
  return { success: true };
}

