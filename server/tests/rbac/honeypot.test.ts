/* حقلُ الفخّ في المسارات العامّة الثلاثة — وحدُّه الصريح.

   الفخُّ يُمسك آليّا يقود متصفّحا فيملأ كلَّ حقلٍ وجده. **ولا يُمسك من يُرسل
   JSON إلى المسار مباشرةً** — ولذلك آخرُ اختبارٍ هنا يُثبّت أنّ سقوفَ
   المسارات هي الحارسُ الحقيقيّ، فلا يُقرأ وجودُ الفخّ اطمئنانا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { HONEYPOT_FIELD } from '../../http/honeypot'

let app: FastifyInstance
let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
}, 240_000)

let seq = 0
const fresh = () => `trap-${Date.now()}-${seq++}@test.local`

const application = (email: string) => ({
  fullName: 'مدرّبٌ مختبَر', email, password: 'Correct#12345',
  specialties: ['القيادة'], domainYears: '4-7', trainingYears: '5',
  trainingLanguages: ['ar'], deliveryMode: 'remote',
  /* الحدُّ الأدنى ٧٥ حرفا في المسار — والاختبارُ يحترمه لا يتحايل عليه */
  motivation:
    'أدرّب القيادةَ منذ ست سنوات لفرقٍ في القطاع الخاصّ، وأبحث عن منصّةٍ تُقيس الأثرَ لا الحضورَ وحدَه، ومنهجُ وجيز أقربُ ما رأيتُه إلى طريقتي في العمل.',
  privacyConsent: true,
})

describe('حقلُ الفخّ', () => {
  it('التسجيلُ يُردُّ إن جاء الحقلُ مملوءا، برسالةٍ تقول للإنسان ما يفعل', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: fresh(), password: 'Correct#12345', displayName: 'آليّ', [HONEYPOT_FIELD]: 'http://spam.example' },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error?: { code?: string; message_ar?: string } }
    expect(body?.error?.code).toBe('form_rejected')
    expect(body?.error?.message_ar ?? '').toContain('الموقع الإلكتروني')
  })

  it('ولا يُنشَأ الحسابُ في تلك الحالة — الردُّ ليس تجميلا', async () => {
    const email = fresh()
    await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email, password: 'Correct#12345', displayName: 'آليّ', [HONEYPOT_FIELD]: 'x' },
    })
    expect(await prisma.user.count({ where: { email } })).toBe(0)
  })

  it('والحقلُ الفارغُ أو الغائبُ يمرّ — الإنسانُ لا يراه فلا يعبّئه', async () => {
    expect((await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: fresh(), password: 'Correct#12345', displayName: 'إنسان', [HONEYPOT_FIELD]: '   ' },
    })).statusCode).toBe(201)
    expect((await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: fresh(), password: 'Correct#12345', displayName: 'إنسان' },
    })).statusCode).toBe(201)
  })

  it('واستعادةُ كلمة المرور محميّةٌ به — ولا تُرسَل رسالةٌ لبريدٍ لم يطلبها', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/password/forgot',
      payload: { email: 'someone@test.local', [HONEYPOT_FIELD]: 'x' },
    })
    expect(res.statusCode).toBe(400)
    expect(await prisma.passwordResetToken.count()).toBe(0)
  })

  it('وطلبُ الانضمام محميٌّ به — ولا يُنشَأ طلبٌ ولا حسابُ متقدّم', async () => {
    const email = fresh()
    const res = await app.inject({
      method: 'POST', url: '/api/v1/trainer-applications',
      payload: { ...application(email), [HONEYPOT_FIELD]: 'http://spam.example' },
    })
    expect(res.statusCode).toBe(400)
    expect(await prisma.trainerApplication.count({ where: { email } })).toBe(0)
    expect(await prisma.user.count({ where: { email } })).toBe(0)
  })

  it('وطلبُ الانضمام يُقبل بلا الحقل — الفخُّ لا يعطّل الباب', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/trainer-applications',
      payload: application(fresh()),
    })
    expect(res.statusCode).toBe(201)
  })

  it('ومن يُرسل JSON مباشرةً لا يقع في الفخّ — فالحارسُ سقفُ المسار', async () => {
    /* هذا هو حدُّ الفخّ مكتوبا اختبارا: جسمٌ بلا الحقل يمضي، ثمّ يوقفه السقف.
       سقفُ مسودّات المسار ٣٠ لكلّ ربع ساعة، وكان بلا سقفٍ خاصٍّ قبل هذا العمل. */
    const statuses: number[] = []
    for (let i = 0; i < 32; i++) {
      const res = await app.inject({
        method: 'POST', url: '/api/path-drafts',
        headers: { 'x-forwarded-for': '198.51.101.7' },
        payload: { name: `مسارٌ آليٌّ ${i}`, courseIds: ['C-AUT-101'] },
      })
      statuses.push(res.statusCode)
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0)
  })
})
