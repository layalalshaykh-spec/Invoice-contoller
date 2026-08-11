import { z } from "zod"; import { apService } from "@/lib/services/ap-service"; import { apiError,apiOk,jsonBody,requireRole } from "@/lib/server/api";
const schema=z.object({userId:z.string().min(1)});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{requireRole(request,["AP_MANAGER","FINANCE_MANAGER","ADMIN"]);const {id}=await params;const body=await jsonBody(request,schema);return apiOk(await apService.assignException(id,body.userId))}catch(error){return apiError(error)}}
