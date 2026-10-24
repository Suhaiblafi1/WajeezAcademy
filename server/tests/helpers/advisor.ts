/* مستشارٌ يُسند إليه — سقالةُ اختبارٍ لا مسارَ إنتاج (٢٤ أكتوبر ٢٠٢٦).

   ═══ لماذا وُجدت ═══

   الصلاحيّةُ وحدَها لا تفتح بوّابةَ المستشار: بلا ملفّ مستشارٍ تقول له «لا يوجد ما نعرضه هنا»
   (`AdvisorLayout.tsx`). فلا يُسند إليه باليد ولا تلقائيّا (`assign` و`availableNowWhere` في
   `advisor.service.ts`). والملفُّ يولد في الإنتاج حين تُحفَظ عمولتُه في «المستشارون والعمولة».

   وكانت جولاتُ المستشارين تبني مستشاريها بالصلاحيّة وحدَها، ويُسند إليهم لأنّ شرطَ الإجازة كان مقلوبا
   يُبقي من لا ملفَّ له ويُسقط من له ملفّ. فهذه تُتمّ الملفَّ لتبقى تلك الجولاتُ تفحص ما كُتبت لفحصه.
   والإسنادُ لمن لا ملفَّ له مفحوصٌ في `advisor-assign-profile.test.ts` وحدَه.

   ═══ وما لا تفعله ═══

   لا تمسّ ملفّا قائما: من كتب إجازتَه أو عمولتَه قبلها تبقى كما كتبها. والعمولةُ عشرةٌ كما في
   `earnings-attribution.test.ts` — ومن يختبر العمولةَ أو غيابَها يكتب ملفَّه بنفسه. */

import type { PrismaClient } from '@prisma/client'
import type { AuthService } from '../../services/auth.service'

/** صلاحيّةُ المستشار وملفُّه معا */
export async function makeAdvisor(prisma: PrismaClient, auth: AuthService, userId: string): Promise<void> {
  await auth.setRoles(userId, ['advisor'])
  await prisma.advisorProfile.upsert({ where: { userId }, create: { userId, commissionPct: 10 }, update: {} })
}
