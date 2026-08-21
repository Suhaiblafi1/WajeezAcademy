/* سياسة ساعات الدورة (البند ب-٥).

   المشكلة: `duration_propose` يقبل أي رقم موجب، و`module_add` يراكم بلا سقف،
   والساعات ليست في الحقول المحظورة. فمدرب واحد يستطيع أن يضاعف ساعات دورة
   تدخل في سبع خطط مركبة — و٣٤ ساعة إضافية على خطة مركبة تلتهم عتبة القيمة
   الإضافية كاملة، فتصير الخطة أثقل من المسار المفرد الذي تنافسه.

   ثلاث قواعد، وكلها معلَنة للمقترِح لا مفاجئة له:
   ١) الساعات في [١، ٤٠] — الكتالوج المنشور اليوم ٨–١٢، والمدى يترك مجالا.
   ٢) ما تجاوز ±٥٠٪ من الأصل يحتاج مبررا مكتوبا. لا منع: تغييرٌ كبير قد يكون
      صحيحا، لكن من يطلبه يكتب سببه فيقرأه المعتمِد.
   ٣) أثر الساعات على الخطط المركبة يُعرض للمعتمِد بالأرقام قبل الاعتماد.

   الوحدة نقية: لا قاعدة بيانات ولا وقت — تُختبَر بلا تشغيل خادم. */

export const COURSE_HOURS_MIN = 1
export const COURSE_HOURS_MAX = 40
/** حدّ التغيير النسبي الذي يستوجب مبررا مكتوبا */
export const RELATIVE_CAP = 0.5
/** أدنى طول مبرر مقبول — «تحديث» ليست مبررا */
export const MIN_JUSTIFICATION = 20

export interface HoursCheck {
  ok: boolean
  errorsAr: string[]
  /** ما يُعرض للمعتمِد ولا يمنع الحفظ */
  warningsAr: string[]
  /** الفرق عن الأصل بالساعات — سالب للتخفيض */
  deltaHours: number
  /** نسبة التغيير عن الأصل — Infinity إن كان الأصل صفرا */
  ratio: number
}

/**
 * يفحص اقتراح ساعات لدورة.
 * @param baseHours ساعات الإصدار الأساسي
 * @param proposedHours الساعات المقترحة (بعد تطبيق كل بنود الاقتراح)
 * @param justificationAr سبب الاقتراح كما كتبه المقترِح
 */
export function checkHoursProposal(
  baseHours: number,
  proposedHours: number,
  justificationAr?: string | null,
): HoursCheck {
  const errorsAr: string[] = []
  const warningsAr: string[] = []
  const delta = proposedHours - baseHours
  const ratio = baseHours > 0 ? Math.abs(delta) / baseHours : Infinity

  if (!Number.isFinite(proposedHours) || !Number.isInteger(proposedHours)) {
    errorsAr.push('الساعات المقترحة يجب أن تكون عددا صحيحا')
  } else if (proposedHours < COURSE_HOURS_MIN || proposedHours > COURSE_HOURS_MAX) {
    errorsAr.push(
      `الساعات المقترحة ${proposedHours} خارج المدى [${COURSE_HOURS_MIN}، ${COURSE_HOURS_MAX}] — ` +
      'الدورة وحدة تعليمية لا برنامج كامل',
    )
  }

  const justified = (justificationAr ?? '').trim().length >= MIN_JUSTIFICATION
  if (errorsAr.length === 0 && ratio > RELATIVE_CAP) {
    const pct = Math.round(ratio * 100)
    if (!justified) {
      errorsAr.push(
        `تغيير الساعات ${baseHours} ← ${proposedHours} يتجاوز ${Math.round(RELATIVE_CAP * 100)}٪ من الأصل ` +
        `(${pct}٪) — اكتب مبررا لا يقل عن ${MIN_JUSTIFICATION} حرفا يقرؤه المعتمِد`,
      )
    } else {
      warningsAr.push(
        `تغيير كبير في الساعات: ${baseHours} ← ${proposedHours} (${pct}٪ من الأصل) — مبرَّر كتابةً، ` +
        'وأثره على الخطط المركبة أدناه',
      )
    }
  }

  return { ok: errorsAr.length === 0, errorsAr, warningsAr, deltaHours: delta, ratio }
}

/* ══════════ أثر الساعات على الخطط المركبة ══════════ */

/** حدّ نسبي: زيادة تتجاوز خمس الخطة تغيّر ثقلها أمام المسار المفرد الذي تنافسه */
export const PLAN_GROWTH_CAP = 0.2
/** سقف مطلق فوق أعلى خطة منشورة اليوم (٦٤ ساعة) بهامش معقول */
export const PLAN_HOURS_CEILING = 80

export interface PlanHoursImpact {
  templateId: string
  templateNameAr: string
  beforeHours: number
  afterHours: number
  deltaHours: number
}

/** يحوّل أثر الخطط إلى تحذيرات مقروءة — الأرقام تُعرض دائما، والتحذير عند تجاوز حدّ */
export function planHoursWarnings(impacts: PlanHoursImpact[]): string[] {
  const out: string[] = []
  for (const p of impacts) {
    if (p.deltaHours === 0) continue
    const grew = p.beforeHours > 0 ? p.deltaHours / p.beforeHours : Infinity
    if (grew > PLAN_GROWTH_CAP) {
      out.push(
        `الخطة ${p.templateId} («${p.templateNameAr}»): ${p.beforeHours} ← ${p.afterHours} ساعة ` +
        `(+${Math.round(grew * 100)}٪) — تصير أثقل من المسار المفرد الذي تنافسه`,
      )
    } else if (p.afterHours > PLAN_HOURS_CEILING) {
      out.push(
        `الخطة ${p.templateId} («${p.templateNameAr}») تبلغ ${p.afterHours} ساعة — فوق سقف ${PLAN_HOURS_CEILING}`,
      )
    }
  }
  return out
}
