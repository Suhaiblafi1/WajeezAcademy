/* ح-٤ — مهارةٌ جديدةٌ تدخل القاموسَ بقصدٍ ويُعرف من أدخلها.

   ═══ لمَ هذا البندُ قرارُ قياسٍ لا قرارَ كتالوج ═══

   حين يُصنَّف اقتراحُ مدرّبٍ «دورةً جديدة» تُنشأ الدورةُ في شاشة الكتالوج
   ومعها مهاراتُها، وحاجزُ ك-٣ يمنع نشرَها بلا مهارةٍ واحدةٍ على الأقلّ.
   فالطريقُ الأقصرُ أمام من يستعجل هو **خلقُ مهارةٍ جديدةٍ** تُرضي الحاجز.

   والمهارةُ عملةُ «مؤشّر وجيز»: بها يُقاس كلُّ متعلّمٍ وعليها يُرشَّح كلُّ
   مسار. فواحدةٌ جديدةٌ تغيّر كيف يُقاس الناسُ جميعا — لا كيف تُعرض دورة.

   ═══ ما يُحرَس ═══

   ① **التوأمُ يُردّ** — و`slug` وحدَه فريدٌ في المخطّط، أمّا `nameAr` فلا.
      فـ«القيادة» و«قياده» و«القِيادة» كنّ يدخلن ثلاثا بلا اعتراض، ويقسمن
      قياسَ المهارة الواحدة أثلاثا: من أتقنها حُسبت له واحدةٌ وبقيت اثنتان
      ثغرةً في تشخيصه — فيُرشَّح له ما يعرفه. وهو عطبٌ لا يظهر عند الإنشاء
      بل بعد شهورٍ في توصيةٍ رديئةٍ لا يُعرف سببُها.

   ② **والأثرُ يُكتب** — فنظيرُه `catalog.course.skills_set` مسجَّلٌ من قبلُ.
      وكان ربطُ مهارةٍ قائمةٍ بدورةٍ أوثقَ توثيقا من خلقِ المهارة نفسِها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'

let prisma: PrismaClient
let admin: CatalogAdminService
let actorId = ''

const S = Date.now().toString(36).toUpperCase().slice(-4)
/** اسمٌ لا يشبه شيئا في القاموس — الساحةُ مشتركةٌ مع بقيّة الاختبارات */
const NAME = `قيادةُ فريقٍ موزَّعٍ ${S}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  const auth = new AuthService(prisma)
  const a = await auth.register(`skill-admin-${S}@test.local`, 'Admin#12345', 'مسؤولُ القاموس')
  actorId = a.userId
  await auth.setRoles(actorId, ['super_admin'])
}, 240_000)

describe('مهارةٌ جديدةٌ في القاموس', () => {
  it('تُنشأ مسودّةً ويُكتب لها أثرٌ باسمها', async () => {
    const created = await admin.createSkill(
      { id: `SK-X-H4A-${S}`, slug: `h4a_${S.toLowerCase()}`, nameAr: NAME }, actorId,
    )
    expect(created.status, 'وُلدت حيّةً لا مسودّة').toBe('draft')

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.skill.create', entityId: created.id },
    })
    expect(audit, 'زِيد في القاموس الذي يُقاس به الناسُ ولم يُكتب لذلك أثر').not.toBeNull()
    expect(audit!.actorId, 'أثرٌ بلا فاعل — فلا يُعرف من أدخلها').toBe(actorId)
    /* واسمُها في الأثر لا معرّفُها وحدَه: من يقرأ السجلَّ بعد شهرٍ لا يعرف
       `SK-X-H4A-9Q2` ما هي، وقد تُحذف المهارةُ فلا يبقى ما يُشار إليه. */
    expect((audit!.meta as { nameAr?: string } | null)?.nameAr).toBe(NAME)
  })

  it('ويُردّ توأمُها وإن اختلف رسمُه — والردُّ يسمّي الموجودة', async () => {
    /* الهمزةُ والتاءُ المربوطةُ والتشكيلُ: ثلاثةُ أوجهٍ لاسمٍ واحد، وكلُّها
       تُطبَّع إلى ما طُبّعت إليه الأولى. */
    const twins = [NAME, NAME.replace('قيادةُ', 'قياده'), NAME.replace('قيادةُ', 'قِيادة')]
    for (const [i, nameAr] of twins.entries()) {
      const attempt = admin.createSkill(
        { id: `SK-X-H4B${i}-${S}`, slug: `h4b${i}_${S.toLowerCase()}`, nameAr }, actorId,
      )
      await expect(attempt, `دخل القاموسَ توأمٌ باسم «${nameAr}»`)
        .rejects.toMatchObject({ code: 'duplicate_name' })
    }

    /* ولا يكفي أن يُردّ: من رُدّ عليه يحتاج أن يعرف **أيَّ** مهارةٍ يربط بها
       دورتَه، وإلّا جرّب اسما آخرَ حتّى يمرّ — وهو ما نمنعه بعينه. */
    const refusal = await admin
      .createSkill({ id: `SK-X-H4C-${S}`, slug: `h4c_${S.toLowerCase()}`, nameAr: NAME }, actorId)
      .catch((e: { message: string }) => e.message)
    expect(refusal, 'رُدّ بلا أن يُسمّى ما في القاموس').toContain(`SK-X-H4A-${S}`)

    /* ولا يُكتب أثرٌ لما لم يقع */
    expect(await prisma.auditEvent.count({
      where: { action: 'catalog.skill.create', entityId: { startsWith: `SK-X-H4B` } },
    })).toBe(0)
  })

  it('واسمٌ مختلفٌ حقّا يمرّ — فالبابُ يُغلق على الغلط لا على العمل', async () => {
    const other = await admin.createSkill(
      { id: `SK-X-H4D-${S}`, slug: `h4d_${S.toLowerCase()}`, nameAr: `تيسيرُ ورشةٍ افتراضيّة ${S}` },
      actorId,
    )
    expect(other.id).toBe(`SK-X-H4D-${S}`)
  })
})
