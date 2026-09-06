/* تفضيلاتُ الإشعارات — والحدُّ الذي لا تعبره (المهمّة ٧٢).

   شاشةُ تفضيلاتٍ تُتيح كتمَ **إيصال دفعٍ** أو **إصدار شهادة** ليست خدمةً
   لصاحب الحساب: هي بابُ نزاعٍ لاحق — «لم يخبرني أحد» وقد أُخبِر وكتَمَه هو.
   وكذلك تكليفُ الموظّف: المخطّطُ نفسُه يقول «تكليفٌ لا يعلم به صاحبُه ليس
   تكليفا».

   فما يُحرَس هنا خمسةٌ، وأخطرُها الثالثُ والرابع:

   ١) الكتمُ يعمل فعلا — وقبل الكتابة لا بإخفاءٍ بعدها.
   ٢) والغيابُ يعني «مُفعَّل»: من لم يفتح الشاشةَ قطّ لا يتغيّر سلوكُه.
   ٣) **وما لا يُكتَم يُردُّ بسببه** لا يُتجاهَل صامتا.
   ٤) **والحدُّ في الخادم لا في الشاشة**: صفُّ تفضيلٍ يُحفَر في القاعدة مباشرةً
      لكتم إيصالِ دفعٍ **لا يُسكِته** — وهذا هو الفرقُ بين حدٍّ وتزيين.
   ٥) وما لا صنفَ له بعد يمضي: السهوُ في التصنيف لا يُسكِت خبرا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { NotificationService } from '../../services/notification.service'
import { buildApp } from '../../http/app'
import { NOTIFICATION_CATEGORIES, isSilenceable } from '../../../src/application/notifications/categories'

let prisma: PrismaClient
let auth: AuthService
let notifications: NotificationService
let app: FastifyInstance
let userId = ''
let token = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  notifications = new NotificationService(prisma)
  app = await buildApp(prisma)
  const u = await auth.register('prefs@test.local', 'Prefs#12345', 'صاحبُ التفضيلات')
  userId = u.userId
  token = (await auth.login('prefs@test.local', 'Prefs#12345')).token
}, 240_000)

async function clearPrefs() {
  await prisma.notificationPreference.deleteMany({ where: { userId } })
  await prisma.notification.deleteMany({ where: { userId } })
}

const send = (templateKey: string) => notifications.notify({
  userId, channel: 'in_app', templateKey, title: 'خبر', body: 'نصّ',
})

describe('الكتمُ يعمل — وقبل الكتابة', () => {
  it('صنفٌ مكتومٌ لا يُنشئ صفّا أصلا، فلا جرسٌ يعدّ ما لن يُقرأ', async () => {
    await clearPrefs()
    await prisma.notificationPreference.create({
      data: { userId, category: 'sessions', channel: 'in_app', enabled: false },
    })
    const out = await send('session.reminder.24h')
    expect(out, 'المكتومُ يجب أن يُرجع null').toBeNull()
    expect(await prisma.notification.count({ where: { userId } })).toBe(0)
  })

  it('والغيابُ يعني «مُفعَّل» — من لم يفتح الشاشةَ لا يتغيّر سلوكُه', async () => {
    await clearPrefs()
    const out = await send('session.reminder.24h')
    expect(out).not.toBeNull()
    expect(await prisma.notification.count({ where: { userId } })).toBe(1)
  })

  it('وكتمُ صنفٍ لا يكتم غيرَه', async () => {
    await clearPrefs()
    await prisma.notificationPreference.create({
      data: { userId, category: 'sessions', channel: 'in_app', enabled: false },
    })
    expect(await send('session.reminder')).toBeNull()
    expect(await send('enrollment.confirmed')).not.toBeNull()
  })
})

describe('الحدُّ في الخادم لا في الشاشة', () => {
  it('صفُّ تفضيلٍ يُحفَر في القاعدة لكتم إيصالِ دفعٍ لا يُسكِته', async () => {
    await clearPrefs()
    /* لا مسارٌ يقبل هذا — فنحفره مباشرةً كما لو فعله أحدٌ بيده في القاعدة */
    await prisma.notificationPreference.create({
      data: { userId, category: 'money', channel: 'in_app', enabled: false },
    })
    const out = await send('payment.succeeded')
    expect(out, 'إيصالُ الدفع سُكِت بصفٍّ في القاعدة — الحدُّ ليس حدّا').not.toBeNull()
    expect(await prisma.notification.count({ where: { userId } })).toBe(1)
  })

  it('وكذلك الشهادةُ وعملُ الموظّف', async () => {
    await clearPrefs()
    for (const category of ['certificates', 'work']) {
      await prisma.notificationPreference.create({
        data: { userId, category, channel: 'in_app', enabled: false },
      })
    }
    expect(await send('certificate.issued')).not.toBeNull()
    expect(await send('staff.task.assigned')).not.toBeNull()
  })

  it('وما لا صنفَ له بعد يمضي — السهوُ في التصنيف لا يُسكِت خبرا', async () => {
    await clearPrefs()
    expect(isSilenceable('key.that.has.no.category')).toBe(false)
    expect(await send('key.that.has.no.category')).not.toBeNull()
  })
})

describe('المسار — وما يُردُّ بسببه', () => {
  it('يعرض الأصنافَ كلَّها مع سببِ قفلِ ما لا يُكتَم', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/me/notification-preferences', cookies: { wajeez_session: token },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { categories: { key: string; silenceable: boolean; lockedWhyAr: string | null }[]; emailNoteAr: string }
    expect(body.categories).toHaveLength(NOTIFICATION_CATEGORIES.length)
    for (const c of body.categories) {
      if (!c.silenceable) {
        expect(c.lockedWhyAr, `${c.key}: قفلٌ بلا سبب`).toBeTruthy()
      }
    }
    /* لا مفتاحَ بريدٍ اليوم — والسببُ يُقال */
    expect(body.emailNoteAr).toMatch(/يومَ يُوصَل/)
  })

  it('وطلبُ كتمِ ما لا يُكتَم يُردُّ بسببه لا يُتجاهَل صامتا', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/me/notification-preferences', cookies: { wajeez_session: token },
      payload: { category: 'money', enabled: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { error?: { code?: string; message_ar?: string } }
    expect(body.error?.code).toBe('not_silenceable')
    expect(body.error?.message_ar ?? '').toMatch(/سجلُّك عند الخلاف/)
    /* ولا صفَّ كُتب */
    expect(await prisma.notificationPreference.count({ where: { userId, category: 'money' } })).toBe(0)
  })

  it('والكتمُ المسموحُ يُحفظ ويُقرأ', async () => {
    await clearPrefs()
    const put = await app.inject({
      method: 'PUT', url: '/api/me/notification-preferences', cookies: { wajeez_session: token },
      payload: { category: 'announcements', enabled: false },
    })
    expect(put.json()).toMatchObject({ ok: true, enabled: false })
    const get = await app.inject({
      method: 'GET', url: '/api/me/notification-preferences', cookies: { wajeez_session: token },
    })
    const row = (get.json() as { categories: { key: string; enabled: boolean }[] }).categories
      .find((c) => c.key === 'announcements')
    expect(row?.enabled).toBe(false)
  })

  it('ولا يبلغ المسارَ زائرٌ بلا جلسة', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/notification-preferences' })
    expect(res.statusCode).toBe(401)
  })
})

describe('المعجمُ نفسُه', () => {
  it('كلُّ صنفٍ غيرِ قابلٍ للكتم له سببٌ مكتوب', () => {
    for (const c of NOTIFICATION_CATEGORIES) {
      if (!c.silenceable) expect(c.lockedWhyAr, c.key).toBeTruthy()
    }
  })

  it('ولا مفتاحَ قالبٍ في صنفَين — وإلّا صار حكمُه بالترتيب لا بالقصد', () => {
    const seen = new Map<string, string>()
    for (const c of NOTIFICATION_CATEGORIES) {
      for (const k of c.templateKeys) {
        expect(seen.has(k), `${k} في ${seen.get(k)} و${c.key}`).toBe(false)
        seen.set(k, c.key)
      }
    }
  })

  it('وكلُّ مفتاحٍ يُرسله الخادمُ فعلا له صنف', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) { if (name !== 'tests' && name !== 'node_modules') walk(full) }
        else if (name.endsWith('.ts')) files.push(full)
      }
    }
    walk('server')
    const keys = new Set<string>()
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/templateKey: '([a-z0-9._]+)'/g)) keys.add(m[1])
    }
    expect(keys.size, 'لم يُقرأ أيُّ مفتاحٍ من الشيفرة').toBeGreaterThan(10)
    const classified = new Set(NOTIFICATION_CATEGORIES.flatMap((c) => [...c.templateKeys]))
    const orphans = [...keys].filter((k) => !classified.has(k))
    /* مفتاحٌ بلا صنفٍ يمضي دائما — وهو سلوكٌ آمن، لكنّه يعني أنّ صاحبَ
       الحساب لا يستطيع كتمَه ولو كان تذكيرا. فيُذكَر صريحا لا يُترك. */
    expect(orphans, `مفاتيحُ بلا صنف: ${orphans.join(', ')}`).toEqual([])
  })
})
