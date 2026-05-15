'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useApi, getApiBase, getAuthHeaders } from './config';
import { EntityBadge, useEntity, useEntityLinks, useEntityCacheUpdater, showSaveError } from './entity-badge';
import type { EntityLink } from './entity-badge';
import type { EntityFocus } from './types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Goal {
  id: number; title: string; kind: string; status: string;
  health?: string; confidence?: number; progress_pct?: number;
  target_date?: string | null; domain?: string | null; updated_at?: string;
}
interface GoalsApiData { entities: Goal[]; }
interface ActionsApiData {
  actions?: Array<{ id: number; title: string; entity_id?: number | null; status?: string }>;
  grouped?: Record<string, any[]>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const healthColor = (h?: string) =>
  h === 'red' ? '#dc2626' : h === 'yellow' ? '#d97706' : '#16a34a';

async function patchEntity(id: number, body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/entities/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function deleteLink(linkId: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/entities/links/${linkId}`, {
    method: 'DELETE', headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function deleteEntity(id: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/entities/${id}`, {
    method: 'DELETE', headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── LinkedChip ─────────────────────────────────────────────────────────────

function LinkedChip({ link, onUnlink }: { link: EntityLink; onUnlink: (id: number, title: string) => void }) {
  const entity = useEntity(link.from_entity_id);
  const title = entity?.title ?? String(link.from_entity_id);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <EntityBadge kind={entity?.kind ?? 'project'} id={link.from_entity_id} size="sm" />
      <button
        onClick={() => onUnlink(link.id, title)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9ca3af', fontSize: 11, padding: '0 2px', lineHeight: 1,
        }}
        title="Remove link"
      >×</button>
    </span>
  );
}

// ── GoalStatusMenu ─────────────────────────────────────────────────────────

function GoalStatusMenu({ goal, onStatusAction, onDelete, onClose }: {
  goal: Goal;
  onStatusAction: (newStatus: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const actions: Array<{ label: string; newStatus?: string; isDelete?: boolean; color?: string }> = [];
  if (goal.status === 'active') {
    actions.push(
      { label: 'Pause', newStatus: 'paused' },
      { label: 'Mark achieved', newStatus: 'achieved' },
      { label: 'Archive', newStatus: 'abandoned' },
    );
  } else if (goal.status === 'paused') {
    actions.push(
      { label: 'Activate', newStatus: 'active' },
      { label: 'Archive', newStatus: 'abandoned' },
    );
  } else if (goal.status === 'achieved') {
    actions.push(
      { label: 'Reactivate', newStatus: 'active' },
      { label: 'Archive', newStatus: 'abandoned' },
    );
  } else if (goal.status === 'abandoned') {
    actions.push({ label: 'Reactivate', newStatus: 'active' });
  }
  actions.push({ label: 'Delete', isDelete: true, color: '#dc2626' });

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', right: 0,
      background: 'white', border: '1px solid #e5e5ea', borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4,
      minWidth: 140, zIndex: 100,
    }}>
      {actions.map(a => (
        <div
          key={a.label}
          onClick={() => { if (a.isDelete) { onDelete(); } else { onStatusAction(a.newStatus!); onClose(); } }}
          style={{ padding: '6px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: a.color ?? '#374151' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          {a.label}
        </div>
      ))}
    </div>
  );
}

// ── GoalCard ───────────────────────────────────────────────────────────────

function GoalCard({
  goal, taskCount, onEntityClick, onTitleSaved, onStatusChanged, onDeleted,
}: {
  goal: Goal;
  taskCount: number;
  onEntityClick?: (e: EntityFocus) => void;
  onTitleSaved: (id: number, title: string) => void;
  onStatusChanged: (id: number, newStatus: string) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.title);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleMenuClose = useCallback(() => setMenuOpen(false), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateCache = useEntityCacheUpdater();

  // Links from this goal (where goal is the target, i.e. project/deal → goal)
  const linkedFrom = useEntityLinks(goal.id, 'to', 'serves');
  const [removedLinks, setRemovedLinks] = useState<Set<number>>(new Set());

  const visibleLinks = linkedFrom.filter(l => !removedLinks.has(l.id));

  const hColor = healthColor(goal.health);
  const pct = goal.progress_pct ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const isStale = goal.updated_at
    ? Math.floor((Date.now() - new Date(goal.updated_at).getTime()) / 86_400_000) > 14
    : false;

  const startEdit = () => {
    setDraft(goal.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitEdit = useCallback(async () => {
    if (!editing) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === goal.title) { setEditing(false); return; }
    setSaving(true);
    try {
      const data = await patchEntity(goal.id, { title: trimmed });
      const updated = data?.entity ?? { ...goal, title: trimmed };
      updateCache(updated);
      onTitleSaved(goal.id, trimmed);
    } catch {
      setDraft(goal.title);
      showSaveError();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [editing, draft, goal, updateCache, onTitleSaved]);

  const handleUnlink = async (linkId: number, linkedTitle: string) => {
    if (!confirm(`Remove "${linkedTitle}" from this goal?`)) return;
    try {
      await deleteLink(linkId);
      setRemovedLinks(prev => new Set([...prev, linkId]));
    } catch {
      showSaveError("Couldn't remove link — try again");
    }
  };

  // Synchronous ref update (not useEffect) — always current at callback invocation time
  const goalRef = useRef(goal);
  goalRef.current = goal;

  const handleStatusAction = useCallback(async (newStatus: string) => {
    const prevStatus = goalRef.current.status;
    const id = goalRef.current.id;
    onStatusChanged(id, newStatus);
    try {
      const data = await patchEntity(id, { status: newStatus });
      const updated = data?.entity ?? { ...goalRef.current, status: newStatus };
      updateCache(updated);
    } catch {
      onStatusChanged(id, prevStatus);
      showSaveError();
    }
  }, [onStatusChanged, updateCache]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Permanently delete "${goalRef.current.title}"?`)) return;
    setMenuOpen(false);
    try {
      await deleteEntity(goalRef.current.id);
      onDeleted(goalRef.current.id);
    } catch {
      showSaveError("Couldn't delete goal — try again");
    }
  }, [onDeleted]);

  return (
    <div style={{
      background: 'white', borderRadius: 10,
      border: isStale ? '1px solid #fbbf24' : '1px solid #e5e5ea',
      borderLeft: isStale ? '3px solid #f59e0b' : '3px solid #16A34A',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div
        style={{ padding: '10px 12px 8px', cursor: 'pointer' }}
        onClick={() => !editing && onEntityClick?.({ type: 'goal', id: goal.id, name: goal.title })}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: hColor, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A', background: '#f0fdf4', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em' }}>GOAL</span>
          {goal.domain && (
            <span style={{ fontSize: 9, color: '#8e8e93', background: '#f3f4f6', borderRadius: 10, padding: '1px 5px' }}>{goal.domain}</span>
          )}
          {taskCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 600, color: '#6366f1', background: '#ede9fe', borderRadius: 10, padding: '1px 6px' }}>{taskCount} tasks</span>
          )}
          {typeof goal.confidence === 'number' && (
            <span style={{ fontSize: 10, color: '#8e8e93' }}>{goal.confidence}%</span>
          )}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
              title="Goal actions"
            >⋯</button>
            {menuOpen && (
              <GoalStatusMenu
                goal={goal}
                onStatusAction={handleStatusAction}
                onDelete={handleDelete}
                onClose={handleMenuClose}
              />
            )}
          </div>
        </div>

        {/* Editable title */}
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(goal.title); } }}
              style={{
                flex: 1, fontSize: 13, fontWeight: 600, color: '#1c1c1e',
                border: '1px solid #6366f1', borderRadius: 5, padding: '2px 6px', outline: 'none',
                fontFamily: 'var(--font-headline, DM Sans)',
              }}
            />
            {saving && <span style={{ fontSize: 10, color: '#8e8e93' }}>Saving…</span>}
          </div>
        ) : (
          <span
            style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', display: 'block', lineHeight: 1.35, cursor: 'text' }}
            onClick={e => { e.stopPropagation(); startEdit(); }}
          >{goal.title}</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#f3f4f6' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: hColor, transition: 'width 0.4s' }} />
      </div>

      {/* Linked entity chips */}
      {visibleLinks.length > 0 && (
        <div style={{ padding: '6px 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {visibleLinks.map(link => (
            <LinkedChip key={link.id} link={link} onUnlink={handleUnlink} />
          ))}
        </div>
      )}

      {/* Target date */}
      {goal.target_date && (
        <div style={{ padding: '0 12px 8px' }}>
          <span style={{ fontSize: 10, color: goal.target_date < today ? '#dc2626' : '#8e8e93' }}>
            target: {goal.target_date}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main GoalBoard ─────────────────────────────────────────────────────────

interface GoalBoardProps {
  onEntityClick?: (entity: EntityFocus) => void;
}

const DOMAIN_COLORS: Record<string, string> = {
  career: '#3b82f6', health: '#10b981', personal: '#8b5cf6',
  finance: '#f59e0b', learning: '#06b6d4',
};

export default function GoalBoard({ onEntityClick }: GoalBoardProps) {
  const { data, loading, error } = useApi<GoalsApiData>(
    '/api/entities?kind=goal&status=active,paused,achieved,abandoned'
  );
  const { data: actionsData } = useApi<ActionsApiData>('/api/dashboard/actions?status=open');

  const [localTitles, setLocalTitles] = useState<Record<number, string>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<number>>(() => new Set());

  const goals: Goal[] = useMemo(() => data?.entities ?? [], [data]);

  // Flatten all open tasks for task count per goal
  const allTasks = useMemo(() => {
    const a = actionsData?.actions;
    if (a) return a;
    const grouped = actionsData?.grouped;
    if (grouped) return (Object.values(grouped) as any[][]).flat();
    return [];
  }, [actionsData]);

  const taskCountByGoal = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of allTasks) {
      // goal_id is the raw goal table ID (modern); entity_id is legacy fallback
      if (t.goal_id != null) {
        map.set(t.goal_id, (map.get(t.goal_id) ?? 0) + 1);
      } else if (t.entity_id) {
        map.set(t.entity_id, (map.get(t.entity_id) ?? 0) + 1);
      }
    }
    return map;
  }, [allTasks]);

  const handleTitleSaved = useCallback((id: number, title: string) => {
    setLocalTitles(prev => ({ ...prev, [id]: title }));
  }, []);

  const handleStatusChanged = useCallback((id: number, newStatus: string) => {
    setLocalStatuses(prev => ({ ...prev, [id]: newStatus }));
  }, []);

  // Prune localStatuses when server data converges with the override (PATCH has landed)
  useEffect(() => {
    setLocalStatuses(prev => {
      let changed = false;
      const pruned = { ...prev };
      for (const g of goals) {
        if (pruned[g.id] !== undefined && pruned[g.id] === g.status) {
          delete pruned[g.id];
          changed = true;
        }
      }
      return changed ? pruned : prev;
    });
  }, [goals]);

  const handleDeleted = useCallback((id: number) => {
    setDeletedIds(prev => new Set([...prev, id]));
  }, []);

  const goalsWithTitles = useMemo(() =>
    goals
      .filter(g => !deletedIds.has(g.id))
      .map(g => ({ ...g, title: localTitles[g.id] ?? g.title, status: localStatuses[g.id] ?? g.status })),
    [goals, localTitles, localStatuses, deletedIds]
  );

  const active = useMemo(() =>
    goalsWithTitles.filter(g => g.status === 'active' || g.status === 'paused'),
    [goalsWithTitles]
  );
  const achieved = useMemo(() =>
    goalsWithTitles.filter(g => g.status === 'achieved' || g.status === 'abandoned'),
    [goalsWithTitles]
  );

  const domains = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of active) {
      const domain = g.domain || 'general';
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(g);
    }
    return map;
  }, [active]);

  if (loading) return <div className="text-stone-400 animate-pulse py-8 text-center">Loading goals…</div>;
  if (error) return <div className="text-red-400 py-4">{error}</div>;
  if (!goals.length) return <div className="text-stone-400 py-8 text-center">No goals yet.</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
        <span>{active.length} active goals</span>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span>{domains.size} domains</span>
        {achieved.length > 0 && <>
          <span style={{ color: '#d1d5db' }}>|</span>
          <span>{achieved.length} achieved/abandoned</span>
        </>}
      </div>

      {/* By domain */}
      {[...domains.entries()].map(([domain, domainGoals]) => {
        const dColor = DOMAIN_COLORS[domain] ?? '#9ca3af';
        return (
          <div key={domain}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: dColor, background: `${dColor}18`, borderRadius: 10, padding: '2px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{domain}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{domainGoals.length} goal{domainGoals.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {domainGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  taskCount={taskCountByGoal.get(goal.id) ?? 0}
                  onEntityClick={onEntityClick}
                  onTitleSaved={handleTitleSaved}
                  onStatusChanged={handleStatusChanged}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Achieved/Abandoned */}
      {achieved.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Achieved / Abandoned</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, opacity: 0.6 }}>
            {achieved.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                taskCount={taskCountByGoal.get(goal.id) ?? 0}
                onEntityClick={onEntityClick}
                onTitleSaved={handleTitleSaved}
                onStatusChanged={handleStatusChanged}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
