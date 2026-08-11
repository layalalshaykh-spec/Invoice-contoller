import { z } from "zod";
import { apiError, apiOk, jsonBody, requireRole } from "@/lib/server/api";
import { companyPolicyService } from "@/lib/services/company-policy-service";

const policySchema = z.object({
  jurisdiction: z.string().min(2).max(100),
  regulations: z.string().min(10).max(5000),
  aiInstructions: z.string().min(10).max(5000),
  prohibitedActions: z.string().min(10).max(5000),
  escalationRules: z.string().min(10).max(5000),
  approvalRoles: z.object({
    clerk: z.string().min(3).max(500), manager: z.string().min(3).max(500),
    finance: z.string().min(3).max(500), auditor: z.string().min(3).max(500),
  }),
});

export async function GET() { return apiOk(companyPolicyService.get()); }
export async function PUT(request: Request) {
  try {
    requireRole(request, ["AP_MANAGER", "ADMIN"]);
    return apiOk(companyPolicyService.update(await jsonBody(request, policySchema)));
  } catch (error) { return apiError(error); }
}
