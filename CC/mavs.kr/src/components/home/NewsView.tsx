'use client';

import { motion } from 'framer-motion';
import { NewsFeed } from '@/components/news/NewsFeed';
import { NewsArticle } from '@/types/news';

interface NewsViewProps {
    initialNews: NewsArticle[];
}

export function NewsView({ initialNews }: NewsViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-6xl mx-auto p-4 h-[75vh] overflow-y-auto custom-scrollbar"
        >
            {/* NewsFeed internally handles title and filters */}
            <NewsFeed initialData={initialNews} />
        </motion.div>
    );
}
