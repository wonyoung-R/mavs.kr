import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const error_param = requestUrl.searchParams.get('error');
    const error_description = requestUrl.searchParams.get('error_description');

    console.log('[Auth Callback] Code:', code ? 'present' : 'missing');
    console.log('[Auth Callback] Error param:', error_param);
    console.log('[Auth Callback] Error description:', error_description);

    // Check for OAuth errors
    if (error_param) {
        console.error('[Auth Callback] OAuth error:', error_param, error_description);
        return NextResponse.redirect(
            new URL(`/login?error=${error_param}&description=${encodeURIComponent(error_description || '')}`, requestUrl.origin)
        );
    }

    if (code) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        // Check if we have valid credentials
        if (supabaseUrl === 'https://placeholder.supabase.co' || !supabaseAnonKey) {
            console.error('[Auth Callback] Missing Supabase credentials');
            return NextResponse.redirect(new URL('/login?error=config_error', requestUrl.origin));
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
            },
        });

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('[Auth Callback] Exchange code error:', error);
            return NextResponse.redirect(
                new URL(`/login?error=auth_failed&message=${encodeURIComponent(error.message)}`, requestUrl.origin)
            );
        }

        console.log('[Auth Callback] Successfully exchanged code for session');
    }

    // Redirect to home page after successful login
    return NextResponse.redirect(new URL('/', requestUrl.origin));
}
