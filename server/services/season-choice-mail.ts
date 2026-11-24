/* ═══ رسالةُ الاختيار — نصُّ صاحب المنصّة مرتّبا لكلّ مدرّبٍ بشعبه (٢٤ نوفمبر ٢٠٢٦) ═══

   كتب صاحبُ المنصّة «رسالة الاختيار (مكمّلة للرسالة الأولى)» بنفسه، وطلب: «رتّبها بما يناسب برمجةَ الرسالة وكيف سيرى كلُّ
   واحدٍ الرسالةَ مخصّصةً له ولدوراته». فهي نصُّه، وما بين قوسيه يُملأ لكلّ مدرّب:
   · **[اسم الدورة]** في العنوان والفقرة الأولى — وصاحبُ الشعب العدّة: «شعبك» وقائمتُها، و«اختر لكل شعبة».
   · **الخياران** بنقاطهما (`SEASON_CANCEL_*` و`SEASON_RELAUNCH_*`) — والثاني «في المواسم القادمة» يختار موسمَه لاحقا،
     وأوّلُها وتاريخُه من الموسم المحسوب.
   · **«بالنسبة لطلابك»** لا يُقال إلّا لمن في شعبه مسجَّلون، ويسمّي شعبَهم إن كانت له شعبٌ عدّة.
   · **[التاريخ]** المهلة، و**[الرابط]** صفحةُ شعبه، و**[وسيلة التواصل]** بريدُ الدعم.
   · **والاختيارُ من المنصّة وحدَها** — قرارُه (٢٤ نوفمبر ٢٠٢٦): «لا تجعله يرسل ردّا مكتوبا، وإنّما فقط من المنصّة». فلا «أرسل
     لنا كلمة واحدة»، بل «كيف تختار» وزرُّ صفحته.
   والتحيّةُ «السلام عليكم ورحمة الله،» كما كتبها، بلا الاسم: الاسمُ في سطرٍ قبلها. وبلا تشكيلٍ إعرابيّ (قرارُ ١١ أكتوبر).

   والدروسُ والخطّةُ في «الرسالة الأولى» العامّة التي يرسلها هو؛ وهذه تكمّلها. */

import type { MailBlock, MailDoc } from './mail-template'
import type { SeasonRef } from '../../src/application/terms/season'
import {
  SEASON_CANCEL_POINTS_AR, SEASON_CANCEL_TITLE_AR, SEASON_LEARNERS_AR, SEASON_RELAUNCH_POINTS_AR, SEASON_SILENCE_AR,
  seasonRelaunchTitleAr,
} from '../../src/application/trainer/season-choice'

export interface SeasonChoiceMailInput {
  name: string
  /** شعبُه التي يُسأل عنها — وأوّلُ لقاءٍ لكلٍّ منها إن كان، وكم مسجَّلا فيها */
  cohorts: readonly { title: string; firstAtAr: string | null; enrolled: number }[]
  /** أوّلُ المواسم القادمة — يُذكر في عنوان الخيار الثاني */
  next: SeasonRef | null
  deadlineAr: string
  /** صفحةُ شعبه في البوّابة — [الرابط] */
  href: string
  /** [وسيلة التواصل] — بريدُ الدعم */
  supportEmail: string
}

const quoted = (t: string) => `«${t}»`

export function seasonChoiceMail(m: SeasonChoiceMailInput): { subject: string; doc: MailDoc } {
  const many = m.cohorts.length > 1
  const titles = m.cohorts.map((c) => c.title)
  const subject = many ? `قرارك بشأن شعبك: ${titles.join('، ')}` : `قرارك بشأن شعبتك: ${titles[0] ?? ''}`
  const withLearners = m.cohorts.filter((c) => c.enrolled > 0)
  const blocks: MailBlock[] = [
    { kind: 'p', text: 'السلام عليكم ورحمة الله،' },
    many
      ? { kind: 'p', text: 'هذه الرسالة تكمل رسالتنا السابقة، وهي خاصة بك لأن شعبك هذه لم يكتمل عدد المسجلين فيها هذا الموسم:' }
      : { kind: 'p', text: `هذه الرسالة تكمل رسالتنا السابقة، وهي خاصة بك لأن شعبتك ${quoted(titles[0] ?? '')} لم يكتمل عدد المسجلين فيها هذا الموسم. نشكرك على وقتك وجهدك فيها، فقد كان حضورك مقدّرا عندنا.` },
  ]
  if (many) {
    blocks.push(
      { kind: 'list', items: m.cohorts.map((c) => `${c.title}${c.firstAtAr ? ` — أول لقاء ${c.firstAtAr}` : ''}`) },
      { kind: 'p', text: 'نشكرك على وقتك وجهدك فيها، فقد كان حضورك مقدّرا عندنا.' },
    )
  }
  blocks.push(
    { kind: 'h', text: 'ما نحتاجه منك' },
    { kind: 'p', text: many ? 'اختر لكل شعبة أحد الخيارين:' : 'اختر أحد الخيارين:' },
    { kind: 'h', text: `1. ${SEASON_CANCEL_TITLE_AR}` },
    { kind: 'list', items: [...SEASON_CANCEL_POINTS_AR] },
  )
  blocks.push(
    { kind: 'h', text: `2. ${seasonRelaunchTitleAr(m.next)}` },
    { kind: 'list', items: [...SEASON_RELAUNCH_POINTS_AR] },
  )
  if (withLearners.length) {
    blocks.push(
      { kind: 'h', text: 'بالنسبة لطلابك' },
      { kind: 'p', text: many
        ? `في ${withLearners.length === 1 ? 'شعبة' : 'شعب'} ${withLearners.map((c) => quoted(c.title)).join(' و')} مسجلون. ${SEASON_LEARNERS_AR.replace('في هذه الشعبة', 'فيها')}`
        : SEASON_LEARNERS_AR },
    )
  }
  blocks.push(
    { kind: 'h', text: 'كيف تختار' },
    { kind: 'p', text: many ? `اختر لكل شعبة من صفحتك في المنصة قبل ${m.deadlineAr}.` : `اختر من صفحتك في المنصة قبل ${m.deadlineAr}.` },
    { kind: 'cta', label: many ? 'اختر لشعبك' : 'اختر لشعبتك', href: m.href },
    { kind: 'callout', text: SEASON_SILENCE_AR.replace('قبل هذا التاريخ', `قبل ${m.deadlineAr}`) },
    { kind: 'p', text: `وإن كان عندك أي سؤال أو ملاحظة، فنحن في خدمتك على ${m.supportEmail}.` },
    { kind: 'p', text: 'نعتز بك، ونتطلع لموسم أقوى معا.' },
    { kind: 'p', text: 'فريق أكاديمية وجيز' },
  )
  return {
    subject,
    doc: {
      greetingName: m.name,
      preheader: `قبل ${m.deadlineAr}: ألغها، أو أعد إطلاقها في المواسم القادمة.`,
      heading: subject,
      blocks,
    },
  }
}
