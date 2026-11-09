/* اسمُ الشعبة الافتراضيّ: «اسمُ الدورة — شعبة ١» (٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: كانت الشعبُ تُسمّى «الدفعة الأولى» و«الشعبة الأولى»
   بلا اسم دورتها، فلا يُعرف من القائمة أيُّها لأيّ دورة. فصار الاسمُ
   الافتراضيُّ اسمَ الدورة نفسَها ومعه رقمُ الشعبة **في تلك الدورة**.

   · **والرقمُ لا يُعاد.** شعبةٌ أُلغيت تبقى برقمها، والتالية بعدها — فلا
     تحمل شهادتان قديمةٌ وجديدةٌ اسما واحدا. فالرقمُ التالي أكبرُ من عدد
     شعب الدورة كلِّها ومن أكبر رقمٍ في أسمائها معا.
   · **وهو افتراضٌ لا قيد:** للإدارة أن تسمّي الشعبةَ بما شاءت.
   · والأرقامُ هنديّةٌ (١، ٢) كما كتبها صاحبُ المنصّة.

   وحدةٌ خالصةٌ يقرؤها الخادمُ والشاشةُ معا. */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export const COHORT_WORD_AR = 'شعبة'

const toArabicDigits = (n: number): string =>
  String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!)

/** «اسمُ الدورة — شعبة ١» */
export function cohortTitleAr(courseTitleAr: string, n: number): string {
  return `${courseTitleAr.trim()} — ${COHORT_WORD_AR} ${toArabicDigits(n)}`
}

/** رقمُ الشعبة من اسمها إن كان على هذا النمط — وإلّا `null` */
export function cohortNumberOf(title: string): number | null {
  const m = new RegExp(`— ${COHORT_WORD_AR} ([٠-٩0-9]+)`).exec(title)
  if (!m) return null
  const western = m[1]!.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
  return Number(western)
}

/** أهو الاسمُ الذي وضعته المنصّة — «اسمُ الدورة — شعبة N» — لم يُغيَّر؟

    يُعرض للمدرّب مثالا باهتا في حقلٍ فارغ لا قيمةً يمسحها أوّلا (١١ أكتوبر ٢٠٢٦،
    ملفُّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»): «يبقى اسمُ الدورة ورقمُ
    الشعبة اقتراحا ظاهرا، لا قيمةً مثبتةً يجب تعديلُها». */
export function isDefaultCohortTitle(title: string, courseTitleAr: string): boolean {
  const n = cohortNumberOf(title)
  return n !== null && title.trim() === cohortTitleAr(courseTitleAr, n)
}

/** رقمُ الشعبة التالية من أسماء شعب الدورة كلِّها — الملغاةُ منها والمنتهية */
export function nextCohortNumber(existingTitles: string[]): number {
  const highest = existingTitles.reduce((m, t) => Math.max(m, cohortNumberOf(t) ?? 0), 0)
  return Math.max(existingTitles.length, highest) + 1
}

/* ═══ «شعبتك الأولى» — في شاشتَي المدرّب (٤ أكتوبر ٢٠٢٦، ⑫) ═══

   الرقمُ رقمُ الشعبة في دورتها كلِّها، فأوّلُ شعبةٍ لمدرّبٍ جديدٍ في دورةٍ سبقتها
   ثلاثٌ تُسمّى «شعبة ٤» — فيسأل: أين الثلاثُ قبلها؟ وخُيّر صاحبُ المنصّة بين
   أن يبقى الرقمُ وحدَه، أو أن يحلّ محلَّه «شعبتك الأولى» في شاشات المدرّب،
   أو أن يُقالا معا — فاختار أن يُقالا معا («Both»): الاسمُ كما هو، فيتكلّم
   المدرّبُ والإدارةُ والمتعلّمون باسمٍ واحد، ومعه في لوح «شعبي» ورأسِ صفحة
   الشعبة ترتيبُها بين شعب مدرّبها في دورتها.

   · **والترتيبُ بتاريخ الإنشاء** — به يُعطى الرقمُ نفسُه، والملغاةُ تُعَدّ كما
     تُعَدّ هناك؛ والمعرّفُ يفصل شعبتين أُنشئتا في لحظةٍ واحدة.
   · **ويُقال حين يخالف الرقمَ وحدَه**: «شعبة ١ · شعبتك الأولى» تكرارٌ لا جواب،
     واسمٌ سمّته الإدارةُ بغير رقمٍ لا يُسأل فيه عن ثلاثٍ قبله. */

const ORDINAL_FEM_AR = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة']

/** ترتيبُ كلّ شعبةٍ بين شعب مدرّبٍ واحدٍ في دورتها — ١ لأقدمها */
export function trainerOrdinals(cohorts: readonly { id: string; courseId: string; createdAt: Date | string }[]): Map<string, number> {
  const byCourse = new Map<string, Map<string, number>>()
  for (const c of cohorts) {
    const list = byCourse.get(c.courseId) ?? new Map<string, number>()
    list.set(c.id, new Date(c.createdAt).getTime())
    byCourse.set(c.courseId, list)
  }
  const out = new Map<string, number>()
  for (const list of byCourse.values()) {
    ;[...list].sort(([a, ta], [b, tb]) => ta - tb || a.localeCompare(b)).forEach(([id], i) => out.set(id, i + 1))
  }
  return out
}

/** «شعبتك الأولى» بجانب الاسم — أو `null` حين لا يخالف الرقمَ أو لا رقمَ في الاسم */
export function trainerOrdinalNoteAr(title: string, ordinal: number | null | undefined): string | null {
  if (!ordinal || ordinal < 1) return null
  const n = cohortNumberOf(title)
  if (n === null || n === ordinal) return null
  return `شعبتك ${ORDINAL_FEM_AR[ordinal] ?? `رقم ${toArabicDigits(ordinal)}`}`
}

/* ═══ والمتعلّمُ لا يرى رقمَ الشعبة (٢٦ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «Remove "- شعبة 2" from the class titles». الرقمُ يفرّق الشعبَ في يد المدرّب والإدارة،
   وعند المشتري لا يقول شيئا — يفرّقها موعدُها ومدرّبُها. فيُنزع ذيلُه من العرض العامّ وحدَه، والاسمُ المحفوظُ
   كما هو: «— شعبة ٢» و«- شعبة 2» و«(شعبة ٢)». واسمٌ ليس فيه إلّا الرقمُ يبقى كما هو — لا يصير صندوقٌ بلا اسم. */
const NUMBER_TAIL = new RegExp(`\\s*(?:[-—–|:،]\\s*${COHORT_WORD_AR}\\s*[٠-٩0-9]+|\\(\\s*${COHORT_WORD_AR}\\s*[٠-٩0-9]+\\s*\\))\\s*$`)

/** اسمُ الشعبة كما يراه المتعلّم — بلا رقمها */
export function publicCohortTitleAr(title: string): string {
  const out = title.replace(NUMBER_TAIL, '').trim()
  return out || title.trim()
}

/* ═══ وما يُنشر عن الشعبة اسمُها هي، لا اسمُ دورتها العليا (٢ نوفمبر ٢٠٢٦) ═══
   قال صاحبُ المنصّة عن تصاميم «شارك دوراتك» لمدرّبة: «تأكّد أنّ كلَّ التصاميم تخصّ الدوراتِ الخاصّةَ بالمدرّب كشعبة،
   وليس الدورةَ العليا». وكانت الصورُ والنصوصُ تأخذ اسمَ الدورة من نسختها الجارية — فما سُمّيت به الشعبةُ لمدرّبها
   («القيادة للمديرين الجدد: …») لا يظهر، ويظهر ما للدورة كلِّها. فالمنشورُ يأخذ اسمَ الشعبة بلا رقمها
   (`publicCohortTitleAr`)، واسمُ الدورة بديلٌ حين لا يقول اسمُ الشعبة شيئا: «شعبة ١» أو «الدفعة الأولى». */
const BARE_LABEL = /^(?:ال)?(?:شعبة|دفعة)(?:\s|$)/

/** اسمُ الشعبة كما يُنشر عنها — أو اسمُ دورتها إن لم يكن لها اسمٌ يُقرأ */
export function sharedCohortTitleAr(cohortTitle: string | null | undefined, courseTitleAr: string): string {
  const own = publicCohortTitleAr(cohortTitle ?? '')
  return !own || BARE_LABEL.test(own) ? courseTitleAr.trim() : own
}

/* ═══ وعنوانُ الشعبة تحت دورتها لا يكرّر اسمَها (٨ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «اسمُ الدورة مكرّرٌ عند الشعب.. لا تكرّره إن كان متشابها، وإن كان مختلفا ضعه بالنصّ في الصندوق
   الصغير كعنوان الشعبة، وهذا يخفّف الخربطة بأنّها دوراتٌ داخل دورة.. عدّل كلَّ الصفحات المشابهة لذلك». وكان قرارُه
   (٢٦ أكتوبر ٢٠٢٦) أن يكون عنوانُ الشعبة أوّلَ ما يُقرأ في صندوقها بخطٍّ كبير — وأكثرُ الشعب عنوانُها اسمُ الدورة نفسُه
   (الافتراضيُّ أعلاه بلا رقمه، `publicCohortTitleAr`)، فصار كلُّ صندوقٍ يبدأ باسم الدورة ثانيةً فيُقرأ دورةً داخل دورة.

   فالقاعدة هنا، يقرؤها منتقي الشعب (`CohortPicker`) ولوحُ الشراء (`BuyPanel`):
   · عنوانٌ يطابق اسمَ الدورة — بعد حذف «دورة» من أوّله والتشكيلِ وعلامات الترقيم واختلافِ الهمزات — لا يُعرض.
   · وعنوانٌ هو اسمُ الدورة وزيادة («… — مسائية») تُعرض زيادتُه وحدَها.
   · وعنوانٌ هو بعضُ اسم الدورة لا يزيد شيئا — لا يُعرض.
   · وما سوى ذلك يُعرض كما هو. */

/** حرفٌ كما يُقارَن: بلا تشكيلٍ ولا تطويلٍ ولا ترقيم، والهمزاتُ والياءُ والتاءُ المربوطةُ بصورةٍ واحدة */
function cmpChar(ch: string): string {
  if (/[ً-ٰٟـ]/.test(ch)) return ''
  if (!/[\p{L}\p{N}]/u.test(ch)) return ''
  if (/[أإآٱ]/.test(ch)) return 'ا'
  if (ch === 'ى') return 'ي'
  if (ch === 'ة') return 'ه'
  return ch.toLowerCase()
}
const cmp = (s: string): string => [...s].map(cmpChar).join('')

/** «دورة» أو «دوره» في أوّل العنوان — ليست من الاسم */
const COURSE_WORD = /^\s*دور[ةه]\s+/

/** ما يُعرض من عنوان الشعبة تحت دورتها — أو `null` إن لم يزد على اسمها شيئا */
export function distinctCohortTitle(cohortTitle: string | null | undefined, courseTitle: string | null | undefined): string | null {
  const raw = (cohortTitle ?? '').trim()
  if (!raw) return null
  const course = cmp((courseTitle ?? '').replace(COURSE_WORD, ''))
  if (!course) return raw
  const own = raw.replace(COURSE_WORD, '')
  const mine = cmp(own)
  if (!mine || mine === course || course.includes(mine)) return null
  if (mine.startsWith(course)) {
    /* اسمُ الدورة وزيادة: تُقطع الزيادةُ من العنوان نفسِه بحروفه — عند الحرف الذي يكتمل به اسمُ الدورة */
    let seen = 0
    let cut = own.length
    const chars = [...own]
    for (let i = 0, at = 0; i < chars.length; at += chars[i].length, i += 1) {
      seen += cmpChar(chars[i]).length
      if (seen >= course.length) { cut = at + chars[i].length; break }
    }
    const rest = own.slice(cut).replace(/^[\s\-–—:،,.()|«»]+|[\s\-–—:،,.()|«»]+$/g, '')
    return rest || null
  }
  return raw
}
