'use client';

import { useRef, useEffect, useState } from 'react';
import type { ProcessingTier, LibraryPageFull, LibraryPageSection, LibraryPageSource } from './types';
import { getApiBase, getAuthHeaders } from '../config';

interface LibraryVaultProps {
  pageId: number;
  onBack: () => void;
}

const TIER_BADGE: Record<ProcessingTier, { bg: string; text: string }> = {
  EXTRACTED: { bg: '#dcfce7', text: '#166534' },
  SUMMARIZED: { bg: '#fef3c7', text: '#92400e' },
  LINKED: { bg: '#f3f4f6', text: '#374151' },
};

function TierBadge({ tier }: { tier: ProcessingTier }) {
  const c = TIER_BADGE[tier] ?? TIER_BADGE.LINKED;
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.text, letterSpacing: '0.03em',
    }}>
      {tier}
    </span>
  );
}

function humanizeDate(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

function EvidenceBlock({
  source,
  section,
  allSources,
}: {
  source: LibraryPageSource;
  section: LibraryPageSection;
  allSources: LibraryPageSource[];
}) {
  // Get passages for this source in this section
  const passagesForSection = section.passages
    .filter(p => p.source_id === source.id)
    .slice(0, 2);

  return (
    <div style={{
      marginBottom: 14,
      border: source.tier === 'LINKED' ? '1.5px dashed #d1d5db' : '1px solid #e5e7eb',
      borderRadius: 8,
      background: source.tier === 'LINKED' ? '#fafafa' : '#fff',
      overflow: 'hidden',
    }}>
      {/* Source header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        borderBottom: source.tier !== 'LINKED' ? '1px solid #f3f4f6' : 'none',
        background: '#fdf8ee',
      }}>
        <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.title}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{humanizeDate(source.date)}</span>
        <TierBadge tier={source.tier} />
      </div>

      {/* Evidence body */}
      {source.tier === 'LINKED' && (
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            Not yet processed — source linked but content not indexed.
          </div>
          <button
            disabled
            title="Queue processing requires the backend pipeline"
            style={{
              padding: '4px 10px', fontSize: 11, color: '#9ca3af',
              border: '1px solid #e5e7eb', borderRadius: 6,
              background: 'none', cursor: 'not-allowed',
            }}
          >
            Add to queue
          </button>
        </div>
      )}

      {source.tier === 'SUMMARIZED' && (
        <div style={{
          padding: '10px 12px',
          background: '#fef3c7',
          borderLeft: '3px solid #f59e0b',
          margin: '8px',
          borderRadius: '0 6px 6px 0',
          fontSize: 12,
          color: '#78350f',
          lineHeight: 1.5,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', marginBottom: 4, letterSpacing: '0.04em' }}>
            INTERPRETED
          </div>
          {source.excerpt ?? 'AI summary — original text not indexed at this resolution.'}
        </div>
      )}

      {source.tier === 'EXTRACTED' && passagesForSection.length > 0 && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {passagesForSection.map(p => {
            const isVerbatim = p.confidence === 'VERBATIM';
            const isAssembled = p.confidence === 'ASSEMBLED';
            return (
              <div
                key={p.id}
                style={{
                  padding: '8px 10px',
                  borderLeft: `3px solid ${isVerbatim ? '#166534' : isAssembled ? '#1d4ed8' : '#f59e0b'}`,
                  background: isVerbatim ? '#f8f9fa' : isAssembled ? '#f3f4f6' : '#fef3c7',
                  borderRadius: '0 5px 5px 0',
                  fontFamily: isVerbatim ? 'var(--font-mono, monospace)' : 'inherit',
                  fontSize: isVerbatim ? 11 : 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#1c1917', lineHeight: 1.5 }}>{p.text}</span>
                  {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
                    * Inferred-confidence badge: violet ink on violet-tinted bg →
                    * warn-ink on warn-soft (semantic match: "inferred" reads as
                    * caution, not "intelligence"). */}
                  <span style={{
                    flexShrink: 0, padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                    background: isVerbatim ? '#dcfce7' : isAssembled ? '#dbeafe' : '#fef3c7',
                    color: isVerbatim ? '#166534' : isAssembled ? '#1d4ed8' : '#b45309',
                    letterSpacing: '0.03em',
                  }}>
                    {p.confidence}
                  </span>
                </div>
                {isAssembled && p.assembled_from && p.assembled_from.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 10, color: '#6b7280' }}>
                    Drawn from{' '}
                    {p.assembled_from.map(sid => {
                      const s = allSources.find(x => x.id === sid);
                      return s?.title ?? `Source ${sid}`;
                    }).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {source.tier === 'EXTRACTED' && passagesForSection.length === 0 && source.excerpt && (
        <div style={{
          padding: '8px 12px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11, color: '#374151', lineHeight: 1.5,
          borderLeft: '3px solid #166534', margin: '8px',
          background: '#f8f9fa', borderRadius: '0 5px 5px 0',
        }}>
          {source.excerpt}
        </div>
      )}

      {source.tier === 'EXTRACTED' && passagesForSection.length === 0 && !source.excerpt && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
          No evidence indexed yet for this section.
        </div>
      )}
    </div>
  );
}

export default function LibraryVault({ pageId, onBack }: LibraryVaultProps) {
  const [page, setPage] = useState<LibraryPageFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const scrollToSection = (sectionSlug: string) => {
    const el = sectionRefs.current[sectionSlug];
    if (el && rightPanelRef.current) {
      const panel = rightPanelRef.current;
      const panelRect = panel.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      panel.scrollTop += elRect.top - panelRect.top - 16;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', fontSize: 13, color: 'var(--ink-3)' }}>
        Loading source vault...
      </div>
    );
  }

  if (error || !page) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', padding: '0 0 12px' }}>
          Back
        </button>
        <div style={{ color: '#991b1b', fontSize: 13 }}>
          {error ? `Failed to load: ${error}` : 'Page not found.'}
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink-2)' }}>Source Vault</div>
        Full audit view available on larger screens.
        <br />
        <button onClick={onBack} style={{ marginTop: 16, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          Back
        </button>
      </div>
    );
  }

  const extracted = page.sources.filter(s => s.tier === 'EXTRACTED').length;
  const summarized = page.sources.filter(s => s.tier === 'SUMMARIZED').length;
  const linked = page.sources.filter(s => s.tier === 'LINKED').length;
  const sections = page.sections ?? [];
  const hasSections = sections.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 400 }}>
      {/* Back button */}
      <div style={{ marginBottom: 12, flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--ink-3)', padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {page.title}
        </button>
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-3)' }}>/ Sources</span>
      </div>

      {/* Split panel */}
      <div style={{ display: 'flex', flex: 1, gap: 0, minHeight: 0, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Left: wiki content dimmed */}
        <div style={{
          width: '45%', flexShrink: 0,
          overflowY: 'auto', padding: '20px 20px',
          opacity: 0.85,
          borderRight: '1px solid var(--line)',
          background: 'var(--panel)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: '0 0 16px' }}>{page.title}</h2>

          {!hasSections && (
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              {page.synthesis.slice(0, 800)}
              {page.synthesis.length > 800 && '...'}
            </div>
          )}

          {hasSections && sections.map(section => (
            <div key={section.section_slug} style={{ marginBottom: 20 }}>
              <button
                onClick={() => scrollToSection(section.section_slug)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 0', textAlign: 'left',
                  borderBottom: '1px solid var(--line)', marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  {section.title}
                </span>
                {section.source_count === 0 ? (
                  <span style={{ fontSize: 10, color: '#991b1b', fontWeight: 600 }}>no sources</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {section.source_count} src
                  </span>
                )}
              </button>
              {section.passages.map(p => (
                <div
                  key={p.id}
                  style={{
                    fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5,
                    padding: '4px 8px', marginBottom: 4,
                    borderLeft: '2px solid var(--line)',
                    fontFamily: p.confidence === 'VERBATIM' ? 'var(--font-mono, monospace)' : 'inherit',
                  }}
                >
                  {p.text}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right: evidence panel */}
        <div
          ref={rightPanelRef}
          style={{
            flex: 1, overflowY: 'auto',
            background: '#fdf8ee',
            padding: '20px 20px',
            borderLeft: '3px solid #f59e0b',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
            Evidence by section
          </div>

          {!hasSections && (
            <div style={{
              border: '1px dashed #fde68a', borderRadius: 6,
              padding: '14px 16px', fontSize: 12, color: '#92400e',
            }}>
              No evidence indexed yet. Run wiki ingest to populate sections and passages.
            </div>
          )}

          {hasSections && sections.map(section => {
            // Sources that contribute to this section
            const sectionSourceIds = new Set(
              section.passages.map(p => p.source_id)
            );
            const sectionSources = page.sources.filter(s => sectionSourceIds.has(s.id) || s.sections.includes(section.section_slug));

            return (
              <div
                key={section.section_slug}
                ref={el => { sectionRefs.current[section.section_slug] = el; }}
                style={{ marginBottom: 24 }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 700, color: '#78350f',
                  borderBottom: '1px solid #fde68a',
                  paddingBottom: 6, marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{section.title}</span>
                  {section.source_count === 0 && (
                    <span style={{ fontSize: 10, color: '#991b1b' }}>no sources</span>
                  )}
                </div>

                {sectionSources.length === 0 && (
                  <div style={{
                    border: '1px dashed #fde68a', borderRadius: 6,
                    padding: '10px 12px', fontSize: 12, color: '#92400e',
                  }}>
                    No sources mapped to this section yet.
                  </div>
                )}

                {sectionSources.map(src => (
                  <EvidenceBlock key={src.id} source={src} section={section} allSources={page.sources} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        flexShrink: 0, marginTop: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        fontSize: 11,
        color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        <span>
          {page.source_count} sources
          <span style={{ margin: '0 5px', color: 'var(--line-2)' }}>·</span>
          {extracted} extracted
          <span style={{ margin: '0 5px', color: 'var(--line-2)' }}>·</span>
          {summarized} summarized
          <span style={{ margin: '0 5px', color: 'var(--line-2)' }}>·</span>
          {linked} linked
          <span style={{ margin: '0 5px', color: 'var(--line-2)' }}>·</span>
          last synthesized {humanizeDate(page.last_synthesized_at)}
        </span>
        <button
          disabled
          title="Re-synthesis requires the backend pipeline"
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600,
            border: '1px solid var(--line)', borderRadius: 6,
            background: 'none', color: 'var(--ink-3)',
            cursor: 'not-allowed', opacity: 0.6,
            fontFamily: 'inherit',
          }}
        >
          Re-synthesize
        </button>
      </div>
    </div>
  );
}
