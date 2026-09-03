/* صحّةُ النظام: محسوبةٌ من الحقيقة، وتقول ما تعنيه، ولا تُقرأ بلا صلاحيّتها.

   «هل النظامُ سليم؟» لم يكن له جوابٌ إلّا في سجلّات الخادم — ولم يكن للخادم
   سجلٌّ أصلا قبل هذا الفرع. وأخطرُ ما تكشفه هذه الصفحة أنّ المنصّةَ تكتب
   وعودا لا يُنفّذها أحد: إشعارٌ في الطابور ينتظر عاملا خلفيّا لا وجودَ له. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { SystemHealthService } from '../../services/system-health.service'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let health: SystemHealthService
let superCookie = ''
let learnerId = ''

interface Item { key: string; valueAr: string; level: string; meaningAr: string; actionAr?: string }
interface Snapshot { groups: { titleAr: string; items: Item[] }[]; worst: string; checkedAt: string | Date }

const flat = (s: Snapshot) => s.groups.flatMap((g) => g.items)
const item = (s: Snapshot, key: string) => flat(s).find((i) => i.key === key)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  health = new SystemHealthService(prisma)

  const boss = await auth.register('health-super@test.local', 'Health#123456', 'مديرُ النظام')
  await auth.setRoles(boss.userId, ['super_admin'])
  const { token } = await auth.login('health-super@test.local', 'Health#123456')
  superCookie = `${SESSION_COOKIE}=${token}`

  const l = await auth.register('health-learner@test.local', 'Health#123456', 'متعلّم')
  learnerId = l.userId
  await auth.setRoles(learnerId, ['learner'])
}, 240_000)

describe('كلُّ بندٍ محسوبٌ من حالة القاعدة الآن', () => {
  it('يقرأ إشعارا في الطابور، ولا يُخزَّن عدّادٌ يبلى', async () => {
    const before = await health.snapshot()
    expect(item(before, 'notifications_queued')?.valueAr).toBe('لا شيء')

    await prisma.notification.create({
      data: { userId: learnerId, title: 'تذكيرُ جلسة', body: 'غدا السادسة', status: 'queued' },
    })
    const after = await health.snapshot()
    expect(item(after, 'notifications_queued')?.valueAr).toContain('1')
  })

  it('وما مضى عليه يومٌ في الطابور «معطَّل» لا «يحتاج نظرة» — الوعدُ لم يصل', async () => {
    await prisma.notification.create({
      data: {
        userId: learnerId, title: 'وعدٌ قديم', body: 'كان يجب أن يصل', status: 'queued',
        queuedAt: new Date(Date.now() - 3 * 86_400_000),
      },
    })
    const snap = await health.snapshot()
    const queued = item(snap, 'notifications_queued')!
    expect(queued.level).toBe('broken')
    expect(queued.valueAr).toContain('أقدمُها منذ')
    expect(queued.actionAr, 'لا يقول سببَ العطب').toContain('العاملَ الخلفيَّ')
  })

  it('وإشعارُ دفعٍ غيرُ معالَجٍ عطبٌ صريح — مالٌ وُصِّل ولم يُقيَّد', async () => {
    await prisma.paymentWebhookEvent.create({
      data: { provider: 'test', eventId: 'evt_health_1', payload: {}, processedAt: null },
    })
    const snap = await health.snapshot()
    const hooks = item(snap, 'payment_webhooks')!
    expect(hooks.level).toBe('broken')
    expect(hooks.meaningAr).toContain('دفع ولم تُفتح له المنصّة')
  })

  it('ودعوةٌ انتهت ولم تُستعمَل تُعَدّ — فصاحبُها ينتظرنا لا ننتظره', async () => {
    const u = await auth.register('health-invited@test.local', 'Rand#1234567', 'موظّفٌ مدعوّ')
    await prisma.user.update({ where: { id: u.userId }, data: { status: 'invited' } })
    await auth.issueInvite(u.userId)
    await prisma.passwordResetToken.updateMany({
      where: { userId: u.userId, purpose: 'invite' },
      data: { expiresAt: new Date(Date.now() - 86_400_000) },
    })
    const snap = await health.snapshot()
    const invites = item(snap, 'invites_expired')!
    expect(invites.valueAr).toContain('1')
    expect(invites.level).toBe('attention')
  })
})

describe('ويقول الحقيقةَ عن نفسه', () => {
  it('البريدُ غيرُ الموصولِ «معطَّل» — لا استعادةَ كلمةٍ ولا دعوةٌ تصل', async () => {
    const snap = await health.snapshot()
    const email = item(snap, 'email_channel')!
    expect(email.level).toBe('broken')
    expect(email.meaningAr).toContain('توثيقَ عنوانٍ')
  })

  it('ومزوّدُ الدفع التجريبيُّ «يحتاج نظرة» لا «سليم» — ولا مالَ ينتقل', async () => {
    const snap = await health.snapshot()
    const pay = item(snap, 'payment_driver')!
    expect(pay.level).toBe('attention')
    expect(pay.valueAr).toContain('تجريبيّ')
    expect(pay.actionAr).toContain('قبل الإطلاق')
  })

  it('ومطابقةُ الأدوار للشيفرة سليمةٌ بعد البذر — والمنحُ الزائدُ يُعلَن عطبا', async () => {
    const ok = await health.snapshot()
    expect(item(ok, 'rbac_match')?.level, 'القاعدةُ لا تطابق المصفوفةَ بعد البذر').toBe('ok')

    /* منحٌ نُزع من المصفوفة وبقي في القاعدة: صلاحيّةٌ تعمل بلا سندٍ في الشيفرة */
    await prisma.rolePermission.create({
      data: { roleId: 'academic_manager', permissionKey: 'finance.payment.record' },
    })
    const drift = await health.snapshot()
    const rbac = item(drift, 'rbac_match')!
    expect(rbac.level).toBe('broken')
    expect(rbac.meaningAr).toContain('لم تعد الشيفرةُ تقرّه')
    await prisma.rolePermission.deleteMany({
      where: { roleId: 'academic_manager', permissionKey: 'finance.payment.record' },
    })
  })

  it('والحكمُ العامُّ أسوأُ البنود — فلا يُقال «سليم» وفيه معطَّل', async () => {
    const snap = await health.snapshot()
    expect(snap.worst).toBe('broken')
    expect(flat(snap).some((i) => i.level === 'broken')).toBe(true)
  })

  it('ولا بندَ بلا معنًى مكتوب', async () => {
    const snap = await health.snapshot()
    expect(flat(snap).length).toBeGreaterThan(10)
    for (const i of flat(snap)) {
      expect(i.meaningAr.length, i.key).toBeGreaterThan(20)
      expect(i.valueAr.length, i.key).toBeGreaterThan(0)
    }
  })
})

describe('ولا تُقرأ بلا صلاحيّة الإعدادات', () => {
  it('مديرُ النظام يقرؤها', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/system-health', headers: { cookie: superCookie } })
    expect(res.statusCode).toBe(200)
    expect((res.json() as Snapshot).groups.length).toBeGreaterThan(3)
  })

  it('والمديرُ الأكاديميُّ لا — إعدادُ المزوّدين ليس عملَه بعد فصل المال', async () => {
    const u = await auth.register('health-academic@test.local', 'Health#123456', 'مديرٌ أكاديميّ')
    await auth.setRoles(u.userId, ['academic_manager'])
    const { token } = await auth.login('health-academic@test.local', 'Health#123456')
    const res = await app.inject({
      method: 'GET', url: '/api/admin/system-health', headers: { cookie: `${SESSION_COOKIE}=${token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('والزائرُ ٤٠١', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/system-health' })
    expect(res.statusCode).toBe(401)
  })
})
