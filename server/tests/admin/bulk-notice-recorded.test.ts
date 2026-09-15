/* دفعةٌ تمحو — ورسائلُها تُكتب في طابورٍ يبقى بعد أصحابها (ي-٦).

   ═══ العطبُ الذي كُتب له ═══

   كانت الرسائلُ تخرج في حلقة المحو نفسِها، **وجوابُها يُهمَل**: نداءُ
   الإرسال يردّ حالَه ولا يرمي. فمزوّدٌ يردّ ٤٢٩ — وهو ما يقع بعينه في مئتَي
   نداءٍ متتابعٍ على حدٍّ هو طلبان في الثانية — أو عنوانٌ يرتدّ، يمرّ صامتا
   ويُحذف الحسابُ على كلّ حال. فيُقرأ السجلُّ «حُذف ٣١ حسابا» بعد ستّة أشهرٍ
   على أنّ ٣١ إنسانا أُخبروا، وقد لا يكون أُخبر منهم أحد.

   ومهلةٌ بين الرسائل في مكانها مستحيلة: مئتا حسابٍ بستّ مئةِ ميلي ثانيةٍ
   تحبس الطلبَ دقيقتَين.

   ═══ ولمَ جدولٌ ثانٍ وفي المنصّة طابورُ إشعاراتٍ قائم ═══

   وهو سؤالٌ يجب أن يُجاب لا أن يُمَرّ. و`Notification.userId` معلَّقٌ بصاحبه
   بـ`onDelete: Cascade`: فصفٌّ يُكتب هناك **يُحذف مع صاحبه في السطر الذي
   يلي**، ورسالةُ المحو تخرج إلى من يُمحى صفُّه بعد ثانية. فالطابورُ القائمُ
   لا يصلح لهذه الرسالة بعينها — لا أنّه لا يُعجبنا.

   وهذا هو الفحصُ الأوّلُ أدناه: يُكتب الصفُّ، ثمّ يُحذف صاحبُه، ثمّ يُقرأ
   الصفُّ فيوجد. */

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

const outboxOf = (batchId: string) =>
  prisma.outboxMail.findMany({ where: { batchId }, orderBy: { to: 'asc' } })

describe('دفعةُ المحو تكتب رسائلَها في طابورٍ يبقى', () => {
  it('الصفُّ يبقى بعد أن يُمحى صاحبُه — وهو كلُّ سببِ وجود هذا الجدول', async () => {
    const ids = [await emptyLearner('a'), await emptyLearner('b')]
    const out = await bulk.execute(adminId, ids, '2')

    expect(out.purged, 'لم يُحذف الحسابان').toBe(2)
    /* الحسابان ذهبا */
    expect(await prisma.user.count({ where: { id: { in: ids } } }), 'بقي حسابٌ لم يُمحَ').toBe(0)

    /* والرسالتان باقيتان — ولو كُتبتا في `Notification` لَذهبتا معهما */
    const queued = await outboxOf(out.batchId)
    expect(
      queued.map((m) => m.to),
      'ذهبت رسالتا المحو مع صاحبَيهما — فلا أحدَ يُخبَر ولا أحدَ يعلم',
    ).toEqual([`bulk-a-${S}@test.local`, `bulk-b-${S}@test.local`])
    expect(queued.every((m) => m.status === 'queued'), 'صفٌّ خرج قبل أن يصل إليه العامل').toBe(true)
    expect(queued.every((m) => (m.text ?? '').length > 0), 'صفٌّ بلا متنٍ يُرسَل').toBe(true)
  })

  it('ويُسجَّل في صفّ الدفعة كم رسالةً كُتبت — لا «كم أُرسلت»', async () => {
    /* الفرقُ ليس لفظا: الدفعةُ تعود قبل أن يُرسَل شيء. فصفٌّ يقول «أُرسلت»
       يكذب بمقدار دقيقةٍ على الأقلّ، وقد يكذب إلى الأبد إن سقط الإرسال.
       ومصيرُ كلِّ رسالةٍ يُقرأ من الطابور بهذا المرجع نفسِه. */
    const ids = [await emptyLearner('d')]
    const out = await bulk.execute(adminId, ids, '1')

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'admin.users.purge_bulk', entityId: out.batchId },
    })
    expect(audit, 'لا صفَّ للدفعة أصلا').not.toBeNull()
    const meta = audit!.meta as { queuedNotices?: number } | null
    expect(meta?.queuedNotices, 'لا يُعرف من صفّ الدفعة كم إنسانٍ كُتبت له رسالة').toBe(1)

    /* والمرجعُ يربط الاثنين: من قرأ الصفَّ يبلغ الرسائل */
    expect((await outboxOf(out.batchId)).length).toBe(1)
  })

  it('ومن رُدَّ حذفُه لا تُكتب له رسالةُ محو — فهو لم يُمحَ أصلا', async () => {
    /* رسالةٌ تقول «حُذف حسابُك» تصل صاحبَ حسابٍ يعمل هي أسوأُ ما يمكن أن
       يخرج من هذا الباب. وحسابُ الفاعل نفسِه أبسطُ مردود: لا يحذف أحدٌ نفسَه. */
    const victim = await emptyLearner('c')
    const out = await bulk.execute(adminId, [victim, adminId], '1')

    expect(out.purged, 'حُذف أكثرُ من المسموح — أو حذف المديرُ نفسَه').toBe(1)
    expect(out.refused, 'لم يُردّ حسابُ الفاعل').toBe(1)
    expect(
      (await outboxOf(out.batchId)).map((m) => m.to),
      'كُتبت رسالةُ محوٍ لمن لم يُمحَ — وهو حسابٌ يعمل الآن',
    ).toEqual([`bulk-c-${S}@test.local`])
    expect(await prisma.user.count({ where: { id: adminId } }), 'حذف المديرُ نفسَه').toBe(1)
  })
})
