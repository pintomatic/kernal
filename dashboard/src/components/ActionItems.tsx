import { useApi, type ActionsData } from '../hooks/useKernalApi';

export default function ActionItems() {
  const { data, loading, error } = useApi<ActionsData>('/api/dashboard/actions?status=open');

  if (loading) return <div className="text-[hsl(var(--andes-text-muted))] animate-pulse py-8 text-center">Loading actions...</div>;
  if (error) return <div className="text-[hsl(var(--andes-error))] py-4">{error}</div>;
  if (!data || data.count === 0) return <div className="text-[hsl(var(--andes-text-muted))] py-8 text-center">No open action items.</div>;

  const { grouped } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {grouped.overdue.length > 0 && (
        <ActionGroup title="Overdue" items={grouped.overdue} accent="red" />
      )}
      {grouped.this_week.length > 0 && (
        <ActionGroup title="Due This Week" items={grouped.this_week} accent="amber" />
      )}
      {grouped.upcoming.length > 0 && (
        <ActionGroup title="Upcoming" items={grouped.upcoming} accent="olive" />
      )}
      {grouped.no_date.length > 0 && (
        <ActionGroup title="No Due Date" items={grouped.no_date} accent="stone" />
      )}
    </div>
  );
}

function ActionGroup({ title, items, accent }: {
  title: string;
  items: Array<{ id: number; title: string; due_date: string | null; owner_name: string | null }>;
  accent: string;
}) {
  const accentColors: Record<string, { badge: string; border: string; dot: string }> = {
    red: { badge: 'bg-red-100 text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
    amber: { badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    olive: { badge: 'bg-[hsl(var(--andes-olive)/0.15)] text-[hsl(var(--andes-olive-dark))]', border: 'border-[hsl(var(--andes-olive)/0.2)]', dot: 'bg-[hsl(var(--andes-olive))]' },
    stone: { badge: 'bg-stone-100 text-stone-600', border: 'border-[hsl(var(--andes-border))]', dot: 'bg-stone-400' },
  };
  const colors = accentColors[accent] || accentColors.stone;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <h3 className="text-sm font-medium text-[hsl(var(--andes-text-secondary))]">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className={`bg-white border ${colors.border} rounded-lg px-4 py-3 hover:shadow-[var(--andes-shadow-sm)] transition-all`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-[hsl(var(--andes-text-muted))] mt-0.5 text-sm">[ ]</span>
                <div>
                  <p className="text-sm text-[hsl(var(--andes-text))]">{item.title}</p>
                  {item.owner_name && (
                    <p className="text-xs text-[hsl(var(--andes-text-muted))] mt-0.5">Assigned to {item.owner_name}</p>
                  )}
                </div>
              </div>
              {item.due_date && (
                <span className="text-xs text-[hsl(var(--andes-text-muted))] whitespace-nowrap">{item.due_date}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
