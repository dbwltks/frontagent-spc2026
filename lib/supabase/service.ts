import { createClient } from "@supabase/supabase-js";

// 서비스롤 키를 쓰는 서버 전용 클라이언트. RLS를 우회하므로 Route Handler에서
// organization_id를 직접 검증한 뒤에만 사용한다 — 절대 브라우저로 내보내지 않는다.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createSupabaseServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
