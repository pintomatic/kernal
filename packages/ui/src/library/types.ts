export type ProcessingTier = 'EXTRACTED' | 'SUMMARIZED' | 'LINKED';
export type EvidenceQuality = 'VERBATIM' | 'ASSEMBLED' | 'INTERPRETED';
export type TrustSignal = 'FRESH' | 'STALE' | 'SPARSE';

export interface Passage {
  id: string;
  text: string;
  confidence: EvidenceQuality;
  assembledFrom?: number[];
}

export interface WikiSection {
  sectionId: string;
  sectionTitle: string;
  passages: Passage[];
  sourceCount: number;
}

export interface WikiSource {
  id: number;
  title: string;
  type: string;
  date: string;
  tier: ProcessingTier;
  excerpt?: string;
  sections: string[];
}

export interface WikiPage {
  id: number;
  title: string;
  domain: string;
  synthesis: string;
  sections: WikiSection[];
  sources: WikiSource[];
  trustSignal: TrustSignal;
  sourceCount: number;
  extractedCount: number;
  lastSynced: string;
  relatedPages: { id: number; title: string }[];
  relatedEntities: { id: number; type: string; name: string }[];
}

export interface LibraryCluster {
  id: string;
  label: string;
  description: string;
  pageCount: number;
  sourceCount: number;
  icon: string;
}

export interface SearchResult {
  id: number;
  title: string;
  excerpt: string;
  domain: string;
  sourceCount: number;
  extractedCount: number;
  trustSignal: TrustSignal;
}

// ── API Response Types ────────────────────────────────────────────────────────

export interface LibraryStats {
  pageCount: number;
  sourceCount: number;
  extractedCount: number;
  pendingCount: number;
  lastSync: string | null;
}

export interface LibraryClusterApi {
  domain: string;
  pageCount: number;
  sourceCount: number;
  trustSignal: TrustSignal;
}

export interface LibrarySearchResult {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  domain: string;
  source_count: number;
  extracted_count: number;
  trust_signal: TrustSignal;
  last_synthesized_at: string | null;
}

export interface LibraryPagePassage {
  id: number;
  source_id: number;
  text: string;
  confidence: EvidenceQuality;
  assembled_from: number[];
}

export interface LibraryPageSection {
  id: number;
  section_slug: string;
  title: string;
  display_order: number;
  source_count: number;
  passages: LibraryPagePassage[];
}

export interface LibraryPageSource {
  id: number;
  title: string;
  type: string;
  date: string;
  tier: ProcessingTier;
  sections: string[];
  excerpt?: string;
}

export interface LibraryPageFull {
  id: number;
  slug: string;
  title: string;
  domain: string;
  synthesis: string;
  trust_signal: TrustSignal;
  last_synthesized_at: string | null;
  source_count: number;
  extracted_count: number;
  sections: LibraryPageSection[];
  sources: LibraryPageSource[];
  related_entities: Array<{ entity_type: string; entity_id: number; name: string }>;
  related_pages: Array<{ id: number; title: string; slug: string }>;
}

export interface LibraryRecentSource {
  id: number;
  title: string;
  library_tier: ProcessingTier;
  created_at: string;
}

// ── Mock Data (kept for testing/fallback) ─────────────────────────────────────

export const MOCK_CLUSTERS: LibraryCluster[] = [
  {
    id: 'people',
    label: 'People & Orgs',
    description: 'Contacts, relationships, stakeholder profiles',
    pageCount: 34,
    sourceCount: 89,
    icon: '👤',
  },
  {
    id: 'market',
    label: 'Market Intelligence',
    description: 'Industry trends, competitor analysis, market data',
    pageCount: 12,
    sourceCount: 47,
    icon: '📊',
  },
  {
    id: 'strategy',
    label: 'Strategy & Decisions',
    description: 'Frameworks, strategic plans, key decisions made',
    pageCount: 8,
    sourceCount: 31,
    icon: '🧭',
  },
  {
    id: 'deals',
    label: 'Deals & GTM',
    description: 'Sales playbooks, deal learnings, GTM patterns',
    pageCount: 15,
    sourceCount: 52,
    icon: '🤝',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Architecture notes, system designs, tech patterns',
    pageCount: 6,
    sourceCount: 18,
    icon: '⚙️',
  },
  {
    id: 'context',
    label: 'Company Context',
    description: 'Culture, processes, org knowledge',
    pageCount: 9,
    sourceCount: 27,
    icon: '🏢',
  },
];

export const MOCK_STATS: LibraryStats = {
  pageCount: 84,
  sourceCount: 264,
  extractedCount: 198,
  pendingCount: 3,
  lastSync: '2h ago',
};

export const MOCK_WIKI_PAGE: WikiPage = {
  id: 1,
  title: 'Kernal GTM Strategy',
  domain: 'strategy',
  synthesis: `Kernal's go-to-market approach centers on demo-led adoption rather than email outreach. The core insight — validated across multiple sessions — is that showing a working system to a warm lead converts better than cold messaging at scale.

The primary target segments are professional services firms (consulting, law, exec search) where relationship density and institutional memory are competitive differentiators. Secondary targets include independent practitioners who lack enterprise IT infrastructure.

Pricing was set at 2,500 EUR pilot + 200-500 EUR/mo SaaS. The pilot fee positions it as a serious purchase, not a free trial, while filtering for buyers with real budget authority.`,
  sections: [
    {
      sectionId: 'positioning',
      sectionTitle: 'Positioning',
      sourceCount: 3,
      passages: [
        { id: 'p1', text: 'Demo-led adoption rather than email outreach', confidence: 'VERBATIM' },
        {
          id: 'p2',
          text: 'Professional services firms where relationship density is a competitive differentiator',
          confidence: 'ASSEMBLED',
          assembledFrom: [1, 3],
        },
      ],
    },
    {
      sectionId: 'pricing',
      sectionTitle: 'Pricing',
      sourceCount: 2,
      passages: [
        {
          id: 'p3',
          text: '2,500 EUR pilot + 200-500 EUR/mo SaaS. Pilot fee filters for budget authority.',
          confidence: 'VERBATIM',
        },
      ],
    },
    {
      sectionId: 'targets',
      sectionTitle: 'Target Segments',
      sourceCount: 1,
      passages: [],
    },
  ],
  sources: [
    {
      id: 1,
      title: 'Kernal commercial model session',
      type: 'transcript',
      date: '2026-05-08',
      tier: 'EXTRACTED',
      excerpt: 'Demo-led approach validated in BackerSkeie demo',
      sections: ['positioning'],
    },
    {
      id: 2,
      title: 'Pricing analysis doc',
      type: 'document',
      date: '2026-04-30',
      tier: 'EXTRACTED',
      excerpt: 'Pilot pricing at 2,500 EUR filters for serious buyers',
      sections: ['pricing'],
    },
    {
      id: 3,
      title: 'GTM planning session',
      type: 'transcript',
      date: '2026-05-02',
      tier: 'SUMMARIZED',
      excerpt: 'Professional services focus confirmed',
      sections: ['positioning'],
    },
    {
      id: 4,
      title: 'Product brief v2',
      type: 'article',
      date: '2026-04-15',
      tier: 'LINKED',
      sections: ['targets'],
    },
  ],
  trustSignal: 'STALE',
  sourceCount: 4,
  extractedCount: 2,
  lastSynced: '3 days ago',
  relatedPages: [
    { id: 2, title: 'BackerSkeie Demo Learnings' },
    { id: 3, title: 'Professional Services ICP' },
  ],
  relatedEntities: [
    { id: 1, type: 'deal', name: 'BackerSkeie → adoption' },
    { id: 2, type: 'person', name: 'Stefan Forsberg' },
  ],
};
