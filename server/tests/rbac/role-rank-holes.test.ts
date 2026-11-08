/* ثغرتا الرتبة في إدارة المستخدمين (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `admin-users.routes.ts`.

   وكلتاهما لمن فُوِّض «إدارة المستخدمين» (`admin.users.manage`) دون رتبة مدير النظام — والإيقافُ والحذفُ محروسان عليه:
   ① **دعوةُ الدفعة** كانت تُنشئ حسابَ «مدير نظام» — والدعوةُ المفردةُ تردّه.
   ② **وتغييرُ الأدوار** كان يجعل مديرَ النظام «متعلّما» — يُفحص ما يُسنَد لا من يُسنَد إليه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let superId = ''
let superCookie = ''
let opsId = ''
let opsCookie = ''
const STAMP = Date.now()

const rolesOf = async (id: string) => (await prisma.userRole.findMany({ where: { userId: id } })).map((r) => r.roleId).sort()
const mk = async (tag: string, roles: string[]) => {
  const { userId } = await auth.register(`rr-${tag}-${STAMP}@test.local`, 'Pass#12345', `حساب ${tag}`)
  await auth.setRoles(userId, roles)
  return userId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  superId = await mk('super', ['super_admin'])
  superCookie = `${SESSION_COOKIE}=${(await auth.login(`rr-super-${STAMP}@test.local`, 'Pass#12345')).token}`
  opsId = await mk('ops', ['operations_manager'])
  await prisma.userPermission.create({ data: { userId: opsId, permissionKey: 'admin.users.manage', effect: 'grant', reason: 'تفويض للاختبار' } })
  opsCookie = `${SESSION_COOKIE}=${(await auth.login(`rr-ops-${STAMP}@test.local`, 'Pass#12345')).token}`
}, 240_000)

describe('① دعوة الدفعة', () => {
  it('⚠️ لا تنشئ حسابا فوق رتبة الداعي — ولا ينشأ شيء', async () => {
    const email = `rr-mine-${STAMP}@test.local`
    const res = await app.inject({
      method: 'POST', url: '/api/admin/users/bulk-invite', headers: { cookie: opsCookie },
      payload: { roleIds: ['super_admin'], rows: [{ email, displayName: 'حساب ثان' }] },
    })
    expect(res.statusCode, 'أنشأت الدفعة مدير نظام').toBe(403)
    expect(res.json().error.code).toBe('rank_exceeded')
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })

  it('وما في رتبته يمضي', async () => {
    const email = `rr-agent-${STAMP}@test.local`
    const res = await app.inject({
      method: 'POST', url: '/api/admin/users/bulk-invite', headers: { cookie: opsCookie },
      payload: { roleIds: ['support'], rows: [{ email, displayName: 'وكيل دعم' }] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().created).toBe(1)
  })
})

describe('② تغيير الأدوار', () => {
  it('⚠️ لا يمس من في رتبة المغير أو فوقه — ومدير النظام يبقى', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/admin/users/${superId}/roles`, headers: { cookie: opsCookie }, payload: { roleIds: ['learner'] } })
    expect(res.statusCode, 'جعل مدير النظام متعلما').toBe(403)
    expect(res.json().error.code).toBe('rank_exceeded')
    expect(await rolesOf(superId)).toEqual(['super_admin'])

    const peer = await mk('peer', ['operations_manager'])
    const same = await app.inject({ method: 'POST', url: `/api/admin/users/${peer}/roles`, headers: { cookie: opsCookie }, payload: { roleIds: ['learner'] } })
    expect(same.statusCode, 'غير أدوار نظيره').toBe(403)
  })

  it('وما دونه يمضي — ومدير النظام يغير أدوار نظيره', async () => {
    const low = await mk('low', ['learner'])
    const res = await app.inject({ method: 'POST', url: `/api/admin/users/${low}/roles`, headers: { cookie: opsCookie }, payload: { roleIds: ['learner', 'support'] } })
    expect(res.statusCode).toBe(200)
    expect(await rolesOf(low)).toEqual(['learner', 'support'])

    const peerSuper = await mk('peer-super', ['super_admin'])
    const top = await app.inject({ method: 'POST', url: `/api/admin/users/${peerSuper}/roles`, headers: { cookie: superCookie }, payload: { roleIds: ['super_admin', 'learner'] } })
    expect(top.statusCode).toBe(200)
  })

  it('وحساب لا وجود له يرد ٤٠٤', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/users/00000000-0000-4000-8000-000000000000/roles', headers: { cookie: opsCookie }, payload: { roleIds: ['learner'] } })
    expect(res.statusCode).toBe(404)
  })
})
