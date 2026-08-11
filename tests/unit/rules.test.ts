import { describe, expect, it } from "vitest";
import { evaluateBusinessRules, type RuleContext } from "../../lib/engines/rules";

const context: RuleContext = { supplierValid: true, poExists: true, grnRequired: true, grnExists: true, matchResult: { matchType: "THREE_WAY", matched: true, issues: [], lines: [] }, duplicateStatus: "NO_DUPLICATE", missingRequiredFields: [] };

describe("evaluateBusinessRules", () => {
  it("approves only after all deterministic rules pass", () => {
    const result = evaluateBusinessRules(context);
    expect(result.outcome).toBe("ELIGIBLE_FOR_AUTO_PROCESSING");
    expect(result.evaluations).toHaveLength(6);
  });
  it.each([
    [{ supplierValid: false }, "SUPPLIER_INVALID", 1],
    [{ poExists: false }, "PO_MISSING", 2],
    [{ grnExists: false }, "GRN_MISSING", 3],
    [{ matchResult: null }, "MATCH_FAILED", 4],
    [{ duplicateStatus: "POSSIBLE_DUPLICATE" as const }, "DUPLICATE", 5],
    [{ missingRequiredFields: ["invoiceNumber"] }, "REQUIRED_FIELDS_MISSING", 6],
  ])("stops at the first failing rule: %s", (change, code, count) => {
    const result = evaluateBusinessRules({ ...context, ...change });
    expect(result.failedRule?.failureCode).toBe(code);
    expect(result.evaluations).toHaveLength(count);
  });
  it("can allow a non-PO invoice through the PO existence predicate", () => expect(evaluateBusinessRules({ ...context, poRequired: false, poExists: false }).outcome).toBe("ELIGIBLE_FOR_AUTO_PROCESSING"));
});
