import { ZodError, type ZodType } from "zod";
export function apiError(error:unknown,requestId=crypto.randomUUID()) { if(error instanceof ZodError)return Response.json({error:{code:"VALIDATION_ERROR",message:"Request validation failed",issues:error.issues},requestId},{status:400}); const message=error instanceof Error?error.message:"Unexpected server error"; return Response.json({error:{code:"INTERNAL_ERROR",message},requestId},{status:500}) }
export async function jsonBody<T>(request:Request,schema:ZodType<T>):Promise<T> { return schema.parse(await request.json()) }
export function apiOk<T>(data:T,status=200) { return Response.json({data,requestId:crypto.randomUUID()},{status}) }
export function requireRole(request:Request,allowed:string[]) { const role=request.headers.get("x-demo-role")??"AP_MANAGER"; if(!allowed.includes(role))throw new Error("This role is not authorized for the requested action."); return role }
