import { apService } from "@/lib/services/ap-service"; import { apiOk } from "@/lib/server/api";
export async function GET(request:Request){const url=new URL(request.url);return apiOk(await apService.audit(url.searchParams.get("invoiceId")??undefined))}
