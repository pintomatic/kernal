'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useApi, getApiBase, getAuthHeaders } from './config';

// ── Types ──────────────────────────────────────────────────────────────────

type Health = 'red' | 'yellow' | 'green' | string;

interface Entity {
  id: string | number;
  kind: 'goal' | 'project' | 'deal';
  title: string;
  status?: string;
  stage?: string;
  health?: Health;
  progress_pct?: number;
  confidence?: number;
}

interface Link {
  from_entity_id: string | number;
  to_entity_id: string | number;
  kind: string;
}

interface Task {
  id: string | number;
  title: string;
  due_date?: string | null;
  status?: string;
  entity_id?: string | number | null;
}

type FilterMode = 'all' | 'projects' | 'deals';

// ── Helpers ────────────────────────────────────────────────────────────────

const healthColor = (h?: Health) =>
  h === 'red' ? '#dc2626' : h === 'yellow' ? '#d97706' : '#16a34a';

async function patchAction(id: string | number, body: Record<string, unknown>) {
  const base = getApiBase();
  const headers = await getAuthHeaders();
  await fetch(`${base}/api/actions/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function postAction(body: Record<string, unknown>) {
  const base = getApiBase();
  const headers = await getAuthHeaders();
  const res = await fetch(`${base}/api/actions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, onDone }: { task: Task; onDone: (id: string | number) => void }) {
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const overdue = task.due_date && task.due_date < today;

  const handleCheck = () => {
    if (fading) return;
    setFading(true);
    timerRef.current = setTimeout(() => {
      patchAction(task.id, { status: 'done' }).catch(() => {});
      onDone(task.id);
    }, 500);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 7,
      padding: '4px 0', opacity: fading ? 0.3 : 1,
      transition: 'opacity 0.4s',
    }}>
      <input
        type="checkbox"
        checked={fading}
        onChange={handleCheck}
        style={{ marginTop: 2, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{
          fontSize: 12, color: '#1c1c1e', lineHeight: 1.4, wordBreak: 'break-word',
          textDecoration: fading ? 'line-through' : 'none',
        }}>{task.title}</span>
        {task.due_date && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 500,
            color: overdue ? '#dc2626' : '#8e8e93',
            background: overdue ? '#fee2e2' : '#f3f4f6',
            borderRadius: 4, padding: '1px 5px',
          }}>{task.due_date}</span>
        )}
      </div>
    </div>
  );
}

// ── Add task inline ────────────────────────────────────────────────────────

function AddTaskForm({ entityId, onSave, onCancel }: {
  entityId: string | number;
  onSave: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const result = await postAction({ title: title.trim(), status: 'open', entity_id: entityId });
      onSave({ id: result?.action?.id ?? Date.now(), title: title.trim(), entity_id: entityId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 6 }}>
      <input
        autoFocus
        placeholder="Task title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{
          flex: 1, fontSize: 12, padding: '4px 8px',
          border: '1px solid #e5e5ea', borderRadius: 6, outline: 'none',
          fontFamily: 'var(--font-headline, DM Sans)', color: '#1c1c1e',
        }}
      />
      <button
        type="submit" disabled={!title.trim() || saving}
        style={{ fontSize: 11, padding: '4px 8px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >{saving ? '…' : 'Add'}</button>
      <button
        type="button" onClick={onCancel}
        style={{ fontSize: 11, padding: '4px 8px', background: 'none', color: '#8e8e93', border: '1px solid #e5e5ea', borderRadius: 6, cursor: 'pointer' }}
      >✕</button>
    </form>
  );
}

// ── Entity tile (Project or Deal) ──────────────────────────────────────────

function EntityTile({ entity, tasks, onTaskDone, onTaskAdd }: {
  entity: Entity;
  tasks: Task[];
  onTaskDone: (id: string | number) => void;
  onTaskAdd: (task: Task) => void;
}) {
  const [addingTask, setAddingTask] = useState(false);
  const isProject = entity.kind === 'project';
  /* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
   * Deal accent was indigo `#6366F1` with violet-tinted `#EDE9FE` chip —
   * both collapse to teal-2 / teal-soft, the canonical brand accent. The
   * ALIGN stage hue was `#8b5cf6` — retired to teal-ink. */
  const accentColor = isProject ? '#D97706' : '#0d9488';
  const badgeBg = isProject ? '#FEF3C7' : '#ccfbf1';
  const kindLabel = isProject ? 'PROJECT' : 'DEAL';
  const statusLabel = isProject ? (entity.status ?? '').toUpperCase() : (entity.stage ?? '').toUpperCase();

  const stageColors: Record<string, string> = {
    DISCOVER: '#3b82f6', QUALIFY: '#f59e0b', ALIGN: '#0f766e',
    COMMIT: '#16a34a', PROSPECT: '#9ca3af',
  };
  const statusColor = isProject
    ? (entity.status === 'active' ? '#16a34a' : '#8e8e93')
    : (stageColors[statusLabel] ?? '#9ca3af');

  return (
    <div style={{
      background: 'white', borderRadius: 8, overflow: 'hidden',
      border: '1px solid #e5e5ea', borderLeft: `3px solid ${accentColor}`,
    }}>
      {/* Tile header */}
      <div style={{ padding: '8px 10px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: accentColor,
            background: badgeBg, borderRadius: 4, padding: '1px 5px',
            letterSpacing: '0.06em',
          }}>{kindLabel}</span>
          {statusLabel && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: statusColor,
              background: '#f9fafb', border: `1px solid ${statusColor}22`,
              borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em',
            }}>{statusLabel}</span>
          )}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#1c1c1e',
          lineHeight: 1.35, wordBreak: 'break-word',
        }}>{entity.title}</div>
      </div>

      {/* Task list */}
      {tasks.length > 0 && (
        <div style={{ padding: '0 10px 4px', borderTop: '1px solid #f3f4f6' }}>
          {tasks.map(t => <TaskRow key={t.id} task={t} onDone={onTaskDone} />)}
        </div>
      )}

      {/* Add task */}
      <div style={{ padding: '4px 10px 8px' }}>
        {addingTask ? (
          <AddTaskForm
            entityId={entity.id}
            onSave={t => { onTaskAdd(t); setAddingTask(false); }}
            onCancel={() => setAddingTask(false)}
          />
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            style={{
              fontSize: 10, background: 'none', border: 'none',
              cursor: 'pointer', color: '#8e8e93', padding: 0,
            }}
          >+ Add task</button>
        )}
      </div>
    </div>
  );
}

// ── Goal card ──────────────────────────────────────────────────────────────

function GoalCard({ goal, children, tasks, tasksByEntity, filter, onTaskDone, onTaskAdd }: {
  goal: Entity;
  children: Entity[];
  tasks: Task[];
  tasksByEntity: Map<string, Task[]>;
  filter: FilterMode;
  onTaskDone: (id: string | number) => void;
  onTaskAdd: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const threadCount = children.length + tasks.length;
  const hColor = healthColor(goal.health);
  const pct = goal.progress_pct ?? 0;

  const visibleChildren = filter === 'all' ? children
    : filter === 'projects' ? children.filter(c => c.kind === 'project')
    : children.filter(c => c.kind === 'deal');

  return (
    <div style={{
      background: 'white', borderRadius: 10, overflow: 'hidden',
      border: '1px solid #e5e5ea', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Card header */}
      <div style={{
        padding: '10px 12px 8px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
      }} onClick={() => setExpanded(e => !e)}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: hColor, flexShrink: 0, display: 'inline-block' }} />
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#16A34A',
          background: '#f0fdf4', borderRadius: 4, padding: '1px 5px',
          letterSpacing: '0.06em', flexShrink: 0,
        }}>GOAL</span>
        {threadCount > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#8e8e93',
            background: '#f3f4f6', borderRadius: 10, padding: '1px 6px', flexShrink: 0,
          }}>{threadCount}</span>
        )}
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 600, color: '#1c1c1e',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{goal.title}</span>
        {typeof goal.confidence === 'number' && (
          <span style={{ fontSize: 10, color: '#8e8e93', flexShrink: 0 }}>{goal.confidence}%</span>
        )}
        <span style={{ fontSize: 11, color: '#8e8e93', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#f3f4f6' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: hColor, transition: 'width 0.4s' }} />
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '10px 12px 12px' }}>
          {visibleChildren.length === 0 && (
            <div style={{ fontSize: 11, color: '#8e8e93', textAlign: 'center', padding: '8px 0' }}>
              No {filter === 'all' ? 'projects or deals' : filter} linked.
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 8,
          }}>
            {visibleChildren.map(entity => (
              <EntityTile
                key={entity.id}
                entity={entity}
                tasks={tasksByEntity.get(String(entity.id)) ?? []}
                onTaskDone={onTaskDone}
                onTaskAdd={onTaskAdd}
              />
            ))}
          </div>
          {/* Direct goal tasks (no entity) */}
          {tasks.length > 0 && (
            <div style={{ marginTop: visibleChildren.length > 0 ? 10 : 0, padding: '6px 8px', background: '#fafafa', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 4 }}>TASKS</div>
              {tasks.map(t => <TaskRow key={t.id} task={t} onDone={onTaskDone} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main WorkBoard ─────────────────────────────────────────────────────────

export default function WorkBoard({ onExpand }: { onExpand?: () => void }) {
  const { data: goalsData } = useApi<any>('/api/entities?kind=goal&status=active');
  const { data: peersData } = useApi<any>('/api/entities?kind=project,deal&status=active,planned,on_hold');
  const { data: linksData } = useApi<any>('/api/entities/links');
  const { data: actionsData } = useApi<any>('/api/dashboard/actions');

  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  // Flatten tasks from API
  const rawTasks: Task[] = useMemo(() => {
    const all = actionsData?.actions ?? [];
    const grouped = actionsData?.grouped;
    if (grouped) return (Object.values(grouped) as Task[][]).flat();
    return all;
  }, [actionsData]);

  const tasks: Task[] = useMemo(() => localTasks ?? rawTasks, [localTasks, rawTasks]);

  const goals: Entity[] = useMemo(() => goalsData?.entities ?? [], [goalsData]);
  const peers: Entity[] = useMemo(() => peersData?.entities ?? [], [peersData]);
  const links: Link[] = useMemo(() => linksData?.links ?? [], [linksData]);

  // Build goal → children map via entity-links (kind='serves')
  const goalChildren = useMemo(() => {
    const map = new Map<string, Entity[]>();
    for (const link of links.filter((l: Link) => l.kind === 'serves')) {
      const peer = peers.find(p => String(p.id) === String(link.from_entity_id));
      const goalId = String(link.to_entity_id);
      if (peer) {
        if (!map.has(goalId)) map.set(goalId, []);
        map.get(goalId)!.push(peer);
      }
    }
    return map;
  }, [peers, links]);

  // Build entity → tasks map
  const tasksByEntity = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.entity_id) {
        const key = String(t.entity_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    }
    return map;
  }, [tasks]);

  // Tasks with no entity_id (direct goal tasks via entity_id matching goal)
  const tasksByGoal = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const isGoalTask = goals.some(g => String(g.id) === String(t.entity_id));
      if (isGoalTask) {
        const key = String(t.entity_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    }
    return map;
  }, [tasks, goals]);

  const removeTask = useCallback((id: string | number) => {
    setLocalTasks(prev => (prev ?? rawTasks).filter(t => String(t.id) !== String(id)));
  }, [rawTasks]);

  const addTask = useCallback((task: Task) => {
    setLocalTasks(prev => [task, ...(prev ?? rawTasks)]);
  }, [rawTasks]);

  // Header stats
  const projectCount = peers.filter(p => p.kind === 'project').length;
  const dealCount = peers.filter(p => p.kind === 'deal').length;
  const openTaskCount = tasks.length;

  const filterBtn = (mode: FilterMode, label: string, color: string) => (
    <button
      onClick={() => setFilter(mode)}
      style={{
        fontSize: 11, fontWeight: filter === mode ? 700 : 500,
        padding: '3px 10px', borderRadius: 14, cursor: 'pointer',
        border: filter === mode ? `1.5px solid ${color}` : '1.5px solid #e5e5ea',
        background: filter === mode ? `${color}11` : 'white',
        color: filter === mode ? color : '#8e8e93',
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ padding: '12px 16px', fontFamily: 'var(--font-headline, DM Sans)', minHeight: 200 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, flex: 1, flexWrap: 'wrap' }}>
          <StatChip label="GOALS" value={goals.length} color="#16A34A" />
          <StatChip label="PROJECTS" value={projectCount} color="#D97706" />
          <StatChip label="DEALS" value={dealCount} color="#6366F1" />
          <StatChip label="OPEN TASKS" value={openTaskCount} color="#9CA3AF" />
        </div>
        {onExpand && (
          <button onClick={onExpand} style={{
            background: 'none', border: '1px solid #e5e5ea', borderRadius: 6,
            padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#8e8e93',
          }}>⤢ Expand</button>
        )}
      </div>

      {/* Filter toggles */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {filterBtn('all', 'All', '#1c1c1e')}
        {filterBtn('projects', '• Projects', '#D97706')}
        {filterBtn('deals', '• Deals', '#6366F1')}
      </div>

      {/* Goal cards — 2-col on wide, 1-col on narrow */}
      {goals.length === 0 && (
        <div style={{ fontSize: 12, color: '#8e8e93', textAlign: 'center', paddingTop: 24 }}>No active goals.</div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 12,
      }}>
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            children={goalChildren.get(String(goal.id)) ?? []}
            tasks={tasksByGoal.get(String(goal.id)) ?? []}
            tasksByEntity={tasksByEntity}
            filter={filter}
            onTaskDone={removeTask}
            onTaskAdd={addTask}
          />
        ))}
      </div>
    </div>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#8e8e93', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}
