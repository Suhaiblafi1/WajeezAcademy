/* ما تقوله لوحةُ النشر بكلمات (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة — ج): نتيجةُ «انشر الآن»، وسطرُ كلّ إصدار.

   كان الإصدارُ يُعرض وسمَه وبصمتَه وأفعالَه بأسمائها في القاعدة (`publish, rollback`)، ونتيجةُ النشر لا تُقال: تتحدّث
   القائمةُ وحدَها. فهنا ما يُقرأ: متى نُشر، وإلى أيّ إصدارٍ رجع، وما تغيّر من توصيات الشخصيات. */

import { fmtDateTime } from '../text/format-ar'

/** ما يردّه `POST /api/admin/publishing/publish-now` (`AutoPublishResult`) */
export type PublishNowResult = {
  published: boolean
  label?: string
  changedCount?: number
  totalPersonas?: number
}

export function publishNowAr(r: PublishNowResult): string {
  if (!r.published) return 'لا جديد لينشر: ما في الجداول هو المنشور الآن.'
  const impact = r.changedCount !== undefined && r.totalPersonas !== undefined
    ? ` تغيرت توصية ${r.changedCount} من ${r.totalPersonas} شخصية.`
    : ''
  return `نشر «${r.label ?? ''}».${impact}`
}

export type VersionRow = {
  status: string
  createdAt: string
  publishedAt: string | null
  snapshots: unknown[]
  events: { action: string; createdAt: string; details?: unknown }[]
}

/** حالُ الإصدار بكلمة — والمسودّةُ بلا لقطةٍ نشرٌ لم يكتمل */
export const VERSION_STATUS_AR: Record<string, string> = {
  published: 'المنشور الآن', superseded: 'سابق', draft: 'لم يكتمل',
}

/** سطرُ الإصدار: متى نُشر، أو إلى أيّ إصدارٍ رجع — أو متى بدأ نشرٌ لم يكتمل */
export function versionLineAr(v: VersionRow): string {
  const back = v.events.find((e) => e.action === 'rollback')
  const from = (back?.details as { restoredFrom?: unknown } | undefined)?.restoredFrom
  if (back && typeof from === 'string') return `رجوع إلى «${from}» · ${fmtDateTime(new Date(back.createdAt))}`
  if (v.publishedAt) return `نشر ${fmtDateTime(new Date(v.publishedAt))}`
  return `بدأ ${fmtDateTime(new Date(v.createdAt))} ولم يكتمل`
}
