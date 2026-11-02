import { NextRequest } from "next/server";
import { HttpError, runAdmin } from "../../../../lib/org/adminRoute";
import { createFlowFromTemplate, FLOW_TEMPLATES, getFlowTemplate } from "../../../../lib/ai/taskFlowTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// template: 템플릿 키 또는 "all"(전체 템플릿 일괄 생성)
export function POST(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, body }) => {
    const key = typeof body.template === "string" ? body.template : "";
    const templates = key === "all" ? FLOW_TEMPLATES : [getFlowTemplate(key)].filter((t) => t !== undefined);
    if (!templates.length) throw new HttpError(`알 수 없는 템플릿입니다: ${key}`);

    const items = [];
    for (const template of templates) {
      items.push(
        await createFlowFromTemplate({
          organizationId,
          template,
          overwrite: body.overwrite === true,
          isEnabled: body.is_enabled !== false,
          overrides:
            templates.length === 1
              ? {
                  triggerDescription: typeof body.trigger_description === "string" ? body.trigger_description : null,
                  triggerExamples: Array.isArray(body.trigger_examples) ? body.trigger_examples : null,
                }
              : undefined,
        }),
      );
    }

    return {
      organization_id: organizationId,
      template: key,
      created_count: items.filter((i) => i.created).length,
      skipped_count: items.filter((i) => i.skipped).length,
      items,
    };
  });
}
