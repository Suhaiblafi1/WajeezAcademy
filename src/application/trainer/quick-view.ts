/* بطاقةُ المدرّب المنبثقة — ما تعرضه ومن أين (٩ نوفمبر ٢٠٢٦). والرسمُ في `src/components/trainer/TrainerQuickView.tsx`
   وعلّتُه في رأسه: ما يعرفه المنادي (`seed`) يُرسم فورا، وما سواه يُقرأ من صفحته العامّة حين تُفتح — وكلاهما ممّا مرّ
   ببوّابة الظهور. وفيديو الدورة يغلب فيديو تعريفه حين يُعرف. */

import { renderableVideo, safePhotoUrl, type PublicTrainerVideo } from './marketing-video'

/** ما يعرفه المنادي عن المدرّب قبل الفتح — كلُّه ممّا مرّ ببوّابة الظهور */
export interface TrainerSeed {
  name: string
  slug: string | null
  headline?: string | null
  photoUrl?: unknown
  /** فيديو هذه الدورة إن عُرف — يغلب تعريفَه. وغيابُه (`undefined`) يعني: يُقرأ من صفحته */
  video?: unknown
  bio?: string | null
  country?: string | null
  specialties?: string[]
}

/** مدرّبُ الدورة المعلَن (`/api/courses/:id/trainer`) ← ما تبدأ به بطاقتُه — وفيديو هذه الدورة يغلب تعريفَه */
export function seedOf(t: { name: string; headline: string | null; photoUrl?: unknown; video?: unknown; slug?: unknown }): TrainerSeed {
  return {
    name: t.name, headline: t.headline, photoUrl: t.photoUrl, video: t.video ?? null,
    slug: typeof t.slug === 'string' && t.slug ? t.slug : null,
  }
}

/** ما تعرضه البطاقة بعد الدمج */
export interface TrainerQuickViewData {
  name: string
  slug: string | null
  headline: string | null
  photoUrl: string | null
  country: string | null
  bio: string | null
  specialties: string[]
  video: PublicTrainerVideo | null
}

/** ما يُقرأ من صفحته العامّة — ما تحتاجه البطاقةُ وحدَه */
export interface QuickViewPage {
  slug: string; name: string; headline: string | null; bio: string | null
  photoUrl: string | null; country: string | null; specialties: string[]; video?: unknown
}

export type QuickViewStatus = 'loading' | 'ready' | 'error'

/** التخصّصاتُ في البطاقة — أربعٌ، وما زاد يُقال عددُه */
export const QUICK_VIEW_SPECIALTIES = 4

/** الدمج: ما قرأناه من صفحته يغلب ما عرفه المنادي، إلّا فيديو الدورة */
export function mergeQuickView(seed: TrainerSeed, page: QuickViewPage | null): TrainerQuickViewData {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  return {
    name: page?.name ?? seed.name,
    slug: page ? page.slug : seed.slug,
    headline: str(page?.headline) ?? str(seed.headline),
    photoUrl: safePhotoUrl(page?.photoUrl ?? seed.photoUrl),
    country: str(page?.country) ?? str(seed.country),
    bio: str(page?.bio) ?? str(seed.bio),
    specialties: (page?.specialties ?? seed.specialties ?? []).filter((s) => typeof s === 'string' && s.trim()),
    video: renderableVideo(seed.video !== undefined && seed.video !== null ? seed.video : page?.video),
  }
}

/** صورةُ المدرّب في قائمة `/trainers`: تُحاط بحلقة الفيديو وشارة التشغيل لمن له فيديو يُضمَّن وحدَه (٩ نوفمبر ٢٠٢٦) —
    والرابطُ الذي لا يُضمَّن لا حلقةَ له، كحلقة صفحته وبطاقته */
export function hasVideoRing(t: { video?: unknown }): boolean {
  return renderableVideo(t.video)?.kind === 'embed'
}
