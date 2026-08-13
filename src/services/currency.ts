import { useSyncExternalStore } from "react";

/* ─────────── خدمة العملات ───────────
   المنطق الداخلي للأسعار يبقى بالدولار دائما، وهذه الخدمة للعرض فقط:
   تكشف بلد الزائر (لغة المتصفح ثم المنطقة الزمنية)، وتحوّل المبلغ المعروض
   بجدول ثابت، وتتيح للزائر التبديل يدويا. عند الربط الحقيقي مع Stripe
   يُمرر المبلغ المحوّل والعملة نفسها إلى جلسة الدفع. */

export type CurrencyCode = "USD" | "SAR" | "AED" | "KWD" | "EGP";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string; // ما يظهر بعد المبلغ
  label: string; // اسم العملة للمبدّل
  rate: number; // كم وحدة من العملة لكل دولار واحد
  round: (converted: number) => number; // تدوير جميل للعرض
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", label: "دولار أمريكي", rate: 1, round: (v) => Math.round(v) },
  SAR: { code: "SAR", symbol: "ر.س", label: "ريال سعودي", rate: 3.75, round: (v) => Math.round(v / 5) * 5 },
  AED: { code: "AED", symbol: "د.إ", label: "درهم إماراتي", rate: 3.67, round: (v) => Math.round(v / 5) * 5 },
  KWD: { code: "KWD", symbol: "د.ك", label: "دينار كويتي", rate: 0.31, round: (v) => Math.round(v * 2) / 2 },
  EGP: { code: "EGP", symbol: "ج.م", label: "جنيه مصري", rate: 48, round: (v) => Math.round(v / 10) * 10 },
};

const STORAGE_KEY = "wajeez_currency";
const CHANGE_EVENT = "wajeez:currency";

/* بلد الزائر من لغة المتصفح: ar-SA وen-AE وما شابه */
function countryFromLocale(): string | null {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const m = /-([A-Za-z]{2})\b/.exec(lang ?? "");
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/* بلد الزائر من المنطقة الزمنية كاحتياط */
const TZ_COUNTRY: Array<[string, string]> = [
  ["Riyadh", "SA"], ["Jeddah", "SA"],
  ["Dubai", "AE"], ["Abu_Dhabi", "AE"],
  ["Kuwait", "KW"],
  ["Cairo", "EG"],
];
function countryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    for (const [frag, country] of TZ_COUNTRY) if (tz.includes(frag)) return country;
  } catch { /* بيئة بلا منطقة زمنية */ }
  return null;
}

const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  SA: "SAR", AE: "AED", KW: "KWD", EG: "EGP",
};

export function detectCurrency(): CurrencyCode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved in CURRENCIES) return saved as CurrencyCode;
  const country = countryFromLocale() ?? countryFromTimezone();
  return (country && COUNTRY_CURRENCY[country]) || "USD";
}

export function getCurrency(): CurrencyInfo {
  return CURRENCIES[detectCurrency()];
}

export function setCurrency(code: CurrencyCode): void {
  localStorage.setItem(STORAGE_KEY, code);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/* تحويل مبلغ دولاري إلى عملة العرض الحالية مع التدوير */
export function convertPrice(usd: number, info: CurrencyInfo = getCurrency()): number {
  return info.round(usd * info.rate);
}

/* تنسيق المبلغ للعرض: "2,250 ر.س" أو "600$" */
export function formatPrice(usd: number, info: CurrencyInfo = getCurrency()): string {
  const v = convertPrice(usd, info);
  const num = info.code === "KWD" ? String(v) : v.toLocaleString("en-US");
  return info.code === "USD" ? `${num}$` : `${num} ${info.symbol}`;
}

/* خطاف React: يعيد العملة الحالية ويعيد الرسم عند تغييرها */
export function useCurrency(): CurrencyInfo {
  const code = useSyncExternalStore(
    (notify) => {
      window.addEventListener(CHANGE_EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(CHANGE_EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    detectCurrency,
  );
  return CURRENCIES[code];
}

/* مختصر جاهز: تنسيق مبلغ دولاري بعملة الزائر الحالية داخل المكوّنات */
export function usePriceFormatter(): (usd: number) => string {
  const info = useCurrency();
  return (usd: number) => formatPrice(usd, info);
}
