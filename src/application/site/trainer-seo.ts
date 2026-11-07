/* عنوانُ صفحة المدرّب `/t/:slug` ووصفُها — في ملفٍّ وحدَه لأنّ الخادمَ يستورده، و`catalog-pages.ts`
   يجرّ وحداتِ الكتالوج كلَّها (`data/courses`) — ولو باستيراد نوع. والصفحةُ الحيّةُ والخادمُ يقرآنه معا، فلا يتذبذب العنوان. */

import type { SeoMeta } from './render-page'

const ACADEMY_NAME = 'أكاديمية وجيز'

export interface TrainerSeoInput {
  slug: string
  name: string
  headline?: string | null
}

/** ولا تُستدعى إلّا لمن جاز عرضُ اسمه (`publicTrainerWhere()`). */
export function trainerSeo(t: TrainerSeoInput): SeoMeta {
  const headline = t.headline?.trim().replace(/[.。،,]+$/, '')
  return {
    title: t.name,
    description: headline
      ? `${headline}. دورات ${t.name} المفتوحة للتسجيل في ${ACADEMY_NAME}.`
      : `دورات ${t.name} المفتوحة للتسجيل في ${ACADEMY_NAME}.`,
    path: `/t/${t.slug}`,
  }
}
