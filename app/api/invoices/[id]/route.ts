import { apService } from "@/lib/services/ap-service";
export async function GET(_: Request, { params }:{params:Promise<{id:string}>}) { const {id}=await params; const result=await apService.invoice(id); return result ? Response.json(result) : Response.json({error:"Invoice not found"},{status:404}); }
