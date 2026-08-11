import { describe, expect, it } from "vitest";
import { normalizeInvoice } from "../../lib/engines/normalization";

describe("normalizeInvoice", () => {
  it("maps Arabic supplier labels, monetary formats, dates, and lines", () => {
    const result = normalizeInvoice({ fields: {
      "اسم المورد": { value: "شركة النور", confidence: 0.98 },
      "فاتورة رقم": { value: "INV-١٢٣", confidence: 0.72 },
      "تاريخ الفاتورة": "11/08/2026", "العملة": "qar",
      "المبلغ الإجمالي": "QAR 1,234.50",
      "البنود": [{ "الوصف": "أسمنت", "الكمية": "10", "سعر الوحدة": "20.5" }],
    } });
    expect(result).toMatchObject({ supplierName: "شركة النور", invoiceNumber: "INV-١٢٣", invoiceDate: "2026-08-11", currency: "QAR", totalAmount: 1234.5, sourceLanguage: "mixed" });
    expect(result.lines).toEqual([{ description: "أسمنت", quantity: 10, unitPrice: 20.5 }]);
    expect(result.lowConfidenceFields).toEqual(["invoiceNumber"]);
  });

  it("supports canonical keys, labelled fields, European money, and a custom threshold", () => {
    const result = normalizeInvoice({ supplier_name: { value: "Acme", confidence: 0.8 }, mystery: { label: "Grand total", value: "1.234,50", confidence: 0.89 } }, { lowConfidenceThreshold: 0.9, defaultCurrency: "EUR" });
    expect(result.totalAmount).toBe(1234.5);
    expect(result.currency).toBe("EUR");
    expect(result.lowConfidenceFields).toEqual(["supplierName", "totalAmount"]);
  });
});
