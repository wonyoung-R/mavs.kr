'use client';

import Masonry from 'react-masonry-css';
import ColumnCard from './ColumnCard';

interface ColumnGridProps {
    posts: Array<{
        id: string;
        title: string;
        content: string;
        createdAt: Date;
        author: {
            username: string;
            image: string | null;
        };
        _count: {
            comments: number;
            votes: number;
        };
    }>;
}

export default function ColumnGrid({ posts }: ColumnGridProps) {
    const breakpointColumnsObj = {
        default: 4,
        1536: 4,
        1280: 3,
        1024: 3,
        768: 2,
        640: 1
    };

    if (posts.length === 0) {
        return (
            <div className="text-center py-20 text-slate-500">
                등록된 칼럼이 없습니다.
            </div>
        );
    }

    return (
        <>
            <Masonry
                breakpointCols={breakpointColumnsObj}
                className="my-masonry-grid"
                columnClassName="my-masonry-grid_column"
            >
                {posts.map((post) => (
                    <div key={post.id} className="mb-6">
                        <ColumnCard post={post} />
                    </div>
                ))}
            </Masonry>

            <style jsx global>{`
                .my-masonry-grid {
                    display: flex;
                    margin-left: -24px;
                    width: auto;
                }
                .my-masonry-grid_column {
                    padding-left: 24px;
                    background-clip: padding-box;
                }
            `}</style>
        </>
    );
}
