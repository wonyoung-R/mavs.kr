import { Button } from '@/components/ui/Button';
import { NEWS_FILTERS } from '@/lib/utils/news-utils';

interface NewsFilterButtonsProps {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
}

export function NewsFilterButtons({ currentFilter, onFilterChange }: NewsFilterButtonsProps) {
  return (
    <div className="flex gap-2">
      {NEWS_FILTERS.map(filter => {
        const isActive = currentFilter === filter.id;
        const colorClasses = {
          blue: isActive
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-slate-700/50 text-blue-300 hover:bg-slate-600/50 border border-blue-500/30',
          red: isActive
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-slate-700/50 text-red-300 hover:bg-slate-600/50 border border-red-500/30',
          orange: isActive
            ? 'bg-orange-600 text-white hover:bg-orange-700'
            : 'bg-slate-700/50 text-orange-300 hover:bg-slate-600/50 border border-orange-500/30',
          green: isActive
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-slate-700/50 text-green-300 hover:bg-slate-600/50 border border-green-500/30',
        };

        return (
          <Button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            size="sm"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${colorClasses[filter.color]}`}
          >
            {filter.label}
          </Button>
        );
      })}
    </div>
  );
}


