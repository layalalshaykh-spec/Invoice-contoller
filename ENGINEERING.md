# ENGINEERING.md
## AI-Powered Accounts Payable Command Center — MVP Build Spec
**Audience:** Coding agent (Codex / Claude Code) building this repo autonomously.
**Goal:** Ship a demo-grade, investor/client-facing MVP that *looks and feels* like a funded fintech product — not a prototype — while implementing the real logic (extraction, matching, rules, exceptions) described in the SOW.
**Definition of done:** `git clone` → one command → seeded data → a client can click through the full invoice lifecycle end-to-end in under 5 minutes and believe this is production software.

---

## 0. Operating Instructions for the Agent

1. Work in vertical slices, not layers. Every commit should leave the app in a runnable, demoable state.
2. After each milestone in Section 9, run the app, take a screenshot/console check, and self-verify against that milestone's **Acceptance Criteria** before moving on. Do not silently skip acceptance checks.
3. Never block on missing real integrations (ERP, real OCR vendor, real bank). Stub behind an interface and seed realistic mock data — see Section 6.
4. Optimize for demo truthfulness: numbers on the dashboard must derive from real seeded data flowing through real code paths, not hardcoded UI numbers.
5. Default to boring, provable choices over clever ones. If two approaches are equally fast to build, pick the one that is easier to explain to a non-technical CFO in a demo.
6. Commit early, commit often, with descriptive messages tied to the milestone ID (e.g. `feat(M3): PO/GRN 3-way match engine`).

---

## 1. Product Framing (what we are actually selling in the demo)

The client is not buying "an app that extracts invoices." They are buying **control + speed + visibility** over AP. The demo must make three things visceral in under 5 minutes:

1. **Speed** — an invoice goes from raw PDF to categorized decision in seconds, visibly, on screen (not a spinner — show the pipeline stages lighting up).
2. **Trust** — every automated decision is explainable and traceable back to a rule or a matched document. Nothing is a black box.
3. **Control** — a human is always one click away from overriding the AI, and that override is itself audited.

Everything in this spec exists to make those three things land in the room.

---

## 2. MVP Scope (subset of full SOW — see SOW §25)

**In scope for MVP:**
- Invoice upload (drag/drop + email-simulated inbox)
- AI document extraction (vision LLM) with confidence scores, Arabic + English
- Invoice normalization to canonical schema
- Supplier validation against seeded master data
- Duplicate detection (rule-based + fuzzy)
- PO matching (2-way)
- GRN matching (3-way) where GRN exists
- Configurable tolerance-based Business Rules Engine (deterministic, not LLM)
- Exception queue with AI-generated investigation + recommendation
- Human-in-the-loop approve/reject/request-info workflow
- Full audit trail per invoice
- AP Command Center dashboard (KPIs, touchless rate, exception breakdown)
- Role-based views (AP Clerk, AP Manager, Auditor) — UI-level RBAC is enough for MVP

**Explicitly out of scope for MVP** (per SOW §41 — do not build, but leave clean extension points):
- Real ERP connectors (mock adapter only)
- Real payment execution
- Multi-tenant infra (single-tenant demo org is fine; keep `org_id` on every table so it's a 1-line change later)
- Supplier portal
- Real email/SFTP ingestion (simulate via a seed script)

---

## 3. Tech Stack

Chosen for: fast to build, looks premium out of the box, easy to demo locally or deploy to a single URL, and matches what a top-tier engineer would actually reach for in 2026.

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Framer Motion** | Fast, modern, animation-friendly for the "pipeline lighting up" moments |
| Charts | **Recharts** | Clean, composable, good defaults |
| Backend | **Node.js (Next.js API routes or a separate Fastify service if the agent prefers service separation)** | One language across the stack = faster to build and demo-stable |
| DB | **PostgreSQL** (via Prisma ORM) | Relational integrity matters for PO/GRN/Invoice matching; Prisma gives fast iteration |
| File storage | Local `/uploads` dir for MVP, abstracted behind a `StorageAdapter` interface (swap to S3/Azure Blob later) | Don't burn time on cloud storage for a demo |
| AI extraction | **Anthropic Claude (vision + structured JSON output)** via the Messages API | Handles Arabic + English documents, images and PDFs, returns structured fields with confidence |
| AI investigation / RAG | Claude with a lightweight retrieval step over seeded policy docs (simple pgvector or even in-memory cosine similarity — no need for a heavy vector DB at MVP scale) | Keeps §12–13 of the SOW real, not decorative |
| Auth | Simple session-based auth, 3 seeded demo users (one per role) | No need for a full IdP in a demo |
| Background jobs | In-process async queue (e.g. a simple job table + poller), not a separate infra piece | Avoid Redis/Kafka overhead for MVP; document the swap point for production |
| Testing | Vitest/Jest for logic (esp. the matching + rules engine — this is the credibility core), Playwright for one smoke E2E test of the golden demo path | The rules engine is what a CFO will grill you on — it must be unit-tested |

Do not introduce Kubernetes, microservices, message brokers, or multi-region infra for the MVP. That is Phase 4 (SOW §27), not this repo.

---

## 4. Design Bar (non-negotiable)

This is a fintech control-tower product. The design must communicate precision, calm, and authority — think Ramp / Linear / Mercury, not a generic admin template.

**Rules:**
- No default browser blue, no unstyled shadcn defaults left as-is. Establish a real design system first (tokens below), then build screens.
- Typography: one display/geometric sans for headers (e.g. a distinctive weight pairing), one workhorse sans for body/data (e.g. Inter). Tabular numerals for all monetary/quantity figures.
- Color: a restrained neutral base (near-black/near-white, not pure) + a single confident accent color + a strict semantic set for status (match = green, exception = amber, mismatch/duplicate = red, pending = slate). Do not let every card have a different accent — status color is earned, not decorative.
- Density: this is an operational tool used all day by AP clerks — favor information density and scan-ability over marketing-site whitespace, but keep generous spacing in the primary data tables so numbers are easy to compare.
- Motion: use Framer Motion purposefully — the invoice pipeline (§4.2/§18 of SOW) should visibly animate through stages (Received → Extracting → Validating → Matching → Decision) when opening an invoice. This is the single highest-leverage "wow" moment in the demo — build it well.
- Every screen needs a real empty state, a real loading state, and a real "0 exceptions today" state — a demo where someone clicks around off the golden path and hits a broken screen kills credibility.
- Dark mode is optional; a polished light mode is mandatory.

Before building any screen, establish `design-tokens.ts`/`globals.css` with the full color/spacing/type scale. Do not let screens invent ad-hoc values.

---

## 5. Data Model (Prisma schema — core entities)

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
}

model User {
  id     String @id @default(cuid())
  orgId  String
  name   String
  email  String @unique
  role   Role   // AP_CLERK, AP_MANAGER, FINANCE_MANAGER, ADMIN, AUDITOR
}

model Supplier {
  id           String  @id @default(cuid())
  orgId        String
  name         String
  taxId        String?
  status       SupplierStatus // ACTIVE, INACTIVE, PENDING, BLOCKED
  bankAccount  String?
  isApproved   Boolean @default(true)
}

model PurchaseOrder {
  id         String    @id @default(cuid())
  orgId      String
  poNumber   String
  supplierId String
  currency   String
  status     String
  lines      POLine[]
  totalAmount Decimal
}

model POLine {
  id          String  @id @default(cuid())
  poId        String
  description String
  quantity    Decimal
  unitPrice   Decimal
  currency    String
}

model GoodsReceiptNote {
  id         String   @id @default(cuid())
  orgId      String
  grnNumber  String
  poId       String
  lines      GRNLine[]
  receivedAt DateTime
}

model GRNLine {
  id            String @id @default(cuid())
  grnId         String
  description   String
  quantityRecvd Decimal
}

model Invoice {
  id                String        @id @default(cuid())
  orgId             String
  supplierId        String?
  poNumber          String?
  invoiceNumber     String
  invoiceDate       DateTime?
  dueDate           DateTime?
  currency          String?
  subtotal          Decimal?
  taxAmount         Decimal?
  totalAmount       Decimal?
  sourceFileUrl     String
  sourceLanguage    String?       // "ar" | "en"
  rawExtraction     Json?         // full LLM output incl. per-field confidence
  status            InvoiceStatus // RECEIVED, EXTRACTING, VALIDATING, MATCHING, AUTO_APPROVED, EXCEPTION, APPROVED, REJECTED
  duplicateOf       String?
  duplicateStatus   String?       // NO_DUPLICATE, POSSIBLE_DUPLICATE, CONFIRMED_DUPLICATE
  matchResult       Json?         // structured PO/GRN comparison result
  lines             InvoiceLine[]
  createdAt         DateTime      @default(now())
}

model InvoiceLine {
  id          String  @id @default(cuid())
  invoiceId   String
  description String
  quantity    Decimal
  unitPrice   Decimal
  taxAmount   Decimal?
}

model Exception {
  id            String   @id @default(cuid())
  invoiceId     String
  category      String   // PO_MISMATCH, GRN_MISMATCH, DUPLICATE, SUPPLIER_ISSUE, MISSING_INFO, OTHER
  severity      String   // LOW, MEDIUM, HIGH
  aiAnalysis    String?
  aiRecommendation String?
  aiConfidence  Float?
  status        String   // NEW, UNDER_REVIEW, WAITING_FOR_INFO, APPROVED, REJECTED, RESOLVED, ESCALATED
  assignedToId  String?
  createdAt     DateTime @default(now())
}

model AuditLog {
  id            String   @id @default(cuid())
  invoiceId     String
  userId        String?
  action        String
  previousStatus String?
  newStatus     String?
  detail        Json?
  createdAt     DateTime @default(now())
}
```

This schema is intentionally close to the SOW's canonical fields (§4.2, §5, §22) so the demo narrative maps 1:1 back to the document the client already read.

---

## 6. Mock Data & Integration Strategy

Since there is no real ERP in the room, **realism of seed data is what sells the demo.** Build a `seed.ts` that generates:

- 1 demo organization ("Al Rayyan Trading & Contracting" or similar Qatar-plausible name)
- 3 users (one per primary role)
- 12–15 suppliers, mix of local (Arabic-named) and international
- 20–30 Purchase Orders with realistic line items (construction/trading/FM domain per SOW §2)
- Matching GRNs, some intentionally partial (to trigger GRN mismatch)
- 25–40 invoices as actual generated PDF/image files (not just DB rows) covering:
  - Clean matches (auto-approved path)
  - Price variance beyond tolerance
  - Quantity variance vs GRN
  - A duplicate pair (same supplier/invoice number/amount)
  - A missing-PO invoice
  - At least 3 Arabic-language invoices
  - At least 1 low-confidence/blurry extraction to show the confidence-flagging UI

Generate these mock invoice documents programmatically (simple HTML→PDF templates with varied layouts per "supplier" per SOW §5's normalization example) so the extraction pipeline runs against real files, not fixtures pretending to be extracted.

Build a `StorageAdapter`, `ERPAdapter`, and `NotificationAdapter` interface now, with a `MockERPAdapter` implementation, so the only work to go live later is writing a new adapter — say this explicitly in code comments, it matters for the client's technical due diligence.

---

## 7. Core Engines (the credibility layer — build these carefully, with tests)

### 7.1 Extraction Service
- Input: file (PDF/image) → Claude vision call with a strict JSON schema prompt (fields per SOW §4.2) → per-field confidence score.
- Low-confidence fields (<0.75) flagged for review in the UI, never silently accepted.
- Must handle Arabic invoices and map supplier-specific labels (e.g. `فاتورة رقم`) to canonical fields per SOW §5's normalization example — build this as an explicit, testable normalization function, not just prompt magic.

### 7.2 Duplicate Detection
- Deterministic exact-match check (supplier + invoice number + amount).
- Fuzzy check (supplier + amount within tolerance + invoice date within N days) → `POSSIBLE_DUPLICATE`.
- Pure function, unit tested with the seeded duplicate pair as a fixture.

### 7.3 Matching Engine (2-way / 3-way)
- Pure, deterministic function: `matchInvoice(invoice, po, grn, toleranceConfig) → MatchResult`.
- Compares quantity, price, currency, supplier at line-item level.
- Configurable tolerance (SOW §10, default ±2% quantity, ±1% price) via an org-level settings table, editable in an admin screen — this configurability is a specific SOW commitment, don't hardcode it.
- This is the single most important function in the codebase for client trust — give it thorough unit tests with edge cases (exact match, within tolerance, over tolerance, missing GRN, missing PO).

### 7.4 Business Rules Engine
- Deterministic, NOT an LLM call (SOW §11, §31 explicitly requires this separation — do not violate it, it is a stated governance principle in the SOW).
- Rule chain: supplier valid → PO exists → GRN exists (if required) → variance within tolerance → duplicate check passed → required fields complete → `ELIGIBLE_FOR_AUTO_PROCESSING`, else route to exception with the specific failed condition recorded.
- Represent rules as a small ordered list of named predicate functions so the UI can display exactly which rule failed (this is your audit-trail story).

### 7.5 AI Investigation Layer
- Only invoked for exceptions (never for clean matches — keep LLM calls proportional to what's actually ambiguous).
- Retrieves invoice + PO + GRN + supplier + relevant seeded policy snippet (simple RAG per SOW §13) and asks Claude to produce: `explanation`, `recommendedAction`, `confidence`.
- Recommendation is stored, displayed, and **never auto-applied** — always requires a human click (SOW §12, §14, §31). Make this visually explicit in the exception UI (e.g. an "AI suggests" pill next to a separate human "Approve" button).

---

## 8. Application Screens (MVP)

1. **Login / role picker** — pick a demo persona instantly, no real auth friction for the demo.
2. **AP Command Center (dashboard)** — SOW §15 KPIs, real numbers from seeded + processed data, exception breakdown chart, touchless rate trend.
3. **Invoice Inbox** — list + upload (drag/drop simulates email/portal intake), status badges, filters.
4. **Invoice Detail / Pipeline View** — the hero screen. Animated stage tracker (Received → Extracted → Validated → Matched → Decision), extracted fields with confidence highlighting, side-by-side PO/GRN/Invoice comparison table, match result.
5. **Exception Queue** — list with severity/category filters, SLA indicator.
6. **Exception Detail** — AI analysis + recommendation panel, document viewer, Approve/Reject/Request Info actions, full audit history for that invoice.
7. **Admin / Rules Config** — tolerance thresholds, approval routing — proves configurability (SOW §11) live in the demo.
8. **Audit Trail view** (can be a tab on invoice detail) — chronological, immutable-looking log per SOW §22.

Build in this order — it matches the natural demo script (Section 10).

---

## 9. Milestones (build in this order; each must be independently demoable)

**M0 — Scaffold & Design System**
Next.js + Tailwind + shadcn initialized, design tokens set, Prisma schema migrated, seed script produces a populated DB and generated mock invoice files.
*Acceptance:* `npm run dev` shows a styled shell (nav, empty dashboard) with zero default-template look.

**M1 — Invoice Ingestion + Extraction**
Upload flow works, files stored, Claude extraction runs, results persisted with confidence scores, raw extraction visible in a debug panel.
*Acceptance:* upload a seeded Arabic and English invoice sample, see structured fields returned within the UI.

**M2 — Normalization + Supplier Validation + Duplicate Detection**
*Acceptance:* the seeded duplicate pair is correctly flagged `POSSIBLE_DUPLICATE`; an invoice with an unknown supplier is flagged.

**M3 — PO/GRN Matching + Business Rules Engine**
*Acceptance:* clean invoice auto-approves end-to-end; a quantity-variance invoice and a price-variance invoice both land in the exception queue with the correct category.

**M4 — Exception Queue + AI Investigation + Human Decision**
*Acceptance:* opening an exception shows an AI-generated explanation/recommendation, and a human can Approve/Reject/Request Info, changing invoice status and writing an audit record.

**M5 — AP Command Center Dashboard**
*Acceptance:* all KPI tiles reflect real seeded/processed data, not placeholders; refreshing after processing an invoice changes the numbers.

**M6 — Audit Trail + RBAC views + Admin Rules Config**
*Acceptance:* switching demo persona changes visible actions; changing a tolerance in Admin visibly changes matching behavior on a re-processed invoice.

**M7 — Polish Pass**
Motion on the pipeline view, empty/loading/error states everywhere, responsive check, one Playwright smoke test covering the golden demo path end-to-end.
*Acceptance:* a stranger can click through Section 10's demo script without hitting a broken or unstyled screen.

Do not start M(n+1) until M(n)'s acceptance criteria genuinely pass.

---

## 10. The Demo Script (design the product to make this script effortless)

1. Land on **Command Center** — "here's AP right now" (real KPIs).
2. Go to **Inbox**, drag in a clean invoice → open it → watch the pipeline animate to **Auto-Approved** in seconds.
3. Drag in a price-mismatch invoice → pipeline lands on **Exception** → open it → show the AI's plain-English explanation and recommendation, then click **Approve** as the human-in-the-loop.
4. Drag in the duplicate invoice → show it caught before it ever reaches a human.
5. Open **Audit Trail** on that last invoice → show the full chain: extraction → rule failed → AI recommendation → human decision.
6. Jump to **Admin**, tighten a tolerance threshold, re-run a borderline invoice live to show the rules engine responding in real time.
7. Close on **Command Center** again — the touchless rate ticked up on screen from what just happened.

Every screen and every animation decision in this spec exists in service of this seven-beat script landing smoothly.

---

## 11. Explicit Non-Goals (say no to scope creep during the build)

Do not implement: real ERP OAuth flows, real payment rails, Kafka/queues, Kubernetes manifests, multi-tenant billing, supplier self-service portal, SFTP polling daemons, or a real email inbox integration. If asked to "just add" one of these mid-build, push back — it does not serve the demo and burns the time budget needed for design polish, which is what actually wins the room.

---

## 12. Repo Structure

```
/app                    # Next.js App Router pages
  /dashboard
  /invoices
  /invoices/[id]
  /exceptions
  /exceptions/[id]
  /admin/rules
  /api/...               # route handlers
/lib
  /engines
    extraction.ts
    normalization.ts
    duplicate.ts
    matching.ts
    rules.ts
    investigation.ts
  /adapters
    storage.ts
    erp.ts (MockERPAdapter)
    notifications.ts
/prisma
  schema.prisma
  seed.ts
/components
  /ui                    # shadcn primitives
  /pipeline               # the animated stage tracker
  /charts
/tests
  /unit                   # engines — this is the priority test target
  /e2e                    # one Playwright golden-path test
/design
  tokens.ts
ENGINEERING.md            # this file
README.md                 # quickstart for the client's IT team
```

---

## 13. README Requirement

Once built, generate a short client-facing `README.md` (separate from this file) with: one-command local run instructions, the demo script from Section 10, and a one-paragraph "what's real vs. what's mocked for this demo" honesty statement — clients trust vendors who are upfront about what's stubbed (ERP, payments) versus what's real (extraction, matching, rules, AI investigation).
