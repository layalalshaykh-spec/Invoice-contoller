export async function GET() {
  return Response.json({
    status: "ok",
    service: "nexa-ap-api",
    time: new Date().toISOString(),
    persistence: process.env.DATABASE_URL ? "postgresql" : "demo-memory",
    version: "1.0.0",
  });
}
