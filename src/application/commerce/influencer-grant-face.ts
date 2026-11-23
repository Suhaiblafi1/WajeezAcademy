/* وجهُ منحة المؤثّر في صفحته — مصدرٌ واحدٌ للاسم والشعار والنسبة (٢٣ نوفمبر ٢٠٢٦).

   ═══ ما رآه صاحبُ المنصّة ═══

   أخذ كودا من صفحة ChatTree (60%)، ثمّ عبّأ صفحةَ كاسيت (70%): فرأى شعارَ كاسيت من الرابط، و«منحة ChatTree تغطي 60%» من
   كوده المحفوظ في جهازه. كان الشعارُ يُقرأ من الصفحة حين تُحمَّل، والاسمُ ممّا ردّه النموذج، والكودُ والنسبةُ ممّا حُفظ —
   ثلاثةُ مصادرَ تختلف. وقرارُه «Move to the new one»: كودٌ لم يُستعمل ينتقل إلى المؤثّر الجديد (`moveInfluencerCode` في الخادم).

   ═══ فالقاعدة ═══

   ١) **ما حُفظ لمؤثّرٍ آخر لا يُعرض في صفحة غيره قبل النموذج** (`storedForInfluencerPage`) — يرى نموذجَ هذا المؤثّر، فإن
      عبّأه قال الخادمُ لمن صار كودُه.
   ٢) **والوجهُ واحد** (`influencerGrantFace`): الاسمُ والشعارُ وزرُّ واتساب من مؤثّرٍ واحد — مؤثّرُ الصفحة حين تُحمَّل، ثمّ
      مؤثّرُ الكود كما ردّه الخادمُ بعد النموذج.
   ٣) **وإن بقي كودُه لمؤثّرٍ غيرِ مؤثّر الصفحة** (استعمله قبلُ) يُقال ذلك سطرا واحدا باسمه ونسبته (`heldByOtherAr`).

   والحارس: `src/tests/commerce/influencer-grant-face.test.ts`. */

import { influencerGrantNameAr } from './grant'
import { normalizeInfluencerCode } from './influencer'

/** المؤثّرُ كما يردّه الخادم — في صفحته وفي جواب النموذج (`influencerFace` في `grant-landing.service.ts`) */
export interface InfluencerFace {
  nameAr: string
  code: string
  brand?: { logoUrl: string | null } | null
  whatsAppText?: string
}

/** رأسُ الصفحة المشترك — لمن له شعارٌ عندنا */
export interface InfluencerCobrand { nameAr: string; brand: { logoUrl: string | null }; whatsAppText: string }

/** ما حُفظ في الجهاز يُعرض في صفحة هذا المؤثّر — إلّا إن كان لمؤثّرٍ آخر. وصفحةٌ بلا كودٍ في رابطها تعرض ما حُفظ */
export function storedForInfluencerPage<T extends { influencer?: string | null }>(stored: T | null, urlCode: string | null): T | null {
  if (!stored) return null
  const page = normalizeInfluencerCode(urlCode)
  const mine = normalizeInfluencerCode(stored.influencer ?? null)
  if (!page || !mine) return stored
  return page === mine ? stored : null
}

/** اسمُ المنحة ورأسُها من وجهٍ واحد — فلا يقول الاسمُ مؤثّرا والشعارُ غيرَه */
export function influencerGrantFace(face: InfluencerFace | null | undefined): { nameAr: string; cobrand: InfluencerCobrand | null } {
  return {
    nameAr: influencerGrantNameAr(face?.nameAr),
    cobrand: face?.brand && face.whatsAppText ? { nameAr: face.nameAr, brand: face.brand, whatsAppText: face.whatsAppText } : null,
  }
}

/** «لديك منحة من ChatTree بخصم 60%» — حين بقي كودُه لمؤثّرٍ غيرِ مؤثّر الصفحة. وإلّا لا شيء */
export function heldByOtherAr(face: InfluencerFace | null | undefined, pageCode: string | null, percentOff: number): string | null {
  const page = normalizeInfluencerCode(pageCode)
  if (!face || !page || normalizeInfluencerCode(face.code) === page) return null
  return `لديك منحة من ${face.nameAr} بخصم ${percentOff}%`
}
