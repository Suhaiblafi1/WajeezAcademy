/* «تواصل معنا» — رسالةٌ تصل فعلا (١٩ أكتوبر ٢٠٢٦).

   كان النموذجُ يعرض رقما مرجعيّا عشوائيّا ولا يُرسل شيئا. واختار صاحبُ المنصّة أن يصير حقيقيّا
   (`contact.service.ts`). فيُحرس هنا:

   ① الرسالةُ تُحفظ برقمٍ من الخادم، ويُخبَر الفريقُ في الجرس.
   ② والجهةُ بلا اسمها تُردّ بسببها — والفخُّ يردّ الآليّ ولا يُحفظ شيء.
   ③ والقائمةُ للفريق وحدَه، وما ينتظر ردّا أوّلُها، و«تمّ الرد» يُسجَّل بمن ومتى. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { ACADEMY_EMAILS } from '../../../src/data/academy-email'

/* البريدُ لا يخرج في الاختبار (لا مزوّد) — فيُسجَّل ما طُلب إرسالُه ثمّ يمضي إلى الأصل */
const mailed = vi.hoisted(() => [] as { to: string; replyTo?: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (...args: Parameters<typeof real.sendDirectEmail>) => {
      mailed.push(args[1])
      return real.sendDirectEmail(...args)
    },
  }
})

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let staffId = ''
let staffToken = ''
let learnerToken = ''

const send = (body: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/public/contact', payload: body })
const valid = {
  name: 'سارة', email: 'Sara@Test.Local', entity: 'individual',
  topic: 'استفسار عن مسار أو تشخيص', message: 'أريد أن أعرف أيّ مسارٍ يناسبني.',
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  const s = await auth.register('contact-staff@test.local', 'Staff#123456', 'فريق الدعم')
  staffId = s.userId
  await auth.setRoles(staffId, ['support'])
  staffToken = (await auth.login('contact-staff@test.local', 'Staff#123456')).token
  await auth.register('contact-learner@test.local', 'Learner#12345', 'متعلّم')
  learnerToken = (await auth.login('contact-learner@test.local', 'Learner#12345')).token
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① الرسالةُ تُحفظ ويُخبَر الفريق', () => {
  it('رقمٌ من الخادم، والصفُّ بما كُتب، والجرسُ عند الدعم', async () => {
    const res = await send(valid)
    expect(res.statusCode).toBe(201)
    const { reference } = res.json() as { reference: string }
    expect(reference).toMatch(/^WJ-C-[0-9A-F]{6}$/)
    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { reference } })
    expect(row).toMatchObject({ name: 'سارة', email: 'sara@test.local', topic: valid.topic, handledAt: null })
    const bell = await prisma.notification.findFirst({ where: { userId: staffId, templateKey: 'admin.contact_message' } })
    expect(bell, 'وصلت الرسالةُ ولم يُخبَر الفريق').not.toBeNull()
  })

  it('وتُطلب رسالتان: إلى بريد الأكاديميّة و«ردّ» فيها يصل صاحبَها، ونسخةٌ إليه برقمها', async () => {
    mailed.length = 0
    const { reference } = (await send({ ...valid, email: 'copy@test.local' }).then((r) => r.json())) as { reference: string }
    const toAcademy = mailed.find((m) => m.to === ACADEMY_EMAILS.support)
    expect(toAcademy?.replyTo, '«ردّ» يصل الأكاديميّةَ نفسَها لا صاحبَ الرسالة').toBe('copy@test.local')
    expect(toAcademy?.text).toContain(valid.message)
    const copy = mailed.find((m) => m.to === 'copy@test.local')
    expect(copy?.subject).toContain(reference)
  })
})

describe('② ما يُردّ', () => {
  it('الجهةُ بلا اسمها تُردّ بسببها', async () => {
    const res = await send({ ...valid, entity: 'company' })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { error: { message_ar: string } }).error.message_ar).toContain('اسم جهتك')
  })

  it('والفخُّ يردّ الآليّ — ولا يُحفظ شيء', async () => {
    const before = await prisma.contactMessage.count()
    const res = await send({ ...valid, website: 'http://spam.example' })
    expect(res.statusCode).toBe(400)
    expect(await prisma.contactMessage.count()).toBe(before)
  })
})

describe('③ القائمةُ للفريق', () => {
  it('لا يقرؤها متعلّم', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/contact-messages', cookies: { wajeez_session: learnerToken } })
    expect(res.statusCode).toBe(403)
  })

  it('ما ينتظر ردّا أوّلُها، و«تمّ الرد» يُسجَّل بمن ومتى', async () => {
    const second = (await send({ ...valid, name: 'خالد', email: 'khaled@test.local' }).then((r) => r.json())) as { reference: string }
    const first = await prisma.contactMessage.findFirstOrThrow({ where: { name: 'سارة' } })
    const marked = await app.inject({
      method: 'POST', url: `/api/admin/contact-messages/${first.id}/handled`,
      cookies: { wajeez_session: staffToken }, payload: { handled: true },
    })
    expect(marked.statusCode).toBe(200)
    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { id: first.id } })
    expect(row.handledBy).toBe(staffId)
    expect(row.handledAt).not.toBeNull()

    const list = (await app.inject({ method: 'GET', url: '/api/admin/contact-messages', cookies: { wajeez_session: staffToken } })
      .then((r) => r.json())) as { reference: string; handledAt: string | null }[]
    expect(list[0].reference, 'ما ينتظر ردّا ليس أوّلَ القائمة').toBe(second.reference)
    expect(list.at(-1)?.handledAt).not.toBeNull()
  })
})
