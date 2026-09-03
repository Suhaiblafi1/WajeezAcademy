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

  it('ومديرُ النظام الأعلى يوقف مديرَ نظامٍ آخر ويرفع عنه — فلا حسابَ فوق يده', async () => {
    /* كان القيدُ «رتبتك أو فوقها» يمنع الأعلى من إيقاف نظيره أو حذفِ حسابِ
       ديمو بدور `super_admin` — فلا أحدَ يفكّه، والسبيلُ الوحيد SQL على
       الإنتاج. والأعلى لا أعلى منه، فيُستثنى من القيد (وحسابُه محروسٌ قبله
       بحارس «لا توقف نفسك»). */
    const peer = await mkUser('peer-super', ['super_admin'])
    expect(body(await app.inject({ method: 'POST', url: `/api/admin/users/${peer}/suspend`, headers: { cookie: superCookie } })).ok).toBe(true)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: peer } })).status).toBe('suspended')
    expect(body(await app.inject({ method: 'POST', url: `/api/admin/users/${peer}/reinstate`, headers: { cookie: superCookie } })).ok).toBe(true)
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

  /* ─────────── المحوُ بالسجلّ ───────────

     قرارُ صاحب المنصّة: «اريد ان احذف حسابات كانت تجريبيه». وحساباتُ الديمو
     لها تسجيلاتٌ وطلباتٌ وتقييمات — فبوّابةُ «لا يُحذف من ترك أثرا» كانت
     تحبسها كلَّها، ولا سبيلَ إلى إزالتها إلّا SQL على الإنتاج.

     فبابٌ ثانٍ بحبّةٍ مستقلّة (`admin.users.purge_history`) وبسببٍ يُكتب
     ويُحفظ في الأثر قبل المحو. ولا يُفتح بالخطأ: الطلبُ الأوّل بلا قسرٍ
     يُردّ بالسجلّ معدودا، والقسرُ يُطلب صريحا بعده. */
  it('يمحو حسابا بسجلّه بحبّته وبسبب — ويسجّل بصمتَه قبل المحو', async () => {
    const id = await mkUser('demo-with-history')
    const order = await prisma.order.create({
      data: { userId: id, status: 'pending_payment', subtotal: 100, total: 100, currency: 'USD' },
    })
    await prisma.invoice.create({ data: { orderId: order.id, number: `INV-SP-${STAMP}`, amount: 100, currency: 'USD' } })

    /* بلا قسر: يُردّ بالسجلّ معدودا وبأنّ البابَ الثاني متاح */
    const first = JSON.parse((await app.inject({
      method: 'DELETE', url: `/api/admin/users/${id}`, headers: { cookie: superCookie },
    })).body) as { error?: { code: string; blockers?: string[]; forceAllowed?: boolean } }
    expect(first.error?.code).toBe('has_history')
    expect(first.error?.blockers?.join(' · ')).toContain('طلبَ شراء')
    expect(first.error?.forceAllowed).toBe(true)
    expect(await prisma.user.findUnique({ where: { id } }), 'مُحي بلا قسر').not.toBeNull()

    /* قسرٌ بلا سبب: يُردّ */
    const noReason = body(await app.inject({
      method: 'DELETE', url: `/api/admin/users/${id}?force=1`, headers: { cookie: superCookie }, payload: {},
    }))
    expect(noReason.error?.code).toBe('reason_required')

    /* وبسبب: يُمحى هو وسجلُّه، والأثرُ يشهد */
    const done = body(await app.inject({
      method: 'DELETE', url: `/api/admin/users/${id}?force=1`, headers: { cookie: superCookie },
      payload: { reason: 'حساب تجربة — يُزال هو وسجلّه' },
    }))
    expect(done.ok).toBe(true)
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull()
    expect(await prisma.order.findUnique({ where: { id: order.id } }), 'بقي طلبٌ بلا صاحب').toBeNull()
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'admin.user.purge_with_history', entityId: id } })
    expect(audit, 'مُحي بلا أثرٍ يشهد').not.toBeNull()
    expect(audit?.reason).toContain('حساب تجربة')
  })

  it('ولا يملك القسرَ من يملك الحذفَ العاديّ وحدَه', async () => {
    const id = await mkUser('force-by-ops')
    await prisma.order.create({ data: { userId: id, status: 'pending_payment', subtotal: 50, total: 50, currency: 'USD' } })
    await prisma.userPermission.create({
      data: { userId: opsId, permissionKey: 'admin.users.purge', effect: 'grant', reason: 'اختبار حبّة القسر' },
    })
    const opsFresh = await cookieFor(`sp-ops-${STAMP}@test.local`, 'Ops#12345')
    const res = JSON.parse((await app.inject({
      method: 'DELETE', url: `/api/admin/users/${id}?force=1`, headers: { cookie: opsFresh },
      payload: { reason: 'محاولةُ محوٍ بلا حبّته' },
    })).body) as { error?: { code: string; forceAllowed?: boolean } }
    expect(res.error?.code).toBe('force_forbidden')
    expect(await prisma.user.findUnique({ where: { id } }), 'مُحي بلا حبّة القسر').not.toBeNull()
  })

  it('ولا يحذف صاحبُ الحساب نفسَه من هنا', async () => {
    const res = body(await app.inject({ method: 'DELETE', url: `/api/admin/users/${superId}`, headers: { cookie: superCookie } }))
    expect(res.error?.code).toBe('self_purge')
  })
})
