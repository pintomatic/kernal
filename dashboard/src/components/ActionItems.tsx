import { useApi, type ActionsData } from '../hooks/useKernalApi';

export default function ActionItems() {
  const { data, loading, error } = useApi<ActionsData>('/api/dashboard/actions?status=open');

  if (loading) return <div className="text-zinc-500 animate-pulse py-8 text-center">Loading actions...</div>;
  if (error) return <div className="text-red-400 py-4">{error}</div>;
  if (!data || data.count === 0) return <div className="text-zinc-500 py-8 text-center">No open action items.</div>;

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
        <ActionGroup title="Upcoming" items={grouped.upcoming} accent="blue" />
      )}
      {grouped.no_date.length > 0 && (
        <ActionGroup title="No Due Date" items={grouped.no_date} accent="zinc" />
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
    red: { badge: 'bg-red-500/20 text-red-400', border: 'border-red-900/30', dot: 'bg-red-500' },
    amber: { badge: 'bg-amber-500/20 text-amber-400', border: 'border-amber-900/30', dot: 'bg-amber-500' },
    blue: { badge: 'bg-blue-500/20 text-blue-400', border: 'border-blue-900/30', dot: 'bg-blue-500' },
    zinc: { badge: 'bg-zinc-500/20 text-zinc-400', border: 'border-zinc-800', dot: 'bg-zinc-500' },
  };
  const colors = accentColors[accent] || accentColors.zinc;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className={`bg-zinc-900 border ${colors.border} rounded-lg px-4 py-3 hover:border-zinc-700 transition-colors`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-zinc-500 mt-0.5 text-sm">[ ]</span>
                <div>
                  <p className="text-sm text-zinc-200">{item.title}</p>
                  {item.owner_name && (
                    <p className="text-xs text-zinc-500 mt-0.5">Assigned to {item.owner_name}</p>
                  )}
                </div>
              </div>
              {item.due_date && (
                <span className="text-xs text-zinc-500 whitespace-nowrap">{item.due_date}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
