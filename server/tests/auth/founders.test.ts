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
