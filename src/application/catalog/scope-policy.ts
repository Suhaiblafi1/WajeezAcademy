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
