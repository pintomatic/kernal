'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getApiBase, getAuthHeaders } from './config';

interface SearchResult {
  type: string;
  id: number;
  name: string;
  x?: number;
  y?: number;
}

interface DashboardSearchProps {
  onResultSelect: (result: SearchResult) => void;
}

export default function DashboardSearch({ onResultSelect }: DashboardSearchProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchResults(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setSearchResults(null); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const apiBase = getApiBase();
        const headers = await getAuthHeaders();
        const [wikiRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/api/wiki?q=${encodeURIComponent(q)}&limit=5`, { headers }).then(r => r.json()),
          fetch(`${apiBase}/api/dashboard/stats`, { headers }).then(r => r.json()),
        ]);
        const results: SearchResult[] = [];
        if (wikiRes.pages) {
          for (const p of wikiRes.pages.slice(0, 5)) {
            results.push({ name: p.title, type: p.type === 'person' ? 'person' : p.type === 'organization' ? 'organization' : 'pattern', id: p.id });
          }
        }
        if (statsRes.topConnected) {
          for (const p of statsRes.topConnected) {
            if (p.name.toLowerCase().includes(q.toLowerCase()) && !results.find(r => r.name === p.name)) {
              results.push({ name: p.name, type: 'person', id: 0 });
            }
          }
        }
        setSearchResults(results.slice(0, 8));
      } catch { setSearchResults([]); }
    }, 200);
  }, []);

  return (
    <div className={`kd-search ${searchOpen ? 'open' : ''}`} style={{ position: 'relative' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--kd-ink-3)" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={searchRef}
        placeholder="Search entities, sources, actions..."
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
        onFocus={() => setSearchOpen(true)}
        onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchResults(null); }, 200)}
        className="kd-search-input"
      />
      <kbd className="kd-kbd">⌘K</kbd>

      {searchResults && searchResults.length > 0 && (
        <div className="kd-search-dropdown">
          {searchResults.map((r, i) => (
            <button key={i} className="kd-search-result" onMouseDown={() => {
              onResultSelect(r);
              setSearchQuery(''); setSearchResults(null); setSearchOpen(false);
            }}>
              <span className="kd-search-result-type">{r.type}</span>
              <span className="kd-search-result-name">{r.name}</span>
            </button>
          ))}
        </div>
      )}
      {searchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
        <div className="kd-search-dropdown">
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--kd-ink-3)' }}>No results</div>
        </div>
      )}
    </div>
  );
}
