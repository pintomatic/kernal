# Gaps in OSS Kernal for Executive Search

This document identifies capabilities missing from the open-source Kernal core that would be needed for production executive search workflows.

## 1. No First-Class Assignment Entity

Assignments (search mandates) are stored as tagged notes (`[ASSIGNMENT]`), not as a proper entity with structured fields. This means there is no way to query assignments by status, client, confidentiality level, or deadline without parsing free text. A dedicated `assignments` table with typed columns would enable filtering, reporting, and pipeline views.

**Impact:** Cannot build a live mandate pipeline or track assignment lifecycle without text parsing heuristics.

## 2. No Candidate-Assignment Junction Table

There is no structured way to link a candidate (person) to an assignment beyond notes and generic relationships. Exec search needs a `candidacies` table that tracks status (identified, approached, interviewed, shortlisted, placed, rejected), stage timestamps, and the rejection/placement reason as a typed field. The current `relationships` table is too generic for this — it lacks status, timestamps, and multi-field metadata.

**Impact:** Cannot answer "show me all candidates for assignment X at stage Y" without scanning notes.

## 3. No Confidentiality Controls

The schema has no visibility or access-control fields. In executive search, some assignments are highly confidential (e.g., CEO replacement while incumbent is still in role). There is no way to mark an assignment, note, or relationship as confidential, restrict who can see it, or audit who accessed it.

**Impact:** Confidential mandates are visible to anyone with database access. Not suitable for multi-user firms.

## 4. No Temporal Relationships

Relationships in Kernal are static — they have a `created_at` but no `valid_from` / `valid_until`. In exec search, employment history matters: "Maren Dahl worked at Nordvik Energy 10 years ago" is different from "Maren Dahl works at Nordvik Energy." Without temporal bounds, the graph cannot distinguish past from present affiliations.

**Impact:** Former employers look identical to current employers in graph queries.

## 5. No Scoring or Assessment Framework

The shortlist generator in this demo implements scoring in application code. A production system would need a pluggable scoring framework: configurable weights, custom criteria per assignment type, normalized scores, and the ability to store and compare historical scores. The database has no structure for assessments, ratings, or scoring history.

**Impact:** Every consumer of candidate data must re-implement its own scoring logic.

## 6. No Audit Trail on Reads

Kernal tracks when entities are created and updated, but does not log when data is read or by whom. In regulated executive search (e.g., GDPR in Europe), firms must demonstrate who accessed candidate data and when. The current schema has no read-audit capability.

**Impact:** Cannot comply with data access auditing requirements common in European exec search firms.

---

## Summary

These gaps are intentional in the OSS core — Kernal is designed as a lightweight knowledge graph, not a vertical SaaS. Addressing them would make Kernal viable for production executive search, which is the goal of the Kernal Pro roadmap.
