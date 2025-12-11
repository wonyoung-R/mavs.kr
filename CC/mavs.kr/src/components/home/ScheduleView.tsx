'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar } from 'lucide-react';
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

    useEffect(() => {
        // Set current month on load
        if (!selectedMonth) {
            const currentMonth = new Date().getMonth() + 1; // 0-indexed
            const monthStr = String(currentMonth).padStart(2, '0');
            // If current month is in our list, pick it, otherwise default to likely season start or end
            const found = MONTHS.find(m => m.id === monthStr);
            if (found) {
                setSelectedMonth(monthStr);
            } else {
                // If off-season (e.g. Aug), maybe show Oct or last played month
                setSelectedMonth('10');
            }
        }
    }, [selectedMonth]);

    const filteredGames = allGames ? allGames.filter(game => {
        // game.game_date_kst is "YYYY-MM-DD"
        const month = game.game_date_kst.split('-')[1];
        return month === selectedMonth;
    }) : [];

    // Sort: Dates ascending
    filteredGames.sort((a, b) => new Date(a.game_date_kst).getTime() - new Date(b.game_date_kst).getTime());

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl mx-auto p-4"
        >
            <Card className="bg-[#0f111a]/80 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <CardHeader className="pb-6 border-b border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle className="text-white flex items-center space-x-3 text-2xl font-bold tracking-tight">
                            <Calendar className="w-6 h-6 text-blue-500" />
                            <span>Game Schedule</span>
                        </CardTitle>

                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl overflow-x-auto custom-scrollbar md:w-auto w-full">
                            {MONTHS.map((month) => (
                                <button
                                    key={month.id}
                                    onClick={() => setSelectedMonth(month.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap ${selectedMonth === month.id
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {month.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0 min-h-[500px]">
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
                                        {/* Date & Status */}
                                        <div className="col-span-3 sm:col-span-2 text-center border-r border-white/5 pr-4">
                                            <div className="text-xs font-semibold text-blue-400 mb-1 uppercase tracking-wider">
                                                {new Date(game.game_date_kst).toLocaleDateString('en-US', { weekday: 'short' })}
                                            </div>
                                            <div className="text-xl font-bold text-white mb-1">
                                                {new Date(game.game_date_kst).getDate()}
                                            </div>
                                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${game.status === 'finished' ? 'bg-gray-800 text-gray-400' :
                                                game.status === 'live' ? 'bg-green-500/20 text-green-400 animate-pulse' :
                                                    'bg-blue-600/20 text-blue-300'
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
