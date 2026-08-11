export interface MatchLine { id?: string; description: string; quantity: number; unitPrice: number; currency?: string }
export interface MatchInvoice { supplierId: string | null; poNumber: string | null; currency: string | null; lines: readonly MatchLine[] }
export interface MatchPO { poNumber: string; supplierId: string; currency: string; lines: readonly MatchLine[] }
export interface MatchGRNLine { poLineId?: string; description: string; quantityReceived: number }
export interface MatchGRN { poNumber: string; lines: readonly MatchGRNLine[] }
export interface ToleranceConfig { quantityPercent: number; pricePercent: number; requireGrn?: boolean; descriptionSimilarity?: number }
export type MatchIssueCode = "MISSING_PO" | "MISSING_GRN" | "MISSING_GRN_LINE" | "PO_NUMBER_MISMATCH" | "SUPPLIER_MISMATCH" | "CURRENCY_MISMATCH" | "UNMATCHED_LINE" | "PRICE_VARIANCE" | "QUANTITY_VARIANCE";
export interface MatchIssue { code: MatchIssueCode; message: string; invoiceLineIndex?: number; expected?: string | number; actual?: string | number; variancePercent?: number }
export interface LineMatchResult { invoiceLineIndex: number; poLineIndex: number | null; grnLineIndex: number | null; priceVariancePercent: number | null; quantityVariancePercent: number | null; withinTolerance: boolean; issues: MatchIssue[] }
export interface MatchResult { matchType: "NONE" | "TWO_WAY" | "THREE_WAY"; matched: boolean; issues: MatchIssue[]; lines: LineMatchResult[] }

function words(value: string): Set<string> { return new Set(value.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []); }
function similarity(a: string, b: string): number {
  const left = words(a), right = words(b);
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((word) => right.has(word)).length;
  return intersection / (left.size + right.size - intersection);
}
function variance(actual: number, expected: number): number { return expected === 0 ? (actual === 0 ? 0 : Number.POSITIVE_INFINITY) : Math.abs(actual - expected) / Math.abs(expected) * 100; }
function issue(code: MatchIssueCode, message: string, extra: Partial<MatchIssue> = {}): MatchIssue { return { code, message, ...extra }; }

export function matchInvoice(invoice: MatchInvoice, po: MatchPO | null, grn: MatchGRN | null, config: ToleranceConfig): MatchResult {
  const issues: MatchIssue[] = [];
  if (!po) return { matchType: "NONE", matched: false, issues: [issue("MISSING_PO", "No purchase order was supplied")], lines: [] };
  if (invoice.poNumber && invoice.poNumber !== po.poNumber) issues.push(issue("PO_NUMBER_MISMATCH", "Invoice PO number does not match the purchase order", { expected: po.poNumber, actual: invoice.poNumber }));
  if (invoice.supplierId !== po.supplierId) issues.push(issue("SUPPLIER_MISMATCH", "Invoice supplier does not match the purchase order", { expected: po.supplierId, actual: invoice.supplierId ?? "missing" }));
  if (invoice.currency !== po.currency) issues.push(issue("CURRENCY_MISMATCH", "Invoice currency does not match the purchase order", { expected: po.currency, actual: invoice.currency ?? "missing" }));
  if (config.requireGrn && !grn) issues.push(issue("MISSING_GRN", "A goods receipt is required for this purchase order"));
  const usedPo = new Set<number>();
  const usedGrn = new Set<number>();
  const lines = invoice.lines.map((invoiceLine, invoiceLineIndex): LineMatchResult => {
    let poLineIndex = -1, best = -1;
    po.lines.forEach((line, index) => { const score = usedPo.has(index) ? -1 : similarity(invoiceLine.description, line.description); if (score > best) { best = score; poLineIndex = index; } });
    if (poLineIndex < 0 || best < (config.descriptionSimilarity ?? 0.35)) {
      const lineIssue = issue("UNMATCHED_LINE", "Invoice line could not be matched to a PO line", { invoiceLineIndex }); issues.push(lineIssue);
      return { invoiceLineIndex, poLineIndex: null, grnLineIndex: null, priceVariancePercent: null, quantityVariancePercent: null, withinTolerance: false, issues: [lineIssue] };
    }
    usedPo.add(poLineIndex);
    const poLine = po.lines[poLineIndex];
    const priceVariancePercent = variance(invoiceLine.unitPrice, poLine.unitPrice);
    const lineIssues: MatchIssue[] = [];
    if (invoiceLine.currency && poLine.currency && invoiceLine.currency !== poLine.currency) lineIssues.push(issue("CURRENCY_MISMATCH", "Invoice line currency does not match the PO line", { invoiceLineIndex, expected: poLine.currency, actual: invoiceLine.currency }));
    let grnLineIndex: number | null = null;
    let expectedQuantity = poLine.quantity;
    if (grn) {
      const exactId = poLine.id ? grn.lines.findIndex((line, index) => !usedGrn.has(index) && line.poLineId === poLine.id) : -1;
      let selected = exactId;
      if (selected < 0) { let grnBest = -1; grn.lines.forEach((line, index) => { const score = usedGrn.has(index) ? -1 : similarity(poLine.description, line.description); if (score > grnBest) { grnBest = score; selected = index; } }); }
      if (selected >= 0) { grnLineIndex = selected; usedGrn.add(selected); expectedQuantity = grn.lines[selected].quantityReceived; }
      else lineIssues.push(issue("MISSING_GRN_LINE", "No goods receipt line matches this invoice line", { invoiceLineIndex }));
    }
    const quantityVariancePercent = variance(invoiceLine.quantity, expectedQuantity);
    if (priceVariancePercent > config.pricePercent) lineIssues.push(issue("PRICE_VARIANCE", "Unit price exceeds configured tolerance", { invoiceLineIndex, expected: poLine.unitPrice, actual: invoiceLine.unitPrice, variancePercent: priceVariancePercent }));
    if (quantityVariancePercent > config.quantityPercent) lineIssues.push(issue("QUANTITY_VARIANCE", grn ? "Invoice quantity differs from received quantity beyond tolerance" : "Invoice quantity differs from ordered quantity beyond tolerance", { invoiceLineIndex, expected: expectedQuantity, actual: invoiceLine.quantity, variancePercent: quantityVariancePercent }));
    issues.push(...lineIssues);
    return { invoiceLineIndex, poLineIndex, grnLineIndex, priceVariancePercent, quantityVariancePercent, withinTolerance: lineIssues.length === 0, issues: lineIssues };
  });
  return { matchType: grn ? "THREE_WAY" : "TWO_WAY", matched: issues.length === 0, issues, lines };
}
