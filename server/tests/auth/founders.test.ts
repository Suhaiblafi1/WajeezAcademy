/* ترقيةُ المؤسِّسين — تُختبَر حدودُها قبل أثرها.

   هذا الملفُّ يمنح **أعلى رتبةٍ في النظام** بلا فاعلٍ بشريّ. فما يُقاس هنا
   ليس «هل يرقّي» — بل **ماذا لا يفعل**: لا يُنشئ حسابا، ولا ينزع دورا، ولا
   يرقّي بريدا ليس في القائمة، ولا يترك الترقيةَ بلا أثر.

   وكلُّ واحدٍ منها لو انكسر لم يحمرّ شيءٌ في الواجهة: حسابٌ يظهر لم يسجّله
   أحد، أو دورٌ يُنزع بتعديل قائمة، أو ترقيةٌ صامتةٌ لا يعرف بها أحد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { FOUNDER_EMAILS, ensureFoundersPromoted } from '../../auth/founders'

let prisma: PrismaClient
let auth: AuthService

const FOUNDER = FOUNDER_EMAILS[0]
const OUTSIDER = 'not-a-founder@test.local'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
}, 240_000)

const rolesOf = async (email: string) => {
  const u = await prisma.user.findUnique({
    where: { email }, select: { roles: { select: { roleId: true } } },
  })
  return u?.roles.map((r) => r.roleId).sort()
}

describe('القائمةُ نفسُها', () => {
  it('كلُّ بريدٍ فيها صالحٌ وبحروفٍ صغيرة', () => {
    expect(FOUNDER_EMAILS.length, 'قائمةٌ فارغةٌ تترك المنصّةَ بلا مدير').toBeGreaterThan(0)
    for (const e of FOUNDER_EMAILS) {
      expect(e, `بريدٌ غيرُ صالح: ${e}`).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
      expect(e, 'البريدُ يُخزَّن بحروفٍ صغيرة، فالمقارنةُ تفشل صامتةً').toBe(e.toLowerCase())
    }
  })
})

describe('ما لا تفعله الترقية', () => {
  it('لا تُنشئ حسابا لبريدٍ لم يسجّل — تقولها ولا تخترع', async () => {
    const before = await prisma.user.count()
    const r = await ensureFoundersPromoted(prisma)
    expect(r.missing, 'بريدُ المؤسِّس بلا حسابٍ بعد').toContain(FOUNDER)
    expect(r.promoted).toEqual([])
    expect(await prisma.user.count(), 'حسابٌ ظهر لم يسجّله أحد').toBe(before)
  })

  it('ولا ترقّي بريدا ليس في القائمة', async () => {
    await auth.register(OUTSIDER, 'Outsider#12345', 'ليس مؤسِّسا')
    await ensureFoundersPromoted(prisma)
    expect(await rolesOf(OUTSIDER), 'رُقّي من ليس في القائمة').toEqual(['learner'])
  })
})

describe('وما تفعله', () => {
  it('ترقّي المؤسِّسَ حين يوجد حسابُه — ولا تنزع دورَه الأوّل', async () => {
    await auth.register(FOUNDER, 'Founder#12345', 'صاحبُ المنصّة')
    expect(await rolesOf(FOUNDER), 'التسجيلُ يمنح learner وحدَه').toEqual(['learner'])

    const r = await ensureFoundersPromoted(prisma)
    expect(r.promoted).toContain(FOUNDER)
    expect(await rolesOf(FOUNDER), 'المتعلّمُ يبقى متعلّما — يُضاف ولا يُبدَّل')
      .toEqual(['learner', 'super_admin'])
  })

  it('ولو سُجِّل البريدُ بحروفٍ كبيرة — فالتسجيلُ يوحّدها والقائمةُ تطابقها', async () => {
    /* حالةٌ وقعت: كُتب البريدُ `Suhaib@wajeez.co` عند التسجيل. ولو اختلف
       التوحيدُ بين الموضعَين لما وُجد الحسابُ أصلا — فتبقى الترقيةُ لا تقع،
       ولا شيءَ يقول لماذا: `missing` في سجلٍّ لا يقرؤه أحد. */
    const CAPS = 'Founder.Caps@Test.Local'
    await auth.register(CAPS, 'Caps#123456', 'مؤسِّسٌ بحروفٍ كبيرة')
    const stored = await prisma.user.findUnique({ where: { email: CAPS.toLowerCase() } })
    expect(stored, 'التسجيلُ لا يوحّد حروفَ البريد').not.toBeNull()
    expect(FOUNDER_EMAILS.every((e) => e === e.toLowerCase()),
      'بريدٌ بحروفٍ كبيرة في القائمة لا يطابق ما في القاعدة أبدا').toBe(true)
  })

  it('وتُسجَّل في الأثر بلا فاعل — لا ترقيةَ صامتة', async () => {
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'auth.founder.promoted' },
      orderBy: { createdAt: 'desc' },
    })
    expect(ev, 'رُقّي أعلى دورٍ في النظام ولا أثرَ له').not.toBeNull()
    expect(ev!.actorId, 'الفاعلُ النظامُ لا إنسان').toBeNull()
    expect(JSON.stringify(ev!.meta)).toContain(FOUNDER)
  })

  it('وآمنةُ الإعادة — إقلاعٌ ثانٍ لا يُضاعف شيئا', async () => {
    const r = await ensureFoundersPromoted(prisma)
    expect(r.promoted, 'رُقّي مرّتين').toEqual([])
    expect(r.already).toContain(FOUNDER)
    expect(await rolesOf(FOUNDER)).toEqual(['learner', 'super_admin'])
    const rows = await prisma.userRole.count({
      where: { user: { email: FOUNDER }, roleId: 'super_admin' },
    })
    expect(rows, 'صفُّ دورٍ مكرَّر').toBe(1)
  })
})

/* ═══ ورفعُ الإيقاف — المخرجُ حين يُغلَق البابُ من الداخل ═══

   رفعُ الإيقاف لا يقع إلّا من داخل لوحةٍ لا يفتحها موقوف. فمن أُوقف حسابُه
   خرج، ولا يعيده إلّا مديرُ نظامٍ آخر أو من يملك SSH — وصاحبُ المنصّة قد لا
   يملك أيّهما. وقد وقع ذلك فعلا: أوقف نفسَه من قائمة المدرّبين فذهبت لوحتُه
   ورفعُ الإيقاف معها.

   والحارسُ هنا على الترتيب قبل الأثر: الرفعُ يقع **قبل** فحصِ الدور وقبل
   `continue` الذي يتخطّى المرقَّى من قبل. ولو وقع بعده لَما رُفع إيقافٌ عمّن
   رتبتُه معه — وهي حالةُ صاحب المنصّة بعينها، لا حالةٌ نادرة. */
describe('ورفعُ الإيقاف', () => {
  const statusOf = async (email: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { email }, select: { status: true } })).status

  it('حسابُ مؤسِّسٍ موقوفٌ يعود نشطا — ولو كانت رتبتُه معه من قبل', async () => {
    expect(await rolesOf(FOUNDER), 'الشرطُ: مرقّى قبل الإيقاف').toContain('super_admin')
    await auth.suspend((await prisma.user.findUniqueOrThrow({ where: { email: FOUNDER } })).id)
    expect(await statusOf(FOUNDER)).toBe('suspended')

    const r = await ensureFoundersPromoted(prisma)
    /* الحالةُ في القاعدة أوّلا: هي المقصودةُ، وما يُرجعه التقريرُ خبرٌ عنها */
    expect(await statusOf(FOUNDER), 'بقي موقوفا ولا بابَ يعود منه').toBe('active')
    expect(await rolesOf(FOUNDER), 'نُزع دورٌ في أثناء الرفع').toEqual(['learner', 'super_admin'])
    expect(r.reinstated, 'رُفع ولم يُقَل في تقرير الإقلاع').toContain(FOUNDER)
  })

  it('ويُسجَّل في الأثر بلا فاعل — لا رفعَ إيقافٍ صامتا', async () => {
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'auth.founder.reinstated' }, orderBy: { createdAt: 'desc' },
    })
    expect(ev, 'عاد دخولٌ سُلب ولا أثرَ له').not.toBeNull()
    expect(ev!.actorId, 'الفاعلُ النظامُ لا إنسان').toBeNull()
    expect(JSON.stringify(ev!.meta)).toContain(FOUNDER)
  })

  it('وآمنُ الإعادة — إقلاعٌ ثانٍ على حسابٍ نشطٍ لا يكتب شيئا', async () => {
    const before = await prisma.auditEvent.count({ where: { action: 'auth.founder.reinstated' } })
    const r = await ensureFoundersPromoted(prisma)
    expect(
      await prisma.auditEvent.count({ where: { action: 'auth.founder.reinstated' } }),
      'رُفع إيقافُ حسابٍ نشطٍ أصلا — وكُتب في الأثر رفعٌ لم يقع',
    ).toBe(before)
    expect(r.reinstated).toEqual([])
  })

  it('ولا يُرفع إيقافُ من ليس في القائمة', async () => {
    await auth.suspend((await prisma.user.findUniqueOrThrow({ where: { email: OUTSIDER } })).id)
    const r = await ensureFoundersPromoted(prisma)
    expect(await statusOf(OUTSIDER), 'رُفع إيقافُ من ليس مؤسِّسا').toBe('suspended')
    expect(r.reinstated).not.toContain(OUTSIDER)
  })

  /* والأرشفةُ قرارٌ أثقل: تُخرج الحسابَ من الشاشات كلِّها، فلا تُنقض في
     إقلاعِ خادم. تُقال في السجلّ ويُترك أمرُها لإنسان. ويقع هذا آخرَ الملفّ
     لأنّه يترك الحسابَ مؤرشَفا. */
  it('والمؤرشَفُ يُقال ولا يُفكّ', async () => {
    const id = (await prisma.user.findUniqueOrThrow({ where: { email: FOUNDER } })).id
    await auth.archive(id, id, 'فحصُ حدودِ ترقيةِ المؤسِّسين')
    expect(await statusOf(FOUNDER)).toBe('archived')

    const r = await ensureFoundersPromoted(prisma)
    expect(await statusOf(FOUNDER), 'نُقضت أرشفةٌ في إقلاعِ خادم').toBe('archived')
    expect(r.archived, 'أُرشف مؤسِّسٌ ولم يُقَل').toContain(FOUNDER)
    expect(r.reinstated).not.toContain(FOUNDER)
  })
})
