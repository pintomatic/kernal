import type { DbAdapter } from '../db/adapter.js';
import {
  resolvePerson,
  resolveOrg,
  resolveTopic,
  createRelationship,
  findPerson,
} from './resolver.js';

interface ExtractionResult {
  people: Array<{ id: number; name: string; status: 'created' | 'matched'; org?: string; role?: string }>;
  organizations: Array<{ id: number; name: string; status: 'created' | 'matched' }>;
  topics: Array<{ id: number; name: string; status: 'created' | 'matched' }>;
  actions: Array<{ id: number; title: string; owner?: string; due_date?: string }>;
  activity?: { id: number; type: string; title: string; date: string | null };
  relationships: number;
  raw_text_stored: boolean;
}

// ── Person patterns (no `i` flag — we need case-sensitive [A-Z] anchors) ──

const PERSON_PATTERNS = [
  // "I met/saw/spoke with John Smith" (handles sentence-start capitalization)
  /(?:[Mm]et|[Ss]aw|[Ss]poke (?:with|to)|[Tt]alked (?:with|to)|[Cc]hatted with|[Cc]aught up with|[Rr]an into|[Bb]umped into|[Hh]ad (?:lunch|dinner|coffee|drinks|a call|a meeting|a chat|a conversation|breakfast) with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  // "John Smith from/at Equinor" — terminator list expanded
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:from|at|of|with)\s+([A-Z][a-zA-Z&.\s]+?)(?:\.|,|;|\s+(?:who|and|is|was|today|yesterday|this|last|about|mentioned|said|told|asked|suggested|recommended|called|emailed|will|should|needs?))/g,
  // "colleague/associate Name"
  /(?:[Hh](?:is|er)|[Tt]heir|[Mm]y|[Oo]ur)\s+(?:colleague|coworker|co-worker|associate|partner|boss|manager|director|assistant|counterpart)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  // "introduced me to Name" / "introduced Name"
  /introduced\s+(?:me to\s+|us to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  // "Name, who is VP of..." / "Name, the CEO"
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}),\s+(?:who is|the|their)\s+/g,
  // "Name called/emailed/texted me"
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:called|emailed|texted|messaged|contacted|invited|suggested|recommended|mentioned|confirmed|told|asked|said)/g,
  // "Got/Received a call/email from Name"
  /(?:[Gg]ot|[Rr]eceived)\s+(?:a\s+)?(?:call|email|message|text|note)\s+from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  // "Coffee/Lunch/Meeting with Name" (no preceding verb)
  /(?:[Cc]offee|[Ll]unch|[Dd]inner|[Bb]reakfast|[Dd]rinks|[Mm]eeting|[Cc]all)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
  // Comma-separated names: "Name, Name, and Name"
  /(?:^|[.!?]\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:,\s+|\s+and\s+)/gm,
  // "with Name and Name" (for catching secondary people in lists)
  /(?:and|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s+(?:from|at|of)\s+([A-Z][a-zA-Z&.\s]+?))?(?:\.|,|;|\s+(?:who|and|about|today|yesterday|this|last|were|was|are|is))/g,
];

// ── Role extraction — run per-person against full text ──

function extractRoleForPerson(text: string, personName: string): string | null {
  const firstName = personName.split(' ')[0];
  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const rolePatterns = [
    // "Erik is their VP of Digital" / "Erik, VP of Digital"
    new RegExp(`${escaped}[^.]*?(?:is|as|,)\\s+(?:the\\s+|their\\s+|an?\\s+)?((?:VP|CEO|CTO|CFO|COO|CMO|CIO|CISO|CHRO|CPO|CDO|CRO|SVP|EVP|MD|Managing Director|Director|Head|Manager|Partner|Senior Partner|Junior Partner|Principal|Lead|Senior|Chief|Founder|Co-founder|Board (?:Member|Chair)|Chairman|Chairwoman|President|General Manager|Country Manager|Regional Manager|Associate|Analyst|Consultant|Senior Consultant|Advisor|Senior Advisor)(?:\\s+(?:of|for|in|&|and)\\s+[A-Za-z\\s&]+?)?)(?:\\.|,|;|\\s+(?:at|of|from|and|who|\\.|$))`, 'i'),
    // "VP of Digital Erik" (role before name)
    new RegExp(`((?:VP|CEO|CTO|CFO|COO|CMO|CIO|CISO|CHRO|CPO|CDO|CRO|SVP|EVP|MD|Managing Director|Director|Head|Manager|Partner|Senior Partner|Principal|Lead|Senior|Chief|Founder|Co-founder|President)(?:\\s+(?:of|for|in|&|and)\\s+[A-Za-z\\s&]+?)?)\\s+${escaped}`, 'i'),
    // "He/She is the VP of..." (pronoun reference — only works if text mentions one person)
    new RegExp(`(?:He|She|They)(?:'s|\\s+is|\\s+are|\\s+serves as)\\s+(?:the\\s+|their\\s+|an?\\s+)?((?:VP|CEO|CTO|CFO|COO|CMO|CIO|CISO|CHRO|CPO|CDO|CRO|SVP|EVP|Director|Head|Manager|Partner|Principal|Lead|Senior|Chief|Founder|Co-founder|President|Board Member|Board Chair|Chairman|Chairwoman|Managing Director|Country Manager|General Manager|Consultant|Senior Consultant|Advisor|Senior Advisor|Associate|Analyst)(?:\\s+(?:of|for|in|&|and)\\s+[A-Za-z\\s&]+?)?)(?:\\.|,|;|$)`, 'i'),
  ];

  for (const pattern of rolePatterns) {
    const match = pattern.exec(text);
    if (match) {
      let role = match[1].trim();
      // Clean trailing prepositions
      role = role.replace(/\s+(?:at|from|in|and|who|the)$/i, '').trim();
      if (role.length >= 2) return role;
    }
  }
  return null;
}

// ── Organization patterns ──

const ORG_PATTERNS = [
  // "from/at/of/with Equinor" — expanded terminators
  /(?:from|at|of|with|for|joined|left|works? (?:at|for))\s+([A-Z][a-zA-Z&.\s]+?)(?:\.|,|;|\s+(?:who|and|today|yesterday|this|last|about|regarding|we|they|he|she|it|I|where|which|that|as|to|is|are|was|were|has|had))/g,
  // "Equinor's X" — possessive
  /([A-Z][a-zA-Z&.]+)(?:'s\s+)/g,
  // "the team at Equinor" / "people at Equinor"
  /(?:team|people|group|department|division|office)\s+(?:at|in|from)\s+([A-Z][a-zA-Z&.\s]+?)(?:\.|,|;|\s)/g,
  // "Board of Cognite"
  /[Bb]oard\s+of\s+([A-Z][a-zA-Z&.\s]+?)(?:\s+(?:needs?|is|has|had|wants?|will|should|must|meets?)|\.)/g,
];

// ── Action patterns — improved with due date extraction ──

const ACTION_PATTERNS = [
  // "need to/should/must..." with optional due date
  /(?:I\s+)?(?:need to|should|must|have to|going to|will|promised to|agreed to|plan to|want to|ought to)\s+(.+?)(?:\.|$)/gim,
  // "follow up/reach out/send/schedule..."
  /(?:follow[- ]?up|reach out|get back|send|schedule|book|arrange|set up|prepare|draft|write|call|email|contact|connect|ping|circle back)\s+(?:with\s+|to\s+|on\s+)?(.+?)(?:\.|$)/gim,
  // "action item: ..." / "TODO: ..."
  /(?:action(?:\s+item)?|todo|task|to-do|reminder|don't forget|remember to):\s*(.+?)(?:\.|$)/gim,
  // "He/She asked me to..." / "They want us to..."
  /(?:asked|wants?|requested|expects?|suggested|recommended)\s+(?:me|us)\s+to\s+(.+?)(?:\.|$)/gim,
];

// ── Due date patterns for actions ──

const DUE_DATE_KEYWORDS: Array<{ pattern: RegExp; resolve: (match?: string) => string }> = [
  { pattern: /by (?:end of )?today/i, resolve: () => new Date().toISOString().slice(0, 10) },
  { pattern: /by (?:end of )?tomorrow/i, resolve: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); } },
  { pattern: /by (?:end of )?(?:this )?week/i, resolve: () => { const d = new Date(); d.setDate(d.getDate() + (5 - d.getDay())); return d.toISOString().slice(0, 10); } },
  { pattern: /by (?:end of )?next week/i, resolve: () => { const d = new Date(); d.setDate(d.getDate() + (12 - d.getDay())); return d.toISOString().slice(0, 10); } },
  { pattern: /by (?:end of )?(?:this )?month/i, resolve: () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().slice(0, 10); } },
  { pattern: /(?:by|before|due|on)\s+(?:next\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i, resolve: (dayName?: string) => {
    if (!dayName) return '';
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = days.indexOf(dayName.toLowerCase());
    const d = new Date();
    const current = d.getDay();
    let diff = target - current;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }},
];

function extractDueDate(actionText: string): string | null {
  for (const { pattern, resolve } of DUE_DATE_KEYWORDS) {
    const match = pattern.exec(actionText);
    if (match) return resolve(match[1]);
  }
  // Try explicit date patterns
  const dateMatch = actionText.match(/by\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (dateMatch) return dateMatch[1];
  const monthMatch = actionText.match(/by\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/i);
  if (monthMatch) return monthMatch[1];
  return null;
}

// ── Topic patterns — improved ──

const TOPIC_PATTERNS = [
  // "discussed X" / "talked about X" / "regarding X"
  /(?:discussed|talked about|spoke about|chatting about|mentioned|covered|regarding|about|re:|focused on|working on|looking (?:at|into))\s+(?:their\s+|the\s+|his\s+|her\s+|our\s+|a\s+)?([a-zA-Z][a-zA-Z\s]+?)(?:\s*[-—–]\s*|\.|,|;|\s+(?:and|with|for|which|that|targeting|they|he|she|we|it|is|are|was|were|has|had|will|should|could|would|might))/gi,
];

// ── Activity type detection ──

const ACTIVITY_TYPE_MAP: Array<{ pattern: RegExp; type: string; label: string }> = [
  { pattern: /(?:had|went to|attended|joined|was at|sat in on)\s+(?:a\s+)?(meeting|sync|standup|stand-up|one-on-one|1:1|review|workshop|session|presentation)/i, type: 'meeting', label: '' },
  { pattern: /(?:had|went for|went to|grabbed)\s+(?:a\s+)?(lunch|dinner|coffee|drinks|breakfast|brunch)/i, type: 'meeting', label: '' },
  { pattern: /(?:had|was on|joined|did)\s+(?:a\s+)?(call|phone call|video call|zoom|teams call)/i, type: 'call', label: 'Call' },
  { pattern: /(?:received|got|sent|wrote|drafted)\s+(?:an?\s+)?(email|message|text|note|letter|slack|dm)/i, type: 'email', label: 'Email' },
  { pattern: /(?:attended|went to|was at|joined)\s+(?:a\s+|the\s+)?(conference|event|summit|seminar|webinar|gala|reception|forum|symposium|meetup)/i, type: 'event', label: '' },
  { pattern: /(?:introduced|was introduced to|got introduced|intro(?:'d|duced))/i, type: 'intro', label: 'Introduction' },
];

// ── Date detection ──

function detectDate(text: string): string | null {
  const now = new Date();

  // Relative dates
  if (/\btoday\b/i.test(text)) return now.toISOString().slice(0, 10);
  if (/\byesterday\b/i.test(text)) { now.setDate(now.getDate() - 1); return now.toISOString().slice(0, 10); }
  if (/\bthis (?:morning|afternoon|evening)\b/i.test(text)) return now.toISOString().slice(0, 10);

  // "last Monday/Tuesday/..."
  const lastDayMatch = text.match(/last\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
  if (lastDayMatch) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = days.indexOf(lastDayMatch[1].toLowerCase());
    const current = now.getDay();
    let diff = current - target;
    if (diff <= 0) diff += 7;
    now.setDate(now.getDate() - diff);
    return now.toISOString().slice(0, 10);
  }

  // "on Monday/Tuesday/..." (this/next week)
  const onDayMatch = text.match(/(?:on\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
  if (onDayMatch) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = days.indexOf(onDayMatch[1].toLowerCase());
    const current = now.getDay();
    let diff = target - current;
    if (diff < 0) diff += 7;
    if (diff === 0) return now.toISOString().slice(0, 10);
    now.setDate(now.getDate() + diff);
    return now.toISOString().slice(0, 10);
  }

  if (/\blast week\b/i.test(text)) { now.setDate(now.getDate() - 7); return now.toISOString().slice(0, 10); }
  if (/\blast month\b/i.test(text)) { now.setMonth(now.getMonth() - 1); return now.toISOString().slice(0, 10); }

  // Explicit dates: "March 15" / "15/3/2026" / "2026-03-15"
  const explicitMatch = text.match(/(?:on\s+)?(\d{4}-\d{2}-\d{2})/);
  if (explicitMatch) return explicitMatch[1];

  const numericMatch = text.match(/(?:on\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (numericMatch) return numericMatch[1];

  const monthMatch = text.match(/(?:on\s+)?((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:(?:st|nd|rd|th))?(?:,?\s+\d{4})?)/i);
  if (monthMatch) return monthMatch[1];

  return null;
}

// ── Relationship inference between people ──

const RELATIONSHIP_PATTERNS = [
  // "X reports to Y" / "X works for Y"
  { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:reports to|works for|works under|is managed by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, relation: 'reports_to' },
  // "X manages Y" / "X leads Y"
  { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:manages|leads|supervises|oversees|mentors)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, relation: 'manages' },
  // "X introduced me to Y" — capture the relationship
  { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:introduced|connected)\s+(?:me|us)\s+(?:to|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, relation: 'introduced' },
  // "X knows Y" / "X and Y are old friends"
  { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:knows|is friends with|is close to|recommended)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, relation: 'knows' },
  // "X replaced Y" / "X succeeded Y"
  { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:replaced|succeeded|took over from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, relation: 'replaced' },
];

// ── Candidate entity filter ──

const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see',
  'way', 'who', 'did', 'get', 'let', 'say', 'she', 'too', 'use',
  'today', 'yesterday', 'tomorrow', 'this', 'that', 'with', 'from', 'they', 'been',
  'have', 'each', 'make', 'like', 'long', 'look', 'many', 'some', 'them', 'then',
  'will', 'about', 'their', 'which', 'would', 'there', 'could', 'other', 'after',
  'board', 'also', 'back', 'into', 'than', 'only', 'come', 'made', 'just', 'over',
  'such', 'take', 'last', 'very', 'need', 'know', 'well', 'good', 'much', 'been',
  'meeting', 'call', 'email', 'lunch', 'dinner', 'discussed', 'mentioned',
  'action', 'item', 'follow', 'here', 'what', 'when', 'more', 'most', 'both',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'his colleague', 'her colleague', 'their', 'my colleague',
  'next week', 'last week', 'this week', 'end of',
]);

function isCommonWord(name: string): boolean {
  return COMMON_WORDS.has(name.toLowerCase());
}

function isPronoun(name: string): boolean {
  const pronouns = new Set(['he', 'she', 'they', 'we', 'his', 'her', 'their', 'my', 'i', 'me', 'us', 'it']);
  return pronouns.has(name.toLowerCase());
}

// Words that look like names but are actually titles/roles/common prefixes
const TITLE_WORDS = new Set([
  'senior', 'junior', 'chief', 'lead', 'head', 'director', 'manager', 'partner',
  'president', 'chairman', 'chairwoman', 'founder', 'advisor', 'consultant',
  'associate', 'analyst', 'principal', 'executive', 'officer', 'vice',
  'general', 'regional', 'country', 'managing', 'board', 'member',
  'met', 'got', 'had', 'set', 'new', 'old', 'big', 'top',
]);

// Words that are organization suffixes (not person names)
const ORG_SUFFIXES = new Set([
  'head', 'group', 'team', 'board', 'committee', 'division', 'department',
  'office', 'council', 'foundation', 'institute', 'corp', 'inc', 'ltd',
  'solutions', 'technologies', 'services', 'systems', 'energy', 'capital',
]);

/** Validate a candidate person name */
function isValidPersonName(name: string): boolean {
  if (!name || name.length < 3) return false;
  if (isCommonWord(name)) return false;
  if (isPronoun(name)) return false;
  // Must have at least 2 words (first + last name)
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;
  // Each part must start with uppercase
  if (!parts.every(p => /^[A-Z]/.test(p))) return false;
  // Filter out names that are just common words combined
  if (parts.every(p => COMMON_WORDS.has(p.toLowerCase()))) return false;
  // Filter out title-only "names" like "Senior Director"
  if (parts.every(p => TITLE_WORDS.has(p.toLowerCase()))) return false;
  // Filter out if first word is a title word and second is also a title word
  if (parts.length === 2 && TITLE_WORDS.has(parts[0].toLowerCase()) && TITLE_WORDS.has(parts[1].toLowerCase())) return false;
  // Filter out if first word is a verb/action word that got capitalized (sentence start)
  if (TITLE_WORDS.has(parts[0].toLowerCase())) return false;
  // Filter out org-like names (e.g., "Equinor Head", "Cognite Solutions")
  if (ORG_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════

export function extractAndStore(db: DbAdapter, text: string): ExtractionResult {
  const result: ExtractionResult = {
    people: [],
    organizations: [],
    topics: [],
    actions: [],
    relationships: 0,
    raw_text_stored: false,
  };

  const seenPeople = new Set<string>();
  const seenOrgs = new Set<string>();
  const seenTopics = new Set<string>();
  const seenActions = new Set<string>();

  // ── Extract People ──
  // Two passes: first collect all person+org pairs, then deduplicate
  const personMatches: Array<{ name: string; org?: string; patternIndex: number }> = [];

  for (let pi = 0; pi < PERSON_PATTERNS.length; pi++) {
    const pattern = PERSON_PATTERNS[pi];
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (!isValidPersonName(name)) continue;
      const org = match[2]?.trim();
      personMatches.push({ name, org: (org && !isCommonWord(org) && !isPronoun(org)) ? org : undefined, patternIndex: pi });
    }
  }

  // Deduplicate: merge org info from later patterns into first match
  const personMap = new Map<string, { name: string; org?: string }>();
  for (const pm of personMatches) {
    const key = pm.name.toLowerCase();
    if (!personMap.has(key)) {
      personMap.set(key, { name: pm.name, org: pm.org });
    } else if (pm.org && !personMap.get(key)!.org) {
      personMap.get(key)!.org = pm.org;
    }
  }

  for (const { name, org } of personMap.values()) {
    if (seenPeople.has(name.toLowerCase())) continue;

    const role = extractRoleForPerson(text, name);

    const existingPerson = db.get<{ id: number }>('SELECT id FROM people WHERE name = ? COLLATE NOCASE', [name]);
    const fuzzyMatch = !existingPerson ? findPerson(db, name) : null;
    const isExisting = !!existingPerson || (fuzzyMatch !== null && fuzzyMatch.score >= 0.85);

    const id = resolvePerson(db, name, org, role || undefined);
    seenPeople.add(name.toLowerCase());

    result.people.push({
      id,
      name,
      status: isExisting ? 'matched' : 'created',
      org,
      role: role || undefined,
    });

    // Track org from person context
    if (org && !seenOrgs.has(org.toLowerCase())) {
      const existingOrg = db.get<{ id: number }>('SELECT id FROM organizations WHERE name = ? COLLATE NOCASE', [org]);
      const orgId = resolveOrg(db, org);
      seenOrgs.add(org.toLowerCase());
      result.organizations.push({
        id: orgId,
        name: org,
        status: existingOrg ? 'matched' : 'created',
      });
    }
  }

  // ── Extract Organizations (standalone mentions) ──
  for (const pattern of ORG_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let name = match[1]?.trim();
      if (!name || name.length < 2 || seenOrgs.has(name.toLowerCase())) continue;
      if (isCommonWord(name) || isPronoun(name)) continue;
      if (!/^[A-Z]/.test(name)) continue;

      // Clean trailing whitespace/words
      name = name.replace(/\s+$/, '').trim();
      // Don't add if it's a known person name
      if (seenPeople.has(name.toLowerCase())) continue;

      const existingOrg = db.get<{ id: number }>('SELECT id FROM organizations WHERE name = ? COLLATE NOCASE', [name]);
      const id = resolveOrg(db, name);
      seenOrgs.add(name.toLowerCase());

      result.organizations.push({
        id,
        name,
        status: existingOrg ? 'matched' : 'created',
      });
    }
  }

  // ── Extract Topics ──
  for (const pattern of TOPIC_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let name = match[1]?.trim();
      if (!name || name.length < 3 || seenTopics.has(name.toLowerCase())) continue;
      // Clean up
      name = name.replace(/\s+(and|or|but|the|a|an|to|in|on|at|by)$/i, '').trim();
      if (name.length < 3) continue;
      // Skip if it's a person or org we already captured
      if (seenPeople.has(name.toLowerCase()) || seenOrgs.has(name.toLowerCase())) continue;

      const existingTopic = db.get<{ id: number }>('SELECT id FROM topics WHERE name = ? COLLATE NOCASE', [name]);
      const id = resolveTopic(db, name);
      seenTopics.add(name.toLowerCase());

      result.topics.push({
        id,
        name,
        status: existingTopic ? 'matched' : 'created',
      });
    }
  }

  // ── Extract Actions ──
  for (const pattern of ACTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let title = match[1]?.trim();
      if (!title || title.length < 5) continue;
      if (title.length > 200) title = title.slice(0, 200);

      // Dedup actions — check if this is a substring of an existing action or vice versa
      const titleLower = title.toLowerCase();
      let isDuplicate = false;
      for (const existing of seenActions) {
        if (existing.includes(titleLower) || titleLower.includes(existing)) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;
      seenActions.add(titleLower);

      // Extract due date from action text
      const dueDate = extractDueDate(title);

      // Try to find an owner
      let ownerId: number | null = null;
      let ownerName: string | undefined;
      for (const p of result.people) {
        const firstName = p.name.split(' ')[0].toLowerCase();
        if (title.toLowerCase().includes(firstName)) {
          ownerId = p.id;
          ownerName = p.name;
          break;
        }
      }

      const actionResult = db.run(
        'INSERT INTO actions (title, owner_id, due_date) VALUES (?, ?, ?)',
        [title, ownerId, dueDate],
      );

      result.actions.push({
        id: actionResult.lastInsertRowid,
        title,
        owner: ownerName,
        due_date: dueDate || undefined,
      });
    }
  }

  // ── Detect Activity Type ──
  let activityType = 'other';
  let activityLabel = '';
  for (const { pattern, type, label } of ACTIVITY_TYPE_MAP) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      activityType = type;
      activityLabel = label || (match[1] ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : type.charAt(0).toUpperCase() + type.slice(1));
      break;
    }
  }

  // ── Detect Date ──
  const activityDate = detectDate(text);

  // ── Build Activity Title ──
  let activityTitle = activityLabel;
  if (result.people.length > 0) {
    const names = result.people.map(p => p.name).join(', ');
    activityTitle = activityTitle
      ? `${activityTitle} with ${names}`
      : `Interaction with ${names}`;
  }

  // ── Create Activity Record ──
  if (result.people.length > 0 || result.topics.length > 0) {
    const truncatedText = text.length > 2000 ? text.slice(0, 2000) + '...' : text;
    const activityResult = db.run(
      'INSERT INTO activities (type, title, date, summary) VALUES (?, ?, ?, ?)',
      [activityType, activityTitle, activityDate, truncatedText],
    );
    result.activity = {
      id: activityResult.lastInsertRowid,
      type: activityType,
      title: activityTitle,
      date: activityDate,
    };

    // Link entities to activity
    for (const person of result.people) {
      createRelationship(db, 'person', person.id, 'activity', activityResult.lastInsertRowid, 'participated_in');
      result.relationships++;
    }
    for (const org of result.organizations) {
      createRelationship(db, 'organization', org.id, 'activity', activityResult.lastInsertRowid, 'involved_in');
      result.relationships++;
    }
    for (const topic of result.topics) {
      createRelationship(db, 'topic', topic.id, 'activity', activityResult.lastInsertRowid, 'discussed_in');
      result.relationships++;
    }
    for (const action of result.actions) {
      createRelationship(db, 'action', action.id, 'activity', activityResult.lastInsertRowid, 'arose_from');
      result.relationships++;
    }
  }

  // ── Infer People-to-People Relationships ──
  for (const { pattern, relation } of RELATIONSHIP_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name1 = match[1]?.trim();
      const name2 = match[2]?.trim();
      if (!isValidPersonName(name1) || !isValidPersonName(name2)) continue;

      const person1 = findPerson(db, name1);
      const person2 = findPerson(db, name2);
      if (person1 && person2) {
        createRelationship(db, 'person', person1.id, 'person', person2.id, relation);
        result.relationships++;
      }
    }
  }

  // ── Link People ↔ Orgs ──
  for (const person of result.people) {
    if (person.org) {
      const orgMatch = result.organizations.find(
        o => o.name.toLowerCase() === person.org!.toLowerCase(),
      );
      if (orgMatch) {
        createRelationship(db, 'person', person.id, 'organization', orgMatch.id, 'works_at');
        result.relationships++;
      }
    }
  }

  // ── People who participated together are connected ──
  if (result.people.length >= 2) {
    for (let i = 0; i < result.people.length; i++) {
      for (let j = i + 1; j < result.people.length; j++) {
        createRelationship(db, 'person', result.people[i].id, 'person', result.people[j].id, 'met_with');
        result.relationships++;
      }
    }
  }

  // ── Store Raw Text as Note ──
  const noteResult = db.run('INSERT INTO notes (content) VALUES (?)', [text]);
  result.raw_text_stored = true;

  if (result.activity) {
    createRelationship(db, 'note', noteResult.lastInsertRowid, 'activity', result.activity.id, 'source_of');
    result.relationships++;
  }

  return result;
}
