'use client';

import { useState, useEffect } from 'react';
import type { LibrarySearchResult, TrustSignal } from './types';
import { getApiBase, getAuthHeaders } from '../config';

interface LibrarySearchResultsProps {
  query: string;
  domain?: string;  // when set, use domain filter instead of FTS text search
  onSelectPage: (id: number) => void;
  onBack: () => void;
}

const TRUST_BADGE: Record<TrustSignal, { bg: string; text: string; label: string }> = {
  FRESH: { bg: '#dcfce7', text: '#166534', label: 'FRESH' },
  STALE: { bg: '#fef3c7', text: '#92400e', label: 'STALE' },
  SPARSE: { bg: '#fee2e2', text: '#991b1b', label: 'SPARSE' },
};

export default function LibrarySearchResults({ query, domain, onSelectPage, onBack }: LibrarySearchResultsProps) {
  const [results, setResults] = useState<LibrarySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() && !domain) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const url = domain
          ? `${getApiBase()}/api/library/wiki?domain=${encodeURIComponent(domain)}&limit=20`
          : `${getApiBase()}/api/library/wiki?q=${encodeURIComponent(query.trim())}&limit=20`;
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (!controller.signal.aborted) {
          setResults(data.results ?? []);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [query]);

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--ink-3)', padding: '4px 0',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Library
        </button>
        <span style={{ color: 'var(--line-2)' }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          &ldquo;{query}&rdquo;
        </span>
      </div>

      {loading && (
        <div style={{ padding: '24px 0', fontSize: 13, color: 'var(--ink-3)' }}>
          Searching...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px 0', fontSize: 13, color: '#991b1b' }}>
          Search failed: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--ink-3)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>&ldquo;{query}&rdquo;</span>
          </div>

          {results.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No pages found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map(result => {
              const ts = (result.trust_signal ?? 'SPARSE') as TrustSignal;
              const badge = TRUST_BADGE[ts] ?? TRUST_BADGE.SPARSE;
              return (
                <div
                  key={result.id}
                  onClick={() => onSelectPage(result.id)}
                  style={{
                    background: 'var(--panel)',
                    border: '1.5px solid var(--line)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    transition: 'border-color .12s, box-shadow .12s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--teal)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px var(--teal-soft, rgba(0,128,128,.08))';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 15, fontWeight: 700, color: 'var(--teal-ink)',
                        textAlign: 'left', lineHeight: 1.3,
                      }}
                    >
                      {result.title}
                    </span>
                    <span style={{
                      flexShrink: 0,
                      padding: '2px 8px',
                      borderRadius: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.text,
                      letterSpacing: '0.04em',
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Source count */}
                  <div style={{
                    fontSize: 11, color: 'var(--ink-3)',
                    fontFamily: 'var(--font-mono, monospace)',
                    marginBottom: 8,
                  }}>
                    {result.source_count} sources ({result.extracted_count} extracted)
                  </div>

                  {/* Excerpt */}
                  {result.excerpt && (
                    <p style={{
                      fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5,
                      margin: '0 0 10px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {result.excerpt}
                    </p>
                  )}

                  {/* Domain chip */}
                  {result.domain && (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: 'var(--chip)',
                      borderRadius: 6,
                      fontSize: 11,
                      color: 'var(--ink-3)',
                      fontWeight: 500,
                    }}>
                      {result.domain}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
