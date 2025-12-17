'use server';

import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { createServerActionClient } from '@/lib/supabase-helpers';

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export async function createNotice(formData: FormData, accessToken?: string) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const isPinned = formData.get('isPinned') === 'true';

    if (!title?.trim() || !content?.trim()) {
        throw new Error('제목과 내용을 입력해주세요.');
    }

    // Supabase 클라이언트 생성
    const supabase = await createServerActionClient();

    // Try token first, then fallback to cookies
    let user;
    console.log('🔐 [Notice Action] accessToken provided:', !!accessToken);

    if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        console.log('🔐 [Notice Action] Token auth result:', error ? error.message : 'success');
        if (!error) user = data.user;
    }

    // Fallback to cookies if token didn't work
    if (!user) {
        console.log('🔐 [Notice Action] Trying cookie auth...');
        const { data } = await supabase.auth.getUser();
        user = data.user;
        console.log('🔐 [Notice Action] Cookie auth result:', user ? 'success' : 'failed');
    }

    if (!user || !user.email) {
        console.log('❌ [Notice Action] No user found, throwing error');
        throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    console.log('✅ [Notice Action] User authenticated:', user.email);

    // 슈퍼관리자만 공지사항 작성 가능
    if (!ADMIN_EMAILS.includes(user.email)) {
        throw new Error('공지사항은 관리자만 작성할 수 있습니다.');
    }

    // Find or create user in Prisma
    let dbUser = await prisma.user.findUnique({
        where: { email: user.email }
    });

    if (!dbUser) {
        // Generate unique username
        const baseUsername = user.email.split('@')[0];
        let username = baseUsername;
        let counter = 1;

        // Check if username already exists
        while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${counter}`;
            counter++;
        }

        dbUser = await prisma.user.create({
            data: {
                email: user.email,
                username,
                name: user.user_metadata?.full_name || null,
                role: 'ADMIN',
            }
        });
    }

    const post = await prisma.post.create({
        data: {
            title,
            content,
            category: 'NOTICE' as any,
            authorId: dbUser.id,
            isPinned,
        }
    });

    revalidatePath('/');
    revalidatePath('/community');
    revalidatePath('/admin');

    return { success: true, postId: post.id };
}

export async function deleteNotice(postId: string, accessToken?: string) {
    const supabase = await createServerActionClient();

    // Try token first, then fallback to cookies
    let user;
    console.log('🗑️ [Delete Notice] accessToken provided:', !!accessToken);

    if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        console.log('🗑️ [Delete Notice] Token auth result:', error ? error.message : 'success');
        if (!error) user = data.user;
    }

    // Fallback to cookies if token didn't work
    if (!user) {
        console.log('🗑️ [Delete Notice] Trying cookie auth...');
        const { data } = await supabase.auth.getUser();
        user = data.user;
        console.log('🗑️ [Delete Notice] Cookie auth result:', user ? 'success' : 'failed');
    }

    if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
        console.log('❌ [Delete Notice] Unauthorized:', user?.email);
        throw new Error('권한이 없습니다.');
    }

    console.log('✅ [Delete Notice] User authorized:', user.email);

    await prisma.post.delete({
        where: { id: postId }
    });

    revalidatePath('/');
    revalidatePath('/community');
    revalidatePath('/admin');

    return { success: true };
}
