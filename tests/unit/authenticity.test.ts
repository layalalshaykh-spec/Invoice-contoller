import { describe, expect, it } from "vitest";
import { assessInvoiceUpload } from "../../lib/engines/authenticity";

describe("invoice upload authenticity gate", () => {
  it("rejects a renamed non-PDF file", () => {
    const result=assessInvoiceUpload({contentType:"application/pdf",bytes:new TextEncoder().encode("random text")});
    expect(result.risk).toBe("HIGH"); expect(result.checks.fileSignature).toBe(false);
  });
  it("keeps a document-looking PDF unverified pending business evidence", () => {
    const result=assessInvoiceUpload({contentType:"application/pdf",bytes:new TextEncoder().encode("%PDF-1.7 TAX INVOICE Total VAT PO Number")});
    expect(result.risk).toBe("MEDIUM"); expect(result.checks.businessEvidencePending).toBe(true);
  });
});
