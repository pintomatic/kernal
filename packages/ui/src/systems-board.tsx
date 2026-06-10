'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi, getApiBase, getAuthHeaders } from './config';
import { showSaveError } from './entity-badge';
import type { EntityFocus } from './types';

// ── Types ──────────────────────────────────────────────────────────────────

interface SystemsBoardProps {
  onEntityClick: (e: EntityFocus) => void;
  onExpandSystem: (id: number | null) => void;
  onSummaryChange?: (text: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function patchSystem(id: number, body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/systems/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function expiryDisplay(days: number | null): string {
  if (days === null) return 'no contract';
  if (days <= 0) return 'expired';
  return `expires in ${days}d`;
}

// ── InlineEditField ──────────────────────────────────────────────────────────

interface InlineEditFieldProps {
  systemId: number;
  field: 'annual_cost' | 'contract_expiry';
  value: string;
  displayValue: string;
  inputType: 'number' | 'date';
  onSave: (
    systemId: number,
    field: 'annual_cost' | 'contract_expiry',
    rawValue: string,
    originalValue: any
  ) => void;
  isSaving: boolean;
}

function InlineEditField({
  systemId,
  field,
  value,
  displayValue,
  inputType,
  onSave,
  isSaving,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleCommit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(systemId, field, draft, value);
    }
  };

  if (isSaving) {
    return <span style={{ fontSize: 11, color: '#9ca3af' }}>⟳</span>;
  }

  if (editing) {
    return (
      <input
        type={inputType}
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { setEditing(false); setDraft(value); }
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          fontSize: 11,
          width: inputType === 'date' ? 120 : 80,
          padding: '1px 4px',
          border: '1px solid #6366f1',
          borderRadius: 4,
          outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true); setDraft(value); }}
      onMouseDown={e => e.stopPropagation()}
      style={{
        fontSize: 11,
        cursor: 'text',
        borderBottom: '1px dashed #d1d5db',
        color: 'var(--ink-2, #374151)',
        paddingBottom: 1,
      }}
    >
      {displayValue || <span style={{ color: '#d1d5db' }}>—</span>}
    </span>
  );
}

// ── SystemsBoard ─────────────────────────────────────────────────────────────

export default function SystemsBoard({
  onEntityClick,
  onExpandSystem,
  onSummaryChange,
}: SystemsBoardProps) {
  const { data, loading } = useApi<any>('/api/systems');
  const [systems, setSystems] = useState<any[]>([]);
  // Keyed by `${systemId}:${field}` so each field saves independently
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'expiring'>('all');

  // Seed local systems state from API on initial load and env switch
  useEffect(() => {
    if (data?.systems) setSystems(data.systems);
  }, [data]);

  // Summary reflects optimistic edits — depends on systems, not raw data
  useEffect(() => {
    if (!systems.length) return;
    const expiring = systems.filter((s: any) => {
      if (!s.contract_expiry) return false;
      const days = Math.ceil(
        (new Date(s.contract_expiry).getTime() - Date.now()) / 86400000
      );
      return days <= 30;
    });
    const withGraph = systems.filter((s: any) => s.has_graph).length;
    onSummaryChange?.(
      `${systems.length} technology assets · ${withGraph} with code graphs · ${expiring.length} contracts expiring within 30 days`
    );
  }, [systems, onSummaryChange]);

  const handleFieldSave = useCallback(async (
    systemId: number,
    field: 'annual_cost' | 'contract_expiry',
    rawValue: string,
    originalValue: any
  ) => {
    // Validate and parse
    let parsedValue: number | string | null = null;
    if (field === 'annual_cost') {
      if (rawValue.trim() === '') {
        parsedValue = null;
      } else {
        const v = Number(rawValue); // Number() rejects '100abc' unlike parseFloat
        if (!isFinite(v) || v < 0 || v >= 1e9) {
          showSaveError('Invalid amount');
          return;
        }
        parsedValue = v;
      }
    } else if (field === 'contract_expiry') {
      parsedValue = rawValue.trim() === '' ? null : rawValue.slice(0, 10);
    }

    // Optimistic update
    const saveKey = `${systemId}:${field}`;
    setSystems(prev =>
      prev.map(s => s.id === systemId ? { ...s, [field]: parsedValue } : s)
    );
    setSaving(prev => new Set([...prev, saveKey]));

    try {
      await patchSystem(systemId, { [field]: parsedValue });
    } catch {
      // Revert on failure — always call showSaveError
      setSystems(prev =>
        prev.map(s => s.id === systemId ? { ...s, [field]: originalValue } : s)
      );
      showSaveError('Save failed — reverted');
    } finally {
      setSaving(prev => {
        const n = new Set(prev);
        n.delete(saveKey);
        return n;
      });
    }
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--ink-3)', padding: 40 }}>Loading systems...</div>;
  }
  if (systems.length === 0) {
    return (
      <div style={{ color: 'var(--ink-3)', padding: 40 }}>
        No systems yet. Add your first technology asset.
      </div>
    );
  }

  // Filter
  const expiring = systems.filter((s: any) => {
    if (!s.contract_expiry) return false;
    const days = Math.ceil(
      (new Date(s.contract_expiry.slice(0, 10)).getTime() - Date.now()) / 86400000
    );
    return days <= 30;
  });
  const filtered = filter === 'expiring' ? expiring : systems;

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {(['all', 'expiring'] as const).map(f => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 11,
              fontWeight: filter === f ? 700 : 500,
              padding: '3px 10px',
              borderRadius: 14,
              cursor: 'pointer',
              border: filter === f ? '1.5px solid #d97706' : '1.5px solid #e5e5ea',
              background: filter === f ? '#fef3c715' : 'white',
              color: filter === f ? '#d97706' : '#8e8e93',
            }}
          >
            {f === 'all' ? 'All' : `⚠ Expiring soon (${expiring.length})`}
          </button>
        ))}
      </div>

      {/* System card grid */}
      <div className="systems-grid">
        {filtered.map((sys: any) => {
          const days = sys.contract_expiry
            ? Math.ceil(
                (new Date(sys.contract_expiry).getTime() - Date.now()) / 86400000
              )
            : null;
          const expiryClass =
            days === null ? 'ok' : days <= 30 ? 'red' : days <= 90 ? 'amber' : 'ok';
          const stackChips = (() => {
            try { return JSON.parse(sys.stack || '[]'); }
            catch { return sys.stack ? [sys.stack] : []; }
          })();

          return (
            <div
              key={sys.id}
              className="sys-card"
              onClick={() => onEntityClick({ type: 'system', id: sys.id, name: sys.name })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="ic" style={{ background: 'var(--intelligence)', borderRadius: 7 }} />
                <div>
                  <div className="nm">{sys.name}</div>
                  <div className="vendor">
                    {sys.vendor_name || sys.owner_org_name || ''}
                    {sys.category ? ` · ${sys.category}` : ''}
                  </div>
                </div>
              </div>

              <div className="sys-meta">
                <span className={`chipx ${sys.owner_org_id ? 'int' : 'ext'}`}>
                  {sys.owner_org_id ? 'internal' : 'external'}
                </span>
                {sys.category && <span className="chipx cat">{sys.category}</span>}
                {stackChips.slice(0, 3).map((s: string) => (
                  <span key={s} className="chipx mono">{s}</span>
                ))}
              </div>

              <div className="sys-foot">
                <span className={`expiry ${expiryClass}`}>
                  <span className="dt" />
                  <InlineEditField
                    systemId={sys.id}
                    field="contract_expiry"
                    value={sys.contract_expiry?.slice(0, 10) ?? ''}
                    displayValue={expiryDisplay(days)}
                    inputType="date"
                    onSave={handleFieldSave}
                    isSaving={saving.has(`${sys.id}:contract_expiry`)}
                  />
                </span>

                <InlineEditField
                  systemId={sys.id}
                  field="annual_cost"
                  value={sys.annual_cost?.toString() ?? ''}
                  displayValue={
                    sys.annual_cost
                      ? `$${(sys.annual_cost / 1000).toFixed(0)}k/yr`
                      : ''
                  }
                  inputType="number"
                  onSave={handleFieldSave}
                  isSaving={saving.has(`${sys.id}:annual_cost`)}
                />

                {sys.has_graph && (
                  <span
                    className="graphify-badge"
                    onClick={e => { e.stopPropagation(); onExpandSystem(sys.id); }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    {'</>'} {sys.graph_node_count?.toLocaleString() || '?'} nodes
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
