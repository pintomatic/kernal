'use client';

import React, { useState, useMemo } from 'react';
import { useApi } from './config';
import type { EntityFocus } from './types';

interface WikiPage {
  type: 'person' | 'organization' | 'topic';
  id: number;
  slug?: string;
  name: string;
  subtitle: string;
  page_type?: string;
  domain?: string | null;
  stats: Record<string, number>;
  updated_at: string;
}

interface WikiListResponse {
  pages: WikiPage[];
  total: number;
}

interface WikiDetailSection {
  items: any[];
  count: number;
}

interface WikiDetail {
  type: string;
  entity: Record<string, any>;
  content?: string;
  sections: Record<string, WikiDetailSection>;
}

type TypeFilter = 'all' | 'person' | 'organization' | 'topic';

const SECTION_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  relationships: { label: 'Relationships', icon: '\u2194', bg: 'bg-teal-50', text: 'text-teal-700' },
  people: { label: 'People', icon: '\u{1F464}', bg: 'bg-sky-50', text: 'text-sky-700' },
  deals: { label: 'Deals', icon: '\u25C6', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  plans: { label: 'Strategic Plans', icon: '\u25A6', bg: 'bg-violet-50', text: 'text-violet-700' },
  actions: { label: 'Actions', icon: '\u2192', bg: 'bg-amber-50', text: 'text-amber-700' },
  activities: { label: 'Activities', icon: '\u25CF', bg: 'bg-blue-50', text: 'text-blue-700' },
  memories: { label: 'Memories', icon: '\u25CE', bg: 'bg-purple-50', text: 'text-purple-700' },
  patterns: { label: 'Patterns', icon: '\u224B', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  sources: { label: 'Sources', icon: '\u25C7', bg: 'bg-stone-100', text: 'text-stone-700' },
  linked_entities: { label: 'Linked Entities', icon: '\u2194', bg: 'bg-teal-50', text: 'text-teal-700' },
  children: { label: 'Sub-pages', icon: '\u25B8', bg: 'bg-amber-50', text: 'text-amber-700' },
};

const SECTION_ORDER = ['relationships', 'people', 'deals', 'plans', 'actions', 'activities', 'memories', 'patterns', 'sources', 'linked_entities', 'children'];

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return '1d ago';
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

function formatRelation(rel: string): string {
  return rel.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderSectionItem(sectionKey: string, item: any, onNavigate: (type: string, id: number) => void) {
  switch (sectionKey) {
    case 'relationships':
      return (
        <div className="flex items-center justify-between group">
          <button onClick={() => onNavigate(item.target_type, item.target_id)} className="text-sm text-stone-800 hover:text-[hsl(var(--olive))] hover:underline cursor-pointer truncate">
            {item.target_name || 'Unknown'}
          </button>
          <span className="text-[10px] text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded ml-2 shrink-0">{formatRelation(item.relation)}</span>
        </div>
      );
    case 'people':
      return (
        <div className="flex items-center justify-between">
          <button onClick={() => onNavigate('person', item.id)} className="text-sm text-stone-800 hover:text-[hsl(var(--olive))] hover:underline cursor-pointer truncate">{item.name}</button>
          {item.role && <span className="text-[10px] text-stone-400 ml-2 shrink-0 truncate max-w-[120px]">{item.role}</span>}
        </div>
      );
    case 'deals':
      return (
        <div>
          <div className="text-sm text-stone-800">{item.title || item.name}</div>
          <div className="text-[10px] text-stone-400 flex gap-2 mt-0.5">
            {item.stage && <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{item.stage}</span>}
            {item.value && <span>NOK {Number(item.value).toLocaleString()}</span>}
            {item.org_name && <span>{item.org_name}</span>}
          </div>
        </div>
      );
    case 'plans':
      return (
        <div>
          <div className="text-sm text-stone-800">{item.corporate_objective || 'Strategic Plan'}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">v{item.version || 1}{item.updated_at && ` \u00B7 ${daysAgo(item.updated_at)}`}</div>
        </div>
      );
    case 'actions':
      return (
        <div className="flex items-start justify-between">
          <div className="text-sm text-stone-800 flex-1">{item.title}</div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {item.status && <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.status === 'done' ? 'bg-green-50 text-green-600' : item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-stone-50 text-stone-500'}`}>{item.status === 'in_progress' ? 'active' : item.status}</span>}
            {item.due_date && <span className="text-[10px] text-stone-400">{daysAgo(item.due_date)}</span>}
          </div>
        </div>
      );
    case 'activities':
      return (
        <div>
          <div className="text-sm text-stone-800">{item.title}</div>
          <div className="text-[10px] text-stone-400 mt-0.5 flex gap-2">
            {item.type && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{item.type}</span>}
            {item.date && <span>{daysAgo(item.date)}</span>}
          </div>
        </div>
      );
    case 'memories':
      return (
        <div>
          <div className="text-sm text-stone-800 line-clamp-2">{item.content}</div>
          <div className="text-[10px] text-stone-400 mt-0.5 flex gap-2">
            {item.category && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{item.category}</span>}
            {item.domain && <span>{item.domain}</span>}
          </div>
        </div>
      );
    case 'patterns':
      return (
        <div>
          <div className="text-sm text-stone-800 line-clamp-2">{item.content || item.title}</div>
          {item.type && <span className="text-[10px] text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">{item.type}</span>}
        </div>
      );
    case 'sources':
      return (
        <div>
          <div className="text-sm text-stone-800">{item.title}</div>
          <div className="text-[10px] text-stone-400 mt-0.5 flex gap-2">
            {item.type && <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{item.type}</span>}
            {item.created_at && <span>{daysAgo(item.created_at)}</span>}
          </div>
        </div>
      );
    default:
      return <div className="text-sm text-stone-700 truncate">{item.name || item.title || item.content || JSON.stringify(item).slice(0, 80)}</div>;
  }
}

export default function KnowledgeView({ onEntityClick }: { onEntityClick: (entity: EntityFocus) => void }) {
  const { data, loading, error } = useApi<WikiListResponse>('/api/dashboard/wiki');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<{ type: string; id: number } | null>(null);

  const detailPath = selected ? `/api/dashboard/wiki/${selected.type}/${selected.id}` : null;
  const { data: detail, loading: detailLoading } = useApi<WikiDetail>(detailPath);

  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!data?.pages) return [];
    let pages = data.pages;
    if (typeFilter !== 'all') pages = pages.filter(p => p.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      pages = pages.filter(p => p.name.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q));
    }
    return pages.sort((a, b) => {
      if (a.type === 'topic' && b.type !== 'topic') return -1;
      if (a.type !== 'topic' && b.type === 'topic') return 1;
      const aRel = a.stats.relationships ?? a.stats.people ?? a.stats.sources ?? 0;
      const bRel = b.stats.relationships ?? b.stats.people ?? b.stats.sources ?? 0;
      return bRel - aRel;
    });
  }, [data, search, typeFilter]);

  const groupedByDomain = useMemo(() => {
    const topics = filtered.filter(p => p.type === 'topic');
    const nonTopics = filtered.filter(p => p.type !== 'topic');
    const hasDomains = topics.some(p => p.domain);
    if (!hasDomains || search.trim()) return null;

    const groups: Record<string, WikiPage[]> = {};
    const uncategorized: WikiPage[] = [];
    for (const p of topics) {
      if (p.domain) {
        if (!groups[p.domain]) groups[p.domain] = [];
        groups[p.domain].push(p);
      } else {
        uncategorized.push(p);
      }
    }
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    if (uncategorized.length > 0) sorted.push(['Uncategorized', uncategorized]);
    return { domains: sorted, nonTopics };
  }, [filtered, search]);

  const handleNavigate = (type: string, id: number) => {
    setSelected({ type: type === 'organization' ? 'organization' : type === 'topic' ? 'topic' : 'person', id });
  };

  if (loading && !data) return <ThreePaneSkeleton />;
  if (error) return <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>;
  if (!data) return null;

  const activeSections = detail?.sections ? SECTION_ORDER.filter(key => detail.sections[key] && detail.sections[key].count > 0) : [];

  return (
    <div className="flex h-[calc(100vh-7rem)] max-w-[1400px] mx-auto gap-0">
      {/* LEFT PANE */}
      <div className="w-[260px] shrink-0 border-r border-stone-200 flex flex-col bg-white rounded-l-xl overflow-hidden">
        <div className="p-3 border-b border-stone-100">
          <div className="relative">
            <svg className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 placeholder-stone-400 focus:outline-none focus:border-stone-300" />
          </div>
          <div className="flex gap-1 mt-2">
            {(['all', 'topic', 'person', 'organization'] as TypeFilter[]).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${typeFilter === t ? 'bg-[hsl(var(--olive)/0.1)] text-[hsl(var(--olive))]' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}>
                {t === 'all' ? 'All' : t === 'topic' ? 'Topics' : t === 'person' ? 'People' : 'Orgs'}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-stone-400 mt-1.5 text-right">{filtered.length} of {data.total}</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groupedByDomain && (typeFilter === 'all' || typeFilter === 'topic') ? (
            <>
              {groupedByDomain.domains.map(([domain, pages]) => (
                <div key={domain}>
                  <button
                    onClick={() => setCollapsedDomains(prev => { const next = new Set(prev); next.has(domain) ? next.delete(domain) : next.add(domain); return next; })}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-stone-50 border-b border-stone-100 cursor-pointer hover:bg-stone-100 transition-colors sticky top-0 z-10"
                  >
                    <span className="text-[10px] text-stone-400">{collapsedDomains.has(domain) ? '\u25B8' : '\u25BE'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex-1 text-left truncate">{domain}</span>
                    <span className="text-[10px] text-stone-400 tabular-nums">{pages.length}</span>
                  </button>
                  {!collapsedDomains.has(domain) && pages.map(page => {
                    const isActive = selected?.type === page.type && selected?.id === page.id;
                    return (
                      <button key={`${page.type}-${page.id}`} onClick={() => setSelected({ type: page.type, id: page.id })} className={`w-full text-left px-3 py-2.5 border-b border-stone-50 transition-colors cursor-pointer ${isActive ? 'bg-[hsl(var(--olive)/0.05)] border-l-2 border-l-[hsl(var(--olive))]' : 'hover:bg-stone-50 border-l-2 border-l-transparent'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-amber-100 text-amber-700">{'\u25C7'}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-stone-900 truncate">{page.name}</div>
                            <div className="text-[10px] text-stone-400 truncate">{page.subtitle}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {groupedByDomain.nonTopics.length > 0 && (
                <div>
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">People & Organizations</span>
                  </div>
                  {groupedByDomain.nonTopics.map(page => {
                    const isActive = selected?.type === page.type && selected?.id === page.id;
                    return (
                      <button key={`${page.type}-${page.id}`} onClick={() => setSelected({ type: page.type, id: page.id })} className={`w-full text-left px-3 py-2.5 border-b border-stone-50 transition-colors cursor-pointer ${isActive ? 'bg-[hsl(var(--olive)/0.05)] border-l-2 border-l-[hsl(var(--olive))]' : 'hover:bg-stone-50 border-l-2 border-l-transparent'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${page.type === 'person' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{page.name.charAt(0)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-stone-900 truncate">{page.name}</div>
                            <div className="text-[10px] text-stone-400 truncate">{page.subtitle}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            filtered.map(page => {
              const isActive = selected?.type === page.type && selected?.id === page.id;
              return (
                <button key={`${page.type}-${page.id}`} onClick={() => setSelected({ type: page.type, id: page.id })} className={`w-full text-left px-3 py-2.5 border-b border-stone-50 transition-colors cursor-pointer ${isActive ? 'bg-[hsl(var(--olive)/0.05)] border-l-2 border-l-[hsl(var(--olive))]' : 'hover:bg-stone-50 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${page.type === 'topic' ? 'bg-amber-100 text-amber-700' : page.type === 'person' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                      {page.type === 'topic' ? '\u25C7' : page.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-stone-900 truncate">{page.name}</div>
                      <div className="text-[10px] text-stone-400 truncate">{page.subtitle}</div>
                    </div>
                    <span className="text-[9px] text-stone-300 shrink-0">{daysAgo(page.updated_at)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* CENTER PANE */}
      <div className="flex-1 overflow-y-auto bg-white">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-stone-300 text-4xl mb-3">{'\u25C7'}</div>
              <p className="text-sm text-stone-400">Select an entity to view its knowledge page</p>
              <p className="text-xs text-stone-300 mt-1">{data.total} entities in knowledge base</p>
            </div>
          </div>
        ) : detailLoading ? (
          <WikiPageSkeleton />
        ) : detail ? (
          <div className="max-w-3xl mx-auto p-6">
            {detail.type === 'topic' ? (
              <TopicPageView detail={detail} />
            ) : (
              <EntityPageView detail={detail} selected={selected} activeSections={activeSections} handleNavigate={handleNavigate} onEntityClick={onEntityClick} />
            )}
          </div>
        ) : null}
      </div>

      {/* RIGHT PANE */}
      <div className="w-[280px] shrink-0 border-l border-stone-200 bg-stone-50 rounded-r-xl overflow-y-auto">
        {selected && detail ? (
          <div className="p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3">Quick Context</h3>
            {detail.sections.relationships && detail.sections.relationships.count > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-semibold text-stone-500 uppercase mb-2">Connected To</div>
                <div className="space-y-1.5">
                  {detail.sections.relationships.items.slice(0, 8).map((rel: any, i: number) => (
                    <button key={i} onClick={() => handleNavigate(rel.target_type, rel.target_id)} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer text-left">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${rel.target_type === 'person' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{(rel.target_name || '?').charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="text-xs text-stone-700 truncate">{rel.target_name}</div>
                        <div className="text-[9px] text-stone-400">{formatRelation(rel.relation)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {detail.sections.people && detail.sections.people.count > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-semibold text-stone-500 uppercase mb-2">People</div>
                <div className="space-y-1.5">
                  {detail.sections.people.items.slice(0, 8).map((p: any, i: number) => (
                    <button key={i} onClick={() => handleNavigate('person', p.id)} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer text-left">
                      <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[8px] font-bold shrink-0">{p.name.charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="text-xs text-stone-700 truncate">{p.name}</div>
                        {p.role && <div className="text-[9px] text-stone-400 truncate">{p.role}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {detail.sections.linked_entities && detail.sections.linked_entities.count > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-semibold text-stone-500 uppercase mb-2">Linked Entities</div>
                <div className="space-y-1.5">
                  {detail.sections.linked_entities.items.slice(0, 8).map((ent: any, i: number) => (
                    <button key={i} onClick={() => handleNavigate(ent.entity_type, ent.id)} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer text-left">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${ent.entity_type === 'person' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{(ent.name || '?').charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="text-xs text-stone-700 truncate">{ent.name}</div>
                        {ent.role && <div className="text-[9px] text-stone-400 truncate">{ent.role}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {detail.sections.sources && detail.sections.sources.count > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-semibold text-stone-500 uppercase mb-2">Sources</div>
                <div className="space-y-1">
                  {detail.sections.sources.items.slice(0, 5).map((src: any, i: number) => (
                    <div key={i} className="p-1.5 rounded-lg bg-white">
                      <div className="text-xs text-stone-700 truncate">{src.title}</div>
                      <div className="text-[9px] text-stone-400 flex gap-1.5 mt-0.5">
                        <span className="bg-stone-100 px-1 rounded">{src.type}</span>
                        <span>{daysAgo(src.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.sections.activities && detail.sections.activities.count > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-stone-500 uppercase mb-2">Recent Activity</div>
                <div className="space-y-1">
                  {detail.sections.activities.items.slice(0, 5).map((act: any, i: number) => (
                    <div key={i} className="p-1.5 rounded-lg bg-white">
                      <div className="text-xs text-stone-700 truncate">{act.title}</div>
                      <div className="text-[9px] text-stone-400 mt-0.5">
                        {act.type && <span className="bg-blue-50 text-blue-600 px-1 rounded mr-1">{act.type}</span>}
                        {act.date && daysAgo(act.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-stone-400">Context appears here</p>
          </div>
        )}
      </div>
    </div>
  );
}

function inlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(_(.+?)_)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={key++} className="font-semibold text-stone-900">{match[2]}</strong>);
    else if (match[4]) parts.push(<code key={key++} className="text-xs bg-stone-100 px-1 py-0.5 rounded font-mono">{match[4]}</code>);
    else if (match[6]) parts.push(<em key={key++}>{match[6]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('### ')) elements.push(<h4 key={i} className="text-sm font-semibold text-stone-800 mt-4 mb-1">{inlineMarkdown(line.slice(4))}</h4>);
    else if (line.startsWith('## ')) elements.push(<h3 key={i} className="text-base font-semibold text-stone-900 mt-5 mb-2">{inlineMarkdown(line.slice(3))}</h3>);
    else if (line.startsWith('# ')) elements.push(<h2 key={i} className="text-lg font-bold text-stone-900 mt-6 mb-2">{inlineMarkdown(line.slice(2))}</h2>);
    else if (line.startsWith('- ') || line.startsWith('* ')) elements.push(<li key={i} className="text-sm text-stone-700 ml-4 list-disc">{inlineMarkdown(line.slice(2))}</li>);
    else if (line.startsWith('> ')) elements.push(<blockquote key={i} className="text-sm text-stone-600 border-l-2 border-stone-300 pl-3 italic my-1">{inlineMarkdown(line.slice(2))}</blockquote>);
    else if (line.trim() === '') elements.push(<div key={i} className="h-2" />);
    else elements.push(<p key={i} className="text-sm text-stone-700 leading-relaxed">{inlineMarkdown(line)}</p>);
  }
  return <div>{elements}</div>;
}

function TopicPageView({ detail }: { detail: WikiDetail }) {
  return (
    <>
      <div className="mb-6 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-50 text-amber-700">{detail.entity.page_type || 'topic'}</span>
          <h2 className="text-xl font-semibold text-stone-900">{detail.entity.name}</h2>
        </div>
        {detail.entity.summary && <p className="text-sm text-stone-500 mt-1">{detail.entity.summary}</p>}
        {detail.entity.tags?.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {detail.entity.tags.map((tag: string, i: number) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{tag}</span>
            ))}
          </div>
        )}
      </div>
      {detail.content && <SimpleMarkdown content={detail.content} />}
    </>
  );
}

function EntityPageView({ detail, selected, activeSections, handleNavigate, onEntityClick }: { detail: WikiDetail; selected: { type: string; id: number }; activeSections: string[]; handleNavigate: (type: string, id: number) => void; onEntityClick: (entity: EntityFocus) => void }) {
  return (
    <>
      <div className="mb-6 pb-4 border-b border-stone-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${detail.type === 'person' ? 'bg-sky-50 text-sky-600' : 'bg-violet-50 text-violet-600'}`}>{detail.type}</span>
              <h2 className="text-xl font-semibold text-stone-900">{detail.entity.name}</h2>
            </div>
            <p className="text-sm text-stone-500 mt-1">
              {detail.entity.role && detail.entity.role}
              {detail.entity.role && detail.entity.org_name && ' at '}
              {detail.entity.org_name && <button onClick={() => { if (detail.entity.org_id) handleNavigate('organization', detail.entity.org_id); }} className="hover:text-[hsl(var(--olive))] hover:underline cursor-pointer">{detail.entity.org_name}</button>}
              {!detail.entity.role && detail.entity.industry}
            </p>
            {detail.entity.email && <p className="text-xs text-stone-400 mt-0.5">{detail.entity.email}</p>}
          </div>
          <button onClick={() => onEntityClick({ type: detail.type === 'organization' ? 'organization' : 'person', id: selected.id, name: detail.entity.name })} className="text-[10px] text-stone-400 hover:text-[hsl(var(--olive))] flex items-center gap-1 px-2 py-1 rounded hover:bg-stone-50 cursor-pointer" title="Open full dossier">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Dossier
          </button>
        </div>
        <div className="flex gap-3 mt-3 flex-wrap">
          {activeSections.map(key => {
            const cfg = SECTION_CONFIG[key];
            return <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{detail.sections[key].count} {cfg.label}</span>;
          })}
        </div>
      </div>
      <div className="space-y-6">
        {activeSections.map(key => {
          const cfg = SECTION_CONFIG[key];
          const section = detail.sections[key];
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.icon} {cfg.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} font-medium`}>{section.count}</span>
              </div>
              <div className="space-y-2 pl-1">
                {section.items.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} className="py-1 border-b border-stone-50 last:border-0">{renderSectionItem(key, item, handleNavigate)}</div>
                ))}
                {section.count > 10 && <div className="text-[10px] text-stone-400 pt-1">+{section.count - 10} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ThreePaneSkeleton() {
  return (
    <div className="flex h-[calc(100vh-7rem)] max-w-[1400px] mx-auto">
      <div className="w-[260px] shrink-0 border-r border-stone-200 bg-white rounded-l-xl p-3">
        <div className="h-7 w-full bg-stone-100 rounded animate-pulse mb-3" />
        <div className="h-6 w-full bg-stone-100 rounded animate-pulse mb-2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-2">
            <div className="w-6 h-6 rounded-full bg-stone-100 animate-pulse" />
            <div className="flex-1"><div className="h-3 w-3/4 bg-stone-100 rounded animate-pulse mb-1" /><div className="h-2 w-1/2 bg-stone-100 rounded animate-pulse" /></div>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-white flex items-center justify-center"><div className="text-stone-300 text-sm">Loading knowledge base...</div></div>
      <div className="w-[280px] shrink-0 border-l border-stone-200 bg-stone-50 rounded-r-xl" />
    </div>
  );
}

function WikiPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6 pb-4 border-b border-stone-100">
        <div className="h-5 w-48 bg-stone-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-6">
          <div className="h-3 w-24 bg-stone-100 rounded animate-pulse mb-3" />
          <div className="h-4 w-full bg-stone-100 rounded animate-pulse mb-2" />
          <div className="h-4 w-3/4 bg-stone-100 rounded animate-pulse mb-2" />
          <div className="h-4 w-1/2 bg-stone-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
