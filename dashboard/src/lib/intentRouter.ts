export type View = 'overview' | 'network' | 'timeline' | 'actions';

export interface RouteResult {
  view: View;
  params: Record<string, string>;
}

export function routeIntent(input: string): RouteResult {
  const lower = input.toLowerCase().trim();

  if (lower.match(/network|graph|connections?|relationships?|who.*(know|connected)|map|visuali/))
    return { view: 'network', params: {} };

  if (lower.match(/timeline|history|interactions?|when|chrono/)) {
    const entity = extractEntity(input);
    return { view: 'timeline', params: entity ? { entity } : {} };
  }

  if (lower.match(/action|follow[- ]?up|todo|to-do|overdue|should.*(do|reach)|pending|tasks?/))
    return { view: 'actions', params: {} };

  if (lower.match(/overview|dashboard|summary|stats|home/))
    return { view: 'overview', params: {} };

  // Default: if it looks like a name/entity, show timeline
  const entity = extractEntity(input);
  if (entity) return { view: 'timeline', params: { entity } };

  return { view: 'overview', params: {} };
}

function extractEntity(input: string): string | null {
  // Try to find a capitalized proper noun (2+ words)
  const match = input.match(/(?:about|with|for|at|from)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (match) return match[1];

  // Try single capitalized word that isn't a command
  const single = input.match(/\b([A-Z][a-z]{2,})\b/);
  if (single && !['Show', 'Tell', 'What', 'Who', 'How', 'When', 'Give'].includes(single[1])) {
    return single[1];
  }

  return null;
}
