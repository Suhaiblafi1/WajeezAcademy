/* سياسة نطاق اقتراح المدرب (البند هـ-١).

   القاعدة: **نطاق الشعبة هو الافتراضي**. المدرب الجديد يجرّب ويبدع في شعبته
   بلا مخاطرة على أحد — تعديله لا يمسّ الكتالوج ولا التشخيص ولا متعلما في شعبة
   غيره. ونطاق الكتالوج صلاحية تُمنح لا حقٌّ يُفترض، لأنها تصل إلى كل مسار
   وقالب وشعبة تستخدم الدورة (انظر دائرة الأثر ب-١).

   طريقان للنطاق الأوسع — أحدهما مكتسب والآخر ممنوح، ولا ثالث:
   ١) سجل مثبت: اقتراحان نُشرا في نطاق الشعبة على الأقل. مقياس لا رأي.
   ٢) منح صريح من الإدارة بتاريخ ومُمنِح مسجَّلين.

   ولا منع بلا بديل: من لا يملك النطاق يُقال له ما يملكه وما يبلغه به. */

/** اقتراحات منشورة في نطاق الشعبة تكفي لاكتساب نطاق الكتالوج */
export const CATALOG_SCOPE_MIN_PUBLISHED = 2

/* ── والاسمُ وحدَه مستثنى (ح-٣) ──

   البوّابةُ أعلاه معلَّلةٌ بنصّها: «نطاق الكتالوج يصل إلى كلّ مسار وقالب
   وشعبة تستخدم الدورة» — أي أنّها تحرس **الأثرَ البنيويّ**: الساعاتِ
   والمحاورَ والمخرجات. واقتراحُ اسمٍ لا يمسّ منها شيئا: لا ساعةً يزيد، ولا
   محورا يضيف، ولا مهارةً يربط، ولا متعلّما يُنقَل. ولا ينشر نفسَه — يعتمده
   المديرُ الأكاديميُّ وينشره، وله دائرةُ أثرٍ تُعرض له قبل أن يقرّر.

   ولولا الاستثناء لضاق البابُ بحذف «اقتراحٌ للإدارة» (د-٦): كان صندوقُه
   مفتوحا لكلّ مدرّب، فلو وَرِثَته بوّابةٌ تشترط اقتراحَين منشورَين لصار
   المدرّبُ الجديدُ بلا بابٍ أصلا — وحذفُ صندوقٍ يجب أن يوسّع لا أن يضيّق.

   والاستثناءُ **للاسم وحدَه**: بندٌ واحدٌ آخرُ يركب مع الاسم يُعيد البوّابة. */
export const TITLE_ONLY_CHANGE = 'course_title_edit'

/** أيحتاج هذا الاقتراحُ بنطاق الكتالوج إلى الصلاحية؟ — الاسمُ وحدَه لا يحتاج */
export function needsCatalogScope(changeTypes: readonly string[]): boolean {
  if (changeTypes.length === 0) return true
  return !changeTypes.every((t) => t === TITLE_ONLY_CHANGE)
}

export interface ScopeFacts {
  /** ISO أو null — منح صريح من الإدارة */
  grantedAt: string | null
  /** اقتراحات هذا المدرب التي نُشرت في نطاق الشعبة */
  publishedCohortProposals: number
}

export interface ScopeGate {
  allowed: boolean
  /** earned | granted | none — لماذا سُمح أو لم يُسمح */
  basis: 'earned' | 'granted' | 'none'
  reasonAr: string
}

/** هل يحقّ لهذا المدرب اقتراح تعديل بنطاق الكتالوج؟ */
export function catalogScopeGate(f: ScopeFacts): ScopeGate {
  if (f.grantedAt) {
    return {
      allowed: true,
      basis: 'granted',
      reasonAr: 'مُنحت لك صلاحية نطاق الكتالوج من الإدارة.',
    }
  }
  if (f.publishedCohortProposals >= CATALOG_SCOPE_MIN_PUBLISHED) {
    return {
      allowed: true,
      basis: 'earned',
      reasonAr: `سجلك: ${f.publishedCohortProposals} اقتراحا نُشر في نطاق الشعبة — ` +
        'وهو ما يفتح نطاق الكتالوج.',
    }
  }
  const remaining = CATALOG_SCOPE_MIN_PUBLISHED - f.publishedCohortProposals
  return {
    allowed: false,
    basis: 'none',
    reasonAr:
      `نطاق الكتالوج يصل إلى كل مسار وقالب وشعبة تستخدم الدورة، فيُفتح بعد سجل مثبت: ` +
      `${CATALOG_SCOPE_MIN_PUBLISHED} اقتراحا منشورا في نطاق الشعبة (لك ${f.publishedCohortProposals}، ` +
      `بقي ${remaining}) — أو بمنح صريح من الإدارة. واقترح الآن بنطاق شعبتك: ` +
      'هو المكان الذي تجرّب فيه بلا مخاطرة على أحد.',
  }
}
