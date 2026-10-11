/* ═══ الحفظُ التلقائيّ — وما يقوله مؤشّرُه (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «احذفوا زرَّ "احفظ — لم
   تكتمل بعد": حفظٌ تلقائيٌّ مع مؤشّرٍ صغير "حُفظ قبل ثوانٍ"، وزرٌّ واحدٌ فقط:
   "التالي"». فما يكتبه المدرّبُ يُحفظ بعد سكونه لحظةً، ويقول المؤشّرُ حالَه
   بكلمات: يُحفظ، أو حُفظ قبل كذا، أو لم يُحفظ ولماذا.

   والمهلةُ بعد آخر نقرة لا بعد أوّلها: من يكتب فقرةً لا يُرسَل نصفُ كلمته مع
   كلّ حرف. والحكمُ على ما يمنع الحفظَ هو حكمُ الحفظ اليدويّ نفسُه (`saveProblems`
   في الشاشة) — فما لا يُحفظ يُقال سببُه ولا يُرسَل ليُردّ. */

/** سكونٌ بعد آخر تعديلٍ ثمّ يُحفظ — بالمللي ثانية */
export const AUTOSAVE_DELAY_MS = 1500

/** وحفظٌ سقط بانقطاع الشبكة أو عطبِ الخادم يُعاد بعد هذا — بلا انتظار حرفٍ جديد */
export const AUTOSAVE_RETRY_MS = 15_000

/** «قبل ثوانٍ» · «قبل دقيقة» · «قبل ٥ دقائق» — منذ آخر حفظ */
export function savedAgoAr(elapsedMs: number): string {
  const s = Math.max(0, Math.floor(elapsedMs / 1000))
  if (s < 45) return 'قبل ثوانٍ'
  const m = Math.round(s / 60)
  if (m <= 1) return 'قبل دقيقة'
  if (m === 2) return 'قبل دقيقتين'
  if (m <= 10) return `قبل ${m} دقائق`
  if (m < 60) return `قبل ${m} دقيقة`
  return 'قبل أكثر من ساعة'
}

export type AutosaveView =
  | { kind: 'saving' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'pending' }
  | { kind: 'saved'; at: number }
  | { kind: 'idle' }

/** ما يقوله المؤشّر — والأسبقُ أولى: الجاري، ثمّ ما يمنع، ثمّ ما سقط، ثمّ ما ينتظر */
export function autosaveView(s: {
  saving: boolean; dirty: boolean; problem: string | null; failed: string | null; savedAt: number | null
}): AutosaveView {
  if (s.saving) return { kind: 'saving' }
  if (s.dirty && s.problem) return { kind: 'blocked', reason: s.problem }
  if (s.dirty && s.failed) return { kind: 'failed', reason: s.failed }
  if (s.dirty) return { kind: 'pending' }
  if (s.savedAt !== null) return { kind: 'saved', at: s.savedAt }
  return { kind: 'idle' }
}

/** المؤشّرُ بجملة — و`null` حين لا شيءَ يُقال */
export function autosaveLineAr(v: AutosaveView, now: number): string | null {
  switch (v.kind) {
    case 'saving': return 'يُحفظ…'
    case 'blocked': return `لم يُحفظ — ${v.reason}`
    case 'failed': return `لم يُحفظ — ${v.reason}`
    case 'pending': return 'يُحفظ بعد لحظة'
    case 'saved': return `حُفظ ${savedAgoAr(now - v.at)}`
    default: return null
  }
}
