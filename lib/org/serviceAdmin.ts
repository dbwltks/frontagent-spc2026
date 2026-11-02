/* eslint-disable @typescript-eslint/no-explicit-any */
type ServiceRow = Record<string, any>;

const FIELDS = ["name", "description", "price", "duration_minutes", "is_active", "is_reservable"] as const;

// services 행을 관리자 승인 큐(ServiceAdminRecord) 형태로 변환한다.
// suggested는 AI가 추출/제안한 값(pending_payload → raw_payload), current는 현재 저장값이다.
export function toServiceAdminItem(row: ServiceRow) {
  const current: Record<string, unknown> = {};
  for (const f of FIELDS) current[f] = row[f];

  const suggestedSource = (row.pending_payload ?? row.raw_payload ?? {}) as Record<string, unknown>;
  const suggested = { ...current, ...suggestedSource };

  const missing = (["name", "price", "duration_minutes"] as const).filter(
    (f) => suggested[f] == null || suggested[f] === "",
  );
  const changed = FIELDS.filter((f) => suggestedSource[f] !== undefined && suggestedSource[f] !== current[f]);

  return {
    id: row.id,
    organization_id: row.organization_id,
    status: row.approval_status,
    sync_status: row.sync_status,
    source_type: row.source_type,
    source_id: row.source_id,
    name: row.name,
    current,
    suggested,
    can_approve: missing.length === 0,
    missing_fields: missing,
    changed_fields: changed,
    has_changes: changed.length > 0,
    can_deactivate: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_extracted_at: row.last_extracted_at,
  };
}
