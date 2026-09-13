/* محاورُ خطّة الشعبة — ترتيبُها ومعرّفاتُها.

   ═══ العطبُ الذي وُضع هذا لأجله ═══

   كان المحورُ يُضاف ولا يُحذف ولا يُنقل، ومعرّفُ ما يضيفه المدرّبُ مشتقٌّ
   من موضعه: `${courseId}-T${modules.length + 1}`. وما دام لا حذفَ فالموضعُ
   لا يتكرّر، فلا يظهر العطب.

   فإن صار الحذفُ ممكنا انكشف: [T1, T2, T3] يُحذف منها T2 فتصير [T1, T3]،
   ثمّ يُضاف محورٌ فيُشتقُّ له `T${2 + 1}` — أي **T3 وهو قائم**. محوران
   بمعرّفٍ واحدٍ في خطّةٍ واحدة، والخادمُ كان يقبلهما (لا فحصَ تفرّدٍ في
   `planContent`).

   فالمعرّفُ هنا **لا يُشتقّ من الموضع بل من أكبرِ ما أُعطي**، ولا يُعاد
   استعمالُ رقمٍ حُذف: من حذف T2 ثمّ أضاف أخذ T4 لا T2. المعرّفُ المحذوفُ
   يبقى محذوفا، فلا يرث محورٌ جديدٌ ما كان مرتبطا بالقديم.

   ═══ ولماذا لا يُقاس «من الكتالوج» بشكل المعرّف ═══

   محاورُ الكتالوج `<course>-M<n>` وما يضيفه المدرّبُ `<course>-T<n>` —
   وقد يُغري ذلك بفحصِ الحرف. لكنّ الحرفَ عُرفٌ لا عقد: الأصلُ أنّ المحورَ
   من الكتالوج إن كان في `baseModules` التي أرسلها الخادم. فالعضويّةُ هي
   الحكم لا الاسم. */

/** ما يلزم من المحور هنا — والباقي (المخرَجُ والتطبيقُ والمتن) لا يعني الترتيب */
export interface PlanModuleLike { moduleId: string }

/** نمطُ معرّفِ ما يضيفه المدرّبُ لهذه الدورة: `<courseId>-T<رقم>` */
function trainerIdPattern(courseId: string): RegExp {
  /* المعرّفُ يدخل تعبيرا نمطيّا — وفيه شُرَطٌ ونقاطٌ تُفهم رموزا لولا الهرب */
  const safe = courseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${safe}-T(\\d+)$`)
}

/**
 * معرّفٌ جديدٌ لمحورٍ يضيفه المدرّب — لا يصطدم بقائمٍ ولا يعيد رقما حُذف.
 *
 * @param courseId معرّفُ الدورة، يصدّر المعرّف
 * @param modules المحاورُ القائمةُ في الخطّة الآن
 */
export function nextTrainerModuleId(courseId: string, modules: readonly PlanModuleLike[]): string {
  const pattern = trainerIdPattern(courseId)

  /* أكبرُ رقمٍ أُعطي — لا عددُ المحاور. فالمحذوفُ لا يُعاد. */
  let highest = 0
  for (const m of modules) {
    const hit = pattern.exec(m.moduleId)
    if (!hit) continue
    const n = Number(hit[1])
    if (Number.isFinite(n) && n > highest) highest = n
  }

  /* و`highest + 1` لا يمكن أن يكون مأخوذا: لو كان في الخطّة معرّفٌ به
     لطابق النمطَ نفسَه وكان أكبرَ من `highest` — وهو أكبرُها. فلا حلقةَ
     بحثٍ هنا: شيفرةٌ لا تُنفَّذ أبدا تُوهم بحراسةٍ لا تقع. */
  return `${courseId}-T${highest + 1}`
}

/**
 * ينقل محورا خطوةً واحدةً صعودا أو نزولا، ويعيد قائمةً جديدة.
 * الطرفان يثبتان: ما فوق الأوّل وما تحت الآخر لا موضعَ له.
 *
 * @param modules القائمةُ كما هي
 * @param index موضعُ المحور المنقول
 * @param delta ‎-1 إلى أعلى، +1 إلى أسفل
 */
export function moveModule<T>(modules: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  if (index < 0 || index >= modules.length) return [...modules]
  if (to < 0 || to >= modules.length) return [...modules]
  const next = [...modules]
  const [moved] = next.splice(index, 1)
  next.splice(to, 0, moved)
  return next
}

/** أمِنَ الكتالوجِ هذا المحور؟ — بالعضويّة في محاور الدورة لا بشكل المعرّف */
export function isCatalogModule(moduleId: string, baseModules: readonly PlanModuleLike[]): boolean {
  return baseModules.some((b) => b.moduleId === moduleId)
}
