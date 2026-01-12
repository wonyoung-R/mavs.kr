'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Pencil } from 'lucide-react';

interface EditButtonProps {
    postId: string;
}

export default function EditButton({ postId }: EditButtonProps) {
    const router = useRouter();

    const handleEdit = () => {
        router.push(`/column/new?edit=${postId}`);
    };

    return (
        <Button
            variant="ghost"
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            onClick={handleEdit}
        >
            <Pencil className="w-4 h-4 mr-2" />
            수정
        </Button>
    );
}

