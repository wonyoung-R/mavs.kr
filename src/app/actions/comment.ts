'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { Role } from '@prisma/client'
import { getSupabaseEnv } from '@/lib/supabase-helpers'

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

// Create a new comment
export async function createComment(
    postId: string,
    content: string,
    parentId?: string,
    token?: string
) {
    if (!content.trim()) {
        throw new Error('댓글 내용을 입력해주세요.');
    }

    // Supabase 설정 확인
    const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseEnv();
    if (!isConfigured) {
        throw new Error('로그인 기능이 설정되지 않았습니다. 관리자에게 문의하세요.');
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                    } catch { /* Ignore */ }
                },
            },
        }
    );

    let user;
    if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error) user = data.user;
    } else {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('로그인이 필요합니다.');
    }

    // Find or create user in database
    let dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true }
    });

    if (!dbUser) {
        const username = user.email?.split('@')[0] || `user_${Date.now()}`;
        dbUser = await prisma.user.create({
            data: {
                email: user.email!,
                username: username,
                name: user.user_metadata?.name || username,
                image: user.user_metadata?.avatar_url,
                role: Role.USER,
            },
            select: { id: true }
        });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
        where: { id: postId }
    });

    if (!post) {
        throw new Error('게시글을 찾을 수 없습니다.');
    }

    // Check if parent comment exists (for replies)
    if (parentId) {
        const parentComment = await prisma.comment.findUnique({
            where: { id: parentId }
        });
        if (!parentComment) {
            throw new Error('원본 댓글을 찾을 수 없습니다.');
        }
    }

    // Create comment
    const comment = await prisma.comment.create({
        data: {
            content: content.trim(),
            postId,
            authorId: dbUser.id,
            parentId: parentId || null,
        },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
                }
            }
        }
    });

    revalidatePath(`/community/${postId}`);
    return { success: true, comment };
}

// Delete a comment
export async function deleteComment(commentId: string, token?: string) {
    const cookieStore = await cookies();
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                    } catch { /* Ignore */ }
                },
            },
        }
    );

    let user;
    if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error) user = data.user;
    } else {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('로그인이 필요합니다.');
    }

    // Get comment with author info
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
            author: { select: { email: true } },
            replies: { select: { id: true } }
        }
    });

    if (!comment) {
        throw new Error('댓글을 찾을 수 없습니다.');
    }

    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const isAuthor = comment.author.email === user.email;

    if (!isAdmin && !isAuthor) {
        throw new Error('삭제 권한이 없습니다.');
    }

    const postId = comment.postId;

    // Delete all replies first, then delete the comment
    if (comment.replies.length > 0) {
        await prisma.comment.deleteMany({
            where: { parentId: commentId }
        });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    revalidatePath(`/community/${postId}`);
    return { success: true };
}

// Get comments for a post
export async function getComments(postId: string) {
    // Get all comments in a flat structure
    const comments = await prisma.comment.findMany({
        where: {
            postId,
        },
        orderBy: { createdAt: 'asc' },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
                    email: true,
                }
            },
        }
    });

    return comments;
}

