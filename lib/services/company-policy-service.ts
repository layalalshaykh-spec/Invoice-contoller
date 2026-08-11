export interface CompanyPolicy {
  jurisdiction: string;
  regulations: string;
  aiInstructions: string;
  prohibitedActions: string;
  escalationRules: string;
  approvalRoles: { clerk: string; manager: string; finance: string; auditor: string };
  version: number;
  updatedAt: string;
}

let policy: CompanyPolicy = {
  jurisdiction: "Qatar",
  regulations: "Comply with Qatar VAT requirements, company procurement policy, supplier sanctions screening, and seven-year audit retention.",
  aiInstructions: "Explain every exception using invoice, purchase order, goods receipt, and supplier evidence. Use plain language and cite the fields that caused the exception.",
  prohibitedActions: "Never approve payments, change supplier bank details, override tolerance rules, or post an invoice without deterministic validation.",
  escalationRules: "Escalate suspected duplicates, bank-detail changes, blocked suppliers, and invoices above QAR 50,000 to the AP Manager. Escalate unresolved high-risk cases after two hours.",
  approvalRoles: {
    clerk: "Review extraction and request missing information",
    manager: "Approve exceptions up to QAR 50,000",
    finance: "Approve invoices above QAR 50,000 and policy overrides",
    auditor: "Read-only access to evidence, decisions, and audit logs",
  },
  version: 1,
  updatedAt: new Date().toISOString(),
};

export const companyPolicyService = {
  get: () => policy,
  update(next: Omit<CompanyPolicy, "version" | "updatedAt">) {
    policy = { ...next, version: policy.version + 1, updatedAt: new Date().toISOString() };
    return policy;
  },
};
