/* إثبات حماية نقطة الدخول — والسقوفُ ثلاثةٌ لا واحد (المهمّة ١٧):
   ٥ لـ«بريدٍ + شبكة» · ٤٠ للشبكة وحدَها · ٢٥ للبريد عبر كلّ الشبكات.
   والاختبارُ الأهمُّ هنا ليس أنّ القفلَ يعمل، بل **أنّ البريءَ لا يُقفَل**:
   قاعةٌ على شبكةٍ واحدةٍ أخطأ فيها خمسةٌ، فيدخل السادسُ بكلمته الصحيحة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'

let app: FastifyInstance
let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  await auth.register('throttle@test.local', 'Correct#12345', 'مختبَر')
  /* قاعةٌ من ستّة: خمسةٌ يخطئون وسادسٌ يكتب كلمتَه صحيحةً — كلُّهم على شبكةٍ واحدة */
  for (let i = 1; i <= 6; i++) {
    await auth.register(`classmate${i}@test.local`, 'Correct#12345', `زميل ${i}`)
  }
  await auth.register('spray-target@test.local', 'Correct#12345', 'هدفُ الرشّ')
  app = await buildApp(prisma)
}, 240_000)

/** دخولٌ من شبكةٍ معيّنة — `trustProxy: 1` يجعل هذه الترويسةَ عنوانَ العميل */
async function loginFrom(ip: string, email: string, password: string) {
  return app.inject({
    method: 'POST', url: '/api/auth/login',
    headers: { 'x-forwarded-for': ip },
    payload: { email, password },
  })
}

describe('حماية الدخول من المحاولات المتكررة', () => {
  it('خمس إخفاقات تُقفل السادسة برمز 429 برسالة عربية واضحة', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: 'throttle@test.local', password: 'wrong-password' },
      })
      statuses.push(res.statusCode)
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[5]).toBe(429)
    const seventh = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'throttle@test.local', password: 'wrong-password' },
    })
    const body = JSON.parse(seventh.body) as { error?: { code?: string; message_ar?: string } }
    expect(body?.error?.code).toBe('too_many_attempts')
    expect(body?.error?.message_ar ?? '').toContain('محاولات كثيرة')
  })

  it('حتى كلمة المرور الصحيحة تُرفض أثناء القفل — لا التفاف حوله', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'throttle@test.local', password: 'Correct#12345' },
    })
    expect(res.statusCode).toBe(429)
  })
})

describe('السقوفُ الثلاثة (المهمّة ١٧)', () => {
  /* هذا هو العطبُ الذي أُصلح: كان المفتاحُ «البريدَ **أو** الشبكة»، فخمسةُ
     أخطاءٍ من خمسةِ أشخاصٍ تُقفل الشبكةَ كلَّها — ويُرَدُّ من كتب صحيحا. */
  it('خمسةُ زملاءَ أخطأوا على شبكةٍ واحدة لا يقفلون السادسَ الذي كتب كلمتَه صحيحة', async () => {
    const room = '203.0.113.10'
    for (let i = 1; i <= 5; i++) {
      const res = await loginFrom(room, `classmate${i}@test.local`, 'wrong-password')
      expect(res.statusCode).toBe(401)
    }
    const sixth = await loginFrom(room, 'classmate6@test.local', 'Correct#12345')
    expect(sixth.statusCode).toBe(200)
  })

  it('خمسُ إخفاقاتٍ للشخص نفسِه من الشبكة نفسِها تقفله وحدَه، ولا تقفل جارَه', async () => {
    const room = '203.0.113.11'
    for (let i = 0; i < 5; i++) {
      expect((await loginFrom(room, 'classmate1@test.local', 'wrong-password')).statusCode).toBe(401)
    }
    expect((await loginFrom(room, 'classmate1@test.local', 'wrong-password')).statusCode).toBe(429)
    /* الجارُ على الشبكة نفسِها يدخل — القفلُ على الزوج لا على العنوان */
    expect((await loginFrom(room, 'classmate2@test.local', 'Correct#12345')).statusCode).toBe(200)
  })

  it('أربعون إخفاقا من شبكةٍ واحدة تقفل الشبكةَ برسالةٍ تقول ذلك', async () => {
    const attacker = '203.0.113.12'
    /* رشُّ كلماتِ مرور: بريدٌ مختلفٌ في كلّ محاولةٍ فلا يبلغ سقفُ الشخص الخمسَ */
    for (let i = 0; i < 40; i++) {
      const res = await loginFrom(attacker, `victim${i}@test.local`, 'wrong-password')
      expect(res.statusCode).toBe(401)
    }
    const blocked = await loginFrom(attacker, 'victim99@test.local', 'wrong-password')
    expect(blocked.statusCode).toBe(429)
    const body = JSON.parse(blocked.body) as { error?: { message_ar?: string } }
    expect(body?.error?.message_ar ?? '').toContain('شبكتك')
    /* وحتّى صاحبُ الكلمة الصحيحة من تلك الشبكة يُرَدّ — القفلُ على الشبكة */
    expect((await loginFrom(attacker, 'classmate3@test.local', 'Correct#12345')).statusCode).toBe(429)
  })

  it('خمسٌ وعشرون إخفاقا لبريدٍ واحدٍ من خمسٍ وعشرين شبكةً تقفل البريد', async () => {
    for (let i = 0; i < 25; i++) {
      const res = await loginFrom(`198.51.100.${i + 1}`, 'spray-target@test.local', 'wrong-password')
      /* كلُّ شبكةٍ جديدةٌ فلا سقفَ شبكةٍ يُبلَغ، وكلُّ زوجٍ إخفاقُه الأوّل */
      expect(res.statusCode).toBe(401)
    }
    const blocked = await loginFrom('198.51.100.200', 'spray-target@test.local', 'Correct#12345')
    expect(blocked.statusCode).toBe(429)
  })

  it('عنوانُ العميل يُقرأ من الوسيط لا من المقبس — وإلّا كان السقفُ دلوا واحدا للعالم', async () => {
    await loginFrom('192.0.2.77', 'classmate4@test.local', 'wrong-password')
    const row = await prisma.loginAttempt.findFirst({
      where: { email: 'classmate4@test.local' }, orderBy: { createdAt: 'desc' },
    })
    expect(row?.ip).toBe('192.0.2.77')
  })
})
