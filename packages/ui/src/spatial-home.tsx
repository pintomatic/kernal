'use client';

import { useApi } from './config';
import type { EntityFocus } from './types';

type Tier = 'core' | 'pro';

interface SpatialHomeProps {
  onEntityClick: (entity: EntityFocus) => void;
  tier: Tier;
}

export default function SpatialHome({ onEntityClick, tier }: SpatialHomeProps) {
  const isPro = tier === 'pro';
  const { data: stats } = useApi<any>('/api/dashboard/stats');
  const { data: deals } = useApi<any>(isPro ? '/api/dashboard/deals' : null);
  const { data: goals } = useApi<any>(isPro ? '/api/dashboard/goals' : null);
  const { data: actions } = useApi<any>('/api/dashboard/actions?status=open');
  const { data: timeline } = useApi<any>('/api/dashboard/timeline');
  const { data: insightsData } = useApi<any>(isPro ? '/api/dashboard/insights' : null);
  const { data: memoriesData } = useApi<any>('/api/dashboard/memories?limit=6');

  return (
    <div className="kd-spatial">
      <div className="kd-zone intelligence">
        <div className="kd-zone-head">
          <div className="kd-zone-label"><span className="kd-dot" style={{ background: 'var(--kd-intelligence)' }} />Intelligence</div>
          <div className="kd-zone-count">{stats?.counts?.people ?? 0} people · {stats?.counts?.organizations ?? 0} orgs</div>
        </div>
        <h3 className="kd-zone-title">Knowledge</h3>
        <div className="kd-zone-big">{stats?.counts?.relationships ?? 0}</div>
        <div className="kd-zone-sub">relationships mapped</div>
        {stats?.topConnected?.slice(0, 4).map((person: any, i: number) => (
          <div key={i} className="kd-entity-row" onClick={() => onEntityClick({ type: 'person', id: 0, name: person.name })}>
            <div className="kd-icon" style={{ background: 'var(--kd-intelligence-soft)', color: 'var(--kd-intelligence)' }}>
              {person.name.charAt(0)}
            </div>
            <span className="kd-entity-name">{person.name}</span>
            <span className="kd-entity-meta">{person.connections} links</span>
          </div>
        ))}
        {memoriesData && memoriesData.total > 0 && (
          <div className="kd-intel-col">
            <h4>Recent memories</h4>
            {memoriesData.memories?.slice(0, 3).map((mem: any) => (
              <div key={mem.id} className="kd-entity-row">
                <div className="kd-icon" style={{ background: 'var(--kd-intelligence-soft)', color: 'var(--kd-intelligence)' }}>MM</div>
                <span className="kd-entity-name">{mem.content?.slice(0, 40)}</span>
                <span className="kd-entity-meta">{mem.created_at?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isPro && (
        <div className="kd-zone intent">
          <div className="kd-zone-head">
            <div className="kd-zone-label"><span className="kd-dot" style={{ background: 'var(--kd-intent)' }} />Intent</div>
            <div className="kd-zone-count">{goals?.goals?.length ?? 0} goals</div>
          </div>
          <h3 className="kd-zone-title">Goals</h3>
          {(() => {
            const activeGoals = goals?.goals?.filter((g: any) => g.status === 'active') || [];
            const healthyCount = activeGoals.filter((g: any) => g.health !== 'red').length;
            const pct = activeGoals.length > 0 ? Math.round((healthyCount / activeGoals.length) * 100) : 0;
            return <div className="kd-zone-big">{pct}<span style={{ fontSize: 18, color: 'var(--kd-ink-3)' }}>% healthy</span></div>;
          })()}
          {goals?.goals?.filter((g: any) => g.status === 'active').slice(0, 3).map((goal: any) => (
            <div key={goal.id} className="kd-entity-row" onClick={() => onEntityClick({ type: 'goal', id: goal.id, name: goal.title })}>
              <div className="kd-icon" style={{ background: 'var(--kd-intent-soft)', color: 'var(--kd-intent)' }}>GL</div>
              <span className="kd-entity-name">{goal.title}</span>
              <span className="kd-entity-meta">
                {goal.health === 'red' ? '●○○○○' : goal.health === 'yellow' ? '●●●○○' : '●●●●○'}
              </span>
            </div>
          ))}
        </div>
      )}

      {isPro && (
        <div className="kd-zone commercial">
          <div className="kd-zone-head">
            <div className="kd-zone-label"><span className="kd-dot" style={{ background: 'var(--kd-commercial)' }} />Commercial</div>
            <div className="kd-zone-count">{deals?.deals?.length ?? 0} deals</div>
          </div>
          <h3 className="kd-zone-title">Deals</h3>
          <div className="kd-zone-big">{deals?.deals?.length ?? 0}</div>
          {deals?.deals?.slice(0, 3).map((deal: any) => (
            <div key={deal.id} className="kd-entity-row" onClick={() => onEntityClick({ type: 'deal', id: deal.id, name: deal.title })}>
              <div className="kd-icon" style={{ background: 'var(--kd-commercial-soft)', color: 'var(--kd-commercial)' }}>DL</div>
              <span className="kd-entity-name">{deal.title}</span>
              <span className="kd-entity-meta">{deal.stage}</span>
            </div>
          ))}
        </div>
      )}

      <div className="kd-zone execution">
        <div className="kd-zone-head">
          <div className="kd-zone-label"><span className="kd-dot" style={{ background: 'var(--kd-execution)' }} />Execution</div>
          <div className="kd-zone-count">{actions?.count ?? 0} actions</div>
        </div>
        <h3 className="kd-zone-title">Actions</h3>
        <div className="kd-zone-big">
          {actions?.grouped?.overdue?.length ?? 0}
          <span style={{ fontSize: 18, color: 'var(--kd-red)' }}> overdue</span>
        </div>
        <div className="kd-zone-sub">shipped {actions?.grouped?.this_week?.length ?? 0} this week</div>
        {actions?.grouped?.overdue?.slice(0, 2).map((a: any) => (
          <div key={a.id} className="kd-entity-row">
            <div className="kd-icon" style={{ background: '#fee2e2', color: 'var(--kd-red)' }}>!</div>
            <span className="kd-entity-name">{a.title}</span>
            <span className="kd-entity-meta">{a.due_date || 'no date'}</span>
          </div>
        ))}
      </div>

      <div className="kd-zone conversation">
        <div className="kd-zone-head">
          <div className="kd-zone-label"><span className="kd-dot" style={{ background: 'var(--kd-conversation)' }} />Conversation</div>
          <div className="kd-zone-count">{stats?.counts?.activities ?? 0} activities</div>
        </div>
        <h3 className="kd-zone-title">Activity</h3>
        <div className="kd-zone-big">{timeline?.activities?.length ?? 0}</div>
        <div className="kd-zone-sub">recent</div>
        {timeline?.activities?.slice(0, 2).map((act: any) => (
          <div key={act.id} className="kd-entity-row"
            onClick={() => act.participants?.[0]?.name && onEntityClick({ type: 'person', id: 0, name: act.participants[0].name })}>
            <div className="kd-icon" style={{ background: 'var(--kd-conversation-soft)', color: 'var(--kd-conversation)' }}>
              {act.type === 'meeting' ? 'MT' : act.type === 'call' ? 'CL' : 'AC'}
            </div>
            <span className="kd-entity-name">{act.title}</span>
            <span className="kd-entity-meta">{act.date}</span>
          </div>
        ))}
      </div>

      <div className="kd-zone health">
        <div className="kd-zone-head">
          <div className="kd-zone-label" style={{ color: 'var(--kd-ink-3)' }}>
            <span className="kd-dot" style={{ background: 'var(--kd-green)' }} />Graph Health
          </div>
        </div>
        <div className="kd-lint-grid">
          <div className="kd-health-score">
            <span className="kd-health-val">{stats ? Math.min(Math.round(((stats.counts?.relationships || 0) / Math.max((stats.counts?.people || 1) + (stats.counts?.organizations || 1), 1)) * 20), 99) : '—'}</span>
          </div>
          <div className="kd-lint-items">
            <div className="kd-lint-item"><div className="kd-lint-val">{stats?.counts?.people ?? 0}</div><div className="kd-lint-label">People tracked</div></div>
            <div className="kd-lint-item"><div className="kd-lint-val">{stats?.counts?.organizations ?? 0}</div><div className="kd-lint-label">Organizations</div></div>
            <div className="kd-lint-item"><div className="kd-lint-val">{stats?.counts?.activities ?? 0}</div><div className="kd-lint-label">Activities</div></div>
            <div className="kd-lint-item"><div className="kd-lint-val">{stats?.counts?.patterns ?? 0}</div><div className="kd-lint-label">Patterns</div></div>
          </div>
        </div>
      </div>

      {isPro && insightsData && insightsData.insights?.length > 0 && (
        <div className="kd-zone insights">
          <div className="kd-zone-head">
            <div className="kd-zone-label" style={{ color: 'var(--kd-ink-3)' }}>
              <span className="kd-dot" style={{ background: 'var(--kd-intelligence)' }} />Insights
            </div>
            <div className="kd-zone-count">{insightsData.insights.length} new</div>
          </div>
          <div className="kd-insights-list">
            {insightsData.insights.slice(0, 4).map((insight: any, i: number) => (
              <div key={i} className={`kd-insight ${insight.severity === 'high' ? 'red' : insight.severity === 'medium' ? 'amber' : 'sky'}`}>
                <div className="kd-insight-badge">
                  {insight.type === 'gap' ? 'RD' : insight.type === 'pattern' ? 'PT' : insight.type === 'network' ? 'NW' : 'OV'}
                </div>
                <div className="kd-insight-body">
                  <div className="kd-insight-title">{insight.title}</div>
                  <div className="kd-insight-sub">{insight.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
