/* «لماذا هذا المسار» — بطاقةٌ واحدة، تُبنى من النتيجة في موضعٍ واحد.

   كانت تُعرض في شاشة النتيجة وحدَها. ثمّ صار التشخيصُ ينتقل إلى صفحة المسار
   مباشرةً (#220)، فلم يعد يراها إلّا مَن انتهى إلى التوقّف الحوكميّ أو
   الاتّجاه الاستكشافيّ — والموقعُ يَعِد بها الجميعَ: «نوصي ونشرح» في
   الرئيسة، و«فالتشخيص يختار لك ويشرح لماذا» في كتالوج المسارات. فطلب صاحبُ
   المنصّة (٤ أكتوبر ٢٠٢٦) أن تعود البطاقةُ إلى صفحة المسار نفسِها.

   والشاشتان تبنيانها من هنا: كانت مداخلُها تُستخرج في `Diagnostic.tsx` سطرا
   سطرا، ولو كُتبت ثانيةً في `Pathway.tsx` لافترقتا يومَ يُضاف إليها حقل. */

import type { DiagResult } from '@/data/diagnostic'

/** مكوّناتُ قوّة الأدلة الخمسة — كما يكتبها المحرّك في `resultJson.confidence` */
export interface WhyConfidence {
  coverage: number
  consistency: number
  separation: number
  evidenceQuality: number
  stability: number
  total?: number
}

export interface WhyPathwayFacts {
  reasons: string[]
  confidence: WhyConfidence | undefined
  bandAr: string | null
  blockers: string[]
  basis: { measured: number; measurable: number; unknown: number } | null
  changeMakers: string[]
}

/** مداخلُ البطاقة من نتيجة التشخيص — ما حسبه المحرّك، بلا إضافةٍ ولا تأويل */
export function whyPathwayFacts(res: DiagResult): WhyPathwayFacts {
  const j = res.resultJson
  return {
    reasons: res.reasons,
    confidence: j.confidence as WhyConfidence | undefined,
    bandAr: res.confidenceBand,
    blockers: (j.strong_blockers_ar as string[] | undefined) ?? [],
    basis: (j.evidence_basis as WhyPathwayFacts['basis'] | undefined) ?? null,
    changeMakers: (j.change_makers_ar as string[] | undefined) ?? [],
  }
}

/** النتيجةُ التي تُشرح على صفحة مسارٍ بعينه — أو لا شيء.

    تُشرح على المسار الذي هبط عليه التشخيصُ وحدَه: `wajeez_diag_top` يُكتب
    لحظةَ الهبوط. ومَن تنقّل بعدها إلى مسارٍ آخر لا يقرأ عليه «لماذا هذا
    المسار» بأسبابِ غيره. والقراءةُ من التخزين تُمرَّر دالّةً لتبقى هذه نقيّة. */
export function whyResultForPathway(
  pathwayId: string,
  diagTopId: string | null,
  load: () => DiagResult | null,
): DiagResult | null {
  if (!pathwayId || diagTopId !== pathwayId) return null
  return load()
}
