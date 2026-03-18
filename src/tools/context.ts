import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handleContext(db: DbAdapter, args: { name: string }) {
  const { name } = args;
  if (!name || name.trim().length === 0) {
    return textResult({ error: 'Please provide a person or organization name.' });
  }

  const q = name.trim();
  const likeQ = `%${q}%`;

  // Try person first
  const person = db.get<Record<string, unknown>>(
    `SELECT p.*, o.name as org_name FROM people p
     LEFT JOIN organizations o ON p.org_id = o.id
     WHERE p.name LIKE ? ORDER BY p.updated_at DESC LIMIT 1`,
    [likeQ],
  );

  if (person) {
    return buildPersonBriefing(db, person);
  }

  // Try organization
  const org = db.get<Record<string, unknown>>(
    `SELECT * FROM organizations WHERE name LIKE ? ORDER BY updated_at DESC LIMIT 1`,
    [likeQ],
  );

  if (org) {
    return buildOrgBriefing(db, org);
  }

  return textResult(`No person or organization found matching "${q}".`);
}

function buildPersonBriefing(db: DbAdapter, person: Record<string, unknown>) {
  const briefing: string[] = [];
  const personId = person.id as number;

  // ── Profile ──
  briefing.push(`# ${person.name}`);
  if (person.role) briefing.push(`**Role:** ${person.role}`);
  if (person.org_name) briefing.push(`**Organization:** ${person.org_name}`);
  if (person.email) briefing.push(`**Email:** ${person.email}`);
  if (person.phone) briefing.push(`**Phone:** ${person.phone}`);
  if (person.linkedin) briefing.push(`**LinkedIn:** ${person.linkedin}`);
  if (person.notes) briefing.push(`**Notes:** ${person.notes}`);
  briefing.push('');

  // ── Relationship Stats ──
  const stats = db.get<{ total: number; first_date: string | null; last_date: string | null }>(
    `SELECT COUNT(*) as total,
       MIN(a.date) as first_date,
       MAX(a.date) as last_date
     FROM activities a
     JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
     WHERE r.source_type = 'person' AND r.source_id = ?`,
    [personId],
  );

  if (stats && stats.total > 0) {
    briefing.push('## Relationship Summary');
    briefing.push(`- **Total interactions:** ${stats.total}`);
    if (stats.first_date) briefing.push(`- **First contact:** ${stats.first_date}`);
    if (stats.last_date) briefing.push(`- **Last contact:** ${stats.last_date}`);

    // Days since last contact
    if (stats.last_date) {
      const daysSince = Math.floor((Date.now() - new Date(stats.last_date).getTime()) / 86400000);
      if (daysSince === 0) briefing.push(`- **Status:** Contacted today`);
      else if (daysSince === 1) briefing.push(`- **Status:** Contacted yesterday`);
      else if (daysSince <= 7) briefing.push(`- **Status:** Active (${daysSince} days ago)`);
      else if (daysSince <= 30) briefing.push(`- **Status:** Recent (${daysSince} days ago)`);
      else if (daysSince <= 90) briefing.push(`- **Status:** Cooling (${daysSince} days ago)`);
      else briefing.push(`- **Status:** Cold (${daysSince} days ago — consider reaching out)`);
    }

    // Interaction breakdown by type
    const typeBreakdown = db.all<{ type: string; count: number }>(
      `SELECT a.type, COUNT(*) as count FROM activities a
       JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
       WHERE r.source_type = 'person' AND r.source_id = ?
       GROUP BY a.type ORDER BY count DESC`,
      [personId],
    );
    if (typeBreakdown.length > 0) {
      const breakdown = typeBreakdown.map(t => `${t.type}: ${t.count}`).join(', ');
      briefing.push(`- **Interaction types:** ${breakdown}`);
    }
    briefing.push('');
  }

  // ── Interaction Timeline (last 15) ──
  const activities = db.all<Record<string, unknown>>(
    `SELECT a.* FROM activities a
     JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
     WHERE r.source_type = 'person' AND r.source_id = ?
     ORDER BY a.date DESC, a.created_at DESC LIMIT 15`,
    [personId],
  );

  if (activities.length > 0) {
    briefing.push('## Interaction Timeline');
    for (const act of activities) {
      const date = (act.date as string) || 'no date';
      const type = (act.type as string) || 'other';
      const title = (act.title as string) || type;
      briefing.push(`- **${date}** — ${title} _(${type})_`);

      // Show who else was there
      const otherParticipants = db.all<{ name: string; role: string | null }>(
        `SELECT p.name, p.role FROM people p
         JOIN relationships r ON r.source_id = p.id AND r.source_type = 'person'
         WHERE r.target_type = 'activity' AND r.target_id = ? AND p.id != ?`,
        [act.id, personId],
      );
      if (otherParticipants.length > 0) {
        const names = otherParticipants.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ');
        briefing.push(`  Also present: ${names}`);
      }

      // Show summary excerpt
      if (act.summary) {
        const summary = act.summary as string;
        const short = summary.length > 200 ? summary.slice(0, 200) + '...' : summary;
        briefing.push(`  > ${short}`);
      }
    }
    briefing.push('');
  }

  // ── Open Actions ──
  const actions = db.all<Record<string, unknown>>(
    `SELECT * FROM actions WHERE owner_id = ? AND status = 'open'
     ORDER BY CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END, due_date ASC`,
    [personId],
  );

  if (actions.length > 0) {
    briefing.push('## Open Actions');
    for (const act of actions) {
      const due = act.due_date ? ` (due: ${act.due_date})` : '';
      briefing.push(`- [ ] ${act.title}${due}`);
    }
    briefing.push('');
  }

  // Also show actions that mention this person (not just owned)
  const firstName = (person.name as string).split(' ')[0];
  const mentionedActions = db.all<Record<string, unknown>>(
    `SELECT a.*, p.name as owner_name FROM actions a
     LEFT JOIN people p ON a.owner_id = p.id
     WHERE a.status = 'open' AND a.owner_id != ? AND a.title LIKE ?
     ORDER BY a.due_date ASC LIMIT 5`,
    [personId, `%${firstName}%`],
  );

  if (mentionedActions.length > 0) {
    briefing.push('## Actions Mentioning This Person');
    for (const act of mentionedActions) {
      const due = act.due_date ? ` (due: ${act.due_date})` : '';
      const owner = act.owner_name ? ` — assigned to ${act.owner_name}` : '';
      briefing.push(`- [ ] ${act.title}${due}${owner}`);
    }
    briefing.push('');
  }

  // ── Related People (via shared activities, same org, or direct relationships) ──
  const relatedPeople = db.all<Record<string, unknown>>(
    `SELECT DISTINCT p.id, p.name, p.role, o.name as org_name,
       (SELECT COUNT(*) FROM relationships r1
        JOIN relationships r2 ON r1.target_id = r2.target_id AND r1.target_type = r2.target_type
        WHERE r1.source_type = 'person' AND r1.source_id = ?
        AND r2.source_type = 'person' AND r2.source_id = p.id
        AND r1.target_type = 'activity') as shared_activities
     FROM people p
     LEFT JOIN organizations o ON p.org_id = o.id
     WHERE p.id != ? AND (
       p.org_id = ? OR
       p.id IN (
         SELECT r2.source_id FROM relationships r1
         JOIN relationships r2 ON r1.target_id = r2.target_id AND r1.target_type = r2.target_type
         WHERE r1.source_type = 'person' AND r1.source_id = ?
         AND r2.source_type = 'person' AND r2.source_id != ?
       ) OR
       p.id IN (
         SELECT target_id FROM relationships WHERE source_type = 'person' AND source_id = ? AND target_type = 'person'
       ) OR
       p.id IN (
         SELECT source_id FROM relationships WHERE target_type = 'person' AND target_id = ? AND source_type = 'person'
       )
     )
     ORDER BY shared_activities DESC LIMIT 15`,
    [personId, personId, person.org_id || -1, personId, personId, personId, personId],
  );

  if (relatedPeople.length > 0) {
    briefing.push('## Network');
    for (const rp of relatedPeople) {
      const details = [rp.role, rp.org_name].filter(Boolean).join(', ');
      const shared = (rp.shared_activities as number) > 0 ? ` — ${rp.shared_activities} shared interactions` : '';
      briefing.push(`- **${rp.name}**${details ? ` (${details})` : ''}${shared}`);

      // Show direct relationship type if any
      const directRel = db.get<{ relation: string }>(
        `SELECT relation FROM relationships
         WHERE source_type = 'person' AND target_type = 'person'
         AND ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))
         LIMIT 1`,
        [personId, rp.id, rp.id, personId],
      );
      if (directRel) {
        briefing.push(`  Relationship: ${directRel.relation.replace(/_/g, ' ')}`);
      }
    }
    briefing.push('');
  }

  // ── Topics Discussed ──
  const topics = db.all<{ name: string; count: number }>(
    `SELECT t.name, COUNT(*) as count FROM topics t
     JOIN relationships r1 ON r1.source_type = 'topic' AND r1.source_id = t.id AND r1.target_type = 'activity'
     JOIN relationships r2 ON r2.target_id = r1.target_id AND r2.target_type = 'activity'
     WHERE r2.source_type = 'person' AND r2.source_id = ?
     GROUP BY t.id ORDER BY count DESC LIMIT 10`,
    [personId],
  );

  if (topics.length > 0) {
    briefing.push('## Topics Discussed');
    briefing.push(topics.map(t => t.count > 1 ? `${t.name} (${t.count}x)` : t.name).join(', '));
    briefing.push('');
  }

  // ── Key Context (from notes linked to their activities) ──
  const keyNotes = db.all<{ content: string; date: string | null }>(
    `SELECT n.content, a.date FROM notes n
     JOIN relationships rn ON rn.source_type = 'note' AND rn.source_id = n.id AND rn.target_type = 'activity'
     JOIN activities a ON a.id = rn.target_id
     JOIN relationships rp ON rp.target_id = rn.target_id AND rp.target_type = 'activity'
     WHERE rp.source_type = 'person' AND rp.source_id = ?
     ORDER BY a.date DESC LIMIT 5`,
    [personId],
  );

  if (keyNotes.length > 0) {
    briefing.push('## Recent Notes');
    for (const note of keyNotes) {
      const date = note.date || 'undated';
      const content = note.content.length > 300 ? note.content.slice(0, 300) + '...' : note.content;
      briefing.push(`**${date}:** ${content}`);
      briefing.push('');
    }
  }

  return textResult(briefing.join('\n'));
}

function buildOrgBriefing(db: DbAdapter, org: Record<string, unknown>) {
  const briefing: string[] = [];
  const orgId = org.id as number;

  // ── Profile ──
  briefing.push(`# ${org.name}`);
  if (org.industry) briefing.push(`**Industry:** ${org.industry}`);
  if (org.type) briefing.push(`**Type:** ${org.type}`);
  if (org.website) briefing.push(`**Website:** ${org.website}`);
  if (org.notes) briefing.push(`**Notes:** ${org.notes}`);
  briefing.push('');

  // ── Engagement Stats ──
  const stats = db.get<{ total: number; first_date: string | null; last_date: string | null }>(
    `SELECT COUNT(*) as total,
       MIN(a.date) as first_date,
       MAX(a.date) as last_date
     FROM activities a
     JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
     WHERE r.source_type = 'organization' AND r.source_id = ?`,
    [orgId],
  );

  if (stats && stats.total > 0) {
    briefing.push('## Engagement Summary');
    briefing.push(`- **Total interactions:** ${stats.total}`);
    if (stats.first_date) briefing.push(`- **First interaction:** ${stats.first_date}`);
    if (stats.last_date) {
      briefing.push(`- **Last interaction:** ${stats.last_date}`);
      const daysSince = Math.floor((Date.now() - new Date(stats.last_date).getTime()) / 86400000);
      if (daysSince <= 7) briefing.push(`- **Status:** Active`);
      else if (daysSince <= 30) briefing.push(`- **Status:** Recent`);
      else if (daysSince <= 90) briefing.push(`- **Status:** Cooling`);
      else briefing.push(`- **Status:** Cold (${daysSince} days — consider re-engaging)`);
    }
    briefing.push('');
  }

  // ── People at this org ──
  const people = db.all<Record<string, unknown>>(
    `SELECT p.*,
       (SELECT COUNT(*) FROM relationships r
        JOIN activities a ON r.target_id = a.id AND r.target_type = 'activity'
        WHERE r.source_type = 'person' AND r.source_id = p.id) as interaction_count,
       (SELECT MAX(a.date) FROM activities a
        JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
        WHERE r.source_type = 'person' AND r.source_id = p.id) as last_contact
     FROM people p WHERE p.org_id = ?
     ORDER BY interaction_count DESC, p.updated_at DESC`,
    [orgId],
  );

  if (people.length > 0) {
    briefing.push('## Key People');
    for (const p of people) {
      const role = p.role ? ` — ${p.role}` : '';
      const interactions = (p.interaction_count as number) > 0 ? ` (${p.interaction_count} interactions)` : '';
      const lastContact = p.last_contact ? `, last: ${p.last_contact}` : '';
      briefing.push(`- **${p.name}**${role}${interactions}${lastContact}`);
    }
    briefing.push('');
  }

  // ── Interaction Timeline ──
  const activities = db.all<Record<string, unknown>>(
    `SELECT a.* FROM activities a
     JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
     WHERE r.source_type = 'organization' AND r.source_id = ?
     ORDER BY a.date DESC, a.created_at DESC LIMIT 15`,
    [orgId],
  );

  if (activities.length > 0) {
    briefing.push('## Interaction Timeline');
    for (const act of activities) {
      const date = (act.date as string) || 'no date';
      const type = (act.type as string) || 'other';
      const title = (act.title as string) || type;
      briefing.push(`- **${date}** — ${title} _(${type})_`);

      // Show participants
      const participants = db.all<{ name: string; role: string | null }>(
        `SELECT p.name, p.role FROM people p
         JOIN relationships r ON r.source_id = p.id AND r.source_type = 'person'
         WHERE r.target_type = 'activity' AND r.target_id = ?`,
        [act.id],
      );
      if (participants.length > 0) {
        const names = participants.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ');
        briefing.push(`  Participants: ${names}`);
      }

      if (act.summary) {
        const summary = act.summary as string;
        const short = summary.length > 200 ? summary.slice(0, 200) + '...' : summary;
        briefing.push(`  > ${short}`);
      }
    }
    briefing.push('');
  }

  // ── Open Actions for people at this org ──
  const personIds = people.map((p: any) => p.id as number);
  if (personIds.length > 0) {
    const placeholders = personIds.map(() => '?').join(',');
    const actions = db.all<Record<string, unknown>>(
      `SELECT a.*, p.name as owner_name FROM actions a
       JOIN people p ON a.owner_id = p.id
       WHERE a.owner_id IN (${placeholders}) AND a.status = 'open'
       ORDER BY CASE WHEN a.due_date IS NOT NULL THEN 0 ELSE 1 END, a.due_date ASC`,
      personIds,
    );

    if (actions.length > 0) {
      briefing.push('## Open Actions');
      for (const act of actions) {
        const due = act.due_date ? ` (due: ${act.due_date})` : '';
        briefing.push(`- [ ] ${act.title} — ${act.owner_name}${due}`);
      }
      briefing.push('');
    }
  }

  // ── Topics ──
  const topics = db.all<{ name: string; count: number }>(
    `SELECT t.name, COUNT(*) as count FROM topics t
     JOIN relationships r1 ON r1.source_type = 'topic' AND r1.source_id = t.id AND r1.target_type = 'activity'
     JOIN relationships r2 ON r2.target_id = r1.target_id AND r2.target_type = 'activity'
     WHERE r2.source_type = 'organization' AND r2.source_id = ?
     GROUP BY t.id ORDER BY count DESC LIMIT 10`,
    [orgId],
  );

  if (topics.length > 0) {
    briefing.push('## Topics');
    briefing.push(topics.map(t => t.count > 1 ? `${t.name} (${t.count}x)` : t.name).join(', '));
    briefing.push('');
  }

  return textResult(briefing.join('\n'));
}
