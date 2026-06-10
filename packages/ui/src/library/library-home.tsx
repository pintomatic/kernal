'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { LibraryCluster, LibraryClusterApi, LibraryStats, LibraryRecentSource, ProcessingTier } from './types';
import LibrarySearchResults from './library-search-results';
import { useApi, getApiBase, getAuthHeaders } from '../config';

interface LibraryHomeProps {
  onSelectPage: (id: number) => void;
}

const TIER_COLORS: Record<ProcessingTier, { bg: string; text: string }> = {
  EXTRACTED: { bg: '#dcfce7', text: '#166534' },
  SUMMARIZED: { bg: '#fef3c7', text: '#92400e' },
  LINKED: { bg: '#f3f4f6', text: '#374151' },
};

const DOMAIN_ICONS: Record<string, string> = {
  people: '👤',
  market: '📊',
  strategy: '🧭',
  deals: '🤝',
  technical: '⚙️',
  context: '🏢',
};

const DOMAIN_LABELS: Record<string, string> = {
  people: 'People & Orgs',
  market: 'Market Intelligence',
  strategy: 'Strategy & Decisions',
  deals: 'Deals & GTM',
  technical: 'Technical',
  context: 'Company Context',
};

const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  people: 'Contacts, relationships, stakeholder profiles',
  market: 'Industry trends, competitor analysis, market data',
  strategy: 'Frameworks, strategic plans, key decisions made',
  deals: 'Sales playbooks, deal learnings, GTM patterns',
  technical: 'Architecture notes, system designs, tech patterns',
  context: 'Culture, processes, org knowledge',
};

function humanizeDate(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function LibraryHome({ onSelectPage }: LibraryHomeProps) {
  const [query, setQuery] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string | undefined>(undefined);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);

  const { data: statsData, loading: statsLoading } = useApi<LibraryStats>('/api/library/stats');
  const { data: clustersData, error: clustersError } = useApi<{ clusters: LibraryClusterApi[] }>('/api/library/clusters');
  const { data: recentSourcesData, error: recentError } = useApi<{ sources: LibraryRecentSource[] }>('/api/library/sources?limit=6');

  const stats = statsData;
  const clusters: Array<LibraryCluster & { domain?: string }> = (clustersData?.clusters ?? []).map(c => ({
    id: c.domain,
    label: DOMAIN_LABELS[c.domain] ?? c.domain,
    description: DOMAIN_DESCRIPTIONS[c.domain] ?? '',
    pageCount: c.pageCount,
    sourceCount: c.sourceCount,
    icon: DOMAIN_ICONS[c.domain] ?? '📁',
    domain: c.domain,
  }));
  const recentSources = recentSourcesData?.sources ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length > 0) setSearchSubmitted(true);
  };

  const handleClusterClick = (cluster: LibraryCluster & { domain?: string }) => {
    const domain = cluster.domain ?? cluster.id;
    if (activeCluster === domain) {
      setActiveCluster(null);
    } else {
      setActiveCluster(domain);
      // Domain filter — not a text search, use ?domain= parameter
      setDomainFilter(domain);
      setQuery(cluster.label); // display label in results header
      setSearchSubmitted(true);
    }
  };

  if (searchSubmitted && (query.trim() || domainFilter)) {
    return (
      <LibrarySearchResults
        query={query}
        domain={domainFilter}
        onSelectPage={onSelectPage}
        onBack={() => { setSearchSubmitted(false); setQuery(''); setActiveCluster(null); setDomainFilter(undefined); }}
      />
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        fontSize: 12,
        color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono, monospace)',
        flexWrap: 'wrap',
      }}>
        {statsLoading ? (
          <span style={{ opacity: 0.5 }}>Loading stats...</span>
        ) : stats ? (
          <>
            <span>
              {stats.pageCount} pages
              <span style={{ color: 'var(--line-2)', margin: '0 6px' }}>·</span>
              {stats.sourceCount} sources ({stats.extractedCount} extracted)
              <span style={{ color: 'var(--line-2)', margin: '0 6px' }}>·</span>
              last sync {humanizeDate(stats.lastSync)}
            </span>
            {stats.pendingCount > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                background: '#fef3c7',
                color: '#92400e',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}>
                {stats.pendingCount} pending
              </span>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.4 }}>No stats available</span>
        )}
        <button
          onClick={() => setShowAddSource(true)}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--teal)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-sans, sans-serif)',
            cursor: 'pointer',
            letterSpacing: '0.01em',
            transition: 'background .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--teal-2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--teal)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Source
        </button>
      </div>
      {showAddSource && (
        <AddSourceModal onClose={() => setShowAddSource(false)} />
      )}

      {/* Hero search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Query your knowledge base..."
            style={{
              width: '100%',
              padding: '14px 14px 14px 42px',
              fontSize: 15,
              fontFamily: 'var(--font-sans, sans-serif)',
              background: 'var(--panel)',
              border: '1.5px solid var(--line)',
              borderRadius: 12,
              color: 'var(--ink)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color .15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
          />
          {query.trim() && (
            <button
              type="submit"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'var(--teal)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          )}
        </div>
      </form>

      {/* Topic clusters grid */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{
          fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px',
        }}>
          Topic clusters
        </h3>
        {clustersError ? (
          <div style={{ fontSize: 12, color: '#991b1b', padding: '8px 0' }}>Could not load clusters — {clustersError}</div>
        ) : clusters.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '16px 0' }}>
            No clusters yet — ingest sources to build your knowledge graph.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                onClick={() => handleClusterClick(cluster)}
                style={{
                  background: activeCluster === (cluster.domain ?? cluster.id) ? 'var(--teal-soft)' : 'var(--panel)',
                  border: `1.5px solid ${activeCluster === (cluster.domain ?? cluster.id) ? 'var(--teal)' : 'var(--line)'}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
                onMouseEnter={e => {
                  if (activeCluster !== (cluster.domain ?? cluster.id)) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--teal)';
                  }
                }}
                onMouseLeave={e => {
                  if (activeCluster !== (cluster.domain ?? cluster.id)) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)';
                  }
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{cluster.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>
                  {cluster.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>
                  {cluster.description}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)' }}>
                  <span>{cluster.pageCount} pages</span>
                  <span style={{ color: 'var(--line-2)' }}>·</span>
                  <span>{cluster.sourceCount} sources</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently processed strip */}
      <div>
        <h3 style={{
          fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px',
        }}>
          Recently processed
        </h3>
        {recentError ? (
          <div style={{ fontSize: 12, color: '#991b1b' }}>Could not load recent sources — {recentError}</div>
        ) : recentSources.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            No sources registered yet.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {recentSources.map(src => {
              const tier = (src.library_tier ?? 'LINKED') as ProcessingTier;
              const colors = TIER_COLORS[tier] ?? TIER_COLORS.LINKED;
              return (
                <div
                  key={src.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--ink)', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {src.title}
                  </span>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    background: colors.bg,
                    color: colors.text,
                    letterSpacing: '0.03em',
                  }}>
                    {tier}
                  </span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                    {humanizeDate(src.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Source Modal ──────────────────────────────────────────────────────────

interface AddSourceModalProps {
  onClose: () => void;
}

const SOURCE_TYPES = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'article', label: 'Article' },
  { value: 'note', label: 'Note' },
  { value: 'document', label: 'Document' },
];

function AddSourceModal({ onClose }: AddSourceModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('transcript');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleSubmit = useCallback(async () => {
    if (submitting || success) return; // double-submit guard
    if (!title.trim()) { setError('Title is required.'); return; }
    if (content.trim().length < 10) { setError('Content must be at least 10 characters.'); return; }
    if (content.length > 1_000_000) { setError('Content exceeds 1MB. Split into smaller sources.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const BASE = getApiBase();
      const headers = await getAuthHeaders();
      const res = await fetch(`${BASE}/api/library/sources`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), content: content.trim(), type, library_mode: 'wiki' }),
      });
      if (res.ok) {
        setSuccess(true);
        timerRef.current = setTimeout(() => { onClose(); window.location.reload(); }, 800);
        return; // don't fall through to setSubmitting(false) — stay disabled during reload
      } else {
        const text = await res.text().catch(() => '');
        let msg = `Server error: ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch {}
        setError(msg);
      }
    } catch {
      setError('Network error — check connection.');
    }
    setSubmitting(false);
  }, [title, content, type, onClose, submitting, success]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }}
      />
      {/* Modal */}
      <div style={{
        position: 'relative',
        background: 'var(--panel, #fff)',
        border: '1px solid var(--line, #e7e5e4)',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        margin: '0 16px',
      }}>
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0,
          background: 'var(--panel, #fff)',
          borderBottom: '1px solid var(--line, #e7e5e4)',
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: '14px 14px 0 0',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #1c1917)', fontFamily: 'var(--font-sans, sans-serif)' }}>
            Add Source to Library
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3, #78716c)', fontSize: 20, lineHeight: 1, padding: '0 2px' }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {success && (
            <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 13, color: '#166534', fontWeight: 600 }}>
              Source added — refreshing...
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3, #78716c)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)' }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Source title"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 14,
                fontFamily: 'var(--font-sans, sans-serif)',
                background: 'var(--bg, #fafaf9)',
                border: '1.5px solid var(--line, #e7e5e4)',
                borderRadius: 8,
                color: 'var(--ink, #1c1917)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--line, #e7e5e4)'; }}
            />
          </div>

          {/* Type */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3, #78716c)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)' }}>
              Type
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 14,
                fontFamily: 'var(--font-sans, sans-serif)',
                background: 'var(--bg, #fafaf9)',
                border: '1.5px solid var(--line, #e7e5e4)',
                borderRadius: 8,
                color: 'var(--ink, #1c1917)',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--line, #e7e5e4)'; }}
            >
              {SOURCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3, #78716c)', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)' }}>
              Content * <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(paste full text)</span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste the full text content here..."
              rows={10}
              style={{
                width: '100%',
                minHeight: 200,
                padding: '10px 12px',
                fontSize: 13,
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                background: 'var(--bg, #fafaf9)',
                border: '1.5px solid var(--line, #e7e5e4)',
                borderRadius: 8,
                color: 'var(--ink, #1c1917)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--line, #e7e5e4)'; }}
            />
            <div style={{ fontSize: 11, color: 'var(--ink-3, #78716c)', marginTop: 4, fontFamily: 'var(--font-mono, monospace)' }}>
              {content.length} chars
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || success || !title.trim() || content.trim().length < 10}
            style={{
              width: '100%',
              padding: '11px',
              background: submitting || success ? 'var(--teal-2, #0d9488)' : 'var(--teal, #0f766e)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-sans, sans-serif)',
              cursor: submitting || success ? 'not-allowed' : 'pointer',
              opacity: (!title.trim() || content.trim().length < 10) && !submitting ? 0.5 : 1,
              transition: 'background .15s, opacity .15s',
            }}
          >
            {success ? 'Added!' : submitting ? 'Adding...' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}
