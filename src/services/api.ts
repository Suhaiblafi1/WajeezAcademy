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

/* ═══ تنزيلُ ملفٍّ من الخادم بالجلسة نفسِها (٧ أكتوبر ٢٠٢٦) ═══

   رابطٌ عاديٌّ (`<a href download>`) لا يقول شيئا إن ردّ الخادمُ بخطأ: يُنزَّل
   ملفٌّ فيه JSON الخطأ باسم الحزمة، أو لا يقع شيء. فيُجلب هنا كما تُجلب البيانات،
   والخطأُ `ApiError` برسالته العربيّة، والاسمُ ما سمّاه الخادم (`filename*`) —
   «خطة شعبة ديسمبر.zip» لا «download». */
export async function apiDownload(path: string, fallbackName: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: { code: string; message_ar: string } } | null;
    throw new ApiError(data?.error?.code ?? "http_error", data?.error?.message_ar ?? `خطأ ${res.status}`, res.status);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  let name = fallbackName;
  if (encoded) {
    try { name = decodeURIComponent(encoded); } catch { /* اسمٌ لا يُفكّ — يبقى البديل */ }
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  /* يُحرَّر بعد أن يبدأ المتصفّحُ التنزيل — تحريرُه في اللحظة نفسِها يقطعه في بعضها */
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return name;
}

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

/* ═══ رفعُ ملفٍّ إلى رابطه الموقَّع، بنسبةٍ تُرى (١٠ أكتوبر ٢٠٢٦) ═══

   ملفُّ التسليم قد يكون تسجيلا بمئة ميغابايت، ورفعُه على شبكة هاتفٍ دقائق. و`fetch` لا يقول كم
   رُفع، فيبقى المتعلّمُ أمام زرٍّ يدور لا يعرف أيعمل أم توقّف — فيغلق الصفحة. فالرفعُ هنا
   بـ`XMLHttpRequest`، والنسبةُ تصل الشاشةَ. والخطأُ `ApiError` برسالة الخادم كبقيّة الطلبات. */
export function apiUpload(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${API_BASE}${url}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      let data: { error?: { code: string; message_ar: string } } | null = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ردٌّ بلا JSON */ }
      reject(new ApiError(data?.error?.code ?? "upload_failed", data?.error?.message_ar ?? "تعذّر رفع الملف", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("network", "انقطع الاتصال أثناء رفع الملف", 0));
    xhr.send(file);
  });
}
