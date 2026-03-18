import { useState, useEffect } from 'react';

const API_KEY = localStorage.getItem('kernal-api-key') || '';

export function setApiKey(key: string) {
  localStorage.setItem('kernal-api-key', key);
}

export function getApiKey(): string {
  return localStorage.getItem('kernal-api-key') || '';
}

async function fetchApi<T>(path: string): Promise<T> {
  const key = getApiKey();
  const res = await fetch(path, {
    headers: { 'x-api-key': key },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    fetchApi<T>(path)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  return { data, loading, error };
}

export interface GraphData {
  nodes: Array<{ id: string; label: string; type: string; role?: string; org?: string; industry?: string; orgType?: string }>;
  edges: Array<{ source: string; target: string; relation: string }>;
}

export interface TimelineData {
  activities: Array<{
    id: number; type: string; title: string; date: string; summary: string;
    participants: Array<{ name: string; role: string | null }>;
    organizations: string[];
  }>;
  count: number;
}

export interface ActionsData {
  actions: Array<{ id: number; title: string; due_date: string | null; status: string; owner_name: string | null }>;
  grouped: {
    overdue: any[]; this_week: any[]; upcoming: any[]; no_date: any[];
  };
  count: number;
}

export interface StatsData {
  counts: Record<string, number>;
  topConnected: Array<{ name: string; role: string | null; org_name: string | null; connections: number }>;
  activityBreakdown: Array<{ type: string; count: number }>;
}
