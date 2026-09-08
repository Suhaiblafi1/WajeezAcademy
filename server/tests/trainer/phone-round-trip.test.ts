/* حلقةُ «لم تذكر رقمك» — رقمٌ يراه المتقدّمُ ولا يراه الخادم.

   ═══ ما كان يقع ═══

   نموذجُ الانضمام ثلاثةُ أقسامٍ في شاشةٍ واحدة، لكنّ القسمَ الأوّل **يُرسَل
   إلى الخادم عند المضيّ منه** — كي يوجد مرجعٌ تُرفع عليه الملفّات. وكان
   الرقمُ اختياريّا فيه، والقسمُ الثالثُ وحدَه يطلبه إن اختار المتقدّمُ
   الهاتفَ أو واتساب.

   فمن مضى بلا رقمٍ أُنشئ طلبُه بلا رقم. ثمّ يبلغ القسمَ الثالث فيختار
   واتساب، فتقول له الشاشةُ «عد إلى القسم الأول وأضفه» — فيعود ويكتبه. وهنا
   ينفصل ما يراه عمّا يعلمه الخادم: الحالةُ في المتصفّح صارت تحمل الرقم،
   فالشاشةُ تعرض «سنتواصل على +962…» ويمرّ الفحصُ الأماميّ. **ولا نداءَ بعد
   القسم الأوّل كان يحمل الرقمَ إلى الخادم** — لا `phase-2` ولا غيرُه.

   فيُردّ الإرسالُ بـ`phone_required`، ويعود المتقدّمُ فيجد الرقمَ مكتوبا
   أمامه، فيرسل فيُردّ. حلقةٌ لا مخرجَ منها إلّا اختيارُ البريد — وقد وقعت
   على متقدّمٍ حقيقيّ (WJ-TR-2026-00001).

   ═══ وأُغلقت من طرفَيها ═══

   ١) الرقمُ شرطٌ في القسم الأوّل، فلا يُنشأ طلبٌ بلا رقمٍ أصلا (وذاك في
      الواجهة، ويحرسه `src/tests/trainer-application-form.test.ts`).
   ٢) و`phase-2` يقبل الرقمَ ويكتبه — فتصحيحُ الرقم بعد إنشاء الطلب يصل.

   وهذا الملفّ يحرس الطرفَ الثاني: هو الذي يُخرج من الحلقة من كان فيها فعلا،
   ولا يكفي الطرفُ الأوّل وحدَه — فالطلباتُ المنشأةُ قبل اليوم بلا رقمٍ ما
   زالت مفتوحة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'

let prisma: PrismaClient
let apps: TrainerApplicationService

/* متقدّمٌ بلا رقم — وهي الحالُ التي كانت الواجهةُ تسمح بها */
const phase1NoPhone = {
  fullName: 'مدرب بلا رقم',
  email: 'trainer-phone-loop@test.local',
  country: 'الأردن',
  timezone: 'Asia/Amman',
  specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const,
  trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'],
  deliveryMode: 'both' as const,
  motivation:
    'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

const p2 = {
  previousCourses: [],
  teachableCourseIds: [],
  availability: { seasons: ['nov_jan'] } as AvailabilityInput,
  demoConsent: true as const,
}

let reference = ''
let candidateToken = ''

describe('رقمُ الجوال يعبر إلى الخادم مع القسم الأخير', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    apps = new TrainerApplicationService(prisma)
    const res = await apps.submitPhase1(phase1NoPhone)
    reference = res.reference
    candidateToken = res.candidateToken
  })

  it('الطلبُ يُنشأ بلا رقمٍ فعلا — وإلّا فما بعده لا يقيس شيئا', async () => {
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference } })
    expect(row.phone).toBeNull()
  })

  it('واتساب بلا رقمٍ في النداء ولا في القاعدة — يُردّ، وهذا هو الصواب', async () => {
    await expect(
      apps.completePhase2(reference, candidateToken, { ...p2, contact: { channel: 'whatsapp' } }),
    ).rejects.toMatchObject({ code: 'phone_required' })
  })

  /* الحارسُ نفسُه: قبل الإصلاح كان هذا يسقط بـ`phone_required` — الرقمُ يصل
     في النداء والخدمةُ لا تنظر إلّا إلى `app.phone` المحفوظ. */
  it('واتساب ومعه الرقمُ في النداء — يمرّ، ويُكتب الرقمُ ورمزُ دولته', async () => {
    const done = await apps.completePhase2(reference, candidateToken, {
      ...p2,
      phoneCountryCode: '+962',
      phone: '798009509',
      contact: { channel: 'whatsapp' },
    })
    expect(done.status).toBe('submitted')

    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference } })
    expect(row.phone).toBe('798009509')
    expect(row.phoneCountryCode).toBe('+962')
    expect(row.contactChannel).toBe('whatsapp')
  })

  it('وتصحيحُ الرقم بعد ذلك يصل كذلك — لا يُكتب مرّةً ثمّ يُتجاهل', async () => {
    await apps.completePhase2(reference, candidateToken, {
      ...p2,
      phoneCountryCode: '+966',
      phone: '551234567',
      contact: { channel: 'whatsapp' },
    })
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference } })
    expect(row.phone).toBe('551234567')
    expect(row.phoneCountryCode).toBe('+966')
  })

  /* ونداءٌ بلا رقمٍ لا يمحو المحفوظ: شاشةُ الحالة تُرسل `phase-2` لتحديث
     الإتاحة وحدَها، فلو كان الغيابُ محوا لفقد الطلبُ رقمَه بلا أن يمسّه أحد. */
  it('نداءٌ لاحقٌ بلا رقمٍ يُبقي المحفوظ ولا يمحوه', async () => {
    await apps.completePhase2(reference, candidateToken, { ...p2, contact: { channel: 'whatsapp' } })
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference } })
    expect(row.phone).toBe('551234567')
    expect(row.phoneCountryCode).toBe('+966')
  })
})
