/* الحسابُ الموقوف: خانةٌ يُخرَج منها، وحذفٌ لا يمحو دفترا.

   قرارُ صاحب المنصّة: «الحذفُ يكون إزالةَ الحساب كليّا من القاعدة، أو
   إيقافَه فقط ويوضع في خانةٍ منفصلة: الحسابات الموقوفة».

   وثلاثةُ أشياءَ لم تكن، وهذا الملفّ يحرسها:

   ١) **الإيقافُ كان بابا بلا مخرج**: لا مسارَ لرفعه إطلاقا. فأوّلُ إيقافٍ
      بالخطأ يصير دائما، ولا حيلةَ إلّا SQL على قاعدة الإنتاج.

   ٢) **الإيقافُ كان بلا قيدِ رتبة**: من مُنح `admin.users.manage` بالتفويض
      يوقف مديرَ النظام الأعلى نفسَه — فيُقفَل الأعلى بيد الأدنى.

   ٣) **والحذفُ يمحو دفترَ المال بلا سؤال**: القاعدةُ تُسلسل الحذفَ إلى
      `Order` (`ON DELETE CASCADE`)، فحذفُ مشترٍ يمحو فواتيرَه ودفعاتِه معه.
      فحبّةٌ وحدَها (`admin.users.purge`) لا تُطوى في «الإدارة»، ورفضٌ يقول
      ما يمنعه بالعدد ويدلّ على البديل. */

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
let superCookie = ''
let superId = ''
let opsCookie = ''
let opsId = ''

const STAMP = Date.now()
const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

const mkUser = async (tag: string, roles: string[] = ['learner']) => {
  const u = await auth.register(`sp-${tag}-${STAMP}@test.local`, 'Pass#12345', `حساب ${tag}`)
  await auth.setRoles(u.userId, roles)
  return u.userId
}

const body = (res: { body: string }) => JSON.parse(res.body) as { ok?: boolean; error?: { code: string; message_ar: string } }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const sa = await auth.register(`sp-super-${STAMP}@test.local`, 'Super#12345', 'مدير النظام')
  superId = sa.userId
  await auth.setRoles(superId, ['super_admin'])
  superCookie = await cookieFor(`sp-super-${STAMP}@test.local`, 'Super#12345')

  const ops = await auth.register(`sp-ops-${STAMP}@test.local`, 'Ops#12345', 'مدير العمليات')
  opsId = ops.userId
  await auth.setRoles(opsId, ['operations_manager'])
  await prisma.userPermission.create({
    data: { userId: opsId, permissionKey: 'admin.users.manage', effect: 'grant', reason: 'اختبار قيد الرتبة' },
  })
  opsCookie = await cookieFor(`sp-ops-${STAMP}@test.local`, 'Ops#12345')
}, 240_000)

describe('الإيقافُ ورفعُه', () => {
  it('يوقف ثمّ يرفع — والحسابُ يعود نشطا بلا أثرِ إيقاف', async () => {
    const id = await mkUser('cycle')
    expect(body(await app.inject({ method: 'POST', url: `/api/admin/users/${id}/suspend`, headers: { cookie: superCookie } })).ok).toBe(true)
    let row = await prisma.user.findUnique({ where: { id } })
    expect(row?.status).toBe('suspended')
    expect(row?.suspendedAt).not.toBeNull()

    expect(body(await app.inject({ method: 'POST', url: `/api/admin/users/${id}/reinstate`, headers: { cookie: superCookie } })).ok).toBe(true)
    row = await prisma.user.findUnique({ where: { id } })
    expect(row?.status).toBe('active')
    expect(row?.suspendedAt, 'تاريخُ الإيقاف بقي على حسابٍ نشط').toBeNull()
  })

  it('ولا يُرفع إيقافُ من ليس موقوفا — لا «تمّ» على لا شيء', async () => {
    const id = await mkUser('never-suspended')
    const res = body(await app.inject({ method: 'POST', url: `/api/admin/users/${id}/reinstate`, headers: { cookie: superCookie } }))
    expect(res.error?.code).toBe('not_suspended')
  })

  it('ومن دون رتبةٍ كافية لا يوقف من فوقه', async () => {
    const res = body(await app.inject({ method: 'POST', url: `/api/admin/users/${superId}/suspend`, headers: { cookie: opsCookie } }))
    expect(res.error?.code, 'مدير العمليات أوقف مديرَ النظام الأعلى').toBe('rank_exceeded')
    expect((await prisma.user.findUnique({ where: { id: superId } }))?.status).toBe('active')
  })
})

describe('الحذفُ النهائيّ', () => {
  it('يحذف حسابا بلا أثر — ويكتب الأثرَ قبل المحو', async () => {
    const id = await mkUser('clean')
    const email = (await prisma.user.findUnique({ where: { id } }))!.email
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/users/${id}`, headers: { cookie: superCookie } })
    expect(body(res).ok, res.body).toBe(true)
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull()
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'admin.user.purge', entityId: id } })
    expect(audit, 'حُذف الحسابُ بلا أثرٍ يشهد عليه').not.toBeNull()
    expect((audit?.meta as { email?: string })?.email).toBe(email)
  })

  it('ويرفض حسابا له طلبُ شراء — ويقول العددَ ويدلّ على الإيقاف', async () => {
    const id = await mkUser('buyer')
    await prisma.order.create({ data: { userId: id, status: 'pending_payment', subtotal: 100, total: 100, currency: 'USD' } })
    const res = body(await app.inject({ method: 'DELETE', url: `/api/admin/users/${id}`, headers: { cookie: superCookie } }))
    expect(res.error?.code).toBe('has_history')
    expect(res.error?.message_ar).toContain('1 طلبَ شراء')
    expect(res.error?.message_ar).toContain('أوقفه')
    expect(await prisma.user.findUnique({ where: { id } }), 'مُحي حسابٌ له دفتر').not.toBeNull()
  })

  it('ولا يملكه من يملك الإدارة وحدَها — الحبّةُ منفصلة', async () => {
    const id = await mkUser('by-ops')
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/users/${id}`, headers: { cookie: opsCookie } })
    expect(res.statusCode, 'من يوقِف صار يمحو').toBe(403)
    expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull()
  })

  it('ولا يحذف صاحبُ الحساب نفسَه من هنا', async () => {
    const res = body(await app.inject({ method: 'DELETE', url: `/api/admin/users/${superId}`, headers: { cookie: superCookie } }))
    expect(res.error?.code).toBe('self_purge')
  })
})
