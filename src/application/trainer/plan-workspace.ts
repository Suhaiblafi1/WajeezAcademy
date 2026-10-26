/* ═══ مساحةُ مراجعة الخطّة — ما يُقرأ قبل الألسنة (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══

   «خطّة لوحة الإدارة» (٣د): الخطّةُ تذهب إلى Claude ملفّا مضغوطا وتعود بطاقات — كما هي — والفرقُ أنّها في موضعٍ واحد.
   فوق الألسنة ثلاثةُ أسطر تُقرأ قبل أن يُفتح شيء: بطاقةُ المعايير بعدّها، وما فعله المدرّبُ ببطاقاتك، والخطّةُ بعدّ
   لقاءاتها ومهامّها. ثمّ «اقتراحات Claude» و«بطاقات للمدرب» و«المنهاج»، و«أدوات Claude» قائمةٌ واحدة.
   والسطورُ تُحسب هنا، والشاشةُ تعرضها. */

import { countAr, type CountForms } from '../text/count-ar'
import type { PlanEditStatus } from './plan-edits'

const MEETING_FORMS: CountForms = { one: 'لقاء', two: 'لقاءان', few: 'لقاءات', many: 'لقاء' }
const TASK_FORMS: CountForms = { one: 'مهمة', two: 'مهمتان', few: 'مهام', many: 'مهمة' }
const WORKBOOK_FORMS: CountForms = { one: 'كراسة', two: 'كراستان', few: 'كراسات', many: 'كراسة' }
const CARD_FORMS: CountForms = { one: 'بطاقة', two: 'بطاقتان', few: 'بطاقات', many: 'بطاقة' }
const ADVICE_FORMS: CountForms = { one: 'نصيحة', two: 'نصيحتان', few: 'نصائح', many: 'نصيحة' }
const ITEM_FORMS: CountForms = { one: 'بند', two: 'بندان', few: 'بنود', many: 'بندا' }

/** المفردُ والمثنّى بلا رقمهما — «لقاء واحد» و«مهمتان» لا «1 لقاء» و«2 مهمتان» (`plansAr`) */
function say(n: number, forms: CountForms, one: string): string {
  return n === 1 ? `${forms.one} ${one}` : n === 2 ? forms.two : countAr(n, forms)
}

/** الألسنةُ الثلاثة بترتيب العمل: ما اقترحه Claude فتقرّر فيه، ثمّ ما اعتمدته للمدرّب، ثمّ المنهاج كما أرسله */
export const WORKSPACE_TABS = ['claude', 'trainer', 'plan'] as const
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

/** اسمُ اللسان بعدّه — والعددُ ما ينتظر فيه، لا ما مرّ */
export function workspaceTabAr(tab: WorkspaceTab, n: number): string {
  const base = tab === 'claude' ? 'اقتراحات Claude' : tab === 'trainer' ? 'بطاقات للمدرب' : 'المنهاج'
  return tab !== 'plan' && n > 0 ? `${base} (${n})` : base
}

/** «14 تحقق · 3 نصائح · 1 مطلوب» — بطاقةُ المعايير بعدّها. و«تحقق» و«مطلوب» وسمان يُعدّان، والنصيحةُ تُجمع */
export function scoreLineAr(c: { ok: number; advice: number; required: number }): string {
  return `${c.ok} تحقق · ${c.advice === 1 ? 'نصيحة واحدة' : c.advice === 2 ? 'نصيحتان' : countAr(c.advice, ADVICE_FORMS)} · ${c.required} مطلوب`
}

/** «بندان ينتظران مراجعتك» — رأسُ «اقتراحات Claude» */
export function draftsWaitingAr(n: number): string {
  return n === 1 ? 'بند واحد ينتظر مراجعتك' : n === 2 ? 'بندان ينتظران مراجعتك' : `${countAr(n, ITEM_FORMS)} تنتظر مراجعتك`
}

/** «8 لقاءات · 12 مهمة · كراسة» — حجمُ الخطّة كما يُعتمد */
export function planSizeAr(c: { meetings: number; tasks: number; workbooks: number }): string {
  return [
    c.meetings > 0 ? say(c.meetings, MEETING_FORMS, 'واحد') : 'بلا لقاءات',
    c.tasks > 0 ? say(c.tasks, TASK_FORMS, 'واحدة') : 'بلا مهام',
    c.workbooks === 1 ? 'كراسة' : c.workbooks > 1 ? say(c.workbooks, WORKBOOK_FORMS, 'واحدة') : 'بلا كراسة',
  ].join(' · ')
}

/** ما فعله المدرّبُ ببطاقاتك — والملاحظاتُ ليست بطاقات (كما يعدّها الخادم، `pendingEdits`) */
export interface CardTally { sent: number; accepted: number; rejected: number; withReason: number; waiting: number }

export function cardTally(items: readonly { status: PlanEditStatus; kind: string; noteAr: string | null }[]): CardTally {
  const cards = items.filter((x) => x.kind !== 'note')
  const rejected = cards.filter((x) => x.status === 'rejected')
  return {
    sent: cards.filter((x) => x.status === 'pending' || x.status === 'accepted' || x.status === 'rejected').length,
    accepted: cards.filter((x) => x.status === 'accepted').length,
    rejected: rejected.length,
    withReason: rejected.filter((x) => (x.noteAr ?? '').trim() !== '').length,
    waiting: cards.filter((x) => x.status === 'pending').length,
  }
}

/** «قبل 5 من 6 · رفض بطاقة واحدة وكتب سببه» — أو `null` لما لم يصله شيء */
export function cardsLineAr(t: CardTally): string | null {
  if (t.sent === 0) return null
  return [
    `قبل ${t.accepted} من ${t.sent}`,
    t.rejected > 0 ? `رفض ${say(t.rejected, CARD_FORMS, 'واحدة')}${t.withReason > 0 ? ' وكتب سببه' : ''}` : '',
    t.waiting > 0 ? `لم يقرر في ${say(t.waiting, CARD_FORMS, 'واحدة')}` : '',
  ].filter(Boolean).join(' · ')
}

/** وما لم يصله بعد: مسوّداتٌ تنتظرك — أو لم يُرفع ملفّ */
export function draftsLineAr(drafts: number): string {
  return drafts > 0 ? `${say(drafts, CARD_FORMS, 'واحدة')} من Claude ${drafts === 2 ? 'تنتظرانك' : 'تنتظرك'}` : 'لم ترفع ملف التعديلات بعد'
}
