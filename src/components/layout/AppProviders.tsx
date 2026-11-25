"use client";

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/contexts/AuthContext';

const recordRoots = ['search', 'seasons', 'players', 'records', 'compare', 'history', 'data', 'games'];

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = pathname.split('/')[1];
  const isRecords = pathname === '/' || segment === 'stat' || segment === 'en' || recordRoots.includes(segment);
  return isRecords ? <>{children}</> : <AuthProvider>{children}</AuthProvider>;
}
