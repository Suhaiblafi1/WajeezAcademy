/* تمرين الاسترجاع (البند ح-٣) — أقوى صيغة بالدليل البحثي: من مارس الاسترجاع
   احتفظ بالمعلومة أضعاف من أعاد الدراسة. ثلاثة أسئلة بعد الوحدة، تصحيح فوري
   وشرح للخطأ — داخل مسار التعلم لا كواجب منفصل ولا درجة.

   الصيغة نصّية بقصد: تُخزَّن على إصدار الوحدة كما يُخزَّن المتن، فتمرّ بنفس
   حاكمية النسخ والاعتماد والنشر، وتُقرأ في سجل الإصدارات كنصّ مقارَن.

     س: ما الصفة التي لا تكفي وحدها لأتمتة مهمة؟
     - انتظام المدخلات
     + تكرارها اليومي
     - حسم القرار بقاعدة
     ش: التكرار وحده لا يكفي — لا بد من انتظام المدخلات وحسم القرار بقاعدة.

   `+` تسبق الجواب الصحيح (واحد لا أكثر) · `ش:` الشرح (اختياري) ·
   `ف: N` يربطه بفصل فيديو (ح-٢) · `م: slug` يربطه بمهارة من الكتالوج (ح-٤) ·
   الأسئلة يفصلها سطر فارغ أو سؤال جديد. */

export interface ModuleCheck {
  promptAr: string
  options: string[]
  correctIndex: number
  explainAr: string | null
  /** نقطة تفتيش بعد فصل فيديو (ح-٢) — رقم الفصل بدءا من ١، وnull لسؤال الوحدة */
  chapterIndex: number | null
  /** شريحة المهارة التي يقيسها السؤال (ح-٤) — null فتُعرض البطاقة بعنوان الوحدة.
      ربطها لا يرفع مستوى المهارة ولا يخفضه: الاسترجاع دليل تذكّر لا قياس. */
  skillSlug: string | null
}

export interface ParseResult {
  checks: ModuleCheck[]
  /** أخطاء مقروءة للمؤلّف — تُعرض عند الحفظ لا عند العرض */
  errorsAr: string[]
}

/** أقصى عدد أسئلة للوحدة — ثلاثة هو ما تسنده الدراسة، والحدُّ سبعة.

    والسبعةُ ليست توسيعا للحدّ بل موافقةٌ لسياسة التأليف: وحدةُ الساعتين
    خمسةُ أسئلة، ووحدةُ الثلاث ساعات سبعة (`docs/AUTHORING-POLICY.md` §٢).
    وكان الحدُّ خمسةً فلم يكن لوحدة الثلاث ساعات سبيلٌ إلى الحفظ — تُردّ
    بـ٤٢٢ في المحرّر، وقد دخلت أربعُ وحداتٍ منها الكتالوجَ بأداةٍ لا تمرّ
    بهذا المحلّل، فبقيت غيرَ قابلةٍ للتحرير في الشاشة نفسِها التي تملكها. */
export const MAX_CHECKS = 7
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 5

/** يحلّل الصيغة النصّية إلى أسئلة، ويعيد أخطاء مقروءة بدل الرمي */
export function parseChecks(raw: string | null | undefined): ParseResult {
  const errorsAr: string[] = []
  const checks: ModuleCheck[] = []
  if (!raw || !raw.trim()) return { checks, errorsAr }

  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  let cur: { promptAr: string; options: string[]; correct: number[]; explainAr: string | null; chapterIndex: number | null; skillSlug: string | null } | null = null
  const close = () => {
    if (!cur) return
    const at = `السؤال «${cur.promptAr.slice(0, 30)}»`
    if (cur.options.length < MIN_OPTIONS) errorsAr.push(`${at}: يحتاج خيارين على الأقل`)
    else if (cur.options.length > MAX_OPTIONS) errorsAr.push(`${at}: أكثر من ${MAX_OPTIONS} خيارات`)
    else if (cur.correct.length === 0) errorsAr.push(`${at}: لا جواب صحيح — ضع + قبل الصحيح`)
    else if (cur.correct.length > 1) errorsAr.push(`${at}: أكثر من جواب صحيح — واحد فقط`)
    else checks.push({ promptAr: cur.promptAr, options: cur.options, correctIndex: cur.correct[0], explainAr: cur.explainAr, chapterIndex: cur.chapterIndex, skillSlug: cur.skillSlug })
    cur = null
  }

  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue
    const q = /^س\s*[:：]\s*(.+)$/.exec(t)
    if (q) {
      close()
      cur = { promptAr: q[1].trim(), options: [], correct: [], explainAr: null, chapterIndex: null, skillSlug: null }
      continue
    }
    const ex = /^ش\s*[:：]\s*(.+)$/.exec(t)
    if (ex) {
      if (cur) cur.explainAr = ex[1].trim()
      else errorsAr.push('شرح قبل أي سؤال — ابدأ بـ«س:»')
      continue
    }
    /* «ف: N» يربط السؤال بفصل فيديو فيصير نقطة تفتيش بعده (ح-٢) */
    const ch = /^ف\s*[:：]\s*(\d{1,2})$/.exec(t)
    if (ch) {
      if (cur) cur.chapterIndex = Number(ch[1])
      else errorsAr.push('ربط بفصل قبل أي سؤال — ابدأ بـ«س:»')
      continue
    }
    /* «م: slug» يربط السؤال بمهارة مصنّفة، فتصير بطاقة الاسترجاع بطاقة مهارة (ح-٤) */
    const sk = /^م\s*[:：]\s*([a-z0-9_]{2,80})$/.exec(t)
    if (sk) {
      if (cur) cur.skillSlug = sk[1]
      else errorsAr.push('ربط بمهارة قبل أي سؤال — ابدأ بـ«س:»')
      continue
    }
    const opt = /^([+\-*])\s+(.+)$/.exec(t)
    if (opt) {
      if (!cur) { errorsAr.push('خيار قبل أي سؤال — ابدأ بـ«س:»'); continue }
      if (opt[1] === '+') cur.correct.push(cur.options.length)
      cur.options.push(opt[2].trim())
      continue
    }
    errorsAr.push(`سطر غير مفهوم: «${t.slice(0, 40)}» — تبدأ الأسطر بـ«س:» أو «-» أو «+» أو «ش:» أو «ف:» أو «م:»`)
  }
  close()

  if (checks.length > MAX_CHECKS) {
    errorsAr.push(`عدد الأسئلة ${checks.length} — الحدّ ${MAX_CHECKS}`)
    checks.length = MAX_CHECKS
  }
  return { checks, errorsAr }
}

/**
 * صيغة صالحة بلا أخطاء وبسؤال واحد على الأقل — تُستعمل عند الحفظ.
 * @param knownSlugs شرائح المهارات المعروفة؛ إن مُرِّرت رُفض ربطٌ بمهارة غير موجودة.
 *   تُمرَّر من حدود الكتابة لا تُستورد هنا، فتبقى هذه الوحدة نقية بلا كتالوج.
 */
export function validateChecks(
  raw: string | null | undefined,
  knownSlugs?: ReadonlySet<string>,
): { ok: true } | { ok: false; errorsAr: string[] } {
  const { checks, errorsAr } = parseChecks(raw)
  if (knownSlugs) {
    for (const c of checks) {
      if (c.skillSlug && !knownSlugs.has(c.skillSlug)) {
        errorsAr.push(`مهارة غير معروفة في «م: ${c.skillSlug}» — اختر شريحة من كتالوج المهارات`)
      }
    }
  }
  if (errorsAr.length > 0) return { ok: false, errorsAr }
  if (checks.length === 0) return { ok: false, errorsAr: ['لا سؤال مفهوم — الصيغة: «س: نص» ثم خيارات بـ- و+'] }
  return { ok: true }
}
