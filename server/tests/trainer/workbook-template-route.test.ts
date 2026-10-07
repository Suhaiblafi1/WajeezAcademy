/* ═══ قالبُ الكرّاسة مملوءا — المسلكُ على قاعدةٍ حقيقيّة (٧ أكتوبر ٢٠٢٦) ═══

   القاعدةُ والملفُّ في `src/tests/trainer/workbook-docx.test.ts`؛ وهنا ما يقع عبر
   المسلك نفسِه:

   ① المدرّبُ ينزّل كرّاسةَ دورته ملفَّ Word باسمٍ عربيّ، وفيه خطّتُه المحفوظة.
   ② ولمحورٍ بعينه كرّاستُه — والمحورُ المجهولُ يُردّ بلغة من يصحّحه.
   ③ ومدرّبٌ آخرُ لا ينزّل كرّاسةَ شعبةٍ ليست له. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let cookie = ''
let otherCookie = ''
let cohortId = ''
const STAMP = Date.now()

async function trainer(tag: string) {
  const auth = new AuthService(prisma)
  const email = `wbt-route-${tag}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Trainer#12345', `مدرّبُ ${tag}`)
  await auth.setRoles(userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-WBR-${tag}-${STAMP}`, fullName: `مدرّبُ ${tag}`, email, status: 'active', userId },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId, applicationId: application.id } })
  return { cookie: `${SESSION_COOKIE}=${(await auth.login(email, 'Trainer#12345')).token}`, profileId: profile.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const mine = await trainer('one')
  cookie = mine.cookie
  otherCookie = (await trainer('two')).cookie
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: { courseId: course!.id, title: 'شعبةُ القالب المملوء', status: 'draft', price: 100, currency: 'USD', deliveryMode: 'in_person', timezone: 'Asia/Amman' },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: mine.profileId, role: 'lead' } })
  await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId, trainerId: mine.profileId, status: 'draft',
      content: {
        kind: 'trainer', summaryAr: 'نبذةُ الشعبة', resources: [],
        modules: [
          { moduleId: 'WBR-M1', titleAr: 'محورُ الافتتاح', outcomeAr: 'يكتب خطّتَه الأولى.' },
          { moduleId: 'WBR-M2', titleAr: 'محورُ التطبيق', outcomeAr: 'يطبّقها على موقفٍ من عمله.' },
        ],
      } as never,
    },
  })
}, 240_000)

afterAll(async () => { await app.close() })

const get = (url: string, c = cookie) => app.inject({ method: 'GET', url, headers: { cookie: c } })
const textOf = async (body: Buffer) => {
  const xml = await (await JSZip.loadAsync(body)).file('word/document.xml')!.async('string')
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
}

describe('قالبُ الكرّاسة مملوءا — عبر المسلك', () => {
  it('⚠️ ① كرّاسةُ الدورة ملفُّ Word باسمٍ عربيّ، وفيه خطّتُه المحفوظة', async () => {
    const res = await get(`/api/trainer/cohorts/${cohortId}/workbook-template`)
    expect(res.statusCode, res.body.slice(0, 200)).toBe(200)
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(String(res.headers['content-disposition'])).toMatch(/^attachment; filename="wajeez-workbook\.docx"; filename\*=UTF-8''/)
    expect(decodeURIComponent(String(res.headers['content-disposition']).split("UTF-8''")[1])).toMatch(/^كرّاسة .+\.docx$/)
    const t = await textOf(res.rawPayload)
    for (const s of ['شعبةُ القالب المملوء', 'محورُ الافتتاح', 'محورُ التطبيق', 'يكتب خطّتَه الأولى.', 'مدرّبُ one']) expect(t, s).toContain(s)
  })

  it('⚠️ ② ولمحورٍ بعينه كرّاستُه — والمحورُ المجهولُ يُردّ', async () => {
    const one = await get(`/api/trainer/cohorts/${cohortId}/workbook-template?modules=WBR-M2`)
    expect(one.statusCode).toBe(200)
    const t = await textOf(one.rawPayload)
    expect(t).toContain('المحور ٢ من دورة')
    expect(t, 'وصلت كرّاسةُ المحور بمحورٍ ليس فيها').not.toContain('محورُ الافتتاح')
    const bad = await get(`/api/trainer/cohorts/${cohortId}/workbook-template?modules=NOPE`)
    expect(bad.statusCode).toBe(400)
    expect((bad.json() as { error?: string; code?: string }).code ?? bad.body).toContain('unknown_modules')
  })

  it('⚠️ ③ ومدرّبٌ آخرُ لا ينزّل كرّاسةَ شعبةٍ ليست له', async () => {
    expect((await get(`/api/trainer/cohorts/${cohortId}/workbook-template`, otherCookie)).statusCode).toBe(403)
  })
})
