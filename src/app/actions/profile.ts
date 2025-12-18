'use server';

import { prisma } from '@/lib/db/prisma';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData, accessToken?: string) {
    const nickname = formData.get('nickname') as string;

    if (!nickname?.trim()) {
        throw new Error('닉네임을 입력해주세요.');
    }

    if (nickname.trim().length > 20) {
        throw new Error('닉네임은 최대 20자까지 입력 가능합니다.');
    }

    // Get Supabase user
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
                    } catch {
                        // Ignore
                    }
                },
            },
        }
    );

    // Try token first, then fallback to cookies
    let user;
    if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (!error) user = data.user;
    }

    if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('로그인이 필요합니다.');
    }

    // Update user in Prisma database
    const dbUser = await prisma.user.findUnique({
        where: { email: user.email }
    });

    if (!dbUser) {
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    // Update nickname
    await prisma.user.update({
        where: { id: dbUser.id },
        data: {
            name: nickname.trim(),
            updatedAt: new Date(),
        }
    });

    revalidatePath('/profile');
    revalidatePath('/');

    return { success: true, nickname: nickname.trim() };
}

export async function getProfile(accessToken?: string) {
    // Get Supabase user
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
                    } catch {
                        // Ignore
                    }
                },
            },
        }
    );

    // Try token first, then fallback to cookies
    let user;
    if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (!error) user = data.user;
    }

    if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        return null;
    }

    // Get user from Prisma database
    const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: {
            name: true,
            username: true,
            email: true,
            role: true,
            image: true,
        }
    });

    return dbUser;
}

