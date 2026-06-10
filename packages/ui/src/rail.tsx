'use client';

import type { LucideIcon } from 'lucide-react';
import { Network, Users, Server, Target, Lightbulb, MessageCircle } from 'lucide-react';

type RailSection = 'relational' | 'systems' | 'work' | 'intelligence';

interface RailProps {
  active: RailSection | null;
  tier: 'core' | 'pro';
  onSelect: (section: RailSection | null) => void;
  onKernieClick: () => void;
}

interface RailItem {
  section: RailSection | null;
  Icon: LucideIcon;
  label: string;
  proOnly: boolean;
}

const ITEMS: RailItem[] = [
  { section: null, Icon: Network, label: 'Graph', proOnly: false },
  { section: 'relational', Icon: Users, label: 'Relational', proOnly: false },
  { section: 'systems', Icon: Server, label: 'Systems', proOnly: true },
  { section: 'work', Icon: Target, label: 'Intent & Work', proOnly: true },
  { section: 'intelligence', Icon: Lightbulb, label: 'Intelligence', proOnly: true },
];

export default function Rail({ active, tier, onSelect, onKernieClick }: RailProps) {
  return (
    <div className="kd-rail">
      {ITEMS.map(({ section, Icon, label, proOnly }) => {
        const isActive = active === section && section !== null;
        const isProLocked = proOnly && tier === 'core';
        return (
          <div key={label} style={{ position: 'relative' }} title={label}>
            <button
              className={`kd-rail-icon${isActive ? ' active' : ''}`}
              onClick={() => {
                if (section === null) { onSelect(null); return; }
                if (active === section) { onSelect(null); } else { onSelect(section); }
              }}
              aria-label={label}
              aria-pressed={isActive}
            >
              <Icon size={20} />
              {isProLocked && <span className="kd-rail-badge">✦</span>}
            </button>
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      <div title="Kernie">
        <button
          className="kd-rail-icon"
          onClick={onKernieClick}
          aria-label="Open Kernie chat"
        >
          <MessageCircle size={20} />
        </button>
      </div>
    </div>
  );
}
