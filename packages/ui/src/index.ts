// Config & API utilities
export { configureKernalUI, getApiBase, getAuthHeaders, getApiKey, fetchKernal, useApi, patchAction } from './config';
export type { GraphData, TimelineData, ActionsData, ActionItem, StatsData } from './config';

// Shared types
export type { EntityFocus } from './types';

// Graph theme
export { getNodeColor, getNodeSize, GRAPH_NODE_CONFIG } from './graph-theme';
export type { NodeType } from './graph-theme';

// Entity cache & badge
export {
  EntityCacheContext,
  EntityCacheProvider,
  useEntityCacheUpdater,
  useEntity,
  useEntityLinks,
  showSaveError,
  EntityBadge,
} from './entity-badge';
export type { Entity, EntityLink } from './entity-badge';

// Components (default exports)
export { default as ActionItems } from './action-items';
export { default as CohortMinimap } from './cohort-minimap';
export { default as ContextPanel } from './context-panel';
export { default as DashboardSearch } from './dashboard-search';
export { default as DealBoard } from './deal-board';
export { default as DossierRouter, DossierHeader } from './dossier-router';
export { default as FilterBar } from './filter-bar';
export { default as GoalBoard } from './goal-board';
export { default as IntelligencePanel } from './intelligence-panel';
export { default as KnowledgeView } from './knowledge-view';
export { default as MobileBlock } from './mobile-block';
export { default as NetworkGraph } from './network-graph';
export { default as Overview } from './overview';
export { default as ProjectBoard } from './project-board';
export { default as Rail } from './rail';
export { default as RelationalPanel } from './relational-panel';
export { default as Sources } from './sources';
export { default as SpatialHome } from './spatial-home';
export { default as StrategyBoard } from './strategy-board';
export { default as SystemsBoard } from './systems-board';
export { default as SystemsPanel } from './systems-panel';
export { default as Timeline } from './timeline';
export { default as VoiceChat } from './voice-chat';
export { default as WorkBoard } from './work-board';

// Intelligence submodule
export { default as IntelligenceHome } from './intelligence/intelligence-home';
export { default as EntityIntelligence } from './intelligence/entity-intelligence';
export { default as MemoryCard } from './intelligence/memory-card';
export { default as PatternBrowser } from './intelligence/pattern-browser';
export { default as PatternCard } from './intelligence/pattern-card';
export { default as SituationSummaryCard } from './intelligence/situation-summary';
export type { Memory, Pattern, SituationSummary, IntelStats } from './intelligence/types';
export { INTEL_COLORS } from './intelligence/types';

// Library submodule
export { default as LibraryHome } from './library/library-home';
export { default as LibrarySearchResults } from './library/library-search-results';
export { default as LibraryVault } from './library/library-vault';
export { default as LibraryWikiPage } from './library/library-wiki-page';
export type { WikiPage, LibrarySearchResult, LibraryPageFull, LibraryCluster, LibraryStats, SearchResult } from './library/types';
export { MOCK_CLUSTERS, MOCK_STATS } from './library/types';
