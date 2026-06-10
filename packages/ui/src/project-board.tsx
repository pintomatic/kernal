'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApi, getApiBase, getAuthHeaders } from './config';
import { EntityBadge, useEntityLinks, useEntityCacheUpdater, showSaveError } from './entity-badge';
import type { EntityFocus } from './types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id: number;
  title: string;
  status: string;
  health?: string;
  description?: string | null;
  updated_at?: string;
}

interface ProjectsApiData {
  entities: Project[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'planned',   label: 'Planned',   color: '#9ca3af' },
  { key: 'active',    label: 'Active',    color: '#3b82f6' },
  { key: 'paused',    label: 'Paused',    color: '#f59e0b' },
  { key: 'done',      label: 'Done',      color: '#16a34a' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
] as const;

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

async function deleteEntity(id: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/entities/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── ProjectStatusMenu ──────────────────────────────────────────────────────

function ProjectStatusMenu({ project, onStatusAction, onDelete, onClose }: {
  project: Project;
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

  const status = (project.status ?? '').toLowerCase();
  const actions: Array<{ label: string; newStatus?: string; isDelete?: boolean; color?: string }> = [];

  if (status === 'planned') {
    actions.push(
      { label: 'Activate', newStatus: 'active' },
      { label: 'Cancel', newStatus: 'cancelled' },
    );
  } else if (status === 'active') {
    actions.push(
      { label: 'Pause', newStatus: 'paused' },
      { label: 'Complete', newStatus: 'done' },
      { label: 'Cancel', newStatus: 'cancelled' },
    );
  } else if (status === 'paused') {
    actions.push(
      { label: 'Activate', newStatus: 'active' },
      { label: 'Complete', newStatus: 'done' },
      { label: 'Cancel', newStatus: 'cancelled' },
    );
  } else if (status === 'done') {
    actions.push({ label: 'Reopen', newStatus: 'active' });
  } else if (status === 'cancelled') {
    actions.push({ label: 'Reopen', newStatus: 'planned' });
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

// ── ProjectCard ────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  isDragging,
  onEntityClick,
  onDragStart,
  onDragEnd,
  onTitleSaved,
  onStatusChanged,
  onDeleted,
}: {
  project: Project;
  isDragging: boolean;
  onEntityClick?: (e: EntityFocus) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTitleSaved: (id: number, title: string) => void;
  onStatusChanged: (id: number, newStatus: string) => void;
  onDeleted: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskError, setTaskError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleMenuClose = useCallback(() => setMenuOpen(false), []);
  const updateCache = useEntityCacheUpdater();

  const projectRef = useRef(project);
  projectRef.current = project;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // project → goal: project is the FROM side of 'serves' link
  const servesLinks = useEntityLinks(project.id, 'from', 'serves');
  // deal → project: project is the TO side of 'delivers' link
  const deliversLinks = useEntityLinks(project.id, 'to', 'delivers');

  // Lazy-fetch tasks when expanded — proper useEffect cleanup prevents setState on unmount
  useEffect(() => {
    if (!expanded || tasks !== null) return;
    let cancelled = false;
    setTasksLoading(true);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${getApiBase()}/api/actions?entity_id=${project.id}&status=open`,
          { headers }
        );
        if (cancelled) return;
        if (!res.ok) { setTasks([]); setTaskError(true); return; }
        const d = await res.json();
        setTasks((d.actions ?? []).slice(0, 5));
      } catch {
        if (!cancelled) { setTasks([]); setTaskError(true); }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, project.id]); // tasks intentionally excluded — would cause loop

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(o => !o);
  };

  const handleCardClick = () => {
    if (!editingTitle) onEntityClick?.({ type: 'project', id: project.id, name: project.title });
  };

  const startTitleEdit = () => {
    setTitleDraft(projectRef.current.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 30);
  };

  const commitTitleEdit = useCallback(async () => {
    if (!editingTitle) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === projectRef.current.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      const data = await patchEntity(projectRef.current.id, { title: trimmed });
      const updated = data?.entity ?? { ...projectRef.current, title: trimmed };
      updateCache(updated);
      onTitleSaved(projectRef.current.id, trimmed);
    } catch {
      setTitleDraft(projectRef.current.title);
      showSaveError();
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  }, [editingTitle, titleDraft, updateCache, onTitleSaved]);

  const handleStatusAction = useCallback(async (newStatus: string) => {
    const prevStatus = projectRef.current.status;
    onStatusChanged(projectRef.current.id, newStatus);
    try {
      const data = await patchEntity(projectRef.current.id, { status: newStatus });
      const updated = data?.entity ?? { ...projectRef.current, status: newStatus };
      updateCache(updated);
    } catch {
      onStatusChanged(projectRef.current.id, prevStatus);
      showSaveError();
    }
  }, [onStatusChanged, updateCache]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Permanently delete "${projectRef.current.title}"?`)) return;
    setMenuOpen(false);
    try {
      await deleteEntity(projectRef.current.id);
      onDeleted(projectRef.current.id);
    } catch {
      showSaveError("Couldn't delete project — try again");
    }
  }, [onDeleted]);

  const hColor = healthColor(project.health);

  return (
    <div
      draggable={true}
      onDragStart={e => { e.stopPropagation(); onDragStart(e, project.id); }}
      onDragEnd={onDragEnd}
      style={{
        background: 'white',
        border: '1px solid #e5e5ea',
        borderLeft: `3px solid #D97706`,
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 8,
        opacity: isDragging ? 0.6 : 1,
        cursor: 'grab',
        transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6, cursor: 'pointer' }}
        onClick={handleCardClick}
      >
        <span style={{
          fontSize: 8, fontWeight: 700, color: '#D97706', background: '#FEF3C7',
          borderRadius: 4, padding: '2px 5px', letterSpacing: '0.06em', flexShrink: 0, marginTop: 2,
        }}>PROJECT</span>

        {editingTitle ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitleEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitleEdit();
                if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(projectRef.current.title); }
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
          <span
            style={{
              fontSize: 13, fontWeight: 600, color: '#1c1c1e', lineHeight: 1.35, flex: 1,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'text',
            }}
            onClick={e => { e.stopPropagation(); startTitleEdit(); }}
          >{project.title}</span>
        )}

        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: hColor,
          flexShrink: 0, display: 'inline-block', marginTop: 4,
        }} title={`Health: ${project.health ?? 'green'}`} />

        {/* ⋯ menu button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); if (!isDragging) setMenuOpen(o => !o); }}
            disabled={isDragging}
            style={{
              background: 'none', border: 'none',
              cursor: isDragging ? 'not-allowed' : 'pointer',
              color: isDragging ? '#e5e5ea' : '#9ca3af',
              fontSize: 14, padding: '0 4px', lineHeight: 1,
              opacity: isDragging ? 0.4 : 1,
            }}
            title="Project actions"
          >⋯</button>
          {menuOpen && !isDragging && (
            <ProjectStatusMenu
              project={project}
              onStatusAction={handleStatusAction}
              onDelete={handleDelete}
              onClose={handleMenuClose}
            />
          )}
        </div>
      </div>

      {/* Linked goal badge */}
      {servesLinks.length > 0 && (
        <div style={{ marginBottom: 5 }}>
          <EntityBadge kind="goal" id={servesLinks[0].to_entity_id} size="sm" />
        </div>
      )}

      {/* Linked deal badge */}
      {deliversLinks.length > 0 && (
        <div style={{ marginBottom: 5 }}>
          <EntityBadge kind="deal" id={deliversLinks[0].from_entity_id} size="sm" />
        </div>
      )}

      {/* Expand / task section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        {tasks !== null && tasks.length > 0 && (
          /* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
           * Task chip ink+bg pair collapsed from indigo+violet-tint to teal+teal-soft. */
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#0f766e', background: '#ccfbf1',
            borderRadius: 10, padding: '1px 6px',
          }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        )}
        <button
          onClick={handleExpandClick}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: 11, padding: '0 2px', marginLeft: 'auto',
            lineHeight: 1,
          }}
          title={expanded ? 'Collapse tasks' : 'Expand tasks'}
        >{expanded ? '▾' : '▸'}</button>
      </div>

      {/* Expanded task list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 6, marginTop: 4 }}>
          {tasksLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: `${60 + i * 15}%` }} />
              ))}
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {tasks.map((t: any) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <span style={{ color: '#9ca3af', fontSize: 10, marginTop: 1 }}>•</span>
                  <span style={{
                    fontSize: 11, color: t.status === 'done' ? '#9ca3af' : '#374151',
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}>{t.title}</span>
                </div>
              ))}
            </div>
          ) : taskError ? (
            <div style={{ fontSize: 11, color: '#dc2626', textAlign: 'center', padding: '4px 0' }}>
              Failed to load tasks
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', padding: '4px 0' }}>
              No open tasks
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ProjectBoard ──────────────────────────────────────────────────────

interface ProjectBoardProps {
  onEntityClick?: (entity: EntityFocus) => void;
}

export default function ProjectBoard({ onEntityClick }: ProjectBoardProps) {
  const { data, loading, error } = useApi<ProjectsApiData>(
    '/api/entities?kind=project&status=planned,active,paused,done,cancelled'
  );

  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  const [localTitles, setLocalTitles] = useState<Record<number, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<number>>(() => new Set());
  const [dragging, setDragging] = useState<Set<number>>(new Set());
  const updateCache = useEntityCacheUpdater();

  const projects: Project[] = useMemo(() => data?.entities ?? [], [data]);

  const projectsWithStatus = useMemo(() =>
    projects
      .filter(p => !deletedIds.has(p.id))
      .map(p => ({
        ...p,
        title: localTitles[p.id] ?? p.title,
        status: statusOverrides[p.id] ?? p.status,
      })),
    [projects, statusOverrides, localTitles, deletedIds]
  );

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('projectId', String(id));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const projectId = parseInt(e.dataTransfer.getData('projectId'), 10);
    if (isNaN(projectId)) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const prevStatus = statusOverrides[projectId] ?? project.status;
    if (prevStatus === newStatus) return;

    setStatusOverrides(prev => ({ ...prev, [projectId]: newStatus }));
    setDragging(prev => new Set([...prev, projectId]));
    try {
      const data = await patchEntity(projectId, { status: newStatus });
      const updated = data?.entity ?? { ...project, status: newStatus };
      updateCache(updated);
    } catch {
      setStatusOverrides(prev => ({ ...prev, [projectId]: prevStatus }));
      showSaveError();
    } finally {
      setDragging(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  }, [projects, statusOverrides, updateCache]);

  const handleTitleSaved = useCallback((id: number, title: string) => {
    setLocalTitles(prev => ({ ...prev, [id]: title }));
  }, []);

  const handleStatusChanged = useCallback((id: number, newStatus: string) => {
    setStatusOverrides(prev => ({ ...prev, [id]: newStatus }));
  }, []);

  const handleDeleted = useCallback((id: number) => {
    setDeletedIds(prev => new Set([...prev, id]));
  }, []);

  // Prune stale statusOverrides + deletedIds after server refetch
  useEffect(() => {
    setStatusOverrides(prev => {
      let changed = false;
      const pruned = { ...prev };
      for (const p of projects) {
        const serverStatus = (p.status ?? '').toLowerCase();
        if (pruned[p.id] !== undefined && (pruned[p.id] ?? '').toLowerCase() === serverStatus) {
          delete pruned[p.id]; changed = true;
        }
      }
      return changed ? pruned : prev;
    });
    setDeletedIds(prev => {
      if (prev.size === 0) return prev;
      const serverIds = new Set(projects.map(p => p.id));
      const pruned = new Set([...prev].filter(id => serverIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [projects]);

  if (loading) return (
    <div className="text-stone-400 animate-pulse py-8 text-center">Loading projects…</div>
  );
  if (error) return (
    <div className="text-red-400 py-4">{error}</div>
  );
  if (!projects.length) return (
    <div className="text-stone-400 py-8 text-center">No projects yet.</div>
  );

  return (
    <div style={{ fontFamily: 'var(--font-headline, DM Sans)' }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', marginBottom: 16, flexWrap: 'wrap' }}>
        <span>{projectsWithStatus.length} projects</span>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span>{projectsWithStatus.filter(p => p.status === 'active').length} active</span>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, minHeight: '60vh' }}>
        {STATUSES.map(status => {
          const colProjects = projectsWithStatus.filter(p =>
            (p.status ?? '').toLowerCase() === status.key
          );
          return (
            <div
              key={status.key}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, status.key)}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 10, paddingBottom: 6,
                borderBottom: `2px solid ${status.color}22`,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: status.color, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 700, color: status.color,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>{status.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
                  {colProjects.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ flex: 1 }}>
                {colProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isDragging={dragging.has(project.id)}
                    onEntityClick={onEntityClick}
                    onDragStart={handleDragStart}
                    onDragEnd={e => setDragging(prev => { const n = new Set(prev); n.delete(project.id); return n; })}
                    onTitleSaved={handleTitleSaved}
                    onStatusChanged={handleStatusChanged}
                    onDeleted={handleDeleted}
                  />
                ))}
                {!colProjects.length && (
                  <div style={{
                    border: '1px dashed #e5e5ea', borderRadius: 8,
                    padding: '12px 8px', textAlign: 'center',
                    fontSize: 11, color: '#d1d5db',
                  }}>
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
