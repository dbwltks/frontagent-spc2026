import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../lib/org/resolveOrganization";
import { ingestKnowledgeText } from "../../../../lib/ai/knowledge/ingest";
import { detectSourceType, extractFileText } from "../../../../lib/ai/knowledge/parseFile";

const KNOWLEDGE_BUCKET = "knowledge-originals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "multipart/form-data 요청이 필요합니다." }, { status: 400 });

  const organizationId = formData.get("organization_id");
  const folderId = formData.get("folder_id");
  const file = formData.get("file");

  if (typeof organizationId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "organization_id, file이 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();

    const buffer = Buffer.from(await file.arrayBuffer());
    const sourceType = detectSourceType(file.name, file.type);

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        organization_id: organizationId,
        folder_id: typeof folderId === "string" ? folderId : null,
        title: file.name,
        source_type: sourceType,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: buffer.byteLength,
        status: "processing",
      })
      .select("id")
      .single();
    if (error) throw error;

    // 원본 파일을 Storage에 보관해둬야 나중에 reindex(재파싱)할 때 다시 쓸 수 있다.
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const storagePath = `${organizationId}/${source.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type || "application/octet-stream", upsert: true });
    if (!uploadError) {
      await supabase
        .from("knowledge_sources")
        .update({ storage_bucket: KNOWLEDGE_BUCKET, storage_path: storagePath, checksum_sha256: checksum })
        .eq("id", source.id);
    }

    const text = await extractFileText(buffer, file.name, file.type);
    const result = await ingestKnowledgeText({
      organizationId,
      sourceId: source.id,
      folderId: typeof folderId === "string" ? folderId : null,
      text,
    });

    return NextResponse.json({ ...result, file_name: file.name, text_length: text.length }, { status: 201 });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
