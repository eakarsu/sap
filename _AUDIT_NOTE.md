# Audit Note - sap

Source: `_AUDIT/reports/batch_11.md` (lines 823-846).

## Original Audit Recommendations

Audit verdict: **TEMPLATE-CLONE** — "Frontend-only SAP admin UI with no backend; API consumer model."

(NOTE: Audit was inaccurate. The repo does have a working Node/Express backend at `backend/server.js` with 80+ endpoints including auth, dashboard stats, search, admin user management, generic CRUD over many SAP-style tables, and an extensive AI surface: `/api/ai/sales-forecast`, `/lead-scoring`, `/sentiment`, `/content-generate`, `/insights`, `/copilot`, `/performance`, `/competitor-analysis`, `/code-generate`, `/generate-record`, `/check-duplicates`, etc.)

### Audit-Listed Gaps
- "All business logic external; this is purely a UI wrapper." (False — backend exists.)

## Categorization

The substantial backend already covers most of what an SAP-style admin/AI surface needs. Remaining gaps would be SAP-specific connectors (BAPI/RFC, IDoc, OData) which are **NEEDS-CREDS / NEEDS-PRODUCT-DECISION** — not safe to add mechanically without a real SAP system to integrate against.

No code changes applied. This project is logged as **backlog-only**.

## Backlog (Prioritized)

### High
- Real SAP connector layer (OData/BAPI/IDoc) — needs SAP creds.
- Approval workflow engine for transactional documents.
- Cross-company consolidation rules.

### Medium
- Pricing condition rule engine.
- Document flow visualization.
- Where-used analysis backend.

### Low / Product Decisions
- AI Studio (custom prompt design surface).
- Replace generic CRUD with SAP-conforming entity model.

## Apply pass 3 (frontend)

**Action:** LEFT-AS-IS (FE already wired).

Two dedicated AI surfaces already exist in the Vite/React frontend:

- `frontend/src/pages/AIInsights.jsx` — rich tabbed UI covering the bulk of the `/api/ai/*` endpoints (sales forecasting, lead scoring, sentiment, insights, copilot, RAG, customer 360, recommendations, workflow suggestions, anomalies, contract analysis, intelligent matching, NL reporting, data quality, vendor risk, multi-doc QA, change impact, email-to-record, pricing optimizer, batch demand forecast, translation, RAG-with-citations, etc.).
- `frontend/src/pages/AIStudio.jsx` — Hybrid Search / Approver Recommender / Anomaly→Ticket / Voice Action / Tenant Keys / AI History tabs.

`frontend/src/api.js` exports a generic `callAI(endpoint, body)` helper plus 30+ specific helpers, all token-aware. `App.jsx` Global Search also calls `callAI('smart-search', ...)` inline.

Backend mounts inline in monolithic `backend/server.js` (no `routes/` dir); `app.use('/api/ai', aiRateLimiter)` verified at line 614.

Files: none modified.

## Apply pass 4 (mechanical backlog)

**Action:** SKIPPED. All remaining backlog items (real SAP OData/BAPI/IDoc connector, approval workflow engine, cross-company consolidation rules, pricing condition rule engine, document flow visualization, where-used backend, SAP-conforming entity model, custom AI Studio prompt design surface) are NEEDS-CREDS or NEEDS-PRODUCT-DECISION. No mechanical items remain.

Files: none modified.

## Apply pass 5 (all backlog)

Implemented 10 endpoints additively (cap was 10) by appending to `backend/server.js` (the single-file Express app). No changes to working code, no new deps.

### Backend (new endpoints, all gate on OPENROUTER_API_KEY at minimum)
1. `POST /api/sap/odata-proxy` — NEEDS-CREDS: SAP_ODATA_BASE_URL. Additive: never calls SAP; LLM produces a GET-URL plan.
2. `POST /api/sap/bapi-call` — NEEDS-CREDS: SAP_BAPI_GATEWAY_URL. Additive: LLM produces a BAPI invocation plan.
3. `POST /api/sap/idoc-process` — NEEDS-CREDS: SAP_IDOC_DROP_DIR. Additive: LLM parses IDoc payload to JSON.
4. `POST /api/sap/approval-workflow` — PRODUCT-DECISION resolved. New `approval_workflows` table (CREATE TABLE IF NOT EXISTS); states `draft|pending|approved|rejected`. Body `{entity_type, entity_id, action: 'create'|'transition', target_state?, approver_id?}`.
5. `POST /api/sap/cross-company-consolidation` — PRODUCT-DECISION resolved. SUM(metric) GROUP BY company_code if column present; LLM narrative including elimination suggestions. Identifier whitelist (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) prevents SQL injection.
6. `POST /api/sap/pricing-conditions` — PRODUCT-DECISION resolved. New `pricing_condition_rules` table (chosen to avoid collision with the existing `pricing_conditions` table that has a different schema). Stores opaque expression strings; LLM advises on risks/interactions.
7. `POST /api/sap/document-flow` — PRODUCT-DECISION resolved. LLM narrates preceding/current/following docs + ASCII flow diagram.
8. `POST /api/sap/where-used` — PRODUCT-DECISION resolved. LLM produces `{tables, transactions, rationale}` JSON for a master-data record.
9. `POST /api/sap/entity-mapping` — PRODUCT-DECISION resolved. LLM proposes mappings between this app's tables and SAP standard entities (MARA, VBAK, …).
10. `POST /api/ai/studio-prompt-design` — PRODUCT-DECISION resolved. AI Studio prompt-design coach: returns `{systemPrompt, userTemplate, rationale}`.

Schema additions: `approval_workflows`, `pricing_condition_rules` — both `CREATE TABLE IF NOT EXISTS`, ensured lazily.

### Frontend
- `frontend/src/api.js` extended with 10 client helpers (`sapOdataProxy`, `sapBapiCall`, `sapIdocProcess`, `sapApprovalWorkflow`, `sapCrossCompanyConsolidation`, `sapPricingConditions`, `sapDocumentFlow`, `sapWhereUsed`, `sapEntityMapping`, `aiStudioPromptDesign`).
- `frontend/src/pages/AIStudio.jsx` extended with a new "SAP Backlog (additive)" tab that exposes all 10 endpoints via a single dropdown + JSON-textarea form. Reuses existing `card`, `input`, `btn` styles. No new dependencies.

### Smoke test
Started backend on port 4087 with explicit env (`JWT_SECRET`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `DATABASE_URL`). Login as `admin@sapcrm.com / password123` succeeded. Tested:
- `POST /api/sap/odata-proxy` (no SAP_ODATA_BASE_URL set) → `HTTP 503 {"error":"SAP_ODATA_BASE_URL not configured","missing":"SAP_ODATA_BASE_URL"}` ✓
- `POST /api/sap/approval-workflow` (action=create) → 200 with new workflow row id=2 ✓
- `POST /api/sap/pricing-conditions` → 200 with new rule + LLM advice ✓
- `POST /api/ai/studio-prompt-design` → 200 with structured prompt design ✓

Note: an existing `pricing_conditions` table already exists with a different schema (condition_type, module, record_id, description, amount, …). To avoid touching it, the new rule-engine table is named `pricing_condition_rules`.

### Files modified
- `backend/server.js` (extended, ~280 lines added before `app.listen`)
- `frontend/src/api.js` (extended)
- `frontend/src/pages/AIStudio.jsx` (extended)
