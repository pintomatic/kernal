import { useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useApi, type GraphData } from '../hooks/useKernalApi';

const NODE_COLORS: Record<string, string> = {
  person: '#3b82f6',
  organization: '#8b5cf6',
};

const RELATION_COLORS: Record<string, string> = {
  works_at: '#6b7280',
  met_with: '#22c55e',
  introduced: '#f59e0b',
  manages: '#ef4444',
  reports_to: '#ef4444',
  knows: '#06b6d4',
  participated_in: '#6b7280',
};

export default function NetworkGraph() {
  const { data, loading, error } = useApi<GraphData>('/api/dashboard/graph');
  const fgRef = useRef<any>();

  const graphData = data ? {
    nodes: data.nodes.map(n => ({
      ...n,
      color: NODE_COLORS[n.type] || '#6b7280',
      val: n.type === 'organization' ? 8 : 5,
    })),
    links: data.edges.map(e => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
      color: RELATION_COLORS[e.relation] || '#374151',
    })),
  } : { nodes: [], links: [] };

  const handleNodeClick = useCallback((node: any) => {
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 500);
      fgRef.current.zoom(3, 500);
    }
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorCard message={error} />;
  if (!data || data.nodes.length === 0) return <EmptyState message="No network data yet. Start remembering interactions." />;

  return (
    <div className="relative w-full h-[calc(100vh-12rem)] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
      <div className="absolute top-4 left-4 z-10 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> People</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-violet-500 inline-block" /> Organizations</span>
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeLabel={(node: any) => {
          const parts = [node.label];
          if (node.role) parts.push(node.role);
          if (node.org) parts.push(node.org);
          return parts.join(' — ');
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.label;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;

          // Node circle
          const r = node.type === 'organization' ? 6 : 4;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();

          // Label
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#e4e4e7';
          ctx.fillText(label, node.x, node.y + r + 2);
        }}
        linkColor={(link: any) => link.color || '#374151'}
        linkWidth={1}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        onNodeClick={handleNodeClick}
        backgroundColor="transparent"
        width={undefined}
        height={undefined}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="w-full h-[calc(100vh-12rem)] rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
      <div className="text-zinc-500 animate-pulse">Loading network graph...</div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="w-full p-6 rounded-xl border border-red-900/50 bg-red-950/20 text-red-400">
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="w-full h-[calc(100vh-12rem)] rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
      <div className="text-zinc-500">{message}</div>
    </div>
  );
}
