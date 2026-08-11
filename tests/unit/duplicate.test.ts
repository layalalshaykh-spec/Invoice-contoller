import { describe, expect, it } from "vitest";
import { detectDuplicate, type DuplicateCandidate } from "../../lib/engines/duplicate";

const prior: DuplicateCandidate = { id: "old", supplierId: "supplier-1", invoiceNumber: "INV-001", totalAmount: 1000, invoiceDate: "2026-08-01" };

describe("detectDuplicate", () => {
  it("confirms normalized invoice number + supplier + exact amount", () => {
    expect(detectDuplicate({ ...prior, id: "new", invoiceNumber: "inv 001" }, [prior])).toMatchObject({ status: "CONFIRMED_DUPLICATE", duplicateOf: "old" });
  });
  it("flags a same-supplier near-amount invoice inside the date window", () => {
    const result = detectDuplicate({ ...prior, id: "new", invoiceNumber: "NEW", totalAmount: 1004, invoiceDate: "2026-08-07" }, [prior], { amountTolerancePercent: 0.5, dateWindowDays: 7 });
    expect(result.status).toBe("POSSIBLE_DUPLICATE");
  });
  it("does not flag different suppliers or candidates outside the window", () => {
    expect(detectDuplicate({ ...prior, id: "new", supplierId: "other", invoiceDate: "2026-08-02" }, [prior]).status).toBe("NO_DUPLICATE");
    expect(detectDuplicate({ ...prior, id: "new", invoiceNumber: "NEW", invoiceDate: "2026-09-02" }, [prior]).status).toBe("NO_DUPLICATE");
  });
});
