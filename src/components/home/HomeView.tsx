'use client';

import { motion } from 'framer-motion';
import { getTeamLogo } from '@/lib/utils/team-logos';
import { PWAInstallGuide } from './PWAInstallGuide';

interface HomeViewProps {
    todaysMavsGame: any;
    loadingTodaysGame: boolean;
}

export function HomeView({ todaysMavsGame, loadingTodaysGame }: HomeViewProps) {
    return (
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="w-full min-h-[calc(100vh-200px)] flex flex-col items-center justify-center relative"
            >
                {/* Hero Content */}
                <div className="text-center z-10">
                    <h1 className="font-anton text-5xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 tracking-tighter mb-4 md:mb-6">
                        MAVERICKS KOREA
                    </h1>
                    <motion.p
                        className="font-serif text-lg md:text-2xl text-blue-200/80 font-light tracking-widest uppercase"
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
                        className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 flex items-center gap-8 md:gap-16 mt-8"
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

            {/* PWA Install Floating Button */}
            <PWAInstallGuide />
        </>
    );
}
