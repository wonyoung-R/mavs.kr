'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
    return (
        <div className={cn("relative flex items-center justify-center space-x-1 bg-slate-900/50 backdrop-blur-md p-1 rounded-full border border-white/10", className)}>
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
    );
}
