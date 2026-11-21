/* ═══ اختيارُ الموسم لشعب الموسم الأوّل — سؤالٌ واحدٌ للمدرّب بثلاثة أجوبة (٢١ نوفمبر ٢٠٢٦) ═══

   الموسمُ الأوّل (نوفمبر ٢٠٢٦ – يناير ٢٠٢٧) قلّ فيه المسجَّلون. فقرّر صاحبُ المنصّة أن يصل كلَّ مدرّبٍ له شعبةٌ
   لم تبدأ رسالةٌ واحدة، ويختار من صفحته بضغطةٍ واحدة:
   ١) يؤجّلها إلى **موسم الربيع**: أبريل ومايو ٢٠٢٧؛
   ٢) أو إلى **موسمٍ لاحق**: يوليو وأغسطس، أو أكتوبر ونوفمبر ٢٠٢٧؛
   ٣) أو **يلغيها** — بلا التزامٍ ولا شيءٍ عليه، ويبقى في فريق مدرّبي وجيز.
   **ومن لم يختر حتّى المهلة تُلغى شعبتُه** — قرارُه «b». ولا يُرسل شيءٌ عند النشر: الإدارةُ تعاين ثمّ ترسل.

   ═══ والمواسمُ محسوبةٌ لا مكتوبة ═══

   الثلاثةُ هي الفصولُ الثلاثةُ التي تلي فصلَ الشعبة بالإيقاع الساري (`nextSeason`): شتاءُ ٢٠٢٦/٢٠٢٧ يتلوه ربيعُ
   ٢٠٢٧ ثمّ صيفُه ثمّ خريفُه. فلا يُكتب `apr_may` هنا، ولو تغيّر الإيقاعُ تغيّرت معه.

   ═══ وأين يقع أوّلُ لقاءٍ في الموسم الذي اختاره ═══

   النقلُ القائمُ (`moveShiftMs`) يُبقي موضعَ الشعبة من فصلها: شعبةٌ في الشهر الثالث من شتاءٍ بثلاثة أشهرٍ تقع في
   الشهر الثالث بعد بداية الربيع — وهو يونيو، شهرُ راحةٍ خارجَ موسمٍ بشهرين. فهنا يُزاح أوّلُ لقاءٍ بأقلّ أسابيعَ
   كاملةٍ تبلغ به أوّلَ يومٍ في الموسم بتوقيت عمّان: الأسبوعُ الأوّلُ منه، بيوم الأسبوع والساعة اللذين اختارهما
   المدرّب، وكلُّ مواعيدها تتحرّك معه (`CohortMoveService.applyShift`). فتبدأ كلُّ شعبةٍ في أوّل موسمها ويتّسع لها.

   ═══ ونصُّ الاتّفاقيّة: نُعفيه من التزامات هذه الشعبة، ولا نقول إنّ اتّفاقيّته سقطت ═══

   اختيارُ صاحب المنصّة «A». فالإلغاءُ هنا ليس اعتذارا من المدرّب (البند 6-4): لا استردادَ ولا حسمَ ولا أثرَ على
   ملفّه — ولا شيءَ في المنصّة يطبّق ذلك البندَ آليّا عند الإلغاء أصلا، ويحرسه
   `server/tests/learning/cohort-season-choice.test.ts`.

   بلا React ولا قاعدة. */

import { SEASON_MONTHS, nextSeason, termTitleAr, type SeasonRef } from '../terms/season'
import { TRAINING_SEASONS, TRAINING_SEASON_VALUES, type TrainingSeason } from './application-options'
import { zonedAt, zonedDay } from './cohort-period'
import { countAr } from '../text/count-ar'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** نوعا السؤال في جدول اقتراح التأجيل */
export const OFFER_KINDS = ['next_month', 'season_choice'] as const
export type OfferKind = (typeof OFFER_KINDS)[number]

/** كم موسما يختار منها — الربيعُ وموسمان بعده */
export const SEASON_CHOICE_COUNT = 3

/** المواسمُ التي يختار منها — الثلاثةُ التي تلي فصلَ الشعبة */
export function seasonChoicesAfter(source: SeasonRef, count = SEASON_CHOICE_COUNT): SeasonRef[] {
  const out: SeasonRef[] = []
  let t = source
  for (let i = 0; i < count; i += 1) {
    t = nextSeason(t)
    out.push(t)
  }
  return out
}

export const sameSeason = (a: SeasonRef | null | undefined, b: SeasonRef | null | undefined): boolean =>
  Boolean(a && b && a.year === b.year && a.season === b.season)

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

/** أشهرُ الموسم كما تُقال: «أبريل ومايو 2027» */
export function seasonMonthsAr(t: SeasonRef): string {
  const { start, end } = SEASON_MONTHS[t.season]
  const endYear = end < start ? t.year + 1 : t.year
  return endYear === t.year
    ? `${MONTHS_AR[start - 1]} و${MONTHS_AR[end - 1]} ${t.year}`
    : `${MONTHS_AR[start - 1]} ${t.year} و${MONTHS_AR[end - 1]} ${endYear}`
}

/** اسمُ الخيار: «موسم الربيع — أبريل ومايو 2027» */
export function seasonOptionAr(t: SeasonRef): string {
  const label = TRAINING_SEASONS.find((s) => s.value === t.season)?.label ?? termTitleAr(t.year, t.season)
  return `${label} — ${seasonMonthsAr(t)}`
}

/** أوّلُ لحظةٍ في الموسم — منتصفُ ليل يومه الأوّل بتوقيت عمّان */
export function seasonStartAt(t: SeasonRef): Date {
  const m = SEASON_MONTHS[t.season].start
  return zonedAt(`${t.year}-${String(m).padStart(2, '0')}-01`, '00:00')
}

/** كم أسبوعا كاملا يُزاح أوّلُ لقاءٍ ليقع في الأسبوع الأوّل من الموسم — ولا يُزاح إلى الوراء */
export function weeksIntoSeason(firstAt: Date, t: SeasonRef): number {
  return Math.max(0, Math.ceil((seasonStartAt(t).getTime() - firstAt.getTime()) / WEEK_MS))
}

/** أوّلُ لقاءٍ لو اختار هذا الموسم */
export const firstAtIn = (firstAt: Date, t: SeasonRef): Date => new Date(firstAt.getTime() + weeksIntoSeason(firstAt, t) * WEEK_MS)

/** المهلةُ الافتراضيّة: سبعةُ أيّام — إلى آخر يومها بتوقيت عمّان */
export const SEASON_CHOICE_DEFAULT_DAYS = 7
export function defaultSeasonDeadline(now: Date): Date {
  return zonedAt(zonedDay(new Date(now.getTime() + SEASON_CHOICE_DEFAULT_DAYS * DAY_MS)), '23:59')
}

/** ما اختاره — موسمٌ من قائمته، أو الإلغاء */
export type SeasonPick = { kind: 'season'; year: number; season: TrainingSeason } | { kind: 'cancel' }

const isSeason = (s: unknown): s is TrainingSeason => typeof s === 'string' && (TRAINING_SEASON_VALUES as readonly string[]).includes(s)

/** المواسمُ المحفوظةُ في الصفّ — وما لا يُقرأ منها يُسقط */
export function readChoices(json: unknown): SeasonRef[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((x) => {
    const r = x as { year?: unknown; season?: unknown }
    return typeof r?.year === 'number' && isSeason(r.season) ? [{ year: r.year, season: r.season }] : []
  })
}

/* ═══ النصوص — ما يقرؤه المدرّبُ والمتعلّمون والإدارة ═══ */

/** السببُ الذي يُحفظ مع السؤال، ويقرؤه المتعلّمون إن تأجّلت شعبتُهم */
export const SEASON_CHOICE_REASON_AR = 'لم يكتمل عدد المسجلين فيها هذا الموسم'

/** سببُ الإلغاء حين يختاره — يصل المدرّبَ وسجلَّ الشعبة */
export const SEASON_CANCEL_REASON_AR = 'اختار المدرب إلغاءها بعد موسم لم يكتمل فيه عدد المسجلين، ولا يترتب عليه شيء عنها'

/** وسببُه حين تمضي المهلةُ بلا اختيار */
export const SEASON_EXPIRED_REASON_AR = 'لم يختر المدرب لها موسما قبل المهلة، فألغيت كما ذكرنا في رسالتنا، ولا يترتب عليه شيء عنها'

/** لا التزامَ عليه — في الرسالة وفي البطاقة */
export const NO_OBLIGATION_AR = 'لا يترتب عليك أي التزام عن هذه الشعبة، ولا شيء عليك إن اخترت الإلغاء.'

/** ما يقع إن لم يختر — قاعدةُ صاحب المنصّة: تُقال العاقبة */
export const DEFAULT_CANCEL_AR = 'وإن لم تختر حتى هذا التاريخ تلغى الشعبة.'

/** الخيارُ الثالث — وما يبقى له بعده */
export const CANCEL_OPTION_AR = 'ألغها — وتبقى في فريق مدربي وجيز، وتفتح شعبة متى أردت.'

/** حالُ السؤال في شاشة الإدارة — بكلماتها لا بكلمات التأجيل إلى الشهر التالي */
export const SEASON_CHOICE_STATUS_AR = {
  pending: 'ينتظر اختيار المدرب',
  accepted: 'اختار موسما',
  declined: 'اختار الإلغاء',
  expired: 'لم يختر — ألغيت',
  withdrawn: 'سحبنا السؤال',
} as const

/* ═══ ما يُقال قبل الضغطة — في الشاشتين ═══
   قاعدةُ صاحب المنصّة: لا فعلَ بلا أن يُقال أثرُه. فزرُّ الإدارة يُسأل بجملةٍ تقول من يصله وما يقع بالسكوت، وكلُّ خيارٍ
   للمدرّب يُسأل بجملةٍ تقول ما يقع بشعبته ومتعلّميها. والتاريخُ يُمرَّر مكتوبا: الشاشةُ تكتبه بتنسيقها. */

/** تأكيدُ الإرسال في شاشة الإدارة */
export function seasonSendConfirmAr(trainers: number, cohorts: number, deadlineAr: string): string {
  return `يصل البريد والجرس الآن إلى ${countAr(trainers, TRAINERS)} — رسالة واحدة لكل مدرب عن ${countAr(cohorts, COHORTS)}. `
    + `ومن لم يختر حتى ${deadlineAr} تلغى شعبته تلقائيا. متأكد؟`
}
export const TRAINERS = { one: 'مدرب', two: 'مدربين', few: 'مدربين', many: 'مدربا' }
export const COHORTS = { one: 'شعبة', two: 'شعبتين', few: 'شعب', many: 'شعبة' }

/** ما يقع بكلّ خيار — في شاشة الإدارة قبل الزرّ */
export const SEASON_OUTCOMES_AR = {
  season: 'تتحرك كل مواعيد الشعبة إلى أول أسبوع في ذلك الموسم، بنفس اليوم والساعة، وتربط بفصله، ويصل متعلميها الموعد الجديد.',
  cancel: 'تلغى الشعبة الآن بلا أي التزام على المدرب، ويبقى في فريق المدربين، ويصل متعلميها الخبر.',
  silence: 'تلغى الشعبة تلقائيا، ويصل متعلميها ومدربها الخبر.',
} as const

/** تأكيدُ اختيار المدرّب — ما يقع بشعبته */
export function seasonPickConsequenceAr(pick: { kind: 'season'; optionAr: string; firstAtAr: string | null } | { kind: 'cancel' }): string {
  if (pick.kind === 'cancel') return 'تلغى الشعبة الآن ولا تعقد لقاءاتها، ويصل متعلميها الخبر. ولا شيء عليك.'
  return `تتحرك الشعبة إلى ${pick.optionAr}${pick.firstAtAr ? `، وأول لقاء فيها ${pick.firstAtAr}` : ''}، ويصل متعلميها الموعد الجديد.`
}
