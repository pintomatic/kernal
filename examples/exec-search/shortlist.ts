#!/usr/bin/env node

/**
 * Shortlist Rationale Generator
 * Queries the Kernal graph, scores candidates, and generates:
 *   - shortlist-rationale.md (client-facing)
 *   - shortlist-audit.md (internal audit trail with source IDs)
 *
 * Usage:
 *   npx tsx examples/exec-search/shortlist.ts \
 *     --assignment "Vestra Media CFO" \
 *     --candidates "Astrid Berg,Markus Blom"
 *     [--db path/to/kernal.db]
 */

import { createLocalDb } from '../../src/db/local.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

// ── Parse CLI args ──

function parseArgs(): { assignment: string; candidates: string[]; dbPath: string } {
  const args = process.argv.slice(2);
  let assignment = '';
  let candidates: string[] = [];
  let dbPath = 'examples/exec-search/kernal-exec.db';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--assignment' && args[i + 1]) {
      assignment = args[++i];
    } else if (args[i] === '--candidates' && args[i + 1]) {
      candidates = args[++i].split(',').map(c => c.trim());
    } else if (args[i] === '--db' && args[i + 1]) {
      dbPath = args[++i];
    }
  }

  if (!assignment) {
    console.error('Error: --assignment is required');
    console.error('Usage: npx tsx examples/exec-search/shortlist.ts --assignment "Vestra Media CFO" --candidates "Astrid Berg,Markus Blom"');
    process.exit(1);
  }
  if (candidates.length === 0) {
    console.error('Error: --candidates is required (comma-separated names)');
    process.exit(1);
  }

  return { assignment, candidates, dbPath };
}

// ── DB row types ──

interface NoteRow { id: number; content: string; created_at: string }
interface PersonRow { id: number; name: string; role: string | null; org_id: number | null; email: string | null; linkedin: string | null; notes: string | null }
interface OrgRow { id: number; name: string; industry: string | null; type: string | null }
interface ActivityRow { id: number; type: string; title: string; date: string | null; summary: string | null; notes: string | null }
interface RelRow { id: number; source_type: string; source_id: number; target_type: string; target_id: number; relation: string }

// ── Candidate assessment structure ──

interface CandidateAssessment {
  person: PersonRow;
  org: OrgRow | undefined;
  activities: ActivityRow[];
  notes: NoteRow[];
  relationships: RelRow[];
  rejections: NoteRow[];
  shortlists: NoteRow[];
  patterns: NoteRow[];
  score: number;
  strengths: string[];
  risks: string[];
  networkConnections: string[];
  fitSummary: string;
  claims: Array<{ claim: string; sourceType: string; sourceId: number; sourceDetail: string }>;
}

// ── Main logic ──

const { assignment, candidates, dbPath } = parseArgs();

console.log(`Shortlist Generator`);
console.log(`Assignment: ${assignment}`);
console.log(`Candidates: ${candidates.join(', ')}`);
console.log(`Database: ${dbPath}\n`);

const db = createLocalDb(dbPath);

// 1. Find the assignment note
const assignmentNotes = db.all<NoteRow>(
  `SELECT * FROM notes WHERE content LIKE ?`,
  [`%[ASSIGNMENT]%${assignment}%`],
);

if (assignmentNotes.length === 0) {
  console.error(`No assignment found matching "${assignment}"`);
  db.close();
  process.exit(1);
}

const assignmentNote = assignmentNotes[0];
console.log(`Found assignment: note.id=${assignmentNote.id}`);

// Extract client org from assignment note
const clientMatch = assignmentNote.content.match(/Client:\s*([^|]+)/);
const clientName = clientMatch ? clientMatch[1].trim() : 'Unknown';
const clientOrg = db.get<OrgRow>(
  `SELECT * FROM organizations WHERE name LIKE ?`,
  [`%${clientName}%`],
);

// 2. Assess each candidate
const assessments: CandidateAssessment[] = [];

for (const candidateName of candidates) {
  console.log(`\nAssessing: ${candidateName}`);

  // 2a. Get person record
  const person = db.get<PersonRow>(
    `SELECT * FROM people WHERE name = ?`,
    [candidateName],
  );

  if (!person) {
    console.warn(`  WARNING: Person "${candidateName}" not found in database, skipping`);
    continue;
  }

  // Get org
  const org = person.org_id
    ? db.get<OrgRow>('SELECT * FROM organizations WHERE id = ?', [person.org_id])
    : undefined;

  // 2b. Get all relationships involving this person
  const relationships = db.all<RelRow>(
    `SELECT * FROM relationships WHERE
     (source_type = 'person' AND source_id = ?) OR
     (target_type = 'person' AND target_id = ?)`,
    [person.id, person.id],
  );

  // 2c. Get all activities involving this person
  const activityIds = db.all<{ source_id: number }>(
    `SELECT source_id FROM relationships WHERE
     target_type = 'person' AND target_id = ? AND source_type = 'activity'
     UNION
     SELECT target_id as source_id FROM relationships WHERE
     source_type = 'person' AND source_id = ? AND target_type = 'activity'`,
    [person.id, person.id],
  );

  const activities: ActivityRow[] = [];
  for (const { source_id } of activityIds) {
    const act = db.get<ActivityRow>('SELECT * FROM activities WHERE id = ?', [source_id]);
    if (act) activities.push(act);
  }

  // Also search activities by name in title/summary
  const nameActivities = db.all<ActivityRow>(
    `SELECT * FROM activities WHERE title LIKE ? OR summary LIKE ?`,
    [`%${candidateName}%`, `%${candidateName}%`],
  );
  for (const act of nameActivities) {
    if (!activities.find(a => a.id === act.id)) {
      activities.push(act);
    }
  }

  // 2d. Get all notes mentioning this person
  const mentionNotes = db.all<NoteRow>(
    `SELECT * FROM notes WHERE content LIKE ?`,
    [`%${candidateName}%`],
  );

  // Also get notes linked via relationships
  const linkedNoteIds = db.all<{ source_id: number }>(
    `SELECT source_id FROM relationships WHERE
     target_type = 'person' AND target_id = ? AND source_type = 'note'`,
    [person.id],
  );
  const linkedNotes: NoteRow[] = [];
  for (const { source_id } of linkedNoteIds) {
    const note = db.get<NoteRow>('SELECT * FROM notes WHERE id = ?', [source_id]);
    if (note && !mentionNotes.find(n => n.id === note.id)) {
      linkedNotes.push(note);
    }
  }

  const allNotes = [...mentionNotes, ...linkedNotes];

  // 2e. Categorize notes
  const rejections = allNotes.filter(n => n.content.startsWith('[REJECTED]'));
  const shortlists = allNotes.filter(n => n.content.startsWith('[SHORTLISTED]'));
  const patterns = db.all<NoteRow>(
    `SELECT * FROM notes WHERE content LIKE '[PATTERN]%' OR content LIKE '[ANTI-PATTERN]%'`,
  );

  // 2f. Build claims with source tracking
  const claims: CandidateAssessment['claims'] = [];
  const strengths: string[] = [];
  const risks: string[] = [];
  const networkConnections: string[] = [];

  // Claims from person record
  if (person.role) {
    claims.push({
      claim: `Current role: ${person.role}`,
      sourceType: 'people',
      sourceId: person.id,
      sourceDetail: `people.id=${person.id}, role field`,
    });
    strengths.push(`Currently ${person.role}${org ? ` at ${org.name}` : ''}`);
  }

  if (person.notes) {
    claims.push({
      claim: `Profile: ${person.notes.substring(0, 100)}...`,
      sourceType: 'people',
      sourceId: person.id,
      sourceDetail: `people.id=${person.id}, notes field`,
    });

    // Extract strengths from person notes
    const notesLower = person.notes.toLowerCase();
    if (notesLower.includes('transformation')) {
      strengths.push('Track record in digital transformation');
    }
    if (notesLower.includes('founder') || notesLower.includes('founded')) {
      strengths.push('Founder/entrepreneurial experience');
    }
    if (notesLower.includes('board')) {
      strengths.push('Board-level experience and communication skills');
    }
    if (notesLower.includes('ceo') || notesLower.includes('cfo') || notesLower.includes('cto')) {
      strengths.push('C-suite experience');
    }
  }

  // Claims from activities
  for (const act of activities) {
    const summary = act.summary || act.title;
    claims.push({
      claim: `Activity: ${act.title} (${act.date || 'no date'})`,
      sourceType: 'activities',
      sourceId: act.id,
      sourceDetail: `activities.id=${act.id}, "${act.title}"`,
    });

    if (summary.includes('positive') || summary.includes('Positive') ||
        summary.includes('Excellent') || summary.includes('Strong fit') ||
        summary.includes('strong fit') || summary.includes('enthusiastic')) {
      strengths.push(`Positive assessment from meeting on ${act.date || 'N/A'}`);
    }
  }

  // Claims from shortlist notes
  for (const note of shortlists) {
    const rationale = note.content.replace(/^\[SHORTLISTED\]\s*/, '').split(':')[1]?.trim();
    if (rationale) {
      claims.push({
        claim: `Previously shortlisted: ${rationale}`,
        sourceType: 'notes',
        sourceId: note.id,
        sourceDetail: `notes.id=${note.id}, [SHORTLISTED] tag`,
      });
      strengths.push(`Previously shortlisted: ${rationale.substring(0, 80)}`);
    }
  }

  // Claims from rejection notes (these are RISKS)
  for (const note of rejections) {
    const reason = note.content.replace(/^\[REJECTED\]\s*/, '').split(':')[1]?.trim();
    if (reason) {
      claims.push({
        claim: `Previously rejected: ${reason}`,
        sourceType: 'notes',
        sourceId: note.id,
        sourceDetail: `notes.id=${note.id}, [REJECTED] tag`,
      });
      risks.push(`Previously rejected for this assignment: ${reason.substring(0, 80)}`);
    }
  }

  // Check for anti-pattern matches
  for (const pattern of patterns) {
    if (pattern.content.startsWith('[ANTI-PATTERN]') && pattern.content.includes('recently left')) {
      // Check if this candidate recently left the client
      const allCandidateNotes = person.notes || '';
      if (allCandidateNotes.includes(clientName) || allCandidateNotes.includes('departed recently')) {
        risks.push(`Anti-pattern match: candidate recently departed from client organization`);
        claims.push({
          claim: `Anti-pattern: recently left client firm`,
          sourceType: 'notes',
          sourceId: pattern.id,
          sourceDetail: `notes.id=${pattern.id}, [ANTI-PATTERN] tag + people.id=${person.id} notes`,
        });
      }
    }
  }

  // Network connections: find people this candidate knows at the client org
  if (clientOrg) {
    const clientPeople = db.all<PersonRow>(
      `SELECT * FROM people WHERE org_id = ?`,
      [clientOrg.id],
    );
    for (const cp of clientPeople) {
      // Check if candidate has a relationship with this person
      const rel = db.get<RelRow>(
        `SELECT * FROM relationships WHERE
         (source_type = 'person' AND source_id = ? AND target_type = 'person' AND target_id = ?) OR
         (source_type = 'person' AND source_id = ? AND target_type = 'person' AND target_id = ?)`,
        [person.id, cp.id, cp.id, person.id],
      );
      if (rel) {
        networkConnections.push(`${cp.name} (${cp.role || 'unknown role'} at ${clientOrg.name})`);
        claims.push({
          claim: `Knows ${cp.name} at ${clientOrg.name}`,
          sourceType: 'relationships',
          sourceId: rel.id,
          sourceDetail: `relationships.id=${rel.id}, ${rel.relation}`,
        });
      }
    }

    // Also check activities involving both candidate and client people
    for (const act of activities) {
      const actSummary = (act.summary || '') + (act.title || '');
      for (const cp of clientPeople) {
        if (actSummary.includes(cp.name) && !networkConnections.find(nc => nc.includes(cp.name))) {
          networkConnections.push(`${cp.name} (${cp.role || 'unknown role'} at ${clientOrg.name}) — met in activity`);
        }
      }
    }
  }

  // 2g. Score candidate
  const isRejected = rejections.length > 0;
  let score = 50; // Base score
  score += strengths.length * 10;         // Data richness
  score += relationships.length * 3;      // Network density
  score += activities.length * 5;         // Engagement level
  score += shortlists.length * 15;        // Previous positive signals
  score -= rejections.length * 25;        // Red flags
  score -= risks.length * 5;             // Risk factors
  score += networkConnections.length * 8; // Client network
  score = Math.max(0, Math.min(100, score)); // Clamp 0-100
  // Rejected candidates are capped at 30 — they should never appear competitive
  if (isRejected) score = Math.min(score, 30);

  // 2h. Build fit summary
  const fitParts: string[] = [];
  if (person.role) fitParts.push(`${candidateName} currently serves as ${person.role}${org ? ` at ${org.name}` : ''}.`);
  if (person.notes) {
    // Avoid repeating the role in the notes sentence
    const firstSentence = person.notes.split('.')[0] + '.';
    const roleSnippet = (person.role || '').toLowerCase().substring(0, 20);
    if (!firstSentence.toLowerCase().includes(roleSnippet)) {
      fitParts.push(firstSentence);
    }
  }
  if (shortlists.length > 0) fitParts.push('This candidate has been previously shortlisted for this or related assignments.');
  if (rejections.length > 0) fitParts.push('Note: this candidate was previously rejected for this assignment by the client.');
  if (networkConnections.length > 0) fitParts.push(`Has ${networkConnections.length} existing connection(s) at the client organization.`);

  const fitSummary = fitParts.join(' ');

  console.log(`  Score: ${score} | Strengths: ${strengths.length} | Risks: ${risks.length} | Claims: ${claims.length}`);

  assessments.push({
    person,
    org,
    activities,
    notes: allNotes,
    relationships,
    rejections,
    shortlists,
    patterns,
    score,
    strengths,
    risks,
    networkConnections,
    fitSummary,
    claims,
  });
}

// 3. Sort by score descending
assessments.sort((a, b) => b.score - a.score);

// 4. Generate shortlist-rationale.md (client-facing)

const today = new Date().toISOString().split('T')[0];
let rationale = `# Shortlist Rationale: ${assignment}\n\n`;
rationale += `**Client:** ${clientName}\n`;
rationale += `**Date:** ${today}\n`;
rationale += `**Prepared by:** Kernal Intelligence Engine (powered by [Kernal](https://github.com/pintomatic/kernal))\n\n`;
rationale += `---\n\n`;

// Assignment brief
rationale += `## Assignment Brief\n\n`;
const briefMatch = assignmentNote.content.match(/Brief:\s*(.+?)(?:\||$)/);
const brief = briefMatch ? briefMatch[1].trim() : assignmentNote.content.replace(/^\[ASSIGNMENT\]\s*/, '');
rationale += `${brief}\n\n`;

// Split into recommended vs excluded
const recommended = assessments.filter(a => a.rejections.length === 0);
const excluded = assessments.filter(a => a.rejections.length > 0);

// Recommended candidates
rationale += `## Shortlisted Candidates\n\n`;
rationale += `*${assessments.length} candidate(s) evaluated. ${recommended.length} shortlisted, ${excluded.length} excluded.*\n\n`;

function fitLabel(score: number): string {
  if (score >= 80) return 'Strong Fit';
  if (score >= 60) return 'Good Fit';
  if (score >= 40) return 'Conditional Fit';
  return 'Not Recommended';
}

recommended.forEach((a, idx) => {
  const orgDisplay = a.org ? ` at ${a.org.name}` : '';
  const role = a.person.role || 'Role not specified';

  rationale += `### ${idx + 1}. ${a.person.name} — ${role}${orgDisplay}\n\n`;
  rationale += `**Suitability:** ${fitLabel(a.score)}\n\n`;
  rationale += `**Assessment:**\n${a.fitSummary}\n\n`;

  if (a.strengths.length > 0) {
    rationale += `**Key Strengths:**\n`;
    for (const s of a.strengths) {
      rationale += `- ${s}\n`;
    }
    rationale += `\n`;
  }

  if (a.risks.length > 0) {
    rationale += `**Risks:**\n`;
    for (const r of a.risks) {
      rationale += `- ${r}\n`;
    }
    rationale += `\n`;
  }

  if (a.networkConnections.length > 0) {
    rationale += `**Network Connections:**\n`;
    for (const nc of a.networkConnections) {
      rationale += `- ${nc}\n`;
    }
    rationale += `\n`;
  }

  rationale += `---\n\n`;
});

// Excluded candidates section
if (excluded.length > 0) {
  rationale += `## Candidates Considered and Excluded\n\n`;
  for (const a of excluded) {
    const orgDisplay = a.org ? ` at ${a.org.name}` : '';
    const role = a.person.role || 'Role not specified';
    rationale += `### ${a.person.name} — ${role}${orgDisplay}\n\n`;
    rationale += `**Status:** Not recommended\n\n`;
    if (a.rejections.length > 0) {
      for (const rej of a.rejections) {
        const reason = rej.content.replace(/^\[REJECTED\]\s*/, '').split(':').slice(1).join(':').trim();
        rationale += `**Reason:** ${reason || 'Rejected by client'}\n\n`;
      }
    }
    if (a.risks.length > 0) {
      rationale += `**Risks:**\n`;
      for (const r of a.risks) {
        rationale += `- ${r}\n`;
      }
      rationale += `\n`;
    }
    rationale += `---\n\n`;
  }
}

// Applicable patterns
const applicablePatterns = assessments.flatMap(a => a.patterns).filter(
  (p, i, arr) => arr.findIndex(q => q.id === p.id) === i,
);
if (applicablePatterns.length > 0) {
  rationale += `## Market Patterns\n\n`;
  rationale += `*Insights from our placement history relevant to this assignment:*\n\n`;
  for (const p of applicablePatterns) {
    const content = p.content.replace(/^\[(PATTERN|ANTI-PATTERN)\]\s*/, '');
    const tag = p.content.startsWith('[ANTI-PATTERN]') ? 'Caution' : 'Insight';
    rationale += `- **${tag}:** ${content}\n`;
  }
  rationale += `\n`;
}

// 5. Generate shortlist-audit.md (internal, every claim has source ID)

let audit = `# Shortlist Audit Trail: ${assignment}\n\n`;
audit += `**Generated:** ${today} ${new Date().toISOString().split('T')[1].split('.')[0]}\n`;
audit += `**Assignment note:** notes.id=${assignmentNote.id}\n`;
audit += `**Client org:** ${clientOrg ? `organizations.id=${clientOrg.id}` : 'not found'}\n`;
audit += `**Database:** ${dbPath}\n\n`;

for (const a of assessments) {
  audit += `---\n\n`;
  audit += `## Candidate: ${a.person.name}\n\n`;
  audit += `**Score:** ${a.score}/100\n\n`;

  audit += `### Data Sources\n\n`;
  audit += `- Person record: people.id=${a.person.id}\n`;
  if (a.org) audit += `- Organization: organizations.id=${a.org.id} (${a.org.name})\n`;

  if (a.activities.length > 0) {
    audit += `- Activities:\n`;
    for (const act of a.activities) {
      audit += `  - activities.id=${act.id}: "${act.title}" (${act.date || 'no date'})\n`;
    }
  }

  if (a.notes.length > 0) {
    audit += `- Notes:\n`;
    for (const note of a.notes) {
      const tag = note.content.match(/^\[([A-Z-]+)\]/)?.[1] || 'general';
      const contentWithoutTag = note.content.replace(/^\[[A-Z-]+\]\s*/, '');
      audit += `  - notes.id=${note.id}: [${tag}] ${contentWithoutTag.substring(0, 60)}...\n`;
    }
  }

  if (a.relationships.length > 0) {
    audit += `- Relationships: ${a.relationships.length} total\n`;
    for (const rel of a.relationships.slice(0, 10)) {
      audit += `  - relationships.id=${rel.id}: ${rel.source_type}.${rel.source_id} → ${rel.target_type}.${rel.target_id} (${rel.relation})\n`;
    }
    if (a.relationships.length > 10) {
      audit += `  - ... and ${a.relationships.length - 10} more\n`;
    }
  }

  audit += `\n### Reasoning Chain\n\n`;
  for (const claim of a.claims) {
    audit += `- Claim: "${claim.claim}" → Source: ${claim.sourceDetail}\n`;
  }

  if (a.rejections.length > 0) {
    audit += `\n### Red Flags\n\n`;
    for (const rej of a.rejections) {
      audit += `- REJECTED: notes.id=${rej.id} — ${rej.content.substring(0, 100)}\n`;
    }
  }

  audit += `\n`;
}

// Score breakdown explanation
audit += `---\n\n`;
audit += `## Scoring Methodology\n\n`;
audit += `| Factor | Weight | Description |\n`;
audit += `|--------|--------|-------------|\n`;
audit += `| Base | 50 | Starting score for all candidates |\n`;
audit += `| Strengths | +10 each | Data-backed positive signals |\n`;
audit += `| Relationships | +3 each | Network density in the graph |\n`;
audit += `| Activities | +5 each | Meetings, calls, assessments |\n`;
audit += `| Previous shortlist | +15 each | Prior positive selection signal |\n`;
audit += `| Rejections | -25 each | Prior client rejection |\n`;
audit += `| Risk factors | -5 each | Identified concerns |\n`;
audit += `| Client network | +8 each | Known contacts at client org |\n`;

// Write output files
mkdirSync(OUTPUT_DIR, { recursive: true });

const rationalePath = join(OUTPUT_DIR, 'shortlist-rationale.md');
const auditPath = join(OUTPUT_DIR, 'shortlist-audit.md');

writeFileSync(rationalePath, rationale);
writeFileSync(auditPath, audit);

console.log(`\nOutput written:`);
console.log(`  ${rationalePath}`);
console.log(`  ${auditPath}`);

db.close();
console.log('\nDone.');
