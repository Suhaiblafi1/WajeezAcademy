/* روابطُ اقتراح المدرّب بين «دوراتٌ مقترحة» وملفِّه والكتالوج — قرارُ صاحب المنصّة «A» (٢٦ أكتوبر ٢٠٢٦).

   سُئل: أين تُقرَّر دوراتٌ يقترحها المدرّب؟ فقال «A»: في ملفّه، بجانب أجره ودوراته — نسخةٌ من رمزٍ قائم، أو دورةٌ
   جديدة، أو اسأله، أو ليس الآن. و«دوراتٌ مقترحة» تبقى قائمةً عبرَ المدرّبين، وكلُّ سطرٍ فيها يفتح ملفَّ صاحبه.

   فثلاثةُ روابطَ تصل المواضعَ الثلاثة:
   • القائمةُ تفتح ملفَّه على لسان «الاتفاقية» وعلى الاقتراح نفسِه (`idea`) — لا في رأس الملفّ يُبحث عنه.
   • و«دورة جديدة» تفتح نموذجَ الكتالوج بعنوانه، ومعه طريقُ العودة (`back`) إلى الاقتراح نفسِه في ملفّه.
   • والكتالوجُ لا يعود إلّا إلى مسارٍ في الإدارة (`safeAdminBack`): رابطٌ يحمل `back` لا يُحوِّل إلى خارجها. */

import { isSafeTarget } from '@/application/links/short-link'

/** معرّفُ الاقتراح في عنوان الملفّ — يُفتح عليه */
export const IDEA_PARAM = 'idea'

/** ملفُّ صاحبه على لسان «الاتفاقية» وعلى الاقتراح نفسِه */
export function ideaRecordHref(applicationId: string, proposalId: string): string {
  const q = new URLSearchParams({ tab: 'agreement', [IDEA_PARAM]: proposalId })
  return `/admin/trainers/${encodeURIComponent(applicationId)}?${q.toString()}`
}

/** «دورة جديدة» — نموذجُ الكتالوج بعنوانه، والعودةُ إلى الاقتراح نفسِه في الملفّ الذي ضُغط منه */
export function newCourseHref(
  proposal: { id: string; titleAr: string },
  here: { pathname: string; search: string },
): string {
  const back = new URLSearchParams(here.search)
  back.set('tab', 'agreement')
  back.set(IDEA_PARAM, proposal.id)
  const q = new URLSearchParams({
    proposalId: proposal.id,
    titleAr: proposal.titleAr,
    back: `${here.pathname}?${back.toString()}`,
  })
  return `/admin/catalog?${q.toString()}#course`
}

/** طريقُ العودة إن كان مسارا في الإدارة وحدَها — وإلّا فلا عودة */
export function safeAdminBack(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/admin/')) return null
  return isSafeTarget(raw) ? raw : null
}
