/* صلاحيةٌ لشخصٍ بعينه — والمنعُ أعلى من الدور.

   كانت الصلاحية تُمنح بالدور كلّه ولا تُمنح لشخص: `Role → Permission` و
   `User → Role` وحدهما، ولا جدولَ ثالثا. فمن أراد أن يزيد موظّفا صلاحيةً
   واحدة مُنح الدورَ كلّه بما فيه — وهو ما يفتح أبوابا لم تُقصد.

   والقاعدة: صلاحيّاته = (صلاحيات أدواره + منح) − منع. وما يُحرس هنا:

   ١) أنّ الحساب يقع حيث تُحلّ الجلسة — لا في مسارٍ أو شاشة — فلا مسار يفوته.
   ٢) أنّ المنع يغلب المنحَ والدورَ معا.
   ٣) وأنّ الجلسات تُبطَل عند التغيير: الجلسة تحمل صلاحيّاتها وقت حلّها، فمن
      نُزعت عنه صلاحيةٌ يبقى عاملا بها حتى تنتهي جلسته — وهو أخطر ما في الباب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let auth: AuthService
let userId = ''

/** يفتح جلسةً جديدة ويقرأ صلاحيّاتها كما يقرؤها أيّ طلبٍ محميّ */
async function permsOfFreshSession() {
  const s = await auth.login('perm-user@test.local', 'Finance#12345')
  const ctx = await auth.resolve(s.token)
  return new Set(ctx!.permissions)
}

const override = (permissionKey: string, effect: 'grant' | 'deny') =>
  prisma.userPermission.upsert({
    where: { userId_permissionKey: { userId, permissionKey } },
    create: { userId, permissionKey, effect, reason: 'اختبار الاستثناء' },
    update: { effect },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  const u = await auth.register('perm-user@test.local', 'Finance#12345', 'أمين المالية')
  userId = u.userId
  await auth.setRoles(userId, ['finance'])
}, 240_000)

describe('استثناء الصلاحية لشخص', () => {
  it('بلا استثناء: صلاحيّاته صلاحياتُ دوره', async () => {
    const p = await permsOfFreshSession()
    expect(p.has('finance.view')).toBe(true)
    expect(p.has('catalog.course.publish'), 'يملك ما ليس في دوره').toBe(false)
  })

  it('المنحُ يفتح صلاحيةً واحدة — بلا منح الدور كلّه', async () => {
    await override('catalog.impact.view', 'grant')
    const p = await permsOfFreshSession()
    expect(p.has('catalog.impact.view')).toBe(true)
    /* ولا شيء غيرها من حزمة المدير الأكاديمي */
    expect(p.has('catalog.course.publish'), 'المنح جرّ معه صلاحيات أخرى').toBe(false)
    expect(p.has('catalog.pathway.approve')).toBe(false)
  })

  it('المنعُ ينزع صلاحيةً من دوره — وهو الأعلى', async () => {
    await override('finance.refund.process', 'deny')
    const p = await permsOfFreshSession()
    expect(p.has('finance.refund.process'), 'المنع لم يغلب الدور').toBe(false)
    expect(p.has('finance.view'), 'المنع نزع أكثر ممّا قُصد').toBe(true)
  })

  it('المنعُ يغلب المنحَ ولو أُضيفا معا', async () => {
    /* حالةٌ متناقضة يجب أن تُحسم بقاعدةٍ واحدة لا بترتيب الصفوف في القاعدة */
    await prisma.userPermission.deleteMany({ where: { userId, permissionKey: 'reports.export' } })
    await override('reports.export', 'grant')
    await override('reports.export', 'deny')
    const p = await permsOfFreshSession()
    expect(p.has('reports.export')).toBe(false)
  })

  it('الحساب حيث تُحلّ الجلسة — فأيّ مسارٍ يسأل يجد الجواب نفسه', async () => {
    /* لا نفحص شاشةً ولا مسارا: نفحص أنّ resolve — وهي التي يمرّ بها كلّ طلب
       محميّ — هي التي تُطبّق القاعدة. ولو حُسبت في مسارٍ لفات غيرَه. */
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../services/auth.service.ts', import.meta.url), 'utf8'))
    const resolveBody = /async resolve\([\s\S]*?\n {2}\}/.exec(src)?.[0] ?? ''
    expect(resolveBody, 'المنح لا يُطبَّق عند حلّ الجلسة').toContain("o.effect === 'grant'")
    expect(resolveBody, 'المنع لا يُطبَّق عند حلّ الجلسة').toContain("o.effect === 'deny'")
    /* والترتيب: المنع بعد المنح — وإلّا مرّ الممنوع */
    expect(resolveBody.indexOf("o.effect === 'grant'")).toBeLessThan(resolveBody.indexOf("o.effect === 'deny'"))
  })

  it('الجلسات القائمة تُبطَل — فلا يعمل أحدٌ بصلاحيةٍ نُزعت', async () => {
    const s = await auth.login('perm-user@test.local', 'Finance#12345')
    expect((await auth.resolve(s.token))!.permissions).toContain('finance.view')
    await auth.revokeAllSessions(userId)
    expect(await auth.resolve(s.token), 'الجلسة القديمة ما زالت تعمل').toBeNull()
  })
})
