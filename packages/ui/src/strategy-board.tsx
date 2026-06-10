'use client';

import { useState } from 'react';
import { useApi } from './config';
import type { EntityFocus } from './types';

interface BoardMilestone {
  step: number;
  title: string;
  status: string;
  target_date: string | null;
}

interface BoardStep {
  step: number;
  action: string;
  status: string;
  target_date: string | null;
}

interface BoardPlan {
  id: number;
  corporate_objective: string | null;
  version: number;
}

interface BoardAction {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  target_date: string | null;
}

interface BoardGoal {
  id: number;
  title: string;
  type: string;
  health: string;
  confidence: number;
  status: string;
  target_date: string | null;
  milestones: BoardMilestone[];
  plan: BoardPlan | null;
  actions: BoardAction[];
}

interface BoardDeal {
  id: number;
  title: string;
  org_name: string | null;
  stage: string;
  health: string;
  confidence: number;
  estimated_value: number | null;
  target_close_date: string | null;
  steps: BoardStep[];
  plan: BoardPlan | null;
  actions: BoardAction[];
}

interface BoardDomain {
  goals: BoardGoal[];
  deals: BoardDeal[];
}

interface BoardSummary {
  total_goals: number;
  active_goals: number;
  goals_at_risk: number;
  total_deals: number;
  deals_at_risk: number;
  total_pipeline_value: number;
  total_plans: number;
  total_open_actions: number;
}

interface BoardData {
  domains: Record<string, BoardDomain>;
  summary: BoardSummary;
}

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

function StrategyBoardSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-28 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="skeleton h-5 w-40 mb-3" />
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="skeleton h-4 w-3/4 mb-2" />
                <div className="skeleton h-3 w-1/2 mb-2" />
                <div className="skeleton h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StrategyBoard({ onEntityClick }: { onEntityClick?: (entity: EntityFocus) => void }) {
  const { data, loading, error } = useApi<BoardData>('/api/dashboard/board');

  if (loading) return <StrategyBoardSkeleton />;
  if (error) return <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">{error}</div>;
  if (!data || Object.keys(data.domains).length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-stone-700 mb-1">No strategic items yet</h3>
      <p className="text-xs text-stone-400 max-w-xs">Create goals or deals to see your unified strategy board, grouped by domain.</p>
    </div>
  );

  const { domains, summary } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <SummaryBar summary={summary} />

      {Object.entries(domains).map(([domainName, domain]) => (
        <DomainSection
          key={domainName}
          name={domainName}
          domain={domain}
          onEntityClick={onEntityClick}
        />
      ))}
    </div>
  );
}

function SummaryBar({ summary }: { summary: BoardSummary }) {
  const pills = [
    { label: 'Active Goals', value: summary.active_goals, color: 'text-purple-700' },
    { label: 'Goals at Risk', value: summary.goals_at_risk, color: summary.goals_at_risk > 0 ? 'text-red-600' : 'text-stone-500' },
    { label: 'Deals', value: summary.total_deals, color: 'text-sky-700' },
    { label: 'Pipeline', value: formatValue(summary.total_pipeline_value), color: 'text-stone-800' },
    { label: 'Open Actions', value: summary.total_open_actions, color: 'text-amber-700' },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {pills.map(p => (
        <div key={p.label} className="flex items-baseline gap-1.5 px-3 py-1.5 bg-white rounded-full border border-stone-200">
          <span className={`text-sm font-semibold tabular-nums ${p.color}`}>{p.value}</span>
          <span className="text-[11px] text-stone-400">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function DomainSection({ name, domain, onEntityClick }: {
  name: string;
  domain: BoardDomain;
  onEntityClick?: (entity: EntityFocus) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const totalItems = domain.goals.length + domain.deals.length;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-3 group cursor-pointer"
      >
        <svg className={`w-3.5 h-3.5 text-stone-400 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-base font-semibold text-stone-900">{name}</h2>
        <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
          {totalItems}
        </span>
      </button>

      {!collapsed && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {domain.goals.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 px-1">Goals</p>
            )}
            {domain.goals.map(goal => (
              <GoalCard key={`g-${goal.id}`} goal={goal} onEntityClick={onEntityClick} />
            ))}
          </div>
          <div className="space-y-2">
            {domain.deals.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 px-1">Deals</p>
            )}
            {domain.deals.map(deal => (
              <DealCard key={`d-${deal.id}`} deal={deal} onEntityClick={onEntityClick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onEntityClick }: {
  goal: BoardGoal;
  onEntityClick?: (entity: EntityFocus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const healthDot = HEALTH_DOT[goal.health] || HEALTH_DOT.green;
  const doneCount = goal.milestones.filter(m => m.status === 'done' || m.status === 'skipped').length;
  const totalCount = goal.milestones.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const openActions = goal.actions.filter(a => a.status === 'open').length;

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200 p-3.5 hover:border-stone-300 transition-colors ${onEntityClick ? 'cursor-pointer' : ''}`}
      onClick={() => onEntityClick?.({ type: 'goal', id: goal.id, name: goal.title })}
    >
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full ${healthDot} mt-1.5 shrink-0`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-800 truncate">{goal.title}</span>
            {goal.type === 'evergreen' && <span className="text-xs text-stone-400">&#8734;</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {goal.target_date && <span className="text-[10px] text-stone-400">{goal.target_date}</span>}
            {goal.confidence > 0 && <span className="text-[10px] text-stone-400">{goal.confidence}%</span>}
            {goal.plan && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                Plan v{goal.plan.version}
              </span>
            )}
            {openActions > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                {openActions} action{openActions !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${healthDot}`} style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] text-stone-400 tabular-nums">{doneCount}/{totalCount}</span>
        </div>
      )}

      {expanded && goal.milestones.length > 0 && (
        <div className="mt-2 pt-2 border-t border-stone-100 space-y-1">
          {goal.milestones.map(m => (
            <div key={m.step} className="flex items-center gap-2 text-xs">
              <span className={m.status === 'done' ? 'text-emerald-500' : 'text-stone-400'}>
                {m.status === 'done' ? '\u2713' : '\u25CB'}
              </span>
              <span className={`truncate ${m.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-600'}`}>
                {m.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {goal.milestones.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="mt-1.5 text-[10px] text-stone-400 hover:text-stone-600 cursor-pointer transition-colors"
        >
          {expanded ? 'Hide milestones' : `${goal.milestones.length} milestone${goal.milestones.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

function DealCard({ deal, onEntityClick }: {
  deal: BoardDeal;
  onEntityClick?: (entity: EntityFocus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const healthDot = HEALTH_DOT[deal.health] || HEALTH_DOT.green;
  const doneCount = deal.steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const totalCount = deal.steps.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const openActions = deal.actions.filter(a => a.status === 'open').length;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = deal.target_close_date && deal.target_close_date < today;

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200 p-3.5 hover:border-stone-300 transition-colors ${onEntityClick ? 'cursor-pointer' : ''}`}
      onClick={() => onEntityClick?.({ type: 'deal', id: deal.id, name: deal.title })}
    >
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full ${healthDot} mt-1.5 shrink-0`} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-stone-800 truncate block">{deal.title}</span>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 font-medium capitalize">{deal.stage}</span>
            {deal.estimated_value != null && deal.estimated_value > 0 && (
              <span className="text-[10px] text-stone-500 font-medium">{formatValue(deal.estimated_value)}</span>
            )}
            {deal.target_close_date && (
              <span className={`text-[10px] ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>{deal.target_close_date}</span>
            )}
            {deal.plan && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                Plan v{deal.plan.version}
              </span>
            )}
            {openActions > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                {openActions} action{openActions !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${healthDot}`} style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] text-stone-400 tabular-nums">{doneCount}/{totalCount}</span>
        </div>
      )}

      {expanded && deal.steps.length > 0 && (
        <div className="mt-2 pt-2 border-t border-stone-100 space-y-1">
          {deal.steps.map(s => (
            <div key={s.step} className="flex items-center gap-2 text-xs">
              <span className={s.status === 'done' ? 'text-emerald-500' : 'text-stone-400'}>
                {s.status === 'done' ? '\u2713' : '\u25CB'}
              </span>
              <span className={`truncate ${s.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-600'}`}>
                {s.action}
              </span>
            </div>
          ))}
        </div>
      )}

      {deal.steps.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="mt-1.5 text-[10px] text-stone-400 hover:text-stone-600 cursor-pointer transition-colors"
        >
          {expanded ? 'Hide steps' : `${deal.steps.length} step${deal.steps.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
