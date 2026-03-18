import { useApi, type StatsData } from '../hooks/useKernalApi';

export default function Overview() {
  const { data, loading, error } = useApi<StatsData>('/api/dashboard/stats');

  if (loading) return <div className="text-zinc-500 animate-pulse py-8 text-center">Loading overview...</div>;
  if (error) return <div className="text-red-400 py-4">{error}</div>;
  if (!data) return null;

  const { counts, topConnected, activityBreakdown } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="People" value={counts.people} />
        <StatCard label="Organizations" value={counts.organizations} />
        <StatCard label="Activities" value={counts.activities} />
        <StatCard label="Topics" value={counts.topics} />
        <StatCard label="Open Actions" value={counts.actions_open} accent={counts.actions_open > 0 ? 'amber' : undefined} />
        <StatCard label="Relationships" value={counts.relationships} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Connected */}
        {topConnected.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Most Connected People</h3>
            <div className="space-y-3">
              {topConnected.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-zinc-200">{p.name}</span>
                    {(p.role || p.org_name) && (
                      <span className="text-xs text-zinc-500 ml-2">
                        {[p.role, p.org_name].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, (p.connections / (topConnected[0]?.connections || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-6 text-right">{p.connections}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Breakdown */}
        {activityBreakdown.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Activity Breakdown</h3>
            <div className="space-y-3">
              {activityBreakdown.map((a, i) => {
                const total = activityBreakdown.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? (a.count / total) * 100 : 0;
                const colors: Record<string, string> = {
                  meeting: 'bg-blue-500', call: 'bg-green-500', email: 'bg-zinc-500',
                  event: 'bg-violet-500', intro: 'bg-amber-500', other: 'bg-zinc-600',
                };
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 capitalize">{a.type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${colors[a.type] || 'bg-zinc-600'} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 w-6 text-right">{a.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
      <div className={`text-2xl font-semibold ${accent === 'amber' ? 'text-amber-400' : 'text-zinc-100'}`}>
        {value}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}
