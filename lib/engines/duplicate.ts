export interface DuplicateCandidate {
  id: string;
  supplierId: string | null;
  invoiceNumber: string | null;
  totalAmount: number | null;
  invoiceDate: Date | string | null;
}

export type DuplicateStatus = "NO_DUPLICATE" | "POSSIBLE_DUPLICATE" | "CONFIRMED_DUPLICATE";

export interface DuplicateConfig { amountTolerancePercent?: number; dateWindowDays?: number }
export interface DuplicateResult { status: DuplicateStatus; duplicateOf: string | null; reasons: string[] }

function comparableNumber(value: string | null): string {
  return (value ?? "").normalize("NFKC").toLocaleUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function daysBetween(a: Date | string | null, b: Date | string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  return Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) / 86_400_000 : Number.POSITIVE_INFINITY;
}

function amountWithinTolerance(a: number | null, b: number | null, percent: number): boolean {
  if (a === null || b === null) return false;
  const baseline = Math.max(Math.abs(a), Math.abs(b), 0.01);
  return Math.abs(a - b) / baseline * 100 <= percent;
}

export function detectDuplicate(invoice: DuplicateCandidate, existing: readonly DuplicateCandidate[], config: DuplicateConfig = {}): DuplicateResult {
  const sameSupplier = existing.filter((candidate) => candidate.id !== invoice.id && candidate.supplierId !== null && candidate.supplierId === invoice.supplierId);
  const exact = sameSupplier.find((candidate) => comparableNumber(candidate.invoiceNumber) !== "" && comparableNumber(candidate.invoiceNumber) === comparableNumber(invoice.invoiceNumber) && candidate.totalAmount === invoice.totalAmount);
  if (exact) return { status: "CONFIRMED_DUPLICATE", duplicateOf: exact.id, reasons: ["Same supplier, normalized invoice number, and total amount"] };
  const amountTolerancePercent = config.amountTolerancePercent ?? 0.5;
  const dateWindowDays = config.dateWindowDays ?? 7;
  const fuzzy = sameSupplier.find((candidate) => amountWithinTolerance(candidate.totalAmount, invoice.totalAmount, amountTolerancePercent) && daysBetween(candidate.invoiceDate, invoice.invoiceDate) <= dateWindowDays);
  if (fuzzy) return { status: "POSSIBLE_DUPLICATE", duplicateOf: fuzzy.id, reasons: [`Same supplier, amount within ${amountTolerancePercent}%, and date within ${dateWindowDays} days`] };
  return { status: "NO_DUPLICATE", duplicateOf: null, reasons: [] };
}
