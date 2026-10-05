/* ═══ حدودُ ما يُكتب في خطّة الشعبة — رقمٌ واحدٌ للخادم والشاشة (٥ أكتوبر ٢٠٢٦) ═══

   ─────────── العطبُ الذي وُلد منه ───────────

   مخطّطُ الحفظ في الخادم يحدّ النبذةَ بألفين والمخرَجَ بألفٍ وعنوانَ المصدر
   بمئتين، والشاشةُ لا تعرف من ذلك شيئا: يكتب المدرّبُ ما شاء، ثمّ يُردّ حفظُه
   **كلُّه** بسطرٍ واحد — «القيمةُ فوق الحدّ الأعلى — الحقل modules.2.outcomeAr».
   والحفظُ يرسل الخطّةَ كاملةً، فمخرَجٌ طويلٌ في المحور الثالث يُسقط حفظَ
   «المعلومات الأساسيّة» نفسِها، ولا يقول أين.

   فصارت الحدودُ هنا، يقرؤها المخطّطُ والشاشةُ معا: والشاشةُ تسمّي الحقلَ بلغة
   من يصحّحه — «مخرَجُ المحور ٣ أطولُ من ١٠٠٠ حرف» — قبل أن يُرسَل شيء. ورقمان
   يقولان الشيءَ نفسَه يفترقان.

   والمتنُ ليس هنا: سقفُه سقفُ التأليف (`MAX_BODY_CHARS`)، ويقرؤه المخطّطُ من
   خدمة التأليف — والعلّةُ عند حقله في `learning-portal.routes.ts`. */

import { resourceCategory } from './plan-overlay'

export const PLAN_MAX = {
  summaryAr: 2000,
  moduleTitle: 200,
  outcomeAr: 1000,
  activityAr: 2000,
  artifactAr: 1000,
  resourceTitle: 200,
  resourceUrl: 500,
  /** عددُ المصادر في الخطّة */
  resources: 60,
} as const

/** أقصرُ عنوانٍ يُقبل — للمحور وللمصدر */
export const PLAN_TITLE_MIN = 2

/** موضعُ ما تجاوز حدَّه — الخطوةُ التي يُصلَح فيها */
export type PlanTextPlace = 'identity' | 'modules' | 'recorded' | 'resources'

export interface PlanTextLike {
  summaryAr?: string | null
  modules: readonly { titleAr: string; outcomeAr?: string | null; activityAr?: string | null; artifactAr?: string | null }[]
  resources: readonly { title: string; category?: string | null; kind?: string | null }[]
}

const over = (v: string | null | undefined, max: number) => (v ?? '').length > max

/** ما تجاوز حدَّه — بلغة من يصحّحه، وبموضعه. فارغةٌ إن لم يتجاوز شيء */
export function planTextProblemsAr(c: PlanTextLike): { place: PlanTextPlace; text: string }[] {
  const out: { place: PlanTextPlace; text: string }[] = []
  const M = PLAN_MAX
  if (over(c.summaryAr, M.summaryAr)) {
    out.push({ place: 'identity', text: `النبذةُ أطولُ من ${M.summaryAr} حرف (${(c.summaryAr ?? '').length}) — اختصرها` })
  }
  c.modules.forEach((m, i) => {
    const n = i + 1
    if (over(m.titleAr, M.moduleTitle)) out.push({ place: 'modules', text: `عنوانُ المحور ${n} أطولُ من ${M.moduleTitle} حرف — اختصره` })
    if (over(m.outcomeAr, M.outcomeAr)) out.push({ place: 'modules', text: `مخرَجُ المحور ${n} أطولُ من ${M.outcomeAr} حرف (${(m.outcomeAr ?? '').length}) — اختصره` })
    if (over(m.activityAr, M.activityAr)) out.push({ place: 'modules', text: `التطبيقُ العمليّ في المحور ${n} أطولُ من ${M.activityAr} حرف (${(m.activityAr ?? '').length}) — اختصره` })
    if (over(m.artifactAr, M.artifactAr)) out.push({ place: 'modules', text: `مُسلَّمُ المحور ${n} أطولُ من ${M.artifactAr} حرف (${(m.artifactAr ?? '').length}) — اختصره` })
  })
  c.resources.forEach((r) => {
    if (!over(r.title, M.resourceTitle)) return
    const place: PlanTextPlace = resourceCategory(r) === 'recorded' ? 'recorded' : 'resources'
    out.push({ place, text: `اسمُ المصدر «${r.title.trim().slice(0, 40)}…» أطولُ من ${M.resourceTitle} حرف — اختصره` })
  })
  return out
}
