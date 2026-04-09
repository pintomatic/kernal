#!/usr/bin/env node

/**
 * Seed script for exec search demo
 * Creates candidates, client orgs, assignments, interview activities,
 * rejection/shortlist history, and pattern notes.
 *
 * Usage: npx tsx examples/exec-search/seed-exec-search.ts [--db path/to/kernal.db]
 */

import { createLocalDb, initSchema } from '../../src/db/local.js';
import { extractAndStore } from '../../src/extraction/prompt.js';
import { existsSync, unlinkSync } from 'fs';

const defaultDbPath = 'examples/exec-search/kernal-exec.db';
const dbPath = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : defaultDbPath;

// Idempotent: delete existing DB
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log(`Deleted existing DB: ${dbPath}`);
}

console.log(`Seeding exec search data into: ${dbPath}\n`);

const db = createLocalDb(dbPath);
initSchema(db);

// ── Demo interactions — copied from seed-demo.ts (all 20 entries) ──

const interactions = [
  {
    text: 'I had lunch with Jonas Lindberg from Nordvik Energy today. He is their VP of Digital Technology. We discussed their cloud migration strategy — they are targeting Q3 for full cloud-native. Jonas mentioned they need a CTO-level advisor for the transition. His colleague Sofia Andersen was also there, she is Senior Director of People & Organization.',
    date: '2026-03-16',
  },
  {
    text: 'Had coffee with Lena Holm from Vestra Media this morning. She is the CEO. We talked about their executive team composition — they need a new CFO after Markus Blom left. Lena mentioned she wants someone with both media and tech background. I should follow up with candidate profiles by next week.',
    date: '2026-03-17',
  },
  {
    text: 'Got a call from Henrik Dahl at Arctura Tech. He is the Chief People Officer. They are growing fast and need to build out their leadership team. Specifically looking for a VP of Engineering and a Head of Product. Henrik recommended I speak with their CTO, Anders Krogh, about the technical requirements.',
    date: '2026-03-17',
  },
  {
    text: 'Met Hanna Nilsen from our firm for our internal strategy session. She is Partner and handles the energy sector. We covered the Nordvik Energy CTO advisory search — she thinks Jonas Lindberg could actually be a candidate himself for other roles. I need to prepare a market map for CTO-level talent in the energy sector.',
    date: '2026-03-18',
  },
  {
    text: 'Attended the Nordic Business Forum event. Ran into Torsten Vik from Nordvik Energy — he is the CEO. Brief conversation about their digital transformation journey. He confirmed the CTO advisory search is a priority. Also met Ingrid Solheim from Arctura Tech, she is their VP of Sales, EMEA. She mentioned Arctura is opening a Copenhagen office.',
    date: '2026-03-19',
  },
  {
    text: 'Had a meeting with Anders Krogh from Arctura Tech. He is the CTO and Co-founder. Discussed the VP of Engineering requirements — they need someone who can scale the team from 80 to 200 engineers. Must have experience with industrial IoT platforms. Anders suggested reaching out to former Siemens and ABB leaders.',
    date: '2026-03-23',
  },
  {
    text: 'Spoke with Markus Blom today. He recently left Vestra Media as CFO and is exploring new opportunities. He is interested in board positions and possibly a CEO role at a scale-up. Very experienced — 15 years in media and digital. I should connect him with Henrik Dahl at Arctura Tech, they might have a fit.',
    date: '2026-03-24',
  },
  {
    text: 'Jonas Lindberg called me about the Nordvik Energy advisory search. He mentioned that the board suggested looking at candidates from the telecom sector. Jonas also asked if I know anyone for their Head of AI position — this is a new search. I need to send him 3 candidate profiles by Friday.',
    date: '2026-03-24',
  },
  {
    text: 'Introduction meeting: Hanna Nilsen introduced me to Maren Dahl from Fjord Systems. She is SVP of Digital & Technology. Maren has 20 years in engineering and digital transformation. She could be a strong candidate for the Nordvik Energy CTO advisory role. I promised to follow up with more details about the position.',
    date: '2026-03-25',
  },
  {
    text: 'Received an email from Lena Holm at Vestra Media. She wants to move fast on the CFO search — board meeting in April. She asked for a shortlist of 5 candidates. I mentioned Markus Blom but she said they want fresh perspectives, not someone who just left. I should reach out to Astrid Berg who has finance and energy background.',
    date: '2026-03-25',
  },
  {
    text: 'Coffee with Astrid Berg this morning. She is the founder of Polaris Climate Investments and former CEO of Havkraft Energy. Very impressive background — both finance and energy sector. She is open to considering the Vestra Media CFO role but wants to understand the digital transformation agenda. I need to arrange a confidential meeting with Lena.',
    date: '2026-03-30',
  },
  {
    text: 'Had a call with Eirik Strand. He was previously EVP at Nordvik Energy and is now an independent board member. He knows Jonas Lindberg well and thinks highly of him. Eirik mentioned that the board of Arctura Tech needs a new independent director — someone with energy industry background. This could be interesting for several of our candidates.',
    date: '2026-03-30',
  },
  {
    text: 'Board of Arctura Tech needs a new CEO. Henrik Dahl told me in confidence — current CEO is stepping down in Q4. This is a major search. They want someone who can take the company through IPO. Henrik asked if I know Jonas Lindberg well enough to approach him as a potential candidate. This would be a huge placement.',
    date: '2026-03-31',
  },
  {
    text: 'Meeting with the full team. Hanna Nilsen, myself, and our Copenhagen partner Kasper Friis. We mapped out all active searches: Nordvik Energy CTO advisory, Nordvik Energy Head of AI, Vestra Media CFO, Arctura Tech VP Engineering, Arctura Tech Head of Product, and the confidential Arctura Tech CEO search. Six active mandates. Kasper mentioned our Copenhagen office has a connection to the Maersk leadership team who might source good candidates.',
    date: '2026-04-01',
  },
  {
    text: 'Spoke with Sofia Andersen from Nordvik Energy again. She mentioned that Maren Dahl from Fjord Systems actually used to work at Nordvik Energy 10 years ago. Small world. Sofia also said Jonas Lindberg was promoted to SVP last week — his new title is SVP Digital Technology & Innovation. I should update his profile. Sofia asked me to schedule a formal meeting with their CHRO about the Head of AI search.',
    date: '2026-04-02',
  },
  {
    text: 'Quick call with Jonas Lindberg to congratulate him on the SVP promotion. He is excited but also hinted he might be open to new challenges if the right opportunity came along. This aligns with the Arctura Tech CEO angle. I need to be very careful here — cannot reveal the Arctura Tech search to him directly yet. I agreed to have dinner with him next week to discuss his career ambitions.',
    date: '2026-04-03',
  },
  {
    text: 'Arranged the confidential meeting between Astrid Berg and Lena Holm for next Tuesday at Grand Hotel. Both are excited. If this works out, it would be a great placement — Vestra Media gets a CFO with deep energy-tech crossover, and Astrid gets a platform to drive digital transformation at scale.',
    date: '2026-04-03',
  },
  {
    text: 'Henrik Dahl from Arctura Tech confirmed they want to engage our firm for the CEO search. This is our biggest mandate this year. Hanna Nilsen will lead, I will support. First step is a detailed brief with the board chair. Henrik also mentioned Anders Krogh might step into a President of Technology role if the new CEO has a more commercial profile. I need to update our Arctura Tech account plan.',
    date: '2026-04-04',
  },
  {
    text: 'Received feedback from Maren Dahl about the Nordvik Energy CTO advisory position. She is very interested and has already spoken to some former Nordvik Energy colleagues. She asked about compensation and time commitment. I should follow up with Jonas Lindberg to get the formal scope document. Also, Maren mentioned she knows Eirik Strand from their time together at Nordvik Energy — another connection in our network.',
    date: '2026-04-04',
  },
  {
    text: 'End of week summary call with Hanna Nilsen and Kasper Friis. We reviewed all active mandates. Key insight: our strongest connector is Jonas Lindberg — he connects to Nordvik Energy, Arctura Tech (potential CEO candidate), and knows half the people in our network. Maren Dahl is emerging as a strong multi-mandate candidate. And the Astrid Berg - Lena Holm meeting could close the Vestra Media CFO search quickly. The network effect is real — every conversation adds to the graph.',
    date: '2026-04-04',
  },
];

// Process all interactions
let totalPeople = 0;
let totalOrgs = 0;
let totalActivities = 0;
let totalRelationships = 0;

for (const interaction of interactions) {
  const textWithDate = interaction.text.replace(/today|this morning|this afternoon/gi, `on ${interaction.date}`);

  const result = extractAndStore(db, textWithDate);

  if (result.activity && interaction.date) {
    db.run('UPDATE activities SET date = ? WHERE id = ?', [interaction.date, result.activity.id]);
  }

  totalPeople += result.people.filter(p => p.status === 'created').length;
  totalOrgs += result.organizations.filter(o => o.status === 'created').length;
  totalActivities += result.activity ? 1 : 0;
  totalRelationships += result.relationships;

  console.log(`[${interaction.date}] ${result.activity?.title || 'processed'}`);
  if (result.people.length > 0) {
    console.log(`  People: ${result.people.map(p => `${p.name} (${p.status})`).join(', ')}`);
  }
}

// ── Enrich organizations with exec search metadata ──

const orgUpdates = [
  { name: 'Nordvik Energy', industry: 'Energy', type: 'client' },
  { name: 'Vestra Media', industry: 'Media & Technology', type: 'client' },
  { name: 'Arctura Tech', industry: 'Industrial Software', type: 'client' },
  { name: 'Fjord Systems', industry: 'Engineering & Construction', type: 'prospect' },
  { name: 'Polaris Climate Investments', industry: 'Investment & Climate', type: 'other' },
  { name: 'Havkraft Energy', industry: 'Energy', type: 'other' },
];

for (const update of orgUpdates) {
  db.run(
    `UPDATE organizations SET industry = ?, type = ?, updated_at = datetime('now')
     WHERE name LIKE ?`,
    [update.industry, update.type, `%${update.name}%`],
  );
}

// ── Enrich candidate profiles ──

const contactDetails = [
  { name: 'Jonas Lindberg', email: 'jonas.lindberg@nordvik.com', linkedin: 'linkedin.com/in/jonaslindberg' },
  { name: 'Lena Holm', email: 'lena@vestramedia.com', linkedin: 'linkedin.com/in/lenaholm' },
  { name: 'Henrik Dahl', email: 'henrik@arctura.io', linkedin: 'linkedin.com/in/henrikdahl' },
  { name: 'Maren Dahl', email: 'maren.dahl@fjordsystems.com', linkedin: 'linkedin.com/in/marendahl' },
  { name: 'Astrid Berg', email: 'astrid@polaris-climate.no', linkedin: 'linkedin.com/in/astridberg' },
  { name: 'Anders Krogh', email: 'anders@arctura.io', linkedin: 'linkedin.com/in/anderskrogh' },
  { name: 'Markus Blom', email: 'markus.blom@gmail.com', linkedin: 'linkedin.com/in/markusblom' },
  { name: 'Eirik Strand', email: 'eirik.strand@boardadvisors.no', linkedin: 'linkedin.com/in/eirikstrand' },
];

for (const contact of contactDetails) {
  db.run(
    `UPDATE people SET email = ?, linkedin = ?, updated_at = datetime('now')
     WHERE name = ?`,
    [contact.email, contact.linkedin, contact.name],
  );
}

// Update Jonas Lindberg's role to reflect promotion
db.run(
  `UPDATE people SET role = 'SVP Digital Technology & Innovation', updated_at = datetime('now')
   WHERE name = 'Jonas Lindberg'`,
);

// ── Assignment notes (structured notes representing active mandates) ──

interface NoteRow { id: number }
interface PersonRow { id: number; name: string }
interface OrgRow { id: number; name: string }

function insertNote(content: string): number {
  const result = db.run('INSERT INTO notes (content) VALUES (?)', [content]);
  return result.lastInsertRowid;
}

function findPersonId(name: string): number | undefined {
  const row = db.get<PersonRow>('SELECT id FROM people WHERE name = ?', [name]);
  return row?.id;
}

function findOrgId(name: string): number | undefined {
  const row = db.get<OrgRow>('SELECT id FROM organizations WHERE name LIKE ?', [`%${name}%`]);
  return row?.id;
}

function linkNoteToEntity(noteId: number, targetType: string, targetId: number, relation: string): void {
  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    ['note', noteId, targetType, targetId, relation],
  );
}

// Assignment 1: Arctura Tech CEO Search
const arcturaCeoId = insertNote(
  '[ASSIGNMENT] Arctura Tech CEO Search | Client: Arctura Tech | Status: Active | Confidential: Yes | ' +
  'Brief: Seeking a CEO to lead Arctura Tech through IPO. Must have commercial profile, industrial software ' +
  'experience preferred but not required. Current CEO stepping down Q4. CTO Anders Krogh may move to President ' +
  'of Technology. Board wants someone who can scale from 200 to 1000+ employees. Hanna Nilsen leads this search.',
);

// Assignment 2: Vestra Media CFO Search
const vestraCfoId = insertNote(
  '[ASSIGNMENT] Vestra Media CFO Search | Client: Vestra Media | Status: Active | Confidential: No | ' +
  'Brief: Vestra Media needs a CFO after Markus Blom departed. CEO Lena Holm wants someone with both media ' +
  'and technology background who can drive digital transformation. Board meeting in April — urgent timeline. ' +
  'Client explicitly wants fresh perspectives, not someone who just left the company.',
);

// Assignment 3: Nordvik Energy CTO Advisory
const nordvikCtoId = insertNote(
  '[ASSIGNMENT] Nordvik Energy CTO Advisory | Client: Nordvik Energy | Status: Active | Confidential: No | ' +
  'Brief: Nordvik Energy seeking a CTO-level advisor for their cloud migration and digital transformation. ' +
  'Q3 deadline for full cloud-native. Board also open to telecom-sector candidates. Jonas Lindberg (SVP Digital) ' +
  'is the internal sponsor. Need someone with 15+ years digital transformation experience.',
);

// Assignment 4: Nordvik Energy Head of AI
const nordvikAiId = insertNote(
  '[ASSIGNMENT] Nordvik Energy Head of AI | Client: Nordvik Energy | Status: Active | Confidential: No | ' +
  'Brief: New position at Nordvik Energy. Reporting to SVP Digital (Jonas Lindberg). Need to schedule formal ' +
  'meeting with CHRO to define scope. This is a new search — no candidates identified yet.',
);

// Link assignments to client organizations
const arcturaId = findOrgId('Arctura Tech');
const vestraId = findOrgId('Vestra Media');
const nordvikId = findOrgId('Nordvik Energy');

if (arcturaId) linkNoteToEntity(arcturaCeoId, 'organization', arcturaId, 'assignment_for');
if (vestraId) linkNoteToEntity(vestraCfoId, 'organization', vestraId, 'assignment_for');
if (nordvikId) {
  linkNoteToEntity(nordvikCtoId, 'organization', nordvikId, 'assignment_for');
  linkNoteToEntity(nordvikAiId, 'organization', nordvikId, 'assignment_for');
}

// Link assignments to lead partners
const hannaId = findPersonId('Hanna Nilsen');
const jonasId = findPersonId('Jonas Lindberg');
if (hannaId) linkNoteToEntity(arcturaCeoId, 'person', hannaId, 'led_by');
if (jonasId) linkNoteToEntity(nordvikCtoId, 'person', jonasId, 'sponsored_by');

// ── Interview/Assessment Activities ──

// Maren Dahl interview for Nordvik CTO Advisory
const marenId = findPersonId('Maren Dahl');
const marenInterviewId = db.run(
  `INSERT INTO activities (type, title, date, summary, notes)
   VALUES (?, ?, ?, ?, ?)`,
  [
    'meeting',
    'Assessment: Maren Dahl for Nordvik CTO Advisory',
    '2026-04-01',
    'Assessed Maren Dahl for the Nordvik Energy CTO Advisory position. Strong fit — 20 years in digital transformation, SVP-level experience. Former Nordvik Energy employee (10 years ago), giving her internal network advantage. Knows Eirik Strand from Nordvik days. Very interested in the role, asked about compensation and time commitment.',
    'Fit: Strong. Key strengths: sector depth, transformation track record, existing Nordvik network. Risk: currently employed at Fjord Systems (notice period). Overall recommendation: proceed to shortlist.',
  ],
).lastInsertRowid;

if (marenId) {
  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    ['activity', marenInterviewId, 'person', marenId, 'assessed'],
  );
}

// Astrid Berg meeting with Lena Holm (Vestra CFO chemistry check)
const astridId = findPersonId('Astrid Berg');
const lenaId = findPersonId('Lena Holm');
const astridMeetingId = db.run(
  `INSERT INTO activities (type, title, date, summary, notes)
   VALUES (?, ?, ?, ?, ?)`,
  [
    'meeting',
    'Chemistry meeting: Astrid Berg and Lena Holm (Vestra CFO)',
    '2026-04-08',
    'Confidential meeting at Grand Hotel between Astrid Berg (candidate) and Lena Holm (CEO, Vestra Media) for the CFO role. Positive chemistry — Astrid demonstrated deep understanding of energy-tech crossover. Lena impressed by founder credibility and transformation vision. Both parties enthusiastic about next steps.',
    'Chemistry: Excellent. Astrid asked sharp questions about Vestra digital strategy. Lena appreciated the founder perspective. Next step: formal interview with board. Timeline: before April board meeting.',
  ],
).lastInsertRowid;

if (astridId) {
  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    ['activity', astridMeetingId, 'person', astridId, 'assessed'],
  );
}
if (lenaId) {
  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    ['activity', astridMeetingId, 'person', lenaId, 'participant'],
  );
}

// Markus Blom consideration for Vestra CFO (explored, rejected)
const markusId = findPersonId('Markus Blom');
const markusMeetingId = db.run(
  `INSERT INTO activities (type, title, date, summary, notes)
   VALUES (?, ?, ?, ?, ?)`,
  [
    'call',
    'Candidate review: Markus Blom for Vestra Media CFO',
    '2026-03-25',
    'Discussed Markus Blom as potential candidate for Vestra Media CFO with Lena Holm. Markus has 15 years media/digital experience and was previously CFO at Vestra Media. However, Lena explicitly rejected this option — client wants fresh perspectives, not someone who just left.',
    'Outcome: Rejected by client. Reason: "want fresh perspectives, not someone who just left." Note: Markus is still a strong candidate for other roles (Arctura CEO angle, board positions).',
  ],
).lastInsertRowid;

if (markusId) {
  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    ['activity', markusMeetingId, 'person', markusId, 'assessed'],
  );
}

// Jonas Lindberg being explored for Arctura CEO (confidential, not yet approached)
if (jonasId) {
  const jonasExploreId = db.run(
    `INSERT INTO activities (type, title, date, summary, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'call',
      'Internal discussion: Jonas Lindberg for Arctura CEO',
      '2026-04-03',
      'Internal discussion about approaching Jonas Lindberg for the Arctura Tech CEO search. Jonas recently promoted to SVP at Nordvik Energy but hinted he is open to new challenges. Eirik Strand (former Nordvik EVP) thinks highly of him. Henrik Dahl (Arctura CPO) asked if we know him well enough to approach. CONFIDENTIAL — cannot reveal Arctura search to Jonas directly yet. Dinner planned to explore career ambitions.',
      'Status: Exploring. Not yet approached. Risk: poaching from an active client (Nordvik Energy). Must handle with extreme care.',
    ],
  ).lastInsertRowid;

  db.run(
    `INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation)
     VALUES (?, ?, ?, ?, ?)`,
    ['activity', jonasExploreId, 'person', jonasId, 'assessed'],
  );
}

// ── Rejection and Shortlist Notes ──

const rejectionMarkusId = insertNote(
  '[REJECTED] Markus Blom for Vestra Media CFO: "Client wants fresh perspectives, not someone who just left." ' +
  'Lena Holm was explicit — despite Markus having 15 years media/digital experience and being former Vestra CFO, ' +
  'the board wants a different profile. Note: Markus remains viable for Arctura CEO and board positions.',
);
if (markusId) linkNoteToEntity(rejectionMarkusId, 'person', markusId, 'candidate_rejected');
if (vestraId) linkNoteToEntity(rejectionMarkusId, 'organization', vestraId, 'rejection_for');

const shortlistAstridId = insertNote(
  '[SHORTLISTED] Astrid Berg for Vestra Media CFO: "Deep energy-tech crossover, founder credibility, open to the role." ' +
  'Founder of Polaris Climate Investments, former CEO of Havkraft Energy. Both finance and energy sector background. ' +
  'Chemistry meeting with Lena Holm went very well — both parties enthusiastic. Next: formal board interview.',
);
if (astridId) linkNoteToEntity(shortlistAstridId, 'person', astridId, 'candidate_shortlisted');
if (vestraId) linkNoteToEntity(shortlistAstridId, 'organization', vestraId, 'shortlist_for');

const shortlistMarenId = insertNote(
  '[SHORTLISTED] Maren Dahl for Nordvik CTO Advisory: "20 years digital transformation, former Nordvik employee ' +
  '(network advantage), SVP-level." Currently SVP Digital & Technology at Fjord Systems. Knows Eirik Strand from ' +
  'Nordvik days. Very interested in the role. Strong multi-mandate candidate.',
);
if (marenId) linkNoteToEntity(shortlistMarenId, 'person', marenId, 'candidate_shortlisted');
if (nordvikId) linkNoteToEntity(shortlistMarenId, 'organization', nordvikId, 'shortlist_for');

// ── Pattern notes ──

const patterns = [
  '[PATTERN] Strong female leaders in industrial firms tend to succeed when they have both sector depth and transformation experience. Evidence: Maren Dahl (Fjord Systems → Nordvik advisory), Astrid Berg (Havkraft → Vestra CFO).',
  '[PATTERN] Candidates rejected for "not enough P&L scale" often become viable 2-3 years later — always re-check. Track rejected candidates in the system for future re-evaluation.',
  '[ANTI-PATTERN] Presenting candidates who recently left the same client firm creates awkward dynamics. Example: Markus Blom rejected for Vestra CFO precisely because he just left. Always check departure recency.',
  '[PATTERN] Cross-sector CFOs (energy to media, tech to industrial) outperform single-sector ones when the firm is in transformation. The outsider perspective accelerates change. Astrid Berg (energy/climate → media) fits this pattern.',
];

for (const patternContent of patterns) {
  insertNote(patternContent);
}

// ── Additional enrichment: notes on people for richer profiles ──

if (astridId) {
  db.run(
    `UPDATE people SET notes = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      'Founder of Polaris Climate Investments. Former CEO of Havkraft Energy. Deep finance + energy background. ' +
      'Open to CFO roles in digital transformation contexts. Strong on governance and board-level communication. ' +
      'Impressive founder track record — built Polaris from scratch.',
      astridId,
    ],
  );
}

if (markusId) {
  db.run(
    `UPDATE people SET notes = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      'Former CFO at Vestra Media (departed recently). 15 years in media and digital. Exploring new opportunities ' +
      'including board positions and CEO roles at scale-ups. Rejected by Vestra for CFO re-hire. Strong candidate ' +
      'for Arctura Tech CEO and other board-level mandates.',
      markusId,
    ],
  );
}

if (marenId) {
  db.run(
    `UPDATE people SET notes = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      'SVP Digital & Technology at Fjord Systems. 20 years in engineering and digital transformation. Former ' +
      'Nordvik Energy employee (10 years ago) — retains internal network. Knows Eirik Strand. Strong multi-mandate ' +
      'candidate: viable for Nordvik CTO advisory and potentially other transformation roles.',
      marenId,
    ],
  );
}

if (jonasId) {
  db.run(
    `UPDATE people SET notes = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      'SVP Digital Technology & Innovation at Nordvik Energy (promoted from VP). Key connector in the network — ' +
      'links to Nordvik, Arctura Tech (potential CEO candidate), and many industry contacts. Hinted at being open ' +
      'to new challenges. Internal sponsor for Nordvik CTO advisory and Head of AI searches. Handle with care — ' +
      'Arctura CEO approach must be confidential.',
      jonasId,
    ],
  );
}

// ── Final stats ──

console.log('\n── Exec Search Seed Complete ──');
console.log(`Interactions processed: ${interactions.length}`);
console.log(`New people: ${totalPeople}`);
console.log(`New organizations: ${totalOrgs}`);
console.log(`Activities logged: ${totalActivities}`);
console.log(`Relationships created: ${totalRelationships}`);

const finalCounts = {
  people: db.get<{ c: number }>('SELECT COUNT(*) as c FROM people')?.c || 0,
  organizations: db.get<{ c: number }>('SELECT COUNT(*) as c FROM organizations')?.c || 0,
  activities: db.get<{ c: number }>('SELECT COUNT(*) as c FROM activities')?.c || 0,
  notes: db.get<{ c: number }>('SELECT COUNT(*) as c FROM notes')?.c || 0,
  relationships: db.get<{ c: number }>('SELECT COUNT(*) as c FROM relationships')?.c || 0,
};

console.log('\nFinal database:');
for (const [type, count] of Object.entries(finalCounts)) {
  console.log(`  ${type}: ${count}`);
}

// Exec search specific counts
const assignmentCount = db.get<{ c: number }>(
  `SELECT COUNT(*) as c FROM notes WHERE content LIKE '[ASSIGNMENT]%'`,
)?.c || 0;
const rejectionCount = db.get<{ c: number }>(
  `SELECT COUNT(*) as c FROM notes WHERE content LIKE '[REJECTED]%'`,
)?.c || 0;
const shortlistCount = db.get<{ c: number }>(
  `SELECT COUNT(*) as c FROM notes WHERE content LIKE '[SHORTLISTED]%'`,
)?.c || 0;
const patternCount = db.get<{ c: number }>(
  `SELECT COUNT(*) as c FROM notes WHERE content LIKE '[PATTERN]%' OR content LIKE '[ANTI-PATTERN]%'`,
)?.c || 0;

console.log('\nExec search entities:');
console.log(`  Assignments: ${assignmentCount}`);
console.log(`  Rejections: ${rejectionCount}`);
console.log(`  Shortlisted: ${shortlistCount}`);
console.log(`  Patterns: ${patternCount}`);

db.close();
console.log('\nDone. Ready for shortlist generation.');
