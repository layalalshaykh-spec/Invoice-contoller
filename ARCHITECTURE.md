# AP Command Center — System Architecture

## 1. Purpose and architectural stance

This document is the shared contract for the MVP. The product is a modular Next.js application backed by PostgreSQL, with deterministic finance logic isolated from transport, UI, AI providers, and persistence. It is deliberately a modular monolith: one deployable application, one database, and an in-process worker. The module seams are real interfaces so storage, ERP, notifications, extraction, and job execution can be replaced later without rewriting domain logic.

The system optimizes for three user-visible qualities:

- **Speed:** ingestion returns immediately and processing advances through durable stages.
- **Trust:** every stage writes an audit event and every decision cites named rules or matched records.
- **Control:** AI recommendations never mutate financial state; authorized humans can decide or reprocess, and every override is recorded.

All records, reads, writes, uniqueness constraints, jobs, and aggregate queries are scoped by `orgId`, even though the demo has one organization.

## 2. System context and runtime topology

```text
Browser
  └─ Next.js App Router
       ├─ Server-rendered pages / client interactions
       ├─ Route handlers (authenticated application API)
       ├─ Application services (use-case orchestration)
       ├─ Domain engines (pure deterministic functions)
       ├─ Provider adapters (AI, ERP, storage, notifications)
       └─ In-process job worker
              ├─ PostgreSQL through Prisma
              ├─ Local file storage through StorageAdapter
              └─ Claude through ExtractionProvider / InvestigationProvider
```

For local demo use, the web process starts the worker. Jobs are claimed atomically from a database table. Long-running work is never performed in a request handler. Production can split the same worker into a separate process and replace the job repository with a managed queue without changing application services.

## 3. Domain boundaries

### 3.1 Identity and access

Owns organizations, users, sessions, personas, and authorization policy. Authentication proves identity; authorization is enforced server-side in application services and API handlers. Hiding a button is not authorization.

### 3.2 Invoice intake and documents

Owns source documents, upload validation, storage keys, ingestion idempotency, and invoice creation. It does not extract or decide. A file is immutable after intake; a replacement creates a new invoice or document version.

### 3.3 Extraction and normalization

Owns provider calls, structured extraction, canonical field normalization, field confidence, language, and extraction version. Raw provider output is retained for explanation/debugging but is not directly consumed by matching. Canonical normalized values are the only downstream input.

### 3.4 Supplier and procurement reference data

Owns suppliers, POs, PO lines, GRNs, and GRN lines. In the MVP these are seeded and served through `MockERPAdapter`; matching consumes stable domain snapshots rather than querying provider-specific shapes.

### 3.5 Duplicate detection, matching, and rules

Owns pure, versioned decisions. These engines have no database, network, clock, or UI dependency. An application service loads snapshots and settings, calls the engines, persists results, creates exceptions, and appends audit events in one transaction.

### 3.6 Exceptions and human decisions

Owns exception lifecycle, assignment, SLA calculation, investigation context, AI recommendation, and human actions. An AI recommendation is advisory data. Only an authorized human action or a deterministic auto-processing result changes the invoice decision state.

### 3.7 Audit and reporting

Audit owns append-only events. Reporting derives dashboard metrics from invoices, exceptions, and decisions; UI metrics are never hardcoded. Reporting queries use a consistent definition/version for each KPI.

### 3.8 Configuration

Owns organization rules: price tolerance, quantity tolerance, fuzzy duplicate amount/date windows, GRN policy, approval policy, and SLA thresholds. Every saved configuration has a version and effective timestamp. A processing run records the configuration version it used.

## 4. Required persistence additions and constraints

The schema in `ENGINEERING.md` is a starting point. Add the following before feature work depends on it:

- Relations, foreign keys, and indexes for every `orgId`, parent ID, status, and created timestamp.
- Org-scoped uniqueness: supplier tax ID when present; `(orgId, poNumber)`; `(orgId, grnNumber)`; and a canonical invoice lookup index. Invoice number is not globally unique because duplicates must be ingestible and detected.
- `Document`: invoice ID, org ID, storage key, original name, MIME type, size, SHA-256, created time. Do not expose a raw filesystem path as a public URL.
- `ProcessingJob`: type, invoice ID, status, attempts, available time, lease time, error summary, idempotency key, timestamps.
- `ProcessingRun`: invoice ID, trigger, engine/config versions, started/completed time, outcome, and immutable input/result snapshots or their hashes.
- `OrganizationSettings`: tolerance values, duplicate windows, `grnPolicy`, auto-processing limits, version, effective timestamp, updater.
- `ExtractedField` or an equivalent typed JSON envelope containing `{value, confidence, sourceText?, normalizedValue?, warningCodes[]}`. Keep normalized invoice columns for querying.
- Exception uniqueness for active processing outcomes, for example `(invoiceId, processingRunId, category, ruleCode)`, preventing retry-created duplicates.
- Audit event fields: org ID, actor type (`USER | SYSTEM | AI`), actor/user ID, event type, entity version/run ID, structured detail, timestamp. Audit rows have no update/delete path in application code.
- Optimistic concurrency (`version` integer or updated-at precondition) on invoice, exception, and organization settings.

Use `Decimal` for quantities and money. Compare monetary values only after currency and decimal scale validation. Store UTC timestamps and render in the organization timezone. Never use floating-point arithmetic for finance rules.

## 5. Canonical invoice lifecycle

The persisted `Invoice.status` is the user-facing lifecycle state:

```text
RECEIVED
  → EXTRACTING
  → VALIDATING
  → MATCHING
  ├─ AUTO_APPROVED
  └─ EXCEPTION
       ├─ APPROVED
       └─ REJECTED
```

Rules:

- `RECEIVED → EXTRACTING` occurs only after a durable processing job exists.
- Failed technical work does not masquerade as a business exception. Job failure is recorded separately and the invoice remains at the last completed stage with a visible processing error and retry action.
- `EXCEPTION → APPROVED | REJECTED` requires an authorized human and an active exception. “Request info” changes exception state to `WAITING_FOR_INFO`; the invoice remains `EXCEPTION`.
- Reprocessing never rewrites history. It creates a `ProcessingRun`, supersedes open exceptions when appropriate, and may transition `EXCEPTION`, `APPROVED`, `REJECTED`, or `AUTO_APPROVED` back through `VALIDATING/MATCHING` only through an explicit authorized action. The audit log records the prior decision and trigger.
- Human override of a prior result requires a reason. A decision endpoint must reject stale requests using optimistic concurrency.
- Pipeline animation reflects persisted stage timestamps; it must not fabricate delays or imply work completed before the server confirms it.

Exception state is a separate state machine:

```text
NEW → UNDER_REVIEW → WAITING_FOR_INFO → UNDER_REVIEW
  ├─ APPROVED
  ├─ REJECTED
  ├─ RESOLVED
  └─ ESCALATED → UNDER_REVIEW | APPROVED | REJECTED | RESOLVED
```

Terminal exception states are immutable for that processing run. A new run creates or links a new exception rather than reopening historical evidence.

## 6. End-to-end flows

### 6.1 Upload and intake

1. Clerk requests upload; server validates role, MIME (`application/pdf`, approved image types), size, and magic bytes.
2. `StorageAdapter.put` stores an opaque object and returns a storage key plus SHA-256.
3. In one transaction, create document, invoice in `RECEIVED`, audit event, and idempotent `PROCESS_INVOICE` job.
4. Return `202 Accepted` with invoice ID and stage; UI navigates to detail and polls or subscribes for stage changes.
5. If the same idempotency key is retried, return the existing invoice. Same file hash alone is evidence for duplicate detection, not grounds to discard the upload.

The email-simulated inbox calls the same application use case with `source=SIMULATED_EMAIL`; it is not a second pipeline.

### 6.2 Processing pipeline

1. Worker atomically leases the job and creates a processing run.
2. Set `EXTRACTING`; append audit event.
3. Fetch document through storage; call extraction provider with strict schema; validate provider output; persist raw envelope, model/prompt version, and confidence.
4. Normalize explicit English/Arabic labels and number/date formats; persist canonical fields and lines. Fields below `0.75` receive `LOW_CONFIDENCE` warnings.
5. Set `VALIDATING`; resolve supplier and required fields; execute duplicate detector against org-scoped candidate invoices excluding the current invoice.
6. Set `MATCHING`; load PO/GRN snapshots through the ERP port and execute matching with the captured settings version.
7. Execute the ordered business-rule chain. Persist every rule result, not only the first failure, while preserving the first blocking rule as the primary reason.
8. If eligible, set `AUTO_APPROVED`. Otherwise set `EXCEPTION`, create deterministic categorized exception(s), then enqueue `INVESTIGATE_EXCEPTION`.
9. Append outcome audit event and complete the job transactionally. Retry provider/network errors with bounded exponential backoff; deterministic validation failures are not retried.

### 6.3 Matching policy

- Supplier, PO, currency, header totals, and line comparisons are explicit result components.
- Line association is deterministic: normalized SKU/reference first; otherwise normalized description similarity with an explicit threshold and ambiguity outcome. Do not silently choose among equal candidates.
- Two-way matching is valid when organization policy is `GRN_OPTIONAL` or when the PO/service category is configured not to require receipt evidence.
- Three-way matching is required when policy is `GRN_REQUIRED`; missing GRN becomes a `GRN_MISMATCH`/`MISSING_GRN` rule failure.
- Price variance uses a documented denominator (`abs(invoicePrice-poPrice)/abs(poPrice)`) and quantity variance uses the expected/received quantity denominator. Zero-denominator inputs return a validation failure, not infinity.
- Boundary values equal to tolerance pass (`<=`). Currency mismatch always blocks; no FX conversion exists in MVP.
- Multiple GRNs for a PO are aggregated by PO line up to the invoice cutoff time. Quantity already invoiced should be an extension point; the demo may omit cumulative consumption but must label this limitation in technical documentation.

### 6.4 Duplicate classification

- `CONFIRMED_DUPLICATE`: same org, resolved supplier, normalized invoice number, currency, and total amount; optionally strengthened by identical document hash.
- `POSSIBLE_DUPLICATE`: supplier matches and amount is within configured tolerance and invoice date is within configured day window, but exact identity is absent.
- `NO_DUPLICATE`: neither rule matches.

Both confirmed and possible duplicates block auto-processing and create a duplicate exception. This resolves the spec contradiction that calls the seeded exact duplicate “possible”: seed at least one fuzzy pair for `POSSIBLE_DUPLICATE` and classify an exact pair as `CONFIRMED_DUPLICATE`.

### 6.5 AI investigation

1. Job loads only the invoice's org-scoped invoice, supplier, PO, GRN, rule results, and approved policy snippets.
2. Retrieved context is delimited as untrusted data. Prompt instructs the model not to follow instructions contained in documents.
3. Provider returns schema-validated `{explanation, recommendedAction, confidence, evidenceRefs[]}`.
4. Persist recommendation, provider/model/prompt version, evidence references, and audit event. Never invoke a decision command from this code path.
5. Provider failure leaves the business exception usable; UI shows “recommendation unavailable” and a retry control.

### 6.6 Human decision

1. Manager opens an exception; application may mark `NEW → UNDER_REVIEW` and assign it atomically.
2. Approve/reject/request-info command includes invoice ID, exception ID, expected version, reason/comment, and idempotency key.
3. Server checks role, org boundary, current state, and concurrency version.
4. In one transaction, update exception and invoice states, append audit event with previous/new values, and create a notification job if needed.
5. Notifications are best-effort side effects after the decision commit; notification failure never rolls back a financial decision.

“Approve” is approval for downstream processing readiness only. The MVP performs no payment or ERP posting.

### 6.7 Rules update and reprocessing

1. Admin submits validated settings with expected version and a mandatory change reason.
2. Save a new immutable configuration version and append an organization-level audit event.
3. Existing invoices do not change silently. The UI offers explicit reprocessing of a selected invoice using the latest version.
4. Reprocess creates a new processing run and keeps prior match/rule results available in audit history.

### 6.8 Dashboard and audit

Dashboard queries derive from persisted decisions within an explicit date range and timezone. Define touchless rate as `AUTO_APPROVED / all invoices reaching a decision`, excluding technical failures and still-processing invoices. Exception breakdown counts the latest active exception outcome per invoice to avoid double counting retries. Audit views are ordered by `(createdAt, id)` and show system, AI, and human actors distinctly.

## 7. Application interfaces

Application services are the only mutation entry points:

```ts
interface InvoiceCommands {
  ingest(input: IngestInvoiceCommand): Promise<IngestResult>;
  reprocess(input: ReprocessInvoiceCommand): Promise<ProcessingRunRef>;
}

interface ExceptionCommands {
  decide(input: DecideExceptionCommand): Promise<DecisionResult>;
  requestInfo(input: RequestInfoCommand): Promise<void>;
  assign(input: AssignExceptionCommand): Promise<void>;
}

interface RulesCommands {
  update(input: UpdateOrgSettingsCommand): Promise<SettingsVersion>;
}
```

Provider ports:

```ts
interface StorageAdapter {
  put(input: StoredObjectInput): Promise<{ key: string; sha256: string; size: number }>;
  get(key: string): Promise<ReadableStream | Uint8Array>;
  createReadGrant(key: string, ttlSeconds: number): Promise<string>;
}

interface ERPAdapter {
  getSupplier(orgId: string, supplierRef: string): Promise<SupplierSnapshot | null>;
  getPurchaseOrder(orgId: string, poNumber: string): Promise<PurchaseOrderSnapshot | null>;
  getGoodsReceipts(orgId: string, poId: string): Promise<GoodsReceiptSnapshot[]>;
}

interface ExtractionProvider {
  extract(document: ExtractionDocument): Promise<ExtractionEnvelope>;
}

interface InvestigationProvider {
  investigate(context: InvestigationContext): Promise<InvestigationResult>;
}

interface NotificationAdapter {
  send(message: NotificationMessage): Promise<NotificationReceipt>;
}
```

Suggested HTTP surface:

- `POST /api/invoices` — multipart upload, idempotency key, returns `202`.
- `GET /api/invoices` and `GET /api/invoices/:id` — scoped list/detail.
- `POST /api/invoices/:id/reprocess` — manager/admin command.
- `GET /api/invoices/:id/document` — short-lived authorized read grant or streamed response.
- `GET /api/exceptions` and `GET /api/exceptions/:id`.
- `POST /api/exceptions/:id/decision`, `/request-info`, `/assign`.
- `GET /api/dashboard?from=&to=`.
- `GET /api/settings/rules`, `PUT /api/settings/rules`.

Use consistent error envelopes `{code, message, fieldErrors?, requestId}`. Expected conflicts return `409`, invalid commands `422`, unauthenticated `401`, unauthorized/not-in-org resources `404` to avoid disclosure, and accepted jobs `202`.

## 8. Role policy

| Capability | AP Clerk | AP Manager | Auditor | Admin |
|---|---:|---:|---:|---:|
| View dashboard/invoices/exceptions | Yes | Yes | Yes | Yes |
| Upload invoice | Yes | Yes | No | Yes |
| Assign/request information | Limited/self | Yes | No | Yes |
| Approve/reject/override | No | Yes | No | Yes |
| Reprocess | No | Yes | No | Yes |
| View audit/raw extraction | Limited/raw hidden | Yes | Yes | Yes |
| Change rules | No | No | No | Yes |

If only three demo personas are seeded, use Clerk, Manager, and Auditor; expose Admin settings through the Manager persona only if the demo clearly labels that persona `AP Manager + Demo Admin`. Prefer seeding a fourth Admin user to avoid weakening the policy.

## 9. Security and privacy baseline

- Validate sessions and authorization on every server mutation/read; never accept `orgId` from the browser as authority.
- Generate safe storage keys; reject path traversal, executables, malformed MIME, oversized files, and encrypted/unsupported PDFs with a useful error.
- Serve documents only after access checks, with short-lived grants or authenticated streaming. Add `Content-Disposition` and restrictive content security headers.
- Keep AI/API secrets server-only. Never persist them, send them to client components, or log them.
- Redact bank account values, tax identifiers, raw OCR text, and document content from routine logs. Use request IDs and entity IDs instead.
- Treat invoice text and retrieved policy text as prompt-injection-capable untrusted input. Use schema validation, bounded context, provider timeouts, and no model-accessible mutation tools.
- Add CSRF protection or strict same-site cookies and origin validation to mutations; use secure, HTTP-only session cookies.
- Rate-limit upload, reprocess, and AI retry endpoints. Cap job attempts and use a dead-letter state visible to admins.
- Append audit events in the same transaction as the state mutation. Database-level immutability is a production extension; MVP application code must expose no update/delete method.
- Seed/demo passwords and documents are non-production. README must state that local storage, demo auth, and in-process jobs are not production controls.

## 10. Reliability, observability, and performance

- Every request and job carries `requestId`, `jobId`, `invoiceId`, `processingRunId`, and `orgId` in structured logs.
- Measure stage duration, extraction failure rate, job retry count, exception rate by rule, and AI investigation latency/cost.
- Use idempotency keys for upload and decisions; use job leases and unique job keys for at-least-once execution safety.
- Wrap outcome persistence, exceptions, and audit events in one database transaction. External calls occur outside long-lived DB transactions.
- List endpoints use pagination, indexed filters, and server-side sorting. Dashboard aggregates are database queries and may be cached briefly with invalidation after decisions.
- Worker concurrency is bounded. AI calls have timeout, retry policy, and a user-readable failure state.
- The demo must remain usable without AI credentials: a clearly identified seeded/mock extraction provider may process known demo documents through the same interface. It must not pretend to be a live model call.

## 11. Extension points

- Replace `LocalStorageAdapter` with S3/Azure Blob.
- Replace `MockERPAdapter` with read/write ERP connectors; posting remains a separate explicit command and approval boundary.
- Replace in-process polling with a managed queue while preserving job payload and idempotency contracts.
- Add organization-aware database policies and tenant provisioning; `orgId` is already mandatory everywhere.
- Add cumulative PO consumption, credit notes, multi-currency/FX, tax validation, approval matrices, and payment execution as separate domain modules.
- Replace simple policy retrieval with pgvector without changing `InvestigationContext`.
- Add outbound email/SFTP ingestion by invoking the same intake use case.

## 12. Resolved specification ambiguities

1. **Exact vs. possible duplicate:** exact canonical identity is `CONFIRMED_DUPLICATE`; fuzzy proximity is `POSSIBLE_DUPLICATE`. Seed both cases.
2. **GRN existence:** GRN is required only under explicit organization/PO-category policy. Otherwise a valid two-way match is allowed.
3. **Low confidence:** confidence below `0.75` is a `MISSING_INFO/LOW_CONFIDENCE` blocking rule for required fields; low confidence on optional fields is a warning.
4. **Auto-approved meaning:** it means eligible for downstream AP processing, not paid and not posted to ERP.
5. **Human override:** managers/admins may approve an exception with a mandatory reason. Override does not erase failed rules.
6. **Rule changes:** settings are versioned and prospective. Existing invoices change only through explicit reprocessing.
7. **Multiple failures:** persist all failed rules for explanation; select the first blocking rule by stable priority as the primary exception category.
8. **Technical failure:** provider/timeouts are processing errors with retry, not supplier/business exceptions.
9. **Role set mismatch:** the data model includes Admin and Finance Manager while MVP names three personas. Seed a dedicated Admin where practical; never grant rule changes to Auditor or Clerk.
10. **Audit scope:** settings and access-sensitive actions require organization audit events even though the initial model only attaches audit to invoices.

## 13. Concrete integration checklist

### Foundation

- [ ] Define shared enums and state-transition guards; avoid free-form status strings.
- [ ] Add schema relations, indexes, settings, documents, jobs, processing runs, and organization audit support.
- [ ] Seed Clerk, Manager, Auditor, and preferably Admin personas with stable credentials.
- [ ] Establish design tokens and shared status semantics before screen-specific styling.
- [ ] Provide one command that migrates, seeds, generates documents, and starts the app.

### Intake and processing

- [ ] Implement upload validation, opaque storage, hashes, idempotency, and authorized document reads.
- [ ] Implement durable job claim/lease/retry/dead-letter behavior.
- [ ] Validate extraction results against a runtime schema and store provider/prompt versions.
- [ ] Unit-test Arabic/English normalization, Arabic-Indic digits, decimal separators, dates, and tax labels.
- [ ] Ensure every persisted stage change and outcome has an audit event.

### Decision engines

- [ ] Keep duplicate, matching, and rule engines pure and Decimal-safe.
- [ ] Test exact/fuzzy/non-duplicate; exact/within/over tolerance; zero denominator; missing PO/GRN; currency/supplier mismatch; ambiguous lines.
- [ ] Capture the settings version and engine version on every run.
- [ ] Make exception creation retry-safe and preserve all failed rule evidence.
- [ ] Confirm AI investigation has no path to decision mutations.

### UI and workflow

- [ ] Drive pipeline stages and timestamps from server state.
- [ ] Provide loading, empty, error, technical-failure, and zero-exception states.
- [ ] Enforce actions on the server and mirror them accurately in each role view.
- [ ] Require reason and concurrency version for override/reject/reprocess/settings actions.
- [ ] Display evidence, tolerance used, rule code, config version, and human/AI/system actor labels.
- [ ] Ensure layouts work at mobile, tablet, laptop, and wide desktop widths; dense tables degrade to usable cards or horizontal scroll.

### Reporting and demo integrity

- [ ] Define KPI formulas in code and test them against seeded records.
- [ ] Refresh/invalidate dashboard data after processing and decisions.
- [ ] Generate real files for clean, price variance, quantity variance, missing PO, Arabic, low-confidence, fuzzy duplicate, and confirmed duplicate cases.
- [ ] Keep live-AI and mock-provider modes visibly distinguishable in setup/documentation.
- [ ] Run unit tests and the Playwright seven-beat golden path; capture acceptance evidence for every milestone.
- [ ] README states what is real, mocked, and deliberately out of scope.

## 14. Definition of architectural completion

The MVP is architecturally complete when a seeded or uploaded document traverses one durable pipeline, every automated conclusion can be reconstructed from versioned inputs and named rule results, every human mutation is authorized and audited, KPI values derive from those outcomes, and provider/ERP/storage/queue implementations can be replaced without changing deterministic domain engines or user workflows.
