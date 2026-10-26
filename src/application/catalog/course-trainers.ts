/* من يقدّم الدورة — من شعبها المفتوحة، لا من قائمة تخصّصاتٍ ساكنة (١٩ أكتوبر ٢٠٢٦).

   ═══ ما كان ═══

   رأسُ صفحة الدورة، ونافذةُ «الفريق التدريبي» في صفحة المسار، وقائمةُ «دورة أو أكثر» فيها — ثلاثتُها
   تقرأ `TRAINER_POOLS` وحدَها: تخصّصٌ ساكنٌ وجملةُ «يُعلن المدرب بعد اعتماد الشعبة» لكلّ دورة، ولا تسأل
   الخادمَ أبدا. فدورةٌ شعبتُها مفتوحةٌ بمدرّبٍ معتمَدٍ نشرُه كان رأسُها يقول إنّ مدرّبها لم يُعلن، ومنتقي
   الشعبة تحته في الصفحة نفسِها يقول «مع فلان». وقِيس في الإنتاج: ثمانٍ وعشرون شعبةً مفتوحةً من أربعٍ
   وثلاثين لها مدرّبٌ معلَن، ولا يظهر اسمُ أحدٍ منهم في هذه السطوح الثلاثة.

   ═══ والآن ═══

   الاسمُ من شعب الدورة المفتوحة (`/api/public/cohorts`) — المصدرُ الذي يقرؤه منتقي الشعبة، والخادمُ
   يرشّحه ببوّابة الظهور الواحدة (`trainer-visibility.ts`). فلا يفترق الرأسُ عن المنتقي. وحيث لا اسمَ
   بعدُ يبقى ما كان: التخصّصُ وجملتُه.

   ولا يُقرأ هنا كتالوجٌ ولا شبكة: الصفحةُ تمرّر ما عندها، وهذا الملفّ يرتّبه — فيُقاس بمدخلاته. */

/** أسماءُ من يقدّم الدورة — بلا تكرار، بترتيب شعبها (الأقربُ أوّلا). فارغةٌ حتّى يُعتمَد نشرُ اسم */
export function trainerNamesOf(cohorts: readonly { trainers: readonly string[] }[] | undefined): string[] {
  return [...new Set((cohorts ?? []).flatMap((c) => c.trainers))]
}

/** سطرُ مدرّب الدورة — أسماؤه، أو ما يُقال حين لا اسمَ بعد */
export function trainerLineAr(names: readonly string[], pendingAr: string): string {
  return names.length > 0 ? names.join('، ') : pendingAr
}

/** دورةٌ في المسار بما يلزم الفريقَ منها */
export interface TeamCourse {
  name: string
  /** تخصّصُ مقعدها — يُعرض ما دام مدرّبُها لم يُعلن */
  role: string
  /** أسماءُ مدرّبيها المعلَنين — `trainerNamesOf` */
  names: readonly string[]
}

export interface TeamRow {
  key: string
  /** اسمُ المدرّب، أو التخصّصُ حين لا اسم */
  title: string
  /** دوراتُه في هذا المسار، أو جملةُ الانتظار */
  detail: string
  announced: boolean
}

/** الفريقُ التدريبيُّ للمسار — المعلَنون بأسمائهم ودوراتهم فيه أوّلا، ثمّ تخصّصُ ما لم يُعلن مدرّبُه.

    والتخصّصُ يسقط متى أُعلن مدرّبُ كلِّ دوراته: بقاؤه يقول «لم يُعلن» عن دورةٍ أُعلن مدرّبُها. */
export function pathwayTeam(courses: readonly TeamCourse[], pendingAr: string): TeamRow[] {
  const byName = new Map<string, string[]>()
  const pendingRoles = new Set<string>()
  for (const c of courses) {
    if (c.names.length === 0) { pendingRoles.add(c.role); continue }
    for (const n of c.names) byName.set(n, [...(byName.get(n) ?? []), c.name])
  }
  return [
    ...[...byName].map(([name, courseNames]) => ({ key: `n:${name}`, title: name, detail: courseNames.join('، '), announced: true })),
    ...[...pendingRoles].map((role) => ({ key: `r:${role}`, title: role, detail: pendingAr, announced: false })),
  ]
}

/* ═══ ووجوهُهم في بطاقات الرئيسة — دوائرُ متراصّة كصفحة المنحة (٢٦ أكتوبر ٢٠٢٦) ═══

   صاحبُ المنصّة: «ضع صور المدربين داخل مربعات المسارات والدورات بطريقةٍ بسيطةٍ على شكل دوائرَ متراصّة
   مثل ما قمت في صفحة المنحة» — ثمّ: «فقط للصندوق الخارجي واترك الداخلي كما هو»، أي بطاقاتُ الرئيسة لا
   صفحتا الكتالوج. والمصدرُ شعبُ الدورة المفتوحة نفسُها، فلا وجهَ إلّا لمن اعتُمد نشرُه (`trainer-visibility.ts`).
   ومن لا صورةَ له يُعدّ في «+N» ولا يُرسم: دائرةُ حروفٍ في صفّ وجوهٍ تُقرأ نقصا. */

/** أقصى ما يُرسم من الوجوه في بطاقة — وما زاد «+N» */
export const CARD_FACES_MAX = 4

/** وجهُ مدرّبٍ له صورة */
export interface TrainerFace { id: string; name: string; photoUrl: string }

/** وجوهُ مدرّبي دوراتٍ من شعبها — بلا تكرار، بترتيب الدورات ثمّ الشعب. و`total` كلُّ من يقدّمها، بصورةٍ أو بلا */
export function trainerFacesOf(
  courseIds: readonly string[],
  cohorts: ReadonlyMap<string, readonly { trainerProfiles: readonly { id: string; name: string; photoUrl: string | null }[] }[]>,
  max: number = CARD_FACES_MAX,
): { faces: TrainerFace[]; total: number } {
  const all = new Map<string, { id: string; name: string; photoUrl: string | null }>()
  for (const id of courseIds) {
    for (const c of cohorts.get(id) ?? []) {
      for (const t of c.trainerProfiles) {
        const key = t.id || `n:${t.name}`
        if (!all.has(key)) all.set(key, t)
      }
    }
  }
  const faces = [...all.values()].flatMap((t) => (t.photoUrl ? [{ id: t.id, name: t.name, photoUrl: t.photoUrl }] : [])).slice(0, max)
  return { faces, total: all.size }
}
