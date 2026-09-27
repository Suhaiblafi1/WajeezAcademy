/* خدمةُ الفصول — إنشاؤها ونافذتُها وحالتُها، والفصلُ القادم (البند ٤٦).

   الفصلُ كيانٌ لا حقل: يحمل نافذةَ التسجيل ونشرَ التقويم وحالتَه، فلا
   تُكرَّر على كلّ شعبة. وكان السببُ الحاسمُ يومَ أُنشئ قائمةَ «المدرّبون
   المتاحون لهذا الفصل» — وقد ذهبت بذهاب الإتاحة (٢٧ سبتمبر ٢٠٢٦)، وبقي
   الفصلُ بما سواها.

   وحدودُ الفصل تُحسب في `src/application/terms/season` لا هنا: الخادمُ
   والواجهةُ يقرآن الحسابَ نفسَه، فلا يفترق ما يُعرض عمّا يُخزَّن. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { TRAINING_SEASON_VALUES, type TrainingSeason } from '../../src/application/trainer/application-options'
import { termBounds, termTitleAr, termOf } from '../../src/application/terms/season'
import { LIVE_TERM_STATUSES, TERM_STATUS_AR, canMove, dueByDate, type TermStatus } from '../../src/application/terms/lifecycle'
import { termWindowVerdict } from './registration-window'

export class TermService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** الفصولُ كلُّها مرتَّبةً بالبداية — للإدارة */
  async list(options: { includeClosed?: boolean } = {}) {
    return this.prisma.term.findMany({
      where: options.includeClosed ? {} : { status: { in: [...LIVE_TERM_STATUSES] } },
      orderBy: { startsOn: 'asc' },
      include: { _count: { select: { cohorts: true } } },
    })
  }

  /** إنشاءُ فصلٍ بحدوده المحسوبة — لا تُكتب التواريخُ باليد فتفترق عن الموسم */
  async create(actorId: string, input: { year: number; season: string }) {
    if (!(TRAINING_SEASON_VALUES as readonly string[]).includes(input.season)) {
      throw new AuthError('bad_season', 'موسمٌ غير معروف — المواسمُ أربعة', 400)
    }
    const season = input.season as TrainingSeason
    const existing = await this.prisma.term.findUnique({
      where: { year_season: { year: input.year, season } },
    })
    if (existing) throw new AuthError('term_exists', 'هذا الفصلُ موجودٌ بالفعل', 409)

    const { startsOn, endsOn } = termBounds(input.year, season)
    const term = await this.prisma.term.create({
      data: { year: input.year, season, titleAr: termTitleAr(input.year, season), startsOn, endsOn },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'term.create', entityType: 'term', entityId: term.id,
      meta: { year: input.year, season },
    })
    return term
  }

  /* ─────────── الحذفُ — لما لم يُنشر ولا شعبَ فيه ───────────

     قرارُ صاحب المنصّة (٩ سبتمبر ٢٠٢٦): «نبدأ من الشتاء» — وفي الإنتاج فصلُ
     خريفٍ أُنشئ ولم يُنشر، وهو الأقربُ تاريخا فيُعلَن في الكتالوج «الفصلَ
     القادم». ولم يكن للفصل حذفٌ. والشرطان حرفيّان لا تقديريّان: المنشورُ رآه
     الزائر فلا يُمحى، وذو الشعب تفقد شعبُه فصلَها بصمت (`onDelete: SetNull`). */
  async delete(actorId: string, id: string) {
    const term = await this.prisma.term.findUnique({
      where: { id }, include: { _count: { select: { cohorts: true } } },
    })
    if (!term) throw new AuthError('term_not_found', 'الفصلُ غيرُ موجود', 404)
    if (term.calendarPublishedAt) throw new AuthError('term_published', 'فصلٌ نُشر تقويمُه لا يُحذف — رآه الزائر', 409)
    if (term._count.cohorts > 0) throw new AuthError('term_has_cohorts', `في الفصل ${term._count.cohorts} شعبة — انقلها أو ألغِها أوّلا`, 409)
    await this.prisma.term.delete({ where: { id } })
    await recordAudit(this.prisma, {
      actorId, action: 'term.delete', entityType: 'term', entityId: id,
      meta: { titleAr: term.titleAr, year: term.year, season: term.season },
    })
    return { deleted: true, id }
  }

  /* ─────────── حالةُ الفصل: قرارٌ يُكتب، لا حقلٌ يُقرأ فارغا ───────────

     القاعدةُ كلُّها في `src/application/terms/lifecycle` — ومعها العلّةُ
     بالحرف: خمسُ قيمٍ وخمسةُ قرّاءٍ ولا كاتبَ واحد. وهنا البابُ الذي تفعله
     الإدارةُ بيدها؛ وما يقع بالتقويم في `syncStatusesByDate` تحتَه.

     والإلغاءُ يُردّ إن كان في الفصل شعبٌ — الشرطُ نفسُه الذي يحرس الحذفَ:
     شعبةٌ يُلغى فصلُها تفقد حدودَها بصمتٍ (`onDelete: SetNull`)، ومدرّبُها
     يجد نافذتَه أُغلقت بلا خبر. */
  async setStatus(actorId: string, id: string, to: string) {
    const term = await this.prisma.term.findUnique({
      where: { id }, include: { _count: { select: { cohorts: true } } },
    })
    if (!term) throw new AuthError('term_not_found', 'الفصلُ غيرُ موجود', 404)
    if (term.status === to) return term
    if (!canMove(term.status, to)) {
      const fromAr = TERM_STATUS_AR[term.status as TermStatus] ?? term.status
      const toAr = TERM_STATUS_AR[to as TermStatus] ?? to
      throw new AuthError('bad_transition', `لا يُنقل فصلٌ «${fromAr}» إلى «${toAr}»`, 409)
    }
    if (to === 'cancelled' && term._count.cohorts > 0) {
      throw new AuthError(
        'term_has_cohorts',
        `في الفصل ${term._count.cohorts} شعبة — انقلها إلى فصلٍ آخرَ أو ألغِها أوّلا`,
        409,
      )
    }
    const updated = await this.prisma.term.update({
      where: { id },
      data: {
        status: to,
        /* `openedAt`/`openedBy` عمودانِ وُضعا لهذه اللحظةِ بعينها ولم يُكتبا قطّ.
           ويُكتبان مرّةً: من فتحه أوّلَ مرّةٍ هو من فتحه، وإن أُغلق ثمّ فُتح. */
        ...(to === 'open' && !term.openedAt ? { openedAt: new Date(), openedBy: actorId } : {}),
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'term.status', entityType: 'term', entityId: id,
      meta: { from: term.status, to, titleAr: term.titleAr },
    })
    return updated
  }

  /* ─────────── وما يقع بالتقويم لا بقرار ───────────

     فصلٌ مضت أشهرُه منتهٍ وإن لم ينقر أحدٌ زرّا، وفصلٌ مفتوحٌ بلغ أوّلَ
     أشهره جارٍ. والفاعلُ `null`: لم يقرّره إنسان. والوظيفةُ نفسُها تُقرأ
     جافّةً (`apply: false`) فتُرى قبل أن تقع. */
  async syncStatusesByDate(actorId: string | null, options: { apply?: boolean; now?: Date } = {}) {
    const now = options.now ?? new Date()
    const live = await this.prisma.term.findMany({
      where: { status: { in: [...LIVE_TERM_STATUSES] } },
      select: { id: true, titleAr: true, status: true, startsOn: true, endsOn: true },
    })
    const changes = live
      .map((t) => ({ term: t, to: dueByDate(t, now) }))
      .filter((x): x is { term: (typeof live)[number]; to: TermStatus } => x.to !== null)
      .map(({ term, to }) => ({
        termId: term.id, titleAr: term.titleAr, from: term.status, to,
        reason: to === 'closed' ? 'مضت أشهرُه' : 'بلغ أوّلَ أشهره',
      }))
    if (options.apply !== true) return { applied: false, changed: 0, changes }

    let changed = 0
    for (const ch of changes) {
      await this.prisma.term.update({ where: { id: ch.termId }, data: { status: ch.to } })
      await recordAudit(this.prisma, {
        actorId, action: 'term.status', entityType: 'term', entityId: ch.termId,
        meta: { from: ch.from, to: ch.to, titleAr: ch.titleAr, byCalendar: true },
      })
      changed += 1
    }
    return { applied: true, changed, changes }
  }

  /* ─────────── نافذةُ التسجيل — بديلُ الدعوة الدائمة (البند ٥١) ───────────

     التسجيلُ اليوم قيمةٌ منطقيّةٌ بلا تواريخ: متى وُجدت شعبةٌ مفتوحة فالدعوةُ
     مفتوحةٌ إلى الأبد. والنافذةُ تجعل له موعدا يُعلَن ويُنتظَر. */
  async setRegistrationWindow(
    termId: string, actorId: string, input: { opensAt: Date | null; closesAt: Date | null },
  ) {
    if (input.opensAt && input.closesAt && input.closesAt <= input.opensAt) {
      throw new AuthError('bad_window', 'إغلاقُ التسجيل قبل فتحه — راجع التاريخين', 400)
    }
    const term = await this.prisma.term.update({
      where: { id: termId },
      data: { registrationOpensAt: input.opensAt, registrationClosesAt: input.closesAt },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'term.registration_window', entityType: 'term', entityId: termId,
      meta: { opensAt: input.opensAt?.toISOString() ?? null, closesAt: input.closesAt?.toISOString() ?? null },
    })
    return term
  }

  /** أنافذةُ التسجيل مفتوحةٌ الآن؟ — فارغةٌ تعني «لم تُحدَّد»، فلا تمنع.

      والحسابُ في `registration-window` لا هنا: كان هذا نسخةً ثانيةً منه
      بحرفه، وهي عينُ العيب الذي وُضع البند ٥١ له — شرطٌ واحدٌ يُقرأ لا
      نسخٌ تفترق. فبقي الاسمُ لمن يناديه، وذهب الحساب. */
  static registrationOpen(
    term: { registrationOpensAt: Date | null; registrationClosesAt: Date | null }, now = new Date(),
  ): boolean {
    return termWindowVerdict({ titleAr: '', ...term }, now).open
  }

  /* ═══ وذهب سؤالُ «من المتاحُ في هذا الفصل؟» (٢٧ سبتمبر ٢٠٢٦) ═══

     كانت هنا ثلاثُ دوالّ على `TrainerTermAvailability`: المتاحون لفصلٍ،
     وإعلانُ الإتاحة، و«فصولي» للمدرّب. وقرارُ صاحب المنصّة حذفُ الإتاحة
     كلِّها — المدرّبُ يجدول لقاءاتِه بيده داخلَ مدّة شعبته، فلا إعلانَ
     وقتٍ يُبنى عليه. والعلّةُ في رأس `src/pages/trainer/Qualifications.tsx`. */

  /* ─────────── «الفصل القادم» — جوابٌ حقيقيٌّ لسؤالٍ حقيقيّ (البند ٥٢) ───────────

     صفحتا الدورات والمسارات لا تعرضان تواريخَ إطلاقا، والجوابُ الصادقُ اليوم
     عن «متى تبدأ؟» هو «يُعلَن الموعدُ مع فتح الشعبة». وهذا يجعل له جوابا:
     اسمُ الفصل وأشهرُه ونافذةُ تسجيله.

     والمنشورُ يسبق الأقرب: إن كان بين الفصول القادمة فصلٌ نُشر تقويمُه فهو
     «القادم» ولو سبقه فصلٌ أقربُ لم يُنشر — فالإدارةُ حين تنشر تقويما تقصد
     أن يُرى، والتقويمُ العامّ كان يعرض «لا تقويمَ منشورٌ بعد» والمنشورُ خلفه
     لأنّ الاختيارَ كان بالتاريخ وحدَه. (٨ سبتمبر ٢٠٢٦) */
  async upcoming(now = new Date()) {
    const current = termOf(now)
    const candidates = await this.prisma.term.findMany({
      where: {
        status: { in: [...LIVE_TERM_STATUSES] },
        endsOn: { gte: now },
        OR: [{ year: { gt: current.year } }, { year: current.year }],
      },
      orderBy: [{ startsOn: 'asc' }],
    })
    return candidates.find((t) => t.calendarPublishedAt !== null) ?? candidates[0] ?? null
  }

  /** الفصلُ للعرض العامّ — ولا يُعرض تقويمُه قبل نشره */
  async publicUpcoming(now = new Date()) {
    const term = await this.upcoming(now)
    if (!term) return null
    return {
      id: term.id,
      titleAr: term.titleAr,
      startsOn: term.startsOn,
      endsOn: term.endsOn,
      registrationOpensAt: term.registrationOpensAt,
      registrationClosesAt: term.registrationClosesAt,
      registrationOpen: TermService.registrationOpen(term, now),
      calendarPublished: term.calendarPublishedAt !== null,
    }
  }
}
