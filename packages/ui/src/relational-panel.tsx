'use client';

import { useState } from 'react';
import { useApi } from './config';
import type { EntityFocus } from './types';

interface RelationalPanelProps {
  onEntityClick: (entity: EntityFocus) => void;
}

export default function RelationalPanel({ onEntityClick }: RelationalPanelProps) {
  const { data: stats, loading } = useApi<any>('/api/dashboard/stats');
  const [query, setQuery] = useState('');

  const topConnected: any[] = stats?.topConnected ?? [];
  const filtered = query
    ? topConnected.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : topConnected;

  return (
    <div style={{ padding: '12px 16px' }}>
      <input
        type="text"
        placeholder="Filter people…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--kd-line)', borderRadius: 8, fontSize: 12, outline: 'none', marginBottom: 12, color: 'var(--kd-ink-1)', background: 'var(--kd-bg)' }}
      />

      {loading && <div style={{ fontSize: 12, color: 'var(--kd-ink-3)', padding: '8px 0' }}>Loading…</div>}

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        People · {stats?.counts?.people ?? 0}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filtered.slice(0, 20).map((person: any, i: number) => (
          <button
            key={i}
            onClick={() => onEntityClick({ type: 'person', id: 0, name: person.name })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--kd-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {person.name.charAt(0)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kd-ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
              {person.org_name && <div style={{ fontSize: 11, color: 'var(--kd-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.org_name}</div>}
            </div>
            <span style={{ fontSize: 10, color: 'var(--kd-ink-3)', fontFamily: 'var(--kd-font-mono)', flexShrink: 0 }}>{person.connections}</span>
          </button>
        ))}
      </div>

      {stats?.counts?.organizations > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 6 }}>
            Organizations · {stats.counts.organizations}
          </div>
          <div style={{ fontSize: 12, color: 'var(--kd-ink-3)', padding: '4px 0' }}>
            {stats.counts.organizations} org{stats.counts.organizations !== 1 ? 's' : ''} in graph
          </div>
        </>
      )}
    </div>
  );
}
