/* بوّابةُ التأليف — تقرأ سياسة `docs/AUTHORING-POLICY.md` وتُطبّقها على ما أُلّف.

   السياسةُ التي لا تُفحَص وثيقةٌ تُقرأ مرّةً ثمّ تُخالَف بحسن نيّة: يكتب
   المؤلّف درسا واحدا لوحدةٍ ساعتين، أو يبدأ بتعريفٍ معجميّ، أو يضع أربعةَ
   أسئلة بدل خمسة — ولا شيءَ يقول له. فهذه البوّابة تقول.

   وهي تفحص **ما أُلّف فقط**: الوحدات التي لا متنَ لها تُعَدّ ولا تُدان،
   فالتغطيةُ رقمٌ يُعرض لا حاجزٌ يُسقط. والحاجزُ على الجودة: من ألّف
   فليؤلّف على السياسة.

   ─────────── ولمَ خطُّ أساسٍ ───────────

   البوّابةُ كُتبت وتعمل، **ولم تكن تحرس شيئا**: `ci:authoring` في
   `package.json` ولا يناديه أحد في CI. وسببُ ذلك ظاهر — لو وُصلت اليوم
   لسقطت، فوحدةٌ واحدةٌ مؤلَّفةٌ ناقصة (`C-CAR-102-M4`: متنٌ بلا تمارينَ ولا
   سيناريو ولا نشاطٍ ولا روبرك). وبوّابةٌ حمراءُ دائما تُعلّم القارئَ تجاهلَ
   الأحمر، فتصير أسوأَ من لا بوّابة.

   فالحلُّ هو حلُّ `lint-baseline.ts` نفسُه في هذا المستودَع: **خطُّ أساسٍ
   ملتزَم**. تسقط البوّابةُ إن ازداد العددُ أو ظهرت مخالفةٌ في وحدةٍ جديدة،
   ولا تسقط على ما هو مسجَّلٌ سلفا — بل تطلب شدَّ الحزام. فيُمنع الدينُ
   الجديد بلا تجميد الإصلاح ولا تزييف الرقم بصفرٍ لا وجودَ له.

   الاستعمال:
     npx tsx scripts/audit-authoring.ts            تقرير
     npx tsx scripts/audit-authoring.ts --check    يسقط عند أيّ مخالفة جديدة
     npx tsx scripts/audit-authoring.ts --update   يحدّث خط الأساس بعد إصلاحٍ مقصود
*/

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateChecks } from '../src/application/content/module-checks'
import { validateScenario } from '../src/application/content/scenario'
import { parsePractice, validatePractice } from '../src/application/content/practice'
import { validateRubric } from '../src/application/content/rubric'
import { checkLibraryRefs, type LibraryIndex } from '../src/application/content/library'

const CATALOG = join(process.cwd(), 'src/data/catalog/core-catalog.v2.json')
const LIBRARY = join(process.cwd(), 'src/data/library/wajeez-library.json')
const BASELINE = join(process.cwd(), 'authoring-baseline.json')

export interface Course {
  course_id: string
  skill_slugs?: string[]
}

export interface Module {
  module_id: string
  course_id: string
  title_ar: string
  expected_hours: number
  module_body_ar?: string | null
  module_checks_ar?: string | null
  module_scenario_ar?: string | null
  module_practice_ar?: string | null
  module_rubric_ar?: string | null
}

/* ── حدودُ السياسة، رقما رقما ── */
const LESSONS_FOR_HOURS: Record<number, number> = { 2: 4, 3: 5 }
const CHECKS_FOR_HOURS: Record<number, number> = { 2: 5, 3: 7 }
/* زمنُ النشاط بحسب زمن الوحدة (§٢) — ٥٠–٦٠ لوحدة الساعتين، وأوسعُ لوحدة
   الثلاث ساعات لأنّ نشاطَها أوسعُ لا لأنّ الحدَّ أرخى. */
const PRACTICE_MINUTES_FOR_HOURS: Record<number, [number, number]> = { 2: [50, 60], 3: [60, 75] }
const MIN_WORDS = 450
const MAX_WORDS = 650
/* هامشٌ يمنع الردَّ على كلمةٍ واحدة — والسياسة نطاقٌ لا رقمٌ حدّيّ */
const SLACK = 50

/** القواعدُ الحمراء — كلُّ عبارةٍ منها تُبطل المتن */
const RED_PHRASES = [
  'يُعرَّف',
  'يعرف بأنه',
  'تجدر الإشارة',
  'من المهم أن نعلم',
  'في هذا الدرس سوف',
  'كما ذكرنا سابقا',
  'في الختام',
  'مما لا شك فيه',
  'يُعدّ من أهمّ',
  'عزيزي المتعلم',
  'عزيزي المتعلّم',
  'أخي الكريم',
]

/** أسماءٌ أجنبيّة شائعة في الأمثلة — السياسة تُلزم سياقا عربيّا */
const FOREIGN_NAMES = ['John', 'Acme', 'Jane', 'Bob', 'Alice', 'Foo Corp']

interface Violation { moduleId: string; rule: string; detail: string }

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** يقسّم على `## ` خارج كتل الكود — العقدُ نفسُه الذي تقرؤه الواجهة */
function splitLessons(body: string): { title: string; body: string }[] {
  const lines = body.split('\n')
  let fence = false
  const cuts: { at: number; title: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fence = !fence; continue }
    if (fence) continue
    const m = /^##\s+(.+?)\s*$/.exec(lines[i])
    if (m && !lines[i].startsWith('###')) cuts.push({ at: i, title: m[1].trim() })
  }
  if (cuts.length === 0) return [{ title: '', body: body.trim() }]
  return cuts.map((c, i) => ({
    title: c.title,
    body: lines.slice(c.at + 1, i + 1 < cuts.length ? cuts[i + 1].at : lines.length).join('\n').trim(),
  }))
}

/** صيغةُ التمارين المعتمدة: س: / + / - / ش: / م: */
function parseChecks(raw: string) {
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  return blocks.map((b) => {
    const lines = b.split('\n').map((l) => l.trim())
    return {
      prompt: lines.find((l) => l.startsWith('س:'))?.slice(2).trim() ?? '',
      correct: lines.filter((l) => l.startsWith('+')).length,
      options: lines.filter((l) => l.startsWith('+') || l.startsWith('-')).length,
      /* موضعُ الصحيح — واحدٌ أو اثنانِ أو ثلاثة، وصفرٌ إن لم يوجد */
      correctAt:
        lines.filter((l) => l.startsWith('+') || l.startsWith('-')).findIndex((l) => l.startsWith('+')) + 1,
      why: lines.find((l) => l.startsWith('ش:'))?.slice(2).trim() ?? '',
      skill: lines.find((l) => l.startsWith('م:'))?.slice(2).trim() ?? '',
    }
  })
}

export function auditModule(m: Module, courseSkills: Map<string, string[]>, library: LibraryIndex): Violation[] {
  const v: Violation[] = []
  const add = (rule: string, detail: string) => v.push({ moduleId: m.module_id, rule, detail })
  const body = (m.module_body_ar ?? '').trim()
  if (!body) return v

  /* ١) عددُ الدروس بحسب زمن الوحدة */
  const lessons = splitLessons(body)
  const want = LESSONS_FOR_HOURS[m.expected_hours]
  if (want && lessons.length !== want) {
    add('عدد الدروس', `وحدةُ ${m.expected_hours} ساعات تحتاج ${want} دروس، وفيها ${lessons.length}`)
  }

  /* ٢) حجمُ كلّ درس */
  for (const [i, l] of lessons.entries()) {
    const w = words(l.body)
    if (w < MIN_WORDS - SLACK) add('حجم الدرس', `الدرس ${i + 1} «${l.title || 'بلا عنوان'}» ${w} كلمة — والحدّ ${MIN_WORDS}`)
    if (w > MAX_WORDS + SLACK) add('حجم الدرس', `الدرس ${i + 1} «${l.title || 'بلا عنوان'}» ${w} كلمة — والسقف ${MAX_WORDS}`)
    if (!l.title) add('عنوان الدرس', `الدرس ${i + 1} بلا عنوان — والعنوانُ وعدُ الدرس`)

    /* ٢أ) الأجزاءُ الخمسةُ في كلّ درس (§٣).

       السياسةُ تُلزم خمسةَ أجزاءٍ بترتيبها، وتقول عن الخطأ الشائع إنّه
       «أنفعُ ما في الدرس، وأوّلُ ما يُحذف حين يستعجل المؤلّف». وكانت
       البوّابةُ تفحص عددَ الدروس وحجمَها ولا تفحص ما فيها — فمرّ تسعةٌ
       وعشرون درسا من اثنين وخمسين بلا «افعل الآن»، وكلُّها في آخر الوحدة
       حيث يستعجل المؤلّفُ فعلا.

       والخطّافُ والفكرةُ لا يُفحصان هنا بقصد: لا عنوانَ لهما، وقياسُهما
       بطول النثر قبل أوّل عنوانٍ فرعيّ جُرِّب فأنتج إنذاراتٍ كاذبةً على
       خطّافاتٍ سليمةٍ من سطرين — وبوّابةٌ تُنذر بالباطل تُعلَّم أن تُتجاوَز.
       فيبقى الخطّافُ على عين المراجع (§١١)، والأجزاءُ الثلاثةُ المعنونةُ
       على البوّابة. */
    /* العنوانُ يُطابق ببدايته لا بحرفه: «### الخطأ الشائع: أن تبني ما لا يُقرأ»
       جزءٌ مكتوبٌ لا ناقص، والعنوانُ الفرعيُّ فيه تحسينٌ لا مخالفة. وكان
       الشرطُ تطابقا حرفيّا فأنذر بالباطل في أربعين درسا — وقُدِّم الدَّينُ
       ٢٣٠ وهو ١٨٦. فالفحصُ الذي يُنذر بالباطل يُكذّب تقريرَه كلَّه. */
    for (const part of ['مثالٌ محلول', 'الخطأ الشائع', 'افعل الآن']) {
      if (!new RegExp(`^###\\s+${part}`, 'm').test(l.body)) {
        add('أجزاءُ الدرس', `الدرس ${i + 1} «${l.title || 'بلا عنوان'}» بلا «${part}»`)
      }
    }
    /* ٢ب) أثرُ لصقٍ مكرَّر — عنوانٌ فرعيّ يتكرّر داخل الدرس الواحد.

       تكرارُ «مثالٌ محلول» عبر دروس الوحدة مقصود: لكلّ درسٍ مثالُه. أمّا
       تكرارُه داخل الدرس الواحد فليس بنية، بل أثرُ تحريرٍ بقي في المتن —
       ووقع مرّتين فعلا: في C-AI-104-M1 ظهر العنوانُ مرّتين متتاليتين، وفي
       C-COMX-105-M1 تكرّر العنوانُ ومعه أوّلُ سطرٍ بعده. والمتعلّم يقرؤه
       تلعثما في نصٍّ يُفترض أنّه مُراجَع، فلا يُكتفى بمراجعة العين. */
    const subs = l.body.split('\n').filter((x) => /^### /.test(x))
    const seenSub = new Set<string>()
    for (const h of subs) {
      if (seenSub.has(h)) add('تكرار', `الدرس ${i + 1}: العنوانُ «${h.replace(/^###\s*/, '')}» مكرّرٌ داخل الدرس نفسه`)
      seenSub.add(h)
    }
  }

  /* ٢ج) كتلةٌ ملتصقةٌ بنفسها — أوضحُ صورةِ اللصق المكرَّر.

     نصٌّ يعقبه النصُّ نفسُه حرفا بحرف لا يكون قصدا في مقالةٍ تعليميّة.
     والحدّ ٢٤ محرفا يتجاوز تكرارَ العبارات القصيرة المشروع («ولماذا الآن؟»)
     ويلتقط الفقرةَ أو العنوانَ المُعادَ. */
  {
    const flat = body.replace(/\s+/g, ' ')
    for (let len = 120; len >= 24; len--) {
      let hit: string | null = null
      for (let i = 0; i + 2 * len <= flat.length; i++) {
        if (flat.slice(i, i + len) === flat.slice(i + len, i + 2 * len)) { hit = flat.slice(i, i + len); break }
      }
      if (hit) { add('تكرار', `كتلةٌ مكرّرةٌ ملتصقة: «${hit.slice(0, 60)}…»`); break }
    }
  }

  /* ٣) القواعد الحمراء — على النثر لا على الاقتباس.

     درسٌ يعلّم المتعلّم أن يمنع «تجدر الإشارة» في طلبه يحتاج أن يكتبها
     ليمنعها. فتُستثنى الكتلُ والمقاطعُ المحصورة بعلامة الشيفرة `…`: هي
     اقتباسٌ يُرى اقتباسا، لا عبارةٌ يقرؤها المتعلّم نصيحةً. */
  const prose = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
  for (const p of RED_PHRASES) {
    if (prose.includes(p)) add('قاعدة حمراء', `العبارة الممنوعة «${p}»`)
  }
  for (const n of FOREIGN_NAMES) {
    if (new RegExp(`\\b${n}\\b`).test(body)) add('مثالٌ أجنبيّ', `الاسم «${n}» — الأمثلة بسياقٍ عربيّ`)
  }

  /* ٤) التمارين */
  const checksRaw = (m.module_checks_ar ?? '').trim()
  const wantChecks = CHECKS_FOR_HOURS[m.expected_hours] ?? 5
  if (!checksRaw) {
    add('تمارين', `لا تمارينَ — والوحدة تحتاج ${wantChecks}`)
  } else {
    const checks = parseChecks(checksRaw)
    if (checks.length !== wantChecks) add('تمارين', `${checks.length} تمرينا والمطلوب ${wantChecks}`)
    for (const [i, c] of checks.entries()) {
      if (!c.prompt) add('تمرين', `التمرين ${i + 1} بلا سؤال`)
      if (c.correct !== 1) add('تمرين', `التمرين ${i + 1} فيه ${c.correct} إجابة صحيحة — والمطلوب واحدة`)
      if (c.options !== 3) add('تمرين', `التمرين ${i + 1} فيه ${c.options} خيارات — والسياسة ثلاثة`)
      if (c.why.length < 20) add('تمرين', `التمرين ${i + 1} شرحُه أقصرُ من أن يفسّر الصحيحَ والمُغري`)
      /* المهارةُ المربوطة تُقرأ من مهارات الدورة لا من خيال المؤلّف: سلسلةٌ
         مخترعةٌ تبدو ربطا وليست ربطا — لا يجدها بحثٌ ولا تدخل في تقرير تغطية. */
      const allowed = courseSkills.get(m.course_id) ?? []
      if (!c.skill) add('تمرين', `التمرين ${i + 1} بلا مهارة مربوطة`)
      else if (allowed.length > 0 && !allowed.includes(c.skill)) {
        add('مهارة مجهولة', `التمرين ${i + 1} مربوطٌ بـ«${c.skill}» وليست من مهارات الدورة (${allowed.join('، ')})`)
      }
    }

    /* موضعُ الجواب الصحيح يتنقّل — وإلّا فالوحدةُ تُجاب بلا قراءة.

       قالبُ §٥ يعرض المثالَ بـ«+» في الوسط، فقُرئ موضعا لا مثالا: مئتانِ
       وأربعون سؤالا من ثلاثِ مئةٍ وأربعةٍ وعشرين كان جوابُها في الخيار
       الأوسط، واثنتانِ وأربعون وحدةً كلُّ أسئلتها فيه — فمن يختار الأوسطَ
       دائما بلا أن يقرأ يُصيب خمسةً وتسعين في المئة. ولم يمسكه شيء: كلُّ
       سؤالٍ على حدته سليمُ الصيغة، والعطبُ في التوزيع لا في السؤال.

       والفحصُ على الوحدة لا على السؤال، ويُشترط ثلاثةُ أسئلةٍ فأكثرُ حتّى
       لا يُنذر بالباطل في وحدةٍ صغيرة. */
    const spots = checks.map((c) => c.correctAt).filter((n) => n > 0)
    if (spots.length >= 3 && new Set(spots).size === 1) {
      add('موضع الجواب', `جوابُ كلّ التمارين في الخيار ${spots[0]} — يُجاب بلا قراءة، فنوّع المواضع`)
    }
  }

  /* ٥) سيناريو القرار */
  const scenarioRaw = (m.module_scenario_ar ?? '').trim()
  if (!scenarioRaw) {
    add('سيناريو', 'لا سيناريو قرارٍ في الوحدة')
  }

  /* ٦) النشاطُ التطبيقيُّ والروبرك (§٢ و§٨).

     وهذان أطولُ ما في ميزانيّة الوحدة: النشاطُ ٥٠–٦٠ دقيقةً والمراجعةُ عشر،
     أي نصفُ المئةِ والعشرين. وكانا بلا حقلٍ في نموذج البيانات، فكان الموجودُ
     عبارةً واحدةً مولَّدةً من عنوان الوحدة تصلح لصفحة البيع ولا يعمل بها
     أحد — فبوّابةٌ تفحص المتنَ والتمرينَ وتسكت عن نصف الوحدة تُصدّق على
     وحدةٍ ناقصةٍ نصفَها. */
  const practiceRaw = (m.module_practice_ar ?? '').trim()
  if (!practiceRaw) {
    add('نشاط', 'لا نشاطَ مؤلَّفا — والنشاطُ نصفُ ميزانيّة وقت المتعلّم')
  } else {
    const r = validatePractice(practiceRaw)
    if (!r.ok) for (const e of r.errorsAr) add('نشاط', e)
    const { practice } = parsePractice(practiceRaw)
    const band = PRACTICE_MINUTES_FOR_HOURS[m.expected_hours]
    if (practice && band && (practice.minutes < band[0] || practice.minutes > band[1])) {
      add('نشاط', `زمنُ النشاط ${practice.minutes} دقيقة — ووحدةُ ${m.expected_hours} ساعات ميزانيّتُها ${band[0]}–${band[1]}`)
    }
  }

  const rubricRaw = (m.module_rubric_ar ?? '').trim()
  if (!rubricRaw) {
    add('روبرك', 'لا روبرك — فلا يعرف المتعلّم بم يُراجع مخرَجه قبل التسليم')
  } else {
    const r = validateRubric(rubricRaw)
    if (!r.ok) for (const e of r.errorsAr) add('روبرك', e)
  }

  /* ٦ب) إحالةُ مكتبة وجيز (§٧) — تُفحَص بالفهرس لا بالنيّة.

     والقاعدةُ «لا يُخترع عنوانُ كتابٍ ولا رابط» لا تُفحَص إلّا بفهرسٍ يُقرأ.
     فحتّى تُربط واجهةُ «وجيز مهارات» يبقى الفهرسُ فارغا وهذا البندُ صامتا:
     حاجزٌ على ما لا يملك المؤلّفُ التحقّقَ منه حاجزٌ ظالم، وسكوتُ اثنتين
     وخمسين وحدةً عن الإحالة أصدقُ من عنوانٍ لا يُتحقَّق منه.
     وحين يُربط: يُردّ كلُّ عنوانٍ يُذكر في القسم ولا وجودَ له في الفهرس. */
  {
    const r = checkLibraryRefs(body, library)
    if (!r.pending) {
      for (const t of r.unknownTitles) {
        add('مكتبة وجيز', `العنوان «${t}» لا وجودَ له في فهرس المكتبة — ولا يُخترع عنوان`)
      }
      if (!r.hasSection) add('مكتبة وجيز', 'لا إحالةَ إلى ملخّصٍ من المكتبة — والفهرسُ مربوط')
    }
  }

  /* ٧) ما ترفضه الشاشة يُردّ هنا — لا فحصَ موازيا أضعفَ من المحرّر.

     البنودُ أعلاه سياسةُ تحرير، وهذا البندُ عقدُ المنصّة: `validateChecks`
     و`validateScenario` هما ما يحكم به الخادمُ عند الحفظ (والنشاطُ والروبرك
     يمرّان بمحلّليهما في البند السابق). وكانت البوّابةُ
     تفحص السيناريو بوجودِه وحده، فمرّت ستّةَ عشرَ سيناريو فيها عقدةٌ بخيارٍ
     واحدٍ ومعها «تأمل:» — يرفضها المحرّرُ ويقبلها الكتالوج. ووحدةٌ لا
     تُفتح في الشاشة التي تملكها ليست مؤلَّفةً بل محبوسة. */
  {
    const r = validateChecks(m.module_checks_ar)
    if (!r.ok) for (const e of r.errorsAr) add('عقد المنصّة', `تمارين: ${e}`)
  }
  if (scenarioRaw) {
    const r = validateScenario(scenarioRaw)
    if (!r.ok) for (const e of r.errorsAr) add('عقد المنصّة', `سيناريو: ${e}`)
  }

  return v
}

function main() {
  const check = process.argv.includes('--check')
  const raw = JSON.parse(readFileSync(CATALOG, 'utf8')) as { modules: Module[]; courses: Course[] }
  const all = raw.modules
  const courseSkills = new Map<string, string[]>(
    raw.courses.map((c) => [c.course_id, c.skill_slugs ?? []]),
  )
  const authored = all.filter((m) => (m.module_body_ar ?? '').trim())
  const library = JSON.parse(readFileSync(LIBRARY, 'utf8')) as LibraryIndex

  const violations = authored.flatMap((m) => auditModule(m, courseSkills, library))

  console.log(`\nبوّابةُ التأليف — ${authored.length} وحدةً مؤلَّفة من ${all.length} (${Math.round((authored.length / all.length) * 100)}٪)`)

  if (violations.length === 0) {
    console.log(`✅ ما أُلّف مطابقٌ للسياسة — لا مخالفة في ${authored.length} وحدة.\n`)
  } else {
    const byModule = new Map<string, Violation[]>()
    for (const v of violations) {
      const list = byModule.get(v.moduleId) ?? []
      list.push(v)
      byModule.set(v.moduleId, list)
    }
    console.log(`\n✗ ${violations.length} مخالفة في ${byModule.size} وحدة:\n`)

    /* خلاصةٌ بالبند قبل التفصيل — فقائمةٌ من مئتي سطرٍ تُقرأ عجزا لا عملا،
       وسطرٌ يقول «٢٣٠ في بند واحد» يقول إنّ العطبَ نمطٌ لا فوضى. */
    const byRule = new Map<string, number>()
    for (const v of violations) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1)
    for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n} في بند «${rule}»`)
    }
    console.log('')
    for (const [id, list] of byModule) {
      console.log(`  ${id}`)
      for (const v of list) console.log(`    · [${v.rule}] ${v.detail}`)
    }
    console.log('')
  }

  /* حالُ فهرس المكتبة تُعلَن — فبندٌ صامتٌ بلا إعلانٍ يُقرأ نجاحا */
  if (library.items.length === 0) {
    console.log('⏳ إحالاتُ مكتبة وجيز (§٧) معلَّقة — بانتظار ربط واجهة «وجيز مهارات».')
    console.log('   وحين تُربط يصير كلُّ عنوانٍ يُذكر مقابَلا بالفهرس.\n')
  } else {
    console.log(`📚 فهرسُ المكتبة مربوط: ${library.items.length} ملخّصا — والإحالاتُ تُقابَل به.\n`)
  }

  /* التغطيةُ تُعرض ولا تُسقط: من لم يؤلّف بعدُ لم يخالف */
  const remaining = all.length - authored.length
  if (remaining > 0) console.log(`📋 بقي ${remaining} وحدةً بلا متن — تُؤلَّف على السياسة نفسِها.\n`)

  /* ─── خطُّ الأساس: يُمنع الجديدُ ولا يُجمَّد الإصلاح ─── */
  const live: Record<string, number> = {}
  for (const v of violations) live[v.moduleId] = (live[v.moduleId] ?? 0) + 1
  const sorted = Object.fromEntries(Object.entries(live).sort(([a], [b]) => a.localeCompare(b)))

  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, JSON.stringify({ modules: sorted }, null, 2) + '\n', 'utf8')
    console.log(`✅ حُدّث خطُّ الأساس: ${violations.length} مخالفة في ${Object.keys(sorted).length} وحدة.\n`)
    return
  }

  if (!check) return

  if (!existsSync(BASELINE)) {
    console.error(`❌ لا خطَّ أساسٍ في ${BASELINE} — شغّل الأمر بـ--update والتزم الناتج.\n`)
    process.exit(1)
  }
  const base = (JSON.parse(readFileSync(BASELINE, 'utf8')) as { modules: Record<string, number> }).modules
  const worse: string[] = []
  for (const [id, n] of Object.entries(sorted)) {
    const was = base[id] ?? 0
    if (n > was) worse.push(was === 0 ? `${id}: مخالفةٌ جديدة (${n})` : `${id}: ${was} ← ${n}`)
  }
  const better = Object.entries(base).filter(([id, n]) => (sorted[id] ?? 0) < n)

  if (worse.length > 0) {
    console.error('❌ مخالفاتٌ فوق خطّ الأساس — تُصلَح قبل الدمج:\n')
    for (const w of worse) console.error(`   · ${w}`)
    console.error('')
    process.exit(1)
  }
  if (better.length > 0) {
    console.log(`✅ لا مخالفةَ جديدة — و${better.length} وحدةً تحسّنت. شُدَّ الحزام: --update\n`)
  } else {
    console.log('✅ لا مخالفةَ فوق خطّ الأساس.\n')
  }
}

/* لا يعمل إلّا تشغيلا مباشرا.

   `check-authoring-files.ts` يستورد `auditModule` منه ليفحص ملفّاتِ التأليف
   قبل تطبيقها **بالبوّابة نفسِها** لا بنسخةٍ منها. وكان الاستيرادُ يُشغّل
   `main()` فتعمل البوّابةُ على الكتالوج ويظهر جوابُها مكانَ جواب الفاحص —
   فيُقرأ «لا مخالفة» وفي الملفّات مخالفة. */
const runDirect =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '\u0000')

if (runDirect) main()
