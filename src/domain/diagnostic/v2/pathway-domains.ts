/* خريطةُ مجالات المسارات وحدَها — في ملفٍّ لا يجرّ ميتا الأسئلة وطبقاتِ المهارات (٨ نوفمبر ٢٠٢٦).

   كانت في `v2/data.ts` مع ملفّين ثقيلين (ميتا الأسئلة ١٤٩ ك.ب وطبقات المهارات ٢٠٧): فصفحةُ «ابنِ مسارك» التي تسأل
   «ما مجالُ هذا المسار؟» لترتيب اقتراحاتها (`course-path.ts`) كانت تحمّلهما كلَّهما قبل أن تُرسم. فصارت الخريطةُ هنا،
   و`v2/data.ts` يعيد تصديرها كما هي — فلا يتغيّر مستوردٌ ولا سلوك.

   والخريطةُ `let` بقصد كما كانت: روابطُ ES الحيّة تُري كلَّ مستوردٍ — ومنه إعادةُ التصدير — ما تثبّته اللقطةُ المنشورة. */

import pathwayDomainsJson from '../../../data/catalog/v2/pathway-domains.v2.json'
import type { DomainId } from './types'

const bundled = (pathwayDomainsJson as unknown as { pathway_domains: Record<string, DomainId[]> }).pathway_domains

/* خرائط مجالات المسارات — ملف المصدر هو الافتراضي، واللقطة المنشورة تتقدم عليه (ج-١). */
export let pathwayDomainsV2: Record<string, DomainId[]> = bundled

/** تثبيت خريطة مجالات المسارات من لقطة منشورة؛ null يرجّع الملف المضمن.
    خريطة فارغة `{}` تُقبل كما هي — «منشور بلا مجالات» واقع يجب أن يظهر لا يُرمَّم.
    المُدخل نصوص لأن اللقطة JSON بلا أنواع؛ معرف مجال مجهول لا يطابق شيئا
    ويظهر في التدقيق (audit-diagnostic-v2) بدل أن يُحذف صامتا. */
export function installPathwayDomains(map: Record<string, string[]> | null): void {
  pathwayDomainsV2 = (map as Record<string, DomainId[]> | null) ?? bundled
}

/** مجالات المسار — [] إن لم يُربط (يُسجل في التدقيق) */
export function domainsOfPathway(pathwayId: string): DomainId[] {
  return pathwayDomainsV2[pathwayId] ?? []
}
