'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const { user, loading } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

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

  const navLinks = [
    { href: '/', label: '홈' },
    { href: '/news', label: '뉴스' },
    { href: '/?tab=column', label: '칼럼' },
    { href: '/games', label: '경기' },
    { href: '/players', label: '선수' },
    { href: '/?tab=community', label: '커뮤니티' },
  ];

  return (
    <header 
      className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${
        isScrolled 
          ? 'bg-[#050510]/95 backdrop-blur-lg border-white/10 shadow-lg shadow-black/20' 
          : 'bg-[#050510]/60 backdrop-blur-md border-white/5'
      }`}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold font-mono text-white tracking-tighter">mavs.kr</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-slate-300 hover:text-blue-400 transition text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center space-x-3">
          {!loading && (
            user ? (
              <Link href="/profile">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="text-white/90 text-sm font-medium max-w-[100px] truncate">
                    {user.user_metadata?.name || user.email?.split('@')[0] || '사용자'}
                  </span>
                </div>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
                  로그인
                </Button>
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
