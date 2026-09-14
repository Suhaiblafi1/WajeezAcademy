/* قواعدُ الإكمال — قاعدةُ الدورة أرضيّةٌ لا تُمحى بقاعدةِ شعبة (ك-١٤).

   ═══ ما كان ═══

   `evaluateCompletion` كانت تحلّ القواعدَ هكذا:

     const rules = cohortRules.length ? cohortRules : courseRules

   أي أنّ **قاعدةً واحدةً على الشعبة تُلغي قواعدَ الدورة كلَّها**. فمن أضاف
   على شعبةٍ شرطَ «محورٌ واحدٌ مكتمل» أسقط معه — بلا أن يقصد ولا أن يُقال له —
   شرطَ الحضور وشرطَ التكاليف وشرطَ التقييم المكتوبةَ على الدورة.

   والنتيجةُ أنّ «شهادة من وجيز» عن الرمز نفسِه تعني شيئا في شعبةٍ وشيئا آخرَ
   في شعبةٍ جارتها. وهي الدعوى الوحيدةُ التي لا تحتمل المرونة.

   ═══ وما صار ═══

   **دمجٌ لا استبدال، والأشدُّ يفوز:**

   ① قواعدُ الدورة أرضيّة — تسري ما لم تُرفَع.
   ② قاعدةُ شعبةٍ من النوع نفسِه **تُشدِّد ولا تُرخي**: يؤخَذ الأعلى.
   ③ نوعٌ لا تعرفه الدورةُ تضيفه الشعبةُ فيسري.
   ④ والإرخاءُ بابٌ واحدٌ صريح: قاعدةُ شعبةٍ بـ`required: false` تُسقط نوعَها
      عن هذه الشعبة وحدَها. فمن أراد شعبةً بلا حضورٍ قالها صراحةً وبقي قولُه
      في السجلّ — ولا تسقط الشروطُ عرَضا من وراء إضافةِ شرطٍ لا يخصّها.

   ═══ ولماذا وحدةٌ نقيّة ═══

   هذا قرارٌ لا استعلام: يُفحَص بلا قاعدةِ بيانات، ويُقرأ في موضعٍ واحد.
   والخادمُ يستورده ولا يعيد كتابتَه. */

/** ما تحتاجه القسمةُ من صفِّ القاعدة — والزائدُ لا يُقرأ */
export interface CompletionRuleLike {
  type: string
  threshold: number
  required: boolean
}

export interface ResolvedRule {
  type: string
  threshold: number
  /** من أين جاءت — يُقرأ في الشرح لا في الحكم */
  source: 'course' | 'cohort' | 'tightened'
}

/**
 * قواعدُ الإكمال السارية على تسجيل — أرضيّةُ الدورة مشدودةً بما تزيده الشعبة.
 *
 * `courseRules` قواعدُ الدورة (`cohortId: null`)، و`cohortRules` قواعدُ هذه
 * الشعبة. ولا يُفترض في أيٍّ منهما ترتيبٌ ولا تفرُّدُ نوع: الصفوفُ تُنشأ ولا
 * تُحدَّث في `setCompletionRule`، فقد يتكرّر النوعُ الواحدُ مرّاتٍ — ويُؤخَذ
 * أشدُّ ما كُتب منه.
 */
export function resolveCompletionRules(
  courseRules: readonly CompletionRuleLike[],
  cohortRules: readonly CompletionRuleLike[],
): ResolvedRule[] {
  /* أشدُّ ما كُتب لكلّ نوعٍ على الدورة — والمرفوعُ (`required: false`) لا يُعَدّ */
  const floor = new Map<string, number>()
  for (const r of courseRules) {
    if (!r.required) continue
    floor.set(r.type, Math.max(floor.get(r.type) ?? 0, r.threshold))
  }

  /* والشعبةُ تُشدِّد أو تُسقط — ولا تُرخي بغير إسقاطٍ صريح */
  const waived = new Set<string>()
  const cohortFloor = new Map<string, number>()
  for (const r of cohortRules) {
    if (!r.required) {
      waived.add(r.type)
      continue
    }
    cohortFloor.set(r.type, Math.max(cohortFloor.get(r.type) ?? 0, r.threshold))
  }

  const out: ResolvedRule[] = []
  const types = new Set<string>([...floor.keys(), ...cohortFloor.keys()])
  for (const type of types) {
    /* الإسقاطُ الصريحُ يعلو الاثنين — وهو الباب الوحيد إلى الإرخاء */
    if (waived.has(type)) continue
    const courseThreshold = floor.get(type)
    const cohortThreshold = cohortFloor.get(type)
    if (courseThreshold === undefined && cohortThreshold !== undefined) {
      out.push({ type, threshold: cohortThreshold, source: 'cohort' })
      continue
    }
    if (cohortThreshold === undefined && courseThreshold !== undefined) {
      out.push({ type, threshold: courseThreshold, source: 'course' })
      continue
    }
    const c = courseThreshold ?? 0
    const h = cohortThreshold ?? 0
    out.push({
      type,
      threshold: Math.max(c, h),
      source: h > c ? 'tightened' : 'course',
    })
  }
  /* ترتيبٌ ثابتٌ — الرسائلُ تُقارَن في الاختبارات وتُقرأ عند المتعلّم */
  return out.sort((a, b) => a.type.localeCompare(b.type))
}
