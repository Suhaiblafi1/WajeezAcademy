/* دوراتٌ يقترحها المدرّبُ وليست في كتالوجنا — من طلبِه، ثمّ بيدِه، ثمّ تُصنَّف.

   ═══ ثلاثةُ مواضعَ لشيءٍ واحد ═══

   ① **الطلب** (أ-٣، شُحن): يكتبها المتقدّمُ صفوفا — عنوانٌ ولمن هو — فتُحفظ
      في `TrainerApplication.teachableProposals`. وذلك العمودُ **لا يُمسّ بعدها
      أبدا**: هو سجلُّ ما قدّمه يومَ تقدّم، وقد قرأه من اعتمده.
   ② **بوّابتُه** (ح-٢): يفتحها بعد اعتماده فيجد اقتراحاتِه مبذورةً من طلبه،
      يعدّل ويضيف ويحذف. وهذه حياتُها الثانية — ولذلك صارت جدولا.
   ③ **طابورُ الإدارة** (ح-٤): تُصنَّف قبل أن تدخل الكتالوج.

   ═══ والتصنيفُ لا يكتب دورةً باسم صاحبها ═══

   لـ«نسخةٌ من رمزٍ قائم» بابان: أن يُنشئ النظامُ الإصدارَ آليّا، أو أن
   يَربط الاقتراحَ بالرمز ويدع المدرّبَ يمشي بابَ ح-٣ بنفسه. والثاني هو
   المبنيّ: الإصدارُ الآليُّ يضع في فم المدرّب عنوانا ومحاورَ لم يكتبها، ثمّ
   يُنسب إليه في سجلّ الأثر أنّه اقترحها. فالربطُ يقول «هذه دورتُنا كذا —
   اقترِح نسختَك منها»، ولا يقترح عنه.

   ═══ وحدودُ ما يملكه صاحبُ الاقتراح ═══

   يعدّل ويحذف **ما لم يُبتّ فيه**. وبعد القرار يقرأ ولا يكتب: اقتراحٌ صار
   دورةً في الكتالوج لا يُحذف من تحت قرارِ من اعتمده. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

/** طولُ العنوان — ما يقبله الكتالوج نفسُه، فلا يُقبل هنا ما يُردّ هناك */
export const MIN_PROPOSAL_TITLE = 3
export const MAX_PROPOSAL_TITLE = 200
export const MAX_PROPOSAL_AUDIENCE = 300

/** ما لم يُبتّ فيه — وهو وحدَه ما يملك صاحبُه تعديلَه وحذفَه */
export const OPEN_PROPOSAL = ['draft', 'submitted'] as const
/** ما بُتّ فيه — يُقرأ ولا يُكتب */
export const DECIDED_PROPOSAL = ['linked', 'became_course', 'rejected'] as const

type Db = PrismaClient | Prisma.TransactionClient

export interface ProposalInput {
  titleAr: string
  audienceAr?: string | null
}

/* عنوانُ الدورة يسكن إصدارَها لا الدورةَ نفسَها: `Course` رمزٌ وحالةٌ ورقمُ
   إصدارٍ جارٍ، والاسمُ في `CourseVersion`. ويُقرأ الجاري وحدَه — لا `[0]`،
   فذلك عينُ العطب الذي أُصلح في ك-٢ (الشهادةُ كانت تقرأ أوّلَ إصدارٍ تجده). */
const COURSE_LOOKUP = {
  select: { id: true, status: true, currentVersion: true, versions: { select: { version: true, titleAr: true } } },
} as const

function currentTitle(course: {
  id: string; currentVersion: number; versions: { version: number; titleAr: string }[]
} | null): string | null {
  if (!course) return null
  return course.versions.find((v) => v.version === course.currentVersion)?.titleAr ?? course.id
}

/** صفٌّ واحدٌ في `teachableProposals` — وما لا عنوانَ له لا يُبذَر */
interface RawProposal {
  titleAr?: unknown
  audienceAr?: unknown
}

/** يُبذَر جدولُ الاقتراحات من طلبِ المتقدّم مرّةً — عند ميلاد ملفّه.

    والحالةُ `submitted` لا `draft`: هي مقدَّمةٌ فعلا منذ يوم طلبه، وليست
    مسوّدةً عنده. ولو بُذرت مسوّدةً لانتظرت الإدارةُ تقديما لن يأتي.

    ولا يُبذَر مرّتَين: `ensureProfile` تُعاد على ملفٍّ قائم، فلو بذرنا بلا
    شرطٍ لتضاعفت اقتراحاتُه كلّما أُعيد اعتمادُه. */
export async function seedProposalsFromApplication(
  tx: Db,
  profileId: string,
  raw: unknown,
  actorId: string | null,
): Promise<number> {
  if (!Array.isArray(raw) || raw.length === 0) return 0
  const already = await tx.trainerCourseProposal.count({ where: { profileId } })
  if (already > 0) return 0

  const rows = (raw as RawProposal[])
    .map((r) => ({
      titleAr: typeof r?.titleAr === 'string' ? r.titleAr.trim() : '',
      audienceAr: typeof r?.audienceAr === 'string' ? r.audienceAr.trim() : '',
    }))
    .filter((r) => r.titleAr.length > 0)
  if (rows.length === 0) return 0

  for (const r of rows) {
    await tx.trainerCourseProposal.create({
      data: {
        profileId,
        titleAr: r.titleAr.slice(0, MAX_PROPOSAL_TITLE),
        audienceAr: r.audienceAr ? r.audienceAr.slice(0, MAX_PROPOSAL_AUDIENCE) : null,
        status: 'submitted',
      },
    })
  }
  await recordAudit(tx, {
    actorId, action: 'trainer.course_proposal.create', entityType: 'trainer_profile', entityId: profileId,
    meta: { seededFromApplication: rows.length },
  })
  return rows.length
}

export class CourseProposalService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ملفُّ المدرّب صاحبِ الجلسة — موقوفٌ لا يكتب */
  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: { select: { status: true } } },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب مرتبطا بهذا الحساب', 404)
    if (profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('suspended', 'حسابك التدريبي موقوف — تواصل مع الإدارة', 403)
    }
    return profile
  }

  /** اقتراحي أنا — ويُردّ اقتراحُ غيري بأنّه غيرُ موجود لا بأنّه ممنوع */
  private async mineOrThrow(profileId: string, id: string) {
    const row = await this.prisma.trainerCourseProposal.findUnique({ where: { id } })
    if (!row || row.profileId !== profileId) {
      throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)
    }
    return row
  }

  private assertOpen(status: string) {
    if (!(OPEN_PROPOSAL as readonly string[]).includes(status)) {
      throw new AuthError('decided', 'بُتّ في هذا الاقتراح — لم يعد يُعدَّل', 409)
    }
  }

  private clean(input: ProposalInput) {
    const titleAr = input.titleAr.trim()
    if (titleAr.length < MIN_PROPOSAL_TITLE) {
      throw new AuthError('short_title', `عنوانُ الدورة ${MIN_PROPOSAL_TITLE} أحرفٍ فأكثر`, 400)
    }
    const audienceAr = (input.audienceAr ?? '').trim()
    return {
      titleAr: titleAr.slice(0, MAX_PROPOSAL_TITLE),
      audienceAr: audienceAr ? audienceAr.slice(0, MAX_PROPOSAL_AUDIENCE) : null,
    }
  }

  /* ═══ جانبُ المدرّب (ح-٢) ═══ */

  async mine(userId: string) {
    const profile = await this.profileForUser(userId)
    const rows = await this.prisma.trainerCourseProposal.findMany({
      where: { profileId: profile.id },
      orderBy: [{ createdAt: 'asc' }],
      include: { course: COURSE_LOOKUP },
    })
    return rows.map((r) => ({
      ...r,
      course: r.course ? { id: r.course.id, status: r.course.status, titleAr: currentTitle(r.course) } : null,
    }))
  }

  async add(userId: string, input: ProposalInput) {
    const profile = await this.profileForUser(userId)
    const data = this.clean(input)
    const row = await this.prisma.trainerCourseProposal.create({
      data: { ...data, profileId: profile.id, status: 'submitted' },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.course_proposal.create',
      entityType: 'trainer_course_proposal', entityId: row.id, meta: { titleAr: row.titleAr },
    })
    return row
  }

  async edit(userId: string, id: string, input: ProposalInput) {
    const profile = await this.profileForUser(userId)
    const before = await this.mineOrThrow(profile.id, id)
    this.assertOpen(before.status)
    const data = this.clean(input)
    const row = await this.prisma.trainerCourseProposal.update({ where: { id }, data })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.course_proposal.update',
      entityType: 'trainer_course_proposal', entityId: id,
      before: { titleAr: before.titleAr, audienceAr: before.audienceAr },
      after: { titleAr: row.titleAr, audienceAr: row.audienceAr },
    })
    return row
  }

  async remove(userId: string, id: string) {
    const profile = await this.profileForUser(userId)
    const before = await this.mineOrThrow(profile.id, id)
    this.assertOpen(before.status)
    await this.prisma.trainerCourseProposal.delete({ where: { id } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.course_proposal.delete',
      entityType: 'trainer_course_proposal', entityId: id, meta: { titleAr: before.titleAr },
    })
    return { deleted: true }
  }

  /* ═══ جانبُ الإدارة (ح-٤) ═══ */

  /** طابورُ ما لم يُصنَّف — عبرَ المدرّبين كلِّهم، وهو ما لا يقدر عليه عمودُ JSON */
  async queue(scope: 'open' | 'all' = 'open') {
    const rows = await this.prisma.trainerCourseProposal.findMany({
      where: scope === 'open' ? { status: { in: [...OPEN_PROPOSAL] } } : {},
      orderBy: [{ createdAt: 'asc' }],
      include: {
        course: COURSE_LOOKUP,
        profile: {
          select: {
            id: true, userId: true,
            application: { select: { fullName: true, email: true } },
          },
        },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      profileId: r.profileId,
      trainerName: r.profile.application.fullName,
      trainerEmail: r.profile.application.email,
      titleAr: r.titleAr,
      audienceAr: r.audienceAr,
      status: r.status,
      courseId: r.courseId,
      courseTitleAr: currentTitle(r.course),
      decisionNoteAr: r.decisionNoteAr,
      decidedAt: r.decidedAt,
      createdAt: r.createdAt,
    }))
  }

  /** «نسخةٌ من رمزٍ قائم» — يُربط ولا يُنشأ إصدارٌ باسم صاحبه.

      وبابُ الإصدار بعدها بيدِ المدرّب: `course_title_edit` في
      `TrainerChangeService` بـmaker-checker ودائرةِ أثر (ح-٣). */
  async linkToCourse(actorId: string, id: string, courseId: string, noteAr?: string | null) {
    const row = await this.prisma.trainerCourseProposal.findUnique({ where: { id } })
    if (!row) throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)
    const course = await this.prisma.course.findUnique({ where: { id: courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)

    const out = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: {
        status: 'linked', courseId, decidedBy: actorId, decidedAt: new Date(),
        decisionNoteAr: noteAr?.trim() || null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.course_proposal.link',
      entityType: 'trainer_course_proposal', entityId: id,
      meta: { courseId, titleAr: row.titleAr },
    })
    return out
  }

  /** «دورةٌ جديدة» — تُنشأ في الكتالوج بشاشته، ثمّ يُربط الاقتراحُ بها.

      ولا تُنشأ الدورةُ هنا: نموذجُ الكتالوج يحمل المسارَ والتسلسلَ والساعاتِ
      والمهاراتِ ومدقّقَ التمارين، وثانيةٌ أنحفُ منه تتخلّف عنه بعد شهر. */
  async markBecameCourse(actorId: string, id: string, courseId: string, noteAr?: string | null) {
    const row = await this.prisma.trainerCourseProposal.findUnique({ where: { id } })
    if (!row) throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)
    const course = await this.prisma.course.findUnique({ where: { id: courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)

    const out = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: {
        status: 'became_course', courseId, decidedBy: actorId, decidedAt: new Date(),
        decisionNoteAr: noteAr?.trim() || null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.course_proposal.become_course',
      entityType: 'trainer_course_proposal', entityId: id,
      meta: { courseId, titleAr: row.titleAr },
    })
    return out
  }

  /** الرفضُ بسببٍ يُقرأ — ومن رُفض اقتراحُه بلا سببٍ يخمّن ثمّ يُعيده كما هو */
  async reject(actorId: string, id: string, noteAr: string) {
    const reason = noteAr.trim()
    if (reason.length < 5) throw new AuthError('no_reason', 'اكتب سببَ الرفض — بلا سببٍ يُعاد الاقتراحُ كما هو', 400)
    const row = await this.prisma.trainerCourseProposal.findUnique({ where: { id } })
    if (!row) throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)

    const out = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: { status: 'rejected', decidedBy: actorId, decidedAt: new Date(), decisionNoteAr: reason },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.course_proposal.reject',
      entityType: 'trainer_course_proposal', entityId: id, reason, meta: { titleAr: row.titleAr },
    })
    return out
  }
}
