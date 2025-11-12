import { formatTimeAgo } from '@/lib/utils/news-utils';
import { Clock } from 'lucide-react';

interface TimeBadgeProps {
  published: string;
  className?: string;
  showIcon?: boolean;
}

export function TimeBadge({ published, className = '', showIcon = true }: TimeBadgeProps) {
  return (
    <div className={`flex items-center gap-1 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full ${className}`}>
      {showIcon && <Clock className="w-3 h-3" />}
      <span>{formatTimeAgo(published)}</span>
    </div>
  );
}


