import type { AppData, Invoice, LineItem, PurchaseOrder, Supplier } from "../domain/types";

const orgId = "org_al_rayyan";
const money = (n: number) => Math.round(n * 100) / 100;
const line = (id: string, description: string, quantity: number, unitPrice: number, currency = "QAR"): LineItem => ({ id, description, quantity, unitPrice, taxAmount: money(quantity * unitPrice * 0.05), currency });

const supplierNames: Array<[string, string?, string?]> = [
  ["Gulf Industrial Supplies", "الخليج للتوريدات الصناعية", "QA"], ["Doha Safety Equipment", "الدوحة لمعدات السلامة", "QA"],
  ["Al Mana Building Materials", "المانع لمواد البناء", "QA"], ["Qatar Facilities Services", "قطر لخدمات المرافق", "QA"],
  ["Pearl Office Solutions", "بيرل لحلول المكاتب", "QA"], ["Desert Line Transport", "خط الصحراء للنقل", "QA"],
  ["Arabian Technical Services", "الخدمات الفنية العربية", "QA"], ["Northstar HVAC Systems", undefined, "AE"],
  ["Schneider Electric Gulf", undefined, "FR"], ["Hilti Qatar", undefined, "LI"], ["Jotun Paints Qatar", undefined, "NO"],
  ["Al Jazeera Steel Products", "الجزيرة للمنتجات الحديدية", "QA"], ["Bluewater Plumbing Trading", undefined, "AE"], ["Teyseer Security Services", "تيسير للخدمات الأمنية", "QA"]
];
const suppliers: Supplier[] = supplierNames.map(([name, nameAr, country], i) => ({ id: `sup_${String(i + 1).padStart(2, "0")}`, orgId, name, nameAr, country: country!, taxId: `QA-${8801000 + i * 137}`, status: i === 13 ? "PENDING" : "ACTIVE", bankAccount: `QA${String(58 + i).padStart(2, "0")}DOHB000000${String(314159 + i * 7919).padStart(8, "0")}`, isApproved: i !== 13 }));

const descriptions = ["Galvanized steel pipe 50mm", "Industrial safety helmet", "Portland cement 50kg", "Preventive maintenance visit", "A4 copier paper 80gsm", "Site transport service", "LED high-bay luminaire", "HVAC filter set", "MCC circuit breaker", "Rotary hammer drill", "Protective epoxy coating", "Steel reinforcement bar 16mm", "PPR pipe fitting set", "Night security shift"];
const purchaseOrders: PurchaseOrder[] = Array.from({ length: 26 }, (_, i) => {
  const supplier = suppliers[i % suppliers.length]; const quantity = 8 + (i * 7) % 43; const unitPrice = 95 + (i * 173) % 1850;
  const lines = [line(`pol_${i + 1}_1`, descriptions[i % descriptions.length], quantity, unitPrice), line(`pol_${i + 1}_2`, "Delivery and handling", 1, 120 + (i % 4) * 50)];
  return { id: `po_${String(i + 1).padStart(3, "0")}`, orgId, poNumber: `PO-2026-${String(1041 + i).padStart(5, "0")}`, supplierId: supplier.id, currency: "QAR", status: i % 5 === 0 ? "PARTIALLY_RECEIVED" : "OPEN", lines, totalAmount: money(lines.reduce((s, x) => s + x.quantity * x.unitPrice, 0) * 1.05), issuedAt: new Date(Date.UTC(2026, 5, 2 + i)).toISOString() };
});
const goodsReceipts = purchaseOrders.slice(0, 22).map((po, i) => ({ id: `grn_${String(i + 1).padStart(3, "0")}`, orgId, grnNumber: `GRN-26-${String(701 + i)}`, poId: po.id, lines: po.lines.map((x, j) => ({ id: `grnl_${i}_${j}`, description: x.description, quantityReceived: i % 6 === 2 && j === 0 ? Math.max(1, x.quantity - 3) : x.quantity })), receivedAt: new Date(Date.UTC(2026, 6, 3 + i)).toISOString() }));

const makeInvoice = (i: number): Invoice => {
  const po = purchaseOrders[i % purchaseOrders.length]; const supplier = suppliers.find(s => s.id === po.supplierId)!; const arabic = [7, 18, 29].includes(i); const duplicate = i === 25; const source = duplicate ? 4 : i; const sourcePo = purchaseOrders[source % purchaseOrders.length]; const sourceSupplier = suppliers.find(s => s.id === sourcePo.supplierId)!;
  let lines = sourcePo.lines.map(x => ({ ...x, id: `invl_${i}_${x.id}` }));
  if (i === 9) lines = lines.map((x, j) => j === 0 ? { ...x, unitPrice: money(x.unitPrice * 1.075) } : x);
  if (i === 14) lines = lines.map((x, j) => j === 0 ? { ...x, quantity: x.quantity + 4 } : x);
  const subtotal = money(lines.reduce((s, x) => s + x.quantity * x.unitPrice, 0)); const taxAmount = money(subtotal * 0.05); const totalAmount = money(subtotal + taxAmount);
  const exception = [9, 14, 22, 25, 29].includes(i); const invoiceNumber = duplicate ? "GIS-260704" : `${sourceSupplier.id.toUpperCase()}-26${String(700 + source)}`;
  const createdAt = new Date(Date.UTC(2026, 6, 7 + (i % 30), 7 + (i % 8), i % 60)).toISOString();
  const confidence = i === 29 ? 0.68 : arabic ? 0.88 : 0.96;
  return { id: `inv_${String(i + 1).padStart(3, "0")}`, orgId, supplierId: i === 22 ? undefined : sourceSupplier.id, supplierName: i === 22 ? "Falcon Star General Trading" : sourceSupplier.name, poNumber: i === 22 ? undefined : sourcePo.poNumber, invoiceNumber, invoiceDate: createdAt.slice(0,10), dueDate: new Date(Date.parse(createdAt) + 30 * 86400000).toISOString().slice(0,10), currency: "QAR", subtotal, taxAmount, totalAmount, sourceFileUrl: `/mock-invoices/${arabic ? "arabic" : "invoice"}-${String(i + 1).padStart(2,"0")}.pdf`, sourceLanguage: arabic ? "ar" : "en", rawExtraction: { language: arabic ? "ar" : "en", overallConfidence: confidence, extractedAt: createdAt, fields: { invoiceNumber: { value: invoiceNumber, confidence, sourceLabel: arabic ? "رقم الفاتورة" : "Invoice No." }, totalAmount: { value: totalAmount, confidence: Math.min(.99, confidence + .02), sourceLabel: arabic ? "الإجمالي" : "Total" }, poNumber: { value: i === 22 ? null : sourcePo.poNumber, confidence: i === 22 ? .34 : confidence } } }, status: exception ? "EXCEPTION" : i % 4 === 0 ? "APPROVED" : "AUTO_APPROVED", duplicateOf: duplicate ? "inv_005" : undefined, duplicateStatus: duplicate ? "POSSIBLE_DUPLICATE" : "NO_DUPLICATE", lines, createdAt, updatedAt: createdAt };
};
const invoices = Array.from({ length: 34 }, (_, i) => makeInvoice(i));
const exceptionMeta = [["inv_010","PO_MISMATCH","HIGH","Unit price is 7.5% above the approved purchase order."],["inv_015","GRN_MISMATCH","HIGH","Invoice quantity exceeds the received quantity by 4 units."],["inv_023","MISSING_INFO","MEDIUM","No purchase order reference or approved supplier match was found."],["inv_026","DUPLICATE","HIGH","Same supplier, invoice reference and amount as invoice GIS-260704."],["inv_030","MISSING_INFO","LOW","Document confidence is below the 75% review threshold."]] as const;

export const seedData: AppData = {
  organization: { id: orgId, name: "Al Rayyan Trading & Contracting", createdAt: "2018-02-11T00:00:00.000Z" },
  users: [{ id:"usr_clerk",orgId,name:"Mariam Al-Kuwari",email:"mariam@alrayyan.qa",role:"AP_CLERK",title:"Accounts Payable Clerk",initials:"MK" },{ id:"usr_manager",orgId,name:"Omar Hassan",email:"omar@alrayyan.qa",role:"AP_MANAGER",title:"AP Manager",initials:"OH" },{ id:"usr_auditor",orgId,name:"Layla Nasser",email:"layla@alrayyan.qa",role:"AUDITOR",title:"Internal Auditor",initials:"LN" }],
  suppliers, purchaseOrders, goodsReceipts, invoices,
  exceptions: exceptionMeta.map(([invoiceId,category,severity,analysis],i) => ({ id:`exc_${i+1}`,invoiceId,category,severity,aiAnalysis:analysis,aiRecommendation:category === "DUPLICATE" ? "Reject as duplicate after verifying the source document hash." : category === "MISSING_INFO" ? "Request the missing reference from the supplier and keep payment on hold." : "Review the documented variance and approve only with manager justification.",aiConfidence:[.97,.94,.91,.99,.82][i],status:i === 2 ? "WAITING_FOR_INFO" : "NEW",assignedToId:i < 2 ? "usr_manager" : undefined,createdAt:invoices.find(x=>x.id===invoiceId)!.createdAt,slaDueAt:new Date(Date.parse(invoices.find(x=>x.id===invoiceId)!.createdAt)+(severity === "HIGH" ? 8 : 24)*3600000).toISOString() })),
  auditLogs: invoices.flatMap((inv,i) => [{ id:`audit_${i}_1`,invoiceId:inv.id,action:"INVOICE_RECEIVED",newStatus:"RECEIVED" as const,detail:{ channel:i%5===0?"EMAIL":"UPLOAD" },createdAt:inv.createdAt },{ id:`audit_${i}_2`,invoiceId:inv.id,action:inv.status === "EXCEPTION" ? "RULE_FAILED" : "RULES_PASSED",previousStatus:"MATCHING" as const,newStatus:inv.status,detail:{ deterministic:true },createdAt:new Date(Date.parse(inv.createdAt)+43000).toISOString() }]),
  rules: { orgId,quantityTolerancePercent:2,priceTolerancePercent:1,totalTolerancePercent:1,requireGrn:true,autoApprovalLimit:50000,duplicateDateWindowDays:30,lowConfidenceThreshold:.75 }
};
