# Implementation Plan: Task Display & Inline Edit (v1)

## Goal

Fix and enhance task display across three Work view components. The deal-board and project-board already have task infrastructure but are broken by a 404 endpoint. The action-items view needs context badges, working completion, and inline edit.

---

## Source of Truth: LOCAL andes-web files

**Edit**: `C:/Users/Cesar Pinto/code/andes-web/src/components/kernal/`
**NOT**: `kernal/packages/ui/src/` (the @kernal/ui migration is incomplete — andes-web dashboard.tsx still imports components from local files)

After these changes, also sync the same changes to the corresponding files in `kernal/packages/ui/src/` so the package stays current.

---

## API Confirmed

`/api/dashboard/actions` returns (verified from live NUC response):
```
id, title, due_date, status, owner_id, notes, created_at, list, category,
priority, deal_id, goal_id, project_id, entity_id, owner_name, deal_title, goal_title
```

The `ActionsApiData` type in local files is incomplete — update it.

---

## File Map

| File | Location | Action | Change |
|------|----------|--------|--------|
| `use-kernal-api.ts` | andes-web/src/components/kernal/ | MODIFY | Extract `patchAction()` as exported helper; update `ActionsApiData` type |
| `deal-board.tsx` | andes-web/src/components/kernal/ | MODIFY | Fix broken 404 endpoint; update filter to use `deal_id` |
| `project-board.tsx` | andes-web/src/components/kernal/ | MODIFY | Fix broken 404 endpoint; show tasks inline (not hidden behind expand) |
| `action-items.tsx` | andes-web/src/components/kernal/ | MODIFY | Context badges; working checkbox; inline title/date edit |

Then sync same changes to package:
| `use-kernal-api.ts equivalent` | kernal/packages/ui/src/config.ts | MODIFY | Export patchAction; update ActionsData type |
| `deal-board.tsx` | kernal/packages/ui/src/ | SYNC | Same changes as local |
| `project-board.tsx` | kernal/packages/ui/src/ | SYNC | Same changes as local |
| `action-items.tsx` | kernal/packages/ui/src/ | SYNC | Same changes as local |

---

## Detailed Changes

### 0. FIRST: Update ActionsData type in @kernal/ui/src/config.ts + add patchAction

**This must be done before any local file edits**, because `use-kernal-api.ts` re-exports types from `@kernal/ui`. Widening the type in `use-kernal-api.ts` alone is a no-op — the package definition wins.

**Edit `kernal/packages/ui/src/config.ts`:**

Update the `ActionItem` and `ActionsData` interfaces:
```typescript
export interface ActionItem {
  id: number;
  title: string;
  due_date: string | null;
  status: string;
  owner_name: string | null;
  priority?: string;
  list?: string;
  deal_id?: number | null;
  goal_id?: number | null;
  project_id?: number | null;
  entity_id?: number | null;
  deal_title?: string | null;
  goal_title?: string | null;
}

export interface ActionsData {
  actions: ActionItem[];
  grouped: { overdue: ActionItem[]; this_week: ActionItem[]; upcoming: ActionItem[]; no_date: ActionItem[] };
  count: number;
}
```

**Add `patchAction` to `kernal/packages/ui/src/config.ts`:**
```typescript
export async function patchAction(id: number, body: Record<string, unknown>): Promise<unknown> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getApiBase()}/api/actions/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**Add to `kernal/packages/ui/src/index.ts` exports:**
```typescript
export { ..., patchAction, type ActionItem, type ActionsData } from './config';
```

**Rebuild the package:**
```bash
cd kernal/packages/ui && npm run build
```

After rebuild, `use-kernal-api.ts` re-export shim in andes-web automatically picks up the new types and `patchAction`.

### 1. use-kernal-api.ts — Add patchAction re-export (ONE LINE)

After the package is rebuilt, add to `use-kernal-api.ts`:
```typescript
export { ..., patchAction, type ActionItem, type ActionsData } from '@kernal/ui';
```

No new local implementation needed.

### 2. deal-board.tsx — Fix 404 + filter by deal_id

**Line 524: Fix endpoint** (include ?status=open — dashboard endpoint accepts it)
```typescript
// BEFORE:
const { data: actionsData } = useApi<ActionsApiData>('/api/actions?status=open');
// AFTER:
const { data: actionsData } = useApi<ActionsData>('/api/dashboard/actions?status=open');
```

**Filter update (line ~293)**: Current filter uses `String(t.entity_id) === String(deal.id)`. After the gartner linking work, actions use `deal_id` not `entity_id`. Update to:
```typescript
const dealTasks = (actionsData?.actions ?? []).filter(t =>
  (t.deal_id === deal.id || String(t.entity_id) === String(deal.id)) && t.status === 'open'
);
```
This handles both old entity_id-linked and new deal_id-linked actions.

**Cap**: Change `.slice(0, 3)` to `.slice(0, 5)`. Add overflow indicator that expands inline on click:
```tsx
{dealTasks.length > 5 && (
  <button
    onClick={e => { e.stopPropagation(); setShowAllTasks(true); }}
    style={{ fontSize: 10, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', paddingLeft: 24, marginTop: 2 }}
  >
    +{dealTasks.length - 5} more
  </button>
)}
```
Add `const [showAllTasks, setShowAllTasks] = useState(false)` per deal card.
When `showAllTasks`, render all tasks. When false, render `.slice(0, 5)`.

**Replace `handleTaskDone` inline fetch with patchAction:**
```typescript
// deal-board.tsx handleTaskDone (lines 367-378):
// BEFORE: inline fetch
// AFTER:
const handleTaskDone = async (taskId: number) => {
  setDeletedTaskIds(prev => new Set([...prev, taskId]));
  try { await patchAction(taskId, { status: 'done' }); } catch { /* task will reappear on next fetch — acceptable */ }
};
```

**Import patchAction from use-kernal-api** (remove the existing inline fetch in handleTaskDone).

### 3. project-board.tsx — Fix 404 + expose tasks inline

**Line 173: Fix endpoint**
```typescript
// BEFORE:
`${getApiBase()}/api/actions?entity_id=${project.id}&status=open`
// AFTER: use shared actionsData filtered by project_id
```

**Fetch actionsData in `dashboard.tsx`** (not inside ProjectBoard or DealBoard — one fetch, two consumers):
In `dashboard.tsx`, add:
```typescript
const { data: actionsData } = useApi<ActionsData>('/api/dashboard/actions?status=open');
```
Pass `actionsData` as a prop to both `<DealBoard actionsData={actionsData} />` and `<ProjectBoard actionsData={actionsData} />`. This prevents duplicate fetches.

**Update DealBoard and ProjectBoard signatures** to accept `actionsData` as an optional prop (fall back to internal fetch if not provided for backward compat).

**Per ProjectCard, filter:**
```typescript
const { data: actionsData } = useApi<ActionsData>('/api/dashboard/actions?status=open');
```
Pass `actionsData` down to each `ProjectCard` as a prop.

Per `ProjectCard`, filter:
```typescript
const projectTasks = (actionsData?.actions ?? []).filter(t =>
  (t.project_id === project.id || String(t.entity_id) === String(project.id)) && t.status === 'open'
);
```

**Remove**: `taskError`, `tasksLoading`, `expanded` state, the lazy fetch `useEffect`, skeleton UI, and the `▸` expand toggle. These become dead code.

**Show first 3 tasks inline** below the project goal badge (not hidden). Same `InlineTask` component pattern as deal-board.

**Import patchAction from use-kernal-api**.

### 4. action-items.tsx — Context badges + working completion + inline edit

#### 4a. Remove private patchAction, import from use-kernal-api
```typescript
import { useApi, getApiBase, getAuthHeaders, patchAction } from './use-kernal-api';
// Remove the local patchAction definition (lines 32-41)
```

#### Fix the useApi call to include status=open (prevents completed tasks re-appearing on refetch)
Find: `useApi<ActionsData>('/api/dashboard/actions')`
Replace: `useApi<ActionsData>('/api/dashboard/actions?status=open')`

Also add `completedIds: Set<number>` to filter out optimistically-completed items that might slip through:
```typescript
const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
// In the onChange handler: setCompletedIds(prev => new Set([...prev, item.id])); onTaskDone(item.id);
// In filtered display: filter out tasks where completedIds.has(t.id)
```

#### 4b. Update ActionItem type (or import from use-kernal-api)
Import the full `ActionItem` type from use-kernal-api instead of local definition.

#### 4c. Context badge — add after task title
```tsx
// After the title span, before priority badge:
{item.deal_title && (
  <span style={{
    fontSize: 10, fontWeight: 600, background: '#EEF2FF', color: '#4F46E5',
    borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0,
  }}>
    {item.deal_title}
  </span>
)}
{!item.deal_title && item.goal_title && (
  <span style={{
    fontSize: 10, fontWeight: 600, background: '#F0FDF4', color: '#166534',
    borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0,
  }}>
    {item.goal_title}
  </span>
)}
```

#### 4d. Working completion checkbox
The current checkbox (line ~184) is a `<div>` — replace with:
```tsx
<input
  type="checkbox"
  style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
  onClick={e => e.stopPropagation()}
  onChange={async () => {
    // Add to completedIds BEFORE the PATCH (not after) — prevents flash on slow PATCH
    setCompletedIds(prev => new Set([...prev, item.id]));
    onTaskDone(item.id);
    try {
      await patchAction(item.id, { status: 'done' });
    } catch {
      // PATCH failed — revert optimistic removal
      setCompletedIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }}
/>
```

**Optimistic state**: `onTaskDone` already exists and removes from local list. To prevent stale refetch resurrection, add to the Set-of-removed-IDs pattern (copy deal-board's `deletedIds` set approach if present).

#### 4e. Inline title edit — use override-Map pattern (not refetch)

`useApi` has no `refetch()`. Use a local `titleOverrides: Map<number, string>` to hold in-flight edits:
```typescript
const [titleOverrides, setTitleOverrides] = useState<Map<number, string>>(new Map());

const saveTitle = async (id: number, title: string) => {
  if (!title.trim()) { setEditingId(null); return; }
  setTitleOverrides(prev => new Map([...prev, [id, title]]));
  setEditingId(null);
  try { await patchAction(id, { title }); } catch { /* revert override on next fetch */ }
};

// When rendering title: titleOverrides.get(item.id) ?? item.title
```


```tsx
const [editingId, setEditingId] = useState<number | null>(null);
const [editValue, setEditValue] = useState('');

const saveTitle = async (id: number, title: string) => {
  if (!title.trim()) return;
  // Optimistic update local state
  setLocalTasks(prev => (prev ?? rawTasks).map(t => t.id === id ? { ...t, title } : t));
  try { await patchAction(id, { title }); } catch { /* revert on next fetch */ }
};

// In TaskRow, replace title span:
{editingId === item.id ? (
  <input
    value={editValue}
    autoFocus
    style={{ flex: 1, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4, padding: '1px 6px' }}
    onClick={e => e.stopPropagation()}
    onChange={e => setEditValue(e.target.value)}
    onBlur={() => { saveTitle(item.id, editValue); setEditingId(null); }}
    onKeyDown={e => {
      if (e.key === 'Enter') { saveTitle(item.id, editValue); setEditingId(null); }
      if (e.key === 'Escape') setEditingId(null);
    }}
  />
) : (
  <span
    style={{ flex: 1, fontSize: 13, cursor: 'text', ... }}
    onClick={e => { e.stopPropagation(); setEditingId(item.id); setEditValue(item.title); }}
  >
    {item.title}
  </span>
)}
```

#### 4f. Inline date edit
```tsx
<span
  style={{ fontSize: 11, color: isOverdue ? '#EF4444' : '#9CA3AF', cursor: 'pointer' }}
  onClick={async e => {
    e.stopPropagation();
    const current = item.due_date?.slice(0, 10) ?? '';
    const newDate = window.prompt('Due date (YYYY-MM-DD, or leave blank to clear):', current);
    if (newDate === null) return; // cancelled
    const d = newDate.trim();
    // Validate: must be YYYY-MM-DD or empty
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) { alert('Invalid date format. Use YYYY-MM-DD.'); return; }
    const val = d || null;
    setLocalTasks(prev => (prev ?? rawTasks).map(t => t.id === item.id ? { ...t, due_date: val } : t));
    try { await patchAction(item.id, { due_date: val }); } catch { /* revert on next fetch */ }
  }}
>
  {item.due_date?.slice(0, 10) ?? 'no date'}
</span>
```

Note: `window.prompt()` is simple and avoids a date picker dependency. Validate format before PATCH.

---

## Constraints

- [ ] No new dependencies
- [ ] patchAction exported from use-kernal-api — one implementation, three consumers
- [ ] Deal tasks filter: `deal_id` OR `entity_id` (backward compat)
- [ ] Project tasks filter: `project_id` OR `entity_id` (backward compat)
- [ ] Optimistic UI on all mutations (checkbox → immediate remove, title edit → immediate update)
- [ ] After local andes-web changes: sync same changes to `kernal/packages/ui/src/` and rebuild package

---

## Known Pitfalls

1. **date input via prompt()**: Simple but breaks if user pastes time suffix. Always `.slice(0, 10)` before sending to API.
2. **Stale optimistic removal**: If data refetches while checkbox is in flight, task may reappear. Add completed task IDs to a local `Set<number>` that excludes them from render until page reload.
3. **stopPropagation on inline edit**: Title input click must stopPropagation to prevent deal card expand/collapse firing. Same for date click.
4. **actionsData shape**: `.actions[]` not `.grouped` — filter on `.actions`.
5. **deal-board existing duplicate patchAction**: line 357+ has its own patchAction. Remove it after importing from use-kernal-api.

---

## Verify

```bash
cd andes-web && npx next dev -p 9002
# Then in browser (with auth bypass):
# 1. Deals view: deal cards show tasks with checkboxes + red overdue dates (not just "+ Add task")
# 2. Check a task → row fades and disappears
# 3. Click task title → input appears → type new name → blur → title updated
# 4. Click date → prompt appears → change date → date updates
# 5. Deal/goal context badge visible on each row in Tasks view
# 6. Projects view: tasks visible inline (not hidden behind expand)
#
# Build package after changes:
cd kernal/packages/ui && npm run build
```
