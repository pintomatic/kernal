'use client';

import { useState, useCallback } from 'react';
import { useApi, getAuthHeaders, getApiBase } from './config';

// Helper for streaming + mutation fetch — uses configureKernalUI() singleton
async function sourcesFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...headers, ...options?.headers },
  });
}

interface Source {
  id: number;
  title: string;
  type: string;
  author: string | null;
  url: string | null;
  tags: string[] | string | null;
  summary: string | null;
  content?: string;
  entity_count: number;
  created_at: string;
}

function normalizeTags(t: Source['tags']): string[] {
  if (Array.isArray(t)) return t;
  if (typeof t === 'string' && t.length > 0) return [t];
  return [];
}

interface SourcesData {
  sources: Record<string, Source[]>;
  total: number;
  byType: Array<{ type: string; count: number }>;
}

interface SourceDetail {
  source: Source & { content: string };
  entities: Array<{ id: number; entity_type: string; entity_id: number; entity_name: string }>;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  article: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Article' },
  transcript: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Transcript' },
  note: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Note' },
  document: { bg: 'bg-teal-50', text: 'text-teal-700', label: 'Document' },
  url: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'URL' },
};

export default function Sources() {
  const { data, loading, error } = useApi<SourcesData>('/api/dashboard/sources');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Source[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [synthesizing, setSynthesizing] = useState<number | null>(null);
  const [synthResult, setSynthResult] = useState<{ id: number; pages: any[] } | null>(null);
  const [synthProgress, setSynthProgress] = useState<{ chunk: number; totalChunks: number; pagesCreated: number; latestPages: string[] } | null>(null);
  const [extracting, setExtracting] = useState<number | null>(null);
  const [extractResult, setExtractResult] = useState<{ id: number; results: any } | null>(null);
  const [extractProgress, setExtractProgress] = useState<{ chunk: number; totalChunks: number; people: number; orgs: number } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [enriching, setEnriching] = useState<number | null>(null);
  const [enrichResult, setEnrichResult] = useState<{ id: number; stats: any } | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ status: string; message?: string; elapsed_s?: number } | null>(null);
  const [rationalizing, setRationalizing] = useState<number | null>(null);
  const [rationalizeResult, setRationalizeResult] = useState<{ id: number; delta: any; results: any } | null>(null);
  const [rationalizeProgress, setRationalizeProgress] = useState<{ step: string; status: string } | null>(null);

  const handleSynthesize = useCallback(async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSynthesizing(id);
    setSynthResult(null);
    setSynthProgress(null);
    try {
      const res = await sourcesFetch(`/api/sources/${id}/synthesize?stream=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.done) {
                setSynthResult({ id, pages: ev.pages || [] });
              } else if (ev.chunk) {
                setSynthProgress(ev);
              }
            } catch {}
          }
        }
      }
    } catch (err) { console.error('Synthesis failed:', err); }
    setSynthesizing(null);
    setSynthProgress(null);
  }, []);

  const handleExtractEntities = useCallback(async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExtracting(id);
    setExtractResult(null);
    setExtractProgress(null);
    try {
      const res = await sourcesFetch(`/api/sources/${id}/extract-entities?stream=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.done) {
                setExtractResult({ id, results: ev.results || {} });
              } else if (ev.chunk) {
                setExtractProgress(ev);
              }
            } catch {}
          }
        }
      }
    } catch (err) { console.error('Entity extraction failed:', err); }
    setExtracting(null);
    setExtractProgress(null);
  }, []);

  const handleEnrich = useCallback(async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEnriching(id);
    setEnrichResult(null);
    setEnrichProgress(null);
    try {
      const res = await sourcesFetch(`/api/sources/${id}/enrich?stream=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.done) {
                setEnrichResult({ id, stats: ev.stats || {} });
              } else if (ev.error) {
                setEnrichResult({ id, stats: { error: ev.error } });
              } else {
                setEnrichProgress({ status: ev.status, message: ev.message, elapsed_s: ev.elapsed_s });
              }
            } catch {}
          }
        }
      }
    } catch (err) { console.error('Enrichment failed:', err); }
    setEnriching(null);
    setEnrichProgress(null);
  }, []);

  const handleRationalize = useCallback(async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRationalizing(id);
    setRationalizeResult(null);
    setRationalizeProgress(null);
    try {
      const res = await sourcesFetch(`/api/sources/${id}/rationalize?stream=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.done) {
                setRationalizeResult({ id, delta: ev.delta || {}, results: ev.results || {} });
              } else if (ev.error) {
                setRationalizeResult({ id, delta: { error: ev.error }, results: {} });
              } else {
                setRationalizeProgress({ step: ev.step || '', status: ev.status || '' });
              }
            } catch {}
          }
        }
      }
    } catch (err) { console.error('Rationalization failed:', err); }
    setRationalizing(null);
    setRationalizeProgress(null);
  }, []);

  const handleDelete = useCallback(async (id: number, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Delete "${title}" and all its generated wiki pages and entities?`)) return;
    setDeleting(id);
    try {
      await sourcesFetch(`/api/sources/${id}`, {
        method: 'DELETE',
        headers: {},
      });
      window.location.reload();
    } catch (err) { console.error('Delete failed:', err); }
    setDeleting(null);
  }, []);

  const handleExpand = useCallback(async (id: number) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetailLoading(true);
    try {
      const res = await sourcesFetch(`/api/sources/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch (err) { console.error('Failed to load source:', err); }
    setDetailLoading(false);
  }, [expanded]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await sourcesFetch(`/api/sources?search=${encodeURIComponent(searchQuery)}&limit=20`);
      if (res.ok) { const data = await res.json(); setSearchResults(data.sources || []); }
    } catch (err) { console.error('Failed to search:', err); }
    setSearching(false);
  }, [searchQuery]);

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 animate-pulse">
            <div className="h-4 w-3/4 bg-stone-100 rounded mb-2" />
            <div className="h-3 w-1/2 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load sources: {error}
        </div>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const byType = data?.byType ?? [];
  const allSources = data?.sources ?? {};
  const displaySources = searchResults !== null ? { results: searchResults } : allSources;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-6 bg-white rounded-xl border border-stone-200 px-5 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-teal-600">{total}</span>
          <span className="text-[11px] text-stone-400">Sources</span>
        </div>
        {byType.map((t) => {
          const s = TYPE_STYLES[t.type] || TYPE_STYLES.document;
          return (
            <div key={t.type} className="flex items-baseline gap-1.5">
              <span className={`text-lg font-semibold tabular-nums ${s.text}`}>{t.count}</span>
              <span className="text-[11px] text-stone-400">{s.label}s</span>
            </div>
          );
        })}
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search sources..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-4 pr-4 py-2.5 text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>
        <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
          className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 rounded-xl text-sm font-medium text-stone-700 cursor-pointer">
          {searching ? '...' : 'Search'}
        </button>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-sm font-medium cursor-pointer">
          + Add Source
        </button>
      </div>

      {searchResults !== null && (
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;</span>
          <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="text-teal-600 hover:underline cursor-pointer">Clear</button>
        </div>
      )}

      {/* Source Cards */}
      {Object.entries(displaySources).map(([type, sources]) => (
        <div key={type}>
          {searchResults === null && (
            <div className="flex items-center gap-2 mb-2 mt-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${(TYPE_STYLES[type] || TYPE_STYLES.document).bg} ${(TYPE_STYLES[type] || TYPE_STYLES.document).text}`}>
                {(TYPE_STYLES[type] || TYPE_STYLES.document).label}
              </span>
              <span className="text-[10px] text-stone-400">{(sources as Source[]).length}</span>
            </div>
          )}
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {(sources as Source[]).map((source) => {
              const tags = normalizeTags(source.tags);
              return (
              <div key={source.id} onClick={() => handleExpand(source.id)}
                className={`bg-white rounded-xl border border-stone-200 p-3 cursor-pointer transition-all hover:shadow-sm ${expanded === source.id ? 'ring-2 ring-teal-500/20 border-teal-400 col-span-full' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-900 truncate">{source.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${(TYPE_STYLES[source.type] || TYPE_STYLES.document).bg} ${(TYPE_STYLES[source.type] || TYPE_STYLES.document).text}`}>
                    {source.type}
                  </span>
                  <span className="text-[10px] text-stone-400 ml-auto" style={{ fontFamily: 'var(--kd-font-mono)' }}>#{source.id}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {source.author && <span className="text-[10px] text-stone-500">{source.author}</span>}
                  <span className="text-[10px] text-stone-400" style={{ fontFamily: 'var(--kd-font-mono)' }}>{source.created_at?.slice(0, 10)}</span>
                </div>
                {/* Pipeline viz */}
                <div className="mt-2">
                  <PipelineViz tags={tags} entityCount={source.entity_count} />
                </div>

                {expanded === source.id && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    {detailLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 w-full bg-stone-100 rounded" />
                        <div className="h-3 w-3/4 bg-stone-100 rounded" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Content</h4>
                          <p className="text-xs text-stone-600 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">{detail.source.content}</p>
                        </div>
                        {detail.entities.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Linked Entities ({detail.entities.length})</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {detail.entities.map((e) => (
                                <span key={e.id} className="text-[10px] px-2 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-600">
                                  <span className="font-medium text-stone-400 mr-1">{e.entity_type}</span>{e.entity_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="pt-2 border-t border-stone-100 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={(e) => handleExtractEntities(source.id, e)}
                              disabled={extracting === source.id}
                              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 border border-sky-200 rounded-lg text-xs font-medium text-sky-700 cursor-pointer transition-colors"
                            >
                              {extracting === source.id ? 'Extracting...' : '◆ Extract Entities'}
                            </button>
                            <button
                              onClick={(e) => handleSynthesize(source.id, e)}
                              disabled={synthesizing === source.id}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-700 cursor-pointer transition-colors"
                            >
                              {synthesizing === source.id ? 'Synthesizing...' : '◇ Synthesize to Wiki'}
                            </button>
                            <button
                              onClick={(e) => handleEnrich(source.id, e)}
                              disabled={enriching === source.id}
                              className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 border border-violet-200 rounded-lg text-xs font-medium text-violet-700 cursor-pointer transition-colors"
                            >
                              {enriching === source.id ? 'Enriching...' : '◈ Enrich (Pass 2)'}
                            </button>
                            <button
                              onClick={(e) => handleRationalize(source.id, e)}
                              disabled={rationalizing === source.id}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700 cursor-pointer transition-colors"
                            >
                              {rationalizing === source.id ? 'Rationalizing...' : '◉ Rationalize (Pass 3)'}
                            </button>
                            <button
                              onClick={(e) => handleDelete(source.id, source.title, e)}
                              disabled={deleting === source.id}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 border border-red-200 rounded-lg text-xs font-medium text-red-600 cursor-pointer transition-colors ml-auto"
                            >
                              {deleting === source.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                          {synthesizing === source.id && synthProgress && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-stone-500">
                                <span>Chunk {synthProgress.chunk} of {synthProgress.totalChunks}</span>
                                <span>{synthProgress.pagesCreated} pages created</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                  style={{ width: `${(synthProgress.chunk / synthProgress.totalChunks) * 100}%` }}
                                />
                              </div>
                              {synthProgress.latestPages.length > 0 && (
                                <div className="text-[10px] text-stone-400 truncate">
                                  Latest: {synthProgress.latestPages.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                          {extracting === source.id && extractProgress && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-stone-500">
                                <span>Chunk {extractProgress.chunk} of {extractProgress.totalChunks}</span>
                                <span>{extractProgress.people} people, {extractProgress.orgs} orgs</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-sky-400 rounded-full transition-all duration-500"
                                  style={{ width: `${(extractProgress.chunk / extractProgress.totalChunks) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {extractResult?.id === source.id && (
                            <div className="text-xs text-stone-600">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Extracted: </span>
                              {extractResult.results.people > 0 && <span>{extractResult.results.people} people </span>}
                              {extractResult.results.orgs > 0 && <span>{extractResult.results.orgs} orgs </span>}
                              {extractResult.results.relationships > 0 && <span>{extractResult.results.relationships} relationships </span>}
                              {extractResult.results.activities > 0 && <span>{extractResult.results.activities} activities</span>}
                            </div>
                          )}
                          {synthResult?.id === source.id && synthResult.pages.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                                Created {synthResult.pages.length} wiki page{synthResult.pages.length !== 1 ? 's' : ''}:
                              </span>
                              {synthResult.pages.map((p: any, i: number) => (
                                <div key={i} className="text-xs text-stone-600">
                                  ◇ {p.title} <span className="text-stone-400">({p.action})</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {enriching === source.id && enrichProgress && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-[10px] text-violet-600">
                                <span className="inline-block w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                                <span className="capitalize">{enrichProgress.status.replace(/_/g, ' ')}</span>
                                {enrichProgress.elapsed_s != null && <span className="text-stone-400">{enrichProgress.elapsed_s}s</span>}
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                              </div>
                            </div>
                          )}
                          {enrichResult?.id === source.id && (
                            <div className="text-xs text-stone-600">
                              {enrichResult.stats.error ? (
                                <span className="text-red-600">{enrichResult.stats.error}</span>
                              ) : (
                                <>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Enriched: </span>
                                  {enrichResult.stats.entity_merges > 0 && <span>{enrichResult.stats.entity_merges} arcs </span>}
                                  {enrichResult.stats.new_relationships > 0 && <span>{enrichResult.stats.new_relationships} cross-chunk rels </span>}
                                  {enrichResult.stats.new_activities > 0 && <span>{enrichResult.stats.new_activities} new events </span>}
                                  {enrichResult.stats.deals > 0 && <span>{enrichResult.stats.deals} deals </span>}
                                  {enrichResult.stats.goals > 0 && <span>{enrichResult.stats.goals} goals </span>}
                                  {enrichResult.stats.patterns > 0 && <span>{enrichResult.stats.patterns} patterns </span>}
                                  {enrichResult.stats.has_synthesis && <span>+ synthesis</span>}
                                </>
                              )}
                            </div>
                          )}
                          {rationalizing === source.id && rationalizeProgress && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-[10px] text-emerald-600">
                                <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="capitalize">{rationalizeProgress.step.replace(/_/g, ' ')}</span>
                                <span className="text-stone-400">{rationalizeProgress.status}</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                              </div>
                            </div>
                          )}
                          {rationalizeResult?.id === source.id && (
                            <div className="text-xs text-stone-600">
                              {rationalizeResult.delta.error ? (
                                <span className="text-red-600">{rationalizeResult.delta.error}</span>
                              ) : (
                                <>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Rationalized: </span>
                                  {rationalizeResult.delta.people_merged > 0 && <span>{rationalizeResult.delta.people_merged} merged </span>}
                                  {rationalizeResult.delta.activities_merged > 0 && <span>{rationalizeResult.delta.activities_merged} deduped </span>}
                                  {rationalizeResult.delta.relationships_cleaned > 0 && <span>{rationalizeResult.delta.relationships_cleaned} rels cleaned </span>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ))}

      {total === 0 && searchResults === null && (
        <div className="text-center py-12">
          <div className="text-stone-300 text-4xl mb-3">&#128196;</div>
          <div className="text-sm text-stone-400">No sources yet. Click &ldquo;+ Add Source&rdquo; to paste your first document.</div>
        </div>
      )}

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// Pipeline stage definitions
const PIPELINE_STAGES = [
  { key: 'entities_extracted', label: 'Extract',      doneClasses: 'bg-sky-50 text-sky-700 border-sky-200',    runningClasses: 'bg-sky-50 text-sky-700 border-sky-300' },
  { key: 'synthesized',        label: 'Synthesize',   doneClasses: 'bg-amber-50 text-amber-700 border-amber-200', runningClasses: 'bg-amber-50 text-amber-700 border-amber-300' },
  { key: 'enriched',           label: 'Enrich',       doneClasses: 'bg-violet-50 text-violet-700 border-violet-200', runningClasses: 'bg-violet-50 text-violet-700 border-violet-300' },
  { key: 'rationalized',       label: 'Rationalize',  doneClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200', runningClasses: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
] as const;

function PipelineViz({ tags, entityCount }: { tags: string[]; entityCount: number }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone = tags.includes(stage.key);
        const isFirst = i === 0;
        // A stage is "next" if the previous is done (or it's the first) but this one isn't done yet
        const prevDone = i === 0 ? true : tags.includes(PIPELINE_STAGES[i - 1].key);
        const isPending = !isDone;
        const isNext = isPending && prevDone;

        return (
          <span key={stage.key} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[10px] text-stone-300" aria-hidden>›</span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                isDone
                  ? stage.doneClasses
                  : isNext
                  ? 'bg-stone-50 text-stone-500 border-stone-300 border-dashed'
                  : 'bg-stone-50 text-stone-300 border-stone-200'
              }`}
              style={{ fontFamily: 'var(--kd-font-mono)', letterSpacing: '0.04em' }}
            >
              {isDone && <span className="text-[9px]">done</span>}
              {isNext && <span className="text-[9px]">next</span>}
              {stage.label}
              {isDone && stage.key === 'entities_extracted' && entityCount > 0 && (
                <span className="ml-0.5 font-normal opacity-70">{entityCount}</span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function AddSourceModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('document');
  const [url, setUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || content.trim().length < 10) {
      setError('Title is required and content must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await sourcesFetch(`/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), content: content.trim(), type,
          url: url.trim() || undefined,
          author: author.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        }),
      });
      if (res.ok) { onClose(); window.location.reload(); }
      else { const d = await res.json(); setError(d.error || 'Failed to create source'); }
    } catch { setError('Network error'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-sm font-semibold text-stone-900">Add Source</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 cursor-pointer text-stone-400">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">{error}</div>}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Source title"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">Content * (paste full text)</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the full text content here..." rows={10}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-y font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option value="document">Document</option>
                <option value="article">Article</option>
                <option value="transcript">Transcript</option>
                <option value="note">Note</option>
                <option value="url">URL</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">Author</label>
              <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">URL</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">Tags (comma separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="AI, strategy, moat"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
          </div>
          <button onClick={handleSubmit} disabled={submitting || !title.trim() || content.trim().length < 10}
            className="w-full bg-teal-700 hover:bg-teal-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2.5 text-sm font-medium cursor-pointer">
            {submitting ? 'Adding...' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}
