'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { ForumCategory, Prisma } from '@prisma/client';

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

function mapCategoryToEnum(category: string): ForumCategory {
    switch (category) {
        case 'free': return ForumCategory.GENERAL;
        case 'market': return ForumCategory.MARKET;
        case 'meetup': return ForumCategory.MEETUP;
        case 'news': return ForumCategory.GENERAL; // Assuming news is general discussion for now
        case 'sharing': return ForumCategory.GENERAL; // Sharing as General with tag in future
        default: return ForumCategory.GENERAL;
    }
}

export async function createPost(formData: FormData, token?: string) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const categoryInput = formData.get('category') as string;
    
    // Optional fields
    const price = formData.get('price') ? parseInt(formData.get('price') as string) : null;
    const location = formData.get('location') as string || null;

    if (!title || !content || !categoryInput) {
        throw new Error('Title, content, and category are required');
    }

    const category = mapCategoryToEnum(categoryInput);

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

    let user;

    if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error) user = data.user;
    } else {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('Unauthorized');
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
                role: 'USER', // Default role
            },
            select: { id: true }
        });
    }

    const userId = dbUser.id;

    // Create post data object
    const postData: Prisma.PostCreateInput = {
        title,
        content,
        category,
        author: {
            connect: { id: userId }
        },
        // Add optional fields based on category
        ...(category === ForumCategory.MARKET && price ? { price } : {}),
        ...(category === ForumCategory.MEETUP && location ? { meetupLocation: location } : {}),
    };

    await prisma.post.create({
        data: postData,
    });

    revalidatePath('/comm');
    return { success: true };
}

export async function deletePost(postId: string, token?: string) {
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

    let user;

    if (token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error) user = data.user;
    } else {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user || !user.email) {
        throw new Error('Unauthorized');
    }

    // Get the post to check ownership
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            author: {
                select: { email: true }
            }
        }
    });

    if (!post) {
        throw new Error('Post not found');
    }

    // Check if user is the author or admin
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const isAuthor = post.author.email === user.email;

    if (!isAdmin && !isAuthor) {
        throw new Error('You do not have permission to delete this post');
    }

    // Delete the post
    await prisma.post.delete({
        where: { id: postId }
    });

    revalidatePath('/comm');
    return { success: true };
}
