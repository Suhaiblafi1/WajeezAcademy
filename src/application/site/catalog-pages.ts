/* صفحاتُ المسارات والدورات للزاحف — عنوانُها ووصفُها وبياناتُها المنظّمة ونصُّها.

   ═══ لماذا (٥ نوفمبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة «SEO احترافيّا لكلّ صفحات الموقع، وأن نظهر في محادثات الذكاء
   الاصطناعيّ مثل ChatGPT». وأكثرُ ما يُبحث عنه اسمُ دورةٍ أو مجال — ووجهتُه
   `/pathways/:id` و`/build/:courseId`. وكانت هذه الصفحاتُ تُقدَّم بقالب الرئيسة:
   عنوانُها وcanonicalها، وجسدٌ فارغ. فلا يفهرسها قوقل إلّا في طور التصيير المؤجَّل،
   ولا تصل محرّكاتِ الإجابة أبدا (لا تشغّل جافاسكربت).

   ═══ مصدرٌ واحدٌ للعنوان ═══

   `pathwaySeo` و`courseSeo` يقرؤهما `SeoHead` في الصفحة الحيّة (`pages/Pathway.tsx`
   و`pages/CoursePath.tsx`) ويقرؤهما `scripts/prerender-seo.ts` — فلا يقرأ الزاحفُ
   عنوانا تستبدله React بآخر.

   ═══ وما لا يُكتب هنا ═══

   · **اسمُ مدرّب** — بوّابتُه `publicTrainerWhere()` في الخادم، وهذه صفحاتٌ ساكنةٌ
     تُبنى بلا قاعدة بيانات (CLAUDE.md).
   · **سعر** — السعرُ من الشعبة ويتغيّر بالمنحة والفصل؛ ورقمٌ في البيانات المنظّمة
     يخالف الصفحةَ يُسقط الوسمَ عند قوقل ويُقرأ تضليلا.
   · **قائمةُ ما يُعرض الآن** — العرضُ يحكمه الخادمُ بالشعب (`listedWhole`)، فخريطةُ
     الموقع وllms.txt يُجابان منه (`server/services/seo-feeds.service.ts`). وكلُّ صفحةٍ
     هنا موجودةٌ أصلا لمن يملك رابطَها — بقرار ٢١ أكتوبر. */

import { weeksLabel } from '../../data/courses'

export const ACADEMY_NAME = 'أكاديمية وجيز'

/* `SeoMeta` يسكن في `render-page.ts` — ورقةٌ يستوردها الخادم. وكان هنا، فجرّ استيرادُ نوعِه
   الكتالوجَ كلَّه إلى مسار إقلاع الخادم (`server/tests/ops/start-command.test.ts`). */
import type { SeoMeta } from './render-page'
export type { SeoMeta }

export interface PathwaySeoInput {
  id: string
  name: string
  transformation: string
  level: string
  durationWeeks: number
}

/** عنوانُ صفحة المسار ووصفُها — `SeoHead` والتهيئةُ المسبقة معا */
export function pathwaySeo(p: PathwaySeoInput): SeoMeta {
  return {
    title: p.name,
    description: `${p.transformation} — مسار ${p.level} من ${weeksLabel(p.durationWeeks)} في ${ACADEMY_NAME}.`,
    path: `/pathways/${p.id}`,
  }
}

export interface CourseSeoInput {
  id: string
  name: string
  promise?: string | null
}

/** عنوانُ صفحة الدورة ووصفُها.

    وكان العنوانُ «ابن مسارك من «…»» — جملةَ فعلٍ لا اسمَ دورة، ومن يبحث يكتب اسمَ
    الدورة أو مهارتَها. فالعنوانُ اسمُها، والوصفُ وعدُها. */
export function courseSeo(c: CourseSeoInput): SeoMeta {
  const promise = c.promise?.trim()
  return {
    title: c.name,
    description: promise
      ? `${promise} — دورة مباشرة عبر الإنترنت مع مدرب ومشروع عملي في ${ACADEMY_NAME}.`
      : `دورة «${c.name}» مباشرة عبر الإنترنت مع مدرب ومشروع عملي في ${ACADEMY_NAME}.`,
    path: `/build/${c.id}`,
  }
}
