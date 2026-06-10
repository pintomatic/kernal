'use client';

interface FilterBarProps {
  showNodeTypes: Set<string>;
  onChange: (types: Set<string>) => void;
  expandedSystemId: number | null;
  apiError?: boolean;
  entityCounts?: Record<string, number>;
}

const CHIPS: { key: string; label: string; shapeClass: string; color: string }[] = [
  { key: 'person',       label: 'People',   shapeClass: 'sh-circle',  color: '#009AD7' },
  { key: 'organization', label: 'Orgs',     shapeClass: 'sh-square',  color: '#002856' },
  /* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css. */
  { key: 'system',       label: 'Systems',  shapeClass: 'sh-rect',    color: '#78716c' },
  { key: 'project',      label: 'Projects', shapeClass: 'sh-diamond', color: '#D97706' },
  { key: 'deal',         label: 'Deals',    shapeClass: 'sh-hex',     color: '#B45309' },
  { key: 'goal',         label: 'Goals',    shapeClass: 'sh-tri',     color: '#16A34A' },
  { key: 'code',         label: 'Code',     shapeClass: 'sh-code',    color: '#9CA3AF' },
];

export default function FilterBar({ showNodeTypes, onChange, expandedSystemId, apiError, entityCounts }: FilterBarProps) {
  const toggle = (key: string) => {
    if (key === 'code' && expandedSystemId === null) return;
    const next = new Set(showNodeTypes);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };

  return (
    <div className="canvas-toolbar">
      <div className="node-chips">
        {CHIPS.map(({ key, label, shapeClass, color }) => {
          const active = showNodeTypes.has(key);
          const isCodeDisabled = key === 'code' && expandedSystemId === null;
          const count = entityCounts?.[key];
          return (
            <button
              key={key}
              className={`nchip${active ? ' on' : ''}`}
              onClick={() => toggle(key)}
              disabled={isCodeDisabled}
              title={isCodeDisabled ? 'Expand a System first' : undefined}
              style={{ border: 'none', background: 'none', padding: 0, opacity: isCodeDisabled ? 0.4 : 1, cursor: isCodeDisabled ? 'not-allowed' : 'pointer' }}
            >
              <span
                className={`sh ${shapeClass}`}
                style={shapeClass !== 'sh-tri' && shapeClass !== 'sh-code' ? { background: color } : undefined}
              />
              {label}
              {count !== undefined && count > 0 && (
                <span className="n">{count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="canvas-tools">
        <div className="seg">
          <button className="on">Force</button>
          <button>Cluster</button>
          <button>Time</button>
        </div>
        <button className="btn ghost" title="Reset view" style={{ padding: '5px 8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {apiError && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, fontSize: 11, color: '#d97706', background: '#fef3c7', padding: '3px 14px', zIndex: 5 }}>
          ⚠ Connection issue — showing cached data
        </div>
      )}
    </div>
  );
}
