'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteCommunityPost } from '@/app/actions/community';

interface DeleteButtonProps {
    postId: string;
}

export default function CommunityDeleteButton({ postId }: DeleteButtonProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) {
            return;
        }

        setIsDeleting(true);

        try {
            await deleteCommunityPost(postId);
            router.push('/?tab=community');
        } catch (error) {
            console.error('Delete failed:', error);
            alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleDelete}
            disabled={isDeleting}
        >
            <Trash2 className="w-4 h-4 mr-1" />
            {isDeleting ? '삭제중...' : '삭제'}
        </Button>
    );
}

