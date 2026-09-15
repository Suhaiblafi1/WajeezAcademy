/* دفعةٌ تمحو — ومن لم تبلغه رسالتُه يُسمَّى (ي-٦).

   ═══ العطبُ الذي كُتب له ═══

   `sendAccountErasedEmail` تردّ حالَها ولا ترمي. وكانت الحلقةُ في المحو
   الجُمليّ وفي إعادة الضبط **تُهمل الجواب**: `await` بلا قراءة. فمزوّدٌ يردّ
   ٤٢٩ — وهو ما يقع بعينه في دفعةٍ من عشرات النداءات على حدٍّ قياسيٍّ هو
   طلبان في الثانية — أو عنوانٌ يرتدّ، يمرّ صامتا. ويُحذف الحسابُ على كلّ
   حال.

   ولا يبقى في المنصّة كلِّها أثرٌ أنّ صاحبَه لم يُخبَر: السجلُّ يقول «حُذف
   واحدٌ وثلاثون حسابا»، فيُقرأ بعد ستّة أشهرٍ على أنّ واحدا وثلاثين إنسانا
   أُخبروا. وقد لا يكون أُخبر منهم أحد.

   وهذا **أسوأُ من صمتٍ معلوم**: صمتٌ يظنّه قارئُه كلاما.

   ═══ ولمَ الفحصُ على صفّ الأثر ═══

   لأنّ الجوابَ يعود إلى شاشةٍ تُغلَق، والصفُّ يبقى. ومن يسأل بعد شهر «أأُخبر
   فلان؟» يقرأ الصفّ لا الشاشة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { BulkPurgeService } from '../../services/bulk-purge.service'

let prisma: PrismaClient
let auth: AuthService
let bulk: BulkPurgeService
let adminId = ''

const S = Date.now().toString(36).slice(-5)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  bulk = new BulkPurgeService(prisma)
  const a = await auth.register(`bulk-admin-${S}@test.local`, 'Admin#12345', 'مديرُ النظام')
  adminId = a.userId
  await auth.setRoles(adminId, ['super_admin'])
}, 240_000)

/** حسابٌ فارغٌ يُحذف — لا شهادةَ له ولا تسجيلَ فلا يردّه الحاجز */
async function emptyLearner(tag: string): Promise<string> {
  const u = await auth.register(`bulk-${tag}-${S}@test.local`, 'Learner#12345', `متعلّمُ ${tag}`)
  return u.userId
}

describe('دفعةُ المحو تقول من لم تبلغه رسالتُه', () => {
  it('تُسمّي من سقطت رسالتُه في صفّ الدفعة — ولا تكتفي بعدّ المحذوفين', async () => {
    /* وقناةُ البريد مغلقةٌ هنا بقصد: هي أوضحُ صورةٍ لِما كان يمرّ صامتا،
       وأصدقُها تمثيلا لِما يقع حين يتعثّر المزوّد في أثناء دفعة. */
    const ids = [await emptyLearner('a'), await emptyLearner('b')]
    const out = await bulk.execute(adminId, ids, '2')

    expect(out.purged, 'لم يُحذف الحسابان').toBe(2)
    expect(
      out.unreached.map((u) => u.email).sort(),
      'مُحي حسابان ولم تصلهما رسالةٌ — ولم يُسمَّ واحدٌ منهما',
    ).toEqual([`bulk-a-${S}@test.local`, `bulk-b-${S}@test.local`])

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'admin.users.purge_bulk', entityId: out.batchId },
    })
    expect(audit, 'لا صفَّ للدفعة أصلا').not.toBeNull()
    const meta = audit!.meta as { unreachedCount?: number; unreached?: { email: string }[] } | null
    expect(
      meta?.unreachedCount,
      'صفُّ الدفعة يقول «حُذف اثنان» ولا يقول إنّ رسالتَيهما لم تخرجا — '
      + 'فيُقرأ بعد شهرٍ على أنّهما أُخبرا',
    ).toBe(2)
    expect(meta?.unreached?.map((u) => u.email).sort())
      .toEqual([`bulk-a-${S}@test.local`, `bulk-b-${S}@test.local`])
  })

  it('ومن رُدَّ حذفُه لا يُقال إنّه لم يُخبَر — فهو لم يُمحَ أصلا', async () => {
    /* «لم تبلغه رسالتُه» دعوى عن **إنسانٍ مُحي ولم يُعلم**. فلو دخلها من
       رُدَّ حذفُه لَقرأها الموظّفُ بعد شهرٍ على أنّ حسابا مُحي ولم يُخبَر
       صاحبُه — وحسابُه قائمٌ يعمل. وقائمةٌ تشكو ممّا لم يقع تُفقِد القائمةَ
       كلَّها قيمتَها، فيتوقّف من يقرؤها عن تصديقها.

       وحسابُ الفاعل نفسِه أبسطُ مردود: لا يحذف أحدٌ نفسَه. */
    const victim = await emptyLearner('c')
    const out = await bulk.execute(adminId, [victim, adminId], '1')

    expect(out.purged, 'حُذف أكثرُ من المسموح — أو حذف المديرُ نفسَه').toBe(1)
    expect(out.refused, 'لم يُردّ حسابُ الفاعل').toBe(1)
    expect(
      out.unreached.map((u) => u.email),
      'دخل قائمةَ «لم تبلغه رسالتُه» من لم يُمحَ أصلا',
    ).toEqual([`bulk-c-${S}@test.local`])

    /* وحسابُ الفاعل باقٍ يعمل */
    expect(await prisma.user.count({ where: { id: adminId } }), 'حذف المديرُ نفسَه').toBe(1)
  })
})
