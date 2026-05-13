'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApi, getApiBase, getAuthHeaders, patchAction } from './config';
import type { ActionsData } from './config';
import { EntityBadge, useEntityLinks, useEntityCacheUpdater, showSaveError } from './entity-badge';
import type { EntityFocus } from './types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Deal {
  id: number; title: string; stage: string; health?: string; confidence?: number;
  estimated_value?: number | null; target_close_date?: string | null; org_name?: string | null;
  stakeholders?: Array<{ id: number; name: string; influence: string; status: string }>;
}
interface DealsApiData { entities: Deal[]; }
interface ActionsApiData {
  actions?: Array<{ id: number; title: string; entity_id?: number | null; deal_id?: number | null; status?: string; created_at?: string }>;
  grouped?: Record<string, any[]>;
}

const STAGES = [
  { key: 'prospect', label: 'Prospect', color: '#a8a29e' },
  { key: 'discover', label: 'Discover', color: '#3b82f6' },
  { key: 'qualify',  label: 'Qualify',  color: '#f59e0b' },
  { key: 'align',    label: 'Align',    color: '#8b5cf6' },
  { key: 'commit',   label: 'Commit',   color: '#16a34a' },
] as const;

const DEAL_STAGES = ['prospect', 'discover', 'qualify', 'align', 'commit'] as const;

const INFLUENCE_LABELS: Record<string, string> = {
  champion: 'CH', 'decision-maker': 'DM', influencer: 'IN', blocker: 'BL', user: 'US',
};

// ── Helpers ────────────────────────────────────────────────────────────────

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

async function deleteEntity(id: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/entities/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function postAction(body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/actions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ── Stage selector popover ─────────────────────────────────────────────────

function StagePopover({ current, onSelect, onClose }: {
  current: string;
  onSelect: (stage: string) => void;
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

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0,
      background: 'white', border: '1px solid #e5e5ea', borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4,
      minWidth: 130, zIndex: 100,
    }}>
      {STAGES.map(s => (
        <div
          key={s.key}
          onClick={() => { onSelect(s.key); onClose(); }}
          style={{
            padding: '6px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12,
            fontWeight: s.key === current ? 700 : 400,
            color: s.key === current ? s.color : '#374151',
            background: s.key === current ? `${s.color}15` : 'transparent',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={e => { if (s.key !== current) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
          onMouseLeave={e => { if (s.key !== current) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

// ── DealStatusMenu ─────────────────────────────────────────────────────────

function DealStatusMenu({ deal, onStatusAction, onDelete, onClose }: {
  deal: Deal;
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

  const stage = (deal.stage ?? '').toLowerCase();
  const currentIdx = DEAL_STAGES.indexOf(stage as typeof DEAL_STAGES[number]);
  const nextStage = currentIdx >= 0 && currentIdx < DEAL_STAGES.length - 1
    ? DEAL_STAGES[currentIdx + 1]
    : null;

  const actions: Array<{ label: string; newStatus?: string; isDelete?: boolean; color?: string }> = [];

  if (stage === 'won' || stage === 'lost') {
    actions.push({ label: 'Reopen', newStatus: 'prospect' });
  } else if (stage === 'commit') {
    actions.push(
      { label: 'Close as Won', newStatus: 'won' },
      { label: 'Archive', newStatus: 'lost' },
    );
  } else if (currentIdx >= 0) {
    if (nextStage) {
      const label = nextStage.charAt(0).toUpperCase() + nextStage.slice(1);
      actions.push({ label: `Advance to ${label}`, newStatus: nextStage });
    }
    actions.push({ label: 'Archive', newStatus: 'lost' });
  }
  actions.push({ label: 'Delete', isDelete: true, color: '#dc2626' });

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', right: 0,
      background: 'white', border: '1px solid #e5e5ea', borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4,
      minWidth: 150, zIndex: 100,
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

// ── Task row inline ────────────────────────────────────────────────────────

function InlineTask({ task, onDone }: { task: { id: number; title: string; status?: string }; onDone: (id: number) => Promise<void> }) {
  const [done, setDone] = useState(task.status === 'done');
  const pendingRef = useRef(false);
  // Sync with server truth only when not in the middle of an optimistic write
  useEffect(() => { if (!pendingRef.current) setDone(task.status === 'done'); }, [task.status]);
  const handleChange = async () => {
    pendingRef.current = true;
    setDone(true);
    try { await onDone(task.id); } catch { setDone(false); } finally { pendingRef.current = false; }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
      <input
        type="checkbox"
        checked={done}
        onChange={handleChange}
        style={{ accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{ fontSize: 11, color: done ? '#9ca3af' : '#374151', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.4 }}>
        {task.title}
      </span>
    </div>
  );
}

// ── Add task form ──────────────────────────────────────────────────────────

function AddTaskForm({ dealId, onSave, onCancel }: { dealId: number; onSave: (t: any) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await postAction({ title: title.trim(), status: 'open', entity_id: dealId });
      const newId = res?.action?.id;
      if (!newId) throw new Error('No action id in response');
      onSave({ id: newId, title: title.trim(), entity_id: dealId, status: 'open' });
    } catch {
      showSaveError("Couldn't add task — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 5, paddingTop: 5 }}>
      <input
        autoFocus
        placeholder="Task title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ flex: 1, fontSize: 11, padding: '3px 7px', border: '1px solid #e5e5ea', borderRadius: 5, outline: 'none' }}
      />
      <button type="submit" disabled={!title.trim() || saving}
        style={{ fontSize: 10, padding: '3px 7px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
        {saving ? '…' : 'Add'}
      </button>
      <button type="button" onClick={onCancel}
        style={{ fontSize: 10, padding: '3px 7px', background: 'none', color: '#9ca3af', border: '1px solid #e5e5ea', borderRadius: 5, cursor: 'pointer' }}>
        ✕
      </button>
    </form>
  );
}

// ── DealCard ───────────────────────────────────────────────────────────────

function DealCard({
  deal, allTasks, onEntityClick, onStageChange, onTitleSaved, onStatusChanged, onDeleted,
}: {
  deal: Deal;
  allTasks: any[];
  onEntityClick?: (e: EntityFocus) => void;
  onStageChange: (id: number, stage: string) => void;
  onTitleSaved: (id: number, title: string) => void;
  onStatusChanged: (id: number, newStatus: string) => void;
  onDeleted: (id: number) => void;
}) {
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [localTasks, setLocalTasks] = useState<any[] | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const updateCache = useEntityCacheUpdater();

  const dealRef = useRef(deal);
  dealRef.current = deal;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(deal.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const openStagePopover = useCallback(() => { setMenuOpen(false); setStagePopoverOpen(true); }, []);
  const openMenu = useCallback(() => { setStagePopoverOpen(false); setMenuOpen(true); }, []);
  const handleStageClose = useCallback(() => setStagePopoverOpen(false), []);
  const handleMenuClose = useCallback(() => setMenuOpen(false), []);

  const normalizedStage = (deal.stage ?? '').toLowerCase();
  const stageInfo = STAGES.find(s => s.key === normalizedStage) ?? STAGES[0];
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = deal.target_close_date && deal.target_close_date < today;

  // Linked project chips (kind='delivers', deal → project)
  const deliverLinks = useEntityLinks(deal.id, 'from', 'delivers');

  // Tasks for this deal — handle entity_id offset (deal_id + 20000 = entity_id)
  const rawDealTasks = useMemo(() =>
    allTasks.filter(t =>
      t.status === 'open' && (
        (t.deal_id != null && t.deal_id + 20000 === deal.id) ||
        String(t.entity_id) === String(deal.id)
      )
    ).sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      return 0;
    }),
    [allTasks, deal.id]
  );

  const displayTasks = localTasks ?? rawDealTasks;
  const visibleTasks = tasksExpanded ? displayTasks : displayTasks.slice(0, 5);

  const startTitleEdit = () => {
    setTitleDraft(dealRef.current.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 30);
  };

  const commitTitleEdit = useCallback(async () => {
    if (!editingTitle) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === dealRef.current.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      const data = await patchEntity(dealRef.current.id, { title: trimmed });
      const updated = data?.entity ?? { ...dealRef.current, title: trimmed };
      updateCache(updated);
      onTitleSaved(dealRef.current.id, trimmed);
    } catch {
      setTitleDraft(dealRef.current.title);
      showSaveError();
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  }, [editingTitle, titleDraft, updateCache, onTitleSaved]);

  const handleStageSelect = useCallback(async (newStage: string) => {
    const prevStage = dealRef.current.stage;
    const id = dealRef.current.id;
    onStageChange(id, newStage); // optimistic
    try {
      const data = await patchEntity(id, { stage: newStage });
      const updated = data?.entity ?? { ...dealRef.current, stage: newStage };
      updateCache(updated);
    } catch {
      onStageChange(id, prevStage); // revert
      showSaveError();
    }
  }, [onStageChange, updateCache]);

  const handleStatusAction = useCallback(async (newStatus: string) => {
    const prevStatus = dealRef.current.stage;
    onStatusChanged(dealRef.current.id, newStatus);
    try {
      const data = await patchEntity(dealRef.current.id, { stage: newStatus });
      const updated = data?.entity ?? { ...dealRef.current, stage: newStatus };
      updateCache(updated);
    } catch {
      onStatusChanged(dealRef.current.id, prevStatus);
      showSaveError();
    }
  }, [onStatusChanged, updateCache]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Permanently delete "${dealRef.current.title}"?`)) return;
    setMenuOpen(false);
    try {
      await deleteEntity(dealRef.current.id);
      onDeleted(dealRef.current.id);
    } catch {
      showSaveError("Couldn't delete deal — try again");
    }
  }, [onDeleted]);

  const handleTaskDone = useCallback(async (taskId: number): Promise<void> => {
    try {
      await patchAction(taskId, { status: 'done' });
    } catch {
      showSaveError("Couldn't mark task done — try again");
      throw new Error('patchAction failed');
    }
  }, []);

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('dealId', String(deal.id));
        e.dataTransfer.setData('fromStage', deal.stage);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => !editingTitle && onEntityClick?.({ type: 'deal', id: deal.id, name: deal.title })}
      style={{
        position: 'relative', background: 'white', border: '1px solid #e5e5ea', borderRadius: 10,
        padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 8, cursor: 'pointer',
      }}
    >
      {/* Title + org + menu */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 1 }}>
          {editingTitle ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitTitleEdit();
                  if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(dealRef.current.title); }
                }}
                style={{
                  flex: 1, fontSize: 13, fontWeight: 600, color: '#1c1c1e',
                  border: '1px solid #6366f1', borderRadius: 5, padding: '2px 6px', outline: 'none',
                  fontFamily: 'var(--font-headline, DM Sans)',
                }}
              />
              {savingTitle && <span style={{ fontSize: 10, color: '#8e8e93' }}>Saving…</span>}
            </div>
          ) : (
            <div
              style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1c1c1e', lineHeight: 1.35, cursor: 'text' }}
              onClick={e => { e.stopPropagation(); startTitleEdit(); }}
            >{deal.title}</div>
          )}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); menuOpen ? handleMenuClose() : openMenu(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
              title="Deal actions"
            >⋯</button>
            {menuOpen && (
              <DealStatusMenu
                deal={deal}
                onStatusAction={handleStatusAction}
                onDelete={handleDelete}
                onClose={handleMenuClose}
              />
            )}
          </div>
        </div>
        {deal.org_name && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{deal.org_name}</div>
        )}
      </div>

      {/* Stage selector */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
        <button
          onClick={e => { e.stopPropagation(); stagePopoverOpen ? handleStageClose() : openStagePopover(); }}
          style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            border: `1.5px solid ${stageInfo.color}`,
            background: `${stageInfo.color}15`, color: stageInfo.color,
            cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageInfo.color }} />
          {stageInfo.label}
          <span style={{ fontSize: 8 }}>▾</span>
        </button>
        {stagePopoverOpen && (
          <StagePopover current={normalizedStage} onSelect={handleStageSelect} onClose={handleStageClose} />
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#9ca3af', marginBottom: 8, flexWrap: 'wrap' }}>
        {deal.estimated_value && <span style={{ color: '#374151' }}>{formatValue(deal.estimated_value)}</span>}
        {deal.confidence != null && <span>{deal.confidence}%</span>}
        {deal.target_close_date && (
          <span style={{ color: isOverdue ? '#dc2626' : '#9ca3af' }}>{deal.target_close_date}</span>
        )}
        {deal.stakeholders && deal.stakeholders.length > 0 && (
          <span>{deal.stakeholders.length} stakeholder{deal.stakeholders.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Linked project chips */}
      {deliverLinks.length > 0 && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {deliverLinks.map(l => (
            <EntityBadge key={l.id} kind="project" id={l.to_entity_id} size="sm" />
          ))}
        </div>
      )}

      {/* Inline tasks */}
      {displayTasks.length > 0 && (
        <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid #f3f4f6', paddingTop: 6, marginBottom: 4 }}>
          {visibleTasks.map(t => (
            <InlineTask key={t.id} task={t} onDone={handleTaskDone} />
          ))}
          {displayTasks.length > 5 && (
            <button
              onClick={e => { e.stopPropagation(); setTasksExpanded(x => !x); }}
              style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: '2px 0', marginTop: 2 }}
            >
              {tasksExpanded ? `▴ Show less` : `▾ Show all ${displayTasks.length} tasks`}
            </button>
          )}
        </div>
      )}

      {/* Add task */}
      <div onClick={e => e.stopPropagation()} style={{ paddingTop: 2 }}>
        {addingTask ? (
          <AddTaskForm
            dealId={deal.id}
            onSave={t => { setLocalTasks(prev => [t, ...(prev ?? rawDealTasks)]); setAddingTask(false); }}
            onCancel={() => setAddingTask(false)}
          />
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setAddingTask(true); }}
            style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
          >+ Add task</button>
        )}
      </div>
    </div>
  );
}

// ── Main DealBoard ─────────────────────────────────────────────────────────

interface DealBoardProps {
  onEntityClick?: (entity: EntityFocus) => void;
  actionsData?: ActionsData | null;
}

export default function DealBoard({ onEntityClick, actionsData: actionsDataProp }: DealBoardProps) {
  const { data, loading, error } = useApi<DealsApiData>(
    '/api/entities?kind=deal&status=active,won,lost,on_hold'
  );
  const { data: internalActionsData } = useApi<ActionsApiData>(
    actionsDataProp != null ? null : '/api/dashboard/actions?status=open'
  );

  const [stageOverrides, setStageOverrides] = useState<Record<number, string>>({});
  const [localTitles, setLocalTitles] = useState<Record<number, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<number>>(() => new Set());
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const resolvedActionsData = actionsDataProp ?? internalActionsData;

  const allTasks = useMemo(() => {
    const a = resolvedActionsData?.actions;
    if (a) return a;
    const grouped = (resolvedActionsData as any)?.grouped;
    if (grouped) return (Object.values(grouped) as any[][]).flat();
    return [];
  }, [resolvedActionsData]);

  const deals: Deal[] = useMemo(() => data?.entities ?? [], [data]);

  const dealsWithStage = useMemo(() =>
    deals
      .filter(d => !deletedIds.has(d.id))
      .map(d => ({
        ...d,
        title: localTitles[d.id] ?? d.title,
        stage: stageOverrides[d.id] ?? d.stage,
      })),
    [deals, stageOverrides, localTitles, deletedIds]
  );

  const handleStageChange = useCallback((id: number, stage: string) => {
    setStageOverrides(prev => ({ ...prev, [id]: stage }));
  }, []);

  const handleTitleSaved = useCallback((id: number, title: string) => {
    setLocalTitles(prev => ({ ...prev, [id]: title }));
  }, []);

  const handleStatusChanged = useCallback((id: number, newStatus: string) => {
    setStageOverrides(prev => ({ ...prev, [id]: newStatus }));
  }, []);

  const handleDeleted = useCallback((id: number) => {
    setDeletedIds(prev => new Set([...prev, id]));
  }, []);

  // Prune stale stageOverrides + deletedIds after server refetch
  useEffect(() => {
    setStageOverrides(prev => {
      let changed = false;
      const pruned = { ...prev };
      for (const d of deals) {
        const serverStage = (d.stage ?? '').toLowerCase();
        if (pruned[d.id] !== undefined && (pruned[d.id] ?? '').toLowerCase() === serverStage) {
          delete pruned[d.id]; changed = true;
        }
      }
      return changed ? pruned : prev;
    });
    setDeletedIds(prev => {
      if (prev.size === 0) return prev;
      const serverIds = new Set(deals.map(d => d.id));
      const pruned = new Set([...prev].filter(id => serverIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [deals]);

  const totalValue = dealsWithStage.reduce((s, d) => s + (d.estimated_value ?? 0), 0);
  const weightedValue = dealsWithStage.reduce((s, d) => s + (d.estimated_value ?? 0) * ((d.confidence ?? 100) / 100), 0);

  if (loading) return <div className="text-stone-400 animate-pulse py-8 text-center">Loading deals…</div>;
  if (error) return <div className="text-red-400 py-4">{error}</div>;
  if (!deals.length) return <div className="text-stone-400 py-8 text-center">No deals yet.</div>;

  return (
    <div style={{ fontFamily: 'var(--font-headline, DM Sans)' }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', marginBottom: 16, flexWrap: 'wrap' }}>
        <span>{dealsWithStage.length} deals</span>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span>Pipeline: <strong style={{ color: '#1c1c1e' }}>{formatValue(totalValue)}</strong></span>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span>Weighted: <strong style={{ color: '#1c1c1e' }}>{formatValue(weightedValue)}</strong></span>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, minHeight: '60vh' }}>
        {STAGES.map(stage => {
          const stageDeals = dealsWithStage.filter(d => {
            const ds = (d.stage ?? '').toLowerCase();
            return ds === stage.key;
          });
          const isOver = dragOverStage === stage.key;
          return (
            <div
              key={stage.key}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
              onDrop={async e => {
                e.preventDefault();
                setDragOverStage(null);
                const dealId = Number(e.dataTransfer.getData('dealId'));
                const fromStage = e.dataTransfer.getData('fromStage');
                if (!dealId || (fromStage ?? '').toLowerCase() === stage.key) return;
                handleStageChange(dealId, stage.key);
                try { await patchEntity(dealId, { stage: stage.key }); }
                catch { handleStageChange(dealId, fromStage); showSaveError(); }
              }}
              style={{
                display: 'flex', flexDirection: 'column',
                borderRadius: 10,
                outline: isOver ? `2px dashed ${stage.color}` : '2px dashed transparent',
                background: isOver ? `${stage.color}08` : 'transparent',
                transition: 'outline .1s, background .1s',
                padding: isOver ? '0 4px 4px' : '0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${stage.color}22` }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>{stageDeals.length}</span>
              </div>
              <div style={{ flex: 1 }}>
                {stageDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    allTasks={allTasks}
                    onEntityClick={onEntityClick}
                    onStageChange={handleStageChange}
                    onTitleSaved={handleTitleSaved}
                    onStatusChanged={handleStatusChanged}
                    onDeleted={handleDeleted}
                  />
                ))}
                {!stageDeals.length && (
                  <div style={{
                    border: `1px dashed ${isOver ? stage.color : '#e5e5ea'}`, borderRadius: 8,
                    padding: '12px 8px', textAlign: 'center', fontSize: 11, color: isOver ? stage.color : '#d1d5db',
                    minHeight: 60,
                  }}>Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
