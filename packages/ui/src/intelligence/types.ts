export interface Memory {
  id: number;
  entity_id?: number;
  entity_name?: string;
  text: string;
  confidence: 'OBSERVED' | 'INFERRED';
  domain?: string;
  reinforcement_count: number;
  first_observed_at: string;
  last_reinforced_at: string;
  expires_at?: string;
  archived_at?: string;
  conflict_with?: number;
  conflict_dismissed?: boolean;
  promoted_to_pattern?: number;
  promoted_pattern_title?: string;
  superseded_by_id?: number;
  session_source?: string;
  deleted_at?: string;
}

export interface Pattern {
  id: number;
  title: string;
  type: 'RULE' | 'HEURISTIC';
  domain: 'Build' | 'GTM' | 'Trade' | 'Personal';
  status: 'ACTIVE' | 'CHALLENGED' | 'DEPRECATED';
  apply_when?: string;
  observation_count: number;
  violation_count: number;
  confirmation_count: number;
  counter_example_count: number;
  notes: string[];
  first_observed_at: string;
  last_reinforced_at: string;
  source_memory_id?: number;
  created_at: string;
}

export interface SituationSummary {
  memories: Memory[];
  hasUpcomingMeeting: boolean;
  daysUntilMeeting: number | null;
  totalConsidered: number;
}

export interface IntelStats {
  memoryCount: number;
  patternCount: number;
  lastVisit: string | null;
  domainBreakdown: { domain: string; count: number; archived_count: number }[];
}

export const INTEL_COLORS = {
  accent: '#1e40af',
  observed: '#166534',
  inferred: '#6b7280',
  ruleBadge: '#1e3a5f',
  heuristicBorder: '#1e40af',
  active: '#166534',
  challenged: '#f59e0b',
  deprecated: '#9ca3af',
  conflict: '#f59e0b',
  expiring: '#9ca3af',
} as const;
