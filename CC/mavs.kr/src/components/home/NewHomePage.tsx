'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TabNavigation } from '@/components/ui/TabNavigation';
import { HomeView } from '@/components/home/HomeView';
import { ScheduleView } from '@/components/home/ScheduleView';
import { NewsView } from '@/components/home/NewsView';
import { ColumnView } from '@/components/home/ColumnView';
import { CommunityView } from '@/components/home/CommunityView';
import { NewsArticle } from '@/types/news';
import Link from 'next/link';
import { LogIn, LogOut, User, ChevronDown, Settings, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Type definitions for Game data
interface MavericksGame {
  game_id: string;
  game_date: string;
  game_date_kst: string;
  game_time_kst: string;
  opponent: string;
  is_home: boolean;
  mavs_score: number;
  opponent_score: number | null;
  result: string | null;
  status: 'finished' | 'upcoming' | 'today' | 'live';
  matchup: string;
  venue: string;
  period?: number;
  time_remaining?: string;
  broadcast?: string[];
}

// Profile Dropdown Component
function ProfileDropdown() {
  const { user, loading, signOut, userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 animate-pulse bg-white/10 rounded-full"></div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 rounded-full backdrop-blur-md border border-blue-500/30 transition-all text-sm font-medium hover:scale-105"
      >
        <LogIn className="w-4 h-4" />
        <span>로그인</span>
      </Link>
    );
  }

  const isAdmin = userRole === 'admin';
  const isColumnist = userRole === 'columnist';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all"
      >
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="Profile"
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <User className="w-4 h-4 text-white/70" />
        )}
        <span className="text-white/90 text-sm font-medium max-w-[100px] truncate">
          {user.user_metadata?.name || user.email?.split('@')[0] || '사용자'}
        </span>
        {(isAdmin || isColumnist) && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${isAdmin ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {isAdmin ? '관리자' : '컬럼'}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl overflow-hidden z-50"
          >
            <div className="p-2">
              <div className="px-3 py-2 border-b border-white/10 mb-2">
                <p className="text-sm text-white font-medium truncate">
                  {user.user_metadata?.name || '사용자'}
                </p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>

              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <User className="w-4 h-4" />
                프로필
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  관리자 패널
                </Link>
              )}

              <div className="border-t border-white/10 my-2"></div>

              <button
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NewHomePage() {
  const [activeTab, setActiveTab] = useState('home');
  const [initialNews, setInitialNews] = useState<NewsArticle[]>([]);
  const [allGames, setAllGames] = useState<MavericksGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [todaysMavsGame, setTodaysMavsGame] = useState<any>(null);
  const [loadingTodaysGame, setLoadingTodaysGame] = useState(true);

  useEffect(() => {
    fetch('/api/news/all?limit=6&translate=true')
      .then(res => res.json())
      .then(data => setInitialNews(data.articles || []))
      .catch(err => console.error('Failed to load initial news:', err));

    fetchNBAData();
    fetchTodaysMavsGame();
  }, []);

  const fetchNBAData = async () => {
    try {
      const gamesResponse = await fetch('/api/nba/espn-schedule');
      const gamesData = await gamesResponse.json();
      if (gamesData.success && gamesData.data) {
        setAllGames(gamesData.data.all_games || []);
      }
      setLoadingGames(false);
    } catch (error) {
      console.error('Failed to fetch NBA data:', error);
      setLoadingGames(false);
    }
  };

  const fetchTodaysMavsGame = async () => {
    try {
      const response = await fetch('/api/nba/live-scores');
      const data = await response.json();
      if (data.success && data.data) {
        const mavsGame = data.data.all_games?.find((game: any) => game.is_mavs_game);
        setTodaysMavsGame(mavsGame || null);
      }
      setLoadingTodaysGame(false);
    } catch (error) {
      console.error('Failed to fetch today\'s Mavs game:', error);
      setLoadingTodaysGame(false);
    }
  };

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'news', label: 'News' },
    { id: 'column', label: 'Column' },
    { id: 'community', label: 'Community' },
  ];

  return (
    <div className="min-h-screen w-full bg-[#050510] relative flex flex-col items-center">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      {/* Top Navigation Buttons */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <ProfileDropdown />
      </div>

      {/* Navigation */}
      <div className="relative z-50 pt-8 pb-4">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 w-full max-w-7xl mx-auto flex flex-col p-4 pb-20">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <HomeView
              key="home"
              todaysMavsGame={todaysMavsGame}
              loadingTodaysGame={loadingTodaysGame}
            />
          )}
          {activeTab === 'schedule' && (
            <ScheduleView
              key="schedule"
              allGames={allGames}
              loadingGames={loadingGames}
            />
          )}
          {activeTab === 'news' && (
            <NewsView
              key="news"
              initialNews={initialNews}
            />
          )}
          {activeTab === 'column' && (
            <ColumnView key="column" />
          )}
          {activeTab === 'community' && (
            <CommunityView key="community" />
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
