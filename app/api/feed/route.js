import { collectCbr } from "../../../lib/cbr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET() {
  const payload = await collectCbr();
  return Response.json(payload, { status: payload.fresh ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
}
