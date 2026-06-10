'use client';

import { useState } from 'react';
import type { SituationSummary, Memory } from './types';
import { INTEL_COLORS } from './types';

function ConfidenceDot({ confidence }: { confidence: Memory['confidence'] }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: confidence === 'OBSERVED' ? INTEL_COLORS.observed : INTEL_COLORS.inferred,
      flexShrink: 0,
      marginRight: 6,
      verticalAlign: 'middle',
    }} />
  );
}

interface SituationSummaryPanelProps {
  summary: SituationSummary;
}

export default function SituationSummaryPanel({ summary }: SituationSummaryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!summary.memories || summary.memories.length === 0) {
    return null;
  }

  return (
    <div style={{
      borderLeft: `3px solid ${INTEL_COLORS.accent}`,
      background: '#eff6ff',
      borderRadius: '0 8px 8px 0',
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: INTEL_COLORS.accent }}>
            SITUATION SUMMARY
          </span>
          <span style={{ fontSize: 11, color: '#3b82f6' }}>
            top {summary.memories.length} by score
          </span>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={INTEL_COLORS.accent}
          strokeWidth="2.5"
          style={{ transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : '' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '0 14px 12px' }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {summary.memories.map(m => (
              <li key={m.id} style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: 8,
                fontSize: 13,
                lineHeight: 1.5,
                color: '#1e3a8a',
              }}>
                <ConfidenceDot confidence={m.confidence} />
                <span style={{ fontStyle: m.confidence === 'INFERRED' ? 'italic' : 'normal' }}>
                  {m.text}
                  {m.conflict_with && !m.conflict_dismissed && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #f59e0b',
                      borderRadius: 4,
                      padding: '0 5px',
                      fontSize: 10,
                      marginLeft: 6,
                      verticalAlign: 'middle',
                    }}>
                      ⚠ conflicts with older memory — review →
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {/* Footer context */}
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, paddingTop: 8, borderTop: '1px solid #bfdbfe' }}>
            Based on:
            {summary.hasUpcomingMeeting
              ? ` upcoming meeting · `
              : ` no meeting this week · `}
            scored by confidence × recency ·{' '}
            {summary.totalConsidered} memor{summary.totalConsidered !== 1 ? 'ies' : 'y'} considered
          </div>
        </div>
      )}
    </div>
  );
}
