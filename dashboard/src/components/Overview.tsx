import { useApi, type StatsData } from '../hooks/useKernalApi';

export default function Overview() {
  const { data, loading, error } = useApi<StatsData>('/api/dashboard/stats');

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-[hsl(var(--andes-border))] rounded-xl p-4 text-center animate-pulse">
            <div className="h-7 w-12 mx-auto bg-[hsl(var(--andes-bg-muted))] rounded mb-2" />
            <div className="h-3 w-16 mx-auto bg-[hsl(var(--andes-bg-muted))] rounded" />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-[hsl(var(--andes-border))] rounded-xl p-5 animate-pulse">
            <div className="h-4 w-32 bg-[hsl(var(--andes-bg-muted))] rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-5 bg-[hsl(var(--andes-bg-muted))] rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (error) return <div className="text-[hsl(var(--andes-error))] py-4">{error}</div>;
  if (!data) return null;

  const { counts, topConnected, activityBreakdown } = data;
  const allZero = Object.values(counts).every((v) => v === 0);

  if (allZero) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="text-4xl mb-4 opacity-30">--</div>
        <h3 className="text-lg font-medium text-[hsl(var(--andes-text))] mb-2">No data yet</h3>
        <p className="text-sm text-[hsl(var(--andes-text-muted))]">Start adding people and activities through the MCP tools to populate your knowledge graph.</p>
      </div>
    );
  }

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
        <div className="bg-white border border-[hsl(var(--andes-border))] rounded-xl p-5 shadow-[var(--andes-shadow-sm)]">
          <h3 className="text-sm font-medium text-[hsl(var(--andes-text-secondary))] mb-4">Most Connected People</h3>
          {topConnected.length === 0 && (
            <div className="py-6 text-center">
              <div className="text-[hsl(var(--andes-text-muted))] text-2xl mb-2 opacity-30">--</div>
              <p className="text-xs text-[hsl(var(--andes-text-muted))]">No connections yet. Add activities to build your network.</p>
            </div>
          )}
          {topConnected.length > 0 && (
            <div className="space-y-3">
              {topConnected.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-[hsl(var(--andes-text))]">{p.name}</span>
                    {(p.role || p.org_name) && (
                      <span className="text-xs text-[hsl(var(--andes-text-muted))] ml-2">
                        {[p.role, p.org_name].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-[hsl(var(--andes-bg-muted))] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[hsl(var(--andes-olive))] rounded-full"
                        style={{ width: `${Math.min(100, (p.connections / (topConnected[0]?.connections || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-[hsl(var(--andes-text-muted))] w-6 text-right">{p.connections}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Breakdown */}
        <div className="bg-white border border-[hsl(var(--andes-border))] rounded-xl p-5 shadow-[var(--andes-shadow-sm)]">
          <h3 className="text-sm font-medium text-[hsl(var(--andes-text-secondary))] mb-4">Activity Breakdown</h3>
          {activityBreakdown.length === 0 && (
            <div className="py-6 text-center">
              <div className="text-[hsl(var(--andes-text-muted))] text-2xl mb-2 opacity-30">--</div>
              <p className="text-xs text-[hsl(var(--andes-text-muted))]">No activities recorded yet.</p>
            </div>
          )}
          {activityBreakdown.length > 0 && (
            <div className="space-y-3">
              {activityBreakdown.map((a, i) => {
                const total = activityBreakdown.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? (a.count / total) * 100 : 0;
                const colors: Record<string, string> = {
                  meeting: 'bg-[hsl(var(--andes-data-people))]', call: 'bg-[hsl(var(--andes-success))]', email: 'bg-[hsl(var(--andes-text-muted))]',
                  event: 'bg-[hsl(var(--andes-data-orgs))]', intro: 'bg-[hsl(var(--andes-data-actions))]', other: 'bg-[hsl(var(--andes-text-muted))]',
                };
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--andes-text-secondary))] capitalize">{a.type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-[hsl(var(--andes-bg-muted))] rounded-full overflow-hidden">
                        <div className={`h-full ${colors[a.type] || 'bg-[hsl(var(--andes-text-muted))]'} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[hsl(var(--andes-text-muted))] w-6 text-right">{a.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white border border-[hsl(var(--andes-border))] rounded-xl p-4 text-center shadow-[var(--andes-shadow-sm)] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-150 cursor-default">
      <div className={`text-2xl font-semibold ${accent === 'amber' ? 'text-[hsl(var(--andes-warning))]' : 'text-[hsl(var(--andes-text))]'}`}>
        {value}
      </div>
      <div className="text-xs text-[hsl(var(--andes-text-muted))] mt-1">{label}</div>
    </div>
  );
}
