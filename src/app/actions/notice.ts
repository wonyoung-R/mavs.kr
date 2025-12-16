'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { getSupabaseEnv } from '@/lib/supabase-helpers';

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export async function createNotice(formData: FormData) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const isPinned = formData.get('isPinned') === 'true';

    if (!title?.trim() || !content?.trim()) {
        throw new Error('제목과 내용을 입력해주세요.');
    }

    // Supabase 설정 확인
    const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();
    if (!isConfigured) {
        throw new Error('로그인 기능이 설정되지 않았습니다.');
    }

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
    const user = data.user;

    if (!user || !user.email) {
        throw new Error('로그인이 필요합니다.');
    }

    // 슈퍼관리자만 공지사항 작성 가능
    if (!ADMIN_EMAILS.includes(user.email)) {
        throw new Error('공지사항은 관리자만 작성할 수 있습니다.');
    }

    // Find or create user in Prisma
    let dbUser = await prisma.user.findUnique({
        where: { email: user.email }
    });

    if (!dbUser) {
        dbUser = await prisma.user.create({
            data: {
                email: user.email,
                username: user.email.split('@')[0],
                name: user.user_metadata?.full_name || null,
                role: 'ADMIN',
            }
        });
    }

    const post = await prisma.post.create({
        data: {
            title,
            content,
            category: 'NOTICE',
            authorId: dbUser.id,
            isPinned,
        }
    });

    revalidatePath('/');
    revalidatePath('/community');
    revalidatePath('/admin');

    return { success: true, postId: post.id };
}

export async function deleteNotice(postId: string) {
    const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();
    if (!isConfigured) {
        throw new Error('로그인 기능이 설정되지 않았습니다.');
    }

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
    const user = data.user;

    if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
        throw new Error('권한이 없습니다.');
    }

    await prisma.post.delete({
        where: { id: postId }
    });

    revalidatePath('/');
    revalidatePath('/community');
    revalidatePath('/admin');

    return { success: true };
}
