export type SourceLanguage = "ar" | "en" | "mixed" | "unknown";

export interface ExtractedField<T = unknown> {
  value: T | null;
  confidence?: number;
  label?: string;
}

export interface RawExtractedDocument {
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CanonicalInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
}

export interface CanonicalInvoice {
  supplierName: string | null;
  supplierTaxId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  poNumber: string | null;
  currency: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  lines: CanonicalInvoiceLine[];
  sourceLanguage: SourceLanguage;
  confidences: Partial<Record<CanonicalFieldName, number>>;
  lowConfidenceFields: CanonicalFieldName[];
}

export type CanonicalFieldName = Exclude<keyof CanonicalInvoice, "lines" | "sourceLanguage" | "confidences" | "lowConfidenceFields">;

export interface NormalizationOptions {
  lowConfidenceThreshold?: number;
  defaultCurrency?: string | null;
}

const LABELS: Record<CanonicalFieldName, string[]> = {
  supplierName: ["supplier", "supplier name", "vendor", "vendor name", "company", "اسم المورد", "المورد", "اسم الشركة"],
  supplierTaxId: ["tax id", "tax number", "vat number", "vat registration number", "الرقم الضريبي", "رقم التسجيل الضريبي"],
  invoiceNumber: ["invoice number", "invoice no", "invoice #", "invoice_number", "رقم الفاتورة", "فاتورة رقم"],
  invoiceDate: ["invoice date", "date", "invoice_date", "تاريخ الفاتورة", "التاريخ"],
  dueDate: ["due date", "payment due", "due_date", "تاريخ الاستحقاق"],
  poNumber: ["po number", "purchase order", "purchase order number", "po_number", "رقم أمر الشراء", "امر الشراء", "أمر الشراء"],
  currency: ["currency", "ccy", "العملة"],
  subtotal: ["subtotal", "net amount", "amount before tax", "المجموع الفرعي", "المبلغ قبل الضريبة"],
  taxAmount: ["tax", "tax amount", "vat", "vat amount", "قيمة الضريبة", "ضريبة القيمة المضافة"],
  totalAmount: ["total", "total amount", "grand total", "amount due", "الإجمالي", "المبلغ الإجمالي", "المبلغ المستحق"],
};

const DIRECT_KEYS: Partial<Record<CanonicalFieldName, string[]>> = {
  supplierName: ["supplierName", "supplier_name", "vendorName", "vendor_name"],
  supplierTaxId: ["supplierTaxId", "supplier_tax_id", "taxId", "tax_id", "vatNumber"],
  invoiceNumber: ["invoiceNumber", "invoice_number", "invoiceNo"],
  invoiceDate: ["invoiceDate", "invoice_date"],
  dueDate: ["dueDate", "due_date"],
  poNumber: ["poNumber", "po_number", "purchaseOrderNumber"],
  currency: ["currency", "currencyCode"],
  subtotal: ["subtotal", "netAmount"],
  taxAmount: ["taxAmount", "tax_amount", "vatAmount"],
  totalAmount: ["totalAmount", "total_amount", "grandTotal"],
};

function normalizedLabel(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[.:#_\-–—]/g, " ").replace(/\s+/g, " ").trim();
}

function unwrap(value: unknown): ExtractedField {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    const field = value as Record<string, unknown>;
    return {
      value: field.value ?? null,
      confidence: typeof field.confidence === "number" ? field.confidence : undefined,
      label: typeof field.label === "string" ? field.label : undefined,
    };
  }
  return { value: value ?? null };
}

function findField(source: Record<string, unknown>, field: CanonicalFieldName): ExtractedField {
  for (const key of DIRECT_KEYS[field] ?? []) {
    if (key in source) return unwrap(source[key]);
  }
  const aliases = new Set(LABELS[field].map(normalizedLabel));
  for (const [key, value] of Object.entries(source)) {
    const extracted = unwrap(value);
    const labels = [key, extracted.label].filter((item): item is string => Boolean(item)).map(normalizedLabel);
    if (labels.some((label) => aliases.has(label))) return extracted;
  }
  return { value: null };
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function moneyValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/[\s\u00a0]/g, "").replace(/[^\d.,()\-]/g, "");
  const negative = text.startsWith("(") && text.endsWith(")");
  text = text.replace(/[()]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
}

function dateValue(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;
  const iso = /^(\d{4})[-/]([01]\d)[-/]([0-3]\d)$/u.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^([0-3]?\d)[-/]([01]?\d)[-/](\d{4})$/u.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return text;
}

function detectLanguage(source: Record<string, unknown>): SourceLanguage {
  const serialized = JSON.stringify(source);
  const arabic = /[\u0600-\u06ff]/u.test(serialized);
  const latin = /[A-Za-z]/u.test(serialized);
  return arabic && latin ? "mixed" : arabic ? "ar" : latin ? "en" : "unknown";
}

function normalizeLines(value: unknown): CanonicalInvoiceLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const description = textValue(row.description ?? row.item ?? row["الوصف"]);
    const quantity = moneyValue(row.quantity ?? row.qty ?? row["الكمية"]);
    const unitPrice = moneyValue(row.unitPrice ?? row.unit_price ?? row.price ?? row["سعر الوحدة"]);
    if (!description || quantity === null || unitPrice === null) return [];
    const taxAmount = moneyValue(row.taxAmount ?? row.tax_amount ?? row.tax ?? row["الضريبة"]);
    return [{ description, quantity, unitPrice, ...(taxAmount === null ? {} : { taxAmount }) }];
  });
}

export function normalizeInvoice(document: RawExtractedDocument, options: NormalizationOptions = {}): CanonicalInvoice {
  const source = document.fields && typeof document.fields === "object" ? document.fields : document;
  const threshold = options.lowConfidenceThreshold ?? 0.75;
  const values = {} as Record<CanonicalFieldName, ExtractedField>;
  const confidences: CanonicalInvoice["confidences"] = {};
  const lowConfidenceFields: CanonicalFieldName[] = [];
  for (const field of Object.keys(LABELS) as CanonicalFieldName[]) {
    values[field] = findField(source, field);
    if (values[field].confidence !== undefined) {
      confidences[field] = values[field].confidence;
      if (values[field].confidence! < threshold) lowConfidenceFields.push(field);
    }
  }
  const currency = textValue(values.currency.value)?.toUpperCase() ?? options.defaultCurrency ?? null;
  return {
    supplierName: textValue(values.supplierName.value), supplierTaxId: textValue(values.supplierTaxId.value),
    invoiceNumber: textValue(values.invoiceNumber.value), invoiceDate: dateValue(values.invoiceDate.value),
    dueDate: dateValue(values.dueDate.value), poNumber: textValue(values.poNumber.value), currency,
    subtotal: moneyValue(values.subtotal.value), taxAmount: moneyValue(values.taxAmount.value),
    totalAmount: moneyValue(values.totalAmount.value),
    lines: normalizeLines(source.lines ?? source.lineItems ?? source.line_items ?? source["البنود"]),
    sourceLanguage: detectLanguage(source), confidences, lowConfidenceFields,
  };
}

export const NORMALIZATION_LABELS = LABELS;
