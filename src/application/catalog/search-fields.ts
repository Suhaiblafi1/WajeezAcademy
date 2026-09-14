/* حقولُ البحث — مالكٌ واحدٌ تقرؤه الشاشةُ ويقرؤه الحارس (ع-٨).

   ═══ ولمَ مالكٌ واحد ═══

   كانت قائمةُ الحقول مكتوبةً في `Catalog.tsx` **مرّتَين** (مرشِّحٌ ورتبة)،
   وكتبها الحارسُ **مرّةً ثالثةً** عنده. وحارسٌ يبني قائمتَه بيده يحرس نفسَه:
   تُنزع `moduleTitlesOf` من الشاشة فيبقى أخضرَ، لأنّه لم يكن يقرأ الشاشةَ
   أصلا. وهو عينُ ما يحذّر منه المستودَع.

   فصارت هنا. من نزعها من هنا احمرّ حارسُه، ومن نزعها من الشاشة لم تعد
   الشاشةُ تُصرّفها أصلا — لأنّها لا تملك قائمةً تنزع منها شيئا.

   ═══ والطبقاتُ ترتيبُ صلةٍ لا تعدادُ حقول ═══

   `catalogRank` يأخذ طبقاتٍ ويُعطي الصفَّ رتبةَ أعلى طبقةٍ طابق فيها. فما
   في الاسم أوّلا، ثمّ ما يصف الدورةَ وصفا قريبا، ثمّ ما ذُكرت فيه الكلمةُ
   عرضا — ومنه عناوينُ المحاور: تُخرج نتيجةً ولا تتصدّر. */

import { moduleTitlesOf } from '../../data/courses'

type Field = string | null | undefined

/** ما يوصف به المسار — الحقولُ كلُّها لا حقلان */
export function pathwaySearchLayers(p: {
  name: string; shortName?: string; audience?: string
  transformation?: string; output?: string; coreSkills: readonly string[]
}): Field[][] {
  return [
    [p.name, p.shortName],
    [...p.coreSkills],
    [p.audience, p.transformation, p.output],
  ]
}

export function pathwaySearchFields(p: Parameters<typeof pathwaySearchLayers>[0]): Field[] {
  return pathwaySearchLayers(p).flat()
}

/** وما توصف به الدورة — ومنه ما يُدرَّس في محاورها (ع-٨) */
export function courseSearchLayers(c: {
  id: string; name: string; promise?: string
  audience?: string; pathwayName?: string; skills: readonly string[]
}): Field[][] {
  return [
    [c.name],
    [c.promise, ...c.skills],
    [c.audience, c.pathwayName, ...moduleTitlesOf(c.id)],
  ]
}

export function courseSearchFields(c: Parameters<typeof courseSearchLayers>[0]): Field[] {
  return courseSearchLayers(c).flat()
}
