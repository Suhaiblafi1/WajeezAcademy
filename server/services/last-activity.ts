/* آخرُ نشاطٍ لإنسانٍ في المنصّة — من كلّ أثرٍ تركه، لا من جلسته وحدَها (٢٤ أكتوبر ٢٠٢٦).

   ═══ لماذا لا تكفي الجلسة ═══

   أوّلُ صياغةٍ للمؤشّر (#684) قرأت `Session.lastSeenAt` وحدَه. والعمودُ وُلد يومَ النشر، فما قبله مُلئ
   بوقت الدخول — والجلسةُ تبقى ثلاثين يوما. فقال صاحبُ المنصّة بعد ساعات: «آخرُ نشاطٍ غيرُ دقيقٍ نهائيّا..
   هناك أشخاصٌ تواصلوا معنا من المنصّة وتقول إنّهم لم يفتحوا منذ مدّة».

   فصار المؤشّرُ أحدثَ ما بين كلّ ما يشهد أنّه كان هنا:
   · **الجلسة** — آخرُ استعمالٍ لها (`lastSeenAt`)، أو دخولُه.
   · **الأثر** (`AuditEvent.actorId`) — كلُّ فعلٍ يكتب: خطّةٌ حُفظت، حضورٌ سُجّل، عقدٌ وُقّع…
   · **الدعم** — تذكرةٌ فتحها، أو رسالةٌ كتبها فيها.
   · **رسائلُ الشعبة** التي كتبها لطلبته.
   · **القراءة** — إشعارٌ أو إعلانٌ قرأه.
   · **نموذجُ التواصل** العامّ ببريده — لا حسابَ فيه، فيُطابَق بالبريد.

   ولكلّ إنسانٍ حساباتُه كلُّها: المدرّبُ قد يكتب من حساب التقديم قبل ربط ملفّه (`application.userId`).
   والقراءةُ بنداءٍ واحدٍ لكلّ مصدرٍ للجميع (`groupBy`)، والمصادرُ مفهرسةٌ بصاحبها. */

import type { PrismaClient } from '@prisma/client'

export interface ActivityPerson {
  key: string
  userIds: readonly string[]
  /** بريدُه — لنموذج التواصل العامّ */
  email?: string | null
}

const later = (a: Date | null | undefined, b: Date | null | undefined) =>
  !a ? b ?? null : !b ? a : a > b ? a : b

/** أحدثُ أثرٍ لكلّ إنسان — `null` لمن لا أثرَ له */
export async function lastActivityOf(prisma: PrismaClient, people: readonly ActivityPerson[]): Promise<Map<string, Date | null>> {
  const userIds = [...new Set(people.flatMap((p) => p.userIds))]
  const emails = [...new Set(people.map((p) => p.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)))]
  const byUser = new Map<string, Date | null>()
  const note = (id: string | null, at: Date | null | undefined) => {
    if (!id || !at) return
    byUser.set(id, later(byUser.get(id), at))
  }
  const byEmail = new Map<string, Date>()

  if (userIds.length > 0) {
    const where = { in: userIds }
    const [sessions, audits, tickets, supportMsgs, cohortMsgs, notifications, announcements] = await Promise.all([
      prisma.session.groupBy({ by: ['userId'], where: { userId: where }, _max: { lastSeenAt: true, createdAt: true } }),
      prisma.auditEvent.groupBy({ by: ['actorId'], where: { actorId: where }, _max: { createdAt: true } }),
      prisma.supportTicket.groupBy({ by: ['userId'], where: { userId: where }, _max: { createdAt: true } }),
      prisma.supportMessage.groupBy({ by: ['authorId'], where: { authorId: where }, _max: { createdAt: true } }),
      prisma.cohortMessage.groupBy({ by: ['authorId'], where: { authorId: where }, _max: { createdAt: true } }),
      prisma.notification.groupBy({ by: ['userId'], where: { userId: where, readAt: { not: null } }, _max: { readAt: true } }),
      prisma.trainerAnnouncementRecipient.groupBy({ by: ['userId'], where: { userId: where }, _max: { readAt: true, seenAt: true } }),
    ])
    for (const r of sessions) note(r.userId, later(r._max.lastSeenAt, r._max.createdAt))
    for (const r of audits) note(r.actorId, r._max.createdAt)
    for (const r of tickets) note(r.userId, r._max.createdAt)
    for (const r of supportMsgs) note(r.authorId, r._max.createdAt)
    for (const r of cohortMsgs) note(r.authorId, r._max.createdAt)
    for (const r of notifications) note(r.userId, r._max.readAt)
    for (const r of announcements) note(r.userId, later(r._max.readAt, r._max.seenAt))
  }
  if (emails.length > 0) {
    const rows = await prisma.contactMessage.groupBy({
      by: ['email'], where: { email: { in: emails, mode: 'insensitive' } }, _max: { createdAt: true },
    })
    for (const r of rows) {
      const k = r.email.trim().toLowerCase()
      if (r._max.createdAt) byEmail.set(k, later(byEmail.get(k), r._max.createdAt)!)
    }
  }

  const out = new Map<string, Date | null>()
  for (const p of people) {
    let at: Date | null = null
    for (const id of p.userIds) at = later(at, byUser.get(id))
    const e = p.email?.trim().toLowerCase()
    if (e) at = later(at, byEmail.get(e))
    out.set(p.key, at)
  }
  return out
}
