/* ═══ إعلانُ الإدارة إلى المدرّبين — نافذةٌ تُقرأ، ويُعلَم من قرأها (٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا». فاختار
   من ثلاثة خياراتٍ عُرضت عليه بفروقها: نافذةً فيها «قرأتُه»، وإشعارا في الجرس،
   وقائمةً بمن قرأ. والعقدُ المشترك (الحدود، والنصُّ المقترح، وحالُ المدرّب) في
   `src/application/trainer/announcement.ts`.

   ── من يصله ──

   كلُّ من يفتح بوّابةَ المدرّب فعلا ساعةَ الإرسال: حسابٌ نشط، بدور `trainer`، وله
   ملفُّ مدرّبٍ غيرُ موقوف — وهي شروطُ `TrainerLayout` نفسُها. فلا يُكتب مستقبِلٌ لا
   تظهر له النافذةُ أبدا فيبقى في القائمة «لم يقرأ» إلى الأبد. ويُكتبون ساعتَها لا
   ساعةَ القراءة: «من قرأ» يقابل من أُرسل إليه، لا من صار مدرّبا بعده.

   ── وما يقع بالإرسال ──

   صفٌّ لكلّ مستقبِل، وإشعارٌ في جرس بوّابته (`trainer.announcement` — صنفُ «إعلاناتُ
   الأكاديمية»؛ فمن كتمه سكت جرسُه وبقيت النافذة)، وأثرٌ باسم المرسِل. ولا بريد:
   الخيارُ الذي اختاره بلا بريد.

   ── وما يقع بـ«قرأتُه» ──

   `readAt` في صفّه، وبندُ الجرس الذي يحمل الإعلانَ نفسَه يصير مقروءا — كي لا يبقى
   الجرسُ يعدّ ما قُرئ في النافذة. والتكرارُ لا يغيّر الوقتَ الأوّل. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import {
  ANNOUNCEMENT_BELL_BODY_AR, ANNOUNCEMENT_TEMPLATE_KEY,
} from '../../src/application/trainer/announcement'

export class TrainerAnnouncementService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** من يصله الإعلانُ لو أُرسل الآن — من تُفتح له بوّابةُ المدرّب فعلا */
  private async audienceNow(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'active',
        roles: { some: { roleId: 'trainer' } },
        trainerProfile: { is: { suspendedAt: null } },
      },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }

  async send(actorId: string, input: { titleAr: string; bodyAr: string }) {
    const userIds = await this.audienceNow()
    if (userIds.length === 0) {
      throw new AuthError('no_recipients', 'لا مدرّبَ نشطا يصله الإعلانُ الآن — لم يُرسَل شيء', 409)
    }
    const a = await this.prisma.trainerAnnouncement.create({
      data: {
        titleAr: input.titleAr, bodyAr: input.bodyAr, sentBy: actorId,
        recipients: { createMany: { data: userIds.map((userId) => ({ userId })) } },
      },
    })
    for (const userId of userIds) {
      await safeNotify(this.prisma, {
        userId, audience: 'trainer', channel: 'in_app',
        title: input.titleAr, body: ANNOUNCEMENT_BELL_BODY_AR,
        templateKey: ANNOUNCEMENT_TEMPLATE_KEY,
        data: { announcementId: a.id },
      })
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.announcement.send', entityType: 'trainer_announcement', entityId: a.id,
      meta: { recipients: userIds.length, title: input.titleAr },
    })
    return { id: a.id, recipients: userIds.length }
  }

  /** ما أُرسل — وكم قرأ كلَّ إعلانٍ، وكم رآه ولم يؤكّد. ومعه من يصله لو أُرسل الآن */
  async list() {
    const [rows, audience] = await Promise.all([
      this.prisma.trainerAnnouncement.findMany({
        orderBy: { sentAt: 'desc' }, take: 50,
        include: { recipients: { select: { seenAt: true, readAt: true } } },
      }),
      this.audienceNow(),
    ])
    return {
      audience: audience.length,
      items: rows.map(({ recipients, ...a }) => ({
        ...a,
        total: recipients.length,
        read: recipients.filter((r) => r.readAt).length,
        seen: recipients.filter((r) => r.seenAt && !r.readAt).length,
      })),
    }
  }

  /** من أُرسل إليه إعلانٌ بعينه — ومتى رآه ومتى أكّد قراءتَه */
  async recipients(announcementId: string) {
    const a = await this.prisma.trainerAnnouncement.findUnique({
      where: { id: announcementId },
      include: {
        recipients: {
          select: {
            seenAt: true, readAt: true,
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    })
    if (!a) throw new AuthError('not_found', 'الإعلانُ غير موجود', 404)
    /* من لم يقرأ أوّلا — هو من يُتابَع — ثمّ بالاسم */
    const rank = (r: { seenAt: Date | null; readAt: Date | null }) => (r.readAt ? 2 : r.seenAt ? 1 : 0)
    const rows = [...a.recipients].sort((x, y) =>
      rank(x) - rank(y) || (x.user.displayName ?? '').localeCompare(y.user.displayName ?? '', 'ar'))
    return {
      id: a.id, titleAr: a.titleAr, bodyAr: a.bodyAr, sentAt: a.sentAt,
      recipients: rows.map((r) => ({
        userId: r.user.id, name: r.user.displayName, email: r.user.email, seenAt: r.seenAt, readAt: r.readAt,
      })),
    }
  }

  /* ── بوّابةُ المدرّب ── */

  /** إعلاناتُه — أحدثُها أوّلا. والنافذةُ تختار منها (`announcementToShow`) */
  async mine(userId: string) {
    const rows = await this.prisma.trainerAnnouncementRecipient.findMany({
      where: { userId },
      include: { announcement: { select: { id: true, titleAr: true, bodyAr: true, sentAt: true } } },
      orderBy: { announcement: { sentAt: 'desc' } },
      take: 20,
    })
    return rows.map((r) => ({ ...r.announcement, seenAt: r.seenAt, readAt: r.readAt }))
  }

  private async own(userId: string, announcementId: string) {
    const row = await this.prisma.trainerAnnouncementRecipient.findUnique({
      where: { announcementId_userId: { announcementId, userId } },
    })
    if (!row) throw new AuthError('not_found', 'الإعلانُ غير موجود', 404)
    return row
  }

  /** ظهرت له النافذة — أوّلَ مرّةٍ وحدَها تُكتب */
  async seen(userId: string, announcementId: string) {
    const row = await this.own(userId, announcementId)
    if (row.seenAt) return { seenAt: row.seenAt }
    const at = new Date()
    await this.prisma.trainerAnnouncementRecipient.update({
      where: { announcementId_userId: { announcementId, userId } }, data: { seenAt: at },
    })
    return { seenAt: at }
  }

  /** «قرأتُه» — ويصير بندُ الجرس الذي يحمله مقروءا معه */
  async read(userId: string, announcementId: string) {
    const row = await this.own(userId, announcementId)
    if (row.readAt) return { readAt: row.readAt }
    const at = new Date()
    await this.prisma.trainerAnnouncementRecipient.update({
      where: { announcementId_userId: { announcementId, userId } },
      data: { readAt: at, seenAt: row.seenAt ?? at },
    })
    await this.prisma.notification.updateMany({
      where: {
        userId, templateKey: ANNOUNCEMENT_TEMPLATE_KEY, status: 'sent',
        data: { path: ['announcementId'], equals: announcementId },
      },
      data: { status: 'read', readAt: at },
    })
    return { readAt: at }
  }
}
