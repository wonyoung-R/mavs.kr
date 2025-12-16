// src/lib/db/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Public client (for client-side and basic server operations)
// 환경변수가 없으면 더미 클라이언트 생성 (빌드 시 에러 방지)
export const supabase = supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    })
    : createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

// Service role client (for server-side operations with full access)
// Only use this on the server side!
export const getServiceSupabase = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        console.warn('SUPABASE_SERVICE_ROLE_KEY not found, using anon key');
        return supabase;
    }
    if (!supabaseUrl) {
        console.warn('SUPABASE_URL not found');
        return supabase;
    }
    return createClient(supabaseUrl, serviceRoleKey);
};

// Database types
export interface NewsRow {
    id: string;
    title: string;
    title_kr: string | null;
    content: string | null;
    content_kr: string | null;
    summary: string | null;
    summary_kr: string | null;
    source: string;
    source_url: string;
    author: string | null;
    image_url: string | null;
    published_at: string;
    crawled_at: string;
    view_count: number;
    created_at: string;
    updated_at: string;
}

export type NewsInsert = Omit<NewsRow, 'id' | 'crawled_at' | 'view_count' | 'created_at' | 'updated_at'>;
