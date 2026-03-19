import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DbAdapter } from '../db/adapter.js';
import { handleRemember } from './remember.js';
import { handleRecall } from './recall.js';
import { handlePeople } from './people.js';
import { handleOrgs } from './orgs.js';
import { handleActivities } from './activities.js';
import { handleActions } from './actions.js';
import { handleContext } from './context.js';
import { handleCorrect } from './correct.js';
import { handleAddPerson } from './add-person.js';
import { handleAddOrg } from './add-org.js';
import { handleAddActivity } from './add-activity.js';
import { handleAddAction } from './add-action.js';
import { handleLink } from './link.js';

export function registerTools(server: McpServer, db: DbAdapter): void {

  // ── Ingestion ──

  server.tool(
    'kernal_remember',
    'Store raw text and get instructions for extracting entities. Call this FIRST when the user shares meeting notes, call summaries, or any interaction. It saves the text and tells you which entities to extract and store using the add/link tools.',
    {
      text: z.string().describe('The raw text to remember — meeting notes, conversation summary, transcript, etc.'),
    },
    async ({ text }) => handleRemember(db, { text }),
  );

  server.tool(
    'kernal_add_person',
    'Add a person to the knowledge base. Automatically deduplicates — if the person already exists (fuzzy name match), updates their record with any new info instead of creating a duplicate.',
    {
      name: z.string().describe('Full name of the person'),
      role: z.string().optional().describe('Job title or role (e.g., "VP of Digital", "CEO", "Partner")'),
      org: z.string().optional().describe('Organization name they belong to'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      linkedin: z.string().optional().describe('LinkedIn URL or handle'),
      notes: z.string().optional().describe('Freeform notes about this person'),
    },
    async (args) => handleAddPerson(db, args),
  );

  server.tool(
    'kernal_add_org',
    'Add an organization to the knowledge base. Automatically deduplicates — if the org already exists (fuzzy name match), updates their record with any new info.',
    {
      name: z.string().describe('Organization name'),
      industry: z.string().optional().describe('Industry (e.g., "Energy", "Technology", "Media")'),
      type: z.enum(['client', 'partner', 'prospect', 'employer', 'other']).optional().describe('Relationship type'),
      website: z.string().optional().describe('Website URL'),
      notes: z.string().optional().describe('Freeform notes'),
    },
    async (args) => handleAddOrg(db, args),
  );

  server.tool(
    'kernal_add_activity',
    'Log an interaction — meeting, call, email, event, or introduction. Links to participants and organizations by name.',
    {
      type: z.enum(['meeting', 'call', 'email', 'event', 'intro', 'other']).describe('Type of interaction'),
      title: z.string().describe('Short title (e.g., "Lunch with Jonas and Sofia")'),
      date: z.string().optional().describe('Date of the interaction (YYYY-MM-DD)'),
      summary: z.string().optional().describe('Summary of what was discussed'),
      participants: z.array(z.string()).optional().describe('Names of people involved — must already exist in the knowledge base'),
      organizations: z.array(z.string()).optional().describe('Names of organizations involved'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (args) => handleAddActivity(db, args),
  );

  server.tool(
    'kernal_add_action',
    'Create a follow-up or task. Optionally assign to a person by name.',
    {
      title: z.string().describe('What needs to be done'),
      owner: z.string().optional().describe('Name of the person responsible (must exist in knowledge base)'),
      due_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Additional context'),
    },
    async (args) => handleAddAction(db, args),
  );

  server.tool(
    'kernal_link',
    'Create a relationship between two entities (people, organizations, or topics). Use for connections like "reports_to", "introduced", "knows", "works_at", "competes_with", etc.',
    {
      source_type: z.enum(['person', 'organization', 'topic']).describe('Type of the source entity'),
      source_name: z.string().describe('Name of the source entity'),
      target_type: z.enum(['person', 'organization', 'topic']).describe('Type of the target entity'),
      target_name: z.string().describe('Name of the target entity'),
      relation: z.string().describe('Relationship label (e.g., "reports_to", "introduced", "knows", "competes_with")'),
    },
    async (args) => handleLink(db, args),
  );

  // ── Query ──

  server.tool(
    'kernal_recall',
    'Search the knowledge base for people, organizations, activities, topics, actions, or notes matching a query.',
    {
      query: z.string().describe('Search query — a name, topic, keyword, or phrase'),
      type: z.enum(['people', 'organizations', 'activities', 'topics', 'actions', 'notes']).optional().describe('Limit search to a specific entity type'),
    },
    async ({ query, type }) => handleRecall(db, { query, type }),
  );

  server.tool(
    'kernal_people',
    'List or search contacts in the knowledge base.',
    {
      name: z.string().optional().describe('Filter by person name (partial match)'),
      org: z.string().optional().describe('Filter by organization name (partial match)'),
      role: z.string().optional().describe('Filter by role/title (partial match)'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async (args) => handlePeople(db, args),
  );

  server.tool(
    'kernal_orgs',
    'List or search organizations in the knowledge base.',
    {
      name: z.string().optional().describe('Filter by organization name (partial match)'),
      type: z.enum(['client', 'partner', 'prospect', 'employer', 'other']).optional().describe('Filter by organization type'),
      industry: z.string().optional().describe('Filter by industry (partial match)'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async (args) => handleOrgs(db, args),
  );

  server.tool(
    'kernal_activities',
    'List recent interactions — meetings, calls, emails, events.',
    {
      type: z.enum(['meeting', 'call', 'email', 'event', 'intro', 'other']).optional().describe('Filter by activity type'),
      person: z.string().optional().describe('Filter by participant name (partial match)'),
      org: z.string().optional().describe('Filter by organization name (partial match)'),
      days: z.number().optional().describe('Show activities from the last N days'),
      limit: z.number().optional().describe('Max results (default 30)'),
    },
    async (args) => handleActivities(db, args),
  );

  server.tool(
    'kernal_actions',
    'List action items and follow-ups. By default shows open items.',
    {
      status: z.enum(['open', 'done', 'cancelled', 'all']).optional().describe('Filter by status (default: open)'),
      owner: z.string().optional().describe('Filter by owner name (partial match)'),
      due_before: z.string().optional().describe('Show actions due before this date (YYYY-MM-DD)'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async (args) => handleActions(db, args),
  );

  server.tool(
    'kernal_context',
    'Get a full briefing on a person or organization — timeline, network, topics, actions. Like a meeting-prep dossier.',
    {
      name: z.string().describe('Person or organization name'),
    },
    async ({ name }) => handleContext(db, { name }),
  );

  // ── Corrections ──

  server.tool(
    'kernal_correct',
    'Fix errors — update fields, delete entities, merge duplicates, or reset the entire database.',
    {
      action: z.enum(['update', 'delete', 'merge', 'reset']).describe('update, delete, merge, or reset (wipes all data)'),
      entity_type: z.enum(['people', 'organizations', 'activities', 'topics', 'actions', 'notes']).optional().describe('Entity type (not needed for reset)'),
      id: z.number().optional().describe('Entity ID (not needed for reset)'),
      updates: z.record(z.unknown()).optional().describe('For update: fields to change as key-value pairs'),
      merge_into_id: z.number().optional().describe('For merge: ID to merge into (source gets deleted)'),
    },
    async (args) => handleCorrect(db, args),
  );
}
