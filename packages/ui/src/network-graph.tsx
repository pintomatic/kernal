'use client';

import { useCallback, useRef, useState, useEffect, lazy, Suspense } from 'react';
import { getApiBase, getAuthHeaders } from './config';
import { getNodeColor, getNodeSize } from './graph-theme';

const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
 *
 * The recruitment pipeline (longlisted/shortlisted/interviewed/placed) was a
 * 4-step violet ramp (a78bfa → 7c3aed → 6d28d9 → 4c1d95). The Phase 0 design
 * pass identified this as the most visible aurora leak: the rainbow signalled
 * pipeline depth via hue, but depth is also signalled by the label. Per the
 * single-accent rule we collapse to neutral stone for early stages and warmer
 * stone for advanced stages — the gradient is preserved (lightness, not hue).
 *
 * `competes_with` was lavender (#9333ea) — collapsed to error-ink for the
 * adversarial-relation signal without the violet hue. */
// Keys are normalized: lowercase, spaces→underscore, trailing words trimmed for prefix matching
const RELATION_COLORS: Record<string, string> = {
  // Professional
  works_at: '#78716c', 'works at': '#78716c',
  founded: '#d97706',
  manages: '#dc2626', reports_to: '#ef4444', 'reports to': '#ef4444',
  'board oversight': '#f59e0b', 'board oversight of': '#f59e0b',
  'account lead': '#0284c7', 'account lead for': '#0284c7',
  'day-to-day contact': '#0891b2', supports: '#64748b',
  // Recruitment pipeline — was aurora violet ramp; collapsed to stone+teal ramp
  'longlisted for': '#a8a29e', 'longlisted for cdo role': '#a8a29e',
  'shortlisted for': '#78716c', 'shortlisted for cdo role': '#78716c',
  interviewed: '#0d9488', placed: '#0f766e',
  // Collaboration
  collaborates_with: '#16a34a', 'collaborates with': '#16a34a',
  partners_with: '#15803d', 'partners with': '#15803d',
  met_with: '#22d3ee', 'met with': '#22d3ee',
  introduced: '#0284c7',
  // Social
  knows: '#64748b', participated_in: '#a8a29e', 'participated in': '#a8a29e',
  // Competition / Other — was lavender; collapsed to error-ink
  competes_with: '#7f1d1d', 'competes with': '#7f1d1d',
};

// Human-readable labels for the legend
const RELATION_LABELS: Record<string, string> = {
  'works at': 'Works at', works_at: 'Works at',
  founded: 'Founded',
  manages: 'Manages', 'reports to': 'Reports to', reports_to: 'Reports to',
  'board oversight of': 'Board oversight', 'board oversight': 'Board oversight',
  'account lead for': 'Account lead', 'account lead': 'Account lead',
  'day-to-day contact': 'Day-to-day contact', supports: 'Supports',
  'longlisted for cdo role': 'Longlisted', 'longlisted for': 'Longlisted',
  'shortlisted for cdo role': 'Shortlisted', 'shortlisted for': 'Shortlisted',
  interviewed: 'Interviewed', placed: 'Placed',
  'collaborates with': 'Collaborates', collaborates_with: 'Collaborates',
  'partners with': 'Partners with', partners_with: 'Partners with',
  'met with': 'Met with', met_with: 'Met with',
  introduced: 'Introduced',
  knows: 'Knows', 'participated in': 'Participated in', participated_in: 'Participated in',
  'competes with': 'Competes with', competes_with: 'Competes with',
};

// Lookup color for a relation string — tries exact, then prefix match
function getRelationColor(relation: string): string | undefined {
  const key = relation.toLowerCase().trim();
  if (RELATION_COLORS[key]) return RELATION_COLORS[key];
  // Prefix match: "shortlisted for CDO role" → matches "shortlisted for"
  const match = Object.keys(RELATION_COLORS).find(k => key.startsWith(k));
  return match ? RELATION_COLORS[match] : undefined;
}

interface GraphNode {
  id: string; label: string; type?: string; node_type?: string; role?: string; org?: string;
  x?: number; y?: number; color?: string; val?: number; has_graph?: boolean; rawId?: number;
}
interface GraphEdge { source: string | GraphNode; target: string | GraphNode; relation: string; color?: string; }
interface GraphFilters { organizations: string[]; relationTypes: string[]; }
interface NetworkGraphProps {
  // Legacy / demo props — kept for backward compat
  demoMode?: boolean;
  onReplayComplete?: () => void;
  // New controlled props (Pass 1)
  showNodeTypes?: Set<string>;
  selectedNode?: { type: string; id: number; name: string } | null;
  expandedSystemId?: number | null;
  onNodeSelectChange?: (node: { type: string; id: number; name: string } | null) => void;
  onExpandSystemRequest?: (systemId: number | null) => void;
  graphRef?: React.RefObject<any>;
  stablePositions?: boolean;
}

const edgeEndpoint = (endpoint: string | GraphNode) => typeof endpoint === 'string' ? endpoint : endpoint.id;
const edgeKey = (edge: GraphEdge, index: number) => `${edgeEndpoint(edge.source)}->${edgeEndpoint(edge.target)}:${edge.relation}:${index}`;

export default function NetworkGraph({
  demoMode = false,
  onReplayComplete,
  showNodeTypes: showNodeTypesProp,
  selectedNode: selectedNodeProp,
  expandedSystemId: expandedSystemIdProp,
  onNodeSelectChange,
  onExpandSystemRequest,
  graphRef: graphRefProp,
  stablePositions,
}: NetworkGraphProps) {
  const fgRef = useRef<any>();
  // Forward external graphRef if provided
  const resolvedRef = graphRefProp ?? fgRef;
  const replayTimer = useRef<number | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [visibleEdgeIds, setVisibleEdgeIds] = useState<Set<string>>(new Set());
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [highlightedEdge, setHighlightedEdge] = useState<string | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [replayFinished, setReplayFinished] = useState(false);
  const [filters, setFilters] = useState<GraphFilters>({ organizations: [], relationTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('');
  const [depth, setDepth] = useState(2);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  // Graph settle state — set true after first force simulation completes, resets on data reload
  const [localHasSettled, setLocalHasSettled] = useState(false);

  // Drag guard: prevents background click from firing after a pan
  const isDraggingRef = useRef(false);
  const dragClearTimer = useRef<ReturnType<typeof setTimeout>>();

  // Node type filters — controls the ?include= param (internal state, used when no prop)
  const [showNodeTypes, setShowNodeTypes] = useState({
    projects: true,
    deals: true,
    goals: false,
    systems: true,
  });

  // Derive the effective include types: prefer prop Set<string> if provided
  const effectiveShowTypes = showNodeTypesProp ?? null;

  // Graphify expansion state: set of system IDs whose code graphs are loaded
  const [expandedSystems, setExpandedSystems] = useState<Set<number>>(new Set());
  const [graphifyNodes, setGraphifyNodes] = useState<GraphNode[]>([]);
  const [graphifyEdges, setGraphifyEdges] = useState<GraphEdge[]>([]);
  const [graphifyLoading, setGraphifyLoading] = useState<number | null>(null);

  // Fix: once replay has been played, don't reset on filter changes
  const replayEverPlayedRef = useRef(false);

  // Phase 1B: auto-start replay refs (values assigned after playReplay is defined below)
  const autoPlayedRef = useRef(false);
  const playReplayRef = useRef<() => void>(() => {});

  const seedReplay = useCallback((nextNodes: GraphNode[]) => {
    if (replayEverPlayedRef.current) return; // replay already played — don't reset graph
    setVisibleNodeIds(new Set(nextNodes.slice(0, Math.min(2, nextNodes.length)).map(n => n.id)));
    setVisibleEdgeIds(new Set());
    setReplayFinished(false);
    setHighlightedNode(null);
    setHighlightedEdge(null);
  }, []);

  const fetchGraph = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedOrg) params.set('org', selectedOrg);
      if (selectedPerson) params.set('person', selectedPerson);
      if (selectedRelation) params.set('relation', selectedRelation);
      if (selectedOrg || selectedPerson) params.set('depth', String(depth));
      // Always load all types — client-side filtering handles visibility instantly
      params.set('include', 'projects,deals,goals,systems');
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/dashboard/graph?${params}`, { headers });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const nextNodes = data.nodes.map((n: any) => {
        const nt = n.node_type || n.type || 'person';
        return { ...n, color: getNodeColor(nt), val: getNodeSize(nt) };
      });
      setNodes(nextNodes);
      setEdges(data.edges.map((e: any) => ({ ...e, color: getRelationColor(e.relation) || '#d6d3d1' })));
      setLocalHasSettled(false); // reset so simulation runs on new data
      // Clear graphify expansions when base graph reloads
      setExpandedSystems(new Set());
      setGraphifyNodes([]);
      setGraphifyEdges([]);
      if (demoMode) seedReplay(nextNodes);
      if (data.filters) setFilters(data.filters);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [selectedOrg, selectedPerson, selectedRelation, depth, demoMode, seedReplay]);

  // Expand a system's code graph from Graphify
  const expandSystemGraph = useCallback(async (systemId: number) => {
    if (expandedSystems.has(systemId)) return;
    setGraphifyLoading(systemId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/systems/${systemId}/graph`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.has_graph) return;

      // Bloom origin: read x/y from React state (force simulation mutates these in place)
      const systemNode = nodes.find(n => n.id === `system-${systemId}`);
      const originX = systemNode?.x ?? 0;
      const originY = systemNode?.y ?? 0;

      setGraphifyNodes(prev => [
        ...prev,
        ...data.nodes.slice(0, 50).map((n: any) => ({
          ...n,
          node_type: 'code',
          color: '#9CA3AF',
          val: 3,
          x: originX + (Math.random() - 0.5) * 140,
          y: originY + (Math.random() - 0.5) * 140,
        })),
      ]);
      setGraphifyEdges(prev => [
        ...prev,
        ...data.edges.slice(0, 200).map((e: any) => ({ ...e, color: '#e2e8f0' })),
      ]);
      setExpandedSystems(prev => new Set(prev).add(systemId));

      // Restart force simulation so new nodes actually move (may be settled/frozen)
      setLocalHasSettled(false);
      const ref = resolvedRef.current ?? fgRef.current;
      ref?.d3ReheatSimulation?.();
    } finally {
      setGraphifyLoading(null);
    }
  }, [expandedSystems, nodes, resolvedRef]);

  // Collapse a system's code graph
  const collapseSystemGraph = useCallback((systemId: number) => {
    const prefix = `graphify-${systemId}-`;
    setGraphifyNodes(prev => prev.filter(n => !n.id.startsWith(prefix)));
    setGraphifyEdges(prev => prev.filter(e => {
      const src = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      return !src.startsWith(prefix) && !tgt.startsWith(prefix);
    }));
    setExpandedSystems(prev => { const s = new Set(prev); s.delete(systemId); return s; });
  }, []);

  // Wire controlled expandedSystemId prop to internal expand/collapse
  useEffect(() => {
    if (expandedSystemIdProp == null) {
      setExpandedSystems(new Set());
      setGraphifyNodes([]);
      setGraphifyEdges([]);
      setGraphifyLoading(null);
      return;
    }
    if (!expandedSystems.has(expandedSystemIdProp)) {
      expandSystemGraph(expandedSystemIdProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedSystemIdProp]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  useEffect(() => {
    if (demoMode) seedReplay(nodes);
    else {
      setReplayActive(false);
      setReplayFinished(false);
      setVisibleNodeIds(new Set());
      setVisibleEdgeIds(new Set());
    }
    return () => {
      if (replayTimer.current) window.clearInterval(replayTimer.current);
    };
  }, [demoMode, nodes, seedReplay]);

  const playReplay = useCallback(() => {
    if (nodes.length === 0 || replayActive) return;
    if (replayTimer.current) window.clearInterval(replayTimer.current);
    const seedIds = nodes.slice(0, Math.min(2, nodes.length)).map(n => n.id);
    const steps = [
      ...nodes.slice(seedIds.length).map(n => ({ type: 'node' as const, id: n.id })),
      ...edges.map((edge, index) => ({ type: 'edge' as const, id: edgeKey(edge, index) })),
    ];
    setFocusedNode(null);
    setReplayActive(true);
    setReplayFinished(false);
    setVisibleNodeIds(new Set(seedIds));
    setVisibleEdgeIds(new Set());
    setHighlightedNode(null);
    setHighlightedEdge(null);
    if (steps.length === 0) {
      setReplayActive(false);
      setReplayFinished(true);
      replayEverPlayedRef.current = true;
      onReplayComplete?.();
      return;
    }
    let index = 0;
    const intervalMs = Math.max(120, Math.floor(13000 / steps.length));
    replayTimer.current = window.setInterval(() => {
      const step = steps[index];
      if (step.type === 'node') {
        setVisibleNodeIds(prev => new Set(prev).add(step.id));
        setHighlightedNode(step.id);
        setHighlightedEdge(null);
      } else {
        setVisibleEdgeIds(prev => new Set(prev).add(step.id));
        setHighlightedEdge(step.id);
        setHighlightedNode(null);
      }
      index += 1;
      if (index >= steps.length) {
        if (replayTimer.current) window.clearInterval(replayTimer.current);
        window.setTimeout(() => {
          setReplayActive(false);
          setReplayFinished(true);
          replayEverPlayedRef.current = true;
          setHighlightedNode(null);
          setHighlightedEdge(null);
          onReplayComplete?.();
        }, 600);
      }
    }, intervalMs);
  }, [edges, nodes, onReplayComplete, replayActive]);

  // Phase 1B: keep ref in sync with latest playReplay, then auto-start once data loads
  useEffect(() => { playReplayRef.current = playReplay; }, [playReplay]);

  useEffect(() => {
    if (!demoMode || autoPlayedRef.current || nodes.length === 0) return;
    autoPlayedRef.current = true;
    // 1500ms gives data time to settle — cold Cloud Run starts can be 2-3s
    const timer = setTimeout(() => playReplayRef.current(), 1500);
    return () => clearTimeout(timer);
  }, [demoMode, nodes.length]);

  const handleNodeClick = useCallback((node: any) => {
    if (isDraggingRef.current) return;
    if (focusedNode === node.id) {
      setFocusedNode(null);
      onNodeSelectChange?.(null);
      return;
    }
    setFocusedNode(node.id);
    const nt = node.node_type || node.type || 'person';
    onNodeSelectChange?.({ type: nt, id: node.rawId ?? 0, name: node.label });
    const ref = resolvedRef.current ?? fgRef.current;
    if (ref) { ref.centerAt(node.x, node.y, 500); ref.zoom(3, 500); }
  }, [focusedNode, onNodeSelectChange, resolvedRef]);

  const hasFilters = selectedOrg || selectedPerson || selectedRelation;
  const allNodes = [...nodes, ...graphifyNodes];
  const allEdges = [...edges, ...graphifyEdges];

  // Client-side type filter — instant, no re-fetch
  const typeFilteredNodes = showNodeTypesProp
    ? allNodes.filter(n => showNodeTypesProp.has(n.node_type || n.type || 'person'))
    : allNodes;

  // Demo replay overlays the type filter
  const graphNodes = (demoMode && !replayFinished)
    ? typeFilteredNodes.filter(n => visibleNodeIds.has(n.id))
    : typeFilteredNodes;

  // Only show edges where BOTH endpoints are in the visible node set
  const graphNodeIds = new Set(graphNodes.map(n => n.id));
  const typeFilteredEdges = allEdges.filter(e =>
    graphNodeIds.has(edgeEndpoint(e.source)) && graphNodeIds.has(edgeEndpoint(e.target))
  );
  const graphEdges = (demoMode && !replayFinished)
    ? typeFilteredEdges.filter((edge, index) =>
        visibleEdgeIds.has(edgeKey(edge, index)) &&
        visibleNodeIds.has(edgeEndpoint(edge.source)) &&
        visibleNodeIds.has(edgeEndpoint(edge.target)))
    : typeFilteredEdges;

  // Derived values for the focused node detail card
  const allFocusedEdges = focusedNode
    ? graphEdges.filter(e =>
        edgeEndpoint(e.source) === focusedNode || edgeEndpoint(e.target) === focusedNode
      )
    : [];
  const focusedNodeData = focusedNode ? graphNodes.find(n => n.id === focusedNode) ?? null : null;
  const focusedNodeEdges = allFocusedEdges.slice(0, 5);
  const focusedNodeDegree = allFocusedEdges.length;

  const getOtherNode = (e: GraphEdge) => {
    const otherId = edgeEndpoint(e.source) === focusedNode
      ? edgeEndpoint(e.target)
      : edgeEndpoint(e.source);
    return graphNodes.find(n => n.id === otherId);
  };
  const peopleShown = graphNodes.filter(n => (n.node_type || n.type) === 'person').length;
  const orgsShown = graphNodes.filter(n => (n.node_type || n.type) === 'organization').length;
  const peopleTotal = nodes.filter(n => (n.node_type || n.type) === 'person').length;
  const orgsTotal = nodes.filter(n => (n.node_type || n.type) === 'organization').length;

  if (error) return <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-3">
      {/* Old filter bar — hidden when parent provides showNodeTypes (controlled mode) */}
      {!showNodeTypesProp && <div className="flex flex-wrap gap-3 items-end bg-white rounded-xl border border-stone-200 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Organization</label>
          <select value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setSelectedPerson(''); }}
            className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-w-[180px] cursor-pointer">
            <option value="">All organizations</option>
            {filters.organizations.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Person</label>
          <input type="text" value={selectedPerson} onChange={e => { setSelectedPerson(e.target.value); setSelectedOrg(''); }}
            placeholder="Search person..." onKeyDown={e => { if (e.key === 'Enter') fetchGraph(); }}
            className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-[180px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Relationship</label>
          <select value={selectedRelation} onChange={e => setSelectedRelation(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-w-[150px] cursor-pointer">
            <option value="">All types</option>
            {filters.relationTypes.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {(selectedOrg || selectedPerson) && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Depth: {depth}</label>
            <input type="range" min={1} max={4} value={depth} onChange={e => setDepth(parseInt(e.target.value))} className="w-24 accent-teal-600" />
          </div>
        )}
        {hasFilters && (
          <button onClick={() => { setSelectedOrg(''); setSelectedPerson(''); setSelectedRelation(''); setDepth(2); setFocusedNode(null); }}
            className="px-3 py-1.5 text-sm bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors cursor-pointer">Clear</button>
        )}
        {/* Node type toggles */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Show</label>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css. */}
            {([
              { key: 'projects', label: 'Projects', color: '#D97706' },
              { key: 'deals', label: 'Deals', color: '#B45309' },
              { key: 'systems', label: 'Systems', color: '#78716c' },
              { key: 'goals', label: 'Goals', color: '#16A34A' },
            ] as const).map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer text-xs text-stone-600 select-none">
                <input
                  type="checkbox"
                  checked={showNodeTypes[key]}
                  onChange={e => setShowNodeTypes(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="accent-teal-600 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <span style={{ background: color }} className="w-2 h-2 rounded-full inline-block" />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="ml-auto flex gap-3 text-xs text-stone-400 font-mono">
          <span>{graphNodes.length} nodes</span>
          <span>{graphEdges.length} edges</span>
        </div>
      </div>}

      <div className="relative w-full h-[calc(100vh-14rem)] rounded-xl overflow-hidden border border-stone-200 bg-white">
        {loading && <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80"><div className="text-stone-400 animate-pulse text-sm">Loading graph...</div></div>}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 text-xs text-stone-500">
          <span className="flex items-center gap-1"><span style={{ background: '#009AD7' }} className="w-2.5 h-2.5 rounded-full inline-block" /> People</span>
          <span className="flex items-center gap-1"><span style={{ background: '#002856' }} className="w-2.5 h-2.5 rounded-full inline-block" /> Orgs</span>
          {showNodeTypes.projects && <span className="flex items-center gap-1"><span style={{ background: '#D97706' }} className="w-2.5 h-2.5 rounded-full inline-block" /> Projects</span>}
          {showNodeTypes.deals && <span className="flex items-center gap-1"><span style={{ background: '#B45309' }} className="w-2.5 h-2.5 rounded-full inline-block" /> Deals</span>}
          {showNodeTypes.goals && <span className="flex items-center gap-1"><span style={{ background: '#16A34A' }} className="w-2.5 h-2.5 rounded-full inline-block" /> Goals</span>}
          {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css. */}
          {showNodeTypes.systems && <span className="flex items-center gap-1"><span style={{ background: '#78716c' }} className="w-2.5 h-2.5 rounded-full inline-block" /> Systems</span>}
        </div>
        {demoMode && (
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 320, maxWidth: 'calc(100% - 24px)', background: 'rgba(255,255,255,.96)', border: '1px solid #dbeafe', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,.12)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button onClick={playReplay} disabled={loading || replayActive} style={{ border: 0, borderRadius: 8, background: replayActive || loading ? '#d6d3d1' : '#002856', color: 'white', fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: replayActive || loading ? 'default' : 'pointer' }}>{replayActive ? 'Replaying...' : 'Play Replay'}</button>
              <span style={{ fontSize: 11, color: '#78716c' }}>fast-forward extraction trace</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontFamily: 'var(--kd-font-mono)', fontSize: 11 }}>
              <div style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 8, padding: '5px 7px' }}>People: {peopleShown} / {peopleTotal}</div>
              {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
                * Orgs replay-stat chip: violet ink on violet-tinted bg → ink-2
                * on chip neutral (orgs read in stone family per Phase 0 spec). */}
              <div style={{ background: '#f5f4f2', color: '#44403c', borderRadius: 8, padding: '5px 7px' }}>Orgs: {orgsShown} / {orgsTotal}</div>
              <div style={{ background: '#fffbeb', color: '#b45309', borderRadius: 8, padding: '5px 7px' }}>Relations: {graphEdges.length} / {edges.length}</div>
            </div>
          </div>
        )}
        {focusedNodeData && (
          <div style={{
            position: 'absolute',
            top: demoMode ? 140 : 12,
            right: 12,
            zIndex: 20,
            width: 260,
            maxWidth: 'calc(100% - 280px)',
            background: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(15,23,42,.14)',
            overflow: 'hidden',
          }}
            role="region"
            aria-label={`Details for ${focusedNodeData.label}`}
          >
            {/* Header */}
            <div style={{ padding: '12px 14px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1a2840', lineHeight: 1.3 }}>
                    {focusedNodeData.label}
                  </p>
                  {focusedNodeData.role && (
                    <p style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{focusedNodeData.role}</p>
                  )}
                </div>
                <button
                  onClick={() => setFocusedNode(null)}
                  aria-label="Close details"
                  style={{ background: 'none', border: 0, color: '#a8a29e', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, marginLeft: 8, flexShrink: 0 }}
                >x</button>
              </div>
              <p style={{ fontSize: 11, color: '#a8a29e', marginTop: 4, textTransform: 'capitalize' }}>
                {focusedNodeData.type} · {focusedNodeDegree} connection{focusedNodeDegree !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Connections */}
            {focusedNodeEdges.length > 0 && (
              <div style={{ padding: '0 14px 8px', borderTop: '1px solid #f5f5f4' }}>
                {focusedNodeEdges.map((e, i) => {
                  const other = getOtherNode(e);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < focusedNodeEdges.length - 1 ? '1px solid #f5f5f4' : 'none' }}>
                      <span style={{ width: 18, height: 2, flexShrink: 0, borderRadius: 1, background: e.color || '#d6d3d1', display: 'inline-block' }} />
                      <span style={{ fontSize: 11, color: '#78716c', flexShrink: 0, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.relation.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 11, color: '#44403c', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {other?.label ?? ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Graphify code expand button — only for system nodes with has_graph */}
            {focusedNodeData && (focusedNodeData.node_type || focusedNodeData.type) === 'system' && focusedNodeData.has_graph && focusedNodeData.rawId && (
              /* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
               * Code-graph expand/collapse chrome: violet → teal+teal-soft+teal-pale border. */
              <div style={{ padding: '0 14px 8px', borderTop: '1px solid #f5f5f4' }}>
                {expandedSystems.has(focusedNodeData.rawId) ? (
                  <button
                    onClick={() => onExpandSystemRequest?.(null)}
                    style={{ width: '100%', background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>Collapse code graph</span>
                    <span>x</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onExpandSystemRequest?.(focusedNodeData.rawId!)}
                    disabled={graphifyLoading === focusedNodeData.rawId}
                    style={{ width: '100%', background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: graphifyLoading === focusedNodeData.rawId ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{graphifyLoading === focusedNodeData.rawId ? 'Loading code...' : 'Expand code graph'}</span>
                    <span>+</span>
                  </button>
                )}
              </div>
            )}
            {/* Explore button */}
            <div style={{ padding: '8px 14px 12px' }}>
              <button
                onClick={() => {
                  if (!focusedNodeData) return;
                  // Tear down replay before re-filtering to avoid orphaned timer race
                  if (replayTimer.current) window.clearInterval(replayTimer.current);
                  setReplayActive(false);
                  setReplayFinished(true);
                  replayEverPlayedRef.current = true;
                  // Re-filter graph to this entity
                  const nt = focusedNodeData.node_type || focusedNodeData.type;
                  if (nt === 'organization') {
                    setSelectedOrg(focusedNodeData.label);
                    setSelectedPerson('');
                  } else {
                    setSelectedPerson(focusedNodeData.label);
                    setSelectedOrg('');
                  }
                  setFocusedNode(null);
                  setDepth(1);
                }}
                style={{
                  width: '100%',
                  background: '#002856',
                  color: 'white',
                  border: 0,
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Explore {focusedNodeData.label}&apos;s network</span>
                <span>-&gt;</span>
              </button>
            </div>
          </div>
        )}
        {graphNodes.length === 0 && !loading ? (
          <div className="absolute inset-0 flex items-center justify-center"><div className="text-stone-400 text-sm">No data{hasFilters ? ' matching filters' : ''}.</div></div>
        ) : (
          <Suspense fallback={<div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a29e' }}>Loading graph…</div>}>
            <ForceGraph2D
              ref={resolvedRef} graphData={{ nodes: graphNodes, links: graphEdges }}
              cooldownTicks={(stablePositions || localHasSettled) ? 0 : 100}
              onEngineStop={() => setLocalHasSettled(true)}
              nodeLabel={(node: any) => [node.label, node.role, node.org].filter(Boolean).join(' - ')}
              onNodeDrag={() => { isDraggingRef.current = true; clearTimeout(dragClearTimer.current); }}
              onNodeDragEnd={() => { dragClearTimer.current = setTimeout(() => { isDraggingRef.current = false; }, 100); }}
              onZoom={() => { isDraggingRef.current = true; clearTimeout(dragClearTimer.current); dragClearTimer.current = setTimeout(() => { isDraggingRef.current = false; }, 200); }}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const nt = node.node_type || node.type || 'person';
                const fontSize = Math.max(11 / globalScale, 3);
                ctx.font = `500 ${fontSize}px 'DM Sans', system-ui, sans-serif`;
                const isFocused = focusedNode === node.id;
                const isSelected = selectedNodeProp != null && node.label === selectedNodeProp.name;
                const r = getNodeSize(nt);
                const alpha = focusedNode && !isFocused ? 0.15 : 1;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(node.x, node.y, isFocused ? r * 1.6 : r, 0, 2 * Math.PI);
                ctx.fillStyle = getNodeColor(nt);
                ctx.fill();
                if (isFocused) { ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 2.5 / globalScale; ctx.stroke(); }
                if (isSelected && !isFocused) { ctx.strokeStyle = '#0d9488'; ctx.lineWidth = 3 / globalScale; ctx.stroke(); }
                if (highlightedNode === node.id) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4 / globalScale; ctx.stroke(); }
                if (nt === 'code_entity') { ctx.globalAlpha = 1; return; }
                const label = node.label;
                const textWidth = ctx.measureText(label).width;
                const labelY = node.y + r + 3;
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.beginPath();
                ctx.roundRect(node.x - textWidth / 2 - 2, labelY - 1, textWidth + 4, fontSize + 2, 2);
                ctx.fill();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = getNodeColor(nt);
                ctx.fillText(label, node.x, labelY);
                ctx.globalAlpha = 1;
              }}
              linkColor={(link: any) => {
                const id = edgeKey(link, edges.findIndex(edge => edge === link));
                if (highlightedEdge === id) return '#facc15';
                return focusedNode ? ((link.source?.id === focusedNode || link.target?.id === focusedNode) ? (link.color || '#d6d3d1') : 'rgba(214,211,209,0.12)') : link.color || '#d6d3d1';
              }}
              linkWidth={(link: any) => {
                const id = edgeKey(link, edges.findIndex(edge => edge === link));
                if (highlightedEdge === id) return 3;
                return focusedNode ? ((link.source?.id === focusedNode || link.target?.id === focusedNode) ? 2 : 0.3) : 0.8;
              }}
              linkDirectionalParticles={(link: any) => focusedNode ? ((link.source?.id === focusedNode || link.target?.id === focusedNode) ? 2 : 0) : 0}
              linkDirectionalParticleSpeed={0.005} linkDirectionalParticleWidth={2}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={0.88}
              linkDirectionalArrowColor={(link: any) => link.color || '#d6d3d1'}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => { if (!isDraggingRef.current) { setFocusedNode(null); onNodeSelectChange?.(null); } }}
              backgroundColor="transparent" d3AlphaDecay={0.03}
            />
          </Suspense>
        )}

        {/* Relation type legend — bottom left, only shows types present in graph */}
        {filters.relationTypes.length > 0 && (() => {
          const legendTypes = filters.relationTypes.filter(r => getRelationColor(r));
          if (legendTypes.length === 0) return null;
          return (
            <div style={{
              position: 'absolute', bottom: 16, left: 16, zIndex: 10,
              background: 'rgba(255,255,255,0.92)', border: '1px solid #e7e5e4',
              borderRadius: 8, padding: '8px 12px',
              backdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {legendTypes.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 2, background: getRelationColor(r), borderRadius: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#57534e', whiteSpace: 'nowrap' }}>
                    {RELATION_LABELS[r.toLowerCase().trim()] ?? r.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
