/* ═══ رسالةُ اختيار الموسم — «ما تعلمناه من موسمنا الأول، وما سنطلقه معك» (٢١ نوفمبر ٢٠٢٦) ═══

   نصُّها نصُّ صاحب المنصّة كما كتبه، في كتل القالب (`mail-template.ts`): فقرةٌ، وقائمتان، والخياراتُ الثلاثة،
   وتنبيهٌ بالمهلة وما يقع بعدها، وزرٌّ «افتح شعبتك» يدلّ ولا يأمر. وما تغيّر عن نصّه شيئان:
   · مدرّبٌ له شعبٌ عدّة تصله رسالةٌ واحدةٌ تعدّها كلَّها — «ومنها شعبك هذه» بدل «ومنها شعبة …»، والزرُّ «افتح شعبك».
   · وسطرُ الإلغاء التلقائيّ مكتوبٌ صريحا قبل الزرّ: قاعدتُه أن تُقال العاقبة («b»).
   والخياراتُ تُسمّى من المواسم المحسوبة (`seasonChoicesAfter`)، لا من نصٍّ ثابت.

   ونصُّ الاتّفاقيّة اختيارُه «A»: نُعفيه من التزامات هذه الشعبة، ولا نقول إنّ اتّفاقيّته سقطت. */

import type { MailBlock, MailDoc } from './mail-template'
import type { SeasonRef } from '../../src/application/terms/season'
import { CANCEL_OPTION_AR, DEFAULT_CANCEL_AR, NO_OBLIGATION_AR, seasonMonthsAr, seasonOptionAr } from '../../src/application/trainer/season-choice'

export const SEASON_CHOICE_SUBJECT_AR = 'ما تعلمناه من موسمنا الأول، وما سنطلقه معك'

export const SEASON_CHOICE_LESSONS_AR = [
  'الطالب يختار المدرب قبل الدورة. يريد أن يراك ويسمعك قبل أن يسجل.',
  'المواعيد المتغيرة تربك الطالب. يريد جدولا ثابتا يعرفه من البداية.',
  'الوصف العام لا يقنع. يريد أن يعرف بدقة ماذا سيستطيع أن يفعل في نهاية الدورة.',
] as const

export const SEASON_CHOICE_PLANS_AR = [
  'مواعيد ثابتة (ديسمبر): جدول للأكاديمية تختار منه: سبت واثنين وأربعاء، أو أحد وثلاثاء وخميس، صباحا أو مساء، والجلسة 3 ساعات.',
  'مخرجات واضحة لكل دورة (ديسمبر ويناير): نكتب معك ما سيخرج به الطالب بالضبط، بدل الشرح العام.',
  'حتى 3 دورات لكل مدرب: تختارها من أقوى ما تقدمه.',
  'فيديو تعريفي لك ولكل دورة (يناير): نجهزه معك.',
  'لقاءات مجانية قصيرة (يناير وفبراير): يتعرف فيها الطلاب عليك قبل التسجيل.',
  'خدمات جديدة: دورات مصغرة لمهارة واحدة في 4 ساعات، ومسارات، وجلسات كوتشنج فردية. ويمكنك التقدم لأي منها.',
  'موسم الربيع من 1 أبريل إلى 31 مايو 2027: بعد رمضان والعيد، ونبدأ تسويقه من يناير.',
] as const

export const SEASON_CHOICE_AGREEMENT_AR =
  'واتفاقيتك معنا: قد نغير بعض الأمور للموسم القادم، مثل الأسعار والمواعيد، فنضيفها ملحقا لاتفاقيتك. ونرسله لك في يناير لتوقعه إن رغبت في الاستمرار معنا.'

/** «يوليو وأغسطس، أو أكتوبر ونوفمبر 2027» — والسنةُ مرّةً في آخرها إن كانت واحدة */
function laterMonthsAr(later: readonly SeasonRef[]): string {
  const sameYear = later.every((t) => t.year === later[0].year && !seasonMonthsAr(t).includes(String(t.year + 1)))
  if (!sameYear) return later.map(seasonMonthsAr).join('، أو ')
  const bare = later.map((t) => seasonMonthsAr(t).replace(` ${t.year}`, ''))
  return `${bare.join('، أو ')} ${later[0].year}`
}

/** الخياراتُ الثلاثة كما تُقرأ في الرسالة — الأوّلُ موسمٌ بعينه، والثاني ما بعده، والثالثُ الإلغاء */
export function seasonChoiceOptionsAr(choices: readonly SeasonRef[]): string[] {
  const [first, ...later] = choices
  const out: string[] = []
  if (first) out.push(`أجلها إلى ${seasonOptionAr(first)}.`)
  if (later.length) out.push(`أجلها إلى موسم لاحق — ${laterMonthsAr(later)}.`)
  out.push(CANCEL_OPTION_AR)
  return out
}

export interface SeasonChoiceMailInput {
  name: string
  /** شعبُه التي يُسأل عنها — وأوّلُ لقاءٍ لكلٍّ منها إن كان */
  cohorts: readonly { title: string; firstAtAr: string | null }[]
  choices: readonly SeasonRef[]
  deadlineAr: string
  /** صفحةُ شعبه في البوّابة */
  href: string
}

export function seasonChoiceMail(m: SeasonChoiceMailInput): { subject: string; doc: MailDoc } {
  const many = m.cohorts.length > 1
  const blocks: MailBlock[] = [
    { kind: 'p', text: 'شكرا لك. موسمنا الأول معك أعطانا دروسا واضحة، وبنينا عليها خطة الموسم القادم.' },
    { kind: 'h', text: 'ما تعلمناه' },
    { kind: 'list', items: [...SEASON_CHOICE_LESSONS_AR], numbered: true },
    { kind: 'h', text: 'ما سنطبقه، ومتى' },
    { kind: 'list', items: [...SEASON_CHOICE_PLANS_AR] },
    { kind: 'h', text: many ? 'شعبك الآن' : 'شعبتك الآن' },
  ]
  if (many) {
    blocks.push(
      { kind: 'p', text: 'بعض الشعب لم يكتمل عدد المسجلين فيها هذا الموسم، ومنها شعبك هذه:' },
      { kind: 'list', numbered: true, items: m.cohorts.map((c) => `${c.title}${c.firstAtAr ? ` — أول لقاء ${c.firstAtAr}` : ''}`) },
      { kind: 'p', text: 'اختر لكل شعبة ما يناسبك:' },
    )
  } else {
    blocks.push({ kind: 'p', text: `بعض الشعب لم يكتمل عدد المسجلين فيها هذا الموسم، ومنها شعبة «${m.cohorts[0]?.title ?? ''}». اختر ما يناسبك:` })
  }
  blocks.push(
    { kind: 'list', items: seasonChoiceOptionsAr(m.choices), numbered: true },
    { kind: 'p', text: many
      ? 'لا يترتب عليك أي التزام عن هذه الشعب، ولا شيء عليك إن اخترت الإلغاء.'
      : NO_OBLIGATION_AR },
    { kind: 'p', text: SEASON_CHOICE_AGREEMENT_AR },
    { kind: 'callout', text: `اختر من صفحتك قبل ${m.deadlineAr}. ${many ? 'وإن لم تختر لشعبة حتى هذا التاريخ تلغى.' : DEFAULT_CANCEL_AR}` },
    { kind: 'cta', label: many ? 'افتح شعبك' : 'افتح شعبتك', href: m.href },
    { kind: 'p', text: 'نعتز بك، ونتطلع لموسم أقوى معا.' },
    { kind: 'p', text: 'فريق أكاديمية وجيز' },
  )
  return {
    subject: SEASON_CHOICE_SUBJECT_AR,
    doc: {
      greetingName: m.name,
      preheader: `اختر لشعبتك قبل ${m.deadlineAr}: أجلها إلى الربيع، أو إلى موسم لاحق، أو ألغها.`,
      heading: SEASON_CHOICE_SUBJECT_AR,
      blocks,
    },
  }
}
