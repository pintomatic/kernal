/** Format a tool response as MCP text content */
export function textResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

/** Format a date for display */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'unknown';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Truncate text to a max length */
export function truncate(text: string | null | undefined, max: number = 200): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}
