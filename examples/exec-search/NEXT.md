# Next Build Priorities: Exec Search on Kernal

Ranked by impact on the BackerSkeie demo and production readiness.

## 1. Assignment Entity + Candidacy Table (High)

Add a first-class `assignments` table (title, client_org_id, status, confidential, deadline, brief, lead_partner_id) and a `candidacies` junction table (assignment_id, person_id, stage, stage_date, rejection_reason, placement_date). This replaces the `[ASSIGNMENT]` note convention and enables structured pipeline queries. Estimated: 2 days.

## 2. LLM-Powered Rationale Generation (High)

The current shortlist generator uses pure heuristics (string matching, simple scoring). Integrate an LLM call (Claude via MCP or direct API) to generate natural-language fit assessments from structured data. The graph provides the facts; the LLM provides the prose. Keep the audit trail deterministic — only the summary text is LLM-generated, all claims still trace to source IDs. Estimated: 1 day.

## 3. Temporal Relationships (Medium)

Add `valid_from` and `valid_until` columns to the `relationships` table. Update the resolver to distinguish current vs. former affiliations. This enables queries like "where did this candidate work 5 years ago?" and prevents false positives from stale employment data. Estimated: 1 day.

## 4. Confidentiality Flags (Medium)

Add a `visibility` column to `notes`, `assignments` (once created), and `relationships`. Values: `public`, `internal`, `confidential`, `restricted`. Update all query tools to filter by the caller's clearance level. For the demo, a simple flag is sufficient; production would need role-based access. Estimated: 1 day.

## 5. Placement Tracking + Win/Loss Analytics (Low)

Close the loop: when a candidate is placed, record it as a structured event (not just a note). Track placement rate by assignment type, sector, and candidate source. This data feeds back into pattern notes and scoring weights. Estimated: 2 days.

---

## Sequencing

Items 1 and 2 are prerequisites for the live BackerSkeie demo. Items 3-4 are needed before any multi-user deployment. Item 5 is a growth feature that improves over time as placements accumulate.
