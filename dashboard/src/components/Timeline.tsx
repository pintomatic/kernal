import { useApi, type TimelineData } from '../hooks/useKernalApi';

type Activity = TimelineData['activities'][number];

const TYPE_CONFIG: Record<string, { abbr: string; bg: string; text: string; label: string }> = {
  meeting:  { abbr: 'MT', bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Meeting' },
  call:     { abbr: 'CL', bg: 'bg-emerald-50',  text: 'text-emerald-700', label: 'Call' },
  email:    { abbr: 'EM', bg: 'bg-stone-100',   text: 'text-stone-600',   label: 'Email' },
  event:    { abbr: 'EV', bg: 'bg-violet-50',   text: 'text-violet-700',  label: 'Event' },
  intro:    { abbr: 'IN', bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Intro' },
  other:    { abbr: 'AC', bg: 'bg-stone-100',   text: 'text-stone-500',   label: 'Other' },
};

// Derive significance from activity type and presence of participants/orgs
function getSignificance(act: Activity): 'critical' | 'important' | 'supporting' {
  if (act.type === 'meeting' && act.participants && act.participants.length >= 3) return 'critical';
  if (act.type === 'intro' || (act.type === 'meeting' && act.organizations && act.organizations.length > 0)) return 'important';
  if (act.type === 'meeting' || act.type === 'call' || act.type === 'event') return 'important';
  return 'supporting';
}

const SIG_STYLES: Record<string, { leftBorder: string; badge: string; badgeText: string; dotBg: string; dotHex: string }> = {
  critical:  { leftBorder: 'border-l-[3px] border-l-red-500',   badge: 'bg-red-50 text-red-700 border-red-200',      badgeText: 'CRITICAL',  dotBg: 'bg-red-500',   dotHex: '#ef4444' },
  important: { leftBorder: 'border-l-[3px] border-l-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', badgeText: 'IMPORTANT', dotBg: 'bg-amber-400', dotHex: '#fbbf24' },
  supporting:{ leftBorder: '',                                   badge: 'bg-stone-100 text-stone-500 border-stone-200', badgeText: 'SUPPORT',  dotBg: 'bg-stone-400', dotHex: '#a8a29e' },
};

// Group by approximate phase: last 7d, last 30d, older
function getPhase(dateStr: string): string {
  if (!dateStr || dateStr === 'Undated') return 'Undated';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
    if (diffDays <= 7)  return 'Last 7 Days';
    if (diffDays <= 30) return 'Last 30 Days';
    if (diffDays <= 90) return 'Last 90 Days';
    return 'Earlier';
  } catch { return 'Undated'; }
}

const PHASE_ORDER = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Earlier', 'Undated'];

interface Props {
  entity?: string;
}

export default function Timeline({ entity }: Props) {
  const path = entity ? `/api/dashboard/timeline?entity=${encodeURIComponent(entity)}` : '/api/dashboard/timeline';
  const { data, loading, error } = useApi<TimelineData>(path);

  if (loading) return <div className="text-[hsl(var(--andes-text-muted))] animate-pulse py-8 text-center text-sm">Loading timeline...</div>;
  if (error) return <div className="text-[hsl(var(--andes-error))] py-4 text-sm">{error}</div>;
  if (!data || data.activities.length === 0) return <div className="text-[hsl(var(--andes-text-muted))] py-8 text-center text-sm">No activities{entity ? ` for "${entity}"` : ''}.</div>;

  // Group by phase
  const byPhase = new Map<string, Activity[]>();
  for (const act of data.activities) {
    const phase = getPhase(act.date);
    if (!byPhase.has(phase)) byPhase.set(phase, []);
    byPhase.get(phase)!.push(act);
  }

  const phases = PHASE_ORDER.filter(p => byPhase.has(p));

  return (
    <div className="max-w-3xl mx-auto">
      {entity && <h2 className="text-base font-semibold text-stone-900 mb-4">Timeline: {entity}</h2>}

      <div
        className="relative pl-7"
        style={{ borderLeft: '2px solid hsl(var(--andes-border))' }}
      >
        {phases.map((phase, pi) => (
          <div key={phase} className="mb-8" style={{ animationDelay: `${pi * 60}ms` }}>
            {/* Phase header — knob on the spine */}
            <div className="flex items-center gap-3 mb-3" style={{ marginLeft: '-1.875rem' }}>
              <div
                className="w-5 h-5 rounded-full bg-white border-2 flex-shrink-0"
                style={{ borderColor: 'hsl(var(--andes-border-subtle))' }}
              />
              <span
                className="text-[11px] font-semibold text-stone-500 uppercase"
                style={{ letterSpacing: '0.09em' }}
              >
                {phase}
              </span>
              <span
                className="text-[10px] text-stone-400 ml-1"
                style={{ fontFamily: 'var(--andes-font-mono)' }}
              >
                {byPhase.get(phase)!.length}
              </span>
            </div>

            <div className="space-y-2">
              {byPhase.get(phase)!.map(act => {
                const config = TYPE_CONFIG[act.type] || TYPE_CONFIG.other;
                const sig = getSignificance(act);
                const sigStyle = SIG_STYLES[sig];

                return (
                  <div
                    key={act.id}
                    className={`bg-white border border-stone-200 rounded-xl p-3.5 hover:shadow-sm hover:-translate-y-px transition-all duration-150 flex gap-3 items-start relative ${sigStyle.leftBorder}`}
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute rounded-full border-2 border-white"
                      style={{
                        width: 10,
                        height: 10,
                        left: '-2.05rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: sigStyle.dotHex,
                      }}
                    />

                    {/* Type icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg} ${config.text}`}
                      style={{ fontFamily: 'var(--andes-font-mono)', fontSize: 10, fontWeight: 700 }}
                    >
                      {config.abbr}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-medium text-stone-900 text-sm">{act.title || act.type}</span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sigStyle.badge}`}
                          style={{ fontFamily: 'var(--andes-font-mono)', letterSpacing: '0.05em' }}
                        >
                          {sigStyle.badgeText}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.bg} ${config.text}`}>
                          {config.label}
                        </span>
                      </div>
                      {act.participants && act.participants.length > 0 && (
                        <div className="text-xs text-stone-500 mt-0.5">
                          {act.participants.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ')}
                        </div>
                      )}
                      {act.organizations && act.organizations.length > 0 && (
                        <div className="text-xs text-violet-600 mt-0.5">{act.organizations.join(', ')}</div>
                      )}
                      {act.summary && (
                        <p className="text-xs text-stone-400 leading-relaxed line-clamp-2 mt-0.5">{act.summary}</p>
                      )}
                    </div>

                    {act.date && (
                      <span
                        className="text-[11px] text-stone-400 whitespace-nowrap flex-shrink-0 mt-0.5"
                        style={{ fontFamily: 'var(--andes-font-mono)' }}
                      >
                        {formatDate(act.date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Undated') return dateStr;
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays >= 2 && diffDays <= 6) return `${diffDays}d ago`;
    if (diffDays >= 7 && diffDays <= 13) return 'Last week';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}
