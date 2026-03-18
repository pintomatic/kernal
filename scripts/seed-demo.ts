#!/usr/bin/env node

/**
 * Seed script for BackerSkeie demo (April 7, 2026)
 * Creates 15 contacts, 5 orgs, 20+ activities showing the knowledge graph in action.
 *
 * Usage: npx tsx scripts/seed-demo.ts [--db path/to/kernal.db]
 */

import { createLocalDb, initSchema } from '../src/db/local.js';
import { extractAndStore } from '../src/extraction/prompt.js';
import { getDbPath } from '../src/utils/config.js';

const dbPath = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : getDbPath();

console.log(`Seeding demo data into: ${dbPath}\n`);

const db = createLocalDb(dbPath);
initSchema(db);

// ── Demo interactions — simulating 3 weeks of an executive search consultant's work ──

const interactions = [
  // Week 1: Building the network
  {
    text: 'I had lunch with Erik Haugen from Equinor today. He is their VP of Digital Technology. We discussed their cloud migration strategy — they are targeting Q3 for full cloud-native. Erik mentioned they need a CTO-level advisor for the transition. His colleague Maria Olsen was also there, she is Senior Director of People & Organization.',
    date: '2026-03-16',
  },
  {
    text: 'Had coffee with Kristin Skogen Lund from Schibsted this morning. She is the CEO. We talked about their executive team composition — they need a new CFO after Thomas Raab left. Kristin mentioned she wants someone with both media and tech background. I should follow up with candidate profiles by next week.',
    date: '2026-03-17',
  },
  {
    text: 'Got a call from Per Helge Svensson at Cognite. He is the Chief People Officer. They are growing fast and need to build out their leadership team. Specifically looking for a VP of Engineering and a Head of Product. Per Helge recommended I speak with their CTO, Geir Engdahl, about the technical requirements.',
    date: '2026-03-17',
  },
  {
    text: 'Met Ingrid Brekke from BackerSkeie for our internal strategy session. She is Partner and handles the energy sector. We covered the Equinor CTO advisory search — she thinks Erik Haugen could actually be a candidate himself for other roles. I need to prepare a market map for CTO-level talent in Norwegian energy sector.',
    date: '2026-03-18',
  },
  {
    text: 'Attended the Oslo Business Forum event. Ran into Anders Opedal from Equinor — he is the CEO. Brief conversation about their digital transformation journey. He confirmed the CTO advisory search is a priority. Also met Hege Yli Melhus Ask from Cognite, she is their VP of Sales, EMEA. She mentioned Cognite is opening a Copenhagen office.',
    date: '2026-03-19',
  },

  // Week 2: Deepening relationships
  {
    text: 'Had a meeting with Geir Engdahl from Cognite. He is the CTO and Co-founder. Discussed the VP of Engineering requirements — they need someone who can scale the team from 80 to 200 engineers. Must have experience with industrial IoT platforms. Geir suggested reaching out to former Aveva and Siemens leaders.',
    date: '2026-03-23',
  },
  {
    text: 'Spoke with Thomas Raab today. He recently left Schibsted as CFO and is exploring new opportunities. He is interested in board positions and possibly a CEO role at a scale-up. Very experienced — 15 years in media and digital. I should connect him with Per Helge Svensson at Cognite, they might have a fit.',
    date: '2026-03-24',
  },
  {
    text: 'Erik Haugen called me about the Equinor advisory search. He mentioned that Morten Lund from their board suggested looking at candidates from the telecom sector. Erik also asked if I know anyone for their Head of AI position — this is a new search. I need to send him 3 candidate profiles by Friday.',
    date: '2026-03-24',
  },
  {
    text: 'Introduction meeting: Ingrid Brekke introduced me to Kari Mette Toverud from Aker Solutions. She is SVP of Digital & Technology. Kari Mette has 20 years in engineering and digital transformation. She could be a strong candidate for the Equinor CTO advisory role. I promised to follow up with more details about the position.',
    date: '2026-03-25',
  },
  {
    text: 'Received an email from Kristin Skogen Lund at Schibsted. She wants to move fast on the CFO search — board meeting in April. She asked for a shortlist of 5 candidates. I mentioned Thomas Raab but she said they want fresh perspectives, not someone who just left. I should reach out to Siri Kalvig who has finance and energy background.',
    date: '2026-03-25',
  },

  // Week 3: Connecting the dots
  {
    text: 'Coffee with Siri Kalvig this morning. She is the founder of Nysnø Climate Investments and former CEO of Lyse Energy. Very impressive background — both finance and energy sector. She is open to considering the Schibsted CFO role but wants to understand the digital transformation agenda. I need to arrange a confidential meeting with Kristin.',
    date: '2026-03-30',
  },
  {
    text: 'Had a call with Lars Christian Bacher. He was previously EVP at Equinor and is now an independent board member. He knows Erik Haugen well and thinks highly of him. Lars Christian mentioned that the board of Cognite needs a new independent director — someone with oil & gas background. This could be interesting for several of our candidates.',
    date: '2026-03-30',
  },
  {
    text: 'Board of Cognite needs a new CEO. Per Helge Svensson told me in confidence — current CEO is stepping down in Q4. This is a major search. They want someone who can take the company through IPO. Per Helge asked if I know Erik Haugen well enough to approach him as a potential candidate. This would be a huge placement.',
    date: '2026-03-31',
  },
  {
    text: 'Meeting with the full BackerSkeie team. Ingrid Brekke, myself, and our Copenhagen partner Ole Krog. We mapped out all active searches: Equinor CTO advisory, Equinor Head of AI, Schibsted CFO, Cognite VP Engineering, Cognite Head of Product, and the confidential Cognite CEO search. Six active mandates. Ole mentioned BackerSkeie Copenhagen has a connection to the Maersk leadership team who might source good candidates.',
    date: '2026-04-01',
  },
  {
    text: 'Spoke with Maria Olsen from Equinor again. She mentioned that Kari Mette Toverud from Aker Solutions actually used to work at Equinor 10 years ago. Small world. Maria also said Erik Haugen was promoted to SVP last week — his new title is SVP Digital Technology & Innovation. I should update his profile. Maria asked me to schedule a formal meeting with their CHRO about the Head of AI search.',
    date: '2026-04-02',
  },

  // Week 4: Pre-demo polish
  {
    text: 'Quick call with Erik Haugen to congratulate him on the SVP promotion. He is excited but also hinted he might be open to new challenges if the right opportunity came along. This aligns with the Cognite CEO angle. I need to be very careful here — cannot reveal the Cognite search to him directly yet. I agreed to have dinner with him next week to discuss his career ambitions.',
    date: '2026-04-03',
  },
  {
    text: 'Arranged the confidential meeting between Siri Kalvig and Kristin Skogen Lund for next Tuesday at Hotel Continental. Both are excited. If this works out, it would be a great placement — Schibsted gets a CFO with deep energy-tech crossover, and Siri gets a platform to drive digital transformation at scale.',
    date: '2026-04-03',
  },
  {
    text: 'Per Helge Svensson from Cognite confirmed they want to engage BackerSkeie for the CEO search. This is our biggest mandate this year. Ingrid Brekke will lead, I will support. First step is a detailed brief with the board chair. Per Helge also mentioned Geir Engdahl might step into a President of Technology role if the new CEO has a more commercial profile. I need to update our Cognite account plan.',
    date: '2026-04-04',
  },
  {
    text: 'Received feedback from Kari Mette Toverud about the Equinor CTO advisory position. She is very interested and has already spoken to some former Equinor colleagues. She asked about compensation and time commitment. I should follow up with Erik Haugen to get the formal scope document. Also, Kari Mette mentioned she knows Lars Christian Bacher from their time together at Equinor — another connection in our network.',
    date: '2026-04-04',
  },
  {
    text: 'End of week summary call with Ingrid Brekke and Ole Krog. We reviewed all active mandates. Key insight: our strongest connector is Erik Haugen — he connects to Equinor, Cognite (potential CEO candidate), and knows half the people in our network. Kari Mette Toverud is emerging as a strong multi-mandate candidate. And the Siri Kalvig - Kristin Skogen Lund meeting could close the Schibsted CFO search quickly. The network effect is real — every conversation adds to the graph.',
    date: '2026-04-04',
  },
];

// Process all interactions
let totalPeople = 0;
let totalOrgs = 0;
let totalActivities = 0;
let totalRelationships = 0;

for (const interaction of interactions) {
  // Prepend date context
  const textWithDate = interaction.text.replace(/today|this morning|this afternoon/gi, `on ${interaction.date}`);

  const result = extractAndStore(db, textWithDate);

  // Update the activity date if we have one and the extracted date is wrong
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

// ── Enrich with additional data ──

// Set org types and industries
const orgUpdates = [
  { name: 'Equinor', industry: 'Energy', type: 'client' },
  { name: 'Schibsted', industry: 'Media & Technology', type: 'client' },
  { name: 'Cognite', industry: 'Industrial Software', type: 'client' },
  { name: 'BackerSkeie', industry: 'Executive Search', type: 'employer' },
  { name: 'Aker Solutions', industry: 'Engineering & Construction', type: 'prospect' },
];

for (const update of orgUpdates) {
  db.run(
    `UPDATE organizations SET industry = ?, type = ?, updated_at = datetime('now')
     WHERE name LIKE ?`,
    [update.industry, update.type, `%${update.name}%`],
  );
}

// Add contact details for key people
const contactDetails = [
  { name: 'Erik Haugen', email: 'erik.haugen@equinor.com', linkedin: 'linkedin.com/in/erikhaugen' },
  { name: 'Kristin Skogen Lund', email: 'kristin@schibsted.com', linkedin: 'linkedin.com/in/kristinskogenlund' },
  { name: 'Per Helge Svensson', email: 'perhelge@cognite.com', linkedin: 'linkedin.com/in/perhelgesvensson' },
  { name: 'Kari Mette Toverud', email: 'kari.mette@akersolutions.com', linkedin: 'linkedin.com/in/karimettetoverud' },
  { name: 'Siri Kalvig', email: 'siri@nysno.no', linkedin: 'linkedin.com/in/sirikalvig' },
  { name: 'Geir Engdahl', email: 'geir@cognite.com', linkedin: 'linkedin.com/in/geirengdahl' },
];

for (const contact of contactDetails) {
  db.run(
    `UPDATE people SET email = ?, linkedin = ?, updated_at = datetime('now')
     WHERE name = ?`,
    [contact.email, contact.linkedin, contact.name],
  );
}

// Update Erik Haugen's role to reflect promotion
db.run(
  `UPDATE people SET role = 'SVP Digital Technology & Innovation', updated_at = datetime('now')
   WHERE name = 'Erik Haugen'`,
);

// ── Final stats ──
console.log('\n── Seed Complete ──');
console.log(`New people: ${totalPeople}`);
console.log(`New organizations: ${totalOrgs}`);
console.log(`Activities logged: ${totalActivities}`);
console.log(`Relationships created: ${totalRelationships}`);

const finalCounts = {
  people: db.get<{ c: number }>('SELECT COUNT(*) as c FROM people')?.c || 0,
  organizations: db.get<{ c: number }>('SELECT COUNT(*) as c FROM organizations')?.c || 0,
  activities: db.get<{ c: number }>('SELECT COUNT(*) as c FROM activities')?.c || 0,
  topics: db.get<{ c: number }>('SELECT COUNT(*) as c FROM topics')?.c || 0,
  actions: db.get<{ c: number }>('SELECT COUNT(*) as c FROM actions')?.c || 0,
  notes: db.get<{ c: number }>('SELECT COUNT(*) as c FROM notes')?.c || 0,
  relationships: db.get<{ c: number }>('SELECT COUNT(*) as c FROM relationships')?.c || 0,
};

console.log('\nFinal database:');
for (const [type, count] of Object.entries(finalCounts)) {
  console.log(`  ${type}: ${count}`);
}

db.close();
console.log('\nDone. Run `kernal status` to verify.');
