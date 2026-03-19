import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handleRemember(db: DbAdapter, args: { text: string }) {
  const { text } = args;
  if (!text || text.trim().length === 0) {
    return textResult({ error: 'No text provided.' });
  }

  // Store raw text as a note
  const noteResult = db.run('INSERT INTO notes (content) VALUES (?)', [text]);

  // Return existing entities so Claude can check for duplicates
  const existingPeople = db.all<{ id: number; name: string; role: string | null; org_name: string | null }>(
    `SELECT p.id, p.name, p.role, o.name as org_name FROM people p
     LEFT JOIN organizations o ON p.org_id = o.id
     ORDER BY p.updated_at DESC LIMIT 50`,
  );
  const existingOrgs = db.all<{ id: number; name: string }>(
    'SELECT id, name FROM organizations ORDER BY updated_at DESC LIMIT 50',
  );

  const instructions = `## Stored as note #${noteResult.lastInsertRowid}

Now extract entities from the text above and store them using these tools:

1. **People** — For each person mentioned, call \`kernal_add_person\` with their name, role, and organization. Check the existing people list below to avoid duplicates — if someone already exists, skip them or use \`kernal_correct\` to update their info.

2. **Organizations** — For each company/org mentioned, call \`kernal_add_org\` with name, industry, and type. Check existing orgs below.

3. **Activity** — Call \`kernal_add_activity\` once to log this interaction. Include the type (meeting/call/email/event/intro/other), title, date, summary, and the names of participants and organizations involved.

4. **Actions** — For any follow-ups, promises, or tasks mentioned, call \`kernal_add_action\` with the action title, owner (if clear), and due date (if mentioned).

5. **Relationships** — Call \`kernal_link\` to connect people to each other if the text reveals relationships (e.g., "reports to", "introduced me to", "knows").

### Existing People (check for duplicates)
${existingPeople.length > 0
    ? existingPeople.map(p => `- #${p.id} ${p.name}${p.role ? ` (${p.role})` : ''}${p.org_name ? ` @ ${p.org_name}` : ''}`).join('\n')
    : '_(none yet)_'}

### Existing Organizations
${existingOrgs.length > 0
    ? existingOrgs.map(o => `- #${o.id} ${o.name}`).join('\n')
    : '_(none yet)_'}`;

  return textResult(instructions);
}
