/* اقتراحاتُ المدرّب في ملفّه: ما ينتظر قرارا يُعرض، وما بُتّ فيه يُطوى (٢٩ سبتمبر ٢٠٢٦).

   ── ما كان ──

   كان ملفُّ المدرّب يعرض المفتوحَ والمربوطَ بطاقةً بطاقةً بأزرارها، ويُسقط ما
   صار دورةً وما رُدّ. فلمّا طُبّق ملفُّ القرارات رأى صاحبُ المنصّة في ملفّ
   مدرّبةٍ «دوراتٌ يقترحها — ١» ببطاقةٍ كاملة، فسأل: «لماذا ما زال هناك مقترح؟»
   — والاقتراحُ مبتوتٌ فيه منذ رُبط. فالبطاقةُ بأزرارها تقول «انظر فيّ»،
   والمبتوتُ لا يطلب نظرا.

   ── وما صار ──

   المفتوحُ بطاقاتٌ كما كان. والمبتوتُ كلُّه — المربوطُ وما صار دورةً وما رُدّ —
   سطرٌ واحدٌ يُفتح: عددُه وقسمتُه. ومن فتحه وجد المربوطَ بأبواب رجوعه كما هي،
   فلا يُفقد شيء، ولا يبدو المنتهي معلّقا.

   ولا يمسّ هذا الطابورَ (`/admin/course-proposals`): المربوطُ يبقى فيه معروضا
   بقرار صاحب المنصّة (٢٠ سبتمبر، انظر `QUEUE_VISIBLE` في الخادم) — هناك يُعاد
   النظرُ في الروابط عبر المدرّبين كلِّهم، وهنا يُقرأ ملفُّ إنسانٍ بعينه.

   وما لا يُعرف حالُه لا يُطوى: يبقى بطاقةً تُرى — فالطيُّ لما عُرف أنّه انتهى. */

/** ما بُتّ فيه — يُقابَل بـ`DECIDED_PROPOSAL` في الخادم في اختبار، فلا تفترق قائمتان */
export const DECIDED_PROPOSAL_STATUSES = ['linked', 'became_course', 'rejected'] as const

/** لفظُ كلِّ قرارٍ في السطر المطويّ — بألفاظ البطاقة نفسِها */
const DECIDED_WORDS: Record<(typeof DECIDED_PROPOSAL_STATUSES)[number], string> = {
  linked: 'رُبطت برمزٍ قائم',
  became_course: 'صارت دورةً',
  rejected: 'رُدّت',
}

const isDecided = (status: string) => (DECIDED_PROPOSAL_STATUSES as readonly string[]).includes(status)

export function foldProposals<T extends { status: string }>(proposals: readonly T[]): {
  open: T[]
  decided: T[]
  /** «رُبطت برمزٍ قائم: 1 · صارت دورةً: 1» — بترتيبٍ ثابت، ولا يُذكر ما عددُه صفر */
  decidedSummaryAr: string
} {
  const decided = proposals.filter((p) => isDecided(p.status))
  const decidedSummaryAr = DECIDED_PROPOSAL_STATUSES
    .map((s) => [DECIDED_WORDS[s], decided.filter((p) => p.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([word, n]) => `${word}: ${n}`)
    .join(' · ')
  return { open: proposals.filter((p) => !isDecided(p.status)), decided, decidedSummaryAr }
}
