# Backend

The application exposes a typed Next.js API for invoice intake, review, matching, and audit operations. It runs with seeded in-memory data for the demo and includes a Prisma/PostgreSQL schema for production persistence.

## API surface

- `GET /api/health` — deployment and persistence status
- `GET|POST /api/invoices` — list and ingest PDF, PNG, or JPEG invoices (10 MB maximum)
- `GET /api/invoices/:id` — invoice, match, exception, and audit detail
- `POST /api/invoices/:id/decision` — approve or reject a review
- `POST /api/invoices/:id/reprocess` — rerun invoice processing
- `GET /api/exceptions` — review queue
- `POST /api/exceptions/:id/assign` — assign an exception owner
- `GET /api/dashboard` — operational KPIs
- `GET /api/suppliers` — supplier master data
- `GET /api/purchase-orders` — purchase orders and lines
- `GET /api/audit?invoiceId=...` — traceable processing history
- `GET|PATCH /api/rules` — review automation rules

Mutation routes accept `x-user-role` (`AP_CLERK`, `AP_MANAGER`, or `AUDITOR`) and return structured JSON errors with a request ID.

## Local setup

Copy `.env.example` to `.env.local`. Without `DATABASE_URL`, the application intentionally uses the seeded demo repository.

```bash
npm install
npm run db:client
npm run dev
```

For production PostgreSQL, configure `DATABASE_URL`, then run `npm run db:migrate` during the release process. The provider interfaces in `lib/adapters` keep object storage, ERP, and notifications replaceable without changing workflow logic.
