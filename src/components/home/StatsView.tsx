'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';

export function StatsView() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-5xl mx-auto p-4 flex items-center justify-center min-h-[60vh]"
        >
            <div className="grid md:grid-cols-3 gap-8 w-full">
                {/* Luka Card */}
                <Card className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border-blue-500/20 rounded-3xl overflow-hidden hover:scale-105 transition-all duration-300 group cursor-pointer">
                    <CardContent className="p-8 flex flex-col items-center text-center relative">
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                        <div className="w-32 h-32 bg-slate-800 rounded-full mb-6 flex items-center justify-center text-3xl font-bold text-white border-4 border-blue-500/30 z-10">
                            77
                        </div>
                        <div className="z-10">
                            <p className="text-4xl font-bold text-white mb-2">32.4</p>
                            <p className="text-blue-400 font-medium uppercase tracking-wider text-sm mb-6">PTS / Game</p>
                            <h3 className="text-xl font-bold text-white">Luka Dončić</h3>
                            <p className="text-slate-400 text-sm">Guard</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Kyrie Card - Placeholder data */}
                <Card className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 border-purple-500/20 rounded-3xl overflow-hidden hover:scale-105 transition-all duration-300 group cursor-pointer">
                    <CardContent className="p-8 flex flex-col items-center text-center relative">
                        <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                        <div className="w-32 h-32 bg-slate-800 rounded-full mb-6 flex items-center justify-center text-3xl font-bold text-white border-4 border-purple-500/30 z-10">
                            11
                        </div>
                        <div className="z-10">
                            <p className="text-4xl font-bold text-white mb-2">25.6</p>
                            <p className="text-purple-400 font-medium uppercase tracking-wider text-sm mb-6">PTS / Game</p>
                            <h3 className="text-xl font-bold text-white">Kyrie Irving</h3>
                            <p className="text-slate-400 text-sm">Guard</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Lively Card */}
                <Card className="bg-gradient-to-br from-green-900/40 to-slate-900/40 border-green-500/20 rounded-3xl overflow-hidden hover:scale-105 transition-all duration-300 group cursor-pointer">
                    <CardContent className="p-8 flex flex-col items-center text-center relative">
                        <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                        <div className="w-32 h-32 bg-slate-800 rounded-full mb-6 flex items-center justify-center text-3xl font-bold text-white border-4 border-green-500/30 z-10">
                            2
                        </div>
                        <div className="z-10">
                            <p className="text-4xl font-bold text-white mb-2">8.5</p>
                            <p className="text-green-400 font-medium uppercase tracking-wider text-sm mb-6">REB / Game</p>
                            <h3 className="text-xl font-bold text-white">Dereck Lively II</h3>
                            <p className="text-slate-400 text-sm">Center</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
}
