export type JobState = "QUEUED"|"RUNNING"|"SUCCEEDED"|"RETRYING"|"FAILED";
export interface InvoiceJob { id:string; orgId:string; invoiceId:string; idempotencyKey:string; attempts:number; maxAttempts:number; state:JobState; createdAt:string; lastError?:string }
export interface QueueSnapshot { queued:number; running:number; retrying:number; failed:number; completed:number }

/** Demo implementation of the production job contract. The production adapter
 * stores these records transactionally and workers claim them with SKIP LOCKED. */
export class InvoiceJobQueue {
  private jobs=new Map<string,InvoiceJob>(); private completed=0;
  enqueue(input:Omit<InvoiceJob,"id"|"attempts"|"state"|"createdAt">) { const existing=[...this.jobs.values()].find(j=>j.idempotencyKey===input.idempotencyKey); if(existing)return existing; const job:InvoiceJob={...input,id:`job_${this.jobs.size+1}`,attempts:0,state:"QUEUED",createdAt:new Date().toISOString()}; this.jobs.set(job.id,job); return job }
  claim(limit:number) { return [...this.jobs.values()].filter(j=>j.state==="QUEUED"||j.state==="RETRYING").slice(0,limit).map(job=>(job.state="RUNNING",job.attempts++,job)); }
  succeed(id:string) { const job=this.require(id); job.state="SUCCEEDED"; this.completed++; return job }
  fail(id:string,error:string) { const job=this.require(id); job.lastError=error; job.state=job.attempts<job.maxAttempts?"RETRYING":"FAILED"; return job }
  snapshot():QueueSnapshot { const all=[...this.jobs.values()]; return {queued:all.filter(j=>j.state==="QUEUED").length,running:all.filter(j=>j.state==="RUNNING").length,retrying:all.filter(j=>j.state==="RETRYING").length,failed:all.filter(j=>j.state==="FAILED").length,completed:this.completed} }
  private require(id:string){const job=this.jobs.get(id);if(!job)throw new Error(`Job ${id} not found`);return job}
}
