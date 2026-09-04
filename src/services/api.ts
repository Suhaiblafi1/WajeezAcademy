/* عميل API موحد للوحات الإدارة — كوكي الجلسة، وأخطاء عربية مفهومة */

import { platformConfigSnapshot } from "./platform-config";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, messageAr: string, status: number) {
    super(messageAr);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { code: string; message_ar: string } })
    | null;
  if (!res.ok) {
    throw new ApiError(data?.error?.code ?? "http_error", data?.error?.message_ar ?? `خطأ ${res.status}`, res.status);
  }
  return data as T;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPut = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const apiPatch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body);
export const apiDelete = <T>(path: string, body?: unknown) => request<T>("DELETE", path, body);

/* رسالةُ رفض الصلاحية — من الخادم لا من هنا.

   كان هذا السطرُ يقول لكلّ شاشةٍ ممنوعةٍ «تتطلب صلاحية «مدير النظام»» ثمّ
   يُرشد إلى حساب الديمو. وكلاهما خطأ: صفحةُ الماليّة تتطلّب دورَ الماليّة لا
   مديرَ النظام، وحسابُ الديمو نصٌّ لا معنى له في الإنتاج. والخادمُ صار يسمّي
   الصلاحيّةَ ومن يملكها (auth-plugin.ts)، فيُعرض جوابُه كما هو. */
export function permissionMessage(e: unknown, fallback: string): string {
  if (!(e instanceof ApiError)) return fallback;
  if (e.status !== 403) return e.message;
  const hint = platformConfigSnapshot()?.demoMode
    ? " في الديمو: سجّل الخروج ثم ادخل بحساب superadmin.demo@wajeez.local لعرض كلّ الشاشات."
    : "";
  return `${e.message}${hint}`;
}
