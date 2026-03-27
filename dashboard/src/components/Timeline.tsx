import { useApi, type TimelineData } from '../hooks/useKernalApi';

const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  meeting: { color: 'bg-[hsl(var(--andes-data-people))]', icon: '🤝' },
  call: { color: 'bg-[hsl(var(--andes-success))]', icon: '📞' },
  email: { color: 'bg-[hsl(var(--andes-text-muted))]', icon: '📧' },
  event: { color: 'bg-[hsl(var(--andes-data-orgs))]', icon: '🎪' },
  intro: { color: 'bg-[hsl(var(--andes-data-actions))]', icon: '👋' },
  other: { color: 'bg-[hsl(var(--andes-text-muted))]', icon: '📌' },
};

interface Props {
  entity?: string;
}

export default function Timeline({ entity }: Props) {
  const path = entity
    ? `/api/dashboard/timeline?entity=${encodeURIComponent(entity)}`
    : '/api/dashboard/timeline';
  const { data, loading, error } = useApi<TimelineData>(path);

  if (loading) return <div className="text-[hsl(var(--andes-text-muted))] animate-pulse py-8 text-center">Loading timeline...</div>;
  if (error) return <div className="text-[hsl(var(--andes-error))] py-4">{error}</div>;
  if (!data || data.activities.length === 0) return <div className="text-[hsl(var(--andes-text-muted))] py-8 text-center">No activities found{entity ? ` for "${entity}"` : ''}.</div>;

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
        <h2 className="text-lg font-medium text-[hsl(var(--andes-text-secondary))] mb-6">Timeline: {entity}</h2>
      )}
      <div className="relative pl-8 border-l-2 border-[hsl(var(--andes-border))] space-y-8">
        {[...grouped.entries()].map(([date, activities]) => (
          <div key={date}>
            <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-[hsl(var(--andes-bg-muted))] border-2 border-[hsl(var(--andes-bg))]" />
            <div className="text-sm font-medium text-[hsl(var(--andes-text-secondary))] mb-3">{formatDate(date)}</div>
            <div className="space-y-3">
              {activities.map(act => {
                const config = TYPE_CONFIG[act.type] || TYPE_CONFIG.other;
                return (
                  <div key={act.id} className="bg-white border border-[hsl(var(--andes-border))] rounded-lg p-4 hover:border-[hsl(var(--andes-olive-light))] hover:shadow-[var(--andes-shadow-sm)] transition-all">
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${config.color}`} />
                          <span className="font-medium text-[hsl(var(--andes-text))] text-sm">{act.title || act.type}</span>
                          <span className="text-xs text-[hsl(var(--andes-text-muted))]">{act.type}</span>
                        </div>
                        {act.participants.length > 0 && (
                          <div className="text-xs text-[hsl(var(--andes-text-secondary))] mb-1.5">
                            {act.participants.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ')}
                          </div>
                        )}
                        {act.organizations.length > 0 && (
                          <div className="text-xs text-[hsl(var(--andes-data-orgs))] mb-1.5">
                            {act.organizations.join(', ')}
                          </div>
                        )}
                        {act.summary && (
                          <p className="text-xs text-[hsl(var(--andes-text-muted))] leading-relaxed line-clamp-2">
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
