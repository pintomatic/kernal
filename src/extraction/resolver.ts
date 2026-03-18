import type { DbAdapter } from '../db/adapter.js';

interface MatchResult {
  id: number;
  name: string;
  score: number;
}

/** Normalize a string for comparison: lowercase, trim, collapse whitespace */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Score how well a candidate matches a query (0-1, higher = better) */
function matchScore(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);

  // Exact match
  if (q === c) return 1.0;

  // Substring match
  if (c.includes(q) || q.includes(c)) return 0.9;

  // Check if query matches first or last name
  const qParts = q.split(' ');
  const cParts = c.split(' ');
  if (qParts.length === 1 && cParts.length >= 2) {
    if (cParts[0] === q || cParts[cParts.length - 1] === q) return 0.85;
  }

  // Levenshtein-based similarity
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  const similarity = 1 - dist / maxLen;

  return similarity;
}

/** Find best matching person by name */
export function findPerson(db: DbAdapter, name: string): MatchResult | null {
  const people = db.all<{ id: number; name: string }>('SELECT id, name FROM people');
  return findBestMatch(name, people);
}

/** Find best matching organization by name */
export function findOrg(db: DbAdapter, name: string): MatchResult | null {
  const orgs = db.all<{ id: number; name: string }>('SELECT id, name FROM organizations');
  return findBestMatch(name, orgs);
}

/** Find best matching topic by name */
export function findTopic(db: DbAdapter, name: string): MatchResult | null {
  const topics = db.all<{ id: number; name: string }>('SELECT id, name FROM topics');
  return findBestMatch(name, topics);
}

function findBestMatch(query: string, candidates: Array<{ id: number; name: string }>): MatchResult | null {
  if (candidates.length === 0) return null;

  let best: MatchResult | null = null;
  for (const c of candidates) {
    const score = matchScore(query, c.name);
    if (score >= 0.7 && (!best || score > best.score)) {
      best = { id: c.id, name: c.name, score };
    }
  }
  return best;
}

/** Get or create an organization, returning its ID */
export function resolveOrg(db: DbAdapter, name: string, type?: string): number {
  const match = findOrg(db, name);
  if (match && match.score >= 0.85) return match.id;

  const result = db.run(
    'INSERT INTO organizations (name, type) VALUES (?, ?)',
    [name.trim(), type || null],
  );
  return result.lastInsertRowid;
}

/** Get or create a person, returning their ID */
export function resolvePerson(db: DbAdapter, name: string, orgName?: string, role?: string): number {
  const match = findPerson(db, name);
  if (match && match.score >= 0.85) {
    // Update role/org if provided and missing
    if (role || orgName) {
      const person = db.get<{ role: string | null; org_id: number | null }>(
        'SELECT role, org_id FROM people WHERE id = ?',
        [match.id],
      );
      if (person) {
        const updates: string[] = [];
        const params: unknown[] = [];
        if (role && !person.role) {
          updates.push('role = ?');
          params.push(role);
        }
        if (orgName && !person.org_id) {
          const orgId = resolveOrg(db, orgName);
          updates.push('org_id = ?');
          params.push(orgId);
        }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          params.push(match.id);
          db.run(`UPDATE people SET ${updates.join(', ')} WHERE id = ?`, params);
        }
      }
    }
    return match.id;
  }

  const orgId = orgName ? resolveOrg(db, orgName) : null;
  const result = db.run(
    'INSERT INTO people (name, role, org_id) VALUES (?, ?, ?)',
    [name.trim(), role || null, orgId],
  );
  return result.lastInsertRowid;
}

/** Get or create a topic, returning its ID */
export function resolveTopic(db: DbAdapter, name: string): number {
  const match = findTopic(db, name);
  if (match && match.score >= 0.85) return match.id;

  const result = db.run('INSERT INTO topics (name) VALUES (?)', [name.trim()]);
  return result.lastInsertRowid;
}

/** Create a relationship if it doesn't exist */
export function createRelationship(
  db: DbAdapter,
  sourceType: string,
  sourceId: number,
  targetType: string,
  targetId: number,
  relation: string,
): void {
  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    [sourceType, sourceId, targetType, targetId, relation],
  );
}
