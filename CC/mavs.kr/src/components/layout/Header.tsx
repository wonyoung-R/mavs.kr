'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  const navLinks = [
    { href: '/', label: '홈' },
    { href: '/news', label: '뉴스' },
    { href: '/?tab=column', label: '칼럼' },
    { href: '/games', label: '경기' },
    { href: '/players', label: '선수' },
    { href: '/?tab=community', label: '커뮤니티' },
  ];

  return (
    <header className="fixed top-0 w-full bg-[#050510]/80 backdrop-blur-md z-50 border-b border-white/5">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 z-50" onClick={closeMenu}>
          {/* <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center font-bold text-white text-sm">M</div> */}
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
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
              로그인
            </Button>
          </Link>
          {/* <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              회원가입
            </Button> */}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="md:hidden z-50 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 top-16 bg-[#050510] border-t border-white/10 md:hidden p-4 flex flex-col h-[calc(100vh-4rem)]"
            >
              <div className="flex flex-col space-y-4 flex-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-lg font-medium text-slate-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-colors"
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="pt-6 border-t border-white/10 space-y-3 pb-8">
                <Link href="/login" onClick={closeMenu}>
                  <Button variant="ghost" className="w-full justify-center text-slate-300 hover:text-white hover:bg-white/10 border border-white/10">
                    로그인
                  </Button>
                </Link>
                {/* <Button className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20">
                  회원가입
                </Button> */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
