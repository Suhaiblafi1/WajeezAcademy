/* شاشةُ الطلبة تكتب حسابَ الطالب وحدَه (١٠ نوفمبر ٢٠٢٦).

   كان تعديلُ الحساب فيها (`LearnersService.updateAccount`) يسأل «أتملك إدارةَ التسجيل؟» ولا يسأل «أهذا طالب؟». فالمنسّقُ
   الأكاديميُّ — ومثلُه المديرُ الأكاديميُّ ومديرُ العمليّات — كتب بريدَه على حساب السوبر أدمن، ثمّ «نسيت كلمة المرور»
   يأخذه. وجُرّب فمرّ. فحسابٌ يحمل دورا غيرَ «متعلّم» يُردّ إلى «المستخدمون» بحارس رتبته. والإيقافُ من هنا بباب الحساب
   نفسِه (`AuthService.suspend`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { LearnersService, scopeFor, type LearnerScope } from '../../services/learners.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient
let auth: AuthService
let learners: LearnersService
const STAMP = Date.now()
let seq = 0
const scopeOf = (role: string, userId: string) => scopeFor({ userId, permissions: ROLE_PERMISSIONS[role] as string[] }) as LearnerScope

async function account(roles: string[]) {
  const userId = (await auth.register(`lsl-${++seq}-${STAMP}@test.local`, 'Account#12345', `حساب ${seq}`)).userId
  await auth.setRoles(userId, roles)
  return userId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  learners = new LearnersService(prisma)
}, 240_000)

describe('شاشة الطلبة تكتب حساب الطالب وحده', () => {
  it('⚠️ المنسق لا يكتب بريد السوبر أدمن ولا يوقفه — ولا بريد مدرب', async () => {
    const coord = await account(['academic_coordinator'])
    const scope = scopeOf('academic_coordinator', coord)
    for (const roles of [['super_admin'], ['trainer'], ['learner', 'finance']]) {
      const target = await account(roles)
      const before = await prisma.user.findUniqueOrThrow({ where: { id: target } })
      await expect(learners.updateAccount(scope, target, coord, { email: `taken-${seq}-${STAMP}@evil.test` }), `كتب بريد ${roles.join('+')}`)
        .rejects.toMatchObject({ code: 'not_learner_account', status: 403 })
      await expect(learners.updateAccount(scope, target, coord, { status: 'suspended' })).rejects.toMatchObject({ status: 403 })
      const after = await prisma.user.findUniqueOrThrow({ where: { id: target } })
      expect([after.email, after.status]).toEqual([before.email, before.status])
    }
  })

  it('⚠️ وحساب الطالب يكتب — والإيقاف يغلق جلساته ويقيد إغلاق تقويمه كإيقاف «المستخدمون»', async () => {
    const coord = await account(['academic_coordinator'])
    const learner = await account(['learner'])
    await auth.login((await prisma.user.findUniqueOrThrow({ where: { id: learner } })).email, 'Account#12345')
    const scope = scopeOf('academic_coordinator', coord)

    const out = await learners.updateAccount(scope, learner, coord, { displayName: 'اسم جديد', status: 'suspended' })
    expect(out).toMatchObject({ displayName: 'اسم جديد', status: 'suspended' })
    const u = await prisma.user.findUniqueOrThrow({ where: { id: learner } })
    expect(u.status).toBe('suspended')
    expect(u.calendarClosedAt, 'لم يمر الإيقاف بباب الحساب').not.toBeNull()
    expect(await prisma.session.count({ where: { userId: learner, revokedAt: null } }), 'بقيت جلسته').toBe(0)

    await learners.updateAccount(scope, learner, coord, { status: 'active' })
    const back = await prisma.user.findUniqueOrThrow({ where: { id: learner } })
    expect([back.status, back.calendarClosedAt]).toEqual(['active', null])
  })
})
