'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { getApiBase, getAuthHeaders } from './config';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Entity {
  id: string | number;
  kind: 'goal' | 'project' | 'deal' | 'task' | string;
  title: string;
  status?: string;
  stage?: string;
  health?: string;
  progress_pct?: number;
  confidence?: number;
  updated_at?: string;
}

export interface EntityLink {
  id: number;
  from_entity_id: string | number;
  to_entity_id: string | number;
  kind: string;
}

interface EntityCacheState {
  map: Map<string, Entity>;
  update: (entity: Entity) => void;
  getLinks: (entityId: string | number, dir: 'from' | 'to', kind?: string) => EntityLink[];
  links: EntityLink[];
}

// ── Context ────────────────────────────────────────────────────────────────

export const EntityCacheContext = createContext<EntityCacheState>({
  map: new Map(),
  update: () => {},
  getLinks: () => [],
  links: [],
});

// Internal context for lazy fetch — must be declared before EntityCacheProvider
const LazyFetchContext = createContext<(id: string) => void>(() => {});

// ── Provider ───────────────────────────────────────────────────────────────

export function EntityCacheProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Map<string, Entity>>(new Map());
  const [links, setLinks] = useState<EntityLink[]>([]);
  const fetchedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const base = getApiBase();
        const [entRes, linkRes] = await Promise.all([
          fetch(`${base}/api/entities?limit=500&order=updated_at+desc`, { credentials: 'include', headers }),
          fetch(`${base}/api/entities/links`, { credentials: 'include', headers }),
        ]);
        if (cancelled) return;
        if (!entRes.ok || !linkRes.ok) return;
        const entData = await entRes.json();
        const linkData = await linkRes.json();
        const entities: Entity[] = entData.entities ?? [];
        // Merge into existing map — preserves any lazy-fetched entities not in the top-500
        setMap(prev => {
          const next = new Map(prev);
          for (const e of entities) next.set(String(e.id), e);
          return next;
        });
        setLinks(linkData.links ?? []);
      } catch {
        // silent — cache best-effort
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((entity: Entity) => {
    setMap(prev => {
      const next = new Map(prev);
      next.set(String(entity.id), entity);
      return next;
    });
  }, []);

  const getLinks = useCallback((entityId: string | number, dir: 'from' | 'to', kind?: string): EntityLink[] => {
    const key = String(entityId);
    return links.filter(l => {
      const match = dir === 'from'
        ? String(l.from_entity_id) === key
        : String(l.to_entity_id) === key;
      return match && (!kind || l.kind === kind);
    });
  }, [links]);

  // Lazy-fetch misses on demand (called from useEntity)
  const lazyFetch = useCallback(async (id: string) => {
    if (fetchedIds.current.has(id)) return;
    fetchedIds.current.add(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/entities/${id}`, { credentials: 'include', headers });
      if (!res.ok) {
        fetchedIds.current.delete(id); // allow retry on transient failure
        return;
      }
      const data = await res.json();
      const entity: Entity = data.entity ?? data;
      if (entity?.id) {
        setMap(prev => {
          const next = new Map(prev);
          next.set(String(entity.id), entity);
          return next;
        });
      }
    } catch {
      fetchedIds.current.delete(id); // allow retry on network error
    }
  }, []);

  const contextValue = useMemo(() => ({ map, update, getLinks, links }), [map, update, getLinks, links]);

  return (
    <EntityCacheContext.Provider value={contextValue}>
      <LazyFetchContext.Provider value={lazyFetch}>
        {children}
      </LazyFetchContext.Provider>
    </EntityCacheContext.Provider>
  );
}


// ── Exported: updateEntityCache — for use by tabs after PATCH ─────────────

export function useEntityCacheUpdater(): (entity: Entity) => void {
  return useContext(EntityCacheContext).update;
}

// ── Hook: useEntity ────────────────────────────────────────────────────────

export function useEntity(id: string | number | null | undefined): Entity | undefined {
  const { map } = useContext(EntityCacheContext);
  const lazyFetch = useContext(LazyFetchContext);

  useEffect(() => {
    if (!id) return;
    // lazyFetch is stable and dedupes via provider's fetchedIds — safe to call on id change only
    lazyFetch(String(id));
  }, [id, lazyFetch]);

  if (!id) return undefined;
  return map.get(String(id));
}

// ── Hook: useEntityLinks ───────────────────────────────────────────────────

export function useEntityLinks(
  entityId: string | number | null | undefined,
  dir: 'from' | 'to',
  kind?: string,
): EntityLink[] {
  const { getLinks } = useContext(EntityCacheContext);
  return useMemo(
    () => entityId ? getLinks(entityId, dir, kind) : [],
    [getLinks, entityId, dir, kind],
  );
}

// ── Toast helper ───────────────────────────────────────────────────────────

export function showSaveError(msg = "Couldn't save — try again"): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('kd-save-toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'kd-save-toast';
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999',
    background: '#1c1c1e', color: '#fff', fontSize: '13px',
    padding: '10px 16px', borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    fontFamily: 'var(--font-headline, DM Sans)',
    transition: 'opacity 0.3s',
    opacity: '1',
  });
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 4000);
}

// ── Kind colors ────────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, { accent: string; bg: string; label: string }> = {
  goal:    { accent: '#16A34A', bg: '#f0fdf4', label: 'GOAL' },
  project: { accent: '#D97706', bg: '#FEF3C7', label: 'PROJECT' },
  deal:    { accent: '#6366F1', bg: '#EDE9FE', label: 'DEAL' },
  task:    { accent: '#9CA3AF', bg: '#F3F4F6', label: 'TASK' },
};

// ── EntityBadge ────────────────────────────────────────────────────────────

interface EntityBadgeProps {
  kind: 'goal' | 'project' | 'deal' | 'task' | string;
  id: string | number;
  title?: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function EntityBadge({ kind, id, title: fallbackTitle, onClick, size = 'md' }: EntityBadgeProps) {
  const entity = useEntity(id);
  const colors = KIND_COLORS[kind] ?? { accent: '#9CA3AF', bg: '#F3F4F6', label: kind.toUpperCase() };
  const displayTitle = entity?.title ?? fallbackTitle ?? `#${id}`;
  const isSm = size === 'sm';

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    // Default: navigate to dossier (dashboard handles focus via URL/state — emit custom event)
    window.dispatchEvent(new CustomEvent('kernal:entity-focus', { detail: { kind, id } }));
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); handleClick(); } }}
      title={`${colors.label}: ${displayTitle}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: isSm ? 3 : 4,
        borderLeft: `${isSm ? 2 : 3}px solid ${colors.accent}`,
        paddingLeft: isSm ? 4 : 6, paddingRight: isSm ? 5 : 7,
        paddingTop: isSm ? 1 : 2, paddingBottom: isSm ? 1 : 2,
        background: colors.bg, borderRadius: isSm ? 4 : 5,
        cursor: 'pointer', maxWidth: isSm ? 140 : 200,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.opacity = '0.75'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.opacity = '1'; }}
    >
      <span style={{
        fontSize: isSm ? 8 : 9, fontWeight: 700, color: colors.accent,
        letterSpacing: '0.05em', flexShrink: 0,
      }}>{colors.label}</span>
      <span style={{
        fontSize: isSm ? 10 : 11, color: '#1c1c1e', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{displayTitle}</span>
    </span>
  );
}
