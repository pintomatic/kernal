# Implementation Plan: Shortlist Rationale Generator

## Goal
Build Target A from the exec search build brief — a shortlist rationale generator that takes an assignment and candidate list, queries the Kernal graph, and produces a client-facing rationale + internal audit trail.

## Architecture

```
seed-exec-search.ts          → Seeds exec search demo data into Kernal SQLite
                                (candidates, client orgs, assignments as notes, 
                                 interview activities, rejection reasons, patterns)

shortlist.ts                  → CLI tool: reads assignment + candidates from graph,
                                produces shortlist-rationale.md + shortlist-audit.md
                                Uses Kernal REST API (cloud mode), no raw SQL

demo.sh                       → 5-minute demo script (3 commands)
```

## Data Model Mapping (OSS Kernal → Exec Search)

| Exec Search concept | Kernal OSS entity | How |
|---|---|---|
| Assignment | `note` + `relationships` | Note content = assignment brief. Relationships link to client org + partner |
| Candidate | `person` | role, org, notes hold career history |
| Client firm | `organization` (type=client) | Standard org entity |
| Interview | `activity` (type=meeting) | Summary holds interview notes + assessment |
| Rejection reason | `note` | Content = "[REJECTED] Candidate X for Assignment Y: reason" |
| Placement | `note` | Content = "[PLACED] Candidate X at Org Y via Assignment Z" |
| Pattern | `note` | Content = "[PATTERN] ..." or "[ANTI-PATTERN] ..." |
| Shortlist decision | `note` | Content = "[SHORTLISTED] Candidate X for Assignment Y: rationale" |

## Seed Data (seed-exec-search.ts)

### Client Organizations
- Vestra Media (Media & Technology) — client
- Arctura Tech (Industrial Software) — client  
- Nordvik Energy (Energy) — client

### Candidates (people)
Keep existing 12 people from seed-demo.ts, add richer notes:
- Jonas Lindberg — SVP Digital, potential CEO candidate
- Maren Dahl — SVP Digital & Technology, CTO advisory candidate
- Astrid Berg — Founder/ex-CEO, CFO candidate
- Markus Blom — ex-CFO Vestra Media, exploring new roles
- Anders Krogh — CTO Arctura Tech (internal, not a candidate)

### Assignments (as structured notes)
1. **Arctura Tech CEO Search** — confidential, IPO-ready, commercial profile
2. **Vestra Media CFO Search** — media+tech background, board pressure
3. **Nordvik Energy CTO Advisory** — digital transformation, Q3 deadline
4. **Nordvik Energy Head of AI** — new position

### Interview/Assessment Activities
- Maren Dahl interviewed for Nordvik CTO Advisory — strong fit, former Nordvik employee
- Astrid Berg met with Lena Holm (Vestra CFO) — positive chemistry
- Markus Blom considered for Vestra CFO — rejected ("want fresh perspectives")
- Jonas Lindberg being explored for Arctura CEO — confidential, not yet approached

### Pattern Notes
- [PATTERN] "Strong female leaders in industrial firms tend to succeed when they have both sector depth and transformation experience"
- [PATTERN] "Candidates rejected for 'not enough P&L scale' often become viable 2-3 years later — always re-check"
- [ANTI-PATTERN] "Presenting candidates who recently left the same client firm — creates awkward dynamics"
- [PATTERN] "Cross-sector CFOs (energy→media, tech→industrial) outperform single-sector ones when the firm is in transformation"

### Rejection History Notes
- [REJECTED] Markus Blom for Vestra Media CFO: "Client wants fresh perspectives, not someone who just left"
- [SHORTLISTED] Astrid Berg for Vestra Media CFO: "Deep energy-tech crossover, founder credibility, open to the role"
- [SHORTLISTED] Maren Dahl for Nordvik CTO Advisory: "20 years digital transformation, former Nordvik employee (network advantage), SVP-level"

## Shortlist Generator (shortlist.ts)

### Input
```bash
npx tsx examples/exec-search/shortlist.ts \
  --assignment "Vestra Media CFO" \
  --candidates "Astrid Berg,Markus Blom,Maren Dahl"
```

### Algorithm (no LLM needed — pure graph queries)
1. Find the assignment note (search notes for the title)
2. For each candidate:
   a. Get person record (role, org, notes)
   b. Get all relationships (who they know, where they worked)
   c. Get all activities involving them (interviews, meetings)
   d. Get all notes mentioning them (rejections, shortlists, assessments)
   e. Check for conflicts: past rejection by same client? relationship with competing candidate?
   f. Build a fit assessment based on available data
3. Score candidates (simple heuristic: data richness + relationship density + no red flags)
4. Generate two documents:
   - `shortlist-rationale.md` — client-facing, professional prose
   - `shortlist-audit.md` — internal, every claim has source IDs

### Output Format (shortlist-rationale.md)
```markdown
# Shortlist Rationale: [Assignment Title]
**Client:** [Org Name]  
**Date:** [Today]  
**Prepared by:** Kernal Intelligence Engine

## Assignment Brief
[From assignment note]

## Recommended Candidates

### 1. [Candidate Name] — [Current Role] at [Current Org]
**Fit Assessment:** [paragraph]
**Key Strengths:** [bullets]
**Risks:** [bullets]
**Network Connections:** [who they know at the client]

...
```

### Output Format (shortlist-audit.md)
```markdown
# Shortlist Audit Trail: [Assignment Title]

## Candidate: [Name]
### Data Sources
- Person record: people.id=[X]
- Activities: [list with IDs and dates]
- Notes: [list with IDs]
- Relationships: [list]

### Reasoning Chain
- Claim: "20 years in digital transformation" → Source: people.id=X, role field
- Claim: "Former Nordvik employee" → Source: note.id=Y, content mentions "used to work at Nordvik"
- Risk: "Previously rejected by this client" → Source: note.id=Z, [REJECTED] tag
```

## Verify
```bash
cd kernal
npm run build
npx tsx examples/exec-search/seed-exec-search.ts --db examples/exec-search/kernal-exec.db
npx tsx examples/exec-search/shortlist.ts --db examples/exec-search/kernal-exec.db --assignment "Vestra Media CFO" --candidates "Astrid Berg,Markus Blom"
cat examples/exec-search/output/shortlist-rationale.md
cat examples/exec-search/output/shortlist-audit.md
```
