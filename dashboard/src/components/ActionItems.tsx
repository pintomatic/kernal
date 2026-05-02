import { useApi, type ActionsData } from '../hooks/useKernalApi';

type ActionItem = {
  id: number;
  title: string;
  due_date: string | null;
  owner_name: string | null;
  priority?: string;
};

const PRIORITY_STYLES: Record<string, { label: string; classes: string }> = {
  urgent: { label: 'URGENT', classes: 'bg-red-50 text-red-700 border border-red-200' },
  high:   { label: 'HIGH',   classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  normal: { label: 'NORMAL', classes: 'bg-stone-100 text-stone-500 border border-stone-200' },
  low:    { label: 'LOW',    classes: 'bg-sky-50 text-sky-600 border border-sky-200' },
};

export default function ActionItems() {
  const { data, loading, error } = useApi<ActionsData>('/api/dashboard/actions?status=open');

  if (loading) return <div className="text-[hsl(var(--andes-text-muted))] animate-pulse py-8 text-center">Loading actions...</div>;
  if (error) return <div className="text-[hsl(var(--andes-error))] py-4">{error}</div>;
  if (!data || data.count === 0) return <div className="text-[hsl(var(--andes-text-muted))] py-8 text-center">No open action items.</div>;

  const { grouped } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {grouped.overdue.length > 0 && <ActionGroup title="Overdue" items={grouped.overdue} accent="red" />}
      {grouped.this_week.length > 0 && <ActionGroup title="Due This Week" items={grouped.this_week} accent="amber" />}
      {grouped.upcoming.length > 0 && <ActionGroup title="Upcoming" items={grouped.upcoming} accent="blue" />}
      {grouped.no_date.length > 0 && <ActionGroup title="No Due Date" items={grouped.no_date} accent="zinc" />}
    </div>
  );
}

function ActionGroup({ title, items, accent }: {
  title: string;
  items: ActionItem[];
  accent: string;
}) {
  const accentColors: Record<string, { badge: string; border: string; dot: string; leftBorder: string }> = {
    red:   { badge: 'bg-red-50 text-red-600 border border-red-200',       border: 'border-stone-200', dot: 'bg-red-500',   leftBorder: 'border-l-4 border-l-red-500' },
    amber: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', border: 'border-stone-200', dot: 'bg-amber-500', leftBorder: '' },
    blue:  { badge: 'bg-sky-50 text-sky-700 border border-sky-200',       border: 'border-stone-200', dot: 'bg-sky-500',   leftBorder: '' },
    zinc:  { badge: 'bg-stone-100 text-stone-500 border border-stone-200', border: 'border-stone-200', dot: 'bg-stone-400', leftBorder: '' },
  };
  const colors = accentColors[accent] || accentColors.zinc;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <h3
          className="text-[11px] font-semibold text-stone-600 uppercase"
          style={{ letterSpacing: '0.09em' }}
        >
          {title}
        </h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors.badge}`}
          style={{ fontFamily: 'var(--andes-font-mono)', fontSize: 10 }}
        >
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <ActionCard key={item.id} item={item} accentLeftBorder={colors.leftBorder} groupBorder={colors.border} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ item, accentLeftBorder, groupBorder }: {
  item: ActionItem;
  accentLeftBorder: string;
  groupBorder: string;
}) {
  const priority = item.priority?.toLowerCase();
  const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;

  return (
    <div className={`bg-white border ${groupBorder} rounded-xl px-4 py-3 hover:border-stone-300 hover:shadow-sm transition-all duration-150 ${accentLeftBorder}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-4 h-4 mt-0.5 rounded border border-stone-300 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-stone-800">{item.title}</p>
              {priorityStyle && (
                <span
                  className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityStyle.classes}`}
                  style={{ fontFamily: 'var(--andes-font-mono)', letterSpacing: '0.05em' }}
                >
                  {priorityStyle.label}
                </span>
              )}
            </div>
            {item.owner_name && (
              <div className="mt-1.5">
                <span
                  className="text-[11px] text-stone-400"
                  style={{ fontFamily: 'var(--andes-font-mono)' }}
                >
                  {item.owner_name}
                </span>
              </div>
            )}
          </div>
        </div>
        {item.due_date && (
          <span
            className="text-[11px] text-stone-400 whitespace-nowrap flex-shrink-0 mt-0.5"
            style={{ fontFamily: 'var(--andes-font-mono)' }}
          >
            {item.due_date}
          </span>
        )}
      </div>
    </div>
  );
}
