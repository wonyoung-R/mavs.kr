'use client';

import { motion } from 'framer-motion';
import { getTeamLogo } from '@/lib/utils/team-logos';

interface HomeViewProps {
    todaysMavsGame: any;
    loadingTodaysGame: boolean;
}

export function HomeView({ todaysMavsGame, loadingTodaysGame }: HomeViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full flex flex-col items-center justify-center relative min-h-[70vh]"
        >
            {/* Background - kept minimal/abstract */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Hero Content */}
            <div className="text-center z-10 mb-12">
                <h1 className="text-7xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 tracking-tighter mb-6">
                    MAVERICKS
                </h1>
                <motion.p
                    className="text-xl md:text-2xl text-blue-200/80 font-light tracking-widest uppercase"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    Dallas Basketball
                </motion.p>
            </div>

            {/* Live/Next Game Widget (Simplified) */}
            {!loadingTodaysGame && todaysMavsGame && (
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 flex items-center gap-8 md:gap-16"
                >
                    <div className="text-center">
                        <img src={getTeamLogo(todaysMavsGame.away_team)} alt="Away" className="w-16 h-16 object-contain opacity-80" />
                        <p className="text-white/60 text-sm mt-2 font-bold">{todaysMavsGame.away_score || '-'}</p>
                    </div>

                    <div className="flex flex-col items-center">
                        <span className="text-xs font-bold tracking-widest text-blue-400 mb-2">
                            {todaysMavsGame.is_live ? 'LIVE' : todaysMavsGame.is_finished ? 'FINAL' : 'UPCOMING'}
                        </span>
                        <span className="text-3xl font-light text-white italic">VS</span>
                        {todaysMavsGame.is_live && (
                            <span className="text-xs text-green-400 mt-2 animate-pulse">{todaysMavsGame.period}Q {todaysMavsGame.time_remaining}</span>
                        )}
                    </div>

                    <div className="text-center">
                        <img src={getTeamLogo(todaysMavsGame.home_team)} alt="Home" className="w-16 h-16 object-contain opacity-80" />
                        <p className="text-white/60 text-sm mt-2 font-bold">{todaysMavsGame.home_score || '-'}</p>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
