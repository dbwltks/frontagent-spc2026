import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

// 쿠키 기반 브라우저 클라이언트 — 세션이 쿠키에 저장되므로 /api/* Route Handler가
// createSupabaseServerClient()로 같은 로그인 유저를 확인할 수 있다.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseReady = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
