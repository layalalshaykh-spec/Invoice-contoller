import { seedData } from "./seed";
import type { AppData, AuditLog, Invoice, InvoiceException, InvoiceStatus, RulesConfig } from "../domain/types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface DataRepository {
  snapshot(): Promise<AppData>;
  updateInvoice(id: string, patch: Partial<Invoice>): Promise<Invoice>;
  addAudit(log: AuditLog): Promise<void>;
  updateException(id: string, patch: Partial<InvoiceException>): Promise<InvoiceException>;
  updateRules(patch: Partial<RulesConfig>): Promise<RulesConfig>;
  reset(): Promise<void>;
}

/** Singleton-backed repository keeps demo mutations stable across route calls in one server process. */
export class MemoryDataRepository implements DataRepository {
  private data: AppData = clone(seedData);
  async snapshot() { return clone(this.data) }
  async updateInvoice(id: string, patch: Partial<Invoice>) { const row=this.data.invoices.find(x=>x.id===id); if(!row) throw new Error(`Invoice ${id} not found`); Object.assign(row,patch,{updatedAt:new Date().toISOString()}); return clone(row) }
  async addAudit(log: AuditLog) { this.data.auditLogs.push(clone(log)) }
  async updateException(id: string, patch: Partial<InvoiceException>) { const row=this.data.exceptions.find(x=>x.id===id); if(!row) throw new Error(`Exception ${id} not found`); Object.assign(row,patch); return clone(row) }
  async updateRules(patch: Partial<RulesConfig>) { this.data.rules={...this.data.rules,...patch}; return clone(this.data.rules) }
  async reset() { this.data=clone(seedData) }
}

export const repository = new MemoryDataRepository();
export async function transitionInvoice(id: string, newStatus: InvoiceStatus, userId?: string, detail?: Record<string, unknown>) {
  const data=await repository.snapshot(); const current=data.invoices.find(x=>x.id===id); if(!current) throw new Error(`Invoice ${id} not found`);
  const updated=await repository.updateInvoice(id,{status:newStatus});
  await repository.addAudit({id:`audit_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,invoiceId:id,userId,action:"STATUS_CHANGED",previousStatus:current.status,newStatus,detail,createdAt:new Date().toISOString()});
  return updated;
}
