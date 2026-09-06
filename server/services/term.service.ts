/* خدمةُ الفصول — إنشاؤها، وإتاحةُ المدرّبين فيها، والفصلُ القادم (البند ٤٦).

   الفصلُ كيانٌ لا حقل، والسببُ الحاسمُ مكتوبٌ في المخطَّط: **قائمةُ
   «المدرّبون المتاحون لهذا الفصل» يجب أن توجد قبل أن توجد الشعب**. وهذه
   الخدمةُ هي التي تجيب ذلك السؤالَ لأوّل مرّة.

   وحدودُ الفصل تُحسب في `src/application/terms/season` لا هنا: الخادمُ
   والواجهةُ يقرآن الحسابَ نفسَه، فلا يفترق ما يُعرض عمّا يُخزَّن. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { TRAINING_SEASON_VALUES, type TrainingSeason } from '../../src/application/trainer/application-options'
import { termBounds, termTitleAr, termOf } from '../../src/application/terms/season'
import { termWindowVerdict } from './registration-window'

const LIVE_TERM_STATUSES = ['planned', 'open', 'active'] as const

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
      include: { _count: { select: { cohorts: true, trainerAvailability: true } } },
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

  /* ─────────── السؤالُ الذي لم يكن له جواب ───────────

     «من يستطيع التدريسَ في فصل الربيع؟» — لا جوابَ له اليوم بالبناء: دالّةُ
     «من يصلح لهذه الشعبة؟» تتخطّى قراءةَ التوفّر كلَّها حين لا جلساتِ بعد.
     وهنا يُسأل عن الفصل لا عن الشعبة، فيُجاب قبل أن تُنشأ شعبةٌ واحدة. */
  async availableTrainers(termId: string, options: { courseId?: string } = {}) {
    const rows = await this.prisma.trainerTermAvailability.findMany({
      where: { termId, status: { in: ['declared', 'confirmed'] } },
      include: {
        profile: {
          include: {
            application: { select: { fullName: true, email: true, status: true } },
            qualifications: { where: { status: 'qualified' }, select: { courseId: true } },
          },
        },
      },
    })
    return rows
      /* الموقوفُ أو غيرُ النشط لا يُعرض متاحا — الإعلانُ لا يتجاوز الحالة */
      .filter((r) => !r.profile.suspendedAt && r.profile.application.status === 'active')
      .filter((r) => !options.courseId || r.profile.qualifications.some((q) => q.courseId === options.courseId))
      .map((r) => ({
        profileId: r.profileId,
        name: r.profile.application.fullName,
        email: r.profile.application.email,
        status: r.status,
        maxCohorts: r.maxCohorts,
        qualifiedCourseIds: r.profile.qualifications.map((q) => q.courseId),
      }))
  }

  /** إعلانُ المدرّب إتاحتَه — أو اعتذارُه عن فصلٍ تخطّط له الإدارة */
  async setTrainerAvailability(
    profileId: string, termId: string, actorId: string,
    input: { status: 'declared' | 'confirmed' | 'declined'; maxCohorts?: number | null; note?: string | null },
  ) {
    const row = await this.prisma.trainerTermAvailability.upsert({
      where: { profileId_termId: { profileId, termId } },
      update: { status: input.status, maxCohorts: input.maxCohorts ?? null, note: input.note ?? null },
      create: {
        profileId, termId, status: input.status,
        maxCohorts: input.maxCohorts ?? null, note: input.note ?? null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'term.trainer_availability', entityType: 'term', entityId: termId,
      meta: { profileId, status: input.status },
    })
    return row
  }

  /* ─────────── «فصولي» — الطرفُ الغائبُ من الجدول (البند ٥٣) ───────────

     `TrainerTermAvailability` لها ثلاثُ حالات — `declared` و`confirmed`
     و`declined` — ولم يكن للمدرّب بابٌ يبلغ أيّا منها: المسلكُ الوحيدُ
     محروسٌ بـ`trainer.assign`، أي أنّ **الإدارةَ وحدَها تُعلن نيابةً عنه**.
     فصار «المتاحون لهذا الفصل» قائمةَ ما وَرِثه الترحيلُ من ملفّه القديم،
     لا ما يقوله هو اليوم.

     وهذا يجيبه: يقرأ فصولَه الحيّةَ وموقفَه من كلٍّ، **ومعها ما خطّطته
     الإدارةُ له فيها** — فالاعتذارُ عن فصلٍ أُسندت فيه ثلاثُ شعبٍ قرارٌ
     آخرُ غيرُ الاعتذار عن فصلٍ فارغ، ولا يُتّخذ على غير علم. */
  async trainerTerms(profileId: string) {
    const terms = await this.prisma.term.findMany({
      where: { status: { in: [...LIVE_TERM_STATUSES] } },
      orderBy: { startsOn: 'asc' },
      include: {
        trainerAvailability: { where: { profileId } },
        cohorts: {
          where: { trainers: { some: { profileId } } },
          select: { id: true, title: true, courseId: true, startsAt: true, status: true },
          orderBy: { startsAt: 'asc' },
        },
      },
    })
    return terms.map((t) => {
      const mine = t.trainerAvailability[0] ?? null
      return {
        id: t.id,
        titleAr: t.titleAr,
        season: t.season,
        startsOn: t.startsOn,
        endsOn: t.endsOn,
        registrationOpensAt: t.registrationOpensAt,
        registrationClosesAt: t.registrationClosesAt,
        termStatus: t.status,
        /* `null` = لم يُعلن شيئا بعدُ — وهي حالةٌ ثالثةٌ غيرُ «متاح» و«معتذر»،
           ولا تُطوى في إحداهما: الصمتُ ليس موافقةً ولا رفضا. */
        myStatus: mine?.status ?? null,
        maxCohorts: mine?.maxCohorts ?? null,
        note: mine?.note ?? null,
        assignedCohorts: t.cohorts,
      }
    })
  }

  /* ─────────── «الفصل القادم» — جوابٌ حقيقيٌّ لسؤالٍ حقيقيّ (البند ٥٢) ───────────

     صفحتا الدورات والمسارات لا تعرضان تواريخَ إطلاقا، والجوابُ الصادقُ اليوم
     عن «متى تبدأ؟» هو «يُعلَن الموعدُ مع فتح الشعبة». وهذا يجعل له جوابا:
     اسمُ الفصل وأشهرُه ونافذةُ تسجيله. */
  async upcoming(now = new Date()) {
    const current = termOf(now)
    return this.prisma.term.findFirst({
      where: {
        status: { in: [...LIVE_TERM_STATUSES] },
        endsOn: { gte: now },
        OR: [{ year: { gt: current.year } }, { year: current.year }],
      },
      orderBy: [{ startsOn: 'asc' }],
    })
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
