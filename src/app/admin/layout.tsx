'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Shield, Users, Newspaper, RefreshCw, Megaphone, Settings } from 'lucide-react';

const ADMIN_MENU = [
    { href: '/admin', label: '대시보드', icon: Settings, exact: true },
    { href: '/admin/user', label: '사용자 관리', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isDevelopment = process.env.NODE_ENV === 'development';

    useEffect(() => {
        if (!isDevelopment) {
            if (!loading && !user) {
                router.push('/login');
            } else if (!loading && !isAdmin) {
                router.push('/');
            }
        }
    }, [user, loading, isAdmin, router, isDevelopment]);

    if (!isDevelopment && (loading || !isAdmin)) {
        return (
            <div className="min-h-screen bg-[#050510] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const isActive = (href: string, exact?: boolean) => {
        if (exact) {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-red-400" />
                            관리자 패널
                        </h1>
                        <p className="text-slate-400">사이트 관리 및 설정</p>
                    </div>
                    {user && (
                        <div className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-2">
                            <div className="text-xs text-slate-400">로그인:</div>
                            <div className="text-sm text-white font-medium">{user.email}</div>
                        </div>
                    )}
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
                    {ADMIN_MENU.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href, item.exact);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    active
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Content */}
                {children}
            </div>
        </div>
    );
}
