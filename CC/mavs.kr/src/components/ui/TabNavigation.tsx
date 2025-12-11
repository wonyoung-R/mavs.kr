'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

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

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

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

            {/* Mobile Navigation Button */}
            <div className="md:hidden fixed top-4 left-4 z-50">
                <button
                    onClick={toggleMenu}
                    className="p-2 bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-full text-white"
                >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Navigation Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 top-16 z-50 p-4 md:hidden"
                    >
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-2">
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
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
