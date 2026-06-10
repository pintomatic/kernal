'use client';

import { useApi, type StatsData } from './config';
import CohortMinimap from './cohort-minimap';

const STAT_CARDS = [
  { key: 'people', label: 'People', color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'organizations', label: 'Organizations', color: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'deals', label: 'Deals', color: 'text-sky-600', bg: 'bg-sky-50' },
  { key: 'goals', label: 'Goals', color: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'activities', label: 'Activities', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'actions', label: 'Actions', color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'relationships', label: 'Relationships', color: 'text-stone-600', bg: 'bg-stone-100' },
  { key: 'patterns', label: 'Patterns', color: 'text-cyan-600', bg: 'bg-cyan-50' },
] as const;

function ActivityPulse({ activities }: { activities?: any[] }) {
  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  if (activities) {
    for (const act of activities) {
      const key = act.date?.slice(0, 10);
      const slot = days.find(d => d.date === key);
      if (slot) slot.count += 1;
    }
  }
  const maxCount = Math.max(...days.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 68, padding: '0 4px' }}>
      {days.map(({ date, count }) => {
        const pct = count / maxCount;
        const barH = Math.max(4, Math.round(pct * 60));
        return (
          <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${date}: ${count} activities`}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <div style={{ width: '100%', height: barH, background: count > 0 ? '#0d9488' : 'rgba(214,211,209,0.3)', borderRadius: 3, transition: 'height 300ms ease' }} />
            </div>
            <span style={{ fontSize: 9, color: '#a8a29e', fontFamily: 'var(--kd-font-mono)' }}>{date.slice(8)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Overview() {
  const { data, loading, error } = useApi<StatsData>('/api/dashboard/stats');
  const { data: timelineData } = useApi<any>('/api/dashboard/timeline?limit=20');

  if (loading) return (
    <div className="space-y-6" style={{ padding: 16 }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 animate-pulse">
            <div className="h-7 w-12 bg-stone-100 rounded mb-1" />
            <div className="h-3 w-16 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
  if (error) return <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>;
  if (!data) return null;

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6" style={{ padding: 16 }}>
      {/* Cohort Minimap */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="text-sm font-semibold text-stone-900 mb-3">Knowledge Graph</h3>
        <CohortMinimap stats={data} />
      </div>

      {/* Activity Pulse */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="text-sm font-semibold text-stone-900 mb-3">Activity (last 7 days)</h3>
        <ActivityPulse activities={timelineData?.activities} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {STAT_CARDS.map((stat, i) => (
          <div key={stat.key} className="bg-white rounded-xl border border-stone-200 p-4 card-hover animate-in hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-150 cursor-default" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`text-2xl font-semibold tracking-tight ${stat.color}`}>
              {(data.counts[stat.key] ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-stone-500 mt-0.5 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-stone-200 p-5 animate-in" style={{ animationDelay: '200ms' }}>
          <h3 className="text-sm font-semibold text-stone-900 mb-4">Most Connected People</h3>
          {data.topConnected.length === 0 && (
            <div className="py-6 text-center">
              <div className="text-stone-300 text-2xl mb-2">--</div>
              <p className="text-xs text-stone-400">No connections yet. Add activities to build your network graph.</p>
            </div>
          )}
          <div className="space-y-3">
            {data.topConnected.map((person, i) => {
              const maxC = data.topConnected[0]?.connections || 1;
              const pct = (person.connections / maxC) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--olive)/0.12)] text-[hsl(var(--olive))] flex items-center justify-center text-xs font-semibold shrink-0">
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-stone-900 truncate">{person.name}</span>
                      <span className="text-xs text-stone-400 truncate hidden sm:inline">{person.org_name}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[hsl(var(--olive))] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-mono text-stone-500 tabular-nums w-8 text-right">{person.connections}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-5 animate-in" style={{ animationDelay: '300ms' }}>
          <h3 className="text-sm font-semibold text-stone-900 mb-4">Activity Breakdown</h3>
          <div className="space-y-3">
            {data.activityBreakdown.map((act, i) => {
              const maxC = data.activityBreakdown[0]?.count || 1;
              const pct = (act.count / maxC) * 100;
              const colors: Record<string, string> = { meeting: 'bg-blue-500', call: 'bg-emerald-500', email: 'bg-stone-400', event: 'bg-violet-500', intro: 'bg-amber-500', other: 'bg-stone-300' };
              const cls = colors[act.type] || colors.other;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${cls}`} />
                  <span className="text-sm text-stone-700 capitalize w-20">{act.type}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${cls}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono text-stone-500 tabular-nums w-14 text-right">{act.count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-stone-100">
            <div className="text-xs text-stone-400 mb-1">Knowledge Density</div>
            <div className="text-2xl font-semibold text-[hsl(var(--olive))] tracking-tight">{total.toLocaleString()}</div>
            <div className="text-xs text-stone-500">total entities in your knowledge graph</div>
          </div>
        </div>
      </div>
    </div>
  );
}
