import type { ExtractionResult, FieldConfidence } from "../domain/types";
import { normalizeInvoice, type RawExtractedDocument } from "./normalization";

export interface ExtractionProvider {
  extract(input: { bytes: Uint8Array; fileName: string; mimeType: string }): Promise<RawExtractedDocument>;
}

/**
 * Demo-stable extraction provider. Production replaces this class with the
 * Claude vision adapter without changing the pipeline or normalized schema.
 */
export class DemoExtractionProvider implements ExtractionProvider {
  async extract({ fileName }: { bytes: Uint8Array; fileName: string; mimeType: string }): Promise<RawExtractedDocument> {
    const arabic = /arabic|عربي/i.test(fileName);
    const reference = fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/gi, "-").toUpperCase().slice(0, 18);
    return {
      [arabic ? "رقم الفاتورة" : "invoice number"]: { value: reference || `UPLOAD-${Date.now()}`, confidence: 0.94 },
      [arabic ? "الإجمالي" : "total"]: { value: 12450, confidence: 0.92 },
      [arabic ? "رقم أمر الشراء" : "po number"]: { value: "PO-2026-01041", confidence: 0.87 },
      [arabic ? "تاريخ الفاتورة" : "invoice date"]: { value: new Date().toISOString().slice(0, 10), confidence: 0.9 },
    };
  }
}

export async function extractDocument(provider: ExtractionProvider, input: { bytes: Uint8Array; fileName: string; mimeType: string }): Promise<ExtractionResult> {
  const raw = await provider.extract(input);
  const normalized = normalizeInvoice(raw);
  const canonicalKeys = ["supplierName","supplierTaxId","invoiceNumber","invoiceDate","dueDate","poNumber","currency","subtotal","taxAmount","totalAmount"] as const;
  const fields = Object.fromEntries(canonicalKeys.map(key => [key, { value: normalized[key], confidence: normalized.confidences[key] ?? 0.8, sourceLabel: key }])) as Record<string, FieldConfidence>;
  const confidences = Object.values(fields).map(field => field.confidence);
  return { fields, overallConfidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0, language: normalized.sourceLanguage === "ar" ? "ar" : "en", extractedAt: new Date().toISOString() };
}
