'use client';

import { useState } from 'react';
import type { Pattern } from './types';
import { INTEL_COLORS } from './types';

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PatternCardProps {
  pattern: Pattern;
  onReclassify?: (id: number, toType: 'RULE' | 'HEURISTIC') => void;
  onAddCounterExample?: (id: number, note: string) => void;
  onReconfirm?: (id: number, note: string) => void;
  onDeprecate?: (id: number) => void;
}

export default function PatternCard({ pattern, onReclassify, onAddCounterExample, onReconfirm, onDeprecate }: PatternCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [counterNote, setCounterNote] = useState('');
  const [reconfirmNote, setReconfirmNote] = useState('');
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [showReconfirmInput, setShowReconfirmInput] = useState(false);

  const isRule = pattern.type === 'RULE';
  const isChallenged = pattern.status === 'CHALLENGED';
  const isDeprecated = pattern.status === 'DEPRECATED';

  const statusColor = {
    ACTIVE: INTEL_COLORS.active,
    CHALLENGED: INTEL_COLORS.challenged,
    DEPRECATED: INTEL_COLORS.deprecated,
  }[pattern.status];

  const lastSeen = daysAgo(pattern.last_reinforced_at);

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isChallenged ? '#f59e0b' : '#e7e5e4'}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
      opacity: isDeprecated ? 0.65 : 1,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontWeight: 700,
            fontSize: 13,
            color: '#1c1917',
            textDecoration: isDeprecated ? 'line-through' : 'none',
          }}>
            {pattern.title}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
          {/* Type badge */}
          {isRule ? (
            <span style={{
              background: INTEL_COLORS.ruleBadge, color: '#fff',
              padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.05em',
            }}>RULE</span>
          ) : (
            <span style={{
              background: '#fff', color: INTEL_COLORS.heuristicBorder,
              border: `1.5px solid ${INTEL_COLORS.heuristicBorder}`,
              padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.05em',
            }}>HEURISTIC</span>
          )}

          {/* Domain badge */}
          <span style={{
            background: '#f5f4f0', color: '#57534e',
            padding: '2px 6px', borderRadius: 4, fontSize: 10,
          }}>{pattern.domain}</span>

          {/* Status chip */}
          <span style={{
            background: `${statusColor}15`,
            color: statusColor,
            padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          }}>{pattern.status}</span>
        </div>
      </div>

      {/* Evidence line */}
      <div style={{ marginTop: 6, fontSize: 11, color: '#78716c' }}>
        {isRule
          ? `${pattern.observation_count} observation${pattern.observation_count !== 1 ? 's' : ''} · ${pattern.violation_count} violation${pattern.violation_count !== 1 ? 's' : ''} · first learned ${formatDate(pattern.first_observed_at)}`
          : `Confirmed ${pattern.confirmation_count}/${pattern.confirmation_count + pattern.counter_example_count} · ${pattern.counter_example_count} counter-example${pattern.counter_example_count !== 1 ? 's' : ''} · first learned ${formatDate(pattern.first_observed_at)}`
        }
      </div>

      {/* Last reinforced */}
      <div style={{ marginTop: 2, fontSize: 11, color: '#a8a29e' }}>
        last reinforced {lastSeen === 0 ? 'today' : `${lastSeen}d ago`}
      </div>

      {/* Apply when */}
      {pattern.apply_when && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#57534e' }}>
          <span style={{ fontWeight: 600 }}>APPLY WHEN:</span> {pattern.apply_when}
        </div>
      )}

      {/* CHALLENGED call-out */}
      {isChallenged && (
        <div style={{ marginTop: 8 }}>
          {!showReconfirmInput ? (
            <button
              onClick={() => setShowReconfirmInput(true)}
              style={{
                background: '#fef3c7', color: '#92400e',
                border: '1px solid #f59e0b', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Resolve CHALLENGED →
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={reconfirmNote}
                onChange={e => setReconfirmNote(e.target.value)}
                placeholder="Why are counter-examples edge cases?"
                style={{
                  flex: 1, fontSize: 12, padding: '4px 8px',
                  border: '1px solid #d6d3d1', borderRadius: 6, minWidth: 0,
                }}
              />
              <button
                onClick={() => { if (reconfirmNote && onReconfirm) { onReconfirm(pattern.id, reconfirmNote); setReconfirmNote(''); setShowReconfirmInput(false); } }}
                style={{
                  background: INTEL_COLORS.active, color: '#fff',
                  border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                }}
              >Reconfirm as ACTIVE</button>
              <button
                onClick={() => setShowReconfirmInput(false)}
                style={{ background: '#f5f4f0', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
              >Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', color: INTEL_COLORS.accent,
            fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 500,
          }}
        >
          {expanded ? 'close ×' : 'open pattern →'}
        </button>

        {!showCounterInput && (
          <button
            onClick={() => setShowCounterInput(true)}
            style={{
              background: 'none', border: 'none', color: '#78716c',
              fontSize: 12, cursor: 'pointer', padding: 0,
            }}
          >
            + counter-example
          </button>
        )}

        {onReclassify && (
          <button
            onClick={() => onReclassify(pattern.id, isRule ? 'HEURISTIC' : 'RULE')}
            style={{
              background: 'none', border: 'none', color: '#78716c',
              fontSize: 12, cursor: 'pointer', padding: 0,
            }}
          >
            → {isRule ? 'Heuristic' : 'Rule'}
          </button>
        )}

        {onDeprecate && !isDeprecated && (
          <button
            onClick={() => onDeprecate(pattern.id)}
            style={{
              background: 'none', border: 'none', color: INTEL_COLORS.deprecated,
              fontSize: 12, cursor: 'pointer', padding: 0, marginLeft: 'auto',
            }}
          >
            Deprecate
          </button>
        )}
      </div>

      {/* Counter-example input */}
      {showCounterInput && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            value={counterNote}
            onChange={e => setCounterNote(e.target.value)}
            placeholder="Describe the counter-example..."
            style={{
              flex: 1, fontSize: 12, padding: '4px 8px',
              border: '1px solid #d6d3d1', borderRadius: 6, minWidth: 0,
            }}
          />
          <button
            onClick={() => { if (counterNote && onAddCounterExample) { onAddCounterExample(pattern.id, counterNote); setCounterNote(''); setShowCounterInput(false); } }}
            style={{
              background: INTEL_COLORS.accent, color: '#fff',
              border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            }}
          >Save</button>
          <button
            onClick={() => setShowCounterInput(false)}
            style={{ background: '#f5f4f0', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
          >Cancel</button>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          marginTop: 10, padding: '10px', background: '#f5f4f0',
          borderRadius: 6, fontSize: 12,
        }}>
          {pattern.notes.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#57534e' }}>Evidence notes</div>
              {pattern.notes.map((note, i) => (
                <div key={i} style={{ marginBottom: 3, color: '#44403c' }}>• {note}</div>
              ))}
            </div>
          )}
          {pattern.notes.length === 0 && (
            <div style={{ color: '#a8a29e' }}>No notes yet. Add a counter-example to start building evidence.</div>
          )}
        </div>
      )}
    </div>
  );
}
