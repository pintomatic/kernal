#!/usr/bin/env node

/**
 * Seed script for demo
 * Creates contacts, orgs, and activities showing the knowledge graph in action.
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

// ── Demo interactions — simulating 3 weeks of a professional services consultant's work ──

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

// ── Enrich with additional data ──

const orgUpdates = [
  { name: 'Nordvik Energy', industry: 'Energy', type: 'client' },
  { name: 'Vestra Media', industry: 'Media & Technology', type: 'client' },
  { name: 'Arctura Tech', industry: 'Industrial Software', type: 'client' },
  { name: 'Fjord Systems', industry: 'Engineering & Construction', type: 'prospect' },
];

for (const update of orgUpdates) {
  db.run(
    `UPDATE organizations SET industry = ?, type = ?, updated_at = datetime('now')
     WHERE name LIKE ?`,
    [update.industry, update.type, `%${update.name}%`],
  );
}

const contactDetails = [
  { name: 'Jonas Lindberg', email: 'jonas.lindberg@nordvik.com', linkedin: 'linkedin.com/in/jonaslindberg' },
  { name: 'Lena Holm', email: 'lena@vestramedia.com', linkedin: 'linkedin.com/in/lenaholm' },
  { name: 'Henrik Dahl', email: 'henrik@arctura.io', linkedin: 'linkedin.com/in/henrikdahl' },
  { name: 'Maren Dahl', email: 'maren.dahl@fjordsystems.com', linkedin: 'linkedin.com/in/marendahl' },
  { name: 'Astrid Berg', email: 'astrid@polaris-climate.no', linkedin: 'linkedin.com/in/astridberg' },
  { name: 'Anders Krogh', email: 'anders@arctura.io', linkedin: 'linkedin.com/in/anderskrogh' },
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
