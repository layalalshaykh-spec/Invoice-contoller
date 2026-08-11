import { repository, transitionInvoice } from "../data/repository";
import type { ExceptionStatus, InvoiceStatus, RulesConfig } from "../domain/types";

export const apService = {
  async dashboard() {
    const d=await repository.snapshot(); const invoices=d.invoices; const exceptions=d.exceptions.filter(x=>!["RESOLVED","APPROVED","REJECTED"].includes(x.status));
    const processed=invoices.filter(x=>!["RECEIVED","EXTRACTING","VALIDATING","MATCHING"].includes(x.status)); const touchless=processed.length ? processed.filter(x=>x.status==="AUTO_APPROVED").length/processed.length*100 : 0;
    const payable=invoices.filter(x=>["AUTO_APPROVED","APPROVED"].includes(x.status)).reduce((sum,x)=>sum+x.totalAmount,0);
    const byCategory=Object.entries(exceptions.reduce<Record<string,number>>((a,x)=>(a[x.category]=(a[x.category]??0)+1,a),{})).map(([category,count])=>({category,count}));
    return { kpis:{ totalInvoices:invoices.length,payableAmount:Math.round(payable*100)/100,openExceptions:exceptions.length,touchlessRate:Math.round(touchless*10)/10,averageCycleHours:3.8 },byCategory,recentInvoices:[...invoices].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,8) };
  },
  async invoices(query?: { status?: InvoiceStatus; supplierId?: string; search?: string }) { const d=await repository.snapshot(); return d.invoices.filter(x=>(!query?.status||x.status===query.status)&&(!query?.supplierId||x.supplierId===query.supplierId)&&(!query?.search||`${x.invoiceNumber} ${x.supplierName} ${x.poNumber??""}`.toLowerCase().includes(query.search.toLowerCase()))) },
  async invoice(id:string) { const d=await repository.snapshot(); const invoice=d.invoices.find(x=>x.id===id); if(!invoice)return null; return {invoice,supplier:d.suppliers.find(x=>x.id===invoice.supplierId),purchaseOrder:d.purchaseOrders.find(x=>x.poNumber===invoice.poNumber),goodsReceipt:d.goodsReceipts.find(g=>g.poId===d.purchaseOrders.find(p=>p.poNumber===invoice.poNumber)?.id),exception:d.exceptions.find(x=>x.invoiceId===id),audit:d.auditLogs.filter(x=>x.invoiceId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))} },
  async exceptions() { const d=await repository.snapshot(); return d.exceptions.map(x=>({...x,invoice:d.invoices.find(i=>i.id===x.invoiceId)!})).sort((a,b)=>a.slaDueAt.localeCompare(b.slaDueAt)) },
  async decide(input:{invoiceId:string;exceptionId?:string;decision:"APPROVE"|"REJECT"|"REQUEST_INFO";userId:string;note?:string}) { const status:InvoiceStatus=input.decision==="APPROVE"?"APPROVED":input.decision==="REJECT"?"REJECTED":"EXCEPTION"; const invoice=await transitionInvoice(input.invoiceId,status,input.userId,{decision:input.decision,note:input.note,humanDecision:true}); if(input.exceptionId){const exceptionStatus:ExceptionStatus=input.decision==="APPROVE"?"APPROVED":input.decision==="REJECT"?"REJECTED":"WAITING_FOR_INFO"; await repository.updateException(input.exceptionId,{status:exceptionStatus})} return invoice },
  async rules() { return (await repository.snapshot()).rules },
  async updateRules(patch:Partial<RulesConfig>) { return repository.updateRules(patch) },
  async resetDemo() { await repository.reset() }
};
