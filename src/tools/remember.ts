import type { DbAdapter } from '../db/adapter.js';
import { extractAndStore } from '../extraction/prompt.js';
import { textResult } from '../utils/format.js';

export function handleRemember(db: DbAdapter, args: { text: string }) {
  const { text } = args;
  if (!text || text.trim().length === 0) {
    return textResult({ error: 'No text provided. Please provide text to extract entities from.' });
  }

  const result = extractAndStore(db, text);

  const summary: string[] = [];
  summary.push('## Extraction Summary\n');

  if (result.people.length > 0) {
    summary.push('**People:**');
    for (const p of result.people) {
      const parts: string[] = [];
      if (p.role) parts.push(p.role);
      if (p.org) parts.push(`at ${p.org}`);
      const details = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
      const badge = p.status === 'matched' ? '`existing`' : '`new`';
      summary.push(`- ${p.name}${details} ${badge}`);
    }
    summary.push('');
  }

  if (result.organizations.length > 0) {
    summary.push('**Organizations:**');
    for (const o of result.organizations) {
      const badge = o.status === 'matched' ? '`existing`' : '`new`';
      summary.push(`- ${o.name} ${badge}`);
    }
    summary.push('');
  }

  if (result.topics.length > 0) {
    summary.push('**Topics:**');
    for (const t of result.topics) {
      const badge = t.status === 'matched' ? '`existing`' : '`new`';
      summary.push(`- ${t.name} ${badge}`);
    }
    summary.push('');
  }

  if (result.actions.length > 0) {
    summary.push('**Action items:**');
    for (const a of result.actions) {
      const owner = a.owner ? ` (→ ${a.owner})` : '';
      const due = a.due_date ? ` [due: ${a.due_date}]` : '';
      summary.push(`- ${a.title}${owner}${due}`);
    }
    summary.push('');
  }

  if (result.activity) {
    summary.push(`**Activity logged:** ${result.activity.title} _(${result.activity.type})_`);
    if (result.activity.date) summary.push(`**Date:** ${result.activity.date}`);
    summary.push('');
  }

  summary.push(`**${result.relationships} relationships** created or confirmed.`);

  // Show entity counts
  const counts = {
    people: db.get<{ c: number }>('SELECT COUNT(*) as c FROM people')?.c || 0,
    organizations: db.get<{ c: number }>('SELECT COUNT(*) as c FROM organizations')?.c || 0,
    activities: db.get<{ c: number }>('SELECT COUNT(*) as c FROM activities')?.c || 0,
  };
  summary.push(`\n_Knowledge base: ${counts.people} people, ${counts.organizations} orgs, ${counts.activities} activities._`);

  summary.push('\n*Review the above. If anything looks wrong, use `kernal_correct` to fix it.*');

  return textResult(summary.join('\n'));
}
