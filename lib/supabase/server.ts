import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// 쿠키 기반 서버 클라이언트 — 관리자 콘솔 라우트에서 "지금 로그인한 사람이 누구인지"
// 확인할 때만 쓴다. anon key로 동작하므로 RLS가 그대로 적용된다(특권 쿼리는
// service.ts의 서비스롤 클라이언트를 organization_id 검증 후에 쓴다).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component에서 호출되면 쓰기가 무시된다 — 미들웨어가 세션을 갱신하므로 안전하다.
        }
      },
    },
  });
}
