'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiBase, getAuthHeaders } from '../config';
import SituationSummaryPanel from './situation-summary';
import MemoryCard from './memory-card';
import PatternCard from './pattern-card';
import type { Memory, Pattern, SituationSummary } from './types';
import { INTEL_COLORS } from './types';

interface EntityIntelligenceProps {
  entityId: number;
  entityName?: string;
}

export default function EntityIntelligence({ entityId, entityName }: EntityIntelligenceProps) {
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = getApiBase();

      const [summaryRes, memoriesRes, patternsRes, newRes] = await Promise.all([
        fetch(`${base}/api/intelligence/situation-summary/${entityId}`, { headers }),
        fetch(`${base}/api/intelligence/memories?entity_id=${entityId}`, { headers }),
        fetch(`${base}/api/intelligence/patterns`, { headers }),
        fetch(`${base}/api/intelligence/new-since-visit`, { headers }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (memoriesRes.ok) {
        const d = await memoriesRes.json();
        setMemories(d.memories ?? []);
      }
      if (patternsRes.ok) {
        const d = await patternsRes.json();
        setPatterns(d.patterns ?? []);
      }
      if (newRes.ok) {
        const d = await newRes.json();
        setNewCount(d.count ?? 0);
      }
    } catch (err) {
      console.error('EntityIntelligence fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (id: number) => {
    // Optimistic remove
    setMemories(prev => prev.filter(m => m.id !== id));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/intelligence/memories/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        // Restore on failure by refetching
        fetchData();
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
      fetchData(); // Restore state on network error
    }
  }, [fetchData]);

  const handleResolveConflict = useCallback(async (id: number, action: 'supersede' | 'delete-older' | 'both-valid') => {
    try {
      const headers = await getAuthHeaders();
      const base = getApiBase();
      const memory = memories.find(m => m.id === id);
      const conflictId = memory?.conflict_with;
      const patchJson = (url: string, body: object) =>
        fetch(url, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      if (action === 'both-valid') {
        // Dismiss flag on both sides of the conflict
        await patchJson(`${base}/api/intelligence/memories/${id}`, { conflict_dismissed: 1 });
        if (conflictId) await patchJson(`${base}/api/intelligence/memories/${conflictId}`, { conflict_dismissed: 1 });
      } else if (action === 'supersede' && conflictId) {
        // Mark older as superseded, dismiss flag on current
        await patchJson(`${base}/api/intelligence/memories/${conflictId}`, { superseded_by_id: id, conflict_dismissed: 1 });
        await patchJson(`${base}/api/intelligence/memories/${id}`, { conflict_dismissed: 1 });
      } else if (action === 'delete-older' && conflictId) {
        // Soft-delete older (DELETE sets deleted_at), dismiss flag on current
        await fetch(`${base}/api/intelligence/memories/${conflictId}`, { method: 'DELETE', headers });
        await patchJson(`${base}/api/intelligence/memories/${id}`, { conflict_dismissed: 1 });
      }
      fetchData();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  }, [memories, fetchData]);

  const handleReclassify = useCallback(async (id: number, toType: 'RULE' | 'HEURISTIC') => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${getApiBase()}/api/intelligence/patterns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: toType }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to reclassify:', err);
    }
  }, [fetchData]);

  const handleAddCounterExample = useCallback(async (id: number, note: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${getApiBase()}/api/intelligence/patterns/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter_example_note: note }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to add counter-example:', err);
    }
  }, [fetchData]);

  if (loading) {
    return <div style={{ padding: 20, color: '#78716c', fontSize: 13 }}>Loading intelligence...</div>;
  }

  const memCount = memories.length;

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Tab header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#57534e', fontWeight: 500 }}>
          {memCount} memor{memCount !== 1 ? 'ies' : 'y'}
        </span>
        {newCount > 0 && (
          <span style={{
            background: INTEL_COLORS.accent, color: '#fff',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700,
          }}>
            {newCount} new since last visit
          </span>
        )}
      </div>

      {/* Situation summary */}
      {summary && summary.memories.length > 0 && (
        <SituationSummaryPanel summary={summary} />
      )}

      {/* What I know */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          What I know
        </h4>
        {memories.length === 0 ? (
          <div style={{
            fontSize: 12, color: '#a8a29e', padding: '16px 0',
            borderTop: '1px dashed #e7e5e4',
          }}>
            Intelligence grows as you work — Blekkie will write the first observations after your next save game.
          </div>
        ) : (
          memories.map(m => (
            <MemoryCard
              key={m.id}
              memory={m}
              onDelete={handleDelete}
              onResolveConflict={handleResolveConflict}
            />
          ))
        )}
      </div>

      {/* Linked patterns */}
      {patterns.length > 0 && (
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            Recent patterns
          </h4>
          {patterns.slice(0, 3).map(p => (
            <PatternCard
              key={p.id}
              pattern={p}
              onReclassify={handleReclassify}
              onAddCounterExample={handleAddCounterExample}
            />
          ))}
        </div>
      )}
    </div>
  );
}
