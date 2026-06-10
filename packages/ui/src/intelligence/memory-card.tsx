'use client';

import { useState } from 'react';
import type { Memory } from './types';
import { INTEL_COLORS } from './types';

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 9999;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

interface MemoryCardProps {
  memory: Memory;
  onDelete?: (id: number) => void;
  onResolveConflict?: (id: number, action: 'supersede' | 'delete-older' | 'both-valid') => void;
  onMarkSuperseded?: (id: number) => void;
}

export default function MemoryCard({ memory, onDelete, onResolveConflict }: MemoryCardProps) {
  const [conflictOpen, setConflictOpen] = useState(false);
  const isObserved = memory.confidence === 'OBSERVED';

  const daysUntilExpiry = memory.expires_at ? daysBetween(memory.expires_at) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const hasConflict = !!memory.conflict_with && !memory.conflict_dismissed;

  const reinforcedLabel = memory.reinforcement_count > 1
    ? ` · ×${memory.reinforcement_count} reinforced`
    : '';

  const dateLabel = `${daysAgo(memory.last_reinforced_at)}d ago${reinforcedLabel}`;

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 8,
      background: '#fff',
      border: '1px solid #e7e5e4',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Confidence dot */}
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: isObserved ? INTEL_COLORS.observed : INTEL_COLORS.inferred,
          flexShrink: 0,
          marginTop: 5,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Memory text */}
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: '#1c1917',
            fontStyle: isObserved ? 'normal' : 'italic',
            margin: 0,
          }}>
            {memory.text}
          </p>

          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#78716c' }}>{dateLabel}</span>

            {isExpiringSoon && (
              <span style={{ fontSize: 11, color: INTEL_COLORS.expiring, fontStyle: 'italic' }}>
                expiring in {daysUntilExpiry}d
              </span>
            )}

            {hasConflict && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setConflictOpen(o => !o)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: '#fef3c7', color: '#92400e',
                    border: '1px solid #f59e0b', borderRadius: 4,
                    padding: '1px 6px', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  ⚠ Conflicts with older memory — resolve →
                </button>
                {conflictOpen && onResolveConflict && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                    background: '#fff', border: '1px solid #e7e5e4',
                    borderRadius: 8, boxShadow: '0 8px 24px rgba(28,25,23,.1)',
                    padding: 4, zIndex: 20, minWidth: 200,
                  }}>
                    {[
                      { action: 'supersede' as const, label: 'Mark older as superseded' },
                      { action: 'delete-older' as const, label: 'Delete older memory' },
                      { action: 'both-valid' as const, label: 'Both are valid' },
                    ].map(({ action, label }) => (
                      <div
                        key={action}
                        onClick={() => { onResolveConflict(memory.id, action); setConflictOpen(false); }}
                        style={{
                          padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                          borderRadius: 6, color: '#1c1917',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f5f4f0'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {memory.promoted_to_pattern && memory.promoted_pattern_title && (
              <span style={{
                fontSize: 11,
                color: INTEL_COLORS.accent,
                fontWeight: 500,
              }}>
                → Pattern: {memory.promoted_pattern_title}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={() => onDelete(memory.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#a8a29e', padding: '2px 4px', fontSize: 12, flexShrink: 0,
            }}
            title="Delete memory"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
