# Nexa AP — Accounts Payable Command Center

A demo-grade accounts payable control tower for Al Rayyan Trading & Contracting. Nexa AP turns incoming Arabic and English invoices into explainable, auditable decisions using deterministic supplier, duplicate, PO and GRN controls with AI-assisted exception investigation.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run generate:invoices
npm run dev
```

Open `http://localhost:3000`. Use the persona selector in the header to switch between AP Clerk, AP Manager and Auditor permissions.

## Five-minute demo

1. Start on **Command center** to review live KPIs and touchless performance.
2. Open **Invoice inbox**, choose a clean invoice, and follow its completed processing pipeline.
3. Open a price-mismatch exception, review the AI investigation, then approve it as AP Manager.
4. Open the duplicate invoice `GIS-260704` and show the duplicate control and audit chain.
5. Switch to Auditor to demonstrate read-only controls and immutable history.
6. Return as AP Manager, open **Rules & controls**, adjust a tolerance, and save a new rule version.
7. Return to the dashboard to see decisions reflected in operational totals.

## What is real and what is mocked

The normalization, duplicate detection, two/three-way matching, ordered business rules, confidence handling, role-based actions, derived dashboard metrics and audit behavior are real application logic backed by a realistic seeded data model. ERP, file storage, notifications, email intake and AI provider calls are represented by explicit adapters and deterministic demo implementations; production providers can replace them without changing the domain logic. No payment is executed by this demo.

The upload workflow accepts PDF, PNG and JPG files and demonstrates the complete received → extracted → validated → matched → decision pipeline. The included generator creates 34 source PDFs so every seeded invoice has a real document asset.

## Verification

```bash
npm run test:unit
npm run build
```

See `ARCHITECTURE.md` for system boundaries, state machines, governance decisions and the production integration path.
