interface SourceBadgeProps {
  source: string;
}

const SOURCE_COLORS: Record<string, string> = {
  ESPN: 'bg-red-900/40 text-red-400',
  'The Athletic': 'bg-blue-900/40 text-blue-400',
  'Bleacher Report': 'bg-orange-900/40 text-orange-400',
  'NBA.com': 'bg-indigo-900/40 text-indigo-400',
};

export function SourceBadge({ source }: SourceBadgeProps) {
  const color = SOURCE_COLORS[source] || 'bg-slate-800 text-slate-400';
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {source}
    </span>
  );
}
