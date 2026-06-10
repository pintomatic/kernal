'use client';

import { useState, useEffect } from 'react';
import type { WikiSource, TrustSignal, ProcessingTier, LibraryPageFull } from './types';
import { getApiBase, getAuthHeaders } from '../config';

interface LibraryWikiPageProps {
  pageId: number;
  onViewVault: () => void;
  onBack: () => void;
  onSelectPage: (id: number) => void;
}

const TRUST_BADGE: Record<TrustSignal, { bg: string; text: string; label: string }> = {
  FRESH: { bg: '#dcfce7', text: '#166534', label: 'FRESH' },
  STALE: { bg: '#fef3c7', text: '#92400e', label: 'STALE' },
  SPARSE: { bg: '#fee2e2', text: '#991b1b', label: 'SPARSE' },
};

const TIER_BADGE: Record<ProcessingTier, { bg: string; text: string }> = {
  EXTRACTED: { bg: '#dcfce7', text: '#166534' },
  SUMMARIZED: { bg: '#fef3c7', text: '#92400e' },
  LINKED: { bg: '#f3f4f6', text: '#374151' },
};

/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
 * `person` was the violet-tinted background; collapsed to teal-soft to
 * align with the canonical brand. */
const ENTITY_TYPE_COLOR: Record<string, string> = {
  deal: '#dbeafe',
  person: '#ccfbf1',
  org: '#fef3c7',
};

function TierBadge({ tier }: { tier: ProcessingTier }) {
  const colors = TIER_BADGE[tier] ?? TIER_BADGE.LINKED;
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700,
      background: colors.bg, color: colors.text, letterSpacing: '0.03em',
    }}>
      {tier}
    </span>
  );
}

function humanizeDate(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

export default function LibraryWikiPage({ pageId, onViewVault, onBack, onSelectPage }: LibraryWikiPageProps) {
  const [page, setPage] = useState<LibraryPageFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredFootnote, setHoveredFootnote] = useState<string | null>(null);
  const [openFootnote, setOpenFootnote] = useState<WikiSource | null>(null);

  useEffect(() => {
    if (!pageId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${getApiBase()}/api/library/wiki/${pageId}`, {
          headers, signal: controller.signal,
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (!controller.signal.aborted) setPage(data);
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [pageId]);

  // Close modal on Escape
  useEffect(() => {
    if (!openFootnote) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenFootnote(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openFootnote]);

  if (loading) {
    return (
      <div style={{ padding: '40px 0', color: 'var(--ink-3)', fontSize: 13 }}>
        Loading page...
      </div>
    );
  }

  if (error || !page) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', padding: '0 0 16px' }}>
          Library
        </button>
        <div style={{ color: '#991b1b', fontSize: 13 }}>
          {error ? `Failed to load page: ${error}` : 'Page not found.'}
        </div>
      </div>
    );
  }

  const trust_signal = (page.trust_signal ?? 'SPARSE') as TrustSignal;
  const trustBadge = TRUST_BADGE[trust_signal] ?? TRUST_BADGE.SPARSE;
  const isStaleOrSparse = trust_signal === 'STALE' || trust_signal === 'SPARSE';

  // Map sources to WikiSource format for footnote modal compat
  const wikiSources: WikiSource[] = page.sources.map(s => ({
    id: s.id,
    title: s.title,
    type: s.type,
    date: s.date,
    tier: s.tier,
    excerpt: s.excerpt,
    sections: s.sections,
  }));

  const getSource = (id: number): WikiSource | undefined => wikiSources.find(s => s.id === id);
  const citableSources = wikiSources.filter(s => s.excerpt || s.tier === 'EXTRACTED');

  const renderSynthesis = (text: string) => {
    const paragraphs = text.trim().split(/\n\n+/);
    let footnoteIndex = 1;
    return paragraphs.map((para, pi) => {
      const src = citableSources.length > 0 ? citableSources[pi % citableSources.length] : null;
      const fi = footnoteIndex++;
      const hoverKey = `${pi}-${src?.id ?? 'none'}`;
      return (
        <p key={pi} style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.7, color: 'var(--ink)', position: 'relative' }}>
          {para}
          {src && (
            <span style={{ position: 'relative', display: 'inline-block', marginLeft: 2 }}>
              <button
                onMouseEnter={() => setHoveredFootnote(hoverKey)}
                onMouseLeave={() => setHoveredFootnote(null)}
                onClick={() => setOpenFootnote(src)}
                aria-label={`View source: ${src.title}`}
                style={{
                  color: 'var(--teal-ink)', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', verticalAlign: 'super',
                  padding: '0 2px', background: 'none', border: 'none',
                }}
              >
                [{fi}]
              </button>
              {hoveredFootnote === hoverKey && (
                <span style={{
                  position: 'absolute', bottom: '100%', left: 0, zIndex: 20,
                  background: '#1c1917', color: '#fff', borderRadius: 6,
                  padding: '6px 10px', fontSize: 11,
                  boxShadow: '0 4px 16px rgba(0,0,0,.2)', marginBottom: 4,
                  maxWidth: 240, whiteSpace: 'normal' as const,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{src.title}</div>
                  <div style={{ opacity: 0.8 }}>
                    <TierBadge tier={src.tier} />
                    {src.excerpt && <span style={{ marginLeft: 6 }}>{src.excerpt.slice(0, 60)}...</span>}
                  </div>
                </span>
              )}
            </span>
          )}
        </p>
      );
    });
  };

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 720 }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--ink-3)', padding: '0 0 16px', marginBottom: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Library
      </button>

      {/* Title */}
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', margin: '0 0 14px', lineHeight: 1.2 }}>
        {page.title}
      </h1>

      {/* Trust signal row */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid var(--line)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)' }}>
          Synthesized from {page.source_count} sources ({page.extracted_count} extracted)
          <span style={{ margin: '0 6px' }}>·</span>
          last synced {humanizeDate(page.last_synthesized_at)}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          background: trustBadge.bg, color: trustBadge.text, letterSpacing: '0.04em',
        }}>
          {trustBadge.label}
        </span>
        <button
          onClick={onViewVault}
          style={{
            background: 'none', border: '1px solid var(--line)', borderRadius: 7,
            padding: '4px 10px', fontSize: 12, color: 'var(--teal-ink)',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          View Sources
        </button>
        {isStaleOrSparse && (
          <button
            disabled
            title="Re-synthesis requires the backend pipeline"
            style={{
              background: 'none', border: '1px solid var(--line)', borderRadius: 7,
              padding: '4px 10px', fontSize: 12, color: 'var(--ink-3)',
              cursor: 'not-allowed', opacity: 0.6,
            }}
          >
            Re-synthesize
          </button>
        )}
      </div>

      {/* Synthesis content */}
      <div style={{ marginBottom: 28 }}>
        {renderSynthesis(page.synthesis)}
      </div>

      {/* Sections — graceful degradation: only shown if sections exist */}
      {page.sections && page.sections.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          {page.sections.map(section => (
            <div key={section.section_slug} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  {section.title}
                </h2>
                {section.source_count === 0 ? (
                  <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }}>
                    no sources
                  </span>
                ) : (
                  <span style={{
                    padding: '2px 8px', background: 'var(--chip)', borderRadius: 6,
                    fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    {section.source_count} source{section.source_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {section.passages.length === 0 ? (
                <div style={{
                  border: '1px dashed var(--line)', borderRadius: 8, padding: '12px 14px',
                  fontSize: 12, color: 'var(--ink-3)',
                }}>
                  No extracted content for this section yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {section.passages.map(p => {
                    const isVerbatim = p.confidence === 'VERBATIM';
                    const isAssembled = p.confidence === 'ASSEMBLED';
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '10px 14px',
                          borderLeft: `3px solid ${isVerbatim ? '#166534' : isAssembled ? '#1d4ed8' : '#f59e0b'}`,
                          background: isVerbatim ? '#f8f9fa' : isAssembled ? '#f3f4f6' : '#fef3c7',
                          borderRadius: '0 6px 6px 0',
                          fontFamily: isVerbatim ? 'var(--font-mono, monospace)' : 'inherit',
                          fontSize: isVerbatim ? 12 : 13,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: 'var(--ink)', lineHeight: 1.5 }}>{p.text}</span>
                          {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
                            * Inferred-confidence badge: violet → warn-ink (caution semantic). */}
                          <span style={{
                            flexShrink: 0,
                            padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 700,
                            background: isVerbatim ? '#dcfce7' : isAssembled ? '#dbeafe' : '#fef3c7',
                            color: isVerbatim ? '#166534' : isAssembled ? '#1d4ed8' : '#b45309',
                            letterSpacing: '0.03em',
                          }}>
                            {p.confidence}
                          </span>
                        </div>
                        {isAssembled && p.assembled_from && p.assembled_from.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                            Drawn from{' '}
                            {p.assembled_from.map((sid, i) => {
                              const s = getSource(sid);
                              return (
                                <span key={sid}>
                                  {i > 0 && ', '}
                                  <span style={{ color: 'var(--teal-ink)', fontWeight: 500 }}>
                                    {s ? s.title : `Source ${sid}`}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Related entities */}
      {page.related_entities && page.related_entities.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{
            fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px',
          }}>
            Related
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {page.related_entities.map(e => (
              <span
                key={`${e.entity_type}-${e.entity_id}`}
                style={{
                  padding: '4px 10px',
                  background: ENTITY_TYPE_COLOR[e.entity_type] ?? 'var(--chip)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  fontWeight: 500,
                }}
              >
                {e.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related pages */}
      {page.related_pages && page.related_pages.length > 0 && (
        <div>
          <h3 style={{
            fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px',
          }}>
            Related pages
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {page.related_pages.map(rp => (
              <button
                key={rp.id}
                onClick={() => onSelectPage(rp.id)}
                style={{
                  fontSize: 13, color: 'var(--teal-ink)', fontWeight: 500, cursor: 'pointer',
                  background: 'none', border: 'none', padding: 0, textAlign: 'left',
                }}
              >
                {rp.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footnote modal */}
      {openFootnote && (
        <div
          onClick={() => setOpenFootnote(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--panel)', border: '1px solid var(--line)',
              borderRadius: 12, padding: '24px', width: '90%', maxWidth: 440,
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  {openFootnote.title}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
                  <span>{openFootnote.type}</span>
                  <span>·</span>
                  <span>{openFootnote.date}</span>
                  <TierBadge tier={openFootnote.tier} />
                </div>
              </div>
              <button
                onClick={() => setOpenFootnote(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, color: 'var(--ink-3)', lineHeight: 1, padding: '0 4px',
                }}
              >
                x
              </button>
            </div>

            {openFootnote.excerpt && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderLeft: `3px solid ${openFootnote.tier === 'EXTRACTED' ? '#166534' : openFootnote.tier === 'SUMMARIZED' ? '#f59e0b' : '#d1d5db'}`,
                background: openFootnote.tier === 'EXTRACTED' ? '#f8f9fa' : openFootnote.tier === 'SUMMARIZED' ? '#fef3c7' : '#fafafa',
                borderRadius: '0 6px 6px 0',
                fontFamily: openFootnote.tier === 'EXTRACTED' ? 'var(--font-mono, monospace)' : 'inherit',
                fontSize: 13, color: 'var(--ink)', lineHeight: 1.5,
              }}>
                {openFootnote.excerpt}
              </div>
            )}

            {openFootnote.tier === 'LINKED' && (
              <div style={{
                marginTop: 12,
                border: '1.5px dashed #d1d5db', borderRadius: 8,
                padding: '12px 14px', background: '#fafafa',
                fontSize: 12, color: '#6b7280',
              }}>
                Not yet processed — add to queue to extract full content.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
