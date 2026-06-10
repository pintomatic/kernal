'use client';

import type { EntityFocus } from './types';
import RelationalPanel from './relational-panel';
import SystemsPanel from './systems-panel';
import WorkBoard from './work-board';
import IntelligencePanel from './intelligence-panel';

type RailSection = 'relational' | 'systems' | 'work' | 'intelligence';

interface ContextPanelProps {
  section: RailSection | null;
  tier: 'core' | 'pro';
  onEntityClick: (entity: EntityFocus) => void;
  onExpandSystem: (systemId: number) => void;
  onClose: () => void;
}

const SECTION_LABELS: Record<RailSection, string> = {
  relational: 'Relational',
  systems: 'Systems',
  work: 'Intent & Work',
  intelligence: 'Intelligence',
};

export default function ContextPanel({ section, tier, onEntityClick, onExpandSystem, onClose }: ContextPanelProps) {
  const isOpen = section !== null;
  const width = section === 'work' ? 680 : 320;

  return (
    <div
      className="kd-context-panel"
      style={{
        width: isOpen ? width : 0,
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'width 200ms ease-out',
      }}
    >
      {section && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', padding: '10px 16px',
            borderBottom: '1px solid var(--kd-line)', background: 'white',
            position: 'sticky', top: 0, zIndex: 5,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--kd-ink-1)' }}>{SECTION_LABELS[section]}</span>
            {tier === 'core' && (section === 'systems' || section === 'work' || section === 'intelligence') && (
              <span style={{ marginLeft: 8, fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>Pro</span>
            )}
            <button
              onClick={onClose}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--kd-ink-3)', fontSize: 16, lineHeight: 1, padding: 4 }}
              aria-label="Close panel"
            >✕</button>
          </div>

          {section === 'relational' && <RelationalPanel onEntityClick={onEntityClick} />}
          {section === 'systems' && <SystemsPanel onEntityClick={onEntityClick} onExpandSystem={onExpandSystem} />}
          {section === 'work' && <WorkBoard />}
          {section === 'intelligence' && <IntelligencePanel />}
        </>
      )}
    </div>
  );
}
