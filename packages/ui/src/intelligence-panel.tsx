'use client';

import { useApi } from './config';

export default function IntelligencePanel() {
  const { data: patternsData } = useApi<any>('/api/patterns?limit=5');
  const { data: memoriesData } = useApi<any>('/api/dashboard/memories?limit=6');
  const { data: timelineData } = useApi<any>('/api/dashboard/timeline?limit=5');

  const patterns: any[] = patternsData?.patterns ?? [];
  const memories: any[] = memoriesData?.memories ?? [];
  const activities: any[] = timelineData?.activities ?? [];

  return (
    <div style={{ padding: '12px 16px' }}>
      {patterns.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Patterns</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {patterns.map((p: any) => (
              <div key={p.id} style={{ border: '1px solid var(--kd-line)', borderRadius: 8, padding: '8px 10px', background: 'white' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--kd-ink-1)', marginBottom: 2 }}>{p.title || p.name}</div>
                {p.summary && <div style={{ fontSize: 11, color: 'var(--kd-ink-3)', lineHeight: 1.4 }}>{p.summary?.slice(0, 80)}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {memories.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recent Memories</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {memories.map((m: any) => (
              <div key={m.id} style={{ border: '1px solid var(--kd-line)', borderRadius: 8, padding: '8px 10px', background: 'white' }}>
                <div style={{ fontSize: 12, color: 'var(--kd-ink-1)', lineHeight: 1.4 }}>{m.content?.slice(0, 80)}</div>
                <div style={{ fontSize: 10, color: 'var(--kd-ink-3)', marginTop: 3 }}>{m.created_at?.slice(0, 10)} · {m.category}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {activities.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recent Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activities.map((a: any) => (
              <div key={a.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--kd-bg)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {a.type === 'meeting' ? 'MT' : a.type === 'call' ? 'CL' : 'AC'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--kd-ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--kd-ink-3)' }}>{a.date}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {patterns.length === 0 && memories.length === 0 && activities.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--kd-ink-3)', textAlign: 'center', padding: '20px 0' }}>
          No intelligence data yet. Add activities and patterns to see insights here.
        </div>
      )}
    </div>
  );
}
