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

        // Try to fetch role from profiles table
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (!error && data?.role) {
                return data.role as UserRole;
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
                console.log('Auth event:', event);
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const role = await fetchUserRole(session.user);
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
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            console.error('Google sign in error:', error);
            throw error;
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
    const isColumnist = userRole === 'columnist';

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
