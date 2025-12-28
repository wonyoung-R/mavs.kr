'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { motion } from 'framer-motion';
import {
  Home,
  Calendar,
  Newspaper,
  Users,
  FileText,
  Trophy,
  User,
  PenTool,
  MessageSquare,
  Archive
} from 'lucide-react';

export default function SitemapPage() {
  const sections = [
    {
      title: '메인',
      icon: Home,
      color: 'from-blue-600/20 to-blue-900/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      links: [
        { href: '/', label: '홈' },
        { href: '/?tab=news', label: '뉴스' },
        { href: '/?tab=schedule', label: '경기 일정' },
        { href: '/?tab=column', label: '칼럼' },
        { href: '/?tab=community', label: '커뮤니티' },
      ]
    },
    {
      title: '커뮤니티',
      icon: Users,
      color: 'from-purple-600/20 to-purple-900/20',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400',
      links: [
        { href: '/comm', label: '커뮤니티' },
        { href: '/comm/new', label: '게시글 작성' },
        { href: '/comm/members', label: '멤버' },
      ]
    },
    {
      title: '콘텐츠',
      icon: FileText,
      color: 'from-green-600/20 to-green-900/20',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400',
      links: [
        { href: '/analysis', label: '경기 분석' },
        { href: '/analysis/new', label: '분석 작성' },
        { href: '/column', label: '칼럼' },
        { href: '/column/new', label: '칼럼 작성' },
      ]
    },
    {
      title: '아카이브',
      icon: Archive,
      color: 'from-yellow-600/20 to-yellow-900/20',
      borderColor: 'border-yellow-500/30',
      iconColor: 'text-yellow-400',
      links: [
        { href: '/archive/games', label: '경기 아카이브' },
        { href: '/games', label: '게임 센터' },
      ]
    },
    {
      title: '계정',
      icon: User,
      color: 'from-cyan-600/20 to-cyan-900/20',
      borderColor: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
      links: [
        { href: '/profile', label: '프로필' },
        { href: '/login', label: '로그인' },
      ]
    },
  ];

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a1628] to-[#050510] pt-20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl md:text-4xl font-bold text-white mb-3"
            >
              사이트맵
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-gray-400"
            >
              MAVS.KR의 모든 페이지
            </motion.p>
          </div>

          {/* 사이트맵 그리드 */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card
                    className={`bg-gradient-to-br ${section.color} ${section.borderColor} hover:scale-[1.02] transition-transform h-full`}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center space-x-2 text-white text-lg">
                        <Icon className={`w-5 h-5 ${section.iconColor}`} />
                        <span>{section.title}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              className="text-gray-300 hover:text-white transition-colors flex items-center space-x-2 group"
                            >
                              <span className={`w-1.5 h-1.5 ${section.iconColor.replace('text-', 'bg-')} rounded-full group-hover:scale-125 transition-transform`}></span>
                              <span className="text-sm">{link.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* 추가 정보 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 text-center"
          >
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} MAVS.KR - 댈러스 매버릭스 한국 팬 커뮤니티
            </p>
          </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
}

