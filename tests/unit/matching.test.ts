import { describe, expect, it } from "vitest";
import { matchInvoice, type MatchGRN, type MatchInvoice, type MatchPO } from "../../lib/engines/matching";

const invoice: MatchInvoice = { supplierId: "s1", poNumber: "PO-1", currency: "QAR", lines: [{ description: "Portland cement 50kg", quantity: 100, unitPrice: 20, currency: "QAR" }] };
const po: MatchPO = { supplierId: "s1", poNumber: "PO-1", currency: "QAR", lines: [{ id: "pol1", description: "Portland cement bag 50kg", quantity: 100, unitPrice: 20, currency: "QAR" }] };
const grn: MatchGRN = { poNumber: "PO-1", lines: [{ poLineId: "pol1", description: "Cement", quantityReceived: 100 }] };
const tolerance = { quantityPercent: 2, pricePercent: 1, requireGrn: true };

describe("matchInvoice", () => {
  it("passes an exact three-way match", () => expect(matchInvoice(invoice, po, grn, tolerance)).toMatchObject({ matchType: "THREE_WAY", matched: true, issues: [] }));
  it("passes values exactly at configurable tolerance boundaries", () => {
    const changed = { ...invoice, lines: [{ ...invoice.lines[0], quantity: 102, unitPrice: 20.2 }] };
    expect(matchInvoice(changed, po, grn, tolerance).matched).toBe(true);
  });
  it("reports price and received-quantity variances beyond tolerance", () => {
    const changed = { ...invoice, lines: [{ ...invoice.lines[0], quantity: 106, unitPrice: 21 }] };
    expect(matchInvoice(changed, po, grn, tolerance).issues.map((i) => i.code)).toEqual(["PRICE_VARIANCE", "QUANTITY_VARIANCE"]);
  });
  it("reports missing PO and required GRN explicitly", () => {
    expect(matchInvoice(invoice, null, null, tolerance).issues[0].code).toBe("MISSING_PO");
    expect(matchInvoice(invoice, po, null, tolerance).issues.map((i) => i.code)).toContain("MISSING_GRN");
  });
  it("performs a valid two-way match when GRN is optional", () => expect(matchInvoice(invoice, po, null, { ...tolerance, requireGrn: false })).toMatchObject({ matchType: "TWO_WAY", matched: true }));
  it("rejects supplier, currency, unmatched lines, and missing GRN lines", () => {
    const wrong = { ...invoice, supplierId: "s2", currency: "USD", lines: [{ ...invoice.lines[0], description: "Unrelated consultancy", currency: "USD" }] };
    expect(matchInvoice(wrong, po, { ...grn, lines: [] }, tolerance).issues.map((i) => i.code)).toEqual(expect.arrayContaining(["SUPPLIER_MISMATCH", "CURRENCY_MISMATCH", "UNMATCHED_LINE"]));
    expect(matchInvoice(invoice, po, { ...grn, lines: [] }, tolerance).issues.map((i) => i.code)).toContain("MISSING_GRN_LINE");
  });
});
