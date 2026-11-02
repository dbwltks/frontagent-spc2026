import { NextResponse } from "next/server";
import { FLOW_TEMPLATES, summarizeTemplate } from "../../../../lib/ai/taskFlowTemplates";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ items: FLOW_TEMPLATES.map(summarizeTemplate) });
}
