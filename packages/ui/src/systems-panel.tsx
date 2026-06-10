'use client';

import { useApi } from './config';
import type { EntityFocus } from './types';

interface SystemsPanelProps {
  onEntityClick: (entity: EntityFocus) => void;
  onExpandSystem: (systemId: number) => void;
}

function ContractSignal({ expiry }: { expiry?: string }) {
  if (!expiry) return <span style={{ fontSize: 10, color: '#16a34a' }}>✓</span>;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days <= 0) return <span style={{ fontSize: 10, color: '#dc2626' }}>🔴 Expired</span>;
  if (days <= 30) return <span style={{ fontSize: 10, color: '#dc2626' }}>🔴 {days}d</span>;
  if (days <= 90) return <span style={{ fontSize: 10, color: '#d97706' }}>⚠️ {days}d</span>;
  return <span style={{ fontSize: 10, color: '#16a34a' }}>✓ {days}d</span>;
}

export default function SystemsPanel({ onEntityClick, onExpandSystem }: SystemsPanelProps) {
  const { data, loading } = useApi<any>('/api/systems');

  const systems: any[] = data?.systems ?? [];

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--kd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Systems · {systems.length}
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--kd-ink-3)' }}>Loading…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {systems.map((sys: any) => (
          <div
            key={sys.id}
            onClick={() => onEntityClick({ type: 'system', id: sys.id, name: sys.name })}
            style={{ border: '1px solid var(--kd-line)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--kd-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--kd-ink-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sys.name}</span>
              {sys.type && (
                <span style={{ fontSize: 10, background: sys.type === 'internal' ? '#eff6ff' : '#fef3c7', color: sys.type === 'internal' ? '#1d4ed8' : '#92400e', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                  {sys.type}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--kd-ink-3)' }}>
              {sys.vendor && <span>{sys.vendor}</span>}
              <ContractSignal expiry={sys.contract_expiry} />
              {sys.has_graph && (
                /* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
                 * `</>` nodes chip: violet ink + violet-tinted bg → teal + teal-soft. */
                <button
                  onClick={e => { e.stopPropagation(); onExpandSystem(sys.id); }}
                  style={{ marginLeft: 'auto', background: '#ccfbf1', color: '#0f766e', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                >
                  {'</>'} nodes
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && systems.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--kd-ink-3)', padding: '12px 0', textAlign: 'center' }}>
          No systems found. Add systems via Kernal Pro.
        </div>
      )}
    </div>
  );
}
