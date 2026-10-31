/* العاملُ الخلفيّ — كلُّ وعدٍ كتبته المنصّةُ ولم يكن أحدٌ ينفّذه.

   المنصّةُ تكتب اليومَ صفوفا تنتظر مُشغِّلا لا وجودَ له (A2 في التدقيق):
   `Notification.status = 'queued'` ينتظر إرسالا، و`scheduledPublishAt` تاريخٌ
   يمرّ ولا يُنشَر عنده شيء، وجلسةٌ غدا لا تذكيرَ لها. فكلُّ «سنُعلمك» في
   الواجهة وعدٌ لا يُنفَّذ.

   وهذا الملفُّ **المنطقُ وحدَه**: دوالٌّ نقيّةٌ تأخذ القاعدةَ والوقتَ وتعمل
   وتُخبر بما عملت. التشغيلُ في `index.ts`، ولا يعمل إلّا بعلمٍ صريح
   (`WORKER_ENABLED=on`). وكان يُكتب ويُختبَر بلا موضعِ تشغيل — الدالّةُ على
   Vercel تنام بعد الطلب. والخادمُ اليومَ حاويةٌ دائمة، وللعامل خدمتُه إلى
   جانبها في `deploy/compose.prod.yml`. ومانعُ البريد رُفع بالشيفرة: ما لا
   قناةَ موصولةَ له لا يُحاوَل فلا يُحرَق (`docs/DEPLOYMENT.md` §١٠).

   وثلاثةُ شروطٍ في كلّ وظيفةٍ هنا، وبها تصلح للتشغيل بلا رقيب:

   ١) **تُعاد بلا ضرر.** تشغيلُها مرّتين لا يُرسل إشعارا مرّتين ولا يُنشر
      اقتراحا مرّتين. والحيلةُ ليست علما يُخزَّن، بل سؤالُ القاعدة: هل وُجد
      أثرُ هذا العمل؟
   ٢) **محدودةُ الأثر في كلّ دورة.** سقفٌ لكلّ وظيفة، فلا تُقلع دورةٌ فتُرسل
      ألفَ إشعارٍ متراكمٍ دفعةً واحدة.
   ٣) **تُخبر بالعربيّة بما فعلت.** لا سجلٌّ لاتينيٌّ يقرؤه مبرمجٌ وحدَه:
      صفحةُ صحّةِ النظام والسجلُّ يقرآن هذه الجملة. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { NotificationService, liveChannels } from '../services/notification.service'
import { AuthService } from '../services/auth.service'
import { sendVerifyReminderEmail } from '../services/account-mail'
import { drainOutbox, OUTBOX_MAX_ATTEMPTS } from '../services/outbox.service'
import { CohortService } from '../services/cohort.service'
import { TermService } from '../services/term.service'
import { TrainerChangeService } from '../services/trainer-change.service'
import { TrainerOfferService } from '../services/trainer-offer.service'
import { TrainerReviewService } from '../services/trainer-review.service'
import { TrainerDeferralService } from '../services/trainer-deferral.service'
import { recordAudit } from '../services/audit'
import { releaseCouponUse } from '../services/commerce/coupon-ledger'
import { CommerceService } from '../services/commerce.service'
import { ProgressService } from '../services/progress.service'
import { LEARNER_PLAN_QUERY } from '../services/learner-gate'
import { LEARNER_SESSION_WHERE } from '../services/session-visibility'
import { learnerGate, whenAr } from '../../src/application/learning/cohort-gate'
import { timelineEvents, type TimelineEvent } from '../../src/application/learning/timeline-events'
import { PLAN_VISIBLE_STATUSES } from '../../src/application/trainer/plan-overlay'
import { INFLUENCER_GRANT_SLUG } from '../../src/application/commerce/grant'
import { sessionEnd } from '../../src/application/trainer/axis-timeline'
import { MIN_SESSION_MS } from '../../src/application/trainer/session-length'
import { notPermanentAuditWhere } from '../../src/application/audit/retention'
import { BOOKABLE_STATUSES } from '../../src/application/trainer/application-options'
import { LIVE_INTERVIEW } from '../services/trainer-interview-state'
import { isDigestHour, unbookedDigest } from '../../src/application/trainer/unbooked-digest'
import { getCalendlyConfig, recordCalendlySync } from '../services/integrations.service'
import { CalendlyWebhookService } from '../services/calendly-webhook.service'
import { CHECKOUT_HOLD_MS, TEAM_HOLD_MS, teamHeldOrderIds } from '../services/commerce/seat-hold'
import {
  CalendlyApiError,
  type CalendlyScheduledEvent,
  calendlyAccount,
  calendlyInviteeAsEvent,
  listCalendlyEvents,
  listCalendlyInvitees,
} from '../services/calendly-api.service'

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
const LIMITS = { notifications: 100, reminders: 200, publishes: 20, cleanup: 5_000, verifyReminders: 100,
  /* ي-٦: ستّون رسالةً بمهلة ٦٠٠ms = نحوُ ستٍّ وثلاثين ثانيةً في الدورة،
     ودورتُها دقيقة. فدفعةُ مئتَي حسابٍ تخرج في نحو أربع دقائق — تحت حدّ
     المزوّد طوالَها، ولا تُمسك الدورةَ عن بقيّة الوظائف. */
  outbox: 60,
  /* سقفُ ما يُقرأ من طابور الطلبات لملخّص الصباح — والطابورُ أصغرُ منه بكثير */
  unbooked: 200,
  /* لقاءاتٌ انتهت في دورةٍ واحدة — ودورتُها خمسُ دقائق، فالباقي في التالية */
  endedSessions: 300,
  /* شعبٌ على خطّ المحاور تُقرأ أخبارُها في دورةٍ واحدة */
  timelineCohorts: 200,
  /* تسجيلاتٌ يُعاد حسابُ تقدّمها على محاور الخطّة في دورةٍ واحدة — والباقي في التالية */
  progressRefresh: 200 }

/** تذكيرتان لكلّ جلسة: قبل يومٍ وقبل ساعة. المفتاحُ هو ما يمنع التكرار. */
const REMINDERS = [
  { key: 'session.reminder.24h', trainerKey: 'session.reminder.trainer.24h', withinMs: DAY, labelAr: 'غدا' },
  { key: 'session.reminder.1h', trainerKey: 'session.reminder.trainer.1h', withinMs: HOUR, labelAr: 'بعد ساعة' },
] as const

/* ═══════════ ١ · إرسالُ ما في الطابور ═══════════

   الطابورُ يمتلئ ولا يُفرَّغ. و`attemptSend` نفسُها تحرس التكرار: ما أُرسل
   لا يُرسل، وما بلغ حدَّ المحاولات لا يُعاد. فالوظيفةُ هنا اختيارُ من
   يُحاوَل وترتيبُه: الأقدمُ أوّلا — الوعدُ الأقدمُ أحقُّ بالوفاء.

   **والاختيارُ يبدأ بالقناة لا بالصفّ.** صفٌّ على قناةٍ غيرِ موصولةٍ لا
   يُحاوَل أصلا: محاولتُه تُعلّمه `failed` فيخرج من هذا الاستعلام إلى الأبد
   ويقترب من حدّ المحاولات — بلا أن يكون أحدٌ حاول إرساله. فيبقى `queued`
   ينتظر وصلَ قناته، ويُقال عددُه في الخبر فلا ينتظر صامتا
   (`liveChannels` · `docs/DEPLOYMENT.md` §١٠). */
export async function dispatchQueuedNotifications(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const notifications = new NotificationService(prisma)
  const live = await liveChannels(prisma)
  const queued = await prisma.notification.findMany({
    where: { status: 'queued', channel: { in: live } },
    orderBy: { queuedAt: 'asc' },
    take: LIMITS.notifications,
    select: { id: true, queuedAt: true },
  })
  /* المنتظرُ لقناةٍ لم تُوصَل — يُعدّ ولا يُمَسّ */
  const waiting = await prisma.notification.count({
    where: { status: 'queued', channel: { notIn: live } },
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
  const held = waiting > 0 ? ` · و${waiting} ينتظر قناة لم توصل بعد` : ''
  return {
    job: 'dispatch_notifications',
    summaryAr: (queued.length === 0
      ? 'لا إشعار في الطابور'
      : `حول ${queued.length} إشعارا: وصل ${done}، وسقط ${failed}`
        + (failed > 0 ? ' (المزوّد)' : '')
        + (oldest ? ` — أقدمها انتظر ${Math.max(1, Math.round((now.getTime() - oldest.getTime()) / 60_000))} دقيقة` : ''))
      + held,
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ تفريغُ طابور البريد الخارج (ي-٦) ═══════════

   القاعدةُ ومعناها في `server/services/outbox.service.ts`. وهذه الوظيفةُ
   جدولتُه وحدَها: تسأل عن القناة، ثمّ تُفرّغ ما استحقّ مُمَهَّلا.

   **والقناةُ تُسأل قبل الصفّ** — عرفُ `dispatchQueuedNotifications`: صفٌّ
   يُحاوَل وقناتُه مغلقةٌ يرفع عدّادَه ويقترب من حدّ المحاولات بلا أن يكون
   أحدٌ حاول إرسالَه. فيبقى ينتظر وصلَ قناته، ويُقال عددُه في الخبر. */
export async function dispatchOutboxMail(prisma: PrismaClient): Promise<JobResult> {
  const started = Date.now()

  const waiting = await prisma.outboxMail.count({
    where: { status: 'queued', attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
  })
  if (!(await liveChannels(prisma)).includes('email')) {
    return {
      job: 'outbox_mail',
      summaryAr: waiting > 0
        ? `قناة البريد غير موصولة — و${waiting} رسالة تنتظرها ولا تحرق`
        : 'قناة البريد غير موصولة — ولا رسالة تنتظر',
      done: 0, failed: 0, ms: Date.now() - started,
    }
  }

  const run = await drainOutbox(prisma, { limit: LIMITS.outbox })
  /* والمستنفَدُ يُقال في الخبر: صفٌّ بلغ حدَّ محاولاته لا يُعاد أبدا، فلو لم
     يُذكَر هنا لَبقي إنسانٌ لم يُخبَر ولا أحدَ يعلم. */
  const dead = await prisma.outboxMail.count({ where: { status: 'failed' } })
  return {
    job: 'outbox_mail',
    summaryAr: (run.sent === 0 && run.failed === 0
      ? 'لا رسالة في طابور البريد'
      : `خرج ${run.sent}، وسقط ${run.failed}`)
      + (run.remaining > 0 ? ` — وبقي ${run.remaining} للدورة القادمة` : '')
      + (dead > 0 ? ` · و${dead} استنفدت محاولاتها ولم تصل` : ''),
    done: run.sent, failed: run.failed, ms: Date.now() - started,
  }
}

/* ═══════════ تذكيرُ التوثيق — اثنان ثمّ صمتٌ دائم (ي-٥) ═══════════

   ═══ القسمةُ وعلّتُها ═══

   واحدٌ بعد يوم، وآخرُ بعد ثلاثةٍ منه، ثمّ **يُكَفّ نهائيّا**. وعدمُ التوثيق
   ليس جُرما، والثالثُ يُعلّم صاحبَه أن يتجاهل مُرسِلَنا كلَّه — فنخسر بريدَ
   الشهادة والإيصال معه، لا هذا التذكير وحدَه.

   ═══ وثلاثةُ أبوابٍ للصمت، لا واحد ═══

   ① **وثّق** — الشرطُ `emailVerifiedAt: null` في الاستعلام، و
      `issueEmailVerification` تردّ `null` لمن وثّق بين الاستعلام والإرسال.
      فمن وثّق في تلك الثانية لا يصله تذكيرٌ بما فعله للتوّ.

   ② **بلغه الاثنان** — والعلمُ يُقرأ من القاعدة لا يُخزَّن عَلَما: أثمّ صفُّ
      إشعارٍ بهذا المفتاح لهذا الحساب؟ فلو أُعيد تشغيلُ الدورة عشرا لم يزد
      شيء. وهو عرفُ `sendSessionReminders` نفسُه.

   ③ **ومضت النافذة** — `VERIFY_WINDOW_MS`، شهرٌ من إنشاء الحساب. وهو حدُّ
      **الساحة** لا حدُّ التكرار: التكرارَ يمنعه الصفُّ ②. وعلّتُه أنّ الوظيفةَ
      لولاه لَبقيت تمرّ على كلِّ حسابٍ غيرِ موثَّقٍ منذ افتُتحت المنصّةُ، في
      كلِّ دورة، إلى الأبد — استعلامٌ يكبر بعمر المنصّة ولا يجد أحدا. ومعناه
      في حقّ الناس أنّ «ثمّ يتوقّف، نهائيّا» تشمل من سجّل ونسي: بعد شهرٍ لا
      نطرق بابَه، وبابُ التوثيق يبقى مفتوحا في إعدادات حسابه متى شاء.

   ═══ والقناةُ تُسأل قبل الناس — وهذا أخطرُ سطرٍ في الوظيفة ═══

   كُتبت هذه الوظيفةُ أوّلَ مرّةٍ تمرّ على الحسابات ثمّ تسأل عن القناة عند
   الإرسال. وكشف النقضُ ما في ذلك: `issueEmailVerification` **تسكّ رمزا
   جديدا وتكتبه في الصفّ**، فتُبطل الرمزَ الذي قبله.

   فلو كانت قناةُ البريد مغلقةً لَدارت الوظيفةُ كلَّ ساعةٍ تسكّ رمزا لكلّ
   حسابٍ غيرِ موثَّقٍ ثمّ تسقط في الإرسال — **ورابطُ التوثيق الذي وصل صاحبَه
   ساعةَ سجّل يموت بعد ساعة**، لا بعد أربعٍ وعشرين. فيضغطه فيُقال له «غيرُ
   صالح» فيظنّ العطبَ فينا، ولا أحدَ يعلم لماذا.

   فالقناةُ تُسأل أوّلا (`liveChannels`)، وما لا بريدَ موصولَ له يخرج بلا أن
   يمسّ أحدا — وهو عرفُ `dispatchQueuedNotifications` نفسُه.

   ═══ ولمَ الصفُّ قبل الإرسال بعد ذلك ═══

   وقد صار الوصولُ إلى هنا يعني أنّ القناةَ موصولة، فسقوطُ الإرسال عندئذٍ
   عنوانٌ لا يقبل لا قناةٌ مقطوعة. والصفُّ يُكتب قبلَه بقصد: **محاولةٌ واحدةٌ
   لكلّ إنسانٍ لكلّ تذكير**. وبلا ذلك يُعاد الطرقُ على عنوانٍ يرتدّ كلَّ ساعة
   — وهو أقصرُ طريقٍ إلى أن يُعلَّم مُرسِلُنا في قوائم المنع، فنخسر بريدَ
   الشهادة والإيصال لمن لا ذنبَ له.

   والسقوطُ لا يُبتلع: يُعَدّ في `failed` ويظهر في خبر الدورة. */
const VERIFY_REMINDERS = [
  { key: 'account.verify.reminder.1', afterMs: DAY, last: false },
  { key: 'account.verify.reminder.2', afterMs: 4 * DAY, last: true },
] as const

/** بعد شهرٍ من إنشاء الحساب لا يُذكَّر — والحدُّ يمنع محاولةً أبديّةً على عنوانٍ لا يقبل */
const VERIFY_WINDOW_MS = 30 * DAY

export async function sendVerificationReminders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const notifications = new NotificationService(prisma)
  const auth = new AuthService(prisma)
  let done = 0
  let failed = 0
  const parts: string[] = []

  /* القناةُ قبل الناس — وإلّا أُبطلت رموزُ التوثيق القائمةُ كلَّ ساعة */
  if (!(await liveChannels(prisma)).includes('email')) {
    return {
      job: 'verify_reminders',
      summaryAr: 'قناة البريد غير موصولة — لا يذكّر أحد ولا يمسّ رمزه',
      done: 0, failed: 0, ms: Date.now() - started,
    }
  }

  for (const step of VERIFY_REMINDERS) {
    const candidates = await prisma.user.findMany({
      where: {
        emailVerifiedAt: null,
        /* الموقوفُ والمؤرشَفُ لا يُذكَّران بخطوةٍ لا تنفعهما */
        status: 'active',
        createdAt: {
          lte: new Date(now.getTime() - step.afterMs),
          gte: new Date(now.getTime() - VERIFY_WINDOW_MS),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: LIMITS.verifyReminders,
      select: { id: true },
    })

    let sent = 0
    for (const u of candidates) {
      const already = await prisma.notification.count({
        where: { userId: u.id, templateKey: step.key },
      })
      if (already > 0) continue

      /* رمزٌ جديدٌ لا القديم: صلاحيّةُ رمز التوثيق أربعٌ وعشرون ساعة
         (`mail-link-window.ts`)، والتذكيرُ الأوّلُ يقع في اليوم الثاني —
         فرابطٌ يُعاد إرسالُه ميّتٌ ساعةَ يصل، وهو أسوأُ من ألّا يصل. */
      let issued: { token: string; email: string; displayName: string } | null = null
      try {
        issued = await auth.issueEmailVerification(u.id)
      } catch {
        failed += 1
        continue
      }
      /* وثّق بين الاستعلام والإرسال */
      if (!issued) continue

      /* الجرسُ أوّلا — عَلَمُ «حُوول مرّةً»، فلا يُطرَق عنوانٌ يرتدّ كلَّ ساعة */
      try {
        await notifications.notify({
          userId: u.id, channel: 'in_app', templateKey: step.key,
          title: step.last ? 'تذكير أخير بتوثيق بريدك' : 'بقي توثيق بريدك',
          body: step.last
            ? 'أرسلنا رابطا جديدا إلى بريدك، وهذا آخر تذكير نرسله في هذا الشأن.'
            : 'أرسلنا رابطا جديدا إلى بريدك. والتوثيق مطلوب للشراء والشهادة.',
          audience: 'learner',
        })
      } catch {
        failed += 1
        continue
      }

      const mail = await sendVerifyReminderEmail(prisma, {
        to: issued.email, displayName: issued.displayName, token: issued.token, last: step.last,
      })
      if (mail.status === 'sent') { sent += 1; done += 1 } else { failed += 1 }
    }
    if (sent > 0) parts.push(`${step.last ? 'الأخير' : 'الأوّل'}: ${sent}`)
  }

  return {
    job: 'verify_reminders',
    summaryAr: (parts.length === 0 ? 'لا تذكير مستحقّا' : `ذكّر ${parts.join('، ')}`)
      + (failed > 0 ? ` · وسقط ${failed} عند المزوّد` : ''),
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ٢ج · ما يُفتح للمتعلّم يُقال له (٢٧ سبتمبر ٢٠٢٦) ═══════════

   المرحلة ٢(ب-٣). خطُّ المحاور يفتح الكرّاسةَ والمتنَ أوّلَ يوم الموعد،
   والمهامَّ بعد أوّل لقاءٍ للمحور (`cohort-gate.ts`). وما يُفتح ولا يُقال
   يُكتشف صدفة: من لم يفتح رحلتَه يومَ فُتحت مهمّتُه عرف بها يومَ فات موعدُها.

   فثلاثةُ أخبارٍ للمسجَّل في شعبةٍ على الخطّ (`timelineEvents`): فُتح موعد،
   وفُتحت مهامُّ محور، وآخرُ موعد مهمّةٍ لم يسلّمها خلال يوم. ولكلّ خبرٍ مفتاحٌ
   (`dedupe`) يُسأل عنه قبل الإرسال — فالدورةُ تمرّ كلَّ ربع ساعةٍ ولا يتكرّر.
   وهي في صنفٍ يُكتَم («ما يُفتح في شعبتي»): خبرٌ لا يترتّب عليه حقّ، والموعدُ
   باقٍ في رحلته على كلّ حال. وما اعتُمد بلا مواعيدَ لا أخبارَ خطٍّ له. */
export async function notifyTimeline(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const notifications = new NotificationService(prisma)
  let done = 0
  let failed = 0
  const sent = { slot_opened: 0, tasks_opened: 0, due_soon: 0 }

  const cohorts = await prisma.cohort.findMany({
    where: {
      status: { in: ['open', 'full', 'active'] },
      plans: { some: { trainerId: { not: null }, status: { in: [...PLAN_VISIBLE_STATUSES] } } },
    },
    take: LIMITS.timelineCohorts,
    select: {
      id: true, title: true, startsAt: true, endsAt: true,
      sessions: {
        where: LEARNER_SESSION_WHERE,
        select: { startsAt: true, endsAt: true, moduleId: true, moduleIds: true, placeholder: true, status: true },
      },
      plans: LEARNER_PLAN_QUERY,
      assessments: { where: { status: 'published' }, select: { id: true, title: true, moduleId: true, dueAt: true } },
      /* المسجَّلُ وحدَه: المنتظرُ لا وصولَ له، والمنسحبُ ترك، والمكتملُ فرغ */
      enrollments: {
        where: { status: 'enrolled' },
        select: { userId: true, submissions: { select: { assessmentId: true } }, attempts: { select: { assessmentId: true } } },
      },
    },
  })

  for (const c of cohorts) {
    const plan = c.plans[0] ?? null
    const gate = learnerGate({ content: plan?.content ?? null, cohort: c, sessions: c.sessions, now })
    const events = timelineEvents({ cohortId: c.id, gate, assessments: c.assessments, now })
    if (events.length === 0) continue
    const label = axisLabels(plan?.content)
    for (const ev of events) {
      const msg = timelineMessage(ev, { title: c.title, label, assessments: c.assessments, sessions: c.sessions, now })
      if (!msg) continue
      for (const e of c.enrollments) {
        /* «غدا» لمن لم يسلّم — من سلّم لا يُطالَب */
        if (ev.kind === 'due_soon'
          && (e.submissions.some((x) => x.assessmentId === ev.assessmentId) || e.attempts.some((x) => x.assessmentId === ev.assessmentId))) continue
        const already = await prisma.notification.count({
          where: { userId: e.userId, templateKey: msg.templateKey, data: { path: ['dedupe'], equals: ev.dedupe } },
        })
        if (already > 0) continue
        try {
          const row = await notifications.notify({
            userId: e.userId, channel: 'in_app', templateKey: msg.templateKey,
            title: msg.title, body: msg.body,
            data: { cohortId: c.id, dedupe: ev.dedupe, ...msg.data },
            audience: 'learner',
          })
          /* من كتم الصنفَ لا يُنشأ له صفّ (`null`) — فلا يُعدّ مرسَلا، ولا
             يُحسب في كلّ دورةٍ «إرسالا» لم يقع */
          if (row) {
            sent[ev.kind] += 1
            done += 1
          }
        } catch {
          failed += 1
        }
      }
    }
  }

  const parts = [
    sent.slot_opened ? `${sent.slot_opened} «فتح موعد»` : '',
    sent.tasks_opened ? `${sent.tasks_opened} «فتحت مهامّ»` : '',
    sent.due_soon ? `${sent.due_soon} «آخر موعد غدا»` : '',
  ].filter(Boolean)
  return {
    job: 'notify_timeline',
    summaryAr: parts.length ? `أرسل ${parts.join(' و')}` : 'لا جديد على خطوط المحاور',
    done, failed, ms: Date.now() - started,
  }
}

/** «المحور ٣: عنوانُه» — من ترتيب الخطّة، فيُسمّى المحورُ كما يراه المتعلّم */
function axisLabels(content: unknown): (moduleId: string) => string {
  const mods = ((content ?? null) as { modules?: { moduleId: string; titleAr?: string | null }[] } | null)?.modules ?? []
  const at = new Map(mods.map((m, i) => [m.moduleId, { n: i + 1, title: (m.titleAr ?? '').trim() }]))
  return (id) => {
    const m = at.get(id)
    if (!m) return 'المحور'
    return m.title ? `المحور ${m.n}: ${m.title}` : `المحور ${m.n}`
  }
}

/** نصُّ الخبر — ومفتاحُ قالبه مكتوبٌ حرفا ليقرأه حارسُ الأصناف */
function timelineMessage(
  ev: TimelineEvent,
  ctx: {
    title: string
    label: (moduleId: string) => string
    assessments: readonly { id: string; title: string; moduleId: string | null; dueAt: Date | null }[]
    sessions: readonly { startsAt: Date; endsAt: Date | null; moduleId: string | null; moduleIds: string[]; placeholder: boolean; status: string }[]
    now: Date
  },
): { templateKey: string; title: string; body: string; data: Record<string, string> } | null {
  if (ev.kind === 'slot_opened') {
    const next = ctx.sessions
      .filter((s) => !s.placeholder && s.status !== 'cancelled' && sessionEnd(s).getTime() > ctx.now.getTime())
      .filter((s) => (s.moduleIds.length ? s.moduleIds : s.moduleId ? [s.moduleId] : []).some((id) => ev.moduleIds.includes(id)))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
    return {
      templateKey: 'timeline.slot_opened',
      title: `فتح موعد جديد في «${ctx.title}»`,
      body: `${ev.moduleIds.map(ctx.label).join(' و')} — متنه وموضعه في الكرّاسة في رحلتك الآن.`
        + (next ? ` ولقاؤه المباشر ${whenAr(next.startsAt)}، وبعده تفتح مهامّه.` : ''),
      data: { slotStartsOn: ev.dedupe.split(':slot:')[1] ?? '' },
    }
  }
  if (ev.kind === 'tasks_opened') {
    const tasks = ctx.assessments.filter((a) => ev.assessmentIds.includes(a.id))
    const due = tasks.map((a) => a.dueAt).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime())[0]
    return {
      templateKey: 'timeline.tasks_opened',
      title: `فتحت مهامّ ${ctx.label(ev.moduleId)}`,
      body: `في «${ctx.title}»: ${tasks.map((a) => `«${a.title}»`).join('، ')}${due ? ` — آخر موعدها ${whenAr(due)}` : ''}. تجدها في «الواجبات».`,
      data: { moduleId: ev.moduleId },
    }
  }
  const task = ctx.assessments.find((a) => a.id === ev.assessmentId)
  if (!task) return null
  return {
    templateKey: 'timeline.due_soon',
    title: `آخر موعد لـ«${task.title}»: ${whenAr(ev.dueAt)}`,
    body: `في «${ctx.title}» — ولم تسلّمها بعد. وما يصل بعد موعده يقبل ويعلّم متأخّرا.`,
    data: { assessmentId: ev.assessmentId },
  }
}

/* ═══════════ انتهاءُ اللقاء — حالةٌ تُكتب لا تُستنتَج (٢٧ سبتمبر ٢٠٢٦) ═══════════

   `CohortSession.status` بقي `scheduled` إلى الأبد: لا سطرَ في الشيفرة يكتب
   `done` — وحدثُ Zoom «انتهى الاجتماع» يكتب الساعةَ ولا يكتب الحالة. فكان:
   · حضورُ كلّ متعلّمٍ صفرا (يُحسب على ما انعقد وحدَه)،
   · وتقريرُ «لقاءاتٌ انعقدت» للمدرّب صفرا،
   · وإيقاعُ المتعلّم في لوحته «٠ من ٨»،
   · وتذكيرُ «ارفع تسجيلَ لقائك» لا يصل، و«· انتهت» لا تُرى.

   فصار اللقاءُ المعتمَدُ الذي مضت نهايتُه `done` — بهذه الدورة، أو بحدث Zoom
   قبلها. والمبدئيُّ لا يُكتب منعقدا: مثالٌ لم يحضره أحد، ولو عُدّ لنقص به
   حضورُ كلّ متعلّم. ولا المنتظرُ ولا الملغى. ثمّ يُعاد حسابُ تقدّم من في
   الشعبة: الحضورُ صار يُحسب.

   واللقاءُ بلا نهايةٍ مكتوبةٍ ساعتان — أقلُّ لقاءٍ يُقبل (`session-length.ts`). */
export async function closeEndedSessions(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const ended = await prisma.cohortSession.findMany({
    where: {
      status: { in: ['scheduled', 'live'] },
      approvalState: 'approved',
      placeholder: false,
      cohort: { status: { not: 'cancelled' } },
      OR: [
        { endsAt: { lte: now } },
        { endsAt: null, startsAt: { lte: new Date(now.getTime() - MIN_SESSION_MS) } },
      ],
    },
    take: LIMITS.endedSessions,
    select: { id: true, cohortId: true },
  })
  if (ended.length === 0) {
    return { job: 'close_ended_sessions', summaryAr: 'لا لقاء انتهى', done: 0, failed: 0, ms: Date.now() - started }
  }
  /* والشرطُ يُعاد في الكتابة: حدثُ Zoom قد يسبق الدورةَ إلى اللقاء نفسِه */
  const { count } = await prisma.cohortSession.updateMany({
    where: { id: { in: ended.map((s) => s.id) }, status: { in: ['scheduled', 'live'] } },
    data: { status: 'done' },
  })
  const cohortIds = [...new Set(ended.map((s) => s.cohortId))]
  const { recomputed, failed } = await recomputeCohorts(prisma, cohortIds)
  return {
    job: 'close_ended_sessions',
    summaryAr: `انتهى ${count} لقاء في ${cohortIds.length} شعبة · وأعيد حساب تقدّم ${recomputed}`
      + (failed > 0 ? ` · وتعثّر ${failed}` : ''),
    done: count, failed, ms: Date.now() - started,
  }
}

/* ═══ التقدّمُ القديمُ الحساب (٢٧ أكتوبر ٢٠٢٦) ═══
   صار المقامُ محاورَ الخطّة، والنسبةُ المحفوظةُ قبلها تبقى حتّى يتحرّك التسجيل. فهذه
   تلحقها دفعةً دفعة (`ProgressService.refreshStale`)، ثمّ لا تجد شيئا. */
async function refreshProgressAxes(prisma: PrismaClient): Promise<JobResult> {
  const started = Date.now()
  const { recomputed, failed } = await new ProgressService(prisma).refreshStale(LIMITS.progressRefresh)
  return {
    job: 'refresh_progress_axes',
    summaryAr: recomputed + failed === 0
      ? 'لا تقدّم قديم الحساب'
      : `أعيد حساب تقدّم ${recomputed} تسجيل على محاور الخطّة` + (failed > 0 ? ` · وتعثّر ${failed}` : ''),
    done: recomputed, failed, ms: Date.now() - started,
  }
}

/** يعيد حسابَ تقدّم من له مقعدٌ في هذه الشعب — والقاعدةُ في `ProgressService.recomputeCohort` */
async function recomputeCohorts(prisma: PrismaClient, cohortIds: readonly string[]) {
  const progress = new ProgressService(prisma)
  let recomputed = 0
  let failed = 0
  for (const cohortId of cohortIds) {
    const r = await progress.recomputeCohort(cohortId)
    recomputed += r.recomputed
    failed += r.failed
  }
  return { recomputed, failed }
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
        /* ═══ والتذكيرُ بما يراه المتعلّمُ وحدَه (٢٧ سبتمبر ٢٠٢٦) ═══
           كان يُذكَّر بكلّ لقاءٍ في النافذة — ومنه ما ينتظر اعتمادَ الإدارة
           فلا يراه المتعلّمُ في صفحته، وما رُدّ فأُلغي. فيصله «جلستُك غدا»
           عن لقاءٍ لا وجودَ له عنده. والشرطُ شرطُ `LEARNER_SESSION_WHERE`. */
        approvalState: 'approved',
        status: { not: 'cancelled' },
      },
      take: LIMITS.reminders,
      select: {
        id: true, title: true, startsAt: true,
        zoom: { select: { joinUrl: true } },
        cohort: {
          select: {
            id: true, title: true,
            /* المسجَّلُ النشطُ وحدَه: من أسقط تسجيلَه لا يُذكَّر بجلسةٍ لا تخصّه */
            /* ── «enrolled» لا «active» ──

               كان الشرطُ `['active', 'completed']`، و`active` **ليست حالةَ
               تسجيلٍ أصلا**: حالاتُ التسجيل `enrolled | waitlisted |
               completed | dropped`. فالوظيفةُ كانت لا تجد أحدا — أي أنّ
               تذكيرَ الجلسات لم يكن ليصل إلى متعلّمٍ مسجَّلٍ واحد.

               ولم يكشفه اختبارُها لأنّ الاختبارَ كان يُنشئ تسجيلاتٍ بالحالة
               الخاطئة نفسِها: خطأٌ واحدٌ في موضعَين يُصدّق نفسَه. وكشفه
               قيدُ الحالات في القاعدة، لا القراءة.

               والمقصودُ من له مقعدٌ قائم: المسجَّلُ والمُكمِل — لا المنتظرُ
               في القائمة ولا من ترك. */
            enrollments: { where: { status: { in: ['enrolled', 'completed'] } }, select: { userId: true } },
            /* ── ومدرّبُ الشعبة ──

               كانت الوظيفةُ تمرّ على المسجَّلين وحدَهم: **الوحيدُ في القاعة
               الذي لا يُذكَّر هو من يُدرّسها.** ومَن ينسى حصّتَه يُغيّب معه
               كلَّ من دفع مقعدَه، فالكلفةُ عليه أكبرُ لا أصغر.

               و`userId` في ملفّ المدرّب اختياريّ: ملفٌّ بلا حسابٍ مربوطٍ
               لا يُنادى — لا صندوقَ له يصله فيه شيء. */
            trainers: { select: { profile: { select: { userId: true } } } },
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
            title: `جلستك ${window.labelAr}: ${s.cohort.title}`,
            body: `«${s.title}» تبدأ ${window.labelAr}.${s.zoom?.joinUrl ? ' رابط الانضمام في صفحة الجلسة.' : ' ولا رابط انضمام بعد — راجع الأكاديمية.'}`,
            data: { sessionId: s.id, cohortId: s.cohort.id, startsAt: s.startsAt.toISOString() },
            audience: 'learner',
          })
          sent += 1
          done += 1
        } catch {
          failed += 1
        }
      }

      /* والمدرّبُ بمفتاحٍ آخر — لا بمفتاح المتعلّم ──

         المفتاحُ مستقلٌّ لأنّ الصنفَ مستقلّ: تذكيرُ المتعلّم يُكتَم بإرادته
         (صنف «الجلسات»)، وتذكيرُ المدرّب عملٌ لا يُكتَم (صنف «عملي في
         الأكاديمية») — كما تقول القاعدةُ المكتوبةُ في
         `src/application/notifications/categories.ts`: «تكليفٌ لا يعلم به
         صاحبُه ليس تكليفا». ولو تقاسما مفتاحا واحدا لأسكت المدرّبُ حصّتَه
         وهو يظنّ أنّه يُسكت إشعارا عن نفسه. */
      for (const t of s.cohort.trainers) {
        const trainerId = t.profile.userId
        if (!trainerId) continue
        const already = await prisma.notification.count({
          where: { userId: trainerId, templateKey: window.trainerKey, data: { path: ['sessionId'], equals: s.id } },
        })
        if (already > 0) continue
        try {
          await notifications.notify({
            userId: trainerId, channel: 'in_app', templateKey: window.trainerKey,
            title: `جلستك التي تدرّسها ${window.labelAr}: ${s.cohort.title}`,
            body: `«${s.title}» تبدأ ${window.labelAr}.${s.zoom?.joinUrl ? ' رابط الانضمام في صفحة الجلسة.' : ' ولا رابط انضمام بعد — راجع الأكاديمية قبل موعدها.'}`,
            data: { sessionId: s.id, cohortId: s.cohort.id, startsAt: s.startsAt.toISOString() },
            audience: 'trainer',
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
    summaryAr: parts.length === 0 ? 'لا جلسة تستحقّ تذكيرا الآن' : `أنشئ ${parts.join(' و')}`,
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
      ? 'حالات الشعب مطابقة لتواريخها'
      : `حدّثت ${out.changes.length} شعبة: ${out.changes.slice(0, 3).map((c) => c.title).join('، ')}${out.changes.length > 3 ? '…' : ''}`,
    done: out.changes.length, failed: 0, ms: Date.now() - started,
  }
}

/* ═══════════ ٣أ · من ترك شعبتَه لا يبقى مسجَّلا عند Zoom ═══════════

   الإسقاطُ والانتقالُ يُلغيان تسجيلَ صاحبهما في اجتماعات شعبته المقبلة ساعتَها
   (`EnrollmentService.seatLeft`). وهذه الدورةُ لما فاتهما: Zoom لم يردّ يومها، أو
   ترك قبل أن يوجد الإلغاءُ أصلا — فبقي رابطُه الخاصُّ في بريده يُدخله لقاءاتٍ
   ليست له. والقاعدةُ واحدةٌ في الموضعين (`releaseSessionJoinLinks`). */
export async function revokeLeftRegistrants(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const out = await new CohortService(prisma).releaseSessionJoinLinks({}, now)
  const parts: string[] = []
  if (out.cancelled > 0) parts.push(`ألغي ${out.cancelled} تسجيلا لمن ترك شعبته`)
  if (out.failed > 0) parts.push(`وأبى Zoom ${out.failed}: ${out.reason}`)
  return {
    job: 'revoke_left_registrants',
    summaryAr: parts.length === 0 ? 'لا تسجيل قائما لمن ترك شعبته' : parts.join(' · '),
    done: out.cancelled, failed: out.failed, ms: Date.now() - started,
  }
}

/* ═══════════ ٣ب · حالاتُ الفصول بالتواريخ ═══════════

   كحالات الشعب سواءً، وبالتقسيم نفسِه: الفتحُ قرارٌ بشريّ، والانتهاءُ حقيقةُ
   تقويم. وكان حقلُ `status` في الفصل لا يكتبه شيءٌ أصلا — لا يدٌ ولا تقويم. */
export async function syncTermStatuses(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const terms = new TermService(prisma)
  const out = await terms.syncStatusesByDate(null, { apply: true, now })
  return {
    job: 'term_status_sync',
    summaryAr: out.changes.length === 0
      ? 'حالات الفصول مطابقة لتواريخها'
      : `حدّث ${out.changes.length} فصلا: ${out.changes.map((c) => `${c.titleAr} (${c.reason})`).join('، ')}`,
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
      blocked.push(e instanceof Error ? e.message.slice(0, 60) : 'سبب غير معروف')
    }
  }
  return {
    job: 'publish_scheduled_changes',
    summaryAr: due.length === 0
      ? 'لا نشر مجدول حلّ موعده'
      : `نشر ${done} من ${due.length}${blocked.length > 0 ? ` — ووقف ${blocked.length}: ${[...new Set(blocked)].join(' · ')}` : ''}`,
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ٦ · الاحتفاظُ: جداولُ السجلّ تُقلَّم بسياسةٍ معلنة ═══════════

   العطب: خمسةُ جداولٍ تنمو بلا حدٍّ ولا سياسة — سجلُّ الأثر، والإشعاراتُ
   المقروءة، وأحداثُ الاستخدام، ومحاولاتُ الدخول، وأحداثُ خطّافِ الدفع. ولا
   شيءَ يحذف منها صفّا واحدا أبدا. ومنصّةٌ في تجربةٍ لا تشعر بذلك؛ ومنصّةٌ
   عاملةٌ تكتب في `AnalyticsEvent` عشراتَ الصفوف لكلّ زائر، فتصير القاعدةُ
   بعد سنةٍ أكثرَها سجلٌّ لا يقرؤه أحد — ونسخُها الاحتياطيّ يثقل معها، وهو
   الأخطر: نسخةٌ تطول استعادتُها ساعاتٍ ليست نسخةً في وقت العطب.

   ولماذا مُدَدٌ مختلفة: **ما يُقرأ للحساب يُحفظ، وما يُقرأ للتشغيل يُقلَّم.**
   • سجلُّ الأثر (`AuditEvent`) سنتان — هو جوابُ «من غيّر هذا؟»، ولا سؤالَ
     عن فعلٍ عمرُه سنتان.
   • الإشعارُ المقروءُ تسعون يوما — قُرئ فأدّى غرضَه؛ والمنتظرُ في الطابور
     أو الفاشلُ **لا يُحذف بعمره** لأنّه عملٌ لم يتمّ.
   • أحداثُ الاستخدام (`AnalyticsEvent`) سنةٌ — تُقرأ اتّجاهاتٍ لا صفوفا.
   • محاولاتُ الدخول تسعون يوما — تُقرأ للحدّ من التكرار لا للتاريخ.
   • أحداثُ خطّافِ الدفع سنةٌ — دفترُ المال نفسُه في `Order` و`Payment` ولا
     يُمَسّ؛ هذه رسائلُ المزوّد التي بُنيت منها، تُحفظ سنةً للتسوية.

   والحدُّ في كلّ دورةٍ (`take`) مقصود: حذفُ مليون صفٍّ في معاملةٍ واحدةٍ
   يُقفل الجدولَ ويُوقف المنصّة. فتُقلَّم على دُفعاتٍ صغيرة، والدورةُ التالية
   تُكمل. */
export const RETENTION_DAYS = {
  audit: 730,
  notificationRead: 90,
  analytics: 365,
  loginAttempt: 90,
  registrationAttempt: 90,
  paymentWebhook: 365,
  /* ي-٦: ما خرج من طابور البريد يُقلَّم سريعا — وعدنا صاحبَه بمحوٍ كامل،
     فلا يبقى عنوانُه عندنا شهورا بعد أن أدّت الرسالةُ غرضَها. والمتنُ ممحوٌّ
     ساعةَ خرجت، فهذا تقليمُ ما بقي: أنّه أُخبِر ومتى. */
  outboxSent: 14,
  /* وما استنفد محاولاتِه يبقى أطولَ: إنسانٌ لم يُخبَر، وأحدٌ يجب أن يراه */
  outboxFailed: 90,
} as const

/** أقصى ما يُحذف من جدولٍ واحدٍ في الدورة — كي لا تُقفل معاملةٌ جدولا */
export const RETENTION_BATCH = 5_000

export async function enforceRetention(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const ago = (days: number) => new Date(now.getTime() - days * DAY)

  /** يحذف على دُفعةٍ واحدةٍ محدودة، ويعيد ما حُذف */
  const trim = async (
    labelAr: string,
    ids: () => Promise<{ id: string }[]>,
    del: (ids: string[]) => Promise<{ count: number }>,
  ): Promise<{ labelAr: string; count: number }> => {
    const rows = await ids()
    if (rows.length === 0) return { labelAr, count: 0 }
    const { count } = await del(rows.map((r) => r.id))
    return { labelAr, count }
  }

  const parts = await Promise.all([
    /* وأثرُ العقود والعروض يُستثنى: دليلٌ في نزاعٍ قد يقع بعد سنتين، ومُدَدُ
       التقادم العقديّة تتجاوزهما. والسببُ كاملا في `audit/retention.ts`. */
    trim('سجلّ الأثر',
      () => prisma.auditEvent.findMany({
        where: { createdAt: { lt: ago(RETENTION_DAYS.audit) }, ...notPermanentAuditWhere() },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.auditEvent.deleteMany({ where: { id: { in: ids } } })),
    /* المقروءُ وحدَه: المنتظرُ والفاشلُ عملٌ لم يتمّ فلا يُحذف بعمره */
    trim('إشعارات مقروءة',
      () => prisma.notification.findMany({
        where: { status: 'read', readAt: { lt: ago(RETENTION_DAYS.notificationRead) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.notification.deleteMany({ where: { id: { in: ids } } })),
    trim('بريد خرج',
      () => prisma.outboxMail.findMany({
        where: { status: 'sent', sentAt: { lt: ago(RETENTION_DAYS.outboxSent) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.outboxMail.deleteMany({ where: { id: { in: ids } } })),
    trim('بريد لم يصل',
      () => prisma.outboxMail.findMany({
        where: { status: 'failed', createdAt: { lt: ago(RETENTION_DAYS.outboxFailed) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.outboxMail.deleteMany({ where: { id: { in: ids } } })),
    trim('أحداث استخدام',
      () => prisma.analyticsEvent.findMany({
        where: { createdAt: { lt: ago(RETENTION_DAYS.analytics) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.analyticsEvent.deleteMany({ where: { id: { in: ids } } })),
    trim('محاولات دخول',
      () => prisma.loginAttempt.findMany({
        where: { createdAt: { lt: ago(RETENTION_DAYS.loginAttempt) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.loginAttempt.deleteMany({ where: { id: { in: ids } } })),
    trim('محاولات تسجيل',
      () => prisma.registrationAttempt.findMany({
        where: { createdAt: { lt: ago(RETENTION_DAYS.registrationAttempt) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.registrationAttempt.deleteMany({ where: { id: { in: ids } } })),
    trim('أحداث خطّاف الدفع',
      () => prisma.paymentWebhookEvent.findMany({
        where: { createdAt: { lt: ago(RETENTION_DAYS.paymentWebhook) } },
        select: { id: true }, take: RETENTION_BATCH,
      }),
      (ids) => prisma.paymentWebhookEvent.deleteMany({ where: { id: { in: ids } } })),
    /* وبصماتُ زوّار الروابط القصيرة تُمحى بعد يوم ويبقى عدُّها — العلّةُ في `link-opens.ts` */
    import('../services/link-opens').then(async (m) => ({ labelAr: 'بصمة زائر رابط', count: await m.forgetVisitors(prisma, now) })),
  ])

  const done = parts.reduce((a, p) => a + p.count, 0)
  const said = parts.filter((p) => p.count > 0).map((p) => `${p.count} ${p.labelAr}`)
  return {
    job: 'enforce_retention',
    summaryAr: done === 0 ? 'لا صفّ تجاوز مدّة حفظه' : `قلّم: ${said.join(' · ')}`,
    done, failed: 0, ms: Date.now() - started,
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
      ? 'لا صفّ منتهيا أقدم من ثلاثين يوما'
      : `حذف ${sessions.count} جلسة منتهية و${tokens.count} رمزا`,
    done: total, failed: 0, ms: Date.now() - started,
  }
}

/* ─────────── الطلباتُ المهجورة — ومقاعدُها ───────────

   الشراءُ نداءان: إنشاءُ الطلب (يحجز المقعد) ثمّ الدفع. ومن أغلق متصفّحَه
   بينهما — أو عدل عن الشراء في صفحة المزوّد — يترك طلبا «لم يُدفع» ومقعدا
   محجوزا. ولا شيءَ كان يمسّهما: خمسُ وظائفَ في المُشغِّل، **لا واحدةَ منها
   تعرف الطلبات ولا المقاعد**. فيعيش الطلبُ أبدا.

   وثمنُه مضاعف: **المقعدُ المحجوزُ يمنع صاحبَه من إعادة الشراء** — الشرطُ في
   `validatedCart` يردّ بـ٤٠٩ — فيبقى ينظر إلى «طلبٌ لم يكتمل دفعُه» في كلّ
   شاشةٍ ولا يستطيع أن يشتري ما أراده. ويمنع غيرَه كذلك: مقعدٌ محجوزٌ يُحتسب
   على السعة.

   ── والمهلةُ تتجاوز أطولَ صفحةِ دفعٍ حقيقيّة ──

   ساعةٌ لا دقائق: صفحاتُ المزوّدين المستضافة تحتمل تعثّرا وإعادةَ محاولةٍ
   وتحقّقا بنكيّا (3-D Secure). وإلغاءُ طلبٍ يدفعه صاحبُه في هذه اللحظة
   يسرق منه مقعدَه بعد أن دفع.

   ── وما لا يُلمس ──

   طلبٌ عليه **دفعةٌ ناجحة** لا يُلغى مهما طال: ماله وصل وإن تعثّرت التسوية،
   وإلغاؤه يمحو أثرَ ما دُفع. تلك حالةٌ تُقرأ بيدٍ لا تُنظَّف آليّا.

   ── والساعةُ لمن اشترى بنفسه، ويومان لما حجزه الفريق (١٩ أكتوبر ٢٠٢٦) ──

   من حجز له الفريقُ وهو غائبٌ يصله الخبرُ بريدا وقد يقرؤه بعد ساعات — والمهلتان وعلّتُهما في
   `commerce/seat-hold.ts`. والطلبُ الذي حجزه الفريقُ لا يُقرأ في الدفعة حتّى تنقضي مهلتُه: لو
   قُرئ ثمّ تُرك لملأت الطلباتُ المنتظِرةُ الدفعةَ (`LIMITS.cleanup`) وحجبت ما انقضى خلفها. */

export async function reclaimAbandonedOrders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const notifications = new NotificationService(prisma)
  const cutoff = new Date(now.getTime() - CHECKOUT_HOLD_MS)
  const teamCutoff = new Date(now.getTime() - TEAM_HOLD_MS)
  const teamHeld = [...await teamHeldOrderIds(prisma)]
  const stale = await prisma.order.findMany({
    where: {
      status: 'pending_payment',
      OR: [
        { createdAt: { lt: teamCutoff } },
        { createdAt: { lt: cutoff }, id: { notIn: teamHeld } },
      ],
    },
    include: { invoice: { include: { payments: { where: { status: 'succeeded' }, take: 1 } } } },
    take: LIMITS.cleanup,
    orderBy: { createdAt: 'asc' },
  })

  let done = 0
  let failed = 0
  let withPayment = 0
  let settled = 0
  let unreachable = 0
  const commerce = new CommerceService(prisma)
  for (const order of stale) {
    if ((order.invoice?.payments ?? []).length > 0) { withPayment++; continue }
    /* ═══ وصفحةُ دفعٍ ما زالت مفتوحة لا يُلغى طلبُها (٣١ أكتوبر ٢٠٢٦) ═══
       المهلةُ من إنشاء الطلب، و«أكمل الدفع» يفتح صفحةً جديدة: من ضغطه في الدقيقة الخامسة والخمسين كان طلبُه يُلغى بعد
       دقائق وصفحتُه مفتوحة. وصفحةُ Stripe تُغلق بعد ساعةٍ من فتحها (`expires_at`)، فما فُتح بعد حدّ المهلة ينتظر إغلاقَها. */
    if (order.invoice && await prisma.payment.count({
      where: { invoiceId: order.invoice.id, status: 'pending', createdAt: { gt: cutoff } },
    }) > 0) continue
    /* ═══ ويُسأل المزوّدُ قبل الإلغاء (٢٦ أكتوبر ٢٠٢٦) ═══

       «مهجورٌ» كان يعني «لم يصل حدثُ دفعه» — وحدثٌ لم يصل لا يعني أنّ البطاقة لم تُقتطع.
       فمن دفع وضاع حدثُه أُلغي طلبُه بعد ساعة. فيُسأل المزوّدُ عن صفحته أوّلا: دُفع ⇒ يُسوّى
       لا يُلغى، وتعذّر السؤال ⇒ لا يُلغى هذه الجولة (المالُ قبل المقعد)، ويُعاد في التالية. */
    try {
      if (await commerce.confirmWithProvider(order.id, null) === 'paid') { settled++; continue }
    } catch {
      unreachable++
      continue
    }
    try {
      let released = false
      const moved = await prisma.$transaction(async (tx) => {
        /* بشرطِ الحالة: صاحبُه قد يُلغيه أو يدفعه في اللحظة نفسِها — فلا يُلغى
           مدفوعٌ، ولا يُفرَج عن استعمالِ كوبونٍ مرّتين */
        const m = await tx.order.updateMany({ where: { id: order.id, status: 'pending_payment' }, data: { status: 'cancelled' } })
        if (m.count === 0) return false
        if (order.invoice) await tx.invoice.update({ where: { id: order.invoice.id }, data: { status: 'void' } })
        /* المقعدُ يعود إلى العدّ، والحجزُ يُفكّ عن الطلب فلا يبقى معلَّقا به */
        await tx.enrollmentRequest.updateMany({
          where: { orderId: order.id, status: 'seat_held' },
          data: { status: 'cancelled', orderId: null },
        })
        /* والكوبونُ يعود استعمالُه — الطلبُ المهجورُ لا يحرق الكود (`coupon-ledger.ts`) */
        released = await releaseCouponUse(tx, order)
        return true
      })
      if (!moved) continue
      await recordAudit(prisma, {
        actorId: null, action: 'order.cancel', entityType: 'order', entityId: order.id,
        meta: { userId: order.userId, total: String(order.total), currency: order.currency, ageMs: now.getTime() - order.createdAt.getTime(), couponReleased: released },
        reason: 'طلب مهجور لم يدفع — ألغي آليّا وأفرج عن مقاعده',
      })
      /* ═══ ويُقال لصاحبه (ي-٤) ═══

         وظيفةٌ لا إنسانٌ تُلغي طلبَه وتُفرج عن مقعده بعد ساعة، و`actorId`
         فوقُ `null` لأنّه فعلا لا فاعلَ له. وكان يقع صامتا تماما: يعود
         المشتري ليُتمّ دفعَه فيجد الطلبَ ذهب ولا يعرف لماذا ولا أنّ شيئا
         اقتُطع منه أو لم يُقتطع. والمعرّفُ كان في الحمولة فوقُ ولا يُستعمل. */
      try {
        await notifications.notify({
          userId: order.userId,
          channel: 'in_app',
          templateKey: 'order.cancelled_abandoned',
          title: 'ألغي طلبك الذي لم يكتمل دفعه',
          body: `ألغي طلبك (${order.total} ${order.currency}) لأنّه لم يدفع، وأفرج عن مقعده لغيرك. ولم يقتطع منك شيء — ويمكنك شراؤه من جديد متى شئت.`,
          data: { orderId: order.id },
          audience: 'learner',
        })
      } catch { /* الإشعارُ خدمةٌ مساندة — لا يُبطل إلغاءً وقع */ }
      done++
    } catch {
      /* صفٌّ تعذّر إلغاؤه لا يوقف أخواته — يُعدّ ويُقرأ في السجلّ */
      failed++
    }
  }

  const notes = (withPayment > 0 ? ` · ${withPayment} عليه دفعة ناجحة فلم يمسّ` : '')
    + (settled > 0 ? ` · ${settled} أكّد المزوّد دفعه فسوّي` : '')
    + (unreachable > 0 ? ` · ${unreachable} تعذّر سؤال المزوّد عنه فلم يلغ` : '')
  return {
    job: 'reclaim_abandoned_orders',
    summaryAr: done === 0 && failed === 0
      ? `لا طلب انقضت مهلة دفعه${notes}`
      : `ألغي ${done} طلبا مهجورا وأفرج عن مقاعدها${notes}`,
    done, failed, ms: Date.now() - started,
  }
}

/** الوظائفُ بأسمائها ودوراتِها — الترتيبُ ترتيبُ الأهمّيّة */
/* ─────────── مقابلاتُ Calendly: تُسأل ولا تُنتظَر ───────────

   ═══ العطبُ الذي كُتبت له ═══

   المزامنةُ كانت تنتظر webhook، والاشتراكُ فيه خلفَ خطّةٍ مدفوعةٍ لا يملكها
   حسابُ الأكاديميّة (١٢ سبتمبر ٢٠٢٦). فمن حجز مقابلتَه لم يظهر حجزُه في
   طابور المراجعة أصلا — لا تأخّرا، بل انقطاعا تامّا.

   والقراءةُ ليست خلفَ الخطّة، فصار العاملُ يسأل كلَّ خمس دقائق. والفارقُ عن
   الدفع دقائقُ في الظهور، لا أكثر — وحجزُ مقابلةٍ ليس فيه ما يُستعجَل.

   ═══ وثلاثةُ شروطِ هذا الملفّ محفوظة ═══

   ١) **تُعاد بلا ضرر**: لا علمَ يُخزَّن هنا. `handle` تُدخل متجاهلةً التكرار،
      والسؤالُ يُقصَر على ما لا نعرفه — فالاستقرارُ سؤالان لا أكثر.
   ٢) **محدودةُ الأثر**: سقفُ مواعيدَ في الدورة، ونافذةٌ ليومين لا للأبد.
   ٣) **تُخبر بالعربيّة**: وتقول حين يسقط النداءُ برمزه، فالرمزُ المنتهي
      صمتٌ تامٌّ لولا هذا السطر. */
const CALENDLY_LOOKBACK_MS = 2 * DAY
const CALENDLY_EVENT_CAP = 50

/* ─────────── ولماذا يُسمّى سببُ التجاوز ───────────

   كان الخبرُ يقول عددَ المواعيد ولا يقول لماذا لم يُطابَق أحدُها. وحُوول
   تشخيصُ حجزٍ حقيقيٍّ لم يصل الطابور (١٣ سبتمبر ٢٠٢٦) فلم يكن في السجلّ ما
   يُقرأ: العددُ وحدَه لا يفرّق بين بريدٍ مختلفٍ ورقمِ طلبٍ غائبٍ وحسابٍ خطإ.

   ═══ والمتجاوَزُ يُعَدّ إخفاقا لا لا-شيء ═══

   `runJob` لا تكتب أثرا إلّا إن كان `done` أو `failed` فوق الصفر. وحجزٌ
   حقيقيٌّ لم يُطابَق كان يُنتج صفرَين — فلا سطرَ في السجلّ أصلا، والمشغّلُ
   يرى صمتا لا خبرا. وهو **إخفاقٌ فعلا**: موعدٌ حجزه إنسانٌ ولم يبلغ طابورَ
   المراجعة، ويحتاج نظرَ إنسانٍ ليُدرَك. فيُعَدّ في `failed` ليُكتب. */
const CALENDLY_SKIP_AR: Record<string, string> = {
  no_reference: 'بلا رقم طلب في الحجز — حجز من Calendly مباشرة لا من الموقع',
  incomplete_payload: 'بيانات المدعوّ ناقصة',
  no_application: 'رقم الطلب والبريد معا لا يطابقان طلبا — أرجحه بريد مختلف عند الحجز',
  no_interview: 'إلغاء موعد غير مسجّل عندنا',
}

export async function syncCalendlyInterviews(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const job = 'calendly_interview_sync'
  const config = await getCalendlyConfig(prisma)
  /* ولا يكفي `enabled`: مفعَّلٌ بلا رمزٍ يعني سؤالا برمزٍ فارغٍ يردّ ٤٠١
     كلَّ خمس دقائقَ إلى الأبد — وهي الحالةُ التي يقع فيها من فعّل ثمّ نسي. */
  if (!config.enabled || !config.token) {
    return { job, summaryAr: 'لا رمز Calendly محفوظا — لا سؤال يرسل', done: 0, failed: 0, ms: Date.now() - started }
  }

  const since = new Date(now.getTime() - CALENDLY_LOOKBACK_MS)
  let events: CalendlyScheduledEvent[]
  try {
    const account = await calendlyAccount(config.token)
    events = await listCalendlyEvents(config.token, { organization: account.organization, minStartTime: since })
  } catch (e) {
    /* رمزٌ منتهٍ أو شبكةٌ ساقطة: يُقال ولا يُرمى — دورةٌ ساقطةٌ لا توقف
       العاملَ عن بقيّة وظائفه، وصفحةُ صحّةِ النظام تقرأ هذا السطر. */
    const why = e instanceof CalendlyApiError ? `ردّ ${e.status}` : 'خطأ شبكة'
    await recordCalendlySync(prisma, { at: now.toISOString(), events: 0, done: 0, skipped: 0, errorAr: why })
    return { job, summaryAr: `تعذّر سؤال Calendly (${why}) — لا مقابلة زيدت`, done: 0, failed: 1, ms: Date.now() - started }
  }

  /* ما نعرفه سلفا لا يُسأل عن مدعوّيه. وعنوانُ المدعوّ يبدأ بعنوان موعده
     (`…/scheduled_events/{ev}/invitees/{inv}`) فالمطابقةُ بالبادئة تكفي. */
  const known = await prisma.trainerInterview.findMany({
    where: { provider: 'calendly', scheduledAt: { gte: since } },
    select: { externalId: true, canceledAt: true },
  })

  let done = 0
  let failed = 0
  /* سببُ التجاوز وعددُه — يُقال في الخبر فيُشخَّص بلا سجلّ خادم */
  const skipped = new Map<string, number>()
  const calendly = new CalendlyWebhookService(prisma)
  for (const event of events.slice(0, CALENDLY_EVENT_CAP)) {
    const uri = typeof event.uri === 'string' ? event.uri : ''
    if (!uri) continue
    const record = known.find((k) => k.externalId?.startsWith(`${uri}/`))
    const canceled = event.status === 'canceled'
    /* معروفٌ وحالتُه مطابقة: لا سؤال. وما اختلفت حالتُه يُسأل — وبه يصل
       الإلغاءُ الذي وقع بعد الحجز. */
    if (record && (canceled ? !!record.canceledAt : !record.canceledAt)) continue
    try {
      for (const invitee of await listCalendlyInvitees(config.token, uri)) {
        const result = await calendly.handle(calendlyInviteeAsEvent(event, invitee))
        if (result.recorded || result.canceled) done += 1
        else if (result.ignored && result.reason && result.reason !== 'other_event') {
          skipped.set(result.reason, (skipped.get(result.reason) ?? 0) + 1)
        }
      }
    } catch { failed += 1 }
  }

  const skippedTotal = [...skipped.values()].reduce((a, b) => a + b, 0)
  /* النبضُ يُكتب في كلّ دورةٍ ناجحة — حتّى الفارغةَ منها. فدورةٌ تقرأ صفرَ
     مواعيدَ هي الإشارةُ إلى رمزٍ على حسابٍ غيرِ المضيف، ولا أثرَ لها في
     السجلّ لأنّها لم تعمل شيئا ولم يسقط لها شيء. */
  await recordCalendlySync(prisma, {
    at: now.toISOString(), events: events.length, done, skipped: skippedTotal,
  })
  const parts: string[] = []
  if (done > 0) parts.push(`${done} مقابلة حدّثت`)
  if (skippedTotal > 0) {
    const why = [...skipped.entries()].map(([r, n]) => `${n} — ${CALENDLY_SKIP_AR[r] ?? r}`).join(' · ')
    parts.push(`تجووز ${skippedTotal}: ${why}`)
  }

  return {
    job,
    summaryAr: `مزامنة Calendly من ${events.length} موعدا: ${parts.join(' · ') || 'لا جديد'}`,
    done,
    /* المتجاوَزُ في عداد الإخفاق ليُكتب الأثرُ — وعلّتُه فوق */
    failed: failed + skippedTotal,
    ms: Date.now() - started,
  }
}

/* ═══════════ ملخّصُ الإدارة: من أتمّ طلبَه ولم يحجز ═══════════

   تذكيرُ المتقدّم **يدويٌّ** بقرار صاحب المنصّة، ولا تُطارده آلة. وثمنُ
   ذلك أن يتذكّر الموظّفُ أن يفتح الطابور — فإن نسي أسبوعا وقف أربعةٌ
   ينتظرون رسالةً لا أحدَ يُرسلها. فهذه الوظيفةُ تُذكّر **الموظّفَ** وحدَه،
   ولا تمسّ بريدَ متقدّمٍ واحد.

   والشروطُ الثلاثةُ في رأس هذا الملفّ تقع هنا كما تقع على أخواتها:

   ① **تُعاد بلا ضرر** — أثرُ العمل هو المانع: صفُّ إشعارٍ بهذا المفتاح
      لهذا الموظّف في العشرين ساعةً الماضية يعني أنّ ملخّصَ اليوم خرج،
      فيُترَك. وعشرون ساعةً تسع نافذةَ الصباح كلَّها ولا تبلغ صباحَ الغد.
   ② **ومحدودةُ الأثر** — سقفٌ على من يُقرأ من الطابور، فلا تُقلع دورةٌ
      على قاعدةٍ ضخمةٍ فتقرأ كلَّ طلبٍ في التاريخ.
   ③ **وتُخبر بما فعلت** — ومن ذلك أن تقول حين تمتنع: ليس وقتَها، أو لا
      قناةَ بريد، أو لا متأخّرَ اليوم.

   والقرارُ **من يُعَدّ متأخّرا** ليس هنا بل في `unbooked-digest.ts`: هذا
   الاستعلامُ يقرّب الصفوفَ (حالةٌ تقبل الحجزَ وطلبٌ مكتمل) والوحدةُ تقرّر.
   ولو كُتب الشرطُ كاملا في SQL لَصار للقرار موضعان، وانحرف أحدُهما يوما
   بلا أن يُحمِّر شيئا — فالمقابلةُ القائمةُ والعتبةُ يُقاسان في الوحدة
   وحدَها، وهناك يُنقَضان. */

/** أدوارُ من يقرأ طابورَ الطلبات — وهي أدوارُ بريد «وصل طلبٌ جديد» نفسُها */
const DIGEST_ROLES = ['super_admin', 'academic_manager', 'operations_manager']

/** مفتاحُ القالب — وهو أثرُ «خرج ملخّصُ اليوم» أيضا */
const DIGEST_KEY = 'admin.trainer_unbooked'

/** نافذةُ «سبق اليومَ»: تسع الصباحَ كلَّه ولا تبلغ صباحَ الغد */
const DIGEST_WINDOW_MS = 20 * HOUR

export async function digestUnbookedApplicants(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const quiet = (summaryAr: string): JobResult => ({
    job: 'unbooked_digest', summaryAr, done: 0, failed: 0, ms: Date.now() - started,
  })

  /* الوقتُ يُسأل عنه في كلّ دورة: العاملُ يُقلع مع كلّ نشرة، ودورةٌ تُقاس
     بالساعات منذ إقلاعه تُرسل ملخّصَ الصباح عصرا لمن نشر ظهرا. */
  if (!isDigestHour(now)) return quiet('ليس وقت الملخّص — يخرج صباحا بتوقيت الأكاديمية')
  /* والقناةُ قبل الناس: بلا بريدٍ موصولٍ لا يُكتب صفٌّ يُحرق بمحاولةٍ فاشلة */
  if (!(await liveChannels(prisma)).includes('email')) {
    return quiet('قناة البريد غير موصولة — لا يخرج ملخّص إلى أحد')
  }

  const candidates = await prisma.trainerApplication.findMany({
    where: { status: { in: [...BOOKABLE_STATUSES] }, phase2CompletedAt: { not: null } },
    orderBy: { phase2CompletedAt: 'asc' },
    take: LIMITS.unbooked,
    select: {
      id: true, fullName: true, reference: true, status: true, phase2CompletedAt: true,
      _count: { select: { interviews: { where: LIVE_INTERVIEW } } },
    },
  })

  /* ومن ذُكِّر متى ذُكِّر — من الأثر لا من عمودٍ يُستحدَث. والأحدثُ أوّلا،
     فأوّلُ ما يُصادَف لكلّ طلبٍ هو آخرُ تذكيرٍ له. */
  const ids = candidates.map((c) => c.id)
  const reminders = ids.length === 0 ? [] : await prisma.auditEvent.findMany({
    where: { action: 'trainer.interview.remind', entityType: 'trainer_application', entityId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: { entityId: true, createdAt: true },
  })
  const lastRemind = new Map<string, Date>()
  for (const e of reminders) if (e.entityId && !lastRemind.has(e.entityId)) lastRemind.set(e.entityId, e.createdAt)

  const digest = unbookedDigest(
    candidates.map((c) => ({
      fullName: c.fullName,
      reference: c.reference,
      status: c.status,
      liveInterviews: c._count.interviews,
      completedAt: c.phase2CompletedAt,
      remindedAt: lastRemind.get(c.id) ?? null,
    })),
    now,
  )
  /* صباحٌ لا متأخّرَ فيه: لا رسالة. ورسالةٌ تقول «لا شيء» كلَّ يومٍ تُعلّم
     قارئَها أن يمرَّ عليها — فتضيع يومَ تحمل خبرا. */
  if (!digest) return quiet('لا متقدّم تأخّر عن حجز موعده')

  const holders = await prisma.userRole.findMany({
    where: { roleId: { in: DIGEST_ROLES }, user: { status: 'active' } },
    select: { userId: true },
  })
  const staff = [...new Set(holders.map((h) => h.userId))]
  if (staff.length === 0) return quiet(`${digest.count} لم يحجزوا — ولا حامل لأدوار المراجعة يصله الملخّص`)

  const notifications = new NotificationService(prisma)
  let done = 0
  let failed = 0
  let already = 0
  for (const userId of staff) {
    const sentToday = await prisma.notification.count({
      where: { userId, templateKey: DIGEST_KEY, queuedAt: { gte: new Date(now.getTime() - DIGEST_WINDOW_MS) } },
    })
    if (sentToday > 0) { already += 1; continue }
    try {
      const row = await notifications.notify({
        userId, channel: 'email', templateKey: DIGEST_KEY, audience: 'staff',
        title: digest.titleAr, body: digest.bodyAr,
        data: { count: digest.count, oldestDays: digest.oldestDays },
      })
      if (row?.status === 'sent') done += 1
      else failed += 1
    } catch {
      /* سقوطُ واحدٍ لا يمنع بقيّةَ الإدارة من قراءة الملخّص */
      failed += 1
    }
  }

  return {
    job: 'unbooked_digest',
    summaryAr: `${digest.titleAr} (أقدمهم ${digest.oldestAr})`
      + ` — وصل ${done} من الإدارة`
      + (failed > 0 ? `، وسقط ${failed} عند المزوّد` : '')
      + (already > 0 ? `، وسبق اليوم ${already}` : ''),
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ١٢ · عروضُ الإسناد وآجالُ الإعداد ═══════════

   ثلاثةُ آجالٍ كتبتها المنصّةُ ولا مُشغِّلَ لها: مهلةُ الردّ على عرضٍ تمرّ
   فيبقى «مفتوحا» أبدا، وأجلُ الإعداد يقترب بلا تذكير، ثمّ ينقضي بلا أن
   يعلم أحد.

   **ولا يُسحب إسنادٌ هنا.** شعبةٌ فيها متعلّمون دفعوا مقاعدَهم لا يُبَتّ
   أمرُها بمؤقّت: يُرفَع الخبرُ إلى إنسانٍ ينظر. وما يُغلَق آليّا هو
   العرضُ **قبل** القبول وحدَه — وذاك لا أثرَ له في تشغيلٍ ولا مال. */
export async function runTrainerOfferDeadlines(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const offers = new TrainerOfferService(prisma)
  let done = 0
  let failed = 0
  const parts: string[] = []
  /* وثلاثتُها مستقلّة: سقوطُ واحدةٍ لا يمنع أختَها — فأجلُ إعدادٍ ينقضي
     لا يُترك بلا خبرٍ لأنّ عرضا آخرَ تعثّر إشعارُه. */
  try {
    const { lapsed } = await offers.lapseExpiredOffers(now)
    done += lapsed
    if (lapsed > 0) parts.push(`أغلق ${lapsed} عرضا بانقضاء مهلته`)
  } catch { failed += 1; parts.push('تعثّر إغلاق العروض المنقضية') }
  try {
    const { reminded } = await offers.remindPrepDue(now)
    done += reminded
    if (reminded > 0) parts.push(`ذكّر ${reminded} بأجل إعداده`)
  } catch { failed += 1; parts.push('تعثّر تذكير آجال الإعداد') }
  try {
    const { raised } = await offers.lapsePrepDue(now)
    done += raised
    if (raised > 0) parts.push(`رفع ${raised} أجلا انقضى بلا إقرار إلى الإدارة`)
  } catch { failed += 1; parts.push('تعثّر رفع آجال الإعداد المنقضية') }
  return {
    job: 'trainer_offer_deadlines',
    summaryAr: parts.length === 0 ? 'لا عرض ولا أجل إعداد حلّ موعده' : parts.join(' · '),
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ ١٣ · مهلةُ العرض المشروط ═══════════

   مهلةُ سبعةِ أيّامٍ تُكتب في العقد عند تركيبه، ولا مُشغِّلَ لها: تقارب
   فينقضي يومُها بلا تذكير، ثمّ تنقضي بلا أن يعلم صاحبُها أنّ بابَه تغيّر.

   وهذا بعينه ما يجعل الحمايةَ تعمل **سواءٌ انتبهتَ أم لم تنتبه**: لا نقرةَ
   يتذكّرها إنسان، ولا مدرّبٌ يبقى في طورٍ انقضى وهو يظنّ أنّه فيه.

   **ولا يُغيَّر حالُ أحدٍ هنا.** «لم يستوفِ الشروط» وسمٌ محسوبٌ لا حالةٌ
   جديدة: لم ينتقل مكانا بل تأخّر في مكانه. فالعاملُ يُبلِّغ ويكتب أنّه
   أبلغ، والقرارُ بعده لإنسانٍ ينظر — يمدّد، أو يؤجّل، أو يحذف بطلبه.

   والثانيتان مستقلّتان: من انقضت مهلتُه لا يُترك بلا خبرٍ لأنّ تذكيرَ
   غيره تعثّر. */
export async function runConditionDeadlines(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const review = new TrainerReviewService(prisma)
  let done = 0
  let failed = 0
  const parts: string[] = []
  try {
    const { reminded } = await review.remindConditionDeadlines(now)
    done += reminded
    if (reminded > 0) parts.push(`ذكّر ${reminded} بقرب انقضاء مهلة موادّه`)
  } catch { failed += 1; parts.push('تعثّر تذكير المهل المقاربة') }
  try {
    const { noticed } = await review.noticeLapsedConditions(now)
    done += noticed
    if (noticed > 0) parts.push(`أبلغ ${noticed} بانقضاء مهلته`)
  } catch { failed += 1; parts.push('تعثّر إبلاغ المهل المنقضية') }
  return {
    job: 'condition_deadlines',
    summaryAr: parts.length === 0 ? 'لا مهلة عرض مشروط قاربت ولا انقضت' : parts.join(' · '),
    done, failed, ms: Date.now() - started,
  }
}

/* ═══════════ متابعةُ المؤجَّلين إلى الفصول القادمة (٦ أكتوبر ٢٠٢٦) ═══════════

   من حلّ موعدُ التواصل معه يُسأل بالبريد عن اهتمامه، ويُذكَّر الفريق — والعلّةُ في
   `src/application/trainer/deferral.ts` والعملُ في `trainer-deferral.service.ts`.
   ولا يُسأل أحدٌ مرّتين: «سُئل» يُكتب بكتابةٍ مشروطةٍ قبل البريد. */
export async function runDeferralFollowups(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { asked, mailFailed } = await new TrainerDeferralService(prisma).askDue(now)
  return {
    job: 'deferral_followups',
    summaryAr: asked === 0
      ? 'لا مؤجّل حلّ موعد التواصل معه'
      : `سئل ${asked} عن اهتمامه بالفصول القادمة` + (mailFailed > 0 ? `، ولم يخرج البريد إلى ${mailFailed} — وأبلغ الفريق ليتواصل بنفسه` : ''),
    done: asked - mailFailed, failed: mailFailed, ms: Date.now() - started,
  }
}

/* ═══ تذكيرُ مدرّبي الشعبة المنقولة قبل فصلها الجديد بشهر (١٧ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة والعلّةُ في `src/application/trainer/cohort-move.ts`، والعملُ في
   `CohortMoveService.remindDue`. ولا يُذكَّر أحدٌ مرّتين. */
export async function runCohortMoveReminders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { CohortMoveService } = await import('../services/cohort-move.service')
  const { reminded } = await new CohortMoveService(prisma).remindDue(now)
  return {
    job: 'cohort_move_reminders',
    summaryAr: reminded === 0 ? 'لا شعبة منقولة اقترب فصلها' : `ذكّر مدرّبو ${reminded} شعبة منقولة بمراجعتها قبل فصلها`,
    done: reminded, failed: 0, ms: Date.now() - started,
  }
}

/* ═══ «انشر دورتك الآن» — قبل بدء الشعبة بأسبوع (٢٧ أكتوبر ٢٠٢٦) ═══
   اقترحه Claude فقال صاحبُ المنصّة: «كلّهم». العلّةُ في `share-reminder.service.ts`. ولا يُذكَّر أحدٌ بشعبةٍ مرّتين. */
export async function runShareReminders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { ShareReminderService } = await import('../services/share-reminder.service')
  const { reminded, skipped, failed } = await new ShareReminderService(prisma).remindDue(now)
  return {
    job: 'share_reminders',
    summaryAr: reminded + failed === 0
      ? (skipped > 0 ? `لا تذكير — تخطى ${skipped} شعبة فاتها الأسبوع أو بلا مدرب نشط` : 'لا شعبة تبدأ بعد أسبوع لم يذكر مدربها')
      : `ذكّر ${reminded} مدربا بنشر شعبته قبل بدئها` + (failed > 0 ? `، ولم يخرج البريد إلى ${failed}` : ''),
    done: reminded, failed, ms: Date.now() - started,
  }
}

/* ═══ اقتراحُ تأجيلٍ مضت مهلتُه بلا ردّ — توقف شعبتُه (٢٤ أكتوبر ٢٠٢٦) ═══
   «مع إعلامه بأنّه سيتمّ توقيفُ الشعبة تلقائيّا» (صاحب المنصّة). العلّةُ في `cohort-postpone.service.ts`. */
export async function runCohortPostponeExpire(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { CohortPostponeService } = await import('../services/cohort-postpone.service')
  const { expired, withdrawn } = await new CohortPostponeService(prisma).expireDue(now)
  return {
    job: 'cohort_postpone_expire',
    summaryAr: expired + withdrawn === 0 ? 'لا اقتراح تأجيل مضت مهلته'
      : `أوقف ${expired} شعبة لم يرد مدربها على التأجيل${withdrawn ? `، وسحب ${withdrawn} اقتراحا بدأت شعبته أو ألغيت` : ''}`,
    done: expired + withdrawn, failed: 0, ms: Date.now() - started,
  }
}

/* ═══ لقاءاتُ الشعب الملغاة والمؤجَّلة تُرفع من التقاويم (٢٦ أكتوبر ٢٠٢٦) ═══
   العلّةُ في `SessionInviteService.withdrawCohort`. يرفع ما أُلغي قبل الإصلاح، وما أُلغي بغير بابه. */
export async function runVoidedSessionInvites(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { SessionInviteService } = await import('../services/session-invite.service')
  const { cohorts, sessions } = await new SessionInviteService(prisma).sweepVoided(now)
  return {
    job: 'voided_session_invites',
    summaryAr: sessions === 0 ? 'لا لقاء ملغى باق في التقاويم' : `رفع ${sessions} لقاء من التقاويم في ${cohorts} شعبة ملغاة أو مؤجلة`,
    done: sessions, failed: 0, ms: Date.now() - started,
  }
}

/* ═══ اجتماعاتُ Zoom للشعب الملغاة تُحذف (٢٨ أكتوبر ٢٠٢٦) ═══
   العلّةُ في `CohortService.dropCancelledMeetings`. يلحق ما أُلغي قبل الإصلاح، وما أبى فيه Zoom. */
export async function runCancelledCohortMeetings(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { CohortService } = await import('../services/cohort.service')
  const { deleted, failed } = await new CohortService(prisma).dropCancelledMeetings(null, { now })
  return {
    job: 'cancelled_cohort_meetings',
    summaryAr: deleted + failed === 0 ? 'لا اجتماع لشعبة ملغاة'
      : `حذف ${deleted} اجتماعا لشعب ملغاة من Zoom${failed ? ` · وتعذّر ${failed}` : ''}`,
    done: deleted, failed, ms: Date.now() - started,
  }
}

/* ═══ تقاويمُ المدرّبين (٢٧ أكتوبر ٢٠٢٦) ═══
   لم تكن تصل المدرّبَ دعوةٌ قطّ. فمن أُسند إلى شعبةٍ قبل هذا اليوم يصله جدولُ ما بقي من لقاءاتها مرّةً،
   ومن فاته جدولُه بخطأٍ ابتُلع، ومن رُفع إيقافُه. وموقوفٌ بقي جدولُ شعبه في تقويمه تُرفع منه لقاءاتُها.
   والعلّةُ في `SessionInviteService.sweepTrainerCalendars`. */
export async function runTrainerCalendars(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { SessionInviteService } = await import('../services/session-invite.service')
  const { links, mails, held, withdrawn } = await new SessionInviteService(prisma).sweepTrainerCalendars(now)
  const said = [
    ...(links > 0 ? [`أرسل إلى المدربين ${mails} جدول لقاءات`] : []),
    ...(held > 0 ? [`رفع ${withdrawn} لقاء من تقويم مدرب موقوف`] : []),
  ]
  return {
    job: 'trainer_calendars',
    summaryAr: said.length === 0 ? 'كل مدرب وصله جدول شعبه' : said.join('، و'),
    done: links + held, failed: 0, ms: Date.now() - started,
  }
}

/* ═══ تقويمُ من أُغلق حسابُه أو عاد (٢٨ أكتوبر ٢٠٢٦) ═══
   حسابٌ أُوقف أو أُرشف أو عاد بغير باب `AuthService` — إيقافُ التدريب ورفعُه، وإعادةُ المؤسِّسين عند الإقلاع، ومحوُ
   الحسابات — وما أُغلق قبل هذا اليوم، وما فات بابَه بخطأٍ ابتُلع. والعلّةُ في `AccountCalendarService`. */
export async function runAccountCalendars(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { AccountCalendarService } = await import('../services/account-calendar.service')
  const { closed, reopened } = await new AccountCalendarService(prisma).sweep(now)
  const said = [
    ...(closed > 0 ? [`رفع من التقاويم لقاءات ${closed} حساب مغلق`] : []),
    ...(reopened > 0 ? [`أعاد إلى التقاويم لقاءات ${reopened} حساب عاد`] : []),
  ]
  return {
    job: 'account_calendars',
    summaryAr: said.length === 0 ? 'لا حساب مغلق بقيت لقاءاته في تقويمه' : said.join('، و'),
    done: closed + reopened, failed: 0, ms: Date.now() - started,
  }
}

/* ═══ فصولُ الشعب التي سقطت «بلا فصل» (١٨ أكتوبر ٢٠٢٦) ═══
   العلّةُ في `server/services/term-ensure.ts`. يملأ ما سقط قبل الإصلاح، ويلتقط ما يفلت بعده. */
export async function runAssignMissingTerms(prisma: PrismaClient): Promise<JobResult> {
  const started = Date.now()
  const { assignMissingTerms } = await import('../services/term-ensure')
  const assigned = await assignMissingTerms(prisma)
  return {
    job: 'assign_missing_terms',
    summaryAr: assigned === 0 ? 'لا شعبة بلا فصل يعرف موسمها' : `سمّى فصل ${assigned} شعبة`,
    done: assigned, failed: 0, ms: Date.now() - started,
  }
}

/* ═══ حالةٌ لم يسجّل مستشارُها تواصلا، ومتابعةٌ حلّ موعدُها (١٩ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة والأرقامُ في `src/application/advisor/contact-sla.ts`، والعملُ في
   `AdvisorService#remindDue`. ولا يُذكَّر أحدٌ مرّتين: كلُّ تذكيرٍ يُختم قبل جرسه. */
export async function runAdvisorReminders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { AdvisorService } = await import('../services/advisor.service')
  const { AdvisorAwayService } = await import('../services/advisor-away.service')
  /* الغطاءُ قبل التذكير: من ينتظر أوّلَ تواصلٍ من مستشارٍ في إجازته يُنقل أوّلا، فلا يُذكَّر الغائبُ به */
  const { moved: covered } = await new AdvisorAwayService(prisma).coverAway(now)
  const { reminded, escalated, followUps } = await new AdvisorService(prisma).remindDue(now)
  const parts = [
    covered > 0 ? `نقل من مستشار في إجازة: ${covered}` : '',
    reminded > 0 ? `تذكير بالتواصل: ${reminded}` : '',
    escalated > 0 ? `إبلاغ من يسند بحالة بلا تواصل منذ يومين: ${escalated}` : '',
    followUps > 0 ? `تذكير بمتابعة حلّ موعدها: ${followUps}` : '',
  ].filter(Boolean)
  return {
    job: 'advisor_reminders',
    summaryAr: parts.length === 0 ? 'لا حالة تنتظر تواصلا ولا متابعة حلّ موعدها' : parts.join(' · '),
    done: covered + reminded + escalated + followUps, failed: 0, ms: Date.now() - started,
  }
}

/** كشوفُ عمولة المستشارين للشهر الذي انتهى — والعلّةُ في `advisor-payout.service.ts` */
export async function runAdvisorPayouts(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { AdvisorPayoutService, lastClosedPeriod } = await import('../services/advisor-payout.service')
  const { created } = await new AdvisorPayoutService(prisma).generate(lastClosedPeriod(now), null, now)
  return {
    job: 'advisor_payouts',
    summaryAr: created === 0 ? 'لا كشف عمولة جديد' : `ولد ${created} كشف عمولة`,
    done: created, failed: 0, ms: Date.now() - started,
  }
}

/** من عبّأ نموذج المنحة ولم يشترِ بعد ساعة — حالةٌ عند مستشار ومكالمةٌ خلال ساعتين، مرّةً لكلّ عميل (`grant-followup.service.ts`) */
export async function runGrantFollowups(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { openGrantFollowups } = await import('../services/grant-followup.service')
  const { opened } = await openGrantFollowups(prisma, now)
  return {
    job: 'grant_followup',
    summaryAr: opened === 0 ? 'لا أحد من نموذج المنحة ينتظر متابعة' : `فتحت ${opened} حالة متابعة لمن عبأ نموذج المنحة ولم يشتر`,
    done: opened, failed: 0, ms: Date.now() - started,
  }
}

/** من أخذ كود المنحة ولم يشترِ — بريدٌ قبل انتهائها بثلاثة أيّامٍ وفي آخر يوم، مرّةً لكلٍّ (`grant-followup.service.ts`) */
export async function runGrantReminders(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { applyGrantCloseFix, applyGrantCoursesFix, sendGrantReminders } = await import('../services/grant-followup.service')
  const { seedGrantAdvisorWhatsApp } = await import('../services/integrations.service')
  /* آخرُ يومٍ ٣٠ أكتوبر، والحدُّ ٤ دورات — بقرار صاحب المنصّة، قبل التذكير فيتبع التذكيرُ اليومَ الصحيح.
     ورقمُ مستشار المنحة على واتساب — والعاملُ يدور بكلّ وظائفه حين يبدأ، فيُكتب أوّلَ ما يُنشر */
  const fixed = await applyGrantCloseFix(prisma)
  const limited = await applyGrantCoursesFix(prisma)
  const seeded = await seedGrantAdvisorWhatsApp(prisma)
  /* ولكلّ حملةٍ بنهايتها: «منحة وجيز» و«منحة مؤثرين وجيز» (٢٦ أكتوبر ٢٠٢٦) */
  const members = await sendGrantReminders(prisma, now)
  const influencers = await sendGrantReminders(prisma, now, INFLUENCER_GRANT_SLUG)
  const sent = members.sent + influencers.sent
  const stage = members.stage ?? influencers.stage
  const mailOff = members.mailOff || influencers.mailOff
  return {
    job: 'grant_reminders',
    summaryAr: (fixed ? 'صار آخر يوم للمنحة 30 أكتوبر · ' : '') + (limited ? 'صار حد المنحة 4 دورات · ' : '')
      + (seeded ? 'ضبط رقم واتساب مستشار المنحة · ' : '') + (mailOff
      ? 'حلّ تذكير المنحة وقناة البريد غير موصولة — لا يذكّر أحد حتى توصل'
      : sent === 0 ? 'لا تذكير منحة مستحق' : `ذكّر ${sent} ممن لم يشتر بأن المنحة تنتهي (${stage === '1d' ? 'آخر يوم' : 'قبل ثلاثة أيام'})`),
    done: sent + (fixed ? 1 : 0) + (limited ? 1 : 0) + (seeded ? 1 : 0), failed: 0, ms: Date.now() - started,
  }
}

/* ═══ تصحيحُ شعبٍ بقرار صاحب المنصّة — مرّةً واحدة لكلٍّ (١٩ أكتوبر ٢٠٢٦) ═══

   «استراتيجية التسعير — شعبة ٤» نُقلت إلى «موسم الشتاء 2027» — وكان الاسمُ يعني نوفمبر 2027 إلى يناير 2028 ويُقرأ
   الشتاءَ القادم — فصار أوّلُ لقائها 30 نوفمبر 2027. واختار صاحبُ المنصّة: «Move to coming winter». فتُنقل بالنقل نفسِه
   الذي يمرّ به طلبُ المدرّب (`staffMove`): تُزاح مواعيدُها ولقاءاتُها بأسابيعَ كاملة، ويتحدّث Zoom والدعوات، وتُبلَّغ
   مدرّبتُها. والقرارُ باسم من اعتمد النقلَ الأوّل.

   ولا يقع إلّا مرّة: يُشترط أن يكون أوّلُ لقائها ما زال الموعدَ المنقولَ إليه خطأ. فإن تحرّك — بهذا التصحيح أو بغيره —
   لم يُمسّ. */
export interface CohortCorrection { cohortId: string; firstAt: string; to: { year: number; season: string }; reasonAr: string }
export const COHORT_CORRECTIONS: CohortCorrection[] = [{
  cohortId: 'f0025a7b-1437-4d17-b8b5-b633bd9b5045',
  firstAt: '2027-11-30T15:00:00.000Z',
  to: { year: 2026, season: 'nov_jan' },
  reasonAr: 'نقلت إلى موسم الشتاء 2027/2028 باسم ملتبس، ومقصودها الشتاء القادم — بقرار صاحب المنصة.',
}]

export async function runCohortCorrections(prisma: PrismaClient): Promise<JobResult> {
  return applyCohortCorrections(prisma, COHORT_CORRECTIONS)
}

/** يطبّق قائمةَ تصحيحاتٍ — والوظيفةُ تمرّر قائمتَها، والاختبارُ قائمتَه */
export async function applyCohortCorrections(prisma: PrismaClient, list: CohortCorrection[]): Promise<JobResult> {
  const started = Date.now()
  const { CohortMoveService } = await import('../services/cohort-move.service')
  const moves = new CohortMoveService(prisma)
  let done = 0
  let failed = 0
  for (const c of list) {
    const first = await prisma.cohortSession.findFirst({
      where: { cohortId: c.cohortId, status: { notIn: ['cancelled'] } }, orderBy: { startsAt: 'asc' }, select: { startsAt: true },
    })
    if (!first || first.startsAt.toISOString() !== c.firstAt) continue
    const decidedBy = (await prisma.cohortMoveRequest.findFirst({
      where: { cohortId: c.cohortId, status: 'approved', reviewedBy: { not: null } }, orderBy: { reviewedAt: 'desc' }, select: { reviewedBy: true },
    }))?.reviewedBy
    if (!decidedBy) { failed += 1; continue }
    try {
      await moves.staffMove(decidedBy, c.cohortId, { toYear: c.to.year, toSeason: c.to.season, reason: c.reasonAr })
      done += 1
    } catch (e) {
      console.error('[cohort_corrections] تعذّر تصحيح شعبة', c.cohortId, e)
      failed += 1
    }
  }
  return {
    job: 'cohort_corrections',
    summaryAr: done === 0 && failed === 0 ? 'لا شعبة تنتظر تصحيحا' : `صحح موعد ${done} شعبة${failed ? `، وتعذر ${failed}` : ''}`,
    done, failed, ms: Date.now() - started,
  }
}

/* ═══ ملفٌّ من شعبةٍ أخرى في خطّةٍ أو مهمّة — يُنسخ إلى شعبته (٢٤ أكتوبر ٢٠٢٦) ═══
   الحفظُ يسأل لمن الملفُّ منذ اليوم (`cohort-file-adopt.ts`)، وهذه لما كُتب قبله: خطّةٌ في أيّ حال — مسودّةً
   أو بانتظار القرار أو معتمَدة — ومهمّةٌ ومرفقاتُها وما طُلب عليها. وتُعاد بلا ضرر: النسخةُ بمفتاحٍ مشتقّ،
   فدورةٌ ثانيةٌ تجد كلَّ شيءٍ في شعبته ولا تعمل شيئا. */
export const ADOPT_BATCH = 50

export async function runAdoptForeignFiles(prisma: PrismaClient): Promise<JobResult> {
  const started = Date.now()
  const { adoptCohortFiles } = await import('../services/cohort-file-adopt')
  const { planFileKeys } = await import('../../src/application/trainer/plan-copy')
  const [plans, tasks] = await Promise.all([
    prisma.cohortDeliveryPlan.findMany({
      where: { trainerId: { not: null }, status: { not: 'superseded' } },
      select: { id: true, cohortId: true, content: true, returnedContent: true },
    }),
    prisma.cohortAssessment.findMany({ select: { id: true, cohortId: true, attachments: true, pendingChange: true } }),
  ])
  const rows = [
    ...plans.map((p) => ({ kind: 'plan' as const, id: p.id, cohortId: p.cohortId, keys: planFileKeys({ a: p.content, b: p.returnedContent }) })),
    ...tasks.map((t) => ({ kind: 'task' as const, id: t.id, cohortId: t.cohortId, keys: planFileKeys({ a: t.attachments, b: t.pendingChange }) })),
  ].filter((r) => r.keys.length > 0)
  const owners = new Map((await prisma.cohortFile.findMany({
    where: { storageKey: { in: [...new Set(rows.flatMap((r) => r.keys))] } }, select: { storageKey: true, cohortId: true },
  })).map((f) => [f.storageKey, f.cohortId]))
  const astray = rows.filter((r) => r.keys.some((k) => owners.has(k) && owners.get(k) !== r.cohortId)).slice(0, ADOPT_BATCH)

  let files = 0
  let fixed = 0
  let failed = 0
  for (const r of astray) {
    try {
      if (r.kind === 'plan') {
        const p = plans.find((x) => x.id === r.id)!
        const a = await adoptCohortFiles(prisma, r.cohortId, p.content, 'system')
        const b = await adoptCohortFiles(prisma, r.cohortId, p.returnedContent, 'system')
        if (a.adopted + b.adopted === 0) continue
        await prisma.cohortDeliveryPlan.update({
          where: { id: r.id },
          data: {
            ...(a.adopted ? { content: a.value as Prisma.InputJsonValue } : {}),
            ...(b.adopted ? { returnedContent: b.value as Prisma.InputJsonValue } : {}),
          },
        })
        files += a.adopted + b.adopted
      } else {
        const t = tasks.find((x) => x.id === r.id)!
        const a = await adoptCohortFiles(prisma, r.cohortId, t.attachments, 'system')
        const b = await adoptCohortFiles(prisma, r.cohortId, t.pendingChange, 'system')
        if (a.adopted + b.adopted === 0) continue
        await prisma.cohortAssessment.update({
          where: { id: r.id },
          data: {
            ...(a.adopted ? { attachments: a.value as Prisma.InputJsonValue } : {}),
            ...(b.adopted ? { pendingChange: b.value as Prisma.InputJsonValue } : {}),
          },
        })
        files += a.adopted + b.adopted
      }
      fixed += 1
    } catch (e) {
      console.error('[adopt_foreign_files] تعذر نسخ ملفات', r.kind, r.id, e)
      failed += 1
    }
  }
  return {
    job: 'adopt_foreign_files',
    summaryAr: fixed === 0 && failed === 0 ? 'كل ملفات الخطط والمهام في شعبها' : `نسخ ${files} ملف إلى شعبته في ${fixed} خطة أو مهمة${failed ? `، وتعذر ${failed}` : ''}`,
    done: fixed, failed, ms: Date.now() - started,
  }
}

/** بياناتُ من لم يسجّل تُمحى بعد ستة أشهر بلا نشاط — والعلّةُ في `guest-erasure.service.ts` */
export async function runEraseIdleGuests(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { eraseIdleGuests } = await import('../services/guest-erasure.service')
  const { erased } = await eraseIdleGuests(prisma, now)
  return {
    job: 'erase_idle_guests',
    summaryAr: erased === 0 ? 'لا أحد لم يسجل مرت عليه ستة أشهر بلا نشاط' : `محيت بيانات ${erased} لم يسجلوا`,
    done: erased, failed: 0, ms: Date.now() - started,
  }
}

/** اسمُ مدرّب كلّ شعبةٍ معروضةٍ يُنشر — يلحق ما فُتح قبل قرار ٢٠ أكتوبر وما أُضيف بعد الفتح (`trainer-auto-publish.ts`).
    وقبله يُفعَّل من في الطور وله دورةٌ معتمَدة («one cohort is enough»، ٢٠ أكتوبر ٢٠٢٦، `activateQualifiedOnboarding`):
    النشرُ لا يمسّ من لم ينشط، فلو بقي في الطور بقيت شعبُه تُباع بلا اسمه. والمانعُ يُقال للإدارة مرّةً في الأسبوع.
    ويُوقَّع معه عقدُ النشط المعتمَدُ كالعقود الجديدة وقد اعتُمدت له دورةٌ بعد اعتماد توقيعه («sign active trainers'
    contracts at first course»، ٢٠ أكتوبر ٢٠٢٦، `sealFirstCourseActive`). */
export async function runPublishLiveTrainers(prisma: PrismaClient, now = new Date()): Promise<JobResult> {
  const started = Date.now()
  const { TrainerPrepService } = await import('../services/trainer-prep.service')
  const prep = new TrainerPrepService(prisma)
  const { activated, blocked: notActivated } = await prep.activateQualifiedOnboarding()
  /* ثمّ من توقيعُه معتمَدٌ يصير نشطا — «تهيئة» أُلغيت (٢١ أكتوبر ٢٠٢٦، `activateSignatureApproved`).
     وبعد التفعيل بالشعبة المعتمَدة لا قبله: ذاك يفعّله ويوقّع عقدَه معا، وهذا يفعّله ويترك التوقيعَ لأوّل شعبة */
  const moved = await prep.activateSignatureApproved()
  const { sealed, blocked: notSealed } = await prep.sealFirstCourseActive()
  const blocked = notActivated + notSealed
  const { publishCohortTrainers } = await import('../services/trainer-auto-publish')
  const { published, notActive } = await publishCohortTrainers(prisma, { actorId: null, now })
  const parts = [published.length === 0 ? 'كل مدربي الشعب المعروضة ظاهرون' : `نشر اسم ${published.length} مدرب`]
  if (sealed.length > 0) parts.unshift(`وقع عقد ${sealed.length} مدرب نشط اعتمدت خطة شعبته`)
  if (activated.length > 0) parts.unshift(`فعّل ${activated.length} مدرب اعتمدت خطة شعبته`)
  if (moved.reopened.length > 0) parts.unshift(`أعاد ${moved.reopened.length} مدرب إلى التهيئة — توقيعه معتمد وينقصه حساب أو أجر`)
  if (moved.activated.length > 0) parts.unshift(`فعّل ${moved.activated.length} مدرب توقيعه معتمد — ألغيت التهيئة`)
  if (blocked > 0) parts.push(`و${blocked} منع تفعيله أو توقيع عقده مانع — أخبرت الإدارة`)
  if (notActive > 0) parts.push(`و${notActive} طلبه غير نشط فلم ينشر`)
  return {
    job: 'publish_live_trainers', summaryAr: parts.join(' — '),
    done: moved.activated.length + moved.reopened.length + activated.length + sealed.length + published.length, failed: blocked, ms: Date.now() - started,
  }
}

export const JOBS = [
  { key: 'dispatch_notifications', everyMs: 60_000, run: dispatchQueuedNotifications, titleAr: 'إرسال ما في طابور الإشعارات' },
  { key: 'outbox_mail', everyMs: 60_000, run: dispatchOutboxMail, titleAr: 'إرسال ما في طابور البريد' },
  { key: 'session_reminders', everyMs: 5 * 60_000, run: sendSessionReminders, titleAr: 'تذكير الجلسات' },
  /* كلَّ خمس دقائق: ما يُفتح «بعد انتهاء اللقاء» ينتظر هذه الحالة */
  { key: 'close_ended_sessions', everyMs: 5 * 60_000, run: closeEndedSessions, titleAr: 'انتهاء اللقاءات' },
  /* كلَّ ربع ساعة: يلحق التقدّمَ المحسوبَ قبل محاور الخطّة، ثمّ لا يجد شيئا */
  { key: 'refresh_progress_axes', everyMs: 15 * 60_000, run: refreshProgressAxes, titleAr: 'إعادة حساب التقدم على محاور الخطة' },
  { key: 'notify_timeline', everyMs: 15 * 60_000, run: notifyTimeline, titleAr: 'أخبار خطوط المحاور' },
  /* ي-٥: ودورتُه ساعةٌ لا خمسُ دقائق — عتبتُه يومٌ وأربعةٌ، فدقّةُ الدقائق
     فيه لا تشتري شيئا وتُثقل القاعدةَ باستعلامٍ لا يجد أحدا. */
  { key: 'verify_reminders', everyMs: HOUR, run: sendVerificationReminders, titleAr: 'تذكير توثيق البريد' },
  { key: 'cohort_status_sync', everyMs: 15 * 60_000, run: syncCohortStatuses, titleAr: 'حالات الشعب بالتواريخ' },
  /* كلَّ ربع ساعة: الفتحُ ينشر بنفسه، وهذه تلحق ما فُتح قبل القرار وما أُضيف مدرّبُه بعد الفتح — وتفعّل قبله
     من في الطور وله دورةٌ معتمَدة، وتوقّع عقدَ النشط الذي اعتُمدت له دورة */
  { key: 'publish_live_trainers', everyMs: 15 * 60_000, run: runPublishLiveTrainers, titleAr: 'تفعيل وتوقيع من اعتمدت خطة شعبته ونشر أسماء مدربي الشعب المعروضة' },
  /* كلَّ ساعة: الإسقاطُ والانتقالُ يُلغيان التسجيلَ ساعتَهما — وهذه لما أبى فيه
     Zoom ولمن ترك قبلها. واللقاءُ بعد أيّامٍ في الغالب، فساعةٌ تسبقه */
  { key: 'revoke_left_registrants', everyMs: HOUR, run: revokeLeftRegistrants, titleAr: 'إلغاء تسجيل من ترك شعبته عند Zoom' },
  /* والفصلُ حدُّه يومٌ لا دقيقة — فساعةٌ تكفي ولا تُثقل */
  { key: 'term_status_sync', everyMs: HOUR, run: syncTermStatuses, titleAr: 'حالات الفصول بالتواريخ' },
  { key: 'publish_scheduled_changes', everyMs: 5 * 60_000, run: publishScheduledChanges, titleAr: 'النشر المجدول' },
  /* كلَّ عشر دقائق: المقعدُ المحبوسُ يمنع شراءً الآن لا غدا */
  { key: 'reclaim_abandoned_orders', everyMs: 10 * 60_000, run: reclaimAbandonedOrders, titleAr: 'تحرير مقاعد الطلبات المهجورة' },
  /* كلَّ خمس دقائق: من حجز مقابلتَه يظهر حجزُه في طابور المراجعة بعد دقائق
     لا بعد يوم — وهي نافذةُ ردٍّ مقبولةٌ على حجزِ موعد. */
  { key: 'calendly_interview_sync', everyMs: 5 * 60_000, run: syncCalendlyInterviews, titleAr: 'مزامنة مقابلات Calendly' },
  /* كلَّ ساعةٍ لا كلَّ يوم: الوظيفةُ نفسُها تسأل عن الساعة، فدورةٌ يوميّةٌ
     تُقاس منذ الإقلاع تُخطئ نافذةَ الصباح كلَّما نُشرت نشرةٌ بعد الظهر. */
  { key: 'unbooked_digest', everyMs: HOUR, run: digestUnbookedApplicants, titleAr: 'ملخّص من لم يحجز موعده' },
  /* كلَّ ساعة: مهلةُ الردّ أيّامٌ وأجلُ الإعداد أيّام، فساعةٌ دقّةٌ كافيةٌ
     لا تُثقل. والتذكيرُ يسأل عن «قبل يومٍ من الأجل» فيصيبها في كلّ حال. */
  { key: 'trainer_offer_deadlines', everyMs: HOUR, run: runTrainerOfferDeadlines, titleAr: 'آجال عروض الإسناد وإعدادها' },
  /* كلَّ ساعة: المهلةُ سبعةُ أيّامٍ وعتبةُ التذكير يومان، فساعةٌ دقّةٌ
     كافيةٌ لا تُثقل. والوظيفةُ تسأل عن «بقي يومان أو أقلّ» فتصيبها في كلّ
     حال، ولا تذكّر مرّتين — `conditionRemindedAt` يمنع. */
  { key: 'condition_deadlines', everyMs: HOUR, run: runConditionDeadlines, titleAr: 'مهلة العرض المشروط' },
  /* كلَّ ساعة: الموعدُ يومٌ بعد شهرين، فساعةٌ دقّةٌ كافيةٌ لا تُثقل */
  { key: 'deferral_followups', everyMs: HOUR, run: runDeferralFollowups, titleAr: 'متابعة المؤجّلين إلى الفصول القادمة' },
  /* كلَّ ساعة: الموعدُ شهرٌ قبل الفصل، فساعةٌ دقّةٌ كافية */
  { key: 'cohort_move_reminders', everyMs: HOUR, run: runCohortMoveReminders, titleAr: 'تذكير مدرّبي الشعب المنقولة قبل فصلها' },
  { key: 'share_reminders', everyMs: HOUR, run: runShareReminders, titleAr: 'تذكير المدربين بنشر شعبهم قبل بدئها بأسبوع' },
  /* كلَّ ربع ساعة: المهلةُ ساعةٌ ودقيقة، ومن لم يقبل لا ينتظر ساعةً بعدها ليعلم */
  { key: 'cohort_postpone_expire', everyMs: 15 * 60_000, run: runCohortPostponeExpire, titleAr: 'إيقاف الشعب التي لم يقبل مدربها التأجيل في موعده' },
  /* كلَّ ربع ساعة: لقاءٌ ملغى في تقويم إنسانٍ قد يحضره — والرفعُ لا يتكرّر */
  { key: 'voided_session_invites', everyMs: 15 * 60_000, run: runVoidedSessionInvites, titleAr: 'رفع لقاءات الشعب الملغاة والمؤجلة من التقاويم' },
  /* كلَّ ساعة: اجتماعٌ لشعبةٍ ملغاة لا يُعقد، وما أبى فيه Zoom يُعاد في الدورة التالية */
  { key: 'cancelled_cohort_meetings', everyMs: HOUR, run: runCancelledCohortMeetings, titleAr: 'حذف اجتماعات Zoom للشعب الملغاة' },
  /* كلَّ ربع ساعة: الجدولُ يصل مرّةً لكلّ إسناد، فالدورةُ بعد الأولى لا تجد شيئا */
  { key: 'trainer_calendars', everyMs: 15 * 60_000, run: runTrainerCalendars, titleAr: 'جدول لقاءات الشعبة في تقويم مدربها' },
  { key: 'account_calendars', everyMs: 15 * 60_000, run: runAccountCalendars, titleAr: 'تقويم من أوقف حسابه أو أرشف' },
  { key: 'assign_missing_terms', everyMs: HOUR, run: runAssignMissingTerms, titleAr: 'تسمية فصل الشعب التي بلا فصل' },
  /* كلَّ ربع ساعة: المتابعةُ موعدٌ بالدقيقة، فتُذكَّر قبله بدورة (`FOLLOW_UP_LEAD_MINUTES`) */
  { key: 'advisor_reminders', everyMs: 15 * 60_000, run: runAdvisorReminders, titleAr: 'تذكير المستشارين بالتواصل والمتابعات' },
  { key: 'cleanup_expired', everyMs: 6 * HOUR, run: cleanupExpired, titleAr: 'تنظيف ما انتهى' },
  /* مرّةً في اليوم: التقليمُ ليس عاجلا، وتكرارُه بلا داعٍ يُقفل جداولَ السجلّ */
  { key: 'enforce_retention', everyMs: 24 * HOUR, run: enforceRetention, titleAr: 'تقليم جداول السجلّ بمدّة حفظها' },
  /* كلَّ ستّ ساعات: الكشفُ يولد بعد انتهاء الشهر بساعاتٍ لا بيوم — ومن له كشفٌ يُتخطّى */
  { key: 'advisor_payouts', everyMs: 6 * HOUR, run: runAdvisorPayouts, titleAr: 'كشوف عمولة المستشارين للشهر الذي انتهى' },
  /* مرّةً في اليوم: الأجلُ ستة أشهر، فيومٌ دقّةٌ كافية */
  { key: 'erase_idle_guests', everyMs: 24 * HOUR, run: runEraseIdleGuests, titleAr: 'محو بيانات من لم يسجل بعد ستة أشهر بلا نشاط' },
  /* كلَّ ربع ساعة: المكالمةُ خلال ساعتين من النموذج، فساعةٌ تأكل نصفَها — والدفعةُ محدودةٌ فلا تُغرَق الطوابير */
  { key: 'grant_followup', everyMs: 15 * 60_000, run: runGrantFollowups, titleAr: 'متابعة من عبأ نموذج المنحة ولم يشتر' },
  /* كلَّ ساعة: التذكيرُ التاسعةَ صباحا، فساعةٌ دقّةٌ كافية — ومن ذُكِّر في مرحلته يُتخطّى */
  { key: 'grant_reminders', everyMs: HOUR, run: runGrantReminders, titleAr: 'تذكير من لم يشتر قبل انتهاء المنحة' },
  /* كلَّ ساعة: يقع مرّةً لكلّ شعبة ثمّ لا يجد شيئا — وشرطُه موعدُها لا عدّاد */
  { key: 'cohort_corrections', everyMs: HOUR, run: runCohortCorrections, titleAr: 'تصحيح مواعيد شعب بقرار صاحب المنصة' },
  /* كلَّ ساعة: الحفظُ يسأل منذ اليوم، وهذه تلحق ما كُتب قبله — ثمّ لا تجد شيئا */
  { key: 'adopt_foreign_files', everyMs: HOUR, run: runAdoptForeignFiles, titleAr: 'نسخ ملفات الخطط والمهام إلى شعبها' },
] as const

/** دورةٌ واحدةٌ لوظيفةٍ واحدة، بأثرها المسجَّل — لا عملَ صامت */
export async function runJob(prisma: PrismaClient, key: string, now = new Date()): Promise<JobResult> {
  const job = JOBS.find((j) => j.key === key)
  if (!job) throw new Error(`لا وظيفة بهذا المفتاح: ${key}`)
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
