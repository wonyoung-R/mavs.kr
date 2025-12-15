'use client';

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { toggleLike } from '@/app/actions/community';

interface LikeButtonProps {
    postId: string;
    initialLiked: boolean;
    initialCount: number;
}

export default function LikeButton({ postId, initialLiked, initialCount }: LikeButtonProps) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            try {
                const result = await toggleLike(postId);
                setLiked(result.liked);
                setCount(prev => result.liked ? prev + 1 : prev - 1);
            } catch (error) {
                console.error('Like failed:', error);
                alert('좋아요 실패: 로그인이 필요합니다.');
            }
        });
    };

    return (
        <button
            onClick={handleClick}
            disabled={isPending}
            className={`flex items-center gap-1.5 transition-colors ${
                liked ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
            } ${isPending ? 'opacity-50' : ''}`}
        >
            <Heart className={`w-5 h-5 ${liked ? 'fill-red-500' : ''}`} />
            <span>{count}</span>
        </button>
    );
}

