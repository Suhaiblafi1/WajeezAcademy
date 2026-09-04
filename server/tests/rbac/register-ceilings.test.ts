/* سقفُ التسجيل الذاتيّ — ولمَ لم يُنسَخ شكلُ سقوف الدخول (قرارُ المالك ٤ سبتمبر).

   في الدخول كان المفتاحُ المفيدُ «بريدٌ + شبكة»، لأنّ البريدَ قائمٌ لشخصٍ
   حقيقيّ. وفي التسجيل **المتقدّمُ يختار بريدَه**، فذلك الزوجُ جديدٌ في كلّ
   محاولةٍ ولا يبلغ سقفَه أبدا. فالمفتاحُ الشبكةُ، والمقياسُ يتغيّر:

   ٤٠ في الساعة و١٠٠ في اليوم لِما أُنشئ **فعلا** — ضررُ هذا الباب حجمٌ لا
   سرعة · و١٠ في ربع ساعة لِما ارتدّ بـ«البريد مسجَّل» — وهو إحصاءُ البريد،
   لأنّ المسارَ يقول صراحةً إن كان البريدُ عندنا.

   وما تُنشئه الإدارةُ بصلاحيّةٍ خارجُ هذا كلِّه: فعلٌ مأذونٌ له سجلُّ أثر،
   ولو خضع لسقفِ شبكةٍ لانقفلت دفعةُ مئةِ حسابٍ من مكتبٍ واحد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import {
  AuthService, SIGNUP_MAX_PER_DAY, SIGNUP_MAX_PER_HOUR, SIGNUP_MAX_TAKEN,
} from '../../services/auth.service'
import { buildApp } from '../../http/app'

let app: FastifyInstance
let prisma: PrismaClient
let auth: AuthService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

let seq = 0
const fresh = () => `signup-${Date.now()}-${seq++}@test.local`

async function signUpFrom(ip: string, email: string) {
  return app.inject({
    method: 'POST', url: '/api/auth/register',
    headers: { 'x-forwarded-for': ip },
    payload: { email, password: 'Correct#12345', displayName: 'متقدّم' },
  })
}

/** يُملأ السجلُّ مباشرةً بدل إنشاءِ أربعين حسابا — السقفُ يُقاس على السجلّ */
async function seedAttempts(ip: string, outcome: 'created' | 'taken', n: number, agoMs = 60_000) {
  await prisma.registrationAttempt.createMany({
    data: Array.from({ length: n }, () => ({ ip, outcome, createdAt: new Date(Date.now() - agoMs) })),
  })
}

describe('سقفُ التسجيل الذاتيّ', () => {
  it('التسجيلُ الناجحُ يُسجَّل في السجلّ بعنوان الزائر لا بعنوان الوسيط', async () => {
    const ip = '203.0.114.1'
    const res = await signUpFrom(ip, fresh())
    expect(res.statusCode).toBe(201)
    expect(await prisma.registrationAttempt.count({ where: { ip, outcome: 'created' } })).toBe(1)
  })

  it('قاعةٌ من ثلاثين على شبكةٍ واحدة تُسجّل بلا قفل — وهو العطبُ المُصلَح', async () => {
    const room = '203.0.114.2'
    await seedAttempts(room, 'created', 29)
    const res = await signUpFrom(room, fresh())
    expect(res.statusCode).toBe(201)
  })

  it(`أربعون حسابا في الساعة من شبكةٍ واحدة تقفل الحادي والأربعين`, async () => {
    const factory = '203.0.114.3'
    await seedAttempts(factory, 'created', SIGNUP_MAX_PER_HOUR)
    const res = await signUpFrom(factory, fresh())
    expect(res.statusCode).toBe(429)
    const body = JSON.parse(res.body) as { error?: { code?: string; message_ar?: string } }
    expect(body?.error?.code).toBe('too_many_registrations')
    expect(body?.error?.message_ar ?? '').toContain('شبكتك')
  })

  it('ومئةٌ في اليوم تقفل وإن تفرّقت على ساعاتٍ فلم تبلغ سقفَ الساعة', async () => {
    const slow = '203.0.114.4'
    /* عمرُها ثلاثُ ساعاتٍ: خارجَ نافذةِ الساعة وداخلَ نافذةِ اليوم */
    await seedAttempts(slow, 'created', SIGNUP_MAX_PER_DAY, 3 * 3600_000)
    expect((await signUpFrom(slow, fresh())).statusCode).toBe(429)
  })

  it('وما مضى عليه أكثرُ من يومٍ لا يُحسب — النافذةُ تتحرّك', async () => {
    const old = '203.0.114.5'
    await seedAttempts(old, 'created', SIGNUP_MAX_PER_DAY + 20, 25 * 3600_000)
    expect((await signUpFrom(old, fresh())).statusCode).toBe(201)
  })

  it('عشرُ محاولاتٍ ترتدّ بـ«البريد مسجَّل» تقفل الحادية عشرة — وهو إحصاءُ البريد', async () => {
    const prober = '203.0.114.6'
    const taken = fresh()
    expect((await signUpFrom(prober, taken)).statusCode).toBe(201)
    for (let i = 0; i < SIGNUP_MAX_TAKEN - 1; i++) {
      const res = await signUpFrom(prober, taken)
      expect(res.statusCode).toBe(409)
    }
    /* العاشرةُ ارتدادا أيضا، وبها يبلغ العددُ عشرا */
    expect((await signUpFrom(prober, taken)).statusCode).toBe(409)
    /* والحادية عشرة تُقفَل — ولا تكشف الرسالةُ أنّ الارتدادَ هو ما يُعَدّ */
    const blocked = await signUpFrom(prober, taken)
    expect(blocked.statusCode).toBe(429)
    /* وحتّى ببريدٍ جديدٍ من تلك الشبكة: القفلُ على الشبكة لا على البريد */
    expect((await signUpFrom(prober, fresh())).statusCode).toBe(429)
  })

  it('والصيغةُ الخاطئةُ لا تُعَدُّ إحصاءً — خطأُ مستعملٍ لا محاولةُ استكشاف', async () => {
    const clumsy = '203.0.114.7'
    for (let i = 0; i < 12; i++) {
      const res = await signUpFrom(clumsy, 'not-an-email')
      expect(res.statusCode).toBe(400)
    }
    expect(await prisma.registrationAttempt.count({ where: { ip: clumsy } })).toBe(0)
    expect((await signUpFrom(clumsy, fresh())).statusCode).toBe(201)
  })

  it('وما تُنشئه الإدارةُ بصلاحيّة لا يخضع للسقف — دفعةُ مئةٍ من مكتبٍ واحد تمرّ', async () => {
    const office = '203.0.114.8'
    await seedAttempts(office, 'created', SIGNUP_MAX_PER_DAY)
    /* التسجيلُ الذاتيُّ من ذلك المكتب مقفول… */
    expect((await signUpFrom(office, fresh())).statusCode).toBe(429)
    /* …وإنشاءُ الإدارةِ لا يمرُّ بالسقف أصلا (لا شبكةَ في مساره) */
    const made = await auth.register(fresh(), 'Correct#12345', 'حسابٌ أنشأته الإدارة')
    expect(made.userId).toBeTruthy()
  })

  it('والشبكةُ المجهولةُ لا سقفَ لها — لا يُنسب إليها إخفاقُ غيرها', async () => {
    await seedAttempts('203.0.114.9', 'created', SIGNUP_MAX_PER_DAY)
    const made = await auth.registerSelf(fresh(), 'Correct#12345', 'بلا عنوان', undefined)
    expect(made.userId).toBeTruthy()
  })

  it('والأرقامُ الثلاثةُ في مكانٍ واحدٍ ومرتّبةٌ منطقيّا', () => {
    expect(SIGNUP_MAX_PER_DAY).toBeGreaterThan(SIGNUP_MAX_PER_HOUR)
    /* سقفُ الإحصاء أضيقُ من سقف الحجم: ارتدادٌ واحدٌ يدلُّ أكثرَ من إنشاءٍ واحد */
    expect(SIGNUP_MAX_TAKEN).toBeLessThan(SIGNUP_MAX_PER_HOUR)
  })
})
