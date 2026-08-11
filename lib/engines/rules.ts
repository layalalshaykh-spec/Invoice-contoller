import type { DuplicateStatus } from "./duplicate";
import type { MatchResult } from "./matching";

export interface RuleContext { supplierValid: boolean; poRequired?: boolean; poExists: boolean; grnRequired?: boolean; grnExists: boolean; matchResult: MatchResult | null; duplicateStatus: DuplicateStatus; missingRequiredFields: readonly string[] }
export type RuleFailureCode = "SUPPLIER_INVALID" | "PO_MISSING" | "GRN_MISSING" | "MATCH_FAILED" | "DUPLICATE" | "REQUIRED_FIELDS_MISSING";
export interface RuleEvaluation { name: string; passed: boolean; failureCode?: RuleFailureCode; reason?: string }
export interface RulesDecision { outcome: "ELIGIBLE_FOR_AUTO_PROCESSING" | "ROUTE_TO_EXCEPTION"; failedRule: RuleEvaluation | null; evaluations: RuleEvaluation[] }
export interface BusinessRule { name: string; evaluate(context: RuleContext): Omit<RuleEvaluation, "name"> }

export const DEFAULT_BUSINESS_RULES: readonly BusinessRule[] = [
  { name: "Supplier validation", evaluate: (c) => c.supplierValid ? { passed: true } : { passed: false, failureCode: "SUPPLIER_INVALID", reason: "Supplier is missing, inactive, blocked, or unapproved" } },
  { name: "Purchase order exists", evaluate: (c) => c.poRequired === false || c.poExists ? { passed: true } : { passed: false, failureCode: "PO_MISSING", reason: "A required purchase order was not found" } },
  { name: "Goods receipt exists", evaluate: (c) => !c.grnRequired || c.grnExists ? { passed: true } : { passed: false, failureCode: "GRN_MISSING", reason: "A required goods receipt was not found" } },
  { name: "Variance within tolerance", evaluate: (c) => c.matchResult?.matched ? { passed: true } : { passed: false, failureCode: "MATCH_FAILED", reason: c.matchResult?.issues.map((item) => item.message).join("; ") || "Matching was not completed" } },
  { name: "Duplicate check", evaluate: (c) => c.duplicateStatus === "NO_DUPLICATE" ? { passed: true } : { passed: false, failureCode: "DUPLICATE", reason: c.duplicateStatus === "CONFIRMED_DUPLICATE" ? "Confirmed duplicate invoice" : "Possible duplicate requires review" } },
  { name: "Required fields complete", evaluate: (c) => c.missingRequiredFields.length === 0 ? { passed: true } : { passed: false, failureCode: "REQUIRED_FIELDS_MISSING", reason: `Missing required fields: ${c.missingRequiredFields.join(", ")}` } },
];

export function evaluateBusinessRules(context: RuleContext, rules: readonly BusinessRule[] = DEFAULT_BUSINESS_RULES): RulesDecision {
  const evaluations: RuleEvaluation[] = [];
  for (const rule of rules) {
    const result: RuleEvaluation = { name: rule.name, ...rule.evaluate(context) };
    evaluations.push(result);
    if (!result.passed) return { outcome: "ROUTE_TO_EXCEPTION", failedRule: result, evaluations };
  }
  return { outcome: "ELIGIBLE_FOR_AUTO_PROCESSING", failedRule: null, evaluations };
}
