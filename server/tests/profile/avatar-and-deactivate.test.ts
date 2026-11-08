/* مراجعةُ الملفّ الشخصيّ والحساب (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `profile.service.ts` و`auth.routes.ts`.

   ① **صورةُ الحساب رابطُ ويب لا مفتاحُ تخزين** — كانت الخانةُ تقبل `storage:<مفتاح>`، فمن كتب مفتاحَ ملفٍّ يراه (كرّاسةُ شعبته
      المدفوعة) جعله «صورتَه»، وبابُ الصورة بلا دخول يعطيه لكلّ أحد.
   ② **ولا يعطّل آخرُ مدير نظامٍ حسابَه** — فلا يبقى من يرفع الإيقاف. والتعطيلُ الذاتيُّ يُكتب في الأثر. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { putObject } from '../../services/object-store'
import { newStorageKey } from '../../services/storage.service'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let seq = 0

const account = async (roles: string[]) => {
  seq += 1
  const email = `aad-${seq}@test.local`
  const { userId } = await auth.register(email, 'Pass#12345', `حساب ${seq}`)
  await auth.setRoles(userId, roles)
  return { userId, cookie: `${SESSION_COOKIE}=${(await auth.login(email, 'Pass#12345')).token}` }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

describe('① صورة الحساب رابط ويب لا مفتاح تخزين', () => {
  it('⚠️ مفتاح ملف خاص لا يكتب صورة — ولا يفتحه باب الصورة بلا دخول', async () => {
    const { cookie } = await account(['learner'])
    const key = newStorageKey()
    await putObject(key, Buffer.from('محتوى دورة مدفوعة'), { mime: 'application/pdf', originalName: 'module.pdf' })
    const patch = await app.inject({ method: 'PATCH', url: '/api/learner/profile', headers: { cookie }, payload: { avatarUrl: `storage:${key}` } })
    expect(patch.statusCode, 'قبل مفتاح تخزين صورة').toBe(422)
    expect((await app.inject({ method: 'GET', url: `/api/v1/avatars/${key}` })).statusCode, 'فتح الملف الخاص بلا دخول').toBe(404)
  })

  it('ورابط ويب يكتب، والفراغ يمحو', async () => {
    const { cookie } = await account(['learner'])
    const ok = await app.inject({ method: 'PATCH', url: '/api/learner/profile', headers: { cookie }, payload: { avatarUrl: 'https://example.com/me.jpg' } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().profile.avatarUrl).toBe('https://example.com/me.jpg')
    const cleared = await app.inject({ method: 'PATCH', url: '/api/learner/profile', headers: { cookie }, payload: { avatarUrl: null } })
    expect(cleared.json().profile.avatarUrl).toBeNull()
  })
})

describe('② ولا يعطل آخر مدير نظام حسابه', () => {
  it('⚠️ آخر مدير نظام نشط يرد — ومع مدير آخر يمضي ويكتب في الأثر', async () => {
    await prisma.userRole.deleteMany({ where: { roleId: 'super_admin' } })
    const only = await account(['super_admin'])
    const refused = await app.inject({ method: 'POST', url: '/api/auth/deactivate', headers: { cookie: only.cookie } })
    expect(refused.statusCode, 'عطل آخر مدير نظام حسابه').toBe(409)
    expect(refused.json().error.code).toBe('last_super_admin')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: only.userId } })).status).toBe('active')

    await account(['super_admin'])
    const ok = await app.inject({ method: 'POST', url: '/api/auth/deactivate', headers: { cookie: only.cookie } })
    expect(ok.statusCode).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: only.userId } })).status).toBe('suspended')
    expect(await prisma.auditEvent.count({ where: { action: 'account.self_deactivate', entityId: only.userId } }), 'لم يكتب في الأثر').toBe(1)
  })

  it('ومتعلم يعطل حسابه كما كان', async () => {
    const me = await account(['learner'])
    expect((await app.inject({ method: 'POST', url: '/api/auth/deactivate', headers: { cookie: me.cookie } })).statusCode).toBe(200)
  })
})
