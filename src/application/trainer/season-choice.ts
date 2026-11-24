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

/* ═══ خياران: الإلغاءُ أو الإعادةُ في المواسم القادمة، والسكوتُ لا يغيّر شيئا (٢٤ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة بعد أن قرأ الرسالةَ الأولى: «كانت مبعثرة.. خيارين بسيطين ليسهل عليهم اتّخاذُ القرار». ثمّ كتب نصَّ
   «رسالة الاختيار» بنفسه، فهي اليومَ نصُّه مرتّبا (`season-choice-mail.ts`)، ومنه:
   · **الخياران**: «إلغاء الشعبة (نوصي به)» أوّلا، ثمّ **«إعادة إطلاقها في المواسم القادمة»** — لا الربيعُ وحدَه: «لا
     تعطهم خيارَ الربيع فقط، وإنّما للفصول القادمة، وهو يختار لاحقا، لأنّه سيكون له دورةٌ واحدةٌ أو اثنتان بحدٍّ أعلى في كلّ
     فصل، ولا تكرارَ للدورات مع مدرّبين آخرين». فلا موسمَ يُختار الآن (`SEASON_CHOICE_COUNT = 0`)، والشعبةُ تخرج من هذا
     الموسم بالخيارين معا — والفرقُ أنّ الإعادةَ تُبقي دورتَه في قائمة المواسم القادمة ونتواصل معه لاختيار موسمها.
   · **والسكوتُ**: «إن لم يصلنا ردُّك قبل [التاريخ] فسنتواصل معك لنتأكّد من رغبتك، ولن نغيّر شيئا دون موافقتك» — نسخا لـ«b»
     (تُلغى بالسكوت). فالعاملُ عند المهلة لا يلغي: يُعلّم السؤالَ «لم يرد» ويُجرِس الإدارةَ لتتواصل معه (`expireDue`).
   · **والردُّ بكلمة**: «إلغاء» أو «إعادة» بالردّ على البريد، أو من صفحته — والردُّ يصل الدعم.
   وما سُئل بمواسمَ بعينها قبل هذا يبقى بخياراته المحفوظة في صفّه (`readChoices`)، ويُختار منها كما كان. */

/** كم موسما بعينه يُعرض للاختيار الآن — لا شيء: يختار موسمَه لاحقا */
export const SEASON_CHOICE_COUNT = 0

/** الخيارُ الأوّل في الرسالة والبطاقة — ونقاطُه كما كتبها صاحبُ المنصّة */
export const SEASON_CANCEL_TITLE_AR = 'إلغاء الشعبة (نوصي به)'
export const SEASON_CANCEL_POINTS_AR = [
  'لا يترتب عليك أي التزام.',
  'تبقى حقوقك محفوظة كاملة.',
  'نتواصل معك لاحقا لنقرر معا متى وكيف تعود دورتك.',
  'ميزته أن ما تقدمه بعد ذلك يكون بالصيغة الجديدة: تقديمك أولا بفيديو قصير، وموعد ثابت تختاره، ووصف يوضح ما سيتقنه الطالب.',
] as const

/** الخيارُ الثاني: «إعادة إطلاقها في المواسم القادمة» — وفي الرسالة أوّلُها محسوبا: «(أولها الربيع من 1 أبريل 2027)» */
export function seasonRelaunchTitleAr(next?: SeasonRef | null): string {
  if (!next) return 'إعادة إطلاقها في المواسم القادمة'
  const label = (TRAINING_SEASONS.find((s) => s.value === next.season)?.label ?? termTitleAr(next.year, next.season)).replace(/^موسم /, '')
  return `إعادة إطلاقها في المواسم القادمة (أولها ${label} من 1 ${MONTHS_AR[SEASON_MONTHS[next.season].start - 1]} ${next.year})`
}

/** ونقاطُه — يختار موسمَه لاحقا، ودورةٌ أو اثنتان لكلّ مدرّبٍ في الموسم، ولا تتكرّر الدورةُ مع مدرّبٍ آخر */
export const SEASON_RELAUNCH_POINTS_AR = [
  'تبقى دورتك ضمن قائمة دوراتنا للمواسم القادمة.',
  'تختار لاحقا الموسم الذي يناسبك، وموعدها من المواعيد الثابتة التي سنرسلها لك.',
  'لكل مدرب دورة أو دورتان في كل موسم، ولا تتكرر الدورة نفسها مع مدرب آخر.',
  'نطلب منك تسجيل فيديو أو بودكاست قصير، ونراجع معك وصف الدورة.',
] as const

/** سببُ خروج الشعبة حين يختار الإعادة — يصل المدرّبَ وسجلَّ الشعبة */
export const SEASON_RELAUNCH_REASON_AR = 'اختار المدرب إعادة إطلاقها في موسم قادم يختاره لاحقا، ولا يترتب عليه شيء عنها'

/** ما يقع إن لم يرد — «ولن نغيّر شيئا دون موافقتك» */
export const SEASON_SILENCE_AR = 'وإن لم يصلنا ردك قبل هذا التاريخ نتواصل معك لنتأكد من رغبتك، ولن نغير شيئا دون موافقتك.'

/** ولطلّابه — يُقال لمن في شعبته مسجَّلون */
export const SEASON_LEARNERS_AR = 'سنعيد رسوم المسجلين في هذه الشعبة كاملة، ونعتذر لهم بالنيابة عنك. وسنعرفهم عليك ونرشح لهم دوراتك الأخرى، لعلهم ينضمون إليها. لا شيء من هذا يؤثر عليك.'

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

/** المهلةُ الافتراضيّة: يومان — إلى آخر يومها بتوقيت عمّان. قرارُ صاحب المنصّة (٢٤ نوفمبر ٢٠٢٦): «اجعل المهلةَ يومين فقط»،
    وكانت سبعة. وتُغيَّر في الصندوق قبل الإرسال */
export const SEASON_CHOICE_DEFAULT_DAYS = 2
export function defaultSeasonDeadline(now: Date): Date {
  return zonedAt(zonedDay(new Date(now.getTime() + SEASON_CHOICE_DEFAULT_DAYS * DAY_MS)), '23:59')
}

/** ما اختاره — موسمٌ من قائمته، أو الإلغاء */
export type SeasonPick = { kind: 'season'; year: number; season: TrainingSeason } | { kind: 'cancel' } | { kind: 'later' }

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

/** لا التزامَ عليه — في الرسالة وفي البطاقة */
export const NO_OBLIGATION_AR = 'لا يترتب عليك أي التزام عن هذه الشعبة، ولا شيء عليك إن اخترت الإلغاء.'

/** الإلغاءُ في أسئلةٍ أُرسلت بثلاثة قبل الخيارين — وما يبقى له بعده */
export const CANCEL_OPTION_AR = 'ألغها — وتبقى في فريق مدربي وجيز، وتفتح شعبة متى أردت.'

/** حالُ السؤال في شاشة الإدارة — بكلماتها لا بكلمات التأجيل إلى الشهر التالي */
export const SEASON_CHOICE_STATUS_AR = {
  pending: 'ينتظر اختيار المدرب',
  accepted: 'اختار إعادة إطلاقها',
  declined: 'اختار الإلغاء',
  expired: 'لم يرد — تواصل معه',
  withdrawn: 'سحبنا السؤال',
} as const

/* ═══ ما يُقال قبل الضغطة — في الشاشتين ═══
   قاعدةُ صاحب المنصّة: لا فعلَ بلا أن يُقال أثرُه. فزرُّ الإدارة يُسأل بجملةٍ تقول من يصله وما يقع بالسكوت، وكلُّ خيارٍ
   للمدرّب يُسأل بجملةٍ تقول ما يقع بشعبته ومتعلّميها. والتاريخُ يُمرَّر مكتوبا: الشاشةُ تكتبه بتنسيقها. */

/** تأكيدُ الإرسال في شاشة الإدارة */
export function seasonSendConfirmAr(trainers: number, cohorts: number, deadlineAr: string): string {
  return `يصل البريد والجرس الآن إلى ${countAr(trainers, TRAINERS)} — رسالة واحدة لكل مدرب عن ${countAr(cohorts, COHORTS)}. `
    + `ومن لم يرد حتى ${deadlineAr} لا يتغير شيء في شعبته، ويصلكم جرس لتتواصلوا معه. متأكد؟`
}
export const TRAINERS = { one: 'مدرب', two: 'مدربين', few: 'مدربين', many: 'مدربا' }
export const COHORTS = { one: 'شعبة', two: 'شعبتين', few: 'شعب', many: 'شعبة' }

/** ما يقع بكلّ خيار — في شاشة الإدارة قبل الزرّ */
export const SEASON_OUTCOMES_AR = {
  cancel: 'تلغى الشعبة الآن بلا أي التزام على المدرب، ويبقى في فريق المدربين، ويصل متعلميها الخبر.',
  later: 'تخرج الشعبة من هذا الموسم ويصل متعلميها الخبر، وتبقى الدورة في قائمة المواسم القادمة. يصلكم جرس لتتواصلوا معه وتختاروا موسمها.',
  silence: 'لا يتغير شيء في الشعبة. يصلكم جرس لتتواصلوا معه وتسألوه عن رغبته.',
} as const

/** تأكيدُ اختيار المدرّب — ما يقع بشعبته */
export function seasonPickConsequenceAr(
  pick: { kind: 'season'; optionAr: string; firstAtAr: string | null } | { kind: 'cancel' } | { kind: 'later' },
): string {
  if (pick.kind === 'cancel') return 'تلغى الشعبة الآن ولا تعقد لقاءاتها، ويصل متعلميها الخبر. ولا شيء عليك.'
  if (pick.kind === 'later') return 'تخرج الشعبة من هذا الموسم ولا تعقد لقاءاتها، ويصل متعلميها الخبر. وتبقى دورتك في قائمتنا، ونتواصل معك لتختار موسمها.'
  return `تتحرك الشعبة إلى ${pick.optionAr}${pick.firstAtAr ? `، وأول لقاء فيها ${pick.firstAtAr}` : ''}، ويصل متعلميها الموعد الجديد.`
}
