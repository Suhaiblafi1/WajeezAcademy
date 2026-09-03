/* العاملُ الخلفيّ — كلُّ وعدٍ كتبته المنصّةُ ولم يكن أحدٌ ينفّذه.

   المنصّةُ تكتب اليومَ صفوفا تنتظر مُشغِّلا لا وجودَ له (A2 في التدقيق):
   `Notification.status = 'queued'` ينتظر إرسالا، و`scheduledPublishAt` تاريخٌ
   يمرّ ولا يُنشَر عنده شيء، وجلسةٌ غدا لا تذكيرَ لها. فكلُّ «سنُعلمك» في
   الواجهة وعدٌ لا يُنفَّذ.

   وهذا الملفُّ **المنطقُ وحدَه**: دوالٌّ نقيّةٌ تأخذ القاعدةَ والوقتَ وتعمل
   وتُخبر بما عملت. التشغيلُ في `index.ts`، ولا يعمل إلّا بعلمٍ صريح
   (`WORKER_ENABLED=on`) — فيُكتب ويُختبَر اليومَ ويُشغَّل يومَ يوجد خادمٌ
   دائم (المهمّة ٥٤ في الخطّة). ولا يُشغَّل على Vercel: الدالّةُ تنام.

   وثلاثةُ شروطٍ في كلّ وظيفةٍ هنا، وبها تصلح للتشغيل بلا رقيب:

   ١) **تُعاد بلا ضرر.** تشغيلُها مرّتين لا يُرسل إشعارا مرّتين ولا يُنشر
      اقتراحا مرّتين. والحيلةُ ليست علما يُخزَّن، بل سؤالُ القاعدة: هل وُجد
      أثرُ هذا العمل؟
   ٢) **محدودةُ الأثر في كلّ دورة.** سقفٌ لكلّ وظيفة، فلا تُقلع دورةٌ فتُرسل
      ألفَ إشعارٍ متراكمٍ دفعةً واحدة.
   ٣) **تُخبر بالعربيّة بما فعلت.** لا سجلٌّ لاتينيٌّ يقرؤه مبرمجٌ وحدَه:
      صفحةُ صحّةِ النظام والسجلُّ يقرآن هذه الجملة. */

import type { PrismaClient } from '@prisma/client'
import { NotificationService } from '../services/notification.service'
import { CohortService } from '../services/cohort.service'
import { TrainerChangeService } from '../services/trainer-change.service'
import { recordAudit } from '../services/audit'

export interface JobResult {
  job: string
  /** ماذا فعلت هذه الدورة، بالعربيّة */
  summaryAr: string
  /** عددُ ما عُمل فعلا — صفرٌ يعني «لا شيءَ كان ينتظر» */
  done: number
  /** ما حاولَته وسقط — يُقرأ ولا يوقف الدورة */
  failed: number
  ms: number
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** حدودُ الدورة الواحدة — لا انفجارَ بعد انقطاع */
const LIMITS = { notifications: 100, reminders: 200, publishes: 20, cleanup: 5_000 }

/** تذكيرتان لكلّ جلسة: قبل يومٍ وقبل ساعة. المفتاحُ هو ما يمنع التكرار. */
const REMINDERS = [
  { key: 'session.reminder.24h', withinMs: DAY, labelAr: 'غدا' },
  { key: 'session.reminder.1h', withinMs: HOUR, labelAr: 'بعد ساعة' },
] as const

/* ═══════════ ١ · إرسالُ ما في الطابور ═══════════

   الطابورُ يمتلئ ولا يُفرَّغ. و`attemptSend` نفسُها تحرس التكرار: ما أُرسل
   لا يُرسل، وما بلغ حدَّ المحاولات لا يُعاد. فالوظيفةُ هنا اختيارُ من
   يُحاوَل وترتيبُه: الأقدمُ أوّلا — الوعدُ الأقدمُ أحقُّ بالوفاء. */
export async function dispatchQueuedNotifications(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const notifications = new NotificationService(prisma)
  const queued = await prisma.notification.findMany({
    where: { status: 'queued' },
    orderBy: { queuedAt: 'asc' },
    take: LIMITS.notifications,
    select: { id: true, queuedAt: true },
  })
  /* عمرُ الأقدم يُقال في الخبر: «حُوِّل ٤٣ إشعارا» لا يكشف أنّ أحدَها ينتظر
     يومَين — والانتظارُ هو العطبُ لا العدد. */
  const oldest = queued[0]?.queuedAt
  let done = 0
  let failed = 0
  for (const n of queued) {
    try {
      const out = await notifications.attemptSend(n.id)
      if (out.status === 'sent') done += 1
      else failed += 1
    } catch {
      /* سقوطُ واحدٍ لا يوقف الدورة: الباقي ينتظر، وحالتُه مكتوبةٌ في صفّه */
      failed += 1
    }
  }
  return {
    job: 'dispatch_notifications',
    summaryAr: queued.length === 0
      ? 'لا إشعارَ في الطابور'
      : `حُوِل ${queued.length} إشعارا: وصل ${done}، وسقط ${failed}`
        + (failed > 0 ? ' (قناةُ البريد أو المزوّد)' : '')
        + (oldest ? ` — أقدمُها انتظر ${Math.max(1, Math.round((now.getTime() - oldest.getTime()) / 60_000))} دقيقة` : ''),
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ٢ · تذكيرُ الجلسات ═══════════

   «سنُعلمك قبل الجلسة» وعدٌ في الواجهة لا يقع. والغيابُ عن جلسةٍ مدفوعةٍ
   خسارةٌ للمتعلّم وللأكاديمية معا.

   والتكرارُ يُمنع بسؤال القاعدة لا بعلمٍ يُخزَّن: هل ثمّ إشعارٌ بهذا
   المفتاح لهذا المتعلّم عن هذه الجلسة؟ فلو أُعيد تشغيلُ الدورة عشرا لم
   يزد شيء. */
export async function sendSessionReminders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const notifications = new NotificationService(prisma)
  let done = 0
  let failed = 0
  const parts: string[] = []

  for (const window of REMINDERS) {
    const sessions = await prisma.cohortSession.findMany({
      where: {
        startsAt: { gte: now, lte: new Date(now.getTime() + window.withinMs) },
        cohort: { status: { in: ['open', 'full', 'active'] } },
      },
      take: LIMITS.reminders,
      select: {
        id: true, title: true, startsAt: true,
        zoom: { select: { joinUrl: true } },
        cohort: {
          select: {
            id: true, title: true,
            /* المسجَّلُ النشطُ وحدَه: من أسقط تسجيلَه لا يُذكَّر بجلسةٍ لا تخصّه */
            enrollments: { where: { status: { in: ['active', 'completed'] } }, select: { userId: true } },
          },
        },
      },
    })
    let sent = 0
    for (const s of sessions) {
      for (const e of s.cohort.enrollments) {
        const already = await prisma.notification.count({
          where: { userId: e.userId, templateKey: window.key, data: { path: ['sessionId'], equals: s.id } },
        })
        if (already > 0) continue
        try {
          await notifications.notify({
            userId: e.userId, channel: 'in_app', templateKey: window.key,
            title: `جلستُك ${window.labelAr}: ${s.cohort.title}`,
            body: `«${s.title}» تبدأ ${window.labelAr}.${s.zoom?.joinUrl ? ' رابطُ الانضمام في صفحة الجلسة.' : ' ولا رابطَ انضمامٍ بعد — راجع الأكاديمية.'}`,
            data: { sessionId: s.id, cohortId: s.cohort.id, startsAt: s.startsAt.toISOString() },
            audience: 'learner',
          })
          sent += 1
          done += 1
        } catch {
          failed += 1
        }
      }
    }
    if (sent > 0) parts.push(`${sent} تذكيرا (${window.labelAr})`)
  }

  return {
    job: 'session_reminders',
    summaryAr: parts.length === 0 ? 'لا جلسةَ تستحقّ تذكيرا الآن' : `أُنشئ ${parts.join(' و')}`,
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ٣ · حالاتُ الشعب بالتواريخ ═══════════

   كانت الحالةُ تُحرَّك بزرٍّ في الإدارة: شعبةٌ انتهت جلساتُها تبقى «جارية»
   حتّى يفتحها موظّف. والمنطقُ نفسُه المستعمَل في الشاشة (المرحلة ٢ب) —
   فلا مصدرَ ثانٍ يفترق عنه. ولا تُفتَح شعبةٌ تلقائيّا: الفتحُ قرارٌ بشريٌّ
   بشروطٍ ستّة. */
export async function syncCohortStatuses(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const cohorts = new CohortService(prisma)
  const out = await cohorts.syncStatusesByDate(null, { apply: true, now })
  return {
    job: 'cohort_status_sync',
    summaryAr: out.changes.length === 0
      ? 'حالاتُ الشعب مطابقةٌ لتواريخها'
      : `حُدِّثت ${out.changes.length} شعبة: ${out.changes.slice(0, 3).map((c) => c.title).join('، ')}${out.changes.length > 3 ? '…' : ''}`,
    done: out.changes.length, failed: 0, ms: Date.now() - started,
  }
}

/* ═══════════ ٤ · النشرُ المجدول ═══════════

   حُدِّد للتغيير موعدُ نشرٍ ومرّ، ولم يُنشَر: لا مجدولَ ينفّذه. والفاعلُ
   المسجَّلُ هو **من اعتمده** لا «النظام»: النشرُ وقع بقراره، والتاريخُ
   وسيلةُ تنفيذِه. ومن لم يكن اقتراحُه معتمَدا يُتخطّى — الخدمةُ ترفضه
   بشرطها، ونحن لا نتجاوزه. */
export async function publishScheduledChanges(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const changes = new TrainerChangeService(prisma)
  const due = await prisma.trainerChangeRequest.findMany({
    where: {
      scheduledPublishAt: { lte: now },
      status: { in: ['approved_for_cohort', 'approved_for_catalog'] },
    },
    take: LIMITS.publishes,
    select: { id: true, reviewedBy: true },
  })
  let done = 0
  let failed = 0
  const blocked: string[] = []
  for (const req of due) {
    try {
      await changes.publish(req.id, req.reviewedBy ?? undefined as unknown as string)
      done += 1
    } catch (e) {
      /* الرفضُ المشروط ليس عطبا: «فحصُ الأثر لم يُجرَ» قرارٌ يبقى للبشر */
      failed += 1
      blocked.push(e instanceof Error ? e.message.slice(0, 60) : 'سببٌ غير معروف')
    }
  }
  return {
    job: 'publish_scheduled_changes',
    summaryAr: due.length === 0
      ? 'لا نشرَ مجدولٌ حلَّ موعدُه'
      : `نُشر ${done} من ${due.length}${blocked.length > 0 ? ` — ووقف ${blocked.length}: ${[...new Set(blocked)].join(' · ')}` : ''}`,
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ٥ · تنظيفُ ما انتهى ═══════════

   جلسةٌ انتهت صلاحيّتُها لا تفتح شيئا — الحارسُ يفحص التاريخَ في كلّ طلب —
   لكنّها صفوفٌ تنمو بلا حدّ. وكذلك رموزُ الاستعادة والدعوات المنتهية.
   وهذا تنظيفٌ لا أمن: يُحذف ما مضى عليه ثلاثون يوما، فيبقى أثرُ الأمس
   قابلا للفحص. */
export async function cleanupExpired(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const cutoff = new Date(now.getTime() - 30 * DAY)
  const [sessions, tokens] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
  ])
  const total = sessions.count + tokens.count
  return {
    job: 'cleanup_expired',
    summaryAr: total === 0
      ? 'لا صفَّ منتهيا أقدمَ من ثلاثين يوما'
      : `حُذف ${sessions.count} جلسةً منتهيةً و${tokens.count} رمزا`,
    done: total, failed: 0, ms: Date.now() - started,
  }
}

/** الوظائفُ بأسمائها ودوراتِها — الترتيبُ ترتيبُ الأهمّيّة */
export const JOBS = [
  { key: 'dispatch_notifications', everyMs: 60_000, run: dispatchQueuedNotifications, titleAr: 'إرسالُ ما في طابور الإشعارات' },
  { key: 'session_reminders', everyMs: 5 * 60_000, run: sendSessionReminders, titleAr: 'تذكيرُ الجلسات' },
  { key: 'cohort_status_sync', everyMs: 15 * 60_000, run: syncCohortStatuses, titleAr: 'حالاتُ الشعب بالتواريخ' },
  { key: 'publish_scheduled_changes', everyMs: 5 * 60_000, run: publishScheduledChanges, titleAr: 'النشرُ المجدول' },
  { key: 'cleanup_expired', everyMs: 6 * HOUR, run: cleanupExpired, titleAr: 'تنظيفُ ما انتهى' },
] as const

/** دورةٌ واحدةٌ لوظيفةٍ واحدة، بأثرها المسجَّل — لا عملَ صامت */
export async function runJob(prisma: PrismaClient, key: string, now = new Date()): Promise<JobResult> {
  const job = JOBS.find((j) => j.key === key)
  if (!job) throw new Error(`لا وظيفةَ بهذا المفتاح: ${key}`)
  const result = await job.run(prisma, now)
  /* لا يُسجَّل إلّا ما عمل: دورةٌ فارغةٌ كلَّ دقيقةٍ تُغرق السجلَّ بلا خبر */
  if (result.done > 0 || result.failed > 0) {
    await recordAudit(prisma, {
      actorId: null, action: `worker.${key}`, entityType: 'worker', entityId: key,
      meta: { summaryAr: result.summaryAr, done: result.done, failed: result.failed, ms: result.ms },
    })
  }
  return result
}
