/* ═══ اسمُ الدورة من أسماء شعبها (٢٠ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «اجعل تغييرَ الأسماء للدورات أسهل… وأن تكون هناك اقتراحاتٌ
   لتغيير اسم الدورة من خلال إعادة النظر لأسماء الشعب، ونختار منها، أو تقترح واحدا
   يجمع بين أسماء الشعب احترافيّا وأنا أوافق.. واجعل النظامَ يقترح لكلّ دورة، وأن
   يكون العملُ على الدورات التي لها شعبٌ فقط».

   فأسماءُ الشعب هي ما سمّاه الناسُ الدورةَ فعلا حين فتحوها — المدرّبُ في بطاقته
   والإدارةُ في شاشة الشعب. وكثيرا ما تكون أدقَّ من اسم الكتالوج. فتُقرأ هنا،
   ويُنزع منها ما يخصّ الشعبةَ لا الدورة («— شعبة ٢»، الشهرُ، السنة، الفصل)،
   ويُعرض ما بقي:

   · **اسمُ كلّ شعبةٍ** بعد التنظيف — مرتّبا بعدد الشعب التي تحمله.
   · **واسمٌ يجمعها** — الكلماتُ التي تشترك فيها الأسماءُ كلُّها بترتيبها. يُعرض
     حين تختلف الأسماءُ ويبقى بينها قلبٌ من كلمتين فأكثر.

   ولا يُعرض ما يساوي اسمَ الدورة الحاليّ: اقتراحٌ يقول «أبقِه كما هو» ليس اقتراحا.

   وحدةٌ خالصةٌ بلا قاعدة: يقرؤها الخادمُ ويختبرها `src/tests/catalog`. */

import { COHORT_WORD_AR } from '../learning/cohort-title'
import { plainAr } from '../text/plain-ar'
import { normalizeAr } from '../text/search-ar'

export interface CourseNameSuggestion {
  titleAr: string
  /** `cohort` اسمُ شعبةٍ بعينها · `combined` ما تشترك فيه الأسماء */
  kind: 'cohort' | 'combined'
  /** كم شعبةً تحمل هذا الاسم — وللجامع: كم شعبةً جمع */
  cohortCount: number
}

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'إبريل', 'ابريل', 'مايو', 'يونيو', 'يونيه', 'يوليو', 'يوليه',
  'أغسطس', 'اغسطس', 'سبتمبر', 'أكتوبر', 'اكتوبر', 'نوفمبر', 'ديسمبر',
  'كانون الثاني', 'شباط', 'آذار', 'اذار', 'نيسان', 'أيار', 'ايار', 'حزيران', 'تموز', 'آب', 'اب',
  'أيلول', 'ايلول', 'تشرين الأول', 'تشرين الاول', 'تشرين الثاني', 'كانون الأول', 'كانون الاول',
]
const SEASONS_AR = ['الخريف', 'الشتاء', 'الربيع', 'الصيف', 'خريف', 'شتاء', 'ربيع', 'صيف']
const ORDINALS_AR = [
  'الأولى', 'الاولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة',
  'التاسعة', 'العاشرة', 'الأول', 'الاول', 'الثاني', 'الثالث', 'الرابع',
]

const alt = (xs: readonly string[]) => xs.slice().sort((a, b) => b.length - a.length).join('|')
const NUM = `[٠-٩0-9]+`
const SEP = `[\\s\\-—–|:،,/(]*`

/* ما يخصّ الشعبةَ لا الدورة — يُنزع من الذيل وحدَه، مرّةً بعد مرّة حتّى يثبت:
   «إدارة المشاريع — شعبة ٢ (أكتوبر ٢٠٢٦)» يسقط منها ذيلان. */
const TAIL_PATTERNS: RegExp[] = [
  new RegExp(`${SEP}(?:ال)?(?:${COHORT_WORD_AR}|دفعة|مجموعة|فوج)\\s*(?:رقم\\s*)?(?:${NUM}|${alt(ORDINALS_AR)})\\)?\\s*$`),
  new RegExp(`${SEP}(?:${alt(MONTHS_AR)})(?:\\s*${NUM})?\\)?\\s*$`),
  new RegExp(`${SEP}(?:ال)?(?:فصل\\s+)?(?:${alt(SEASONS_AR)})(?:\\s*${NUM})?\\)?\\s*$`),
  new RegExp(`${SEP}(?:الفصل|فصل)\\s+(?:${alt(ORDINALS_AR)}|${NUM})(?:\\s*${NUM})?\\)?\\s*$`),
  new RegExp(`${SEP}(?:19|20|١٩|٢٠)[0-9٠-٩]{2}\\)?\\s*$`),
]
/* وما يتقدّم الاسمَ ولا يضيف إليه: «دورة إدارة المشاريع» دورةٌ اسمُها «إدارة المشاريع» */
const HEAD_PATTERN = /^\s*(?:ال)?دورة\s+(?:في\s+)?(?:عن\s+)?/

/** اسمُ الشعبة بلا ما يخصّها — ما يصلح اسما للدورة نفسِها */
export function cleanSectionNameAr(title: string): string {
  let s = plainAr(title).replace(/[«»"“”]/g, ' ').replace(/\s+/g, ' ').trim()
  for (let guard = 0; guard < 8; guard++) {
    const before = s
    for (const re of TAIL_PATTERNS) s = s.replace(re, '').trim()
    s = s.replace(/[\s\-—–|:،,./(]+$/, '').trim()
    if (s === before) break
  }
  s = s.replace(HEAD_PATTERN, '').trim()
  /* قوسٌ فُتح ولم يُغلق بعد نزع ذيله */
  if ((s.match(/\(/g)?.length ?? 0) > (s.match(/\)/g)?.length ?? 0)) s = s.replace(/\s*\([^)]*$/, '').trim()
  return s
}

/* «القيادة» و«قيادة» كلمةٌ واحدة في المقارنة — والعرضُ بما كُتب */
const wordKey = (w: string): string => {
  const n = normalizeAr(w)
  return n.startsWith('ال') && n.length > 3 ? n.slice(2) : n
}

const nameKey = (s: string): string => s.split(' ').filter(Boolean).map(wordKey).join(' ')

const STOP_WORDS = new Set(['في', 'من', 'الي', 'علي', 'عن', 'مع', 'و', 'او', 'ل', 'ب', 'لل'].map(normalizeAr))

/** أطولُ تتابعٍ من الكلمات تشترك فيه الأسماءُ كلُّها بترتيبه — بكلمات أوّلها */
function commonWords(names: readonly string[]): string[] {
  const [first, ...rest] = names.map((n) => n.split(' ').filter(Boolean))
  if (!first) return []
  let core = first
  for (const other of rest) {
    const a = core.map(wordKey)
    const b = other.map(wordKey)
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
    const kept: string[] = []
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      /* «قيادة» في «مهارات قيادة الفرق» مضافةٌ لما سقط بعدها — فالمعرَّفةُ أسلمُ في الجامع */
      if (a[i] === b[j]) { kept.push(normalizeAr(other[j]!).startsWith('ال') ? other[j]! : core[i]!); i++; j++ }
      else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++
      else j++
    }
    core = kept
  }
  /* حرفُ جرٍّ أو عطفٍ في طرف الاسم بقيّةُ جملةٍ لا اسم */
  while (core.length && STOP_WORDS.has(normalizeAr(core[0]!))) core = core.slice(1)
  while (core.length && STOP_WORDS.has(normalizeAr(core[core.length - 1]!))) core = core.slice(0, -1)
  return core
}

/** اقتراحاتُ اسمٍ للدورة من أسماء شعبها — الجامعُ أوّلا ثمّ الأكثرُ شعبا */
export function suggestCourseNames(
  courseTitleAr: string,
  cohortTitles: readonly string[],
  limit = 5,
): CourseNameSuggestion[] {
  const currentKey = nameKey(cleanSectionNameAr(courseTitleAr))
  const groups = new Map<string, { titleAr: string; count: number }>()
  for (const raw of cohortTitles) {
    const clean = cleanSectionNameAr(raw)
    if (clean.length < 3) continue
    const key = nameKey(clean)
    const g = groups.get(key)
    if (g) g.count++
    else groups.set(key, { titleAr: clean, count: 1 })
  }

  /* شعبةٌ باسم الدورة نفسِه («— شعبة ١» الافتراضيّ) لا تقول شيئا جديدا ولا تدخل الجمع */
  const ranked = [...groups.entries()]
    .filter(([key]) => key !== currentKey)
    .sort(([, a], [, b]) => b.count - a.count || a.titleAr.length - b.titleAr.length)
  const out: CourseNameSuggestion[] = []
  const seen = new Set([currentKey])

  if (ranked.length >= 2) {
    const core = commonWords(ranked.map(([, g]) => g.titleAr))
    const meaningful = core.filter((w) => !STOP_WORDS.has(normalizeAr(w)))
    const titleAr = core.join(' ')
    const key = nameKey(titleAr)
    if (meaningful.length >= 2 && !seen.has(key)) {
      seen.add(key)
      out.push({ titleAr, kind: 'combined', cohortCount: ranked.reduce((n, [, g]) => n + g.count, 0) })
    }
  }
  for (const [key, g] of ranked) {
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ titleAr: g.titleAr, kind: 'cohort', cohortCount: g.count })
  }
  return out.slice(0, limit)
}

/** اسمُ دورةٍ يُقبل: بلا تشكيلٍ ولا مسافاتٍ زائدة، ومن ٣ أحرفٍ إلى ١٢٠ — وإلّا `null` */
export function tidyCourseTitleAr(input: string): string | null {
  const s = plainAr(input).replace(/\s+/g, ' ').trim()
  return s.length >= 3 && s.length <= 120 ? s : null
}
