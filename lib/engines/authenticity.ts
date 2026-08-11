export type AuthenticityRisk = "LOW" | "MEDIUM" | "HIGH";

export interface AuthenticityAssessment {
  risk: AuthenticityRisk;
  documentLike: boolean;
  reasons: string[];
  checks: { fileSignature: boolean; invoiceLanguage: boolean; businessEvidencePending: boolean };
}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value);

export function assessInvoiceUpload(input: { bytes: Uint8Array; contentType: string }): AuthenticityAssessment {
  const pdf = startsWith(input.bytes, [0x25, 0x50, 0x44, 0x46]);
  const png = startsWith(input.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = startsWith(input.bytes, [0xff, 0xd8, 0xff]);
  const signatureMatches = input.contentType === "application/pdf" ? pdf : input.contentType === "image/png" ? png : jpeg;
  if (!signatureMatches) return { risk:"HIGH", documentLike:false, reasons:["The file content does not match its declared format."], checks:{fileSignature:false,invoiceLanguage:false,businessEvidencePending:true} };

  const sample = pdf ? new TextDecoder("latin1").decode(input.bytes.slice(0, Math.min(input.bytes.length, 500_000))).toLowerCase() : "";
  const invoiceTerms = ["invoice", "tax invoice", "فاتورة", "subtotal", "total", "vat", "po number"];
  const invoiceLanguage = !pdf || invoiceTerms.some(term => sample.includes(term));
  const reasons = ["Supplier identity, invoice number, PO, GRN, amount and bank details still require independent verification."];
  if (!invoiceLanguage) reasons.unshift("No reliable invoice terminology was found in the PDF text layer.");
  return { risk:invoiceLanguage?"MEDIUM":"HIGH", documentLike:invoiceLanguage, reasons, checks:{fileSignature:true,invoiceLanguage,businessEvidencePending:true} };
}
