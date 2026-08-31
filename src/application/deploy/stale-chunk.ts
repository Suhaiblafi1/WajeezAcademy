/* تمييزُ القطعة الزائلة ونافذةُ إعادة التحميل — منطقٌ نقيّ بلا JSX.

   كان في مكوّن الحاجز نفسه، فاضطُرّ اختبارُه إلى استيراد ملفّ .tsx —
   وتهيئةُ الخادم تُصرّفه بلا jsx فيسقط الفحص. والفصل أصحّ في نفسه: هذه
   قواعدُ قرارٍ لا عرضٌ، ويشاركها الحاجزُ وحارسُ index.html. */

/** المفتاح نفسه الذي يستعمله حارس index.html — نافذةٌ واحدة لعطبٍ واحد */
export const STALE_RELOAD_KEY = 'wajeez_stale_reload_at'
export const STALE_RELOAD_COOLDOWN_MS = 60_000

/** هل يدلّ الخطأ على قطعةٍ زالت بنشرٍ جديد؟ */
export function isStaleChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')
  return (
    text.includes('dynamically imported module') ||
    text.includes('Importing a module script failed') ||
    text.includes('error loading dynamically imported module') ||
    text.includes('Failed to fetch')
  )
}

/** أُذن لإعادة التحميل؟ واحدةٌ كلّ دقيقة، ولا إعادة بلا تخزينٍ متاح */
export function mayReload(now: number = Date.now()): boolean {
  try {
    const last = Number.parseInt(sessionStorage.getItem(STALE_RELOAD_KEY) ?? '0', 10)
    if (last && now - last < STALE_RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(STALE_RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}
