import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../lib/org/resolveOrganization";
import { ingestKnowledgeText } from "../../../../lib/ai/knowledge/ingest";
import { htmlToText } from "../../../../lib/ai/knowledge/parseFile";

const KNOWLEDGE_BUCKET = "knowledge-originals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organization_id === "string" ? body.organization_id : null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!organizationId || !url) {
    return NextResponse.json({ error: "organization_id, url이 필요합니다." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    return NextResponse.json({ error: "올바른 URL이 아닙니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();

    const pageResponse = await fetch(parsedUrl.href, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CallbeeBot/1.0)" } });
    if (!pageResponse.ok) {
      return NextResponse.json({ error: `URL을 가져오지 못했습니다 (HTTP ${pageResponse.status})` }, { status: 400 });
    }
    const html = await pageResponse.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || parsedUrl.hostname;
    const text = htmlToText(html);

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        organization_id: organizationId,
        title,
        source_type: "website",
        file_url: parsedUrl.href,
        status: "processing",
      })
      .select("id")
      .single();
    if (error) throw error;

    const htmlBuffer = Buffer.from(html, "utf8");
    const checksum = createHash("sha256").update(htmlBuffer).digest("hex");
    const storagePath = `${organizationId}/${source.id}/page.html`;
    const { error: uploadError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, htmlBuffer, { contentType: "text/html", upsert: true });
    if (!uploadError) {
      await supabase
        .from("knowledge_sources")
        .update({ storage_bucket: KNOWLEDGE_BUCKET, storage_path: storagePath, checksum_sha256: checksum })
        .eq("id", source.id);
    }

    const result = await ingestKnowledgeText({ organizationId, sourceId: source.id, text });
    return NextResponse.json({ ...result, file_name: title, text_length: text.length }, { status: 201 });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
