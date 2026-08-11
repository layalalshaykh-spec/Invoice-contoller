import type { GoodsReceiptNote, Invoice, InvoiceException, PurchaseOrder, Supplier } from "../domain/types";

export interface InvestigationProvider {
  investigate(context: InvestigationContext): Promise<InvestigationResult>;
}
export interface InvestigationContext { invoice: Invoice; supplier?: Supplier; purchaseOrder?: PurchaseOrder; goodsReceipt?: GoodsReceiptNote; policy: string }
export interface InvestigationResult { explanation: string; recommendedAction: string; confidence: number; policyReference: string }

export const AP_POLICY = "AP-04: variances above configured tolerance, unidentified suppliers, duplicate indicators, and missing receipt evidence require human review.";

export class DemoInvestigationProvider implements InvestigationProvider {
  async investigate({ invoice, purchaseOrder, goodsReceipt }: InvestigationContext): Promise<InvestigationResult> {
    const reason = !invoice.supplierId ? "The supplier is not present in the approved master." : invoice.duplicateStatus !== "NO_DUPLICATE" ? "The supplier, reference and amount overlap an existing invoice." : !purchaseOrder ? "No approved purchase order could be linked." : !goodsReceipt ? "No goods receipt supports this invoice." : "A line-level value exceeds the configured matching tolerance.";
    return { explanation: reason, recommendedAction: "Keep payment on hold and ask an AP Manager to verify the supporting evidence before deciding.", confidence: 0.92, policyReference: "AP-04" };
  }
}

export function applyInvestigation(exception: InvoiceException, result: InvestigationResult): InvoiceException {
  return { ...exception, aiAnalysis: result.explanation, aiRecommendation: result.recommendedAction, aiConfidence: result.confidence };
}
