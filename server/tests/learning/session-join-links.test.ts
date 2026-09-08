/* روابطُ الدخول تُكتب للمسجَّلين — والتعذُّرُ يُكتب هو الآخر.

   `linkRegistrants` تُستدعى بعد إنشاء الاجتماع، وعملُها أن يصير لكلّ
   متعلّمٍ رابطُه. وثلاثةُ أعطابٍ تسقط صامتةً لو لم تُحرَس:

   ١) **قائمةُ الانتظار تُسجَّل.** من في `waitlisted` لم يلتحق بعد، فتسجيلُه
      يعطيه رابطا يدخل به لقاءً لا يستحقّه — ويظهر في تقرير الحضور فيُحتسب.

   ٢) **الفشلُ يُبتلع.** لو مضت الدالّةُ بلا كتابةِ سببٍ لَظنّ المدرّبُ أنّ
      العدَّ الآليَّ يجري، فلا يسجّل بيده، فتضيع الجلسةُ بلا حضور. والصمتُ
      هنا أسوأُ من الخطأ.

   ٣) **الإعادةُ تُكرّر.** تُستدعى عند الإنشاء وعند كلّ التحاقٍ جديد، فبلا
      فحصِ الموجود يُسجَّل القديمُ مرّتَين — و`@@unique` يرمي، فيسقط التحاقُ
      متعلّمٍ جديدٍ بسبب متعلّمٍ قديمٍ لا شأنَ له. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { forgetZoomToken } from '../../services/zoom.service'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let cohortId = ''
let sessionId = ''
let enrolledId = ''
let waitlistedId = ''

/** ما يردّه Zoom على نداء التسجيل — يُبدَّل في كلّ حالة */
let registrantOk = true

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  const auth = new AuthService(prisma)

  const a = await auth.register('links-admin@test.local', 'Admin#12345', 'مديرُ الروابط')
  adminId = a.userId
  await auth.setRoles(adminId, ['academic_manager'])

  const cohort = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ الروابط', status: 'active', capacity: 10 },
  })
  cohortId = cohort.id
  const s = await prisma.cohortSession.create({
    data: { cohortId, title: 'لقاءُ الروابط', startsAt: new Date('2026-11-02T09:00:00Z'), status: 'scheduled' },
  })
  sessionId = s.id

  const l1 = await auth.register('links-in@test.local', 'Learner#12345', 'متعلّمٌ ملتحق')
  enrolledId = (await prisma.enrollment.create({ data: { userId: l1.userId, cohortId, status: 'enrolled' } })).id
  const l2 = await auth.register('links-wait@test.local', 'Learner#12345', 'متعلّمٌ منتظر')
  waitlistedId = (await prisma.enrollment.create({ data: { userId: l2.userId, cohortId, status: 'waitlisted' } })).id

  /* اعتمادُ Zoom في القاعدة كي يُقرأ `zoomReady` صحيحا بلا بيئة */
  await prisma.integrationSetting.upsert({
    where: { provider: 'zoom' },
    update: { enabled: true, config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test' } },
    create: { provider: 'zoom', enabled: true, config: { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test' } },
  })
}, 240_000)

beforeEach(() => {
  forgetZoomToken()
  globalThis.fetch = (async (url: string) => {
    const u = String(url)
    if (u.includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    }
    if (u.includes('/registrants')) {
      return registrantOk
        ? { ok: true, status: 201, json: async () => ({ registrant_id: `reg-${Math.random()}`, join_url: 'https://zoom.us/w/1?tk=P' }) }
        : { ok: false, status: 400, json: async () => ({}) }
    }
    return {
      ok: true, status: 201,
      json: async () => ({ id: 5551, join_url: 'https://zoom.us/j/5551', start_url: 'https://zoom.us/s/5551?zak=K' }),
    }
  }) as unknown as typeof fetch
})

describe('الروابطُ تُكتب للملتحقين وحدَهم', () => {
  it('يُسجَّل الملتحقُ ولا يُسجَّل من في قائمة الانتظار', async () => {
    registrantOk = true
    await cohorts.attachApiZoom(adminId, sessionId)

    const links = await prisma.sessionJoinLink.findMany({ where: { sessionId } })
    expect(links.map((l) => l.enrollmentId)).toContain(enrolledId)
    expect(
      links.map((l) => l.enrollmentId),
      'المنتظرُ لم يلتحق بعد — ورابطٌ له يدخل به لقاءً لا يستحقّه، ويُحتسب في تقرير الحضور.',
    ).not.toContain(waitlistedId)
  })

  it('والمزامنةُ تُعلَن ناجحةً — فالشاشةُ تقول إنّ العدَّ الآليَّ يجري', async () => {
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId } })
    expect(zoom?.syncState).toBe('synced')
    expect(zoom?.syncError).toBeNull()
  })

  /* ── ولمَ لا يُقاس هذا بـ`attachApiZoom` ──

     أوّلُ صياغةٍ لهذا الحارس نادت `attachApiZoom` ثانيةً وابتلعت خطأَها،
     **فمرّت خضراءَ على نقضِها**: النداءُ الثاني يُردّ بـ`already_linked`
     قبل أن يبلغ فحصَ الموجود أصلا، فما جرى الكودُ المحروس. والمسارُ الحقيقيُّ
     `ensureSessionJoinLinks` — وهي التي يناديها التحاقٌ جديد. */
  it('وإعادةُ النداء لا تُكرّر الموجود — وإلّا رمى قيدُ التفرّد', async () => {
    const before = await prisma.sessionJoinLink.count({ where: { sessionId } })
    expect(before, 'لا روابطَ أصلا — فالفحصُ فارغ').toBeGreaterThan(0)
    const again = await cohorts.ensureSessionJoinLinks(sessionId)
    const after = await prisma.sessionJoinLink.count({ where: { sessionId } })
    expect(after, 'كُرّر تسجيلُ من له رابطٌ — و`@@unique` يرمي فيسقط التحاقُ غيره').toBe(before)
    expect(again.linked, 'أُعيد تسجيلُ الموجود').toBe(0)
  })

  it('والملتحقُ بعد الإنشاء يأخذ رابطَه — لا يبقى بلا مطابقةٍ في التقرير', async () => {
    registrantOk = true
    const auth = new AuthService(prisma)
    const late = await auth.register('links-late@test.local', 'Learner#12345', 'ملتحقٌ متأخّر')
    const lateEnrollment = await prisma.enrollment.create({
      data: { userId: late.userId, cohortId, status: 'enrolled' },
    })
    await cohorts.ensureSessionJoinLinks(sessionId)
    const link = await prisma.sessionJoinLink.findUnique({
      where: { sessionId_enrollmentId: { sessionId, enrollmentId: lateEnrollment.id } },
    })
    expect(
      link,
      'من التحق بعد إنشاء الاجتماع يدخل بالرابط المشترك، فلا يُطابَق في تقرير '
      + 'الحضور — ويُقرأ غائبا وهو حاضر.',
    ).toBeTruthy()
  })
})

describe('وحين يرفض الحسابُ التسجيلَ — يُكتب السببُ ولا يُبتلع', () => {
  it('الجلسةُ تُنشأ ومعها اجتماعُها — لا تسقط لأنّ المطابقةَ تعذّرت', async () => {
    registrantOk = false
    const s2 = await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءٌ بلا تسجيل', startsAt: new Date('2026-11-09T09:00:00Z'), status: 'scheduled' },
    })
    await cohorts.attachApiZoom(adminId, s2.id)
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId: s2.id } })
    expect(zoom, 'سقط الاجتماعُ كلُّه لأنّ التسجيلَ رُفض').toBeTruthy()
    expect(zoom!.joinUrl).toContain('zoom.us')
  })

  it('و`syncError` يحمل سببا عربيّا يُقرأ — لا صمتٌ يُظنّ معه أنّ العدَّ يجري', async () => {
    const s3 = await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءٌ ثالث', startsAt: new Date('2026-11-16T09:00:00Z'), status: 'scheduled' },
    })
    registrantOk = false
    await cohorts.attachApiZoom(adminId, s3.id)
    const zoom = await prisma.zoomMeeting.findUnique({ where: { sessionId: s3.id } })
    expect(zoom?.syncState, 'المزامنةُ تُعلَن ناجحةً وهي لم تنجح').toBe('failed')
    expect(zoom?.syncError ?? '').not.toBe('')
    expect(/[؀-ۿ]/.test(zoom?.syncError ?? ''), 'السببُ يُعرض للمدرّب فيكون بلغته').toBe(true)
    /* ولا رابطَ نصفيّ: إمّا رابطٌ لكلٍّ أو لا رابطَ وسببٌ مكتوب */
    expect(await prisma.sessionJoinLink.count({ where: { sessionId: s3.id } })).toBe(0)
  })
})
