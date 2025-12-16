'use server';

import { prisma } from '@/lib/db/prisma';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSupabaseEnv } from '@/lib/supabase-helpers';

const COMMUNITY_CATEGORIES = ['FREE', 'MARKET', 'MEETUP'];
const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export async function createCommunityPost(formData: FormData, accessToken?: string) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const category = (formData.get('category') as string)?.toUpperCase() || 'FREE';
    const price = formData.get('price') as string;
    const meetupLocation = formData.get('meetupLocation') as string;
    const meetupDate = formData.get('meetupDate') as string;
    const meetupPurpose = formData.get('meetupPurpose') as string;

    if (!title?.trim() || !content?.trim()) {
        throw new Error('제목과 내용을 입력해주세요.');
    }

    if (!COMMUNITY_CATEGORIES.includes(category)) {
        throw new Error('올바른 카테고리를 선택해주세요.');
    }

    // Supabase 설정 확인
    const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();
    if (!isConfigured) {
        throw new Error('로그인 기능이 설정되지 않았습니다. 관리자에게 문의하세요.');
    }

    // Get user from Supabase
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

    // Try token first, then fallback to cookies (like column.ts does)
    let user;
    console.log('[Community Action] accessToken provided:', !!accessToken);
    
    if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        console.log('[Community Action] Token auth result:', error ? error.message : 'success');
        if (!error) user = data.user;
    }
    
    // Fallback to cookies if token didn't work
    if (!user) {
        console.log('[Community Action] Trying cookie auth...');
        const { data } = await supabase.auth.getUser();
        user = data.user;
        console.log('[Community Action] Cookie auth result:', user ? 'success' : 'failed');
    }

    if (!user || !user.email) {
        console.log('[Community Action] No user found, throwing error');
        throw new Error('로그인이 필요합니다.');
    }
    
    console.log('[Community Action] User authenticated:', user.email);

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
            }
        });
    }

    // Build post data
    const postData: any = {
        title,
        content,
        category: category as any, // Cast to avoid Prisma enum type issue
        authorId: dbUser.id,
    };

    // Market specific fields
    if (category === 'MARKET' && price) {
        postData.price = parseInt(price);
    }

    // Meetup specific fields
    if (category === 'MEETUP') {
        if (meetupLocation) postData.meetupLocation = meetupLocation;
        if (meetupDate) postData.meetupDate = new Date(meetupDate);
        if (meetupPurpose) postData.meetupPurpose = meetupPurpose;
    }

    const post = await prisma.post.create({
        data: postData
    });

    revalidatePath('/');
    revalidatePath('/community');

    return { success: true, postId: post.id };
}

export async function deleteCommunityPost(postId: string, accessToken?: string) {
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

    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { author: true }
    });

    if (!post) {
        throw new Error('게시글을 찾을 수 없습니다.');
    }

    // Check permission
    const isAuthor = post.author.email === user.email;
    const isAdmin = ADMIN_EMAILS.includes(user.email || '');

    if (!isAuthor && !isAdmin) {
        throw new Error('삭제 권한이 없습니다.');
    }

    await prisma.post.delete({
        where: { id: postId }
    });

    revalidatePath('/');
    revalidatePath('/community');

    return { success: true };
}

export async function toggleLike(postId: string, accessToken?: string) {
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

    const dbUser = await prisma.user.findUnique({
        where: { email: user.email }
    });

    if (!dbUser) {
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
        where: {
            userId_postId: {
                userId: dbUser.id,
                postId
            }
        }
    });

    if (existingLike) {
        // Unlike
        await prisma.like.delete({
            where: { id: existingLike.id }
        });
        return { liked: false };
    } else {
        // Like
        await prisma.like.create({
            data: {
                userId: dbUser.id,
                postId
            }
        });
        return { liked: true };
    }
}
