/* ═══ رسالةُ «موعدٌ مقترحٌ بلا تعارض» — السببُ والحلّ وما بعده (٢٢ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «نبلغهم بالسبب والحلّ والإجراء التالي… ويجب أن يصلهم بالإيميل ويصلهم بالمنصّة
   كإشعار ويروه في خطّتهم للتعديل بالموافقة أو الرفض، وإذا رفض الموعدَ يبلغنا لماذا». فثلاثةُ أسطرٍ في
   البريد بهذا الترتيب، وجرسٌ قصيرٌ يفتح «المراجعة» حيث البطاقة. والسببُ حالاتٌ حقيقيّةٌ وصلتنا على واتساب.

   ونصٌّ يصل إنسانا: قصيرٌ بلغةٍ بيضاء، بلا تشكيلٍ إعرابيّ، ولا «عرضك»، والزرُّ يدلّ ولا يأمر. */

export interface ClashMessageInput {
  cohortTitle: string
  courseTitleAr: string
  /** «الأحد 19:00» */
  fromAr: string
  /** «الثلاثاء 19:00» */
  toAr: string
}

import { WEEKDAYS_AR } from '../calendar/month-grid'

export const CLASH_TEMPLATE_KEY = 'cohort.schedule.proposed'

export const clashBellTitleAr = (m: ClashMessageInput) => `موعد مقترح لشعبتك «${m.cohortTitle}»`

export const clashBellBodyAr = (m: ClashMessageInput) =>
  `نقترح ${m.toAr} كل أسبوع بدل ${m.fromAr}، حتى لا تتعارض مع دورة قريبة منها. اقبله أو ارفضه من «المراجعة».`

export function clashMailAr(m: ClashMessageInput) {
  return {
    subject: `موعد مقترح لشعبتك «${m.cohortTitle}»`,
    heading: 'رتبنا مواعيد الفصل حتى لا تتعارض الدورات',
    reasonAr: 'وصلتنا رسائل من طلبة أرادوا التسجيل في دورتين معا، ولم يستطيعوا لأن موعديهما متعارضان. فيأخذ الطالب دورة واحدة، وتخسر الدورة الأخرى طالبا.',
    solutionAr: 'لذلك رتبنا مواعيد دورات الفصل كلها معا، حتى لا تتعارض الدورات التي قد يأخذها الطالب نفسه. وحاولنا أن نغير أقل ما يمكن.',
    facts: [
      { label: 'الشعبة', value: m.cohortTitle },
      { label: 'الموعد الآن', value: `${m.fromAr} كل أسبوع` },
      { label: 'الموعد المقترح', value: `${m.toAr} كل أسبوع` },
    ],
    nextAr: 'افتح الاقتراح، ثم اقبله أو ارفضه. إن قبلته تنتقل لقاءاتك ومواعيد مهامها معا. وإن لم يناسبك فارفضه واكتب لنا السبب، ونقترح عليك موعدا آخر.',
    ctaAr: 'افتح الاقتراح',
  }
}

/* ═══ وما يصل المتعلّمين حين يقبل مدرّبُهم الجدول — رسالةٌ واحدة (٢٤ أكتوبر ٢٠٢٦) ═══
   كان لكلّ لقاءٍ يُنقل جرسٌ وبريد. فصارت رسالةً تقول اليومَ والساعةَ الجديدين وأوّلَ لقاءٍ بهما، وأنّ رابطَ الانضمام
   كما هو. وما رجع منها إلى مراجعة الإدارة يُقال — فلا ينتظر أحدٌ موعدا لم يُعتمد بعد. */
export function scheduleMovedBodyAr(input: { weekday: number; clock: string; days?: readonly number[]; firstAtAr: string | null; pending: number }): string {
  /* وشعبةٌ تلتقي أكثرَ من مرّةٍ في الأسبوع تُذكر أيّامُها كلُّها — لا أوّلُها وحدَه (٢٧ أكتوبر ٢٠٢٦) */
  const days = (input.days?.length ? input.days : [input.weekday]).map((d) => WEEKDAYS_AR[d] ?? '')
  const when = `${days.length === 1 ? days[0] : `${days.slice(0, -1).join('، ')} و${days[days.length - 1]}`} ${input.clock}`.trim()
  const first = input.firstAtAr ? ` وأول لقاء بموعده الجديد ${input.firstAtAr}.` : '.'
  const pending = input.pending === 0 ? ''
    : input.pending === 1 ? ' ولقاء واحد منها يراجع عند الإدارة، ويصلك موعده حين يعتمد.'
    : ' وبعضها يراجع عند الإدارة، ويصلك موعدها حين يعتمد.'
  return `صارت لقاءات شعبتك ${when} كل أسبوع${first} ورابط الانضمام نفسه.${pending}`
}
