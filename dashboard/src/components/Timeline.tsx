import { useApi, type TimelineData } from '../hooks/useKernalApi';

const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  meeting: { color: 'bg-blue-500', icon: '🤝' },
  call: { color: 'bg-green-500', icon: '📞' },
  email: { color: 'bg-zinc-500', icon: '📧' },
  event: { color: 'bg-violet-500', icon: '🎪' },
  intro: { color: 'bg-amber-500', icon: '👋' },
  other: { color: 'bg-zinc-600', icon: '📌' },
};

interface Props {
  entity?: string;
}

export default function Timeline({ entity }: Props) {
  const path = entity
    ? `/api/dashboard/timeline?entity=${encodeURIComponent(entity)}`
    : '/api/dashboard/timeline';
  const { data, loading, error } = useApi<TimelineData>(path);

  if (loading) return <div className="text-zinc-500 animate-pulse py-8 text-center">Loading timeline...</div>;
  if (error) return <div className="text-red-400 py-4">{error}</div>;
  if (!data || data.activities.length === 0) return <div className="text-zinc-500 py-8 text-center">No activities found{entity ? ` for "${entity}"` : ''}.</div>;

  // Group by date
  const grouped = new Map<string, typeof data.activities>();
  for (const act of data.activities) {
    const date = act.date || 'Undated';
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(act);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {entity && (
        <h2 className="text-lg font-medium text-zinc-300 mb-6">Timeline: {entity}</h2>
      )}
      <div className="relative pl-8 border-l-2 border-zinc-800 space-y-8">
        {[...grouped.entries()].map(([date, activities]) => (
          <div key={date}>
            <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-zinc-700 border-2 border-zinc-950" />
            <div className="text-sm font-medium text-zinc-400 mb-3">{formatDate(date)}</div>
            <div className="space-y-3">
              {activities.map(act => {
                const config = TYPE_CONFIG[act.type] || TYPE_CONFIG.other;
                return (
                  <div key={act.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${config.color}`} />
                          <span className="font-medium text-zinc-200 text-sm">{act.title || act.type}</span>
                          <span className="text-xs text-zinc-500">{act.type}</span>
                        </div>
                        {act.participants.length > 0 && (
                          <div className="text-xs text-zinc-400 mb-1.5">
                            {act.participants.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ')}
                          </div>
                        )}
                        {act.organizations.length > 0 && (
                          <div className="text-xs text-violet-400 mb-1.5">
                            {act.organizations.join(', ')}
                          </div>
                        )}
                        {act.summary && (
                          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                            {act.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (dateStr === 'Undated') return dateStr;
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
