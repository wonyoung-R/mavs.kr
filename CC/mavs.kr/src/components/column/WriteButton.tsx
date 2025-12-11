'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { PenTool } from 'lucide-react';
import Link from 'next/link';

export default function WriteButton() {
    const { user, isColumnist, loading } = useAuth();

    // Prevent hydration mismatch or flashing by waiting for auth load
    if (loading) return null;

    // Hide button only if user is logged in but NOT a columnist
    if (user && !isColumnist) return null;

    const href = user ? '/column/new' : '/login';

    return (
        <Link href={href}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <PenTool className="w-4 h-4" />
                칼럼 기고하기
            </Button>
        </Link>
    );
}
