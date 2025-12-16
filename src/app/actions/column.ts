'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { Role } from '@prisma/client'
import { getSupabaseEnv } from '@/lib/supabase-helpers'

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export async function createColumn(formData: FormData, token?: string) {
    const title = formData.get('title') as string
    const content = formData.get('content') as string

    if (!title || !content) {
        throw new Error('Title and content are required')
    }

    const cookieStore = await cookies()
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )

    let user;

    if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error) user = data.user;
    } else {
        // Fallback to cookies
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('Unauthorized')
    }

    // Bypass for hardcoded admins
    if (ADMIN_EMAILS.includes(user.email)) {
        // Allow proceed
    } else {
        const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
        })

        if (!dbUser) {
            throw new Error('User not found in database')
        }

        if (dbUser.role !== Role.COLUMNIST && dbUser.role !== Role.ADMIN) {
            throw new Error('Only columnists and admins can write columns')
        }
    }

    // Find or create user
    let dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true }
    });

    if (!dbUser) {
        // Create user if doesn't exist
        const username = user.email?.split('@')[0] || `user_${Date.now()}`;
        dbUser = await prisma.user.create({
            data: {
                email: user.email!,
                username: username,
                name: user.user_metadata?.name || username,
                image: user.user_metadata?.avatar_url,
                role: ADMIN_EMAILS.includes(user.email!) ? Role.ADMIN : Role.COLUMNIST,
            },
            select: { id: true }
        });
    }

    const userId = dbUser.id;

    await prisma.post.create({
        data: {
            title,
            content,
            category: 'COLUMN' as any,
            authorId: userId,
        },
    })

    revalidatePath('/column')
    return { success: true }
}

export async function deleteColumn(postId: string, token?: string) {
    const cookieStore = await cookies()
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignore
                    }
                },
            },
        }
    )

    let user;

    if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error) user = data.user;
    } else {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('Unauthorized')
    }

    // Get the post to check ownership
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            author: {
                select: { email: true }
            }
        }
    })

    if (!post) {
        throw new Error('Post not found')
    }

    // Check if user is the author or admin
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const isAuthor = post.author.email === user.email;

    if (!isAdmin && !isAuthor) {
        throw new Error('You do not have permission to delete this post')
    }

    // Delete the post
    await prisma.post.delete({
        where: { id: postId }
    })

    revalidatePath('/column')
    return { success: true }
}

