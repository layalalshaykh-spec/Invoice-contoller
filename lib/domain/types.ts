export type Role = "AP_CLERK" | "AP_MANAGER" | "FINANCE_MANAGER" | "ADMIN" | "AUDITOR";
export type SupplierStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "BLOCKED";
export type InvoiceStatus = "RECEIVED" | "EXTRACTING" | "VALIDATING" | "MATCHING" | "AUTO_APPROVED" | "EXCEPTION" | "APPROVED" | "REJECTED";
export type DuplicateStatus = "NO_DUPLICATE" | "POSSIBLE_DUPLICATE" | "CONFIRMED_DUPLICATE";
export type ExceptionCategory = "PO_MISMATCH" | "GRN_MISMATCH" | "DUPLICATE" | "SUPPLIER_ISSUE" | "MISSING_INFO" | "OTHER";
export type ExceptionSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ExceptionStatus = "NEW" | "UNDER_REVIEW" | "WAITING_FOR_INFO" | "APPROVED" | "REJECTED" | "RESOLVED" | "ESCALATED";

export interface Organization { id: string; name: string; createdAt: string }
export interface User { id: string; orgId: string; name: string; email: string; role: Role; title: string; initials: string }
export interface Supplier { id: string; orgId: string; name: string; nameAr?: string; taxId?: string; status: SupplierStatus; bankAccount?: string; isApproved: boolean; country: string }
export interface LineItem { id: string; description: string; descriptionAr?: string; quantity: number; unitPrice: number; taxAmount?: number; currency: string }
export interface PurchaseOrder { id: string; orgId: string; poNumber: string; supplierId: string; currency: string; status: "OPEN" | "PARTIALLY_RECEIVED" | "CLOSED"; lines: LineItem[]; totalAmount: number; issuedAt: string }
export interface GoodsReceiptNote { id: string; orgId: string; grnNumber: string; poId: string; lines: Array<{ id: string; description: string; quantityReceived: number }>; receivedAt: string }
export interface FieldConfidence { value: string | number | null; confidence: number; sourceLabel?: string }
export interface ExtractionResult { fields: Record<string, FieldConfidence>; overallConfidence: number; language: "ar" | "en"; extractedAt: string }
export interface MatchVariance { field: "supplier" | "currency" | "quantity" | "unitPrice" | "total"; expected: string | number; actual: string | number; variancePercent?: number; withinTolerance: boolean; lineId?: string }
export interface MatchResult { type: "2_WAY" | "3_WAY" | "UNMATCHED"; passed: boolean; variances: MatchVariance[]; matchedPoId?: string; matchedGrnId?: string; evaluatedAt: string }
export interface Invoice { id: string; orgId: string; supplierId?: string; supplierName: string; poNumber?: string; invoiceNumber: string; invoiceDate: string; dueDate: string; currency: string; subtotal: number; taxAmount: number; totalAmount: number; sourceFileUrl: string; sourceLanguage: "ar" | "en"; rawExtraction: ExtractionResult; status: InvoiceStatus; duplicateOf?: string; duplicateStatus: DuplicateStatus; matchResult?: MatchResult; lines: LineItem[]; createdAt: string; updatedAt: string }
export interface InvoiceException { id: string; invoiceId: string; category: ExceptionCategory; severity: ExceptionSeverity; aiAnalysis?: string; aiRecommendation?: string; aiConfidence?: number; status: ExceptionStatus; assignedToId?: string; createdAt: string; slaDueAt: string }
export interface AuditLog { id: string; invoiceId: string; userId?: string; action: string; previousStatus?: InvoiceStatus; newStatus?: InvoiceStatus; detail?: Record<string, unknown>; createdAt: string }
export interface RulesConfig { orgId: string; quantityTolerancePercent: number; priceTolerancePercent: number; totalTolerancePercent: number; requireGrn: boolean; autoApprovalLimit: number; duplicateDateWindowDays: number; lowConfidenceThreshold: number }
export interface AppData { organization: Organization; users: User[]; suppliers: Supplier[]; purchaseOrders: PurchaseOrder[]; goodsReceipts: GoodsReceiptNote[]; invoices: Invoice[]; exceptions: InvoiceException[]; auditLogs: AuditLog[]; rules: RulesConfig }
