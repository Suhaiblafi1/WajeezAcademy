/* نوعُ الحساب — ترشيحٌ لا قسمة.

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) أنّ «المستخدمون والأدوار» لا تُرشَّح
   إلّا بالحالة (نشطٌ · مدعوٌّ · موقوفٌ · مؤرشف)، فمن أراد المدرّبين وحدَهم
   قلّب عشرةَ حساباتٍ بأعينه — ومئتَين حين تكبر المنصّة.

   **ولمَ ترشيحٌ لا خانات؟** لأنّ الأدوارَ في هذه المنصّة **متعدّدة**:
   للحساب الواحد أكثرُ من دور. ومن قسَم الحسابات أنواعا اضطرّ إلى أسبقيّةٍ
   يخترعها — أمديرٌ أكاديميٌّ يدرّب هو «موظّفٌ» أم «مدرّب»؟ وأيّ جوابٍ
   اختير أخفى الحسابَ عمّن يبحث عنه بالوجه الآخر. فالترشيحُ يقول «أرِني من
   يحمل دورَ تدريب» فيظهر في الوجهَين، والخاناتُ تبقى للحالة وحدَها —
   وهي قسمةٌ حقيقيّةٌ لأنّ للحساب حالةً واحدة.

   **والمستشارون رابعٌ بقصد.** طُلبت ثلاثةٌ (فريقٌ · مدرّبون · متعلّمون)،
   والمستشارُ لا يقع في واحدٍ منها: له بوّابتُه وطلبُ انضمامه وعمولتُه —
   كالمدرّب لا كالموظّف. وإلحاقُه بفريق العمل يقول عنه ما ليس فيه. */

/** أنواعُ الحسابات كما تُرشَّح في شاشة المستخدمين */
export type AccountKind = 'staff' | 'trainer' | 'advisor' | 'learner'

/** الأدوارُ التي تجعل صاحبَها من فريق العمل الداخليّ */
export const STAFF_ROLES: readonly string[] = [
  'super_admin', 'academic_manager', 'academic_coordinator',
  'diagnostic_manager', 'operations_manager', 'finance', 'support',
]

const KIND_ROLES: Record<AccountKind, readonly string[]> = {
  staff: STAFF_ROLES,
  trainer: ['trainer'],
  advisor: ['advisor'],
  learner: ['learner'],
}

export const ACCOUNT_KINDS: { value: AccountKind; labelAr: string }[] = [
  { value: 'staff', labelAr: 'فريقُ العمل' },
  { value: 'trainer', labelAr: 'المدرّبون' },
  { value: 'advisor', labelAr: 'المستشارون' },
  { value: 'learner', labelAr: 'المتعلّمون' },
]

/** أيحمل هذا الحسابُ دورا من هذا النوع؟ */
export function isKind(roleIds: readonly string[], kind: AccountKind): boolean {
  const want = KIND_ROLES[kind]
  return roleIds.some((r) => want.includes(r))
}

/**
 * يُرشّح الحسابات بنوعٍ واحد. و`null` تعني «كلَّ الأنواع» — فلا يُجبَر
 * الناظرُ على اختيارٍ ليرى ما كان يراه.
 */
export function filterByKind<T extends { roles: readonly { id: string }[] }>(
  rows: readonly T[], kind: AccountKind | null,
): T[] {
  if (!kind) return [...rows]
  return rows.filter((u) => isKind(u.roles.map((r) => r.id), kind))
}
