import { getSourceColor, getSourceIcon } from '@/lib/utils/news-utils';

interface SourceBadgeProps {
  source: string;
  className?: string;
  showIcon?: boolean;
}

export function SourceBadge({ source, className = '', showIcon = true }: SourceBadgeProps) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${getSourceColor(source)} ${className}`}>
      {showIcon && `${getSourceIcon(source)} `}
      {source}
    </span>
  );
}


