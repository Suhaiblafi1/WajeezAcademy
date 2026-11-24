/* ═══ رسالةُ اختيار الموسم — قصيرةٌ، بنصٍّ يكتبه صاحبُ المنصّة، وخياران (٢٤ نوفمبر ٢٠٢٦) ═══

   كانت (٢١ نوفمبر) دروسا وخطّةً وثلاثةَ خيارات، فقرأها صاحبُ المنصّة فقال: «كانت مبعثرة.. خيارين بسيطين»، و«اسمح لي
   أن أعدّلها قبل إرسالها». فصارت قسمين:
   · **ما يكتبه هو** — العنوانُ وفقراتُ أوّل الرسالة، يبدآن بنصٍّ افتراضيٍّ في صندوق الإدارة (`SEASON_CHOICE_DEFAULT_*`)
     ويغيّرهما قبل الإرسال. والدروسُ والخطّةُ خرجت منها إلى رسالةٍ عامّةٍ يرسلها هو.
   · **ما يُضاف وحدَه** ولا يُكتب باليد، لأنّه يختلف لكلّ مدرّبٍ أو يقوم عليه الفعل: شعبُه بأوّل لقاءٍ لكلٍّ منها، والخياران
     من المواسم المحسوبة (`seasonChoicesAfter`)، ولا التزامَ عليه، والمهلةُ وعاقبةُ السكوت (الإلغاء، «B»)، وزرُّ صفحته.

   ونصُّ الاتّفاقيّة («A»: نُعفيه من التزامات هذه الشعبة، ولا نقول إنّ اتّفاقيّته سقطت) في النصّ الافتراضيّ، يُبقيه أو يحذفه. */

import type { MailBlock, MailDoc } from './mail-template'
import type { SeasonRef } from '../../src/application/terms/season'
import {
  CANCEL_OPTION_AR, DEFAULT_CANCEL_AR, NO_OBLIGATION_AR, SEASON_CHOICE_DEFAULT_INTRO_AR, SEASON_CHOICE_DEFAULT_SUBJECT_AR,
  seasonMonthsAr, seasonOptionAr,
} from '../../src/application/trainer/season-choice'
import { messageParagraphs } from '../../src/application/commerce/grant-registrants'

/** «يوليو وأغسطس، أو أكتوبر ونوفمبر 2027» — والسنةُ مرّةً في آخرها إن كانت واحدة */
function laterMonthsAr(later: readonly SeasonRef[]): string {
  const sameYear = later.every((t) => t.year === later[0].year && !seasonMonthsAr(t).includes(String(t.year + 1)))
  if (!sameYear) return later.map(seasonMonthsAr).join('، أو ')
  const bare = later.map((t) => seasonMonthsAr(t).replace(` ${t.year}`, ''))
  return `${bare.join('، أو ')} ${later[0].year}`
}

/** الخياراتُ كما تُقرأ في الرسالة — موسمٌ بعينه، وما بعده إن كان (صفوفٌ قديمةٌ بثلاثة)، والإلغاءُ آخرَها */
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
  /** ما كتبه صاحبُ المنصّة — وبلاه النصُّ الافتراضيّ */
  subject?: string | null
  introAr?: string | null
}

export function seasonChoiceMail(m: SeasonChoiceMailInput): { subject: string; doc: MailDoc } {
  const many = m.cohorts.length > 1
  const subject = m.subject?.trim() || SEASON_CHOICE_DEFAULT_SUBJECT_AR
  const intro = messageParagraphs(m.introAr?.trim() ? m.introAr : SEASON_CHOICE_DEFAULT_INTRO_AR)
  const options = seasonChoiceOptionsAr(m.choices)
  const blocks: MailBlock[] = [
    ...intro.map((text): MailBlock => ({ kind: 'p', text })),
    { kind: 'h', text: many ? 'شعبك' : 'شعبتك' },
    { kind: 'list', numbered: many, items: m.cohorts.map((c) => `${c.title}${c.firstAtAr ? ` — أول لقاء ${c.firstAtAr}` : ''}`) },
    { kind: 'p', text: many ? 'اختر لكل شعبة واحدا من اثنين:' : 'اختر واحدا من اثنين:' },
    { kind: 'list', items: options, numbered: true },
    { kind: 'p', text: many ? 'لا يترتب عليك أي التزام عن هذه الشعب، ولا شيء عليك إن اخترت الإلغاء.' : NO_OBLIGATION_AR },
    { kind: 'callout', text: `اختر من صفحتك قبل ${m.deadlineAr}. ${many ? 'وإن لم تختر لشعبة حتى هذا التاريخ تلغى.' : DEFAULT_CANCEL_AR}` },
    { kind: 'cta', label: many ? 'افتح شعبك' : 'افتح شعبتك', href: m.href },
    { kind: 'p', text: 'فريق أكاديمية وجيز' },
  ]
  return {
    subject,
    doc: {
      greetingName: m.name,
      preheader: `اختر قبل ${m.deadlineAr}: ${m.choices[0] ? `أجلها إلى ${seasonOptionAr(m.choices[0]).split(' — ')[0]}، أو ` : ''}ألغها.`,
      heading: subject,
      blocks,
    },
  }
}
