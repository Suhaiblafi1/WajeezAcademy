/* عميل API موحد للوحات الإدارة — كوكي الجلسة، وأخطاء عربية مفهومة */

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
