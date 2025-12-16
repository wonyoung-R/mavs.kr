'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar, Clock, MapPin, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTeamLogo } from '@/lib/utils/team-logos';

interface ScheduleViewProps {
    allGames: any[];
    loadingGames: boolean;
}

const MONTHS = [
    { id: '10', label: 'Oct' },
    { id: '11', label: 'Nov' },
    { id: '12', label: 'Dec' },
    { id: '01', label: 'Jan' },
    { id: '02', label: 'Feb' },
    { id: '03', label: 'Mar' },
    { id: '04', label: 'Apr' },
    { id: '05', label: 'May' },
];

export function ScheduleView({ allGames, loadingGames }: ScheduleViewProps) {
    const [selectedMonth, setSelectedMonth] = useState('');
    const [liveGames, setLiveGames] = useState<any[]>([]);
    const monthScrollRef = useRef<HTMLDivElement>(null);

    // Get current month index for navigation
    const currentMonthIndex = MONTHS.findIndex(m => m.id === selectedMonth);
    const canScrollLeft = currentMonthIndex > 0;
    const canScrollRight = currentMonthIndex < MONTHS.length - 1;

    const navigateMonth = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev' ? currentMonthIndex - 1 : currentMonthIndex + 1;
        if (newIndex >= 0 && newIndex < MONTHS.length) {
            setSelectedMonth(MONTHS[newIndex].id);
        }
    };

    useEffect(() => {
        // Set current month on load
        if (!selectedMonth) {
            const currentMonth = new Date().getMonth() + 1;
            const monthStr = String(currentMonth).padStart(2, '0');
            const found = MONTHS.find(m => m.id === monthStr);
            if (found) {
                setSelectedMonth(monthStr);
            } else {
                setSelectedMonth('10');
            }
        }
    }, [selectedMonth]);

    // 실시간 점수 업데이트: Schedule 탭이 활성화되어 있을 때 1분마다 live 경기 정보 갱신
    useEffect(() => {
        const fetchLiveScores = async () => {
            try {
                const response = await fetch('/api/nba/live-scores');
                const data = await response.json();
                if (data.success && data.data && data.data.all_games) {
                    setLiveGames(data.data.all_games);
                }
            } catch (error) {
                console.error('Failed to fetch live scores:', error);
            }
        };

        // 초기 로드
        fetchLiveScores();

        // 1분마다 업데이트
        const intervalId = setInterval(fetchLiveScores, 60000);

        return () => clearInterval(intervalId);
    }, []);

    // allGames와 liveGames를 병합하여 최신 정보 사용
    const mergedGames = useMemo(() => {
        if (!allGames || allGames.length === 0) return [];

        // liveGames가 있으면 해당 게임 정보를 업데이트
        return allGames.map(game => {
            const liveGame = liveGames.find(lg => lg.game_id === game.game_id);
            if (liveGame && (liveGame.is_live || liveGame.is_finished)) {
                // live 또는 finished 상태면 최신 정보로 업데이트
                return {
                    ...game,
                    status: liveGame.is_live ? 'live' : liveGame.is_finished ? 'finished' : game.status,
                    mavs_score: game.is_home ? liveGame.home_score : liveGame.away_score,
                    opponent_score: game.is_home ? liveGame.away_score : liveGame.home_score,
                    period: liveGame.period,
                    time_remaining: liveGame.time_remaining,
                    result: liveGame.is_finished ? (
                        (game.is_home && liveGame.home_score > liveGame.away_score) ||
                        (!game.is_home && liveGame.away_score > liveGame.home_score)
                    ) ? 'W' : 'L' : null
                };
            }
            return game;
        });
    }, [allGames, liveGames]);

    // Find the next game or live game
    // 우선순위: 1) live 경기, 2) today 경기, 3) upcoming 경기
    const nextGame = useMemo(() => {
        if (!mergedGames || mergedGames.length === 0) return null;

        // 먼저 live 경기 찾기
        const liveGame = mergedGames.find(game => game.status === 'live');
        if (liveGame) return liveGame;

        // live 경기가 없으면 오늘 또는 다가오는 경기 찾기
        const upcomingGames = mergedGames
            .filter(game => game.status === 'upcoming' || game.status === 'today')
            .sort((a, b) => new Date(a.game_date_kst).getTime() - new Date(b.game_date_kst).getTime());

        return upcomingGames[0] || null;
    }, [mergedGames]);

    const filteredGames = mergedGames ? mergedGames.filter(game => {
        const month = game.game_date_kst.split('-')[1];
        return month === selectedMonth;
    }) : [];

    // Sort: Dates ascending
    filteredGames.sort((a, b) => new Date(a.game_date_kst).getTime() - new Date(b.game_date_kst).getTime());

    // Format KST date nicely
    const formatKSTDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl mx-auto p-4 space-y-6"
        >
            {/* Next Game Banner */}
            {!loadingGames && nextGame && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <a
                        href={`https://www.espn.com/nba/boxscore/_/gameId/${nextGame.game_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                    >
                        <Card className={`${
                            nextGame.status === 'live'
                                ? 'bg-gradient-to-br from-green-900/60 via-green-800/40 to-emerald-900/40 border-green-500/50'
                                : 'bg-gradient-to-br from-blue-900/60 via-blue-800/40 to-purple-900/40 border-blue-500/30'
                        } rounded-2xl overflow-hidden shadow-xl hover:shadow-blue-900/30 transition-all duration-300 hover:scale-[1.02]`}>
                            <CardContent className="p-6">
                                {/* Header with Date & Time */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                                            nextGame.status === 'live' ? 'bg-green-400' : 'bg-blue-400'
                                        }`} />
                                        <span className={`text-sm font-bold uppercase tracking-wider ${
                                            nextGame.status === 'live' ? 'text-green-400' : 'text-blue-400'
                                        }`}>
                                            {nextGame.status === 'live' ? '🔴 LIVE NOW' : 'Next Game'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-white">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-blue-400" />
                                            <span className="font-bold">{formatKSTDate(nextGame.game_date_kst)}</span>
                                        </div>
                                        <span className="text-white/30">|</span>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-400" />
                                            {nextGame.status === 'live' ? (
                                                <span className="font-mono font-bold text-green-300 animate-pulse">
                                                    Q{nextGame.period} {nextGame.time_remaining}
                                                </span>
                                            ) : (
                                                <span className="font-mono font-bold text-blue-300">{nextGame.game_time_kst} KST</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Matchup */}
                                <div className="flex items-center justify-center gap-6 md:gap-12 mb-4">
                                    {/* Away Team */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="relative w-16 h-16 md:w-24 md:h-24 drop-shadow-2xl">
                                            <Image
                                                src={getTeamLogo(nextGame.is_home ? nextGame.opponent : 'Mavericks')}
                                                alt="Away Team"
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                        <span className={`text-sm md:text-lg font-bold ${!nextGame.is_home ? 'text-blue-400' : 'text-white'}`}>
                                            {nextGame.is_home ? nextGame.opponent : 'DAL'}
                                        </span>
                                        {nextGame.status === 'live' && (
                                            <span className="text-2xl md:text-3xl font-mono font-black text-white">
                                                {nextGame.is_home ? nextGame.opponent_score : nextGame.mavs_score}
                                            </span>
                                        )}
                                    </div>

                                    {/* VS or Score */}
                                    <div className="flex flex-col items-center">
                                        {nextGame.status === 'live' ? (
                                            <span className="text-2xl md:text-3xl font-black text-white/50">-</span>
                                        ) : (
                                            <>
                                                <Zap className="w-6 h-6 text-yellow-400 mb-2" />
                                                <span className="text-2xl md:text-3xl font-black text-white/50">VS</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Home Team */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="relative w-16 h-16 md:w-24 md:h-24 drop-shadow-2xl">
                                            <Image
                                                src={getTeamLogo(nextGame.is_home ? 'Mavericks' : nextGame.opponent)}
                                                alt="Home Team"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <span className={`text-sm md:text-lg font-bold ${nextGame.is_home ? 'text-blue-400' : 'text-white'}`}>
                                            {nextGame.is_home ? 'DAL' : nextGame.opponent}
                                        </span>
                                        {nextGame.status === 'live' && (
                                            <span className="text-2xl md:text-3xl font-mono font-black text-white">
                                                {nextGame.is_home ? nextGame.mavs_score : nextGame.opponent_score}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Venue & Home/Away */}
                                <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-purple-400" />
                                        <span>{nextGame.venue}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${nextGame.is_home ? 'bg-blue-600/30 text-blue-300' : 'bg-purple-600/30 text-purple-300'}`}>
                                        {nextGame.is_home ? 'HOME' : 'AWAY'}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </a>
                </motion.div>
            )}

            {/* Schedule Card */}
            <Card className="bg-[#0f111a]/80 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <CardHeader className="pb-6 border-b border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle className="text-white flex items-center space-x-3 text-2xl font-bold tracking-tight">
                            <Calendar className="w-6 h-6 text-blue-500" />
                            <span>Game Schedule</span>
                        </CardTitle>

                        {/* Month Navigation - Mobile Swipeable */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            {/* Left Arrow - Desktop & Mobile */}
                            <button
                                onClick={() => navigateMonth('prev')}
                                disabled={!canScrollLeft}
                                className={`flex-shrink-0 p-2 rounded-full transition-all duration-200 ${
                                    canScrollLeft
                                        ? 'bg-white/10 text-white hover:bg-blue-600/50 active:scale-95'
                                        : 'bg-white/5 text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            {/* Month Pills - Scrollable without visible scrollbar */}
                            <div
                                ref={monthScrollRef}
                                className="flex-1 overflow-x-auto scrollbar-hide"
                                style={{
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    WebkitOverflowScrolling: 'touch'
                                }}
                            >
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl w-max mx-auto">
                                    {MONTHS.map((month) => (
                                        <motion.button
                                            key={month.id}
                                            onClick={() => setSelectedMonth(month.id)}
                                            whileTap={{ scale: 0.95 }}
                                            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                                                selectedMonth === month.id
                                                    ? 'text-white'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {selectedMonth === month.id && (
                                                <motion.div
                                                    layoutId="activeMonth"
                                                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                                />
                                            )}
                                            <span className="relative z-10">{month.label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Right Arrow - Desktop & Mobile */}
                            <button
                                onClick={() => navigateMonth('next')}
                                disabled={!canScrollRight}
                                className={`flex-shrink-0 p-2 rounded-full transition-all duration-200 ${
                                    canScrollRight
                                        ? 'bg-white/10 text-white hover:bg-blue-600/50 active:scale-95'
                                        : 'bg-white/5 text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0 min-h-[400px]">
                    {loadingGames ? (
                        <div className="space-y-4 p-6">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="bg-white/5 rounded-xl p-6 h-24 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {filteredGames.length > 0 ? (
                                filteredGames.map((game) => (
                                    <a
                                        key={game.game_id}
                                        href={`https://www.espn.com/nba/boxscore/_/gameId/${game.game_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group hover:bg-white/5 transition-colors duration-300 p-4 sm:p-6 grid grid-cols-12 gap-4 items-center cursor-pointer block"
                                    >
                                        {/* Date & Time */}
                                        <div className="col-span-3 sm:col-span-2 text-center border-r border-white/5 pr-2 sm:pr-4">
                                            <div className="text-lg sm:text-xl font-bold text-white">
                                                {new Date(game.game_date_kst).getMonth() + 1}/{new Date(game.game_date_kst).getDate()}
                                            </div>
                                            <div className="text-[10px] sm:text-xs text-blue-400 font-medium">
                                                {new Date(game.game_date_kst).toLocaleDateString('ko-KR', { weekday: 'short' })}
                                            </div>
                                            <div className={`text-[10px] sm:text-xs font-bold mt-1 ${
                                                game.status === 'finished' ? 'text-gray-500' :
                                                game.status === 'live' ? 'text-green-400 animate-pulse' :
                                                    'text-blue-300'
                                                }`}>
                                                {game.status === 'finished' ? 'FINAL' :
                                                    game.status === 'live' ? 'LIVE' :
                                                        game.game_time_kst}
                                            </div>
                                        </div>

                                        {/* Standard Matchup: Away (Left) @ Home (Right) */}
                                        <div className="col-span-9 sm:col-span-7 flex items-center justify-between sm:justify-center gap-2 sm:gap-8 px-2 sm:px-8">
                                            {/* Away Team (Left) */}
                                            <div className="flex flex-col items-center gap-1 w-14 sm:w-28">
                                                <div className="relative w-8 h-8 sm:w-16 sm:h-16 drop-shadow-lg transition-transform group-hover:scale-110 duration-300">
                                                    <Image
                                                        src={getTeamLogo(game.is_home ? game.opponent : 'Mavericks')}
                                                        alt="Away Team"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                                <span className={`text-xs sm:text-base font-bold text-center truncate w-full ${!game.is_home ? 'text-blue-400' : 'text-gray-400'}`}>
                                                    {game.is_home ? game.opponent : 'DAL'}
                                                </span>
                                            </div>

                                            {/* Scores or @ */}
                                            <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                                                {game.status === 'finished' || game.status === 'live' ? (
                                                    <div className="flex items-center gap-2 sm:gap-4 font-mono text-xl sm:text-3xl font-bold text-white">
                                                        {/* Away Score (Left) */}
                                                        <span>{game.is_home ? game.opponent_score : game.mavs_score}</span>
                                                        <span className="text-gray-600 text-sm sm:text-lg">-</span>
                                                        {/* Home Score (Right) */}
                                                        <span>{game.is_home ? game.mavs_score : game.opponent_score}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-lg sm:text-xl font-bold text-gray-600">@</span>
                                                )}
                                                {/* Dallas-centric WIN/LOSS */}
                                                {game.status === 'finished' && (
                                                    <span className={`text-[10px] sm:text-xs mt-1 font-bold px-1.5 py-0.5 rounded ${game.result === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {game.result === 'W' ? 'WIN' : 'LOSS'}
                                                    </span>
                                                )}
                                                {game.status === 'live' && game.time_remaining && (
                                                    <span className="text-[10px] mt-1 text-green-400">Q{game.period} {game.time_remaining}</span>
                                                )}
                                            </div>

                                            {/* Home Team (Right) */}
                                            <div className="flex flex-col items-center gap-1 w-14 sm:w-28">
                                                <div className="relative w-8 h-8 sm:w-16 sm:h-16 drop-shadow-lg transition-transform group-hover:scale-110 duration-300">
                                                    <Image
                                                        src={getTeamLogo(game.is_home ? 'Mavericks' : game.opponent)}
                                                        alt="Home Team"
                                                        fill
                                                        className="object-contain"
                                                    />
                                                </div>
                                                <span className={`text-xs sm:text-base font-bold text-center truncate w-full ${game.is_home ? 'text-blue-400' : 'text-gray-400'}`}>
                                                    {game.is_home ? 'DAL' : game.opponent}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Venue/Type - Hidden on mobile */}
                                        <div className="col-span-3 hidden sm:flex flex-col items-end justify-center text-right pl-4 border-l border-white/5 h-full">
                                            <div className="text-xs text-gray-500 mb-1 font-medium truncate max-w-[150px]">{game.venue}</div>
                                            <div className={`text-[10px] font-semibold px-2 py-0.5 rounded ${game.is_home ? 'bg-blue-600/20 text-blue-300' : 'bg-purple-600/20 text-purple-300'}`}>
                                                {game.is_home ? 'HOME' : 'AWAY'}
                                            </div>
                                        </div>
                                    </a>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <Calendar className="w-12 h-12 text-gray-700 mb-4" />
                                    <p className="text-gray-500 text-lg">No games scheduled for this month.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
