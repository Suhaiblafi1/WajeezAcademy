/* إجازةُ المستشار ومن يغطّيه فيها (١٩ أكتوبر ٢٠٢٦).

   ═══ العطب ═══

   لم تكن للمستشار إجازة: يُسند إليه النظامُ الطلبةَ الجددَ وهو غائب، فينتظرون من لن يكلّمهم،
   ويجري التذكيرُ بعد يومٍ والإبلاغُ بعد يومين. ولم يكن بيد الإدارة إلّا إيقافُ حسابه كلِّه أو نقلُ
   حالاته بيدها.

   ═══ القرار ═══

   قرارُ صاحب المنصّة بين ثلاثة (تواريخُ إجازةٍ بلا حالاتٍ جديدة · وغطاءٌ مؤقّتٌ معها · يبقى):
   **«B» — تواريخُ إجازةٍ، وغطاءٌ مؤقّت.**

   ═══ ما يقع ═══

   ١) **يكتب المستشارُ إجازتَه** في «حالاتي»، أو يكتبها من يوزّع الحالات (`advisor.assign`).
      إجازةٌ واحدةٌ قائمةٌ أو قادمة؛ ومن كتب غيرَها بدّلها.
   ٢) **ولا يُسند إليه النظامُ فيها** (`autoAssign` يتخطّاه — `availableNowWhere`).
   ٣) **ومن ينتظر أوّلَ تواصلٍ منه يُنقل لغيره** — كلَّ ربع ساعة مع التذكيرات (`coverAway`): كلُّ
      إسنادٍ له على حالةٍ مفتوحةٍ أُسند قبل بدء إجازته ولم يسجّل فيه تواصلا، يذهب لأقلّ الآخرين
      حالاتٍ بقاعدة الإسناد التلقائيّ نفسِها. وعمولةُ الجديد منه من أوّل تواصلٍ يسجّله، كأيّ إسنادٍ
      تلقائيّ — والنوباتُ لا تُعطي الأوّلَ ما بعد نقله.
   ٤) **ومن تواصل معه يبقى عنده** — طالبُه يعرفه، ومتابعاتُه تنتظر عودتَه.
   ٥) **وما أسنده إليه إداريٌّ في إجازته لا يُنقل** — أُسند وهو يعلم أنّه غائب.
   ٦) **ولا يعود شيءٌ بعد الإجازة** — من غطّاه بقي مستشارَ من تواصل معه.

   والحارس: `server/tests/advisors/advisor-away.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'

/** أطولُ إجازةٍ تُكتب — ما بعدها خطأٌ في السنة لا إجازة */
export const MAX_AWAY_DAYS = 180
const DAY_MS = 86_400_000
const OPEN_STATUSES_NOT = ['closed', 'enrolled', 'not_interested']

export class AdvisorAwayService {
  private readonly prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async advisorOf(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, roles: { select: { roleId: true } } } })
    if (!user || !user.roles.some((r) => r.roleId === 'advisor')) throw new AuthError('not_advisor', 'المستخدم ليس مستشارا', 404)
    return user
  }

  /** إجازتُه القائمةُ أو القادمة — وما انقضى لا يُعرض */
  async get(advisorId: string, now = new Date()) {
    await this.advisorOf(advisorId)
    const p = await this.prisma.advisorProfile.findUnique({ where: { userId: advisorId }, select: { awayFrom: true, awayUntil: true, awayNoteAr: true } })
    if (!p?.awayFrom || !p.awayUntil || p.awayUntil <= now) return { away: null }
    return { away: { from: p.awayFrom, until: p.awayUntil, noteAr: p.awayNoteAr, now: p.awayFrom <= now } }
  }

  async set(advisorId: string, input: { from: Date; until: Date; noteAr?: string | null }, actorId: string, now = new Date()) {
    await this.advisorOf(advisorId)
    const { from, until } = input
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) throw new AuthError('bad_dates', 'اختر تاريخي البداية والنهاية', 400)
    if (until <= from) throw new AuthError('bad_dates', 'نهاية الإجازة بعد بدايتها', 400)
    if (until <= now) throw new AuthError('bad_dates', 'هذه الإجازة انتهت — اختر تاريخا قادما', 400)
    if (until.getTime() - from.getTime() > MAX_AWAY_DAYS * DAY_MS) {
      throw new AuthError('bad_dates', `الإجازة ${MAX_AWAY_DAYS} يوما على الأكثر`, 400)
    }
    const noteAr = input.noteAr?.trim().slice(0, 300) || null
    await this.prisma.advisorProfile.upsert({
      where: { userId: advisorId },
      create: { userId: advisorId, awayFrom: from, awayUntil: until, awayNoteAr: noteAr },
      update: { awayFrom: from, awayUntil: until, awayNoteAr: noteAr },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.away.set', entityType: 'advisor', entityId: advisorId,
      meta: { from: from.toISOString(), until: until.toISOString(), bySelf: actorId === advisorId },
    })
    /* وإن بدأت الآن لا ينتظر الطالبُ ربعَ ساعةٍ أخرى */
    const moved = from <= now ? await this.coverOne(advisorId, from) : 0
    return { ...(await this.get(advisorId, now)), moved }
  }

  async clear(advisorId: string, actorId: string) {
    await this.advisorOf(advisorId)
    const { count } = await this.prisma.advisorProfile.updateMany({
      where: { userId: advisorId, awayFrom: { not: null } }, data: { awayFrom: null, awayUntil: null, awayNoteAr: null },
    })
    if (count > 0) {
      await recordAudit(this.prisma, { actorId, action: 'advisor.away.clear', entityType: 'advisor', entityId: advisorId, meta: { bySelf: actorId === advisorId } })
    }
    return { away: null }
  }

  /** دورةُ العامل — كلُّ من في إجازته الآن، ومن ينتظر أوّلَ تواصلٍ منه */
  async coverAway(now = new Date()): Promise<{ moved: number; stayed: number }> {
    const away = await this.prisma.advisorProfile.findMany({
      where: { awayFrom: { lte: now }, awayUntil: { gt: now } }, select: { userId: true, awayFrom: true },
    })
    let moved = 0
    let stayed = 0
    for (const a of away) {
      const before = await this.waiting(a.userId, a.awayFrom!)
      const n = await this.coverOne(a.userId, a.awayFrom!)
      moved += n
      stayed += before.length - n
    }
    return { moved, stayed }
  }

  /** إسناداتُه القائمةُ على حالاتٍ مفتوحة، أُسندت قبل إجازته، ولم يسجّل فيها تواصلا بعدُ */
  private async waiting(advisorId: string, awayFrom: Date) {
    const links = await this.prisma.advisorAssignment.findMany({
      where: {
        advisorId, unassignedAt: null, assignedAt: { lt: awayFrom },
        case: { status: { notIn: OPEN_STATUSES_NOT } },
      },
      select: { caseId: true, assignedAt: true },
      orderBy: { assignedAt: 'asc' },
    })
    if (links.length === 0) return []
    const contacts = await this.prisma.contactEvent.findMany({
      where: { caseId: { in: links.map((l) => l.caseId) }, createdBy: advisorId },
      select: { caseId: true, createdAt: true },
    })
    return links.filter((l) => !contacts.some((c) => c.caseId === l.caseId && c.createdAt >= l.assignedAt))
  }

  private async coverOne(advisorId: string, awayFrom: Date): Promise<number> {
    const advisors = new AdvisorService(this.prisma)
    let moved = 0
    for (const l of await this.waiting(advisorId, awayFrom)) {
      const to = await advisors.autoAssign(l.caseId, { exclude: [advisorId] })
      if (!to) continue
      moved += 1
      await recordAudit(this.prisma, {
        actorId: null, action: 'advisor.case.away_cover', entityType: 'advisor_case', entityId: l.caseId,
        meta: { fromAdvisorId: advisorId, toAdvisorId: to },
      })
    }
    return moved
  }
}
