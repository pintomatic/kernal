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

export function registerTools(server: McpServer, db: DbAdapter): void {
  server.tool(
    'kernal_remember',
    'Extract entities (people, organizations, topics) and relationships from natural conversation text. Call this when the user tells you about meetings, calls, introductions, or any interaction worth remembering.',
    {
      text: z.string().describe('The natural language text to extract entities and relationships from'),
    },
    async ({ text }) => handleRemember(db, { text }),
  );

  server.tool(
    'kernal_recall',
    'Search the knowledge base for people, organizations, activities, topics, actions, or notes matching a query. Use natural language or keywords.',
    {
      query: z.string().describe('Search query — a name, topic, keyword, or phrase'),
      type: z.enum(['people', 'organizations', 'activities', 'topics', 'actions', 'notes']).optional().describe('Limit search to a specific entity type'),
    },
    async ({ query, type }) => handleRecall(db, { query, type }),
  );

  server.tool(
    'kernal_people',
    'List or search contacts in the knowledge base. Filter by name, organization, or role.',
    {
      name: z.string().optional().describe('Filter by person name (partial match)'),
      org: z.string().optional().describe('Filter by organization name (partial match)'),
      role: z.string().optional().describe('Filter by role/title (partial match)'),
      limit: z.number().optional().describe('Max results to return (default 50)'),
    },
    async (args) => handlePeople(db, args),
  );

  server.tool(
    'kernal_orgs',
    'List or search organizations in the knowledge base. Filter by name, type, or industry.',
    {
      name: z.string().optional().describe('Filter by organization name (partial match)'),
      type: z.enum(['client', 'partner', 'prospect', 'employer', 'other']).optional().describe('Filter by organization type'),
      industry: z.string().optional().describe('Filter by industry (partial match)'),
      limit: z.number().optional().describe('Max results to return (default 50)'),
    },
    async (args) => handleOrgs(db, args),
  );

  server.tool(
    'kernal_activities',
    'List recent interactions — meetings, calls, emails, events. Filter by type, person, organization, or date range.',
    {
      type: z.enum(['meeting', 'call', 'email', 'event', 'intro', 'other']).optional().describe('Filter by activity type'),
      person: z.string().optional().describe('Filter by participant name (partial match)'),
      org: z.string().optional().describe('Filter by organization name (partial match)'),
      days: z.number().optional().describe('Show activities from the last N days'),
      limit: z.number().optional().describe('Max results to return (default 30)'),
    },
    async (args) => handleActivities(db, args),
  );

  server.tool(
    'kernal_actions',
    'List action items and follow-ups. By default shows open items, sorted by due date.',
    {
      status: z.enum(['open', 'done', 'cancelled', 'all']).optional().describe('Filter by status (default: open)'),
      owner: z.string().optional().describe('Filter by owner name (partial match)'),
      due_before: z.string().optional().describe('Show actions due before this date (YYYY-MM-DD)'),
      limit: z.number().optional().describe('Max results to return (default 50)'),
    },
    async (args) => handleActions(db, args),
  );

  server.tool(
    'kernal_context',
    'Get a full briefing on a person or organization — all related activities, actions, topics, and connections in one view. Like a meeting-prep dossier.',
    {
      name: z.string().describe('Person or organization name to get context for'),
    },
    async ({ name }) => handleContext(db, { name }),
  );

  server.tool(
    'kernal_correct',
    'Fix errors in the knowledge base — update fields, delete entities, merge duplicates, or reset the entire database.',
    {
      action: z.enum(['update', 'delete', 'merge', 'reset']).describe('The correction action: update, delete, merge, or reset (wipes all data)'),
      entity_type: z.enum(['people', 'organizations', 'activities', 'topics', 'actions', 'notes']).optional().describe('The type of entity to correct (not needed for reset)'),
      id: z.number().optional().describe('The ID of the entity to correct (not needed for reset)'),
      updates: z.record(z.unknown()).optional().describe('For update action: fields to update as key-value pairs'),
      merge_into_id: z.number().optional().describe('For merge action: the ID to merge into (source is deleted, target is kept)'),
    },
    async (args) => handleCorrect(db, args),
  );
}
