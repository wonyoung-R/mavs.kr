'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Menu, X, User, LogOut, FileText, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Tab {
    id: string;
    label: string;
    href?: string; // Optional link for external navigation
}

interface TabNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    className?: string;
}

export function TabNavigation({ tabs, activeTab, onTabChange, className }: TabNavigationProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const { user, loading, signOut, userRole } = useAuth();

    const isAdmin = userRole === 'ADMIN' || userRole === 'admin';
    const isColumnist = userRole === 'COLUMNIST' || userRole === 'columnist' || isAdmin;

    // Track scroll position - works on both desktop and mobile
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
            setIsScrolled(scrollTop > 10);
        };

        // Listen to multiple scroll events for better mobile support
        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
        if (isMenuOpen) setIsProfileExpanded(false);
    };
    const closeMenu = () => {
        setIsMenuOpen(false);
        setIsProfileExpanded(false);
    };

    const handleSignOut = () => {
        signOut();
        closeMenu();
    };

    return (
        <>
            {/* Desktop Navigation */}
            <div className={cn("hidden md:flex relative items-center justify-center space-x-1 bg-slate-900/50 backdrop-blur-md p-1 rounded-full border border-white/10", className)}>
                {tabs.map((tab) => (
                    tab.href ? (
                        // External link tab
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={cn(
                                "relative px-6 py-2.5 text-sm font-medium transition-colors duration-300 z-10",
                                "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            <span className="relative z-10">{tab.label}</span>
                        </Link>
                    ) : (
                        // Regular tab button
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "relative px-6 py-2.5 text-sm font-medium transition-colors duration-300 z-10",
                                activeTab === tab.id ? "text-white" : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-blue-600 rounded-full"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    )
                ))}
            </div>

            {/* Mobile Navigation Button - Right Side */}
            <div className="md:hidden fixed top-4 right-4 z-50">
                <button
                    onClick={toggleMenu}
                    className={`p-2.5 border rounded-full text-white transition-all duration-300 ${
                        isScrolled 
                            ? 'bg-[#0a0a1a] backdrop-blur-xl border-blue-500/30 shadow-xl shadow-blue-900/20' 
                            : 'bg-white/10 backdrop-blur-sm border-white/20'
                    }`}
                >
                    {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {/* Mobile Navigation Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeMenu}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50 }}
                            transition={{ type: 'tween', duration: 0.2 }}
                            className="fixed top-16 right-4 z-50 w-64 md:hidden"
                        >
                            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Tab Links */}
                                <div className="p-3 space-y-1">
                                    {tabs.map((tab) => (
                                        tab.href ? (
                                            <Link
                                                key={tab.id}
                                                href={tab.href}
                                                onClick={closeMenu}
                                                className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium"
                                            >
                                                {tab.label}
                                            </Link>
                                        ) : (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    onTabChange(tab.id);
                                                    closeMenu();
                                                }}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 rounded-xl transition-colors font-medium",
                                                    activeTab === tab.id
                                                        ? "bg-blue-600/20 text-blue-400"
                                                        : "text-slate-300 hover:text-white hover:bg-white/5"
                                                )}
                                            >
                                                {tab.label}
                                            </button>
                                        )
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-white/10 mx-3" />

                                {/* Profile Section */}
                                <div className="p-3">
                                    {loading ? (
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <div className="w-8 h-8 animate-pulse bg-white/10 rounded-full" />
                                            <div className="w-20 h-4 animate-pulse bg-white/10 rounded" />
                                        </div>
                                    ) : user ? (
                                        <div className="space-y-1">
                                            {/* Profile Toggle */}
                                            <button
                                                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                                                className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {user.user_metadata?.avatar_url ? (
                                                        <img
                                                            src={user.user_metadata.avatar_url}
                                                            alt="Profile"
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                                            {user.email?.[0]?.toUpperCase() || 'U'}
                                                        </div>
                                                    )}
                                                    <div className="text-left">
                                                        <p className="text-white font-medium text-sm truncate max-w-[120px]">
                                                            {user.user_metadata?.name || user.email?.split('@')[0] || '사용자'}
                                                        </p>
                                                        {(isAdmin || isColumnist) && (
                                                            <span className={`text-xs ${isAdmin ? 'text-red-400' : 'text-blue-400'}`}>
                                                                {isAdmin ? '관리자' : '칼럼니스트'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isProfileExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                )}
                                            </button>

                                            {/* Profile Submenu */}
                                            <AnimatePresence>
                                                {isProfileExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="ml-3 pl-3 border-l-2 border-blue-500/30 space-y-1 py-1">
                                                            <Link href="/profile" onClick={closeMenu}>
                                                                <div className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm">
                                                                    <User className="w-4 h-4" />
                                                                    <span>프로필</span>
                                                                </div>
                                                            </Link>

                                                            {isColumnist && (
                                                                <Link href="/column/new" onClick={closeMenu}>
                                                                    <div className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm">
                                                                        <FileText className="w-4 h-4" />
                                                                        <span>칼럼 작성</span>
                                                                    </div>
                                                                </Link>
                                                            )}

                                                            {isAdmin && (
                                                                <Link href="/admin" onClick={closeMenu}>
                                                                    <div className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm">
                                                                        <Shield className="w-4 h-4" />
                                                                        <span>관리자</span>
                                                                    </div>
                                                                </Link>
                                                            )}

                                                            <button
                                                                onClick={handleSignOut}
                                                                className="flex items-center gap-2 w-full px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                                                            >
                                                                <LogOut className="w-4 h-4" />
                                                                <span>로그아웃</span>
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ) : (
                                        <Link href="/login" onClick={closeMenu}>
                                            <div className="flex items-center gap-3 px-4 py-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-colors font-medium">
                                                <User className="w-5 h-5" />
                                                <span>로그인</span>
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
