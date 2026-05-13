type Config = {
  apiBase: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
};

const DEFAULT_CONFIG: Config = {
  apiBase: '',
  getAuthHeaders: async () => ({}),
};

let _config: Config = { ...DEFAULT_CONFIG };

export function configureKernalUI(config: Partial<Config>) {
  _config = { ...DEFAULT_CONFIG, ...config };
}

export function getApiBase(): string {
  return _config.apiBase;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  return _config.getAuthHeaders();
}

/** @deprecated Kept for backward compatibility — use getAuthHeaders() instead */
export function getApiKey(): string {
  return '';
}

export async function fetchKernal<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...headers, 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`Kernal API error: ${res.status}`);
  return res.json();
}

// useApi hook — compatible with both andes-web and kernal-full usage patterns
import { useState, useEffect } from 'react';

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getAuthHeaders()
      .then(headers => fetch(`${getApiBase()}${path}`, { credentials: 'include', headers, signal: controller.signal }))
      .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
      .then(d => { if (!controller.signal.aborted) setData(d); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path]);

  return { data, loading, error };
}

// ── Shared action PATCH helper ─────────────────────────────────────────────

export async function patchAction(id: number, body: Record<string, unknown>): Promise<ActionItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/actions/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Shared API types
export interface GraphData {
  nodes: Array<{ id: string; label: string; type: string; role?: string; org?: string; industry?: string; orgType?: string }>;
  edges: Array<{ source: string; target: string; relation: string }>;
}

export interface TimelineData {
  activities: Array<{
    id: number; type: string; title: string; date: string; summary: string;
    participants: Array<{ name: string; role: string | null }>;
    organizations: string[];
    deal_title?: string | null;
    goal_title?: string | null;
    deal?: { title?: string | null } | string | null;
    goal?: { title?: string | null } | string | null;
    deals?: Array<{ title?: string | null } | string>;
    goals?: Array<{ title?: string | null } | string>;
  }>;
  count: number;
}

export interface ActionItem {
  id: number;
  title: string;
  due_date: string | null;
  status: string;
  owner_name: string | null;
  priority?: string;
  list?: string;
  deal_id?: number | null;
  goal_id?: number | null;
  project_id?: number | null;
  entity_id?: number | null;
  deal_title?: string | null;
  goal_title?: string | null;
}

export interface ActionsData {
  actions: ActionItem[];
  grouped: {
    overdue: ActionItem[]; this_week: ActionItem[]; upcoming: ActionItem[]; no_date: ActionItem[];
  };
  count: number;
}

export interface StatsData {
  counts: Record<string, number>;
  topConnected: Array<{ name: string; role: string | null; org_name: string | null; connections: number }>;
  activityBreakdown: Array<{ type: string; count: number }>;
}
