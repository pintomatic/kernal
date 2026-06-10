'use client';

import { useState, useEffect } from 'react';
import { getApiBase, getAuthHeaders } from '../config';
import PatternCard from './pattern-card';
import type { Pattern, IntelStats } from './types';
import { INTEL_COLORS } from './types';

interface ActiveEntity {
  id: number;
  name: string;
  reason: string;
  reasonDetail: string;
}

interface ReviewBanner {
  count: number;
  dismissed: boolean;
}

interface IntelligenceHomeProps {
  onEntitySelect?: (entityId: number) => void;
}

const DOMAINS = ['Work', 'People', 'GTM', 'Trading', 'Personal'] as const;

export default function IntelligenceHome({ onEntitySelect }: IntelligenceHomeProps) {
  const [stats, setStats] = useState<IntelStats | null>(null);
  const [recentPatterns, setRecentPatterns] = useState<Pattern[]>([]);
  const [activeEntities, setActiveEntities] = useState<ActiveEntity[]>([]);
  const [showAllEntities, setShowAllEntities] = useState(false);
  const [banner, setBanner] = useState<ReviewBanner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const base = getApiBase();

        const [statsRes, patternsRes, newSinceRes, dealsRes] = await Promise.all([
          fetch(`${base}/api/intelligence/stats`, { headers }),
          fetch(`${base}/api/intelligence/patterns?limit=6`, { headers }),
          fetch(`${base}/api/intelligence/new-since-visit`, { headers }),
          fetch(`${base}/api/dashboard/deals`, { headers }),
        ]);

        if (cancelled) return;

        if (statsRes.ok) setStats(await statsRes.json());

        if (patternsRes.ok) {
          const d = await patternsRes.json();
          setRecentPatterns((d.patterns ?? []).slice(0, 6));
        }

        if (newSinceRes.ok) {
          const d = await newSinceRes.json();
          if ((d.count ?? 0) > 0) {
            setBanner({ count: d.count, dismissed: false });
          }
        }

        // Build active entities from deals at Qualify/Commit stage
        if (dealsRes.ok) {
          const dealData = await dealsRes.json();
          const qualifyDeals = (dealData.deals ?? [])
            .filter((d: any) => ['qualify', 'align', 'commit'].includes((d.stage || '').toLowerCase()))
            .slice(0, 6);

          const entities: ActiveEntity[] = qualifyDeals.map((d: any) => ({
            id: d.id,
            name: d.title || d.org_name || 'Deal',
            reason: 'deal',
            reasonDetail: d.stage ? d.stage.charAt(0).toUpperCase() + d.stage.slice(1) + ' stage' : 'Active deal',
          }));

          setActiveEntities(entities);
        }
      } catch (err) {
        console.error('IntelligenceHome load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const domainBreakdown = stats?.domainBreakdown ?? [];
  const visibleEntities = showAllEntities ? activeEntities : activeEntities.slice(0, 6);
  const extraCount = activeEntities.length - 6;

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Review banner */}
      {banner && !banner.dismissed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f0fdfa',
          border: '1px solid #99f6e4',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 20,
          gap: 8,
        }}>
          <span style={{ fontSize: 13, color: '#115e59' }}>
            Blekkie wrote {banner.count} memor{banner.count !== 1 ? 'ies' : 'y'} in the last session — review now →
          </span>
          <button
            onClick={() => setBanner(b => b ? { ...b, dismissed: true } : null)}
            style={{
              background: 'none', border: 'none', color: '#6b7280',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Active now strip */}
      {activeEntities.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
            Active now
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {visibleEntities.map(e => (
              <button
                key={e.id}
                onClick={() => onEntitySelect?.(e.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  background: '#eff6ff',
                  border: `1px solid ${INTEL_COLORS.accent}30`,
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#1e3a8a',
                  fontWeight: 500,
                }}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20, height: 20,
                  borderRadius: '50%',
                  background: INTEL_COLORS.accent,
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {(e.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span>{e.name}</span>
                <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 11 }}>{e.reasonDetail}</span>
              </button>
            ))}
            {!showAllEntities && extraCount > 0 && (
              <button
                onClick={() => setShowAllEntities(true)}
                style={{
                  padding: '5px 10px',
                  background: '#f5f4f0',
                  border: '1px solid #e7e5e4',
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#78716c',
                }}
              >
                +{extraCount} more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recent patterns strip */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
          Recent patterns
        </h3>
        {loading ? (
          <div style={{ fontSize: 12, color: '#a8a29e' }}>Loading...</div>
        ) : recentPatterns.length === 0 ? (
          <div style={{
            fontSize: 12, color: '#a8a29e', padding: '12px 14px',
            border: '1px dashed #e7e5e4', borderRadius: 8,
          }}>
            No patterns yet — they emerge after 2+ sessions
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {recentPatterns.map(p => (
              <PatternCard key={p.id} pattern={p} />
            ))}
          </div>
        )}
      </div>

      {/* Memory by domain grid */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
          Memory by domain
        </h3>
        {loading ? (
          <div style={{ fontSize: 12, color: '#a8a29e' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {DOMAINS.map(domain => {
              const row = domainBreakdown.find(r => r.domain === domain);
              const count = row?.count ?? 0;
              const archived = row?.archived_count ?? 0;
              return (
                <div key={domain} style={{
                  background: '#fff',
                  border: '1px solid #e7e5e4',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1c1917', marginBottom: 2 }}>{domain}</div>
                  {count === 0 ? (
                    <div style={{ fontSize: 11, color: '#a8a29e' }}>0 memories</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: '#57534e' }}>{count} memor{count !== 1 ? 'ies' : 'y'}</div>
                      {archived > 0 && (
                        <div style={{ fontSize: 10, color: INTEL_COLORS.expiring, marginTop: 2 }}>
                          {archived} archived
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loading && (stats?.memoryCount ?? 0) === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#a8a29e' }}>
            Intelligence grows as you work — Blekkie writes observations after each save game.
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div style={{
        paddingTop: 16,
        borderTop: '1px solid #f0ece8',
        fontSize: 11,
        color: '#a8a29e',
        fontFamily: 'var(--kd-font-mono, monospace)',
      }}>
        {loading ? 'Loading...' : (
          <>
            {stats?.memoryCount ?? 0} memories · {stats?.patternCount ?? 0} patterns ·{' '}
            {stats?.lastVisit
              ? `last session ${new Date(stats.lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
              : 'no session yet'
            }
          </>
        )}
      </div>
    </div>
  );
}
