/* الروبرك (البند ح-٧) — المعايير التي يُراجع بها المتعلّم مخرَجه قبل أن
   يُسلّمه، وهي نفسُها التي يُراجع بها المدرّب بعده. وسياسة التأليف تحجز لها
   عشرَ دقائق من ميزانيّة الوحدة (`docs/AUTHORING-POLICY.md` §٢) وتشترط في
   §٨ ثلاثةَ معاييرَ لا أكثر، كلٌّ منها ثلاثةُ مستوياتٍ موصوفةٍ **بالسلوك لا
   بالصفة** — ثمّ لم يكن في نموذج البيانات حقلٌ يحمل معيارا واحدا: كانت
   المراجعةُ الذاتيّةُ بابا في السياسة بلا مكانٍ في المنصّة.

   والصيغة نصّية بقصد، كسائر محتوى الإصدار:

     معيار: كلُّ ركيزةٍ معها سندُها
     - 3: لكلّ ركيزةٍ سندٌ مسمّى صنفُه، ومكتوبٌ ما الذي يُبطلها
     - 2: الركائزُ مسنودةٌ ولا يُذكر ما يُبطلها
     - 1: ركيزةٌ أو أكثرُ بلا سندٍ يُرى

     معيار: الفكرةُ الرئيسةُ تُخالَف
     - 3: جملةٌ فيها حكمٌ يمكن أن يرفضه زميلٌ معقول
     - 2: جملةٌ فيها حكمٌ عامٌّ لا يُنازَع فيه أحد
     - 1: موضوعٌ مسمًّى بلا حكم

   والقواعد التي يفرضها المدقّق:
   - المستوى يُوصَف بالسلوك: «ممتاز» و«جيّد» و«مقبول» و«متميّز» تُردّ — وهي
     صفةُ حكمٍ لا وصفُ عمل، ومن كتبها لم يُعطِ المتعلّم ما يُقارن به مخرَجه.
   - ثلاثةُ مستوياتٍ لكلّ معيار بأرقام ٣ و٢ و١ — مستويانِ يجعلان المراجعةَ
     نعم/لا، وأربعةٌ لا يُفرَّق بينها في العربيّة بوصفٍ يصمد.
   - معياران على الأقلّ وثلاثةٌ على الأكثر (§٨: «ثلاثةُ معاييرَ لا أكثر»).
   - كلُّ وصفٍ أربعُ كلماتٍ على الأقلّ — فوصفٌ من كلمتين صفةٌ متنكّرة. */

export interface RubricLevel {
  /** ٣ أعلى · ٢ أوسط · ١ أدنى */
  level: 3 | 2 | 1
  textAr: string
}

export interface RubricCriterion {
  titleAr: string
  /** ثلاثةٌ دائما، مرتّبةٌ من الأعلى إلى الأدنى */
  levels: RubricLevel[]
}

export interface Rubric {
  criteria: RubricCriterion[]
}

export interface RubricParseResult {
  rubric: Rubric | null
  /** أخطاء مقروءة للمؤلّف — تُعرض عند الحفظ لا عند العرض */
  errorsAr: string[]
}

export const MIN_CRITERIA = 2
export const MAX_CRITERIA = 3
export const LEVELS = 3
export const MIN_LEVEL_WORDS = 4

/* صفةُ حكمٍ في موضع وصفِ سلوك — §٨ تردّها بمثالها الصريح.
   والقائمةُ مقصورةٌ على صفات الحكم الصريحة: «متوسّط» و«كافٍ» أُخرجتا لأنّهما
   تفتتحان وصفَ سلوكٍ مشروعا («متوسّطُ الانتظار مكتوبٌ في الشريحة») — وبوّابةٌ
   تُنذر بالباطل تُعلَّم أن تُتجاوَز. و`\b` لا تعمل بعد حرفٍ عربيٍّ في
   JavaScript (الحروفُ العربيّةُ ليست من `\w`)، فالحدُّ مسافةٌ أو فاصلةٌ أو نهاية. */
const ADJECTIVE_ONLY = /^(ممتاز|جيّ?د|مقبول|متميّ?ز|ضعيف|غير\s+كافٍ?)(\s|[—،.:-]|$)/u

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/gu, (d) => String(AR_DIGITS.indexOf(d)))
}

/** يحلّل الصيغة النصّية، ويعيد أخطاء مقروءة بدل الرمي */
export function parseRubric(raw: string | null | undefined): RubricParseResult {
  const errorsAr: string[] = []
  if (!raw || !raw.trim()) return { rubric: null, errorsAr }

  const criteria: RubricCriterion[] = []
  let cur: RubricCriterion | null = null

  const close = () => {
    if (!cur) return
    const at = `المعيار «${cur.titleAr.slice(0, 30)}»`
    if (cur.levels.length !== LEVELS) {
      errorsAr.push(`${at}: ${cur.levels.length} مستوى — ثلاثةٌ لكلّ معيار (٣ و٢ و١)`)
    } else {
      const seen = cur.levels.map((l) => l.level)
      if (new Set(seen).size !== LEVELS) errorsAr.push(`${at}: مستوًى مكرَّر — ٣ و٢ و١ مرّةً كلٌّ`)
      cur.levels.sort((a, b) => b.level - a.level)
    }
    criteria.push(cur)
    cur = null
  }

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim()
    if (t === '') continue

    const cr = /^معيار\s*[:：]\s*(.+)$/u.exec(t)
    if (cr) {
      close()
      cur = { titleAr: cr[1].trim(), levels: [] }
      continue
    }

    const lv = /^[-*]\s*([0-9٠-٩])\s*[:：]\s*(.+)$/u.exec(t)
    if (lv) {
      if (!cur) { errorsAr.push('مستوًى قبل أيّ معيار — ابدأ بـ«معيار:»'); continue }
      const n = Number(toLatinDigits(lv[1]))
      const text = lv[2].trim()
      if (n !== 3 && n !== 2 && n !== 1) {
        errorsAr.push(`المستوى «${n}» في «${cur.titleAr.slice(0, 24)}» — الأرقام ٣ و٢ و١`)
        continue
      }
      if (ADJECTIVE_ONLY.test(text)) {
        errorsAr.push(`المستوى ${n} في «${cur.titleAr.slice(0, 24)}» يبدأ بصفة حكم «${text.split(/\s+/u)[0]}» — يُوصَف بالسلوك`)
      }
      if (text.split(/\s+/u).length < MIN_LEVEL_WORDS) {
        errorsAr.push(`المستوى ${n} في «${cur.titleAr.slice(0, 24)}»: «${text}» أقصرُ من وصفِ سلوك`)
      }
      cur.levels.push({ level: n as 3 | 2 | 1, textAr: text })
      continue
    }

    errorsAr.push(`سطر غير مفهوم: «${t.slice(0, 40)}» — تبدأ الأسطر بـ«معيار:» أو «- 3:» أو «- 2:» أو «- 1:»`)
  }
  close()

  if (criteria.length < MIN_CRITERIA) errorsAr.push(`عددُ المعايير ${criteria.length} — أقلُّها ${MIN_CRITERIA}`)
  else if (criteria.length > MAX_CRITERIA) errorsAr.push(`عددُ المعايير ${criteria.length} — الحدّ ${MAX_CRITERIA}`)

  if (errorsAr.length > 0) return { rubric: null, errorsAr }
  return { rubric: { criteria }, errorsAr }
}

/** صيغةٌ صالحةٌ بلا أخطاء — تُستعمل عند الحفظ */
export function validateRubric(
  raw: string | null | undefined,
): { ok: true } | { ok: false; errorsAr: string[] } {
  const { rubric, errorsAr } = parseRubric(raw)
  if (errorsAr.length > 0) return { ok: false, errorsAr }
  if (!rubric) return { ok: false, errorsAr: ['لا معيار مفهوم — الصيغة: «معيار: نص» ثم ثلاثة مستويات «- 3:» و«- 2:» و«- 1:»'] }
  return { ok: true }
}
