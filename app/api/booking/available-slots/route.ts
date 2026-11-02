/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// 타임존의 로컬 시각(date + HH:mm)을 UTC epoch(ms)로 변환한다.
function zonedToEpoch(date: string, time: string, timeZone: string) {
  const utcGuess = Date.parse(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return utcGuess - (asUtc - utcGuess);
}

function toHm(value: unknown, fallback: string) {
  return typeof value === "string" && /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5).padStart(5, "0") : fallback;
}

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, query }) => {
    const serviceId = query.get("service_id");
    const date = query.get("date");
    if (!serviceId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError("service_id, date(YYYY-MM-DD)가 필요합니다.");
    }

    const service = must(
      await supabase.from("services").select("id, duration_minutes").eq("id", serviceId).eq("organization_id", organizationId).maybeSingle(),
      "서비스를 찾을 수 없습니다.",
    );
    const { data: setting, error: settingError } = await supabase
      .from("booking_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (settingError) throw settingError;
    if (!setting || setting.is_active === false) return { slots: [] };

    const timeZone: string = setting.timezone ?? "Asia/Seoul";
    const interval: number = setting.slot_interval_minutes ?? 30;
    const duration: number = service.duration_minutes ?? interval;
    const dayKey = DAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const weekly: Array<Record<string, any>> = Array.isArray(setting.weekly_hours) ? setting.weekly_hours : [];
    const day = weekly.find((d) => d.day === dayKey) ?? weekly[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
    if (!day || day.enabled === false) return { slots: [] };

    const openAt = zonedToEpoch(date, toHm(day.start ?? day.open_time, "09:00"), timeZone);
    const closeAt = zonedToEpoch(date, toHm(day.end ?? day.close_time, "18:00"), timeZone);

    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("start_at, end_at")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "confirmed"])
      .lt("start_at", new Date(closeAt).toISOString())
      .gt("end_at", new Date(openAt).toISOString());
    if (resError) throw resError;
    const busy = (reservations ?? []).map((r) => [Date.parse(r.start_at), Date.parse(r.end_at)] as const);

    const earliest = Date.now() + (setting.min_notice_minutes ?? 0) * 60_000;
    const latest = Date.now() + (setting.max_days_ahead ?? 30) * 86_400_000;
    const slots: Array<Record<string, unknown>> = [];
    for (let start = openAt; start + duration * 60_000 <= closeAt; start += interval * 60_000) {
      const end = start + duration * 60_000;
      const available =
        start >= earliest && start <= latest && !busy.some(([bs, be]) => start < be && end > bs);
      slots.push({
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        timezone: timeZone,
        service_id: serviceId,
        available,
      });
    }
    return { slots };
  });
}
