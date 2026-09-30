/* إعدادُ Zoom من شاشة الإدارة — ورمزُ أحداثه معه (٣٠ سبتمبر ٢٠٢٦).

   كان رمزُ التحقّق من أحداث Zoom (`webhookSecret`) لا يُضبط إلّا في الخادم
   (`ZOOM_WEBHOOK_SECRET`): الشاشةُ بلا حقلٍ له، ومخطَّطُ مسار الحفظ يُسقطه صامتا لو
   أُرسل. فمن أعدّ Zoom من الشاشة وحدَها رفض Zoom عنوانَ أحداثه — المستقبِلُ لا يملك ما
   يردّ به تحدّيَ الملكيّة — ولم يصل حدثٌ واحد: لا حضورٌ ولا دخولُ مضيفٍ ولا تسجيل.

   ويُقاس عبر **المسار** لا الدالّة: الحفظُ من مسار الإدارة بجلسة مدير، ثمّ تحدّي Zoom
   على مسار الأحداث — فهما ما يمرّ به الرمزُ فعلا.

   ① ⚠️ الرمزُ يُحفظ من الشاشة — ثمّ يردّ المستقبِلُ تحدّيَ Zoom به.
   ② ⚠️ ولا يعود كاملا في العرض — مقنَّعا، ومعه أنّه محفوظ وعنوانُ الأحداث.
   ③ ⚠️ والمقنَّعُ العائدُ من الشاشة لا يُكتب فوقه، والأثرُ يقول إنّه تبدّل ولا يقوله.
   ④ والبيئةُ تغلبه — ويُقال ذلك في العرض.
   ⑤ ⚠️ وفحصُ الاتصال يقول إن لم يكن للأحداث رمز.
   ⑥ ⚠️ وبريدُ المضيف الفارغُ يعني صاحبَ التطبيق — كما يعد عنوانُ حقله — والغائبُ يُبقي ما كان. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { forgetZoomToken, getZoomConfig, zoomProbe } from '../../services/zoom.service'

let prisma: PrismaClient
let app: FastifyInstance
let cookie = ''
const STAMP = Date.now()
const SECRET = `whs-zoom-events-${STAMP}`
const ENV_KEYS = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL', 'ZOOM_WEBHOOK_SECRET'] as const
const SAVED: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}

const save = (body: Record<string, unknown>) => app.inject({
  method: 'PUT', url: '/api/admin/integrations/zoom', headers: { cookie }, payload: body,
})
const view = async () => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/integrations', headers: { cookie } })
  expect(res.statusCode).toBe(200)
  return res.json() as { zoom: Record<string, unknown> }
}

beforeAll(async () => {
  /* البيئةُ تغلب ما في الجدول — فتُفرَّغ هنا كي يُقاس ما تحفظه الشاشة */
  for (const k of ENV_KEYS) { SAVED[k] = process.env[k]; delete process.env[k] }
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register(`zoom-settings-${STAMP}@test.local`, 'Admin#12345', 'مدير الإعدادات')
  await auth.setRoles(admin.userId, ['super_admin'])
  cookie = `${SESSION_COOKIE}=${(await auth.login(`zoom-settings-${STAMP}@test.local`, 'Admin#12345')).token}`
}, 240_000)

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

describe('① الرمزُ يُحفظ من الشاشة — ثمّ يُردّ به تحدّي Zoom', () => {
  it('⚠️ من مسار الإدارة إلى مسار الأحداث — لا في الخادم وحدَه', async () => {
    const res = await save({
      enabled: true, accountId: 'acc-1', clientId: 'cid-1', clientSecret: 'sec-1', hostEmail: 'host@wajeez.test',
      webhookSecret: SECRET,
    })
    expect(res.statusCode).toBe(200)
    expect((await getZoomConfig(prisma)).webhookSecret, 'أُسقط الرمزُ قبل أن يبلغ الحفظ').toBe(SECRET)

    /* تحدّي الملكيّة كما يرسله Zoom ساعةَ يُحفظ العنوانُ في لوحته */
    const challenge = await app.inject({
      method: 'POST', url: '/api/webhooks/zoom', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ event: 'endpoint.url_validation', payload: { plainToken: 'plain-abc' } }),
    })
    expect(challenge.statusCode, 'لا رمزَ يُردّ به — فيرفض Zoom العنوانَ ولا يصل حدث').toBe(200)
    expect(challenge.json()).toEqual({
      plainToken: 'plain-abc',
      encryptedToken: createHmac('sha256', SECRET).update('plain-abc').digest('hex'),
    })
  })
})

describe('② ولا يعود كاملا في العرض', () => {
  it('⚠️ مقنَّعا — ومعه أنّه محفوظ، وعنوانُ الأحداث الذي يُنسخ إلى Zoom', async () => {
    const { zoom } = await view()
    expect(JSON.stringify(zoom), 'خرج الرمزُ كاملا إلى المتصفّح').not.toContain(SECRET)
    expect(zoom.webhookSecret).toBe(`••••${SECRET.slice(-4)}`)
    expect(zoom.hasWebhookSecret).toBe(true)
    expect(String(zoom.webhookUrl)).toMatch(/^https?:\/\/.+\/api\/webhooks\/zoom$/)
  })
})

describe('③ والمقنَّعُ العائدُ من الشاشة لا يُكتب فوقه', () => {
  it('⚠️ يُحفظ ما حولَه ويبقى الرمزُ كما كان', async () => {
    const { zoom } = await view()
    const res = await save({
      enabled: true, accountId: zoom.accountId, clientId: zoom.clientId, clientSecret: zoom.clientSecret,
      hostEmail: 'other-host@wajeez.test', webhookSecret: zoom.webhookSecret,
    })
    expect(res.statusCode).toBe(200)
    const cfg = await getZoomConfig(prisma)
    expect(cfg.webhookSecret, 'كُتب القناعُ فوق الرمز — فيرفض المستقبِلُ كلَّ حدث').toBe(SECRET)
    expect(cfg.hostEmail).toBe('other-host@wajeez.test')
  })

  it('والأثرُ يقول إنّه تبدّل — ولا يقول ما هو', async () => {
    const saves = await prisma.auditEvent.findMany({
      where: { action: 'integration.zoom.save' }, orderBy: { createdAt: 'asc' }, select: { meta: true },
    })
    const [first, second] = saves.map((s) => s.meta as { keysRotated?: string[] })
    expect(first?.keysRotated).toContain('webhookSecret')
    expect(second?.keysRotated ?? [], 'عُدّ القناعُ العائدُ تبديلا').not.toContain('webhookSecret')
    expect(JSON.stringify(saves)).not.toContain(SECRET)
  })
})

describe('④ والبيئةُ تغلبه', () => {
  it('ويُقال ذلك تحت حقله — لا يُحفظ فلا يؤثّر بلا كلمة', async () => {
    process.env.ZOOM_WEBHOOK_SECRET = 'from-the-server'
    try {
      expect((await view()).zoom.webhookSecretEnvSourced).toBe(true)
      expect((await getZoomConfig(prisma)).webhookSecret).toBe('from-the-server')
    } finally { delete process.env.ZOOM_WEBHOOK_SECRET }
    expect((await view()).zoom.webhookSecretEnvSourced).toBe(false)
  })
})

describe('⑤ وفحصُ الاتصال يقول إن لم يكن للأحداث رمز', () => {
  it('⚠️ المفاتيحُ السليمةُ لا تعني أحداثا تصل', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) })) as unknown as typeof fetch
    try {
      const base = { enabled: true, accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test' }
      const without = await zoomProbe({ ...base })
      expect(without.ok).toBe(true)
      expect(without.message, 'قيل «ناجح» وأحداثُه تُرفض كلُّها').toContain('لا رمزَ لأحداثه')
      const withIt = await zoomProbe({ ...base, webhookSecret: 'x' })
      expect(withIt.message).toContain('وأحداثُه تُقبل برمزها المحفوظ')
      expect(withIt.message).not.toContain('لا رمزَ لأحداثه')
    } finally {
      globalThis.fetch = realFetch
      forgetZoomToken()
    }
  })
})

describe('⑥ وبريدُ المضيف: الفارغُ صاحبُ التطبيق، والغائبُ يُبقي ما كان', () => {
  /* الشاشةُ تعد: «اتركه فارغا لصاحب التطبيق». وكان الفارغُ يبقي المضيفَ القديم —
     فمن مسحه ليعود إلى صاحب التطبيق أُنشئت اجتماعاتُه باسم من مسحه. */
  it('⚠️ الفارغُ يعيد المضيفَ صاحبَ التطبيق — لا يُبقي القديم', async () => {
    expect((await save({ enabled: true, hostEmail: 'host-a@wajeez.test' })).statusCode).toBe(200)
    expect((await getZoomConfig(prisma)).hostEmail).toBe('host-a@wajeez.test')

    expect((await save({ enabled: true, hostEmail: '' })).statusCode).toBe(200)
    expect((await getZoomConfig(prisma)).hostEmail, 'مُسح البريدُ وبقي المضيفُ القديم').toBe('me')
    expect((await view()).zoom.hostEmail).toBe('me')
  })

  it('ومسافاتٌ وحدَها فارغةٌ كذلك — لا بريدٌ يردّه Zoom مستخدما لا يُعرف', async () => {
    await save({ enabled: true, hostEmail: 'host-b@wajeez.test' })
    await save({ enabled: true, hostEmail: '   ' })
    expect((await getZoomConfig(prisma)).hostEmail).toBe('me')
  })

  it('والغائبُ من الطلب يُبقي ما كان — فنداءٌ لا يمسّ البريدَ لا يمحوه', async () => {
    await save({ enabled: true, hostEmail: 'host-c@wajeez.test' })
    expect((await save({ enabled: false })).statusCode).toBe(200)
    expect((await getZoomConfig(prisma)).hostEmail, 'حفظٌ بلا بريدٍ محا المضيف').toBe('host-c@wajeez.test')
  })
})
