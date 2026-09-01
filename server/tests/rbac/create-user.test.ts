/* إنشاءُ حسابٍ إداريّ — وقيدُ الرتبة الذي لم يكن.

   قرارُ صاحب المنصّة: «ما فيه أي مسار لإنشاء مستخدم جديد — أضف مسارا ينشئ
   حسابا جديدا مباشرة (بريد + دور)، ويرسل بريدا تلقائيا يوضّح دوره ووظيفته
   على المنصّة وخطوة تفعيل حسابه».

   ─────────── وتصعيدٌ صامت أُغلق في الطريق ───────────

   `POST /users/:id/roles` كان بلا قيدِ رتبةٍ إطلاقا: من يملك
   `admin.users.manage` يُسند أيَّ دورٍ لأيّ أحد — بما فيه `super_admin`
   لنفسه. ولم يكن مفتوحا اليوم لأنّ الحبّة لا يملكها إلّا مديرُ النظام،
   لكنّ التفويضَ يجعلها قابلةً للمنح: فمن مُنحها مرّةً لغرضٍ ضيّق صار
   يستطيع أن يرقّي نفسه.

   وهذا هو صنفُ الثغرة الذي لا يظهر في أيّ شاشة: لا خطأَ يُرمى، ولا سطرَ
   يحمرّ — يصير الحسابُ مديرَ نظام، وكلُّ شيءٍ بعدها «مسموح». */

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
let opsCookie = ''      // مُنح `admin.users.manage` بالتفويض — رتبتُه ٧٠
let opsId = ''

const STAMP = Date.now()
const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const sa = await auth.register(`cu-super-${STAMP}@test.local`, 'Super#12345', 'مدير النظام')
  await auth.setRoles(sa.userId, ['super_admin'])
  superCookie = await cookieFor(`cu-super-${STAMP}@test.local`, 'Super#12345')

  const ops = await auth.register(`cu-ops-${STAMP}@test.local`, 'Ops#12345', 'مدير العمليات')
  opsId = ops.userId
  await auth.setRoles(opsId, ['operations_manager'])
  /* التفويضُ يجعل الحبّةَ قابلةً للمنح — وهو ما يجعل الثغرةَ قابلةً للبلوغ */
  await prisma.userPermission.create({
    data: { userId: opsId, permissionKey: 'admin.users.manage', effect: 'grant', reason: 'اختبار قيد الرتبة' },
  })
  opsCookie = await cookieFor(`cu-ops-${STAMP}@test.local`, 'Ops#12345')
})

describe('إنشاءُ الحساب بدوره', () => {
  it('يُنشأ الحساب ويُسنَد دورُه في فعلٍ واحد', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/admin/users', headers: { cookie: superCookie },
      payload: { email: `cu-new-${STAMP}@test.local`, displayName: 'موظّفٌ جديد', roleIds: ['support'] },
    })
    expect(r.statusCode, r.body).toBe(201)
    const created = await prisma.user.findUnique({
      where: { email: `cu-new-${STAMP}@test.local` }, include: { roles: true },
    })
    expect(created!.roles.map((x) => x.roleId)).toEqual(['support'])
  })

  /* كلمةٌ تمرّ في بريدٍ تبقى فيه — فلا تُرسَل ولا تُختار هنا */
  it('ولا كلمةَ مرورٍ تُختار ولا تُرسَل — يُعيّنها صاحبُها من رابطٍ مؤقّت', async () => {
    const u = await prisma.user.findUnique({ where: { email: `cu-new-${STAMP}@test.local` } })
    const token = await prisma.passwordResetToken.findFirst({ where: { userId: u!.id } })
    expect(token, 'لا رابطَ تفعيلٍ أُصدر').toBeTruthy()
    expect(token!.usedAt).toBeNull()
  })

  it('ولا يُنشأ حسابان لبريدٍ واحد', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/admin/users', headers: { cookie: superCookie },
      payload: { email: `cu-new-${STAMP}@test.local`, displayName: 'مكرّر', roleIds: ['support'] },
    })
    expect(r.statusCode).toBe(409)
  })

  it('ومن لا يملك إدارةَ المستخدمين لا يُنشئ أحدا', async () => {
    const learner = await auth.register(`cu-plain-${STAMP}@test.local`, 'Plain#12345', 'متعلّم')
    void learner
    const cookie = await cookieFor(`cu-plain-${STAMP}@test.local`, 'Plain#12345')
    const r = await app.inject({
      method: 'POST', url: '/api/admin/users', headers: { cookie },
      payload: { email: `cu-x-${STAMP}@test.local`, displayName: 'س', roleIds: ['support'] },
    })
    expect(r.statusCode).toBe(403)
  })
})

describe('قيدُ الرتبة — لا يُعيَّن دورٌ أعلى من رتبة المعيِّن', () => {
  it('مديرُ العمليات لا يُنشئ مديرَ نظام', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/admin/users', headers: { cookie: opsCookie },
      payload: { email: `cu-sneak-${STAMP}@test.local`, displayName: 'تسلّل', roleIds: ['super_admin'] },
    })
    expect(r.statusCode, 'أنشأ من هو أدنى رتبةً مديرَ نظام').toBe(403)
    expect(await prisma.user.findUnique({ where: { email: `cu-sneak-${STAMP}@test.local` } })).toBeNull()
  })

  /* هذا هو التصعيدُ الصامت بعينه: ترقيةُ النفس */
  it('ولا يرقّي نفسَه مديرَ نظام', async () => {
    const r = await app.inject({
      method: 'POST', url: `/api/admin/users/${opsId}/roles`, headers: { cookie: opsCookie },
      payload: { roleIds: ['operations_manager', 'super_admin'] },
    })
    expect(r.statusCode, 'رقّى نفسَه — وهو تصعيدٌ لا يظهر في أيّ شاشة').toBe(403)
    const after = await prisma.user.findUnique({ where: { id: opsId }, include: { roles: true } })
    expect(after!.roles.map((x) => x.roleId)).not.toContain('super_admin')
  })

  it('ولا يعيّن دورا أعلى منه لغيره', async () => {
    const victim = await auth.register(`cu-victim-${STAMP}@test.local`, 'V#12345678', 'ضحيّة')
    const r = await app.inject({
      method: 'POST', url: `/api/admin/users/${victim.userId}/roles`, headers: { cookie: opsCookie },
      payload: { roleIds: ['academic_manager'] },
    })
    expect(r.statusCode).toBe(403)
  })

  it('ويعيّن ما هو في رتبته أو دونها', async () => {
    const ok = await auth.register(`cu-peer-${STAMP}@test.local`, 'P#12345678', 'زميل')
    const r = await app.inject({
      method: 'POST', url: `/api/admin/users/${ok.userId}/roles`, headers: { cookie: opsCookie },
      payload: { roleIds: ['support'] },
    })
    expect(r.statusCode, r.body).toBe(200)
  })

  /* ولولا هذا لما استطاع مديرُ نظامٍ أن يعيّن مديرَ نظامٍ آخر أبدا */
  it('ومديرُ النظام يعيّن مديرَ نظامٍ آخر — المساواةُ مقبولة', async () => {
    const peer = await auth.register(`cu-sa2-${STAMP}@test.local`, 'S#12345678', 'مدير ثانٍ')
    const r = await app.inject({
      method: 'POST', url: `/api/admin/users/${peer.userId}/roles`, headers: { cookie: superCookie },
      payload: { roleIds: ['super_admin'] },
    })
    expect(r.statusCode, r.body).toBe(200)
  })
})
