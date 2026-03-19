import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';
import { findPerson, resolveOrg } from '../extraction/resolver.js';

export function handleAddPerson(db: DbAdapter, args: {
  name: string;
  role?: string;
  org?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
}) {
  const { name, role, org, email, phone, linkedin, notes } = args;

  if (!name || name.trim().length < 2) {
    return textResult({ error: 'Name is required (at least 2 characters).' });
  }

  // Check for existing person (fuzzy match)
  const existing = findPerson(db, name);
  if (existing && existing.score >= 0.85) {
    // Update existing person with any new info
    const updates: string[] = [];
    const params: unknown[] = [];

    const current = db.get<Record<string, unknown>>('SELECT * FROM people WHERE id = ?', [existing.id]);

    if (role && !current?.role) { updates.push('role = ?'); params.push(role); }
    if (email && !current?.email) { updates.push('email = ?'); params.push(email); }
    if (phone && !current?.phone) { updates.push('phone = ?'); params.push(phone); }
    if (linkedin && !current?.linkedin) { updates.push('linkedin = ?'); params.push(linkedin); }
    if (notes) { updates.push("notes = CASE WHEN notes IS NULL THEN ? ELSE notes || '\n' || ? END"); params.push(notes, notes); }

    if (org && !current?.org_id) {
      const orgId = resolveOrg(db, org);
      updates.push('org_id = ?');
      params.push(orgId);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(existing.id);
      db.run(`UPDATE people SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = db.get<Record<string, unknown>>(
      `SELECT p.*, o.name as org_name FROM people p LEFT JOIN organizations o ON p.org_id = o.id WHERE p.id = ?`,
      [existing.id],
    );

    return textResult({
      status: 'existing',
      message: `Found existing person "${existing.name}" (id: ${existing.id})${updates.length > 0 ? ' — updated with new info' : ''}.`,
      person: updated,
    });
  }

  // Create new person
  const orgId = org ? resolveOrg(db, org) : null;

  const result = db.run(
    'INSERT INTO people (name, role, org_id, email, phone, linkedin, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name.trim(), role || null, orgId, email || null, phone || null, linkedin || null, notes || null],
  );

  // Create works_at relationship if org was provided
  if (orgId) {
    db.run(
      'INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation) VALUES (?, ?, ?, ?, ?)',
      ['person', result.lastInsertRowid, 'organization', orgId, 'works_at'],
    );
  }

  const created = db.get<Record<string, unknown>>(
    `SELECT p.*, o.name as org_name FROM people p LEFT JOIN organizations o ON p.org_id = o.id WHERE p.id = ?`,
    [result.lastInsertRowid],
  );

  return textResult({
    status: 'created',
    message: `Created person "${name}" (id: ${result.lastInsertRowid}).`,
    person: created,
  });
}
