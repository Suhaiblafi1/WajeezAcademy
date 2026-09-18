/* بابُ الموسم — إيقافُ التسجيل حتّى يُفتح، وبريدُ من ينتظر.

   ─────────── ما يقيسه هذا الملفّ ───────────

   قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦): يُوقَف كلُّ تسجيلٍ الآن، ومن نقر
   «ادفع» يُقال له «لم يفتح باب التسجيل لموسم الشتاء بعد» ويُطلَب بريدُه.

   والخطرُ هنا **ليس أن يُكتب القفلُ بل أن يُنسى بابٌ**: للشراء في هذه المنصّة
   أربعةُ أبوابٍ في الخادم — `checkout` و`payOrder` و`requestEnrollment`
   و`requestPlanEnrollment`. فبابٌ واحدٌ يُغفَل يعني شاشةً تعرض الرسالةَ
   ومسارا يقبض المال. فيُسأل كلُّ بابٍ على حدة، لا «القفلُ يعمل».

   ويُسأل بعده سؤالٌ مقابل: **أيُفتح حين يُفتح؟** فقفلٌ لا يُرفع أسوأُ من قفلٍ
   لا يُنزل — ولا يُكتشف إلّا يومَ الموسم.

   ─────────── وما لا يُقاس هنا ───────────

   الشاشاتُ. `RegistrationClosedNotice` يعرض ما يقوله الخادم، وحارسُه في
   `src/tests` — وهذا يحرس أنّ الخادمَ **يمنع**، لا أنّ الواجهةَ تُخفي. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { RegistrationInterestService } from '../../services/registration-interest.service'
import {
  OPEN_SEASON, SEASON_GATE_KEY, parseSeasonGate, readSeasonGate, writeSeasonGate,
} from '../../services/registration-window'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let interest: RegistrationInterestService

const DAY = 86_400_000
const WINTER = { open: false, seasonKey: 'nov_jan', seasonAr: 'موسم الشتاء', messageAr: 'لم يفتح باب التسجيل لموسم الشتاء بعد' }

let seq = 0
async function learner() {
  seq += 1
  const email = `season-${seq}@test.local`
  const { userId } = await auth.register(email, 'Learner#12345', `منتظر ${seq}`)
  /* الشراءُ يشترط بريدا موثَّقا — ووثيقتُه هنا صفٌّ لا رحلةُ بريد */
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
  return userId
}

let cohortSeq = 0
async function cohort() {
  cohortSeq += 1
  return prisma.cohort.create({
    data: {
      courseId: 'C-CAR-101', title: `شعبةُ موسمٍ ${cohortSeq}-${Date.now()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 10,
      startsAt: new Date(Date.now() + 40 * DAY),
    },
  })
}

/** يُغلق البابَ كما يُغلقه الترحيلُ في الإنتاج — صفًّا في `SystemSetting` */
const close = () => writeSeasonGate(prisma, WINTER, '00000000-0000-0000-0000-000000000000')
const open = () => writeSeasonGate(prisma, { ...OPEN_SEASON, seasonKey: 'nov_jan', seasonAr: 'موسم الشتاء' }, '00000000-0000-0000-0000-000000000000')

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  interest = new RegistrationInterestService(prisma)
}, 240_000)

/* والصفوفُ تُمحى بين اختبارٍ وآخر: ملفُّ الاختبار يتقاسم قاعدةً واحدة، و
   `notifyWaiting` تأخذ **كلَّ** من ينتظر — فمن تركه اختبارٌ سابقٌ يُحسَب في
   اللاحق، فيقول العدُّ خمسةً حيث تُرك اثنان. */
beforeEach(async () => {
  await prisma.systemSetting.deleteMany({ where: { key: SEASON_GATE_KEY } })
  await prisma.registrationInterest.deleteMany()
  await prisma.outboxMail.deleteMany({ where: { purpose: 'registration.season.open' } })
})

describe('قراءةُ الصفّ — قبل أن يُوصَل ببابٍ واحد', () => {
  it('لا صفَّ يعني «مفتوح»: بابُ منصّةٍ لا يُغلَق بصمتِ قاعدة', async () => {
    expect((await readSeasonGate(prisma)).open).toBe(true)
  })

  it('والمشوَّهُ لا يُغلق بابا — ما لا يقول false صراحةً يُقرأ مفتوحا', () => {
    expect(parseSeasonGate(null).open).toBe(true)
    expect(parseSeasonGate('closed').open).toBe(true)
    expect(parseSeasonGate([]).open).toBe(true)
    expect(parseSeasonGate({ open: 'false' }).open).toBe(true)
    expect(parseSeasonGate({ closed: true }).open).toBe(true)
    expect(parseSeasonGate({ open: false }).open).toBe(false)
  })

  it('وبلا جملةٍ مكتوبةٍ يُقال سببٌ لا فراغ', () => {
    expect(parseSeasonGate({ open: false }).messageAr).not.toBe('')
    expect(parseSeasonGate({ open: false, seasonAr: 'موسم الربيع' }).messageAr).toContain('موسم الربيع')
  })

  it('والموسمُ يبقى مكتوبا بعد الفتح — وإلّا ضاع لمن نُبلِّغ في اللحظة التي نُبلغ فيها', async () => {
    await close()
    await open()
    const gate = await readSeasonGate(prisma)
    expect(gate.open).toBe(true)
    expect(gate.seasonKey).toBe('nov_jan')
  })
})

describe('الأبوابُ الأربعة — كلٌّ يُسأل وحدَه', () => {
  it('١· الشراءُ المباشر يُردّ برسالة صاحب المنصّة لا برسالةِ نظام', async () => {
    const u = await learner()
    const c = await cohort()
    await close()
    await expect(commerce.checkout(u, [c.id])).rejects.toMatchObject({
      code: 'season_closed',
      status: 409,
      messageAr: WINTER.messageAr,
    })
    /* ولا يُكتب شيء: طلبٌ ولا فاتورةٌ ولا مقعدٌ محجوز */
    expect(await prisma.order.count({ where: { userId: u } })).toBe(0)
    expect(await prisma.enrollmentRequest.count({ where: { userId: u } })).toBe(0)
  })

  it('٢· الدفعُ يُردّ ولو أُنشئ الطلبُ والبابُ مفتوح — والإغلاقُ يُدرك من في الطريق', async () => {
    const u = await learner()
    const c = await cohort()
    const order = await commerce.checkout(u, [c.id])
    await close()
    await expect(commerce.payOrder(order.orderId, u, `k-${order.orderId}`)).rejects.toMatchObject({
      code: 'season_closed', status: 409,
    })
    expect(await prisma.payment.count({ where: { invoice: { order: { userId: u } } } })).toBe(0)
  })

  it('٣· طلبُ التسجيل في شعبة يُردّ', async () => {
    const u = await learner()
    const c = await cohort()
    await close()
    await expect(commerce.requestEnrollment(u, c.id)).rejects.toMatchObject({ code: 'season_closed' })
  })

  it('٤· وطلبُ الخطّة كاملةً يُردّ — وهو بابٌ آخرُ لا صورةٌ من الأوّل', async () => {
    const u = await learner()
    await close()
    await expect(commerce.requestPlanEnrollment(u)).rejects.toMatchObject({ code: 'season_closed' })
  })

  it('ولا يُنكَر ما وقع: دفعةٌ سُجّلت بمفتاحها تُعاد بعد الإغلاق لا تُردّ', async () => {
    const u = await learner()
    const c = await cohort()
    const order = await commerce.checkout(u, [c.id])
    const key = `paid-${order.orderId}`
    const first = await commerce.payOrder(order.orderId, u, key)
    await close()
    /* من دفع أمس وحدّث صفحتَه اليوم يجب أن يرى إيصالَه لا جملةَ الإغلاق */
    const again = await commerce.payOrder(order.orderId, u, key)
    expect(again.id).toBe(first.id)
  })
})

describe('ويُفتح حين يُفتح — فالقفلُ الذي لا يُرفع أسوأُ ممّا لا يُنزل', () => {
  it('الشراءُ يمضي بعد الفتح — وبالشعبة نفسِها التي رُدَّت قبله', async () => {
    const u = await learner()
    const c = await cohort()
    await close()
    await expect(commerce.checkout(u, [c.id])).rejects.toMatchObject({ code: 'season_closed' })
    await open()
    const order = await commerce.checkout(u, [c.id])
    expect(order.orderId).toBeTruthy()
    expect(await prisma.enrollmentRequest.count({ where: { userId: u, cohortId: c.id, status: 'seat_held' } })).toBe(1)
  })
})

describe('بريدُ من ينتظر', () => {
  it('يُحفظ مع نصِّ ما وُعد به — فما قيل له يبقى مكتوبا لا يُستذكَر', async () => {
    await close()
    const res = await interest.record('Waiting@Example.COM', 'pathway')
    expect(res.alreadyWaiting).toBe(false)
    const row = await prisma.registrationInterest.findFirst({ where: { email: 'waiting@example.com' } })
    expect(row?.seasonKey).toBe('nov_jan')
    expect(row?.consentAr).toContain('رسالةٌ واحدة')
    expect(row?.notifiedAt).toBeNull()
  })

  it('والعائدُ لا يُضاعَف ويُقال له إنّه مسجَّل — فلا يتركه ثالثةً ورابعة', async () => {
    await close()
    await interest.record('twice@example.com', 'course')
    const second = await interest.record('twice@example.com', 'course')
    expect(second.alreadyWaiting).toBe(true)
    expect(await prisma.registrationInterest.count({ where: { email: 'twice@example.com' } })).toBe(1)
  })

  it('ولا يُقبل والبابُ مفتوح — قائمةُ انتظارٍ تُبنى بعد الفتح تُبلَّغ بخبرٍ وقع أمس', async () => {
    await open()
    await expect(interest.record('late@example.com', 'buy')).rejects.toMatchObject({ code: 'season_open' })
  })

  it('يُبلَّغون مرّةً واحدةً — والثانيةُ لا تكتب رسالةً ثانية', async () => {
    await close()
    await interest.record('one@example.com', 'buy')
    await interest.record('two@example.com', 'buy')
    await open()

    const gate = await readSeasonGate(prisma)
    const first = await interest.notifyWaiting('00000000-0000-0000-0000-000000000000', gate, 'nov_jan', 'موسم الشتاء')
    expect(first.queued).toBe(2)
    expect(await prisma.outboxMail.count({ where: { purpose: 'registration.season.open' } })).toBe(2)

    const again = await interest.notifyWaiting('00000000-0000-0000-0000-000000000000', gate, 'nov_jan', 'موسم الشتاء')
    expect(again.queued).toBe(0)
    expect(await prisma.outboxMail.count({ where: { purpose: 'registration.season.open' } })).toBe(2)
  })

  it('والرسالةُ تصل عنوانا بلا حساب — فهي في `OutboxMail` لا في جرسِ مستخدِم', async () => {
    await close()
    await interest.record('noaccount@example.com', 'cohort')
    await open()
    const gate = await readSeasonGate(prisma)
    await interest.notifyWaiting('00000000-0000-0000-0000-000000000000', gate, 'nov_jan', 'موسم الشتاء')
    const mail = await prisma.outboxMail.findFirst({ where: { to: 'noaccount@example.com' } })
    expect(mail?.status).toBe('queued')
    expect(mail?.subject).toContain('موسم الشتاء')
  })
})
