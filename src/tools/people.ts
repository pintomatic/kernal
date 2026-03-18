import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handlePeople(db: DbAdapter, args: { name?: string; org?: string; role?: string; limit?: number }) {
  const { name, org, role, limit = 50 } = args;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (name) {
    conditions.push('p.name LIKE ?');
    params.push(`%${name}%`);
  }
  if (org) {
    conditions.push('o.name LIKE ?');
    params.push(`%${org}%`);
  }
  if (role) {
    conditions.push('p.role LIKE ?');
    params.push(`%${role}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 200));

  const people = db.all(
    `SELECT p.*, o.name as org_name FROM people p
     LEFT JOIN organizations o ON p.org_id = o.id
     ${where}
     ORDER BY p.updated_at DESC LIMIT ?`,
    params,
  );

  if (people.length === 0) {
    return textResult('No contacts found matching the criteria.');
  }

  return textResult({
    count: people.length,
    people,
  });
}
