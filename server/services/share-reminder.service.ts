/* ═══ «انشر دورتك الآن» — قبل بدء الشعبة بأسبوع (٢٧ أكتوبر ٢٠٢٦) ═══

   اقترح Claude: «تذكيرُ المدرّب بالنشر قبل بدء شعبته: يصله بريدٌ قبل أسبوعٍ من البداية فيه منشورُه الجاهزُ ورابطُه
   وكودُه، ويضغط زرّا واحدا لينشر» — فقال صاحبُ المنصّة: «كلّهم». والأسبوعُ الأخيرُ أنفعُ أيّام الدعوة: الموعدُ قريبٌ
   يُذكر، والمقعدُ ما زال يُشترى.

   ═══ ما يقع ═══
   كلَّ ساعةٍ (`share_reminders` في `server/worker/jobs.ts`) تُقرأ الشعبُ المفتوحةُ للتسجيل التي يبدأ أوّلُ لقاءٍ فيها
   بعد يومٍ إلى سبعة أيّام، ولم يُذكَّر مدرّبُها بها. فلمدرّبها الأوّل:
   · **بريدٌ** فيه رابطُ الشعبة القصيرُ (`‎/s/XXXXXX`، بمعاينته — `link-preview.ts`)، وكودُ الخصم لمتابعيه، وكم فتح
     رابطَها حتّى الآن إن فتحه أحد (`link-opens.ts`)، وزرٌّ يفتح لوحةَ مشاركتها نفسَها (`‎/trainer/share?share=…`).
   · **وجرسٌ** في بوّابته بالمعنى نفسِه.

   ═══ وما لا يقع ═══
   · لا يُذكَّر أحدٌ بالشعبة مرّتين: `Cohort.shareReminderAt` يُختم **قبل** الرسالة، فدورتان متزامنتان لا تُرسلان معا.
   · ولا من فاته الأسبوعُ إلى آخر يوم: شعبةٌ تبدأ غدا لا يُطلب نشرُها — تُختم ولا يُرسل شيء.
   · ولا الموقوفُ، ولا من طلبُه غيرُ نشط، ولا شعبةٌ ليس له رابطُ إحالةٍ إليها (`cohortLinksFor` لا يعطيه إلّا ما يُحتسب له). */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { renderMail, type MailBlock } from './mail-template'
import { safeNotify, sendDirectEmail } from './notification.service'
import { publicSiteUrl } from './site-url'
import { TrainerShareCodeService } from './trainer-share-code.service'
import { cohortLeadTrainers } from './cohort-lead'
import { cohortDayAr } from '../../src/application/learning/cohort-gate'
import { countAr } from '../../src/application/text/count-ar'
import { bestCode, splitTitle } from '../../src/application/trainer/share-kit'

const DAY = 24 * 60 * 60 * 1000
/** يُذكَّر قبل البدء بأسبوع */
export const SHARE_REMINDER_LEAD_DAYS = 7
/** ولا يُذكَّر من بقي على شعبته أقلُّ من يوم: لا وقتَ لدعوةٍ تُثمر */
export const SHARE_REMINDER_MIN_HOURS = 24

const PEOPLE_FORMS = { one: 'شخص', two: 'شخصان', few: 'أشخاص', many: 'شخصا' } as const

export class ShareReminderService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  async remindDue(now = new Date()): Promise<{ reminded: number; skipped: number; failed: number }> {
    const soon = new Date(now.getTime() + SHARE_REMINDER_LEAD_DAYS * DAY)
    const cohorts = await this.prisma.cohort.findMany({
      where: {
        status: { in: ['open', 'full'] }, registrationOpen: true, shareReminderAt: null,
        OR: [
          { startsAt: { lte: soon } },
          { sessions: { some: { status: { not: 'cancelled' }, startsAt: { lte: soon } } } },
        ],
      },
      select: {
        id: true, startsAt: true,
        sessions: { where: { status: { not: 'cancelled' } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
        course: { select: { currentVersion: true, versions: { select: { version: true, titleAr: true } } } },
      },
    })
    const leads = await cohortLeadTrainers(this.prisma, cohorts.map((c) => c.id))
    let reminded = 0
    let skipped = 0
    let failed = 0
    for (const c of cohorts) {
      const first = c.sessions[0]?.startsAt ?? c.startsAt
      if (!first || first.getTime() > soon.getTime()) continue
      /* يُختم قبل الرسالة — ومن فاته الأسبوعُ إلى آخر يومٍ يُختم ولا يُرسل */
      const claimed = await this.prisma.cohort.updateMany({ where: { id: c.id, shareReminderAt: null }, data: { shareReminderAt: now } })
      if (claimed.count === 0) continue
      if (first.getTime() - now.getTime() < SHARE_REMINDER_MIN_HOURS * 60 * 60 * 1000) { skipped += 1; continue }
      const profileId = leads.get(c.id)
      const profile = profileId ? await this.prisma.trainerProfile.findUnique({
        where: { id: profileId },
        select: { userId: true, suspendedAt: true, application: { select: { fullName: true, status: true } }, user: { select: { email: true } } },
      }) : null
      if (!profile?.userId || !profile.user || profile.suspendedAt || profile.application.status !== 'active') { skipped += 1; continue }

      const kit = await new TrainerShareCodeService(this.prisma).kit(profile.userId).catch(() => null)
      const link = kit?.short.cohorts[c.id]
      if (!kit || !link) { skipped += 1; continue }
      const code = bestCode({ code: kit.code, percentOff: kit.percentOff }, kit.hisCodes)
      const opens = kit.reach[link.split('/').pop() ?? '']?.opens ?? 0
      const title = c.course.versions.find((v) => v.version === c.course.currentVersion)?.titleAr ?? ''
      const mail = shareReminderMail({
        name: profile.application.fullName, course: splitTitle(title).name, startsAr: cohortDayAr(first, { day: 'numeric', month: 'long' }),
        link, code, opens, panel: `${publicSiteUrl()}/trainer/share?share=${encodeURIComponent(c.id)}`,
      })
      const res = await sendDirectEmail(this.prisma, { to: profile.user.email, subject: mail.subject, ...renderMail(mail.doc) })
      if (res.status === 'sent') reminded += 1
      else failed += 1
      await safeNotify(this.prisma, {
        userId: profile.userId, channel: 'in_app', audience: 'trainer',
        title: mail.subject, body: 'صورتك ونصك جاهزان لكل منصة — افتح «شارك دوراتك» وانشر بضغطة.',
        data: { cohortId: c.id },
      })
      await recordAudit(this.prisma, {
        actorId: null, action: 'referral.share.remind', entityType: 'cohort', entityId: c.id,
        meta: { profileId, startsAt: first.toISOString(), opens, status: res.status },
      })
    }
    return { reminded, skipped, failed }
  }
}

/** الرسالة — محضةٌ لتُقرأ في الاختبار كما تُرسل */
export function shareReminderMail(x: {
  name: string; course: string; startsAr: string; link: string
  code: { code: string; percentOff: number } | null; opens: number; panel: string
}) {
  const blocks: MailBlock[] = [
    { kind: 'p', text: 'هذا أنسب وقت لتدعو من يتابعك. صورتك ونصك جاهزان لكل منصة، والنشر بضغطة.' },
    {
      kind: 'facts', rows: [
        { label: 'رابط دورتك', value: x.link },
        ...(x.code ? [{ label: 'كود خصم لمتابعيك', value: `${x.code.code} — خصم ${x.code.percentOff}٪` }] : []),
      ],
    },
    { kind: 'p', text: x.code
      ? 'الخصم منا ولا يحسم منك شيء. ومن سجل من رابطك أو بكودك يحسب لك بأجر الإحالة.'
      : 'ومن سجل من رابطك يحسب لك بأجر الإحالة.' },
    ...(x.opens > 0 ? [{ kind: 'p' as const, text: `فتح رابطها حتى الآن ${countAr(x.opens, PEOPLE_FORMS)}.` }] : []),
    { kind: 'cta', label: 'انشر دورتك الآن', href: x.panel },
  ]
  return {
    subject: `«${x.course}» تبدأ ${x.startsAr} — شاركها الآن`,
    doc: { greetingName: x.name, heading: `«${x.course}» تبدأ ${x.startsAr}`, blocks },
  }
}
