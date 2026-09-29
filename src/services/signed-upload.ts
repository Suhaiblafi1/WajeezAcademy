/* الرفعُ خطوتان: رابطٌ موقّتٌ من الخادم، ثمّ البايتاتُ إليه مباشرةً — لا
   يمرّ الملفُّ في JSON فيتضخّم الثلث. وكانت كلُّ شاشةٍ تكتب الـ`fetch`
   بيدها؛ وهذه لشاشتَي التسويق ومن شاء بعدهما. */

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** يرسل الملفَّ إلى رابط الرفع الموقّع — ويردّ رسالةً عربيّةً حين يسقط */
export async function putSigned(uploadUrl: string, file: Blob, maxBytes?: number): Promise<void> {
  if (maxBytes && file.size > maxBytes) {
    throw new Error(`الملفُّ أكبرُ من الحدّ (${Math.round(maxBytes / (1024 * 1024))} ميغابايت)`);
  }
  const res = await fetch(`${API_BASE}${uploadUrl}`, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message_ar?: string } } | null;
    throw new Error(body?.error?.message_ar ?? `تعذّر الرفع (${res.status})`);
  }
}

/** عنوانُ صورةٍ يفتح — مسارُ الخادم يُسبق بأصله، والرابطُ الخارجيُّ كما هو */
export function mediaSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/api/") ? `${API_BASE}${url}` : url;
}
