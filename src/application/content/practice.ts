/* النشاط التطبيقيّ (البند ح-٦) — نصفُ ميزانيّة وقت المتعلّم، وكان أطولَ ما
   في الوحدة بلا مؤلَّف. فسياسة التأليف تحجز له ٥٠–٦٠ دقيقة من مئةٍ وعشرين
   (`docs/AUTHORING-POLICY.md` §٢) وتشترط عليه ثلاثةَ شروطٍ في §٨ — على شيءٍ
   حقيقيٍّ من عمل المتعلّم، وبديلٌ محدَّدٌ لمن لا عمل له، وخطواتٌ مرقّمةٌ
   بزمنٍ معلَن — ثمّ لم يكن في نموذج البيانات حقلٌ يحمل شيئا من ذلك: كان
   `practice_activity_ar` عبارةً واحدةً مولَّدةً من عنوان الوحدة
   («تحليل حالة قصيرة وتحديد القرارات المرتبطة بـ…»)، تصلح لوصف الدورة في
   صفحة البيع ولا تصلح أن يعمل بها أحد.

   فهذه الوحدة تحمل النشاطَ المؤلَّف، ويبقى `practice_activity_ar` كما هو
   لصفحة الدورة — لا يُهدَم حقلٌ يُقرأ في مكانٍ آخر.

   الصيغة نصّية بقصد — تُخزَّن على إصدار الوحدة كما يُخزَّن المتن والتمرين
   والسيناريو، فتمرّ بنفس حاكميّة النسخ والاعتماد والنشر وتُقارَن نصّا في
   السجل:

     نشاط: خريطةُ رسالةٍ لعرضٍ ستقدّمه فعلا
     زمن: 55
     مخرَج: خريطةُ رسالةٍ في صفحةٍ واحدة، ملفٌّ يُرفع
     بديل: من لا عمل له: عرضُ مشروعٍ جامعيٍّ أو نادٍ طلّابيّ — نفسُ الخطوات
     > خطوة: 10 · اختر عرضا سيُقدَّم خلال شهرٍ واكتب من يقرّر فيه
     > خطوة: 20 · اكتب الفكرةَ الرئيسةَ جملةً فيها حكمٌ يمكن أن يُخالَف
     > خطوة: 15 · اكتب ثلاثَ ركائزَ ومعها سندُ كلٍّ منها
     > خطوة: 10 · اقرأ الخريطةَ وحدَها واحكم: أتُفهَم بلا شرحك؟

   والقواعد التي يفرضها المدقّق — كلُّ واحدةٍ تمنع نشاطا يبدو صحيحا وهو معطوب:
   - مجموعُ أزمنة الخطوات يساوي `زمن:` المعلَن. فنشاطٌ زمنُه ٥٥ وخطواتُه
     تجمع ٢٠ دقيقةً ليس نشاطَ ٥٥ دقيقة، وهذا أشيعُ ما يقع حين تُكتب
     الخطواتُ ثمّ يُقدَّر الزمنُ من الذاكرة.
   - `زمن:` داخل حدّ الميزانيّة — فما دون الأربعين لا يُنتج مخرَجا يُراجَع،
     وما فوق الخمس والسبعين يأكل زمنَ الدروس والتمارين.
   - `مخرَج:` لا يكون «إجابات الأسئلة» ولا «تلخيص ما قرأت» — القاعدةُ صريحةٌ
     في §٨، والمخرَجُ قطعةٌ تدخل الملفَّ المهنيّ.
   - `بديل:` لا يُفتح بـ«تخيّل أنّك» — البديلُ لمن لا عمل له مهمّةٌ محدَّدةٌ
     معلَنة، لا دعوةٌ إلى التخيّل.
   - ثلاثُ خطواتٍ على الأقلّ وسبعٌ على الأكثر، ولكلّ خطوةٍ زمنٌ لا يقلّ عن
     ثلاث دقائق — فخطوةٌ من دقيقةٍ بندٌ في قائمةٍ لا خطوةُ عمل. */

export interface PracticeStep {
  /** زمن الخطوة بالدقائق */
  minutes: number
  textAr: string
}

export interface Practice {
  titleAr: string
  /** الزمن المعلَن بالدقائق — يساوي مجموع أزمنة الخطوات */
  minutes: number
  /** المخرَج: قطعةٌ تدخل الملفَّ المهنيّ */
  artifactAr: string
  /** بديلُ من لا عمل له — محدَّدٌ معلَن، لا «تخيّل أنّك» */
  alternativeAr: string
  steps: PracticeStep[]
}

export interface PracticeParseResult {
  practice: Practice | null
  /** أخطاء مقروءة للمؤلّف — تُعرض عند الحفظ لا عند العرض */
  errorsAr: string[]
}

/** حدُّ ميزانيّة النشاط بالدقائق — §٢ تحجز ٥٠–٦٠، والحدُّ أوسعُ منها قليلا
    لأنّ وحدةَ الثلاث ساعات نشاطُها أوسع، ووحدةً أو أخرى تنزل إلى الأربعين
    حين يكون المخرَجُ صفحةً واحدة. وما خرج عن الحدّ خللٌ لا اجتهاد. */
export const MIN_MINUTES = 40
export const MAX_MINUTES = 75
export const MIN_STEPS = 3
export const MAX_STEPS = 7
export const MIN_STEP_MINUTES = 3

/** مخرَجٌ لا يُقبل — §٨: قطعةٌ تدخل الملفَّ المهنيّ لا إجابةُ سؤال */
const BAD_ARTIFACT = /إجابات\s+الأسئلة|تلخيص\s+ما\s+قرأت|ملخّ?ص\s+ما\s+قرأت/u
/** بديلٌ لا يُقبل — §٨: بديلٌ محدَّدٌ معلَن لا دعوةٌ إلى التخيّل */
const BAD_ALTERNATIVE = /تخيّ?ل\s+أن/u

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
/** يقبل الأرقامَ العربيّةَ والهنديّةَ معا — المؤلّفُ يكتب بالعربيّة */
function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/gu, (d) => String(AR_DIGITS.indexOf(d)))
}

/** يحلّل الصيغة النصّية، ويعيد أخطاء مقروءة بدل الرمي */
export function parsePractice(raw: string | null | undefined): PracticeParseResult {
  const errorsAr: string[] = []
  if (!raw || !raw.trim()) return { practice: null, errorsAr }

  let titleAr: string | null = null
  let minutes: number | null = null
  let artifactAr: string | null = null
  let alternativeAr: string | null = null
  const steps: PracticeStep[] = []

  const once = (key: string, had: unknown) => {
    if (had !== null) errorsAr.push(`«${key}:» مكرَّر — واحدٌ لكلّ نشاط`)
  }

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim()
    if (t === '') continue

    const st = /^>\s*خطوة\s*[:：]\s*([0-9٠-٩]{1,3})\s*[·.:\-—]\s*(.+)$/u.exec(t)
    if (st) {
      const m = Number(toLatinDigits(st[1]))
      const text = st[2].trim()
      if (m < MIN_STEP_MINUTES) errorsAr.push(`الخطوة «${text.slice(0, 30)}»: ${m} دقيقة — أقلُّ خطوةٍ ${MIN_STEP_MINUTES} دقائق`)
      if (text.split(/\s+/u).length < 4) errorsAr.push(`الخطوة «${text}»: أقصرُ من أن تُنفَّذ — اكتب ما يُفعل بالضبط`)
      steps.push({ minutes: m, textAr: text })
      continue
    }

    const kv = /^(نشاط|زمن|مخرَ?ج|بديل)\s*[:：]\s*(.+)$/u.exec(t)
    if (kv) {
      const v = kv[2].trim()
      switch (kv[1]) {
        case 'نشاط': once('نشاط', titleAr); titleAr = v; break
        case 'زمن': {
          once('زمن', minutes)
          const n = Number(toLatinDigits(v).replace(/[^0-9]/gu, ''))
          if (!Number.isFinite(n) || n === 0) errorsAr.push(`«زمن: ${v}» — اكتب الدقائق رقما`)
          else minutes = n
          break
        }
        case 'مخرج':
        case 'مخرَج': once('مخرَج', artifactAr); artifactAr = v; break
        case 'بديل': once('بديل', alternativeAr); alternativeAr = v; break
      }
      continue
    }

    errorsAr.push(`سطر غير مفهوم: «${t.slice(0, 40)}» — تبدأ الأسطر بـ«نشاط:» أو «زمن:» أو «مخرَج:» أو «بديل:» أو «> خطوة:»`)
  }

  if (!titleAr) errorsAr.push('لا «نشاط:» — ابدأ بعنوان النشاط')
  if (minutes === null) errorsAr.push('لا «زمن:» — زمنُ النشاط معلَنٌ بالدقائق')
  if (!artifactAr) errorsAr.push('لا «مخرَج:» — ما القطعةُ التي تدخل ملفَّه المهنيّ؟')
  if (!alternativeAr) errorsAr.push('لا «بديل:» — ماذا يفعل من لا عمل له؟')

  if (artifactAr && BAD_ARTIFACT.test(artifactAr)) {
    errorsAr.push('المخرَجُ «إجابات الأسئلة» أو «تلخيص ما قرأت» لا يُقبل — قطعةٌ تدخل ملفَّه المهنيّ')
  }
  if (alternativeAr && BAD_ALTERNATIVE.test(alternativeAr)) {
    errorsAr.push('البديلُ لا يُفتح بـ«تخيّل أنّك» — مهمّةٌ محدَّدةٌ معلَنة')
  }

  if (steps.length < MIN_STEPS) errorsAr.push(`عددُ الخطوات ${steps.length} — أقلُّها ${MIN_STEPS}`)
  else if (steps.length > MAX_STEPS) errorsAr.push(`عددُ الخطوات ${steps.length} — الحدّ ${MAX_STEPS}`)

  if (minutes !== null) {
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      errorsAr.push(`زمنُ النشاط ${minutes} دقيقة — الميزانيّة ${MIN_MINUTES}–${MAX_MINUTES}`)
    }
    const sum = steps.reduce((a, s) => a + s.minutes, 0)
    if (steps.length > 0 && sum !== minutes) {
      errorsAr.push(`مجموعُ أزمنة الخطوات ${sum} و«زمن:» ${minutes} — يتساويان`)
    }
  }

  if (errorsAr.length > 0) return { practice: null, errorsAr }
  return {
    practice: { titleAr: titleAr!, minutes: minutes!, artifactAr: artifactAr!, alternativeAr: alternativeAr!, steps },
    errorsAr,
  }
}

/** صيغةٌ صالحةٌ بلا أخطاء — تُستعمل عند الحفظ */
export function validatePractice(
  raw: string | null | undefined,
): { ok: true } | { ok: false; errorsAr: string[] } {
  const { practice, errorsAr } = parsePractice(raw)
  if (errorsAr.length > 0) return { ok: false, errorsAr }
  if (!practice) return { ok: false, errorsAr: ['لا نشاط مفهوم — الصيغة: «نشاط:» و«زمن:» و«مخرَج:» و«بديل:» ثم «> خطوة: N · نص»'] }
  return { ok: true }
}
