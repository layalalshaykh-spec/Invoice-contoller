import { apService } from "@/lib/services/ap-service";
export async function GET() { return Response.json(await apService.rules()); }
export async function PATCH(request:Request) { return Response.json(await apService.updateRules(await request.json())); }
