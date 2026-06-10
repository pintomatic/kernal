/* Aurora violet retired 2026-05-30 in Mosaic.2 M8.
 * See code/blekk/dashboard/src/mosaic.css for the canonical palette
 * (--bg / --ink / --teal / --teal-2 + status). The node-color rainbow
 * collapses to neutral + teal + status: identity reads from the icon and
 * label, not from a per-class hue. `system` was the only violet leak — it
 * now resolves to a neutral ink-3 stone tone consistent with other generic
 * asset classes. The other node colors are kept (they're warm-stone/teal-
 * compatible and the Phase 0 design pass explicitly preserved them). */
export const GRAPH_NODE_CONFIG = {
  person:       { color: '#009AD7', nodeSize: 6 },
  organization: { color: '#002856', nodeSize: 8 },
  goal:         { color: '#16A34A', nodeSize: 7 },
  project:      { color: '#D97706', nodeSize: 7 },
  deal:         { color: '#B45309', nodeSize: 8 },
  system:       { color: '#78716c', nodeSize: 9 }, // aurora violet retired (see file header)
  code_entity:  { color: '#9CA3AF', nodeSize: 3 },
} as const;

export type NodeType = keyof typeof GRAPH_NODE_CONFIG;

export function getNodeColor(type: string): string {
  return GRAPH_NODE_CONFIG[type as NodeType]?.color ?? '#64748b';
}

export function getNodeSize(type: string): number {
  return GRAPH_NODE_CONFIG[type as NodeType]?.nodeSize ?? 5;
}
