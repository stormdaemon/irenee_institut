import type { Course } from "@/lib/types";
import type { createServerClient } from "@/lib/supabase";

export const secretSettingKeys = new Set(["lemonApiKey", "lemonSigningSecret"]);

export type SystemSettings = Record<string, unknown>;

export function parseSettingValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function stringifySettingValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "");
}

export function maskSecret(value: unknown) {
  const secret = String(value || "");
  if (!secret) return "";
  if (secret.length <= 12) return "••••••••";
  return `${secret.slice(0, 6)}••••••${secret.slice(-6)}`;
}

export function normalizeVariantMap(value: unknown): Record<string, string> {
  const parsed = typeof value === "string" ? parseSettingValue(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .map(([key, raw]) => [key, String(raw || "").trim()])
      .filter(([, raw]) => Boolean(raw))
  );
}

export function getCourseVariantId(settings: SystemSettings, course: Pick<Course, "id" | "slug">) {
  const variantMap = normalizeVariantMap(settings.lemonVariantMap);
  return variantMap[course.id] || variantMap[course.slug] || String(settings.lemonDefaultVariantId || "").trim();
}

export async function getSystemSettings(supabase: NonNullable<ReturnType<typeof createServerClient>>): Promise<SystemSettings> {
  const { data, error } = await supabase.from("system_settings").select("*");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map(item => [item.key, parseSettingValue(item.value)]));
}
