'use client';

interface MobileBlockProps {
  stats?: any;
}

export default function MobileBlock({ stats }: MobileBlockProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '32px 24px', textAlign: 'center', background: 'var(--kd-bg)' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--kd-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="28" height="28" viewBox="0 0 40 40">
          <text x="20" y="27" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="system-ui">K</text>
        </svg>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--kd-ink-1)', marginBottom: 8 }}>Kernal Dashboard</h2>
      <p style={{ fontSize: 14, color: 'var(--kd-ink-3)', lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
        Kernal is a desktop intelligence tool. Open on a laptop or desktop for the full experience.
      </p>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 280 }}>
          {[
            { label: 'People', val: stats.counts?.people ?? 0, color: '#009AD7' },
            { label: 'Orgs', val: stats.counts?.organizations ?? 0, color: '#002856' },
            { label: 'Relationships', val: stats.counts?.relationships ?? 0, color: '#0f766e' },
            { label: 'Activities', val: stats.counts?.activities ?? 0, color: '#16a34a' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: 'white', border: '1px solid var(--kd-line)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 11, color: 'var(--kd-ink-3)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
