import { apService } from "@/lib/services/ap-service";
export async function GET() { return Response.json(await apService.exceptions()); }
