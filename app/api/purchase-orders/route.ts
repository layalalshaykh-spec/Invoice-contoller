import { apService } from "@/lib/services/ap-service"; import { apiOk } from "@/lib/server/api";
export async function GET(){return apiOk(await apService.purchaseOrders())}
