'use client';

import { Tweet } from 'react-tweet';

interface SNSNewsCardProps {
    url: string;
}

export function SNSNewsCard({ url }: SNSNewsCardProps) {
    const getTweetId = (url: string) => {
        const match = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
        return match ? match[1] : null;
    };

    const getYoutubeId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        return match ? match[1] : null;
    };

    const tweetId = getTweetId(url);
    const youtubeId = getYoutubeId(url);

    if (tweetId) {
        return (
            <div className="my-4 flex justify-center light">
                <Tweet id={tweetId} />
            </div>
        );
    }

    if (youtubeId) {
        return (
            <div className="my-4 relative w-full pt-[56.25%] rounded-lg overflow-hidden bg-gray-800">
                <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    // Instagram or others could go here, for now fallback to a link card
    return (
        <div className="my-4 p-4 border border-blue-500/30 rounded-lg bg-blue-500/5">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 break-all"
            >
                {url}
            </a>
            <p className="text-sm text-gray-500 mt-2">이 링크를 클릭하여 원본 게시물을 확인하세요.</p>
        </div>
    );
}
