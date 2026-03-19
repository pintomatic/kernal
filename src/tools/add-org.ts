import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';
import { findOrg } from '../extraction/resolver.js';

export function handleAddOrg(db: DbAdapter, args: {
  name: string;
  industry?: string;
  type?: string;
  website?: string;
  notes?: string;
}) {
  const { name, industry, type, website, notes } = args;

  if (!name || name.trim().length < 2) {
    return textResult({ error: 'Name is required (at least 2 characters).' });
  }

  // Check for existing org (fuzzy match)
  const existing = findOrg(db, name);
  if (existing && existing.score >= 0.85) {
    const updates: string[] = [];
    const params: unknown[] = [];

    const current = db.get<Record<string, unknown>>('SELECT * FROM organizations WHERE id = ?', [existing.id]);

    if (industry && !current?.industry) { updates.push('industry = ?'); params.push(industry); }
    if (type && !current?.type) { updates.push('type = ?'); params.push(type); }
    if (website && !current?.website) { updates.push('website = ?'); params.push(website); }
    if (notes) { updates.push("notes = CASE WHEN notes IS NULL THEN ? ELSE notes || '\n' || ? END"); params.push(notes, notes); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(existing.id);
      db.run(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = db.get('SELECT * FROM organizations WHERE id = ?', [existing.id]);

    return textResult({
      status: 'existing',
      message: `Found existing organization "${existing.name}" (id: ${existing.id})${updates.length > 0 ? ' — updated with new info' : ''}.`,
      organization: updated,
    });
  }

  const result = db.run(
    'INSERT INTO organizations (name, industry, type, website, notes) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), industry || null, type || null, website || null, notes || null],
  );

  const created = db.get('SELECT * FROM organizations WHERE id = ?', [result.lastInsertRowid]);

  return textResult({
    status: 'created',
    message: `Created organization "${name}" (id: ${result.lastInsertRowid}).`,
    organization: created,
  });
}
