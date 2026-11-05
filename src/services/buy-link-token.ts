/* رمزُ رابط الشراء الموقَّع (`?bl=`) — يُحفظ حين يُفتح الرابط، ويُرسَل مع الشراء (٥ نوفمبر ٢٠٢٦).
   والخادمُ وحدَه يصدّقه (`server/services/buy-link.service.ts`): منه تُعرف روابطُ السوبر أدمن التي لا عمولةَ مستشارٍ عليها.
   في التخزين المحلّيّ لا الجلسيّ — رابطُ توثيق البريد يُفتح في تبويبٍ جديد — ولأسبوعٍ ثمّ يُنسى. */
import { safeGet, safeSet } from "./safe-storage";

const KEY = "wajeez_buy_link";
const TTL_MS = 7 * 86_400_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,60}\.(admin|advisor)\.[A-Za-z0-9_-]{10,40}$/;

/** يُنادى من صفحة `/build` حين يحمل رابطُها `bl` */
export function rememberBuyLink(token: string | null | undefined): void {
  if (!token || !TOKEN_RE.test(token)) return;
  safeSet(KEY, JSON.stringify({ token, at: Date.now() }));
}

/** ما يُرسَل مع الشراء — أو لا شيء */
export function buyLinkToken(now = Date.now()): string | null {
  const raw = safeGet(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { token?: unknown; at?: unknown };
    return typeof v.token === "string" && TOKEN_RE.test(v.token) && typeof v.at === "number" && now - v.at < TTL_MS ? v.token : null;
  } catch {
    return null;
  }
}
