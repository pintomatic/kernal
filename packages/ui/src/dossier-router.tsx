'use client';

import { useState } from 'react';
import { useApi } from './config';
import EntityIntelligence from './intelligence/entity-intelligence';
import type { EntityFocus } from './types';

type Tier = 'core' | 'pro';

export function DossierHeader({ focus, onClose }: { focus: EntityFocus; onClose: () => void }) {
  const initials = (focus.name || '?').split(' ').map((w: string) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="dossier-head">
      <div className="dossier-avatar">{initials}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="dossier-name">{focus.name}</div>
        <div className="dossier-role">{focus.type}</div>
        <div className="confidence">
          <div className="confidence-bar"><div style={{ width: '85%' }} /></div>
          <span>0.85</span>
        </div>
      </div>
      <span className="dossier-close" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </div>
  );
}

interface DossierRouterProps {
  focus: EntityFocus;
  tier: Tier;
  onExpandSystem: (systemId: number | null) => void;
  expandedSystemId?: number | null;
}

function SystemDossier({ focus, onExpandSystem, expandedSystemId }: { focus: EntityFocus; onExpandSystem: (id: number | null) => void; expandedSystemId?: number | null }) {
  const { data, loading } = useApi<any>(`/api/systems/${focus.id}`);
  if (loading) return <div className="kd-dossier-loading">Loading system...</div>;
  if (!data) return <div className="kd-dossier-loading">No system data found.</div>;

  const system = data.system ?? data;
  let stack: string[] = [];
  try { stack = typeof system.stack === 'string' ? JSON.parse(system.stack) : (system.stack ?? []); } catch { stack = []; }

  const contractDays = system.contract_expiry
    ? Math.ceil((new Date(system.contract_expiry).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="kd-dossier-body">
      <div className="kd-ds-section">
        <h5>System details</h5>
        <div className="kd-ds-fact">
          <span className="k">Type</span>
          <span className="v" style={{ background: system.type === 'internal' ? '#eff6ff' : '#fef3c7', color: system.type === 'internal' ? '#1d4ed8' : '#92400e', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
            {system.type || 'unknown'}
          </span>
        </div>
        {system.vendor && <div className="kd-ds-fact"><span className="k">Vendor</span><span className="v">{system.vendor}</span></div>}
        {system.owner_org && <div className="kd-ds-fact"><span className="k">Owner</span><span className="v">{system.owner_org}</span></div>}
        {system.annual_cost != null && <div className="kd-ds-fact"><span className="k">Annual cost</span><span className="v">{system.annual_cost.toLocaleString()}</span></div>}
        {contractDays !== null && (
          <div className="kd-ds-fact">
            <span className="k">Contract</span>
            <span className="v" style={{ color: contractDays <= 30 ? '#dc2626' : contractDays <= 90 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
              {contractDays <= 0 ? 'Expired' : `${contractDays}d`}
            </span>
          </div>
        )}
      </div>
      {stack.length > 0 && (
        <div className="kd-ds-section">
          <h5>Stack</h5>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
              * Stack-chip ink+bg pair (#7c3aed on #f5f3ff) collapsed to teal+teal-soft. */}
            {stack.map((s, i) => (
              <span key={i} style={{ background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{s}</span>
            ))}
          </div>
        </div>
      )}
      {system.has_graph && (
        <div className="kd-ds-section">
          {/* Aurora violet retired 2026-05-30 in Mosaic.2 M8 — see mosaic.css.
            * Graph-expand chrome (violet ink + violet-tinted background + violet
            * border) collapsed to a teal-on-teal-soft + teal-pale border set. */}
          {focus.id === expandedSystemId ? (
            <button
              onClick={() => onExpandSystem(null)}
              style={{ width: '100%', background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>◀ Collapse code graph</span>
              <span>×</span>
            </button>
          ) : (
            <button
              onClick={() => onExpandSystem(focus.id)}
              style={{ width: '100%', background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>▶ Expand code graph{system.node_count ? `: ${system.node_count} nodes` : ''}</span>
              <span>+</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectDossier({ focus }: { focus: EntityFocus }) {
  const { data, loading } = useApi<any>(`/api/projects/${focus.id}`);
  if (loading) return <div className="kd-dossier-loading">Loading project...</div>;
  if (!data) return <div className="kd-dossier-loading">No project data found.</div>;

  const project = data.project ?? data;

  const statusColor = project.status === 'active' ? '#16a34a' : project.status === 'paused' ? '#d97706' : '#6b7280';
  const healthColor = project.health === 'red' ? '#dc2626' : project.health === 'yellow' ? '#d97706' : '#16a34a';

  return (
    <div className="kd-dossier-body">
      <div className="kd-ds-section">
        <h5>Project details</h5>
        <div className="kd-ds-fact">
          <span className="k">Status</span>
          <span className="v" style={{ color: statusColor, fontWeight: 600 }}>{project.status || 'unknown'}</span>
        </div>
        {project.health && (
          <div className="kd-ds-fact">
            <span className="k">Health</span>
            <span className="v" style={{ color: healthColor, fontWeight: 600 }}>{project.health}</span>
          </div>
        )}
        {project.owner_name && <div className="kd-ds-fact"><span className="k">Owner</span><span className="v">{project.owner_name}</span></div>}
        {project.open_tasks != null && <div className="kd-ds-fact"><span className="k">Open tasks</span><span className="v">{project.open_tasks}</span></div>}
      </div>
      {project.team_members?.length > 0 && (
        <div className="kd-ds-section">
          <h5>Team</h5>
          {project.team_members.map((m: any, i: number) => (
            <div key={i} className="kd-ds-fact">
              <span className="k">{m.role || '—'}</span>
              <span className="v">{m.name}</span>
            </div>
          ))}
        </div>
      )}
      {(project.goal_id || project.deal_id) && (
        <div className="kd-ds-section">
          <h5>Links</h5>
          {project.goal_id && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 6, fontSize: 11, marginBottom: 4 }}>
              → Goal: {project.goal_name || project.goal_id}
            </div>
          )}
          {project.deal_id && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef9c3', color: '#713f12', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>
              → Deal: {project.deal_name || project.deal_id}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonOrOrgDossier({ focus, tier }: { focus: EntityFocus; tier: Tier }) {
  const isPro = tier === 'pro';
  const { data, loading } = useApi<any>(`/api/dashboard/dossier/${encodeURIComponent(focus.name)}`);
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) return <div className="kd-dossier-loading">Loading dossier...</div>;
  if (!data?.found) return <div className="kd-dossier-loading">No data found for &ldquo;{focus.name}&rdquo;</div>;

  const tabs = ['Overview', 'Relationships', 'Activity', ...(isPro ? ['Intelligence'] : [])];

  return (
    <div className="kd-dossier-body">
      {data.entity?.confidence && (
        <div className="confidence">
          <span>confidence</span>
          <div className="confidence-bar">
            <div style={{ width: `${(data.entity.confidence || 0.8) * 100}%` }} />
          </div>
          <span>{(data.entity.confidence || 0.8).toFixed(2)}</span>
        </div>
      )}
      <div className="tabs">
        {tabs.map(t => (
          <div key={t} className={`t ${activeTab === t.toLowerCase() ? 'on' : ''}`}
            onClick={() => setActiveTab(t.toLowerCase())}>
            {t}
            {t === 'Relationships' && data.relationships?.length > 0 && (
              <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--ink-3)' }}>{data.relationships.length}</span>
            )}
            {t === 'Activity' && (data.activities?.length > 0 || data.orgActivities?.length > 0) && (
              <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--ink-3)' }}>{(data.activities || data.orgActivities)?.length}</span>
            )}
          </div>
        ))}
      </div>
      {data.entity && activeTab === 'overview' && (
        <div className="kd-ds-section">
          <h5>Facts</h5>
          {data.entity.role && <div className="kd-ds-fact"><span className="k">Role</span><span className="v">{data.entity.role}</span></div>}
          {data.entity.org_name && <div className="kd-ds-fact"><span className="k">Org</span><span className="v">{data.entity.org_name}</span></div>}
          {data.entity.industry && <div className="kd-ds-fact"><span className="k">Industry</span><span className="v">{data.entity.industry}</span></div>}
          {data.entity.type && <div className="kd-ds-fact"><span className="k">Type</span><span className="v">{data.entity.type}</span></div>}
        </div>
      )}
      {(activeTab === 'overview' || activeTab === 'relationships') && data.relationships?.length > 0 && (
        <div className="kd-ds-section">
          <h5>{activeTab === 'relationships' ? `All relationships (${data.relationships.length})` : 'Key relationships'}</h5>
          {data.relationships.slice(0, activeTab === 'relationships' ? 30 : 6).map((r: any, i: number) => (
            <div key={i} className="kd-rel">
              <span className="kd-rel-type">{r.relation.replace(/_/g, ' ')}</span>
              <span className="kd-rel-who">{r.target_name}</span>
              {r.confidence && <span className="kd-rel-conf">{r.confidence.toFixed(2)}</span>}
            </div>
          ))}
          {data.relationships.length > 6 && activeTab === 'overview' && (
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <a style={{ color: 'var(--kd-teal)', fontSize: 12, cursor: 'pointer' }} onClick={() => setActiveTab('relationships')}>
                See {data.relationships.length - 6} more →
              </a>
            </div>
          )}
        </div>
      )}
      {activeTab === 'activity' && (
        <div className="kd-ds-section">
          <h5>Activity</h5>
          {(data.activities?.length > 0 || data.orgActivities?.length > 0) ? (
            (data.activities || data.orgActivities).slice(0, 20).map((a: any) => (
              <div key={a.id} className="kd-ds-fact">
                <span className="k" style={{ fontSize: 10, minWidth: 60 }}>{a.type} · {a.date}</span>
                <span className="v">{a.title}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--kd-ink-3)', padding: '8px 0' }}>No activities recorded for this entity.</div>
          )}
        </div>
      )}
      {isPro && activeTab === 'intelligence' && data.entity && (
        <EntityIntelligence
          entityId={data.entity.id ?? focus.id}
          entityName={focus.name}
        />
      )}
      {isPro && activeTab === 'overview' && (
        <>
          {(data.deals?.length > 0 || data.orgDeals?.length > 0) && (
            <div className="kd-ds-section">
              <h5>Deals</h5>
              {(data.deals || data.orgDeals).map((d: any) => (
                <div key={d.id} className="kd-ds-fact">
                  <span className="k">{d.stage}</span>
                  <span className="v">{d.title}</span>
                </div>
              ))}
            </div>
          )}
          {data.actions?.length > 0 && (
            <div className="kd-ds-section">
              <h5>Open actions</h5>
              {data.actions.map((a: any) => (
                <div key={a.id} className="kd-ds-fact">
                  <span className="k" style={{ color: 'var(--kd-red)' }}>{a.due_date || '—'}</span>
                  <span className="v">{a.title}</span>
                </div>
              ))}
            </div>
          )}
          {data.memories?.length > 0 && (
            <div className="kd-ds-section">
              <h5>Memories</h5>
              {data.memories.map((m: any) => (
                <div key={m.id} className="kd-ds-fact">
                  <span className="k">{m.category}</span>
                  <span className="v" style={{ fontSize: 11 }}>{m.content?.slice(0, 80)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalDossier({ focus }: { focus: EntityFocus }) {
  const { data: goalData } = useApi<any>('/api/dashboard/goals');
  const goal = goalData?.goals?.find((g: any) => g.title === focus.name || g.id === focus.id);
  if (!goal) return <div className="kd-dossier-loading">Loading goal...</div>;
  return (
    <div className="kd-dossier-body">
      <div className="kd-ds-section">
        <h5>Goal details</h5>
        <div className="kd-ds-fact"><span className="k">Status</span><span className="v">{goal.status}</span></div>
        <div className="kd-ds-fact"><span className="k">Health</span><span className="v">{goal.health || 'green'}</span></div>
        {goal.domain && <div className="kd-ds-fact"><span className="k">Domain</span><span className="v">{goal.domain}</span></div>}
        {goal.type && <div className="kd-ds-fact"><span className="k">Type</span><span className="v">{goal.type}</span></div>}
        {goal.target_date && <div className="kd-ds-fact"><span className="k">Target</span><span className="v">{goal.target_date}</span></div>}
        {goal.confidence && <div className="kd-ds-fact"><span className="k">Confidence</span><span className="v">{goal.confidence}%</span></div>}
      </div>
      {goal.description && (
        <div className="kd-ds-section">
          <h5>Description</h5>
          <p style={{ fontSize: 12, color: 'var(--kd-ink-2)', lineHeight: 1.5 }}>{goal.description}</p>
        </div>
      )}
      {goal.progress && goal.progress.total > 0 && (
        <div className="kd-ds-section">
          <h5>Progress</h5>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--kd-line)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--kd-teal)', borderRadius: 3, width: `${(goal.progress.done / goal.progress.total) * 100}%` }} />
            </div>
            <span style={{ fontFamily: 'var(--kd-font-mono)', color: 'var(--kd-ink-3)', fontSize: 11 }}>{goal.progress.done}/{goal.progress.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DealDossier({ focus }: { focus: EntityFocus }) {
  const { data: dealData } = useApi<any>('/api/dashboard/deals');
  const deal = dealData?.deals?.find((d: any) => d.title === focus.name || d.id === focus.id);
  if (!deal) return <div className="kd-dossier-loading">Loading deal...</div>;
  return (
    <div className="kd-dossier-body">
      <div className="kd-ds-section">
        <h5>Deal details</h5>
        <div className="kd-ds-fact"><span className="k">Stage</span><span className="v">{deal.stage}</span></div>
        <div className="kd-ds-fact"><span className="k">Health</span><span className="v">{deal.health || 'green'}</span></div>
        {deal.org_name && <div className="kd-ds-fact"><span className="k">Organization</span><span className="v">{deal.org_name}</span></div>}
        {deal.confidence && <div className="kd-ds-fact"><span className="k">Confidence</span><span className="v">{deal.confidence}%</span></div>}
        {deal.value && <div className="kd-ds-fact"><span className="k">Value</span><span className="v">{deal.value}</span></div>}
      </div>
      {deal.nextStep && (
        <div className="kd-ds-section">
          <h5>Next step</h5>
          <div className="kd-ds-fact"><span className="k">{deal.nextStep.date || '—'}</span><span className="v">{deal.nextStep.action}</span></div>
        </div>
      )}
      {deal.stakeholders?.length > 0 && (
        <div className="kd-ds-section">
          <h5>Stakeholders</h5>
          {deal.stakeholders.map((s: any, i: number) => (
            <div key={i} className="kd-ds-fact"><span className="k">{s.role || '—'}</span><span className="v">{s.name}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DossierRouter({ focus, tier, onExpandSystem, expandedSystemId }: DossierRouterProps) {
  if (focus.type === 'system') return <SystemDossier focus={focus} onExpandSystem={onExpandSystem} expandedSystemId={expandedSystemId} />;
  if (focus.type === 'project') return <ProjectDossier focus={focus} />;
  if (focus.type === 'goal') return <GoalDossier focus={focus} />;
  if (focus.type === 'deal') return <DealDossier focus={focus} />;
  return <PersonOrOrgDossier focus={focus} tier={tier} />;
}
