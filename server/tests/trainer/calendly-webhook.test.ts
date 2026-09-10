/* مزامنةُ Calendly من طرفها إلى طرفها.

   الحارسُ هنا عبر المسار لا الخدمة وحدَها: التوقيعُ على الجسم الخام، ثمّ
   مطابقةُ رقم الطلب بالبريد، ثمّ وقتُ الموعد الحقيقيّ، وعدمُ تكرار التسليم،
   ثمّ الإلغاء وعودةُ الطلب إلى حالته السابقة. */

import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { buildApp } from '../../http/app'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { setupTestDb, testPrisma } from '../helpers/db'

const SECRET = 'calendly-hook-secret-for-tests'
const REFERENCE = 'WJ-TR-2026-00001'
const EMAIL = 'calendly-trainer@test.local'
const INVITEE_URI = 'https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1'
const START = '2026-09-20T09:30:00.000Z'

let prisma: PrismaClient
let app: FastifyInstance
let applicationId = ''
let userId = ''

const post = (event: string, payload: Record<string, unknown>, secret = SECRET) => {
  const raw = JSON.stringify({ event, payload })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/calendly',
    headers: {
      'content-type': 'application/json',
      'calendly-webhook-signature': `t=${timestamp},v1=${signature}`,
    },
    payload: raw,
  })
}

const payload = () => ({
  uri: INVITEE_URI,
  email: EMAIL,
  tracking: {
    utm_source: 'wajeezacademy',
    utm_medium: 'trainer_application',
    utm_content: REFERENCE,
  },
  scheduled_event: {
    uri: 'https://api.calendly.com/scheduled_events/event-1',
    start_time: START,
  },
})

beforeAll(async () => {
  process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SECRET
  await setupTestDb()
  prisma = await testPrisma()
  const user = await prisma.user.create({
    data: { email: EMAIL, displayName: 'مدرّب Calendly', passwordHash: 'test-only' },
  })
  userId = user.id
  const application = await prisma.trainerApplication.create({
    data: {
      reference: REFERENCE,
      userId,
      email: EMAIL,
      fullName: 'مدرّب Calendly',
      status: 'shortlisted',
      emailVerifiedAt: new Date(),
    },
  })
  applicationId = application.id
  app = await buildApp(prisma)
}, 240_000)

describe('حدثُ الحجز الموقّع', () => {
  it('يكتب الوقتَ الحقيقيَّ ويغيّر الحالةَ ويظهر لصاحب الطلب', async () => {
    const response = await post('invitee.created', payload())
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ recorded: true })

    const interview = await prisma.trainerInterview.findUnique({ where: { externalId: INVITEE_URI } })
    expect(interview?.scheduledAt.toISOString()).toBe(START)
    expect(interview?.provider).toBe('calendly')
    expect(interview?.canceledAt).toBeNull()
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('interview_scheduled')

    const mine = await new TrainerApplicationService(prisma).myApplication(userId)
    expect(mine.interviews).toHaveLength(1)
    expect(mine.interviews[0].scheduledAt.toISOString()).toBe(START)
  })

  it('وإعادةُ الحدث لا تنشئ مقابلةً ثانية', async () => {
    const response = await post('invitee.created', payload())
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ duplicate: true })
    expect(await prisma.trainerInterview.count({ where: { externalId: INVITEE_URI } })).toBe(1)
  })

  it('والتوقيعُ الخاطئ مرفوضٌ بلا كتابة', async () => {
    const response = await post('invitee.created', { ...payload(), uri: `${INVITEE_URI}-forged` }, 'wrong-secret')
    expect(response.statusCode).toBe(401)
    expect(await prisma.trainerInterview.count()).toBe(1)
  })
})

describe('حدثُ الإلغاء الموقّع', () => {
  it('يلغي الموعدَ ويعيد الطلبَ إلى حالته السابقة ويعيد بابَ الحجز', async () => {
    const response = await post('invitee.canceled', payload())
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ canceled: true })

    const interview = await prisma.trainerInterview.findUniqueOrThrow({ where: { externalId: INVITEE_URI } })
    expect(interview.canceledAt).not.toBeNull()
    const application = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })
    expect(application.status).toBe('shortlisted')
    const mine = await new TrainerApplicationService(prisma).myApplication(userId)
    expect(mine.interviews).toEqual([])
  })
})
