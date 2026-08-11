import { apService } from "@/lib/services/ap-service";
export async function GET(request: Request) { const url = new URL(request.url); return Response.json(await apService.invoices({ search:url.searchParams.get("search") ?? undefined })); }
export async function POST(request: Request) { const body = await request.formData(); const file = body.get("file"); if (!(file instanceof File)) return Response.json({ error:"A PDF or image is required." },{status:400}); return Response.json({ accepted:true, fileName:file.name, status:"RECEIVED", jobId:`job_${Date.now()}` },{status:202}); }
