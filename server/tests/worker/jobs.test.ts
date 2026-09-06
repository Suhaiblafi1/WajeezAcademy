/* العاملُ الخلفيّ — يُختبَر كاملا قبل أن يُشغَّل يوما.

   الأصلُ في التدقيق (A2): لا مُشغِّلَ خلفيّا على المنصّة. فالإشعارُ يُكتب
   بحالة `queued` ولا يُرسل، وتاريخُ النشر المجدول يمرّ ولا يُنشَر، وجلسةُ
   الغد لا تذكيرَ لها — وكلُّ «سنُعلمك» في الواجهة وعدٌ لا يُنفَّذ.

   والشرطُ الذي يجعل تشغيلَه آمنا يومَ يوجد خادمٌ دائم هو ما يُختبَر هنا:
   **الإعادةُ بلا ضرر**. تشغيلُ الدورة مرّتَين لا يُرسل تذكيرا مرّتَين ولا
   ينشر اقتراحا مرّتَين. ولذلك يُشغَّل كلُّ اختبارٍ هنا **مرّتَين** ويُقاس
   الفرق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import {
  JOBS, RETENTION_BATCH, RETENTION_DAYS, cleanupExpired, dispatchQueuedNotifications,
  runJob, sendSessionReminders, syncCohortStatuses,
} from '../../worker/jobs'
import { tick } from '../../worker/index'
import { liveChannels } from '../../services/notification.service'

let prisma: PrismaClient
let auth: AuthService
let cohorts: CohortService
let managerId = ''
let learnerId = ''
const COURSE = 'C-BIZ-101'
const DAY = 86_400_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)

  const m = await auth.register('worker-manager@test.local', 'Worker#12345', 'مديرٌ أكاديميّ')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  const l = await auth.register('worker-learner@test.local', 'Worker#12345', 'متعلّمُ العامل')
  learnerId = l.userId
  await auth.setRoles(learnerId, ['learner'])
}, 240_000)

describe('طابورُ الإشعارات يُفرَّغ', () => {
  it('يُحاول كلَّ ما في الطابور، ويقول ما وقع بالعربيّة', async () => {
    await prisma.notification.createMany({
      data: [
        { userId: learnerId, title: 'أوّل', body: 'نصّ', status: 'queued' },
        { userId: learnerId, title: 'ثانٍ', body: 'نصّ', status: 'queued' },
      ],
    })
    const out = await dispatchQueuedNotifications(prisma)
    expect(out.done + out.failed).toBe(2)
    expect(out.summaryAr).toContain('2')
    /* داخلُ التطبيق يُسلَّم دائما — والقناةُ غيرُ الموصولة تُسجَّل فشلا */
    expect(await prisma.notification.count({ where: { status: 'queued' } })).toBe(0)
  })

  it('ولا يُعيد إرسالَ ما أُرسل — دورةٌ ثانيةٌ بلا أثر', async () => {
    const before = await prisma.notification.findMany({ select: { id: true, status: true, attempts: true } })
    const out = await dispatchQueuedNotifications(prisma)
    expect(out.done).toBe(0)
    expect(out.summaryAr).toBe('لا إشعارَ في الطابور')
    const after = await prisma.notification.findMany({ select: { id: true, status: true, attempts: true } })
    expect(after).toEqual(before)
  })
})

/* ═══ القناةُ غيرُ الموصولة: الخطرُ الذي أبقى العاملَ متوقّفا ═══

   `attemptSend` تُعلّم الصفَّ `failed` حين لا مزوّدَ لقناته، و
   `dispatchQueuedNotifications` تختار `queued` وحدَها — فالصفُّ المحروق لا
   يُعاد إليه أبدا، ويرتفع عدّادُه حتّى يموت عند الثالثة.

   فلو شُغِّل العاملُ وقناةُ البريد مغلقة، احترق طابورُ البريد كلُّه في دورةٍ
   واحدةٍ بلا رجعة: رسائلُ توثيقِ البريد ودعواتُ إنشاء الحساب ورسائلُ استعادة
   كلمة السرّ — كلُّها تُعلَّم «فشلت» ولم يحاول أحدٌ إرسالَها. والتعافي يدويٌّ
   صفّا صفّا من شاشة الإدارة.

   وهذا ما يُقاس هنا. وهو حارسُ **غياب**: لو عاد الاختيارُ إلى كلّ الطابور لم
   تحمرّ شاشةٌ ولم يسقط مسار — يُحرَق الطابورُ صامتا على الإنتاج. */
describe('قناةٌ غيرُ موصولةٍ لا يُحرَق طابورُها', () => {
  const KEY = 'RESEND_API_KEY'

  it('لا تُعدّ قناةُ البريد موصولةً بلا مفتاح', async () => {
    const had = process.env[KEY]
    delete process.env[KEY]
    expect(await liveChannels(prisma)).toEqual(['in_app'])
    if (had !== undefined) process.env[KEY] = had
  })

  it('وتُعدّ موصولةً حين يُضبط المفتاح — فالحارسُ يرفع نفسَه بلا تدخّل', async () => {
    const had = process.env[KEY]
    process.env[KEY] = 're_test_key'
    expect(await liveChannels(prisma)).toContain('email')
    if (had === undefined) delete process.env[KEY]
    else process.env[KEY] = had
  })

  it('ولا يُمَسّ صفُّ بريدٍ منتظرٌ وقناتُه مغلقة — يبقى `queued` بلا محاولة', async () => {
    const had = process.env[KEY]
    delete process.env[KEY]
    const n = await prisma.notification.create({
      data: { userId: learnerId, channel: 'email', title: 'توثيقُ بريد', body: 'نصّ', status: 'queued' },
    })

    /* دورتان لا واحدة: العطبُ تراكميٌّ — كلُّ دورةٍ ترفع العدّاد */
    await dispatchQueuedNotifications(prisma)
    const out = await dispatchQueuedNotifications(prisma)

    const after = await prisma.notification.findUnique({ where: { id: n.id } })
    expect(after?.status, 'حُرق صفُّ بريدٍ لم يحاول أحدٌ إرسالَه').toBe('queued')
    expect(after?.attempts, 'ارتفع عدّادُ المحاولات بلا محاولة').toBe(0)
    expect(out.summaryAr, 'ينتظر صامتا — ولا يُقال عددُه').toContain('ينتظر قناةً لم تُوصَل')

    await prisma.notification.delete({ where: { id: n.id } })
    if (had !== undefined) process.env[KEY] = had
  })
})

describe('تذكيرُ الجلسات: مرّةً واحدةً لكلّ متعلّمٍ لكلّ جلسة', () => {
  let cohortId = ''
  let sessionId = ''

  beforeAll(async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ التذكير', capacity: 10, price: 100 })
    cohortId = c.id
    const s = await cohorts.addSession(managerId, cohortId, {
      title: 'جلسةُ الغد',
      startsAt: new Date(Date.now() + 20 * 3_600_000),
      endsAt: new Date(Date.now() + 22 * 3_600_000),
    })
    sessionId = s.id
    await prisma.cohort.update({ where: { id: cohortId }, data: { status: 'active' } })
    await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })
  })

  it('يُنشئ تذكيرَ «غدا» للمسجَّل النشط', async () => {
    const out = await sendSessionReminders(prisma)
    expect(out.done).toBe(1)
    expect(out.summaryAr).toContain('غدا')
    const n = await prisma.notification.findFirst({
      where: { userId: learnerId, templateKey: 'session.reminder.24h' },
    })
    expect(n, 'لا تذكيرَ أُنشئ').toBeTruthy()
    expect(n!.title).toContain('شعبةُ التذكير')
    expect((n!.data as { sessionId: string }).sessionId).toBe(sessionId)
  })

  it('ولا يُكرّره في الدورة التالية — والحارسُ سؤالُ القاعدة لا علمٌ يُخزَّن', async () => {
    const before = await prisma.notification.count({ where: { templateKey: 'session.reminder.24h' } })
    const out = await sendSessionReminders(prisma)
    expect(out.done).toBe(0)
    expect(out.summaryAr).toBe('لا جلسةَ تستحقّ تذكيرا الآن')
    expect(await prisma.notification.count({ where: { templateKey: 'session.reminder.24h' } })).toBe(before)
  })

  it('ولا يُذكَّر من أسقط تسجيلَه', async () => {
    const other = await auth.register('worker-dropped@test.local', 'Worker#12345', 'مسجَّلٌ سابق')
    await prisma.enrollment.create({ data: { userId: other.userId, cohortId, status: 'dropped' } })
    const out = await sendSessionReminders(prisma)
    expect(out.done, 'ذُكِّر من ليس مسجَّلا').toBe(0)
    expect(await prisma.notification.count({ where: { userId: other.userId } })).toBe(0)
  })

  it('ولا تُذكَّر جلسةُ شعبةٍ مسودّة — لا متعلّمَ فيها يُفاجَأ', async () => {
    const draft = await cohorts.create(managerId, { courseId: COURSE, title: 'مسودّةُ التذكير' })
    await cohorts.addSession(managerId, draft.id, {
      title: 'جلسةُ مسودّة',
      startsAt: new Date(Date.now() + 10 * 3_600_000),
      endsAt: new Date(Date.now() + 12 * 3_600_000),
    })
    await prisma.enrollment.create({ data: { userId: learnerId, cohortId: draft.id, status: 'enrolled' } })
    const out = await sendSessionReminders(prisma)
    expect(out.done).toBe(0)
  })

  it('وتذكيرُ «بعد ساعة» مفتاحٌ آخرُ — فلا يمنعه تذكيرُ الأمس', async () => {
    const soon = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ الساعة', capacity: 5, price: 50 })
    await prisma.cohort.update({ where: { id: soon.id }, data: { status: 'active' } })
    await cohorts.addSession(managerId, soon.id, {
      title: 'جلسةٌ قريبة',
      startsAt: new Date(Date.now() + 40 * 60_000),
      endsAt: new Date(Date.now() + 100 * 60_000),
    })
    await prisma.enrollment.create({ data: { userId: learnerId, cohortId: soon.id, status: 'enrolled' } })
    const out = await sendSessionReminders(prisma)
    /* واحدةٌ لنافذة اليوم وواحدةٌ لنافذة الساعة — الجلسةُ نفسُها في كلتَيهما */
    expect(out.done).toBe(2)
    const keys = (await prisma.notification.findMany({
      where: { userId: learnerId, templateKey: { startsWith: 'session.reminder.' } },
      select: { templateKey: true },
    })).map((n) => n.templateKey)
    expect(new Set(keys)).toEqual(new Set(['session.reminder.24h', 'session.reminder.1h']))
  })
})

describe('حالاتُ الشعب والتنظيف', () => {
  it('يُنهي شعبةً مضت جلساتُها، ولا يفتح شعبةً تلقائيّا', async () => {
    const done = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةٌ منتهية', capacity: 5, price: 50 })
    await prisma.cohort.update({ where: { id: done.id }, data: { status: 'active' } })
    await prisma.cohortSession.create({
      data: {
        cohortId: done.id, title: 'جلسةٌ ماضية',
        startsAt: new Date(Date.now() - 10 * DAY), endsAt: new Date(Date.now() - 10 * DAY + 5_400_000),
      },
    })
    const draft = await cohorts.create(managerId, { courseId: COURSE, title: 'مسودّةٌ لا تُفتح' })

    const out = await syncCohortStatuses(prisma)
    expect(out.done).toBeGreaterThanOrEqual(1)
    expect((await prisma.cohort.findUnique({ where: { id: done.id } }))!.status).toBe('completed')
    expect((await prisma.cohort.findUnique({ where: { id: draft.id } }))!.status, 'فُتحت مسودّةٌ تلقائيّا').toBe('draft')

    /* والدورةُ الثانيةُ لا تجد ما تُغيّر */
    expect((await syncCohortStatuses(prisma)).done).toBe(0)
  })

  it('والتنظيفُ يحذف ما مضى عليه ثلاثون يوما ويُبقي ما هو أحدث', async () => {
    const stale = await prisma.session.create({
      data: {
        userId: learnerId, tokenHash: 'stale-hash-for-cleanup',
        expiresAt: new Date(Date.now() - 40 * DAY),
      },
    })
    const recent = await prisma.session.create({
      data: {
        userId: learnerId, tokenHash: 'recent-hash-for-cleanup',
        expiresAt: new Date(Date.now() - 2 * DAY),
      },
    })
    const out = await cleanupExpired(prisma)
    expect(out.done).toBeGreaterThanOrEqual(1)
    expect(await prisma.session.findUnique({ where: { id: stale.id } })).toBeNull()
    expect(await prisma.session.findUnique({ where: { id: recent.id } }), 'حُذف ما لم يمضِ عليه شهر').toBeTruthy()
  })
})

describe('الدورةُ والأثر', () => {
  it('كلُّ وظيفةٍ لها مفتاحٌ ودورةٌ واسمٌ عربيّ', () => {
    expect(JOBS.length).toBeGreaterThanOrEqual(5)
    for (const j of JOBS) {
      expect(j.key).toMatch(/^[a-z_]+$/)
      expect(j.everyMs).toBeGreaterThanOrEqual(60_000)
      expect(j.titleAr.length).toBeGreaterThan(5)
    }
  })

  it('وما عمل يُسجَّل في الأثر، وما لم يعمل لا يُغرق السجلّ', async () => {
    const before = await prisma.auditEvent.count({ where: { entityType: 'worker' } })
    /* دورةٌ فارغة: لا شيءَ في الطابور ولا شعبةَ تتغيّر */
    await runJob(prisma, 'dispatch_notifications')
    expect(await prisma.auditEvent.count({ where: { entityType: 'worker' } }), 'سُجِّلت دورةٌ فارغة').toBe(before)

    await prisma.notification.create({ data: { userId: learnerId, title: 'يُرسَل', body: 'نصّ', status: 'queued' } })
    const out = await runJob(prisma, 'dispatch_notifications')
    expect(out.done + out.failed).toBe(1)
    const row = await prisma.auditEvent.findFirst({
      where: { entityType: 'worker', action: 'worker.dispatch_notifications' },
      orderBy: { createdAt: 'desc' },
    })
    expect(row, 'عملُ العامل بلا أثر').toBeTruthy()
    expect(row!.actorId, 'العاملُ ليس بشرا').toBeNull()
    expect((row!.meta as { summaryAr: string }).summaryAr).toContain('إشعارا')
  })

  it('والوظيفةُ المجهولةُ تُرفض بصراحةٍ لا بصمت', async () => {
    await expect(runJob(prisma, 'لا-وجود-لها')).rejects.toThrow('لا وظيفةَ بهذا المفتاح')
  })

  it('والدورةُ لا تُشغّل وظيفةً قبل حلول موعدها', async () => {
    const lastRun = new Map<string, number>()
    const first = await tick(prisma, lastRun, new Date())
    expect(first.length, 'لم تعمل أيُّ وظيفةٍ في أوّل دورة').toBe(JOBS.length)
    /* بعد ثانيةٍ واحدة: لا شيءَ حلَّ موعدُه */
    const second = await tick(prisma, lastRun, new Date(Date.now() + 1_000))
    expect(second.length).toBe(0)
    /* وبعد أطولِ دورةٍ في الجدول: كلُّها.

       والمدّةُ تُشتقّ من `JOBS` لا تُكتب رقما: كانت سبعَ ساعاتٍ لأنّ أطولَ
       دورةٍ يومَها ستُّ ساعات، فلمّا أُضيفت وظيفةُ التقليم بدورةِ يومٍ سقط
       الاختبارُ — وهو اختبارٌ صحيحٌ بمقياسٍ تقادم. */
    const longestMs = Math.max(...JOBS.map((j) => j.everyMs))
    const later = await tick(prisma, lastRun, new Date(Date.now() + longestMs + 60_000))
    expect(later.length).toBe(JOBS.length)
  })
})

/* ═══════════ الاحتفاظ: جداولُ السجلّ تُقلَّم بمدّةٍ معلنة ═══════════

   العطب: خمسةُ جداولٍ تنمو بلا حدٍّ ولا سياسة — سجلُّ الأثر، والإشعاراتُ،
   وأحداثُ الاستخدام، ومحاولاتُ الدخول، وأحداثُ خطّافِ الدفع. ولا شيءَ يحذف
   منها صفّا أبدا. ومنصّةٌ في تجربةٍ لا تشعر؛ وعاملةٌ تكتب عشراتَ الصفوف لكلّ
   زائر، فتصير القاعدةُ بعد سنةٍ أكثرُها سجلٌّ لا يقرؤه أحد — **ونسخُها
   الاحتياطيّ يثقل معها، وهو الأخطر**: نسخةٌ تطول استعادتُها ساعاتٍ ليست
   نسخةً في وقت العطب.

   وما يُحرَس هنا أربعةُ أشياء:
   ١) القديمُ يُحذف — وإلّا فالسياسةُ كلامٌ.
   ٢) والحديثُ يبقى — فتقليمٌ يأخذ الحاضرَ معه أسوأُ من نموٍّ بلا حدّ.
   ٣) **والإشعارُ المنتظرُ في الطابور لا يُحذف بعمره**، وهو أدقُّ ما في
      السياسة: المقروءُ أدّى غرضَه، والمنتظرُ عملٌ لم يتمّ — وحذفُه بالعمر
      يُسقط إشعارا لم يصل صاحبَه قطّ.
   ٤) والحدُّ في الدورة يُحترَم: حذفُ مليون صفٍّ في معاملةٍ يُقفل الجدولَ
      ويُوقف المنصّة. */
describe('تقليمُ جداول السجلّ', () => {
  it('يحذف ما تجاوز مدّةَ حفظه ويُبقي ما هو أحدث', async () => {
    const old = new Date(Date.now() - (RETENTION_DAYS.analytics + 5) * 86_400_000)
    const fresh = new Date(Date.now() - 3 * 86_400_000)
    await prisma.analyticsEvent.createMany({
      data: [
        { event: 'retention_old', createdAt: old },
        { event: 'retention_fresh', createdAt: fresh },
      ],
    })
    const r = await runJob(prisma, 'enforce_retention')
    expect(r.done).toBeGreaterThanOrEqual(1)
    expect(await prisma.analyticsEvent.count({ where: { event: 'retention_old' } })).toBe(0)
    expect(await prisma.analyticsEvent.count({ where: { event: 'retention_fresh' } })).toBe(1)
  })

  it('والإشعارُ المنتظرُ في الطابور لا يُحذف بعمره — عملٌ لم يتمّ', async () => {
    const long = new Date(Date.now() - (RETENTION_DAYS.notificationRead + 60) * 86_400_000)
    const queued = await prisma.notification.create({
      data: { userId: learnerId, title: 'قديمٌ لم يُرسَل', body: 'نصّ', status: 'queued', queuedAt: long },
    })
    const read = await prisma.notification.create({
      data: { userId: learnerId, title: 'قديمٌ قُرئ', body: 'نصّ', status: 'read', queuedAt: long, readAt: long },
    })
    await runJob(prisma, 'enforce_retention')
    expect(await prisma.notification.findUnique({ where: { id: queued.id } }), 'حُذف إشعارٌ لم يُرسَل بعد').not.toBeNull()
    expect(await prisma.notification.findUnique({ where: { id: read.id } }), 'بقي إشعارٌ قُرئ قبل تسعين يوما').toBeNull()
  })

  it('ولكلّ جدولٍ مدّةٌ مكتوبةٌ وحدٌّ للدُفعة — لا رقمٌ مبثوثٌ في الشيفرة', () => {
    /* المدّةُ في مكانٍ واحدٍ تُقرأ وتُراجَع؛ ورقمٌ مكتوبٌ في موضعِ الاستعلام
       يفترق عن أخيه بأوّل تعديل. */
    for (const [k, v] of Object.entries(RETENTION_DAYS)) {
      expect(v, `${k}: مدّةٌ غيرُ معقولة`).toBeGreaterThan(0)
      expect(v, `${k}: مدّةٌ أطولُ من ثلاث سنوات`).toBeLessThanOrEqual(1_095)
    }
    /* سجلُّ الأثر أطولُ المُدَد: هو جوابُ «من غيّر هذا؟» */
    expect(RETENTION_DAYS.audit).toBeGreaterThan(RETENTION_DAYS.notificationRead)
    expect(RETENTION_BATCH).toBeGreaterThan(0)
    expect(RETENTION_BATCH, 'دُفعةٌ كبيرةٌ تُقفل الجدول').toBeLessThanOrEqual(20_000)
  })
})
