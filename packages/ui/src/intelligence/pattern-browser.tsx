'use client';

import { useState, useCallback } from 'react';
import { useApi, getApiBase, getAuthHeaders } from '../config';
import PatternCard from './pattern-card';
import type { Pattern } from './types';
import { INTEL_COLORS } from './types';

type TypeFilter = 'All' | 'Rules' | 'Heuristics';
type DomainFilter = 'All' | 'Build' | 'GTM' | 'Trade' | 'Personal';

export default function PatternBrowser() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('All');

  const { data, loading, error } = useApi<{ patterns: Pattern[]; count: number }>('/api/intelligence/patterns');

  const handleReclassify = useCallback(async (id: number, toType: 'RULE' | 'HEURISTIC') => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${getApiBase()}/api/intelligence/patterns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: toType }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to reclassify pattern:', err);
    }
  }, []);

  const handleAddCounterExample = useCallback(async (id: number, note: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${getApiBase()}/api/intelligence/patterns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter_example_note: note }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to add counter-example:', err);
    }
  }, []);

  const handleReconfirm = useCallback(async (id: number, note: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${getApiBase()}/api/intelligence/patterns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconfirm_note: note }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to reconfirm pattern:', err);
    }
  }, []);

  const handleDeprecate = useCallback(async (id: number) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${getApiBase()}/api/intelligence/patterns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DEPRECATED' }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to deprecate pattern:', err);
    }
  }, []);

  const patterns = data?.patterns ?? [];

  const filtered = patterns.filter(p => {
    if (typeFilter === 'Rules' && p.type !== 'RULE') return false;
    if (typeFilter === 'Heuristics' && p.type !== 'HEURISTIC') return false;
    if (domainFilter !== 'All' && p.domain !== domainFilter) return false;
    return true;
  });

  const domainCounts = (['Build', 'GTM', 'Trade', 'Personal'] as DomainFilter[]).reduce<Record<string, number>>((acc, d) => {
    acc[d] = patterns.filter(p => p.domain === d).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', margin: 0 }}>
          What Blekkie has learned
        </h2>
        <p style={{ fontSize: 12, color: '#78716c', margin: '2px 0 0' }}>
          {data?.count ?? 0} pattern{(data?.count ?? 0) !== 1 ? 's' : ''} across {
            Object.values(domainCounts).filter(v => v > 0).length
          } domain{Object.values(domainCounts).filter(v => v > 0).length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['All', 'Rules', 'Heuristics'] as TypeFilter[]).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: typeFilter === t ? 700 : 400,
              border: typeFilter === t ? `1.5px solid ${INTEL_COLORS.accent}` : '1.5px solid #e7e5e4',
              background: typeFilter === t ? '#eff6ff' : '#fff',
              color: typeFilter === t ? INTEL_COLORS.accent : '#57534e',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Domain filter chips */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['All', 'Build', 'GTM', 'Trade', 'Personal'] as DomainFilter[]).map(d => {
          const count = d === 'All' ? patterns.length : (domainCounts[d] ?? 0);
          return (
            <button
              key={d}
              onClick={() => setDomainFilter(d)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                border: '1px solid #e7e5e4',
                background: domainFilter === d ? '#f5f4f0' : '#fff',
                color: domainFilter === d ? '#1c1917' : '#78716c',
                fontWeight: domainFilter === d ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {d} {count > 0 && <span style={{ color: '#a8a29e' }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && <div style={{ color: '#78716c', fontSize: 13, padding: 20 }}>Loading patterns...</div>}
      {error && <div style={{ color: '#dc2626', fontSize: 13, padding: 20 }}>Failed to load: {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 40,
          border: '1px dashed #d6d3d1', borderRadius: 10,
          color: '#a8a29e', fontSize: 13,
        }}>
          {patterns.length === 0
            ? 'No patterns yet — they emerge after 2+ sessions'
            : `No patterns match the current filter`
          }
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {filtered.map(p => (
            <PatternCard
              key={p.id}
              pattern={p}
              onReclassify={handleReclassify}
              onAddCounterExample={handleAddCounterExample}
              onReconfirm={handleReconfirm}
              onDeprecate={handleDeprecate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
