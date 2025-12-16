'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/db/supabase';

// User roles: admin, columnist, user
export type UserRole = 'admin' | 'columnist' | 'user';

// Admin emails (hardcoded for now, can be moved to DB later)
const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    userRole: UserRole;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    isAdmin: boolean;
    isColumnist: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<UserRole>('user');

    // Fetch user role from database or determine from email
    const fetchUserRole = async (user: User): Promise<UserRole> => {
        // Check if admin by email
        if (user.email && ADMIN_EMAILS.includes(user.email)) {
            return 'admin';
        }

        // Try to fetch role from User table
        try {
            const { data, error } = await supabase
                .from('User')
                .select('role')
                .eq('email', user.email)
                .single();

            if (!error && data?.role) {
                // Map Prisma Role enum to UserRole type
                const role = data.role.toLowerCase();
                if (role === 'admin' || role === 'columnist' || role === 'user') {
                    return role as UserRole;
                }
            }
        } catch {
            // Table might not exist yet, return default
        }

        return 'user';
    };

    useEffect(() => {
        // Get initial session
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const role = await fetchUserRole(session.user);
                setUserRole(role);
            }

            setLoading(false);
        };

        getSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[AuthContext] Auth event:', event);
                console.log('[AuthContext] Session:', session ? 'present' : 'null');
                console.log('[AuthContext] User:', session?.user?.email || 'no user');
                
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    console.log('[AuthContext] Fetching user role for:', session.user.email);
                    const role = await fetchUserRole(session.user);
                    console.log('[AuthContext] User role:', role);
                    setUserRole(role);
                } else {
                    setUserRole('user');
                }

                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signInWithGoogle = async () => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set';

        console.log('[SignIn] Starting Google sign in...');
        console.log('[SignIn] Redirect URL:', `${window.location.origin}/auth/callback`);
        console.log('[SignIn] Supabase URL:', supabaseUrl);
        console.log('[SignIn] Current location:', window.location.href);

        if (supabaseUrl === 'not set' || supabaseUrl === 'https://placeholder.supabase.co') {
            alert('⚠️ Supabase가 설정되지 않았습니다. 관리자에게 문의하세요.');
            console.error('[SignIn] Supabase not configured');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                },
            });

            if (error) {
                console.error('[SignIn] Google sign in error:', error);
                alert(`❌ 로그인 실패: ${error.message}`);
                throw error;
            }

            console.log('[SignIn] OAuth redirect initiated');
            console.log('[SignIn] Provider:', data?.provider);
            console.log('[SignIn] URL:', data?.url);
        } catch (err) {
            console.error('[SignIn] Exception:', err);
            throw err;
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Sign out error:', error);
            throw error;
        }
        setUserRole('user');
    };

    const isAdmin = userRole === 'admin';
    const isColumnist = userRole === 'columnist' || isAdmin;

    return (
        <AuthContext.Provider value={{
            user,
            session,
            loading,
            userRole,
            signInWithGoogle,
            signOut,
            isAdmin,
            isColumnist,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
