// src/lib/db/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

// Public client (for client-side and basic server operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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
