/* أيُّ دوراتِ الكتالوج تشبه ما اقترحه المدرّب؟ — ترشيحٌ يقرأه الأدمن.

   ═══ العطبُ الذي كُتب له ═══

   شاشةُ التصنيف تعرض «نسخةٌ من رمزٍ قائم» ثمّ قائمةً منسدلةً فيها **واحدٌ
   وثمانون رمزا** بلا ترتيب. ومن يصنّف اقتراحا اسمُه «دوره خطابه عامه» عليه
   أن يقرأها كلَّها ليعرف أنّ عندنا «مهارات العرض والإلقاء» — فإن لم يعرفها
   بظهر قلبٍ أنشأ دورةً ثانيةً لما هو موجود.

   وثمنُ ذلك ليس صفّا زائدا في جدول: الرمزُ الثاني يقيس المهارةَ نفسَها
   مرّتَين في التشخيص، فتُرشَّح إحداهما لمن تُرشَّح له الأخرى — وهو العطبُ
   الذي تُحذّر منه شاشةُ التصنيف في رأسها ثمّ لا تعين على تفاديه.

   ═══ ولماذا تشابهٌ نصّيٌّ لا أكثر ═══

   المطلوبُ هنا **ترشيحٌ يُقرأ ويُراجَع**، لا قرارٌ يُتّخذ آليّا. والأدمن هو
   من يقرّر، والقائمةُ الكاملةُ تبقى تحته كما كانت. فبضعُ كلماتٍ مشتركةٍ
   تكفي لتقول «انظر هذه أوّلا»، ولا يلزم لها تضمينٌ ولا نموذجٌ يُدرَّب.

   والمهمُّ أن يقول الترشيحُ **لماذا** رشّح: كلماتٌ تُعرض بجانب كلّ رمز. ومن
   رأى «تشترك في: الخطابة» عرف في لحظةٍ أصادقٌ الترشيحُ أم صدفةٌ لفظيّة —
   وترشيحٌ بلا سببٍ يُقبل بلا قراءةٍ أو يُهمَل كلُّه. */

import { normalizeAr } from '../text/search-ar'

/** دورةٌ من الكتالوج كما يقرؤها المرشِّح — نصُّها لا بنيتُها، بثلاث طبقاتٍ لكلٍّ وزنُها */
export interface MatchableCourse {
  id: string
  titleAr: string
  /** المصطلحُ الإنجليزيّ — يُقرأ بوزن العنوان، فـ«Design thinking» تلقى دورتَها */
  termEn?: string | null
  /** مهاراتُها وعناوينُ وحداتها — أقربُ إلى العنوان من الوصف */
  skillsAr?: readonly (string | null | undefined)[]
  /** نصوصٌ مساندة: وعدُها ووصفُها ونواتجُها وجمهورُها — أخفُّ وزنا */
  extraAr?: readonly (string | null | undefined)[]
}

export interface ProposalMatch {
  courseId: string
  titleAr: string
  /** رقمُ ترتيبٍ لا نسبة — وزنُ ما اشترك فيه، بندرته في الكتالوج */
  score: number
  /** الكلماتُ المشتركةُ كما تُعرض — سببُ الترشيح لا رقمُه */
  sharedAr: string[]
}

/* ═══ كلماتٌ لا تُرشِّح شيئا ═══

   صنفان: أدواتُ اللغة (في · من · على)، و**ألفاظُ الجنس** التي تقع في كلّ
   عنوانٍ تقريبا (دورة · مهارات · أساسيّات · مقدّمة). والثاني أخطرُ من
   الأوّل: «دورة» وحدَها تُطابق الكتالوجَ كلَّه، فتُخرج واحدا وثمانين ترشيحا
   كلُّها بدرجةٍ واحدة — وقائمةٌ تُرشِّح كلَّ شيءٍ لم تُرشِّح شيئا.

   والقائمةُ مكتوبةٌ **بعد التطبيع** (`normalizeAr`): «دورة» تصير «دوره»،
   و«أساسيات» تصير «اساسيات». ومن كتبها بالهمزة هنا لم تُطابَق أبدا. */
const STOP_AR = new Set([
  'في', 'من', 'الى', 'على', 'عن', 'مع', 'او', 'ثم', 'لا', 'ما', 'هذا', 'هذه',
  'التي', 'الذي', 'كل', 'بين', 'عند', 'بعد', 'قبل', 'غير', 'بلا', 'كيف',
  'دوره', 'دورات', 'دورة', 'مهارات', 'مهاره', 'اساسيات', 'مقدمه', 'مدخل',
  'فن', 'فنون', 'علم', 'ادارة', 'اداره',
  /* ونبذةُ المدرّب جملٌ لا عناوين: «تتعلّم كيف…» تقع في كلّ نبذةٍ ولا تميّز دورة */
  'تتعلم', 'تعلم', 'ليس', 'ليست', 'لكن', 'هل', 'حتى', 'انت', 'لكي', 'اي', 'ذلك', 'تلك',
  'هو', 'هي', 'كما', 'ايضا', 'فقط', 'مثل', 'عبر', 'لدى', 'يمكن', 'يجب', 'دون',
  /* والعناوينُ الإنجليزيّةُ تُقرأ كالعربيّة — بلا أدواتها */
  'the', 'and', 'for', 'your', 'you', 'with', 'from', 'into',
])

/** أقلُّ ما يُعتدّ به من طول الكلمة — وحرفان لا يميّزان شيئا */
const MIN_TOKEN = 3

/* ═══ مفتاحُ المطابقة — ولماذا ليس هو الكلمةَ المعروضة ═══

   «ال» تُنزع قبل المقارنة كي تلتقي «الخطابة» بـ«خطابة»، وإلّا سقط الترشيحُ
   على حرفَين. لكنّ النزعَ **يبتر** ما أصلُه منها: «التزام» ليست «ال» +
   «تزام».

   وأوّلُ صياغةٍ نزعتها عن الكلمة نفسِها، فكان الحارسُ يمسكها: تُعرض للأدمن
   «تشترك في: تزام» — كلمةٌ لا وجودَ لها في لغة. والمطابقةُ كانت سليمةً على
   كلّ حال (النزعُ يقع على الطرفَين معا فيلتقيان)، **والعطبُ في العرض وحدَه**
   — وهو بعينه ما يُفقد الترشيحَ ثقتَه: من قرأ سببا لا يفهمه لم يعد يقرأ
   الأسبابَ أصلا.

   فالكلمةُ تبقى كما كتبها صاحبُها، ويُشتقّ منها مفتاحٌ للمقارنة وحدَها. */
function matchKey(token: string): string {
  let k = token
  for (const p of ['وال', 'بال', 'كال', 'فال', 'لل', 'ال']) {
    if (k.startsWith(p) && k.length - p.length >= MIN_TOKEN) { k = k.slice(p.length); break }
  }
  /* ولواحقُ الجمع والنسبة: «المستودعات» و«مستودع»، و«التسويقية» و«التسويق» كلمةٌ واحدة */
  for (const x of ['يات', 'ات', 'يه', 'ين', 'ون', 'ه', 'ي']) {
    if (k.endsWith(x) && k.length - x.length >= MIN_TOKEN) { k = k.slice(0, -x.length); break }
  }
  return k
}

/** كلماتُ نصٍّ عربيٍّ مُطبَّعةً ومصفّاة — مجموعةٌ لا مصفوفة، فالتكرارُ لا يضاعف وزنا.

    وهي **كلماتُ العرض**: مُطبَّعةٌ ولا منزوعةَ الألف واللام. والمطابقةُ تقع
    على `matchKey` منها لا عليها. */
export function tokensAr(...parts: readonly (string | null | undefined)[]): Set<string> {
  const out = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    for (const raw of normalizeAr(part).split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < MIN_TOKEN) continue
      if (STOP_AR.has(raw) || STOP_AR.has(matchKey(raw))) continue
      out.add(raw)
    }
  }
  return out
}

/* ═══ الدرجة: ما اشترك، بطبقته وندرته (٢١ أكتوبر ٢٠٢٦) ═══

   كان الترشيحُ يعدّ كلماتِ عنوان الاقتراح الموجودةَ في عنوان الدورة ومهاراتها. فقيس
   على ثلاثةٍ وخمسين اقتراحا راجعها صاحبُ المنصّة بندا بندا (٢٠ أكتوبر ٢٠٢٦): أصاب
   ترشيحُه الأوّلُ قرارَه في ٢٤ منها، وكان القرارُ في الثلاثة الأولى في ٣٢. وأخطاؤه من
   ثلاثة أبواب: الدورةُ تقول بغير لفظه («المشتريات» والدورةُ «التوريد»)، والعنوانُ
   الإنجليزيّ لا يلقى شيئا، والمدرّبُ نفسُه لا يُقرأ — فمن اختار في طلبه دوراتِ سلسلة
   الإمداد رُشّح له «إعدادُ المعلّمين لتدريب الأطفال على الخطابة». فطلب: «اقترح تلقائيّا
   لكلّ واحدٍ حسب إجاباته، فهي تختلف من شخصٍ لآخر».

   فصارت الدرجة:
     · **بطبقات الدورة**: عنوانُها ومصطلحُها الإنجليزيّ ٣، ومهاراتُها ووحداتُها ٢،
       ووصفُها ونواتجُها ١ — فيلقى «المشتريات» وصفَ دورة التوريد ولا يغلب عنوانا.
     · **بندرة الكلمة في الكتالوج** (IDF): «المستودعات» في دورتين أثقلُ من «تطوير» في عشرين.
     · **والنبذةُ بوزن ٠٫٨ من العنوان** — وما زالت لا تكفي وحدَها: لا يُرشَّح ما لا يشترك
       في كلمةٍ من العنوان.
     · **وبمجال المدرّب** (`families`، من `trainerFamilies`): دورةٌ من مجال ما اختاره أو
       أُهِّل له أو اقترحه أغلبُه تُضرب درجتُها في ١٫٥ — ترجيحٌ لا حصر، فاقتراحٌ خارج
       مجاله يجد دورتَه إن قال لفظُه ذلك.
   فأصاب الأوّلُ على الثلاثة والخمسين نفسِها ٣٣، والثلاثةُ الأولى ٣٩ (والكتالوجُ واحدٌ في
   القياسين). وما بقي حكمٌ لا لفظ: «Design thinking in the customer journey» قرّر فيها
   صاحبُ المنصّة دورةَ التسويق، والترشيحُ دورةَ علم السلوك في الرحلة — وكلتاهما في الثلاث. */

const WEIGHT = { title: 3, skills: 2, extra: 1 } as const
const SUMMARY_WEIGHT = 0.8
const FAMILY_BOOST = 1.5

/** عائلةُ الدورة من معرّفها: `C-SCM-103` ← `SCM` */
export function courseFamily(courseId: string): string {
  return courseId.split('-')[1] ?? ''
}

interface Indexed {
  course: MatchableCourse
  title: Set<string>
  skills: Set<string>
  extra: Set<string>
}

/* الفهرسُ يُبنى مرّةً لكلّ كتالوج — والطابورُ يرشّح لعشراتِ الاقتراحات من القائمة نفسِها */
const INDEX = new WeakMap<readonly MatchableCourse[], { docs: Indexed[]; idf: (k: string) => number }>()

function keysOf(...parts: readonly (string | null | undefined)[]): Set<string> {
  return new Set([...tokensAr(...parts)].map(matchKey))
}

function indexOf(courses: readonly MatchableCourse[]) {
  const hit = INDEX.get(courses)
  if (hit) return hit
  const docs = courses.map((c) => ({
    course: c,
    title: keysOf(c.titleAr, c.termEn),
    skills: keysOf(...(c.skillsAr ?? [])),
    extra: keysOf(...(c.extraAr ?? [])),
  }))
  const df = new Map<string, number>()
  for (const d of docs) for (const k of new Set([...d.title, ...d.skills, ...d.extra])) df.set(k, (df.get(k) ?? 0) + 1)
  /* ‏log(1 + N/df) لا log(N/df): كلمةٌ في كلّ دورةٍ تبقى بوزنٍ صغيرٍ لا صفر — وإلّا سكت
     الترشيحُ في كتالوجٍ كلُّه من بابٍ واحد */
  const idf = (k: string) => Math.log(1 + docs.length / (df.get(k) ?? 1))
  const built = { docs, idf }
  INDEX.set(courses, built)
  return built
}

/**
 * أقربُ دوراتِ الكتالوج إلى اقتراحٍ — مرتّبةً، وبلا ما لا يشترك في كلمةٍ من عنوانه.
 *
 * والدرجةُ تُقاس على **كلمات الاقتراح** لا على مجموع النصَّين: دورةٌ وصفُها طويلٌ
 * ستشترك مع كلّ شيءٍ لو قِيست بالتقاطع المجرّد. فالسؤالُ: ما الذي وجدناه عندنا من
 * كلماته، وأين وجدناه، وكم هو نادر؟ والقولُ في الأوزان فوقها.
 */
export function suggestCourses(
  proposal: { titleAr: string; summaryAr?: string | null },
  courses: readonly MatchableCourse[],
  limit = 3,
  opts: { families?: ReadonlySet<string> } = {},
): ProposalMatch[] {
  const titleTokens = [...tokensAr(proposal.titleAr)]
  if (titleTokens.length === 0) return []
  const titleKeys = new Set(titleTokens.map(matchKey))
  const summaryTokens = [...tokensAr(proposal.summaryAr)].filter((t) => !titleKeys.has(matchKey(t)))
  const { docs, idf } = indexOf(courses)

  const scored: ProposalMatch[] = []
  for (const d of docs) {
    const weightOf = (k: string) =>
      d.title.has(k) ? WEIGHT.title : d.skills.has(k) ? WEIGHT.skills : d.extra.has(k) ? WEIGHT.extra : 0
    const sharedTitle = titleTokens.filter((t) => weightOf(matchKey(t)) > 0)
    /* ولا تُرشَّح دورةٌ لا تشترك في كلمةٍ من العنوان: اشتراكٌ في النبذة وحدَها
       يقع كثيرا بين دورتَين لا تجمعهما إلّا صناعةٌ واحدة. */
    if (sharedTitle.length === 0) continue
    const sharedSummary = summaryTokens.filter((t) => weightOf(matchKey(t)) > 0)
    /* والكلمةُ تُحسب مرّةً وإن تكرّر مفتاحُها («الخطابة» و«خطابة») */
    const seen = new Set<string>()
    let score = 0
    for (const [tokens, w] of [[sharedTitle, 1], [sharedSummary, SUMMARY_WEIGHT]] as const) {
      for (const t of tokens) {
        const k = matchKey(t)
        if (seen.has(k)) continue
        seen.add(k)
        score += w * weightOf(k) * idf(k)
      }
    }
    if (opts.families?.has(courseFamily(d.course.id))) score *= FAMILY_BOOST
    scored.push({
      courseId: d.course.id,
      titleAr: d.course.titleAr,
      score: Number(score.toFixed(3)),
      sharedAr: [...sharedTitle, ...sharedSummary],
    })
  }

  /* الأعلى درجةً أوّلا، ثمّ الرمزُ كي يكون الترتيبُ ثابتا بين نداءَين —
     ترتيبٌ يتذبذب على درجةٍ متساويةٍ يجعل الشاشةَ تبدّل نفسَها بلا سبب. */
  return scored
    .sort((a, b) => b.score - a.score || a.courseId.localeCompare(b.courseId))
    .slice(0, limit)
}

/**
 * مجالاتُ المدرّب — ما يُرجَّح به ترشيحُ اقتراحاته.
 *
 * من ثلاثة مصادر، كلُّها من إجاباته لا من رأينا فيه:
 *   ١) رموزٌ له: ما اختاره من الكتالوج في طلبه، وما أُهِّل له أو طُلب تأهيلُه، وما رُبطت
 *      به اقتراحاتُه من قبل.
 *   ٢) وأغلبُ اقتراحاته نفسِها: مجالُ الترشيح الأوّل بلا ترجيح، إن كان له ثلاثةُ اقتراحاتٍ
 *      فأكثر ووقع ٤٠٪ منها فأكثر في مجالٍ واحد. فمن اقترح أربعا وعشرين دورةً في ريادة
 *      الأعمال ولم يختر من الكتالوج شيئا يُقرأ رائدَ أعمال — وهي حالٌ وقعت.
 * وما دون ذلك لا يُرجَّح به: اقتراحان لا يصنعان مجالا.
 */
export function trainerFamilies(
  trainer: {
    courseIds: readonly (string | null | undefined)[]
    proposals: readonly { titleAr: string; summaryAr?: string | null }[]
  },
  courses: readonly MatchableCourse[],
): Set<string> {
  const out = new Set<string>()
  for (const id of trainer.courseIds) if (id) out.add(courseFamily(id))
  const n = trainer.proposals.length
  if (n >= 3) {
    const votes = new Map<string, number>()
    for (const p of trainer.proposals) {
      const top = suggestCourses(p, courses, 1)[0]
      if (top) votes.set(courseFamily(top.courseId), (votes.get(courseFamily(top.courseId)) ?? 0) + 1)
    }
    for (const [f, v] of votes) if (v / n >= 0.4) out.add(f)
  }
  return out
}
