/* مراحلُ القِمع وحسابُ التأخّر — وحدةٌ نقيّة تُختبر بمعزل.

   وهي منفصلةٌ عن المكوّن لسببين: قاعدةُ `react-refresh` تمنع تصدير غير
   المكوّنات من ملفّ مكوّن، وحسابُ «فات موعدُه» منطقٌ يستحقّ اختبارا لا
   تصييرَ شاشةٍ ليُفحص. */

export const STAGES = [
  { key: 'new', label: 'جديدة', hint: 'وصل تشخيصُه ولم نتواصل بعد' },
  { key: 'contacted', label: 'تواصلنا', hint: 'أوّل اتصالٍ تمّ' },
  { key: 'needs_review', label: 'تحتاج مراجعة', hint: 'طلبُه يحتاج قرارا' },
  { key: 'follow_up', label: 'متابعة', hint: 'له موعدٌ نعود إليه فيه' },
  { key: 'recommended', label: 'عُرض عليه', hint: 'أُرسلت له الخطّة وسعرُها' },
  { key: 'enrolled', label: 'سجّل', hint: 'أُغلقت الصفقة' },
] as const

/** ما يخرج من القِمع — يُعرض مطويّا لا عمودا يزاحم */
export const CLOSED_STAGES = [
  { key: 'not_interested', label: 'غير مهتم' },
  { key: 'closed', label: 'مغلقة' },
] as const

export interface PipelineCase {
  id: string
  status: string
  nextAction: string | null
  nextFollowUpAt: string | null
  updatedAt: string
}

/** هل فات موعدُ متابعته؟ — أوّلُ ما يجب أن يُرى في القِمع */
export function isOverdue(c: PipelineCase, now = Date.now()): boolean {
  return !!c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() < now
}

/** «منذ ٣ أيام» — لا تاريخٌ يُطرح بالعين */
export function sinceAr(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime()
  const days = Math.floor(Math.abs(ms) / 86_400_000)
  const future = ms < 0
  if (days === 0) return 'اليوم'
  if (days === 1) return future ? 'غدا' : 'أمس'
  if (days < 7) return future ? `بعد ${days} أيام` : `منذ ${days} أيام`
  if (days < 30) return future ? `بعد ${Math.floor(days / 7)} أسابيع` : `منذ ${Math.floor(days / 7)} أسابيع`
  return future ? `بعد ${Math.floor(days / 30)} أشهر` : `منذ ${Math.floor(days / 30)} أشهر`
}
