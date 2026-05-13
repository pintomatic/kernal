'use client';

import { useState, useMemo, useRef, useEffect, useCallback, useContext } from 'react';
import { useApi, getApiBase, getAuthHeaders, type ActionsData } from './config';
import { EntityBadge, useEntity, showSaveError, EntityCacheContext } from './entity-badge';

// ── Types ──────────────────────────────────────────────────────────────────

type ActionItem = {
  id: number;
  title: string;
  due_date: string | null;
  owner_name: string | null;
  priority?: string;
  list?: string;
  entity_id?: number | null;
  deal_id?: number | null;
  goal_id?: number | null;
  project_id?: number | null;
  status?: string;
};

type KindFilter = 'all' | 'goal' | 'project' | 'deal' | 'unlinked';

const PRIORITY_STYLES: Record<string, { label: string; classes: string }> = {
  urgent: { label: 'URGENT', classes: 'bg-red-50 text-red-700 border border-red-200' },
  high:   { label: 'HIGH',   classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  normal: { label: 'NORMAL', classes: 'bg-stone-100 text-stone-500 border border-stone-200' },
  low:    { label: 'LOW',    classes: 'bg-sky-50 text-sky-600 border border-sky-200' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function patchAction(id: number, body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/actions/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Reassign dropdown ──────────────────────────────────────────────────────

function ReassignDropdown({ actionId, onReassign, onClose }: {
  actionId: number;
  onReassign: (id: number, entityId: number | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeqRef = useRef(0); // monotonic counter to discard stale responses

  // Unified fetch — both initial load and debounced search use this
  const recentUrl = `${getApiBase()}/api/entities?limit=10&order=updated_at+desc`;
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const doFetch = useCallback(async (url: string, seq: number) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!mountedRef.current || fetchSeqRef.current !== seq) return;
      if (!res.ok) { setResults([]); return; }
      const d = await res.json();
      setResults(d.entities ?? []);
    } catch { /* silent */ } finally {
      if (mountedRef.current && fetchSeqRef.current === seq) setLoading(false);
    }
  }, [recentUrl]);

  // Debounced search — resets to recent-10 when query cleared
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      // Reset to initial list when query is cleared
      const seq = ++fetchSeqRef.current;
      doFetch(recentUrl, seq);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const seq = ++fetchSeqRef.current;
      doFetch(`${getApiBase()}/api/entities?q=${encodeURIComponent(query)}&limit=10`, seq);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doFetch, recentUrl]);

  // Click-outside close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const handleSelect = async (entityId: number | null) => {
    try {
      await patchAction(actionId, { entity_id: entityId });
      onReassign(actionId, entityId);
    } catch {
      showSaveError();
    }
    onClose();
  };

  const KIND_COLORS: Record<string, string> = { goal: '#16A34A', project: '#D97706', deal: '#6366F1' };

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0,
      background: 'white', border: '1px solid #e5e5ea', borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6,
      minWidth: 220, zIndex: 100,
    }}>
      <input
        autoFocus
        placeholder="Search entities…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          width: '100%', fontSize: 12, padding: '4px 8px',
          border: '1px solid #e5e5ea', borderRadius: 5, outline: 'none',
          marginBottom: 4, boxSizing: 'border-box',
        }}
      />
      {loading && <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 6px' }}>Searching…</div>}
      {results.map(e => (
        <div
          key={e.id}
          onClick={() => handleSelect(e.id)}
          style={{
            padding: '5px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={el => { (el.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
          onMouseLeave={el => { (el.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_COLORS[e.kind] ?? '#9ca3af', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.title}</span>
          <span style={{ fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>{e.kind}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 4 }}>
        <div
          onClick={() => handleSelect(null)}
          style={{ padding: '5px 8px', cursor: 'pointer', fontSize: 11, color: '#9ca3af', borderRadius: 5 }}
          onMouseEnter={el => { (el.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
          onMouseLeave={el => { (el.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >Unlink</div>
      </div>
    </div>
  );
}

// ── ActionCard ─────────────────────────────────────────────────────────────

function ActionCard({
  item, accentLeftBorder, groupBorder, onEntityReassigned,
}: {
  item: ActionItem;
  accentLeftBorder: string;
  groupBorder: string;
  onEntityReassigned: (id: number, entityId: number | null) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const entity = useEntity(item.entity_id ?? undefined);
  const priority = item.priority?.toLowerCase();
  const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;

  return (
    <div className={`bg-white border ${groupBorder} rounded-xl px-4 py-3 hover:border-stone-300 hover:shadow-sm transition-all duration-150 ${accentLeftBorder}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-4 h-4 mt-0.5 rounded border border-stone-300 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-stone-800">{item.title}</p>
              {priorityStyle && (
                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityStyle.classes}`} style={{ fontFamily: 'var(--kd-font-mono)', letterSpacing: '0.05em' }}>
                  {priorityStyle.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {item.owner_name && (
                <span className="text-[11px] text-stone-400" style={{ fontFamily: 'var(--kd-font-mono)' }}>{item.owner_name}</span>
              )}
              {item.entity_id && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <div onClick={() => setReassignOpen(o => !o)} style={{ cursor: 'pointer' }}>
                    <EntityBadge
                      kind={entity?.kind ?? 'task'}
                      id={item.entity_id}
                      title={entity?.title}
                      size="sm"
                    />
                  </div>
                  {reassignOpen && (
                    <ReassignDropdown
                      actionId={item.id}
                      onReassign={onEntityReassigned}
                      onClose={() => setReassignOpen(false)}
                    />
                  )}
                </div>
              )}
              {item.list && (
                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">{item.list}</span>
              )}
            </div>
          </div>
        </div>
        {item.due_date && (
          <span className="text-[11px] text-stone-400 whitespace-nowrap flex-shrink-0 mt-0.5" style={{ fontFamily: 'var(--kd-font-mono)' }}>{item.due_date}</span>
        )}
      </div>
    </div>
  );
}

// ── ActionGroup ────────────────────────────────────────────────────────────

function ActionGroup({ title, items, accent, onEntityReassigned }: {
  title: string; items: ActionItem[]; accent: string;
  onEntityReassigned: (id: number, entityId: number | null) => void;
}) {
  const accentColors: Record<string, { badge: string; border: string; dot: string; leftBorder: string }> = {
    red:   { badge: 'bg-red-50 text-red-600 border border-red-200', border: 'border-stone-200', dot: 'bg-red-500', leftBorder: 'border-l-4 border-l-red-500' },
    amber: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', border: 'border-stone-200', dot: 'bg-amber-500', leftBorder: '' },
    blue:  { badge: 'bg-sky-50 text-sky-700 border border-sky-200', border: 'border-stone-200', dot: 'bg-sky-500', leftBorder: '' },
    zinc:  { badge: 'bg-stone-100 text-stone-500 border border-stone-200', border: 'border-stone-200', dot: 'bg-stone-400', leftBorder: '' },
  };
  const colors = accentColors[accent] ?? accentColors.zinc;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wider" style={{ fontSize: 11, letterSpacing: '0.09em' }}>{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`} style={{ fontFamily: 'var(--kd-font-mono)', fontSize: 10 }}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <ActionCard key={item.id} item={item} accentLeftBorder={colors.leftBorder} groupBorder={colors.border} onEntityReassigned={onEntityReassigned} />
        ))}
      </div>
    </div>
  );
}

// ── Main ActionItems ───────────────────────────────────────────────────────

export default function ActionItems() {
  const [priority, setPriority] = useState('');
  const [owner, setOwner] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [entityOverrides, setEntityOverrides] = useState<Record<number, number | null>>({});

  const { data, loading, error } = useApi<ActionsData>('/api/dashboard/actions');
  const { map: entityCacheMap } = useContext(EntityCacheContext);

  // Build entity lookup from shared cache (normalized string keys → coerce to number for action lookup)
  const entityMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const [key, entity] of entityCacheMap.entries()) {
      const numId = Number(key);
      if (!isNaN(numId)) map.set(numId, entity);
    }
    return map;
  }, [entityCacheMap]);

  const rawActions: ActionItem[] = useMemo(() => {
    const a = (data as any)?.actions;
    if (a) return a;
    const grouped = (data as any)?.grouped;
    if (grouped) return (Object.values(grouped) as ActionItem[][]).flat();
    return [];
  }, [data]);

  // Apply entity_id overrides from reassignments
  const allActions: ActionItem[] = useMemo(() =>
    rawActions.map(a => ({
      ...a,
      entity_id: a.id in entityOverrides ? entityOverrides[a.id] : a.entity_id,
    })),
    [rawActions, entityOverrides]
  );

  const handleEntityReassigned = useCallback((id: number, entityId: number | null) => {
    setEntityOverrides(prev => ({ ...prev, [id]: entityId }));
  }, []);

  const owners = useMemo(() => {
    const names = allActions.map(a => a.owner_name).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [allActions]);

  // Kind-filtered actions
  const kindFiltered = useMemo(() => {
    if (kindFilter === 'all') return allActions;
    if (kindFilter === 'unlinked') return allActions.filter(a =>
      !a.deal_id && !a.goal_id && !a.project_id && !a.entity_id
    );
    if (kindFilter === 'deal') return allActions.filter(a => !!a.deal_id);
    if (kindFilter === 'goal') return allActions.filter(a => !!a.goal_id && !a.deal_id && !a.project_id);
    if (kindFilter === 'project') return allActions.filter(a => !!a.project_id);
    // fallback: entity_id lookup for legacy data
    return allActions.filter(a => {
      if (!a.entity_id) return false;
      const e = entityMap.get(a.entity_id);
      return e?.kind === kindFilter;
    });
  }, [allActions, kindFilter, entityMap]);

  // Priority/owner filter
  const filtered = useMemo(() =>
    kindFiltered.filter(a => {
      if (priority && a.priority?.toLowerCase() !== priority) return false;
      if (owner && a.owner_name !== owner) return false;
      return true;
    }),
    [kindFiltered, priority, owner]
  );

  const now = new Date().toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const grouped = {
    overdue:   filtered.filter(a => a.due_date && a.due_date.slice(0, 10) < now),
    this_week: filtered.filter(a => a.due_date && a.due_date.slice(0, 10) >= now && a.due_date.slice(0, 10) <= weekFromNow),
    upcoming:  filtered.filter(a => a.due_date && a.due_date.slice(0, 10) > weekFromNow),
    no_date:   filtered.filter(a => !a.due_date),
  };

  // Unlinked bucket — use filtered so priority/owner filters apply here too
  const unlinkedItems = filtered.filter(a => !a.deal_id && !a.goal_id && !a.project_id && !a.entity_id);
  const hasFilters = priority || owner || kindFilter !== 'all';

  const kindPills: { key: KindFilter; label: string; color: string }[] = [
    { key: 'all',      label: 'All',       color: '#374151' },
    { key: 'goal',     label: 'Goals',     color: '#16A34A' },
    { key: 'project',  label: 'Projects',  color: '#D97706' },
    { key: 'deal',     label: 'Deals',     color: '#6366F1' },
    { key: 'unlinked', label: 'Unlinked',  color: '#9CA3AF' },
  ];

  const selectCls = "text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer";

  const emptyMsg = kindFilter !== 'all' && kindFilter !== 'unlinked'
    ? `No tasks linked to ${kindFilter.charAt(0).toUpperCase() + kindFilter.slice(1)}s`
    : hasFilters ? 'No tasks match these filters.' : 'No open action items.';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Kind filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {kindPills.map(p => (
          <button
            key={p.key}
            onClick={() => setKindFilter(p.key)}
            style={{
              fontSize: 11, fontWeight: kindFilter === p.key ? 700 : 500,
              padding: '3px 10px', borderRadius: 14, cursor: 'pointer',
              border: kindFilter === p.key ? `1.5px solid ${p.color}` : '1.5px solid #e5e5ea',
              background: kindFilter === p.key ? `${p.color}11` : 'white',
              color: kindFilter === p.key ? p.color : '#8e8e93',
              transition: 'all 0.15s',
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* Priority/owner filter bar */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-stone-200 rounded-xl px-3 py-2.5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mr-1" style={{ fontFamily: 'var(--kd-font-mono)' }}>Filter</span>

        <select value={priority} onChange={e => setPriority(e.target.value)} className={selectCls} style={{ fontFamily: 'var(--kd-font-mono)', fontSize: 11 }}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        {owners.length > 0 && (
          <select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls} style={{ fontFamily: 'var(--kd-font-mono)', fontSize: 11 }}>
            <option value="">All owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={() => { setPriority(''); setOwner(''); setKindFilter('all'); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-500 hover:border-red-200 transition-colors"
            style={{ fontFamily: 'var(--kd-font-mono)', fontSize: 11 }}
          >Clear</button>
        )}

        <span className="ml-auto text-xs text-stone-400 tabular-nums" style={{ fontFamily: 'var(--kd-font-mono)', fontSize: 11 }}>
          {filtered.length}/{allActions.length}
        </span>
      </div>

      {loading && <div className="text-stone-400 animate-pulse py-6 text-center text-sm">Loading tasks…</div>}
      {error && <div className="text-red-400 py-4">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-stone-400 py-8 text-center text-sm">{emptyMsg}</div>
      )}

      {!loading && !error && (
        <>
          {grouped.overdue.length > 0   && <ActionGroup title="Overdue"       items={grouped.overdue}   accent="red"   onEntityReassigned={handleEntityReassigned} />}
          {grouped.this_week.length > 0 && <ActionGroup title="Due This Week" items={grouped.this_week} accent="amber" onEntityReassigned={handleEntityReassigned} />}
          {grouped.upcoming.length > 0  && <ActionGroup title="Upcoming"      items={grouped.upcoming}  accent="blue"  onEntityReassigned={handleEntityReassigned} />}
          {grouped.no_date.length > 0   && <ActionGroup title="No Due Date"   items={grouped.no_date}   accent="zinc"  onEntityReassigned={handleEntityReassigned} />}

          {/* Unlinked bucket — shown at bottom when kindFilter !== 'unlinked' */}
          {kindFilter === 'all' && unlinkedItems.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Unlinked</span>
                <span style={{ fontSize: 10, background: '#f3f4f6', color: '#9ca3af', borderRadius: 10, padding: '1px 7px', fontFamily: 'var(--kd-font-mono)' }}>{unlinkedItems.length}</span>
              </div>
              <div className="space-y-2">
                {unlinkedItems.map(item => (
                  <ActionCard key={item.id} item={item} accentLeftBorder="" groupBorder="border-stone-200" onEntityReassigned={handleEntityReassigned} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
