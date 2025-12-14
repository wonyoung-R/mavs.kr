'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteColumn } from '@/app/actions/column';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps {
    postId: string;
}

export default function DeleteButton({ postId }: DeleteButtonProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm('정말로 이 칼럼을 삭제하시겠습니까?')) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteColumn(postId);
            router.push('/?tab=column');
        } catch (error) {
            console.error('Delete failed:', error);
            alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
            setIsDeleting(false);
        }
    };

    return (
        <Button
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleDelete}
            disabled={isDeleting}
        >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? '삭제 중...' : '삭제'}
        </Button>
    );
}
