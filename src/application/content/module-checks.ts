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
   الأسئلة يفصلها سطر فارغ أو سؤال جديد. */

export interface ModuleCheck {
  promptAr: string
  options: string[]
  correctIndex: number
  explainAr: string | null
  /** نقطة تفتيش بعد فصل فيديو (ح-٢) — رقم الفصل بدءا من ١، وnull لسؤال الوحدة */
  chapterIndex: number | null
}

export interface ParseResult {
  checks: ModuleCheck[]
  /** أخطاء مقروءة للمؤلّف — تُعرض عند الحفظ لا عند العرض */
  errorsAr: string[]
}

/** أقصى عدد أسئلة للوحدة — ثلاثة هو ما تسنده الدراسة، ونسمح بخمسة كحدّ */
export const MAX_CHECKS = 5
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 5

/** يحلّل الصيغة النصّية إلى أسئلة، ويعيد أخطاء مقروءة بدل الرمي */
export function parseChecks(raw: string | null | undefined): ParseResult {
  const errorsAr: string[] = []
  const checks: ModuleCheck[] = []
  if (!raw || !raw.trim()) return { checks, errorsAr }

  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  let cur: { promptAr: string; options: string[]; correct: number[]; explainAr: string | null; chapterIndex: number | null } | null = null
  const close = () => {
    if (!cur) return
    const at = `السؤال «${cur.promptAr.slice(0, 30)}»`
    if (cur.options.length < MIN_OPTIONS) errorsAr.push(`${at}: يحتاج خيارين على الأقل`)
    else if (cur.options.length > MAX_OPTIONS) errorsAr.push(`${at}: أكثر من ${MAX_OPTIONS} خيارات`)
    else if (cur.correct.length === 0) errorsAr.push(`${at}: لا جواب صحيح — ضع + قبل الصحيح`)
    else if (cur.correct.length > 1) errorsAr.push(`${at}: أكثر من جواب صحيح — واحد فقط`)
    else checks.push({ promptAr: cur.promptAr, options: cur.options, correctIndex: cur.correct[0], explainAr: cur.explainAr, chapterIndex: cur.chapterIndex })
    cur = null
  }

  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue
    const q = /^س\s*[:：]\s*(.+)$/.exec(t)
    if (q) {
      close()
      cur = { promptAr: q[1].trim(), options: [], correct: [], explainAr: null, chapterIndex: null }
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
    const opt = /^([+\-*])\s+(.+)$/.exec(t)
    if (opt) {
      if (!cur) { errorsAr.push('خيار قبل أي سؤال — ابدأ بـ«س:»'); continue }
      if (opt[1] === '+') cur.correct.push(cur.options.length)
      cur.options.push(opt[2].trim())
      continue
    }
    errorsAr.push(`سطر غير مفهوم: «${t.slice(0, 40)}» — تبدأ الأسطر بـ«س:» أو «-» أو «+» أو «ش:» أو «ف:»`)
  }
  close()

  if (checks.length > MAX_CHECKS) {
    errorsAr.push(`عدد الأسئلة ${checks.length} — الحدّ ${MAX_CHECKS}`)
    checks.length = MAX_CHECKS
  }
  return { checks, errorsAr }
}

/** صيغة صالحة بلا أخطاء وبسؤال واحد على الأقل — تُستعمل عند الحفظ */
export function validateChecks(raw: string | null | undefined): { ok: true } | { ok: false; errorsAr: string[] } {
  const { checks, errorsAr } = parseChecks(raw)
  if (errorsAr.length > 0) return { ok: false, errorsAr }
  if (checks.length === 0) return { ok: false, errorsAr: ['لا سؤال مفهوم — الصيغة: «س: نص» ثم خيارات بـ- و+'] }
  return { ok: true }
}
