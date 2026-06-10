'use client';

interface CohortMinimapProps {
  stats: { counts: Record<string, number> } | null;
  onTypeHover?: (type: string | null) => void;
  onTypeClick?: (type: string) => void;
}

const NODES = [
  { type: 'person', label: 'People', color: '#009AD7', x: 80, y: 100, shape: 'circle' },
  { type: 'organization', label: 'Orgs', color: '#002856', x: 80, y: 160, shape: 'rect' },
  { type: 'goal', label: 'Goals', color: '#16A34A', x: 230, y: 50, shape: 'triangle' },
  { type: 'project', label: 'Projects', color: '#D97706', x: 280, y: 120, shape: 'diamond' },
  { type: 'deal', label: 'Deals', color: '#B45309', x: 400, y: 100, shape: 'circle' },
  /* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css. */
  { type: 'system', label: 'Systems', color: '#78716c', x: 240, y: 185, shape: 'rect' },
  { type: 'task', label: 'Tasks', color: '#9CA3AF', x: 360, y: 170, shape: 'circle' },
];

const ARROWS = [
  { from: 'person', to: 'project', label: '' },
  { from: 'organization', to: 'system', label: '' },
  { from: 'project', to: 'goal', label: '' },
  { from: 'project', to: 'deal', label: '' },
  { from: 'system', to: 'deal', label: '' },
];

function getNodeCenter(type: string): { x: number; y: number } {
  return NODES.find(n => n.type === type) ?? { x: 0, y: 0 };
}

export default function CohortMinimap({ stats, onTypeHover, onTypeClick }: CohortMinimapProps) {
  const isEmpty = !stats || Object.values(stats.counts ?? {}).every(v => v === 0);
  const opacity = isEmpty ? 0.3 : 1;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox="0 0 560 220"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', maxWidth: 560, display: 'block' }}
      >
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#d6d3d1" />
          </marker>
        </defs>

        {ARROWS.map(({ from, to }) => {
          const f = getNodeCenter(from);
          const t = getNodeCenter(to);
          return (
            <line
              key={`${from}-${to}`}
              x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              stroke="#d6d3d1" strokeWidth="1.5"
              markerEnd="url(#arrow)"
              opacity={opacity}
            />
          );
        })}

        {NODES.map(({ type, label, color, x, y, shape }) => {
          const count = stats?.counts?.[type] ?? stats?.counts?.[`${type}s`] ?? 0;
          return (
            <g
              key={type}
              style={{ cursor: onTypeClick ? 'pointer' : 'default', opacity }}
              onClick={() => onTypeClick?.(type)}
              onMouseEnter={() => onTypeHover?.(type)}
              onMouseLeave={() => onTypeHover?.(null)}
            >
              <title>{label}: {count}</title>
              {shape === 'circle' && <circle cx={x} cy={y} r={14} fill={color} />}
              {shape === 'rect' && <rect x={x - 12} y={y - 10} width={24} height={20} rx={3} fill={color} />}
              {shape === 'triangle' && <polygon points={`${x},${y - 14} ${x - 12},${y + 8} ${x + 12},${y + 8}`} fill={color} />}
              {shape === 'diamond' && <polygon points={`${x},${y - 14} ${x + 14},${y} ${x},${y + 14} ${x - 14},${y}`} fill={color} />}
              <text x={x} y={y + 26} textAnchor="middle" fontSize={10} fill={color} fontWeight={600}>{label}</text>
              <text x={x} y={y + 37} textAnchor="middle" fontSize={9} fill="#a8a29e">{count}</text>
            </g>
          );
        })}

        {isEmpty && (
          <text x={280} y={115} textAnchor="middle" fontSize={12} fill="#a8a29e">
            Add your first contact — ⌘K to start
          </text>
        )}
      </svg>
    </div>
  );
}
