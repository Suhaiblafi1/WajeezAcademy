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
   دورةً في الكتالوج لا يُحذف من تحت قرارِ من اعتمده.

   ═══ وبينهما سؤال ═══

   كان الطابورُ بابَين: صنِّف أو ارفض. ومن وصله اقتراحٌ اسمُه «دوره خطابه
   عامه» ولا يدري أهي للمبتدئين أم للتنفيذيّين، ولا كم ساعةً يراها صاحبُها،
   **لم يملك إلّا أن يخمّن أو يرفض** — والرفضُ لسؤالٍ لم يُسأل يُفقد المنصّةَ
   دورةً ويُفقد المدرّبَ ثقتَه.

   فصار بابٌ ثالث: `askTrainer` تكتب سؤالا ويُنقل الاقتراحُ إلى
   `info_requested`، فيقرؤه صاحبُه في بوّابته ويجيب ويعدّل، ثمّ يعود
   `submitted` ومعه سؤالُها وجوابُه معا — لا الجوابُ وحدَه بلا ما سُئل عنه.

   ═══ والتصنيفُ لا ينتهي بالتصنيف ═══

   اقتراحٌ صُنِّف «نسخةٌ من رمزٍ قائم» لا يُدرّسه صاحبُه: التأهيلُ فعلٌ ثانٍ
   في شاشةٍ ثانية. وكان ينتهي القرارُ ولا يبقى ما يذكّر به، فيُصنَّف الاقتراحُ
   ويبقى المدرّبُ غيرَ مؤهَّلٍ لما اقترحه — **وهو ضياعُ العمل بعد إنجازه، لا
   قبله**. فالقرارُ يخلق مهمّةً قائمةً على من قرّر، وتبقى في «مهامّي» حتّى
   يُغلقها بيده. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import { StaffTaskService, type Assigner } from './staff-task.service'
import { suggestCourses, type ProposalMatch } from '../../src/application/trainer/proposal-match'

/** طولُ العنوان — ما يقبله الكتالوج نفسُه، فلا يُقبل هنا ما يُردّ هناك */
export const MIN_PROPOSAL_TITLE = 3
export const MAX_PROPOSAL_TITLE = 200
/** النبذةُ فقرةٌ لا سطر — و«لمن هي» كانت ٣٠٠ حرفٍ لأنّها كانت سطرا واحدا */
export const MAX_PROPOSAL_SUMMARY = 1500
/** سؤالُ الإدارة وجوابُه — ونصٌّ أطولُ من هذا ليس سؤالا بل مواصفاتُ دورة */
export const MAX_PROPOSAL_QUESTION = 2000

/** ما لم يُبتّ فيه — وهو وحدَه ما يملك صاحبُه تعديلَه وحذفَه.

    و`info_requested` منه بقصد: سُئل صاحبُه ليعدّل، فمنعُه من التعديل يجعل
    السؤالَ بلا جواب. */
export const OPEN_PROPOSAL = ['draft', 'submitted', 'info_requested'] as const
/** ما بُتّ فيه — يُقرأ ولا يُكتب */
export const DECIDED_PROPOSAL = ['linked', 'became_course', 'rejected'] as const

type Db = PrismaClient | Prisma.TransactionClient

export interface ProposalInput {
  titleAr: string
  summaryAr?: string | null
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

/** صفٌّ واحدٌ في `teachableProposals` — وما لا عنوانَ له لا يُبذَر.

    والمفتاحان كلاهما يُقرأ: الطلباتُ التي سبقت هذا التغيير كتبت `audienceAr`،
    وعمودُ الطلب **لا يُعاد كتابتُه أبدا** (هو سجلُّ ما قُدّم يومَ قُدّم). فمن
    قرأ واحدا منهما وحدَه أسقط نبذةَ كلِّ متقدّمٍ قديمٍ صامتا. */
interface RawProposal {
  titleAr?: unknown
  summaryAr?: unknown
  audienceAr?: unknown
}

/** نصٌّ من حمولةٍ غيرِ موثوقة — وما ليس نصّا فراغ */
const rawText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

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
      titleAr: rawText(r?.titleAr),
      summaryAr: rawText(r?.summaryAr) || rawText(r?.audienceAr),
    }))
    .filter((r) => r.titleAr.length > 0)
  if (rows.length === 0) return 0

  for (const r of rows) {
    await tx.trainerCourseProposal.create({
      data: {
        profileId,
        titleAr: r.titleAr.slice(0, MAX_PROPOSAL_TITLE),
        summaryAr: r.summaryAr ? r.summaryAr.slice(0, MAX_PROPOSAL_SUMMARY) : null,
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
    const summaryAr = (input.summaryAr ?? '').trim()
    return {
      titleAr: titleAr.slice(0, MAX_PROPOSAL_TITLE),
      summaryAr: summaryAr ? summaryAr.slice(0, MAX_PROPOSAL_SUMMARY) : null,
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
      before: { titleAr: before.titleAr, summaryAr: before.summaryAr },
      after: { titleAr: row.titleAr, summaryAr: row.summaryAr },
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

  /** جوابُ المدرّب على سؤال الإدارة — ويعيد اقتراحَه إلى الطابور.

      ولا يُمحى السؤالُ بالجواب: من فتح الطابورَ بعد أسبوعٍ يقرأ «سُئل كذا،
      فأجاب كذا» — وجوابٌ بلا سؤالِه نصفُ جملة. */
  async answer(userId: string, id: string, answerAr: string) {
    const profile = await this.profileForUser(userId)
    const before = await this.mineOrThrow(profile.id, id)
    if (before.status !== 'info_requested') {
      throw new AuthError('no_question', 'لا سؤالَ مفتوحا على هذا الاقتراح', 409)
    }
    const text = answerAr.trim()
    if (text.length < 2) throw new AuthError('empty_answer', 'اكتب جوابَك — الفراغُ لا يُجيب سؤالا', 400)

    const row = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: {
        answerAr: text.slice(0, MAX_PROPOSAL_QUESTION),
        answeredAt: new Date(),
        status: 'submitted',
      },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.course_proposal.answer',
      entityType: 'trainer_course_proposal', entityId: id, meta: { titleAr: row.titleAr },
    })
    return row
  }

  /* ═══ جانبُ الإدارة (ح-٤) ═══ */

  /* ═══ ما يُرشَّح للربط — يُحسب هنا لا في المتصفّح ═══

     الكتالوجُ واحدٌ وثمانون رمزا بمهاراتها، والمرشِّحُ يقرأ نصَّها كلَّه.
     وحسابُه في المتصفّح يعني تحميلَ ذلك كلِّه إلى كلّ من يفتح الشاشة، ثمّ
     إعادةَ حسابه عند كلّ إعادةِ تصيير. وهو هنا مرّةً واحدةً لكلّ نداء. */
  private async matchableCourses() {
    const rows = await this.prisma.course.findMany({
      where: { status: { not: 'archived' } },
      select: {
        id: true, currentVersion: true,
        versions: { select: { version: true, titleAr: true, shortPromiseAr: true } },
        skillLinks: { select: { skill: { select: { nameAr: true } } } },
      },
    })
    return rows.map((c) => {
      const v = c.versions.find((x) => x.version === c.currentVersion)
      return {
        id: c.id,
        titleAr: v?.titleAr ?? c.id,
        extraAr: [v?.shortPromiseAr, ...c.skillLinks.map((l) => l.skill.nameAr)],
      }
    })
  }

  /** طابورُ ما لم يُصنَّف — عبرَ المدرّبين كلِّهم، وهو ما لا يقدر عليه عمودُ JSON.

      ويصحب كلَّ اقتراحٍ مفتوحٍ ترشيحُ أقربِ الرموز إليه (`suggestedCourses`):
      من يصنّف لا يحفظ الكتالوجَ بظهر قلب، ومن لم يُرشَّح له شيءٌ أنشأ ثانيةً
      لما هو موجود. والمصنَّفُ لا يُرشَّح له: قد بُتّ فيه. */
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
    const open = rows.filter((r) => (OPEN_PROPOSAL as readonly string[]).includes(r.status))
    const catalog = open.length > 0 ? await this.matchableCourses() : []

    return rows.map((r) => ({
      id: r.id,
      profileId: r.profileId,
      trainerName: r.profile.application.fullName,
      trainerEmail: r.profile.application.email,
      titleAr: r.titleAr,
      summaryAr: r.summaryAr,
      status: r.status,
      courseId: r.courseId,
      courseTitleAr: currentTitle(r.course),
      questionAr: r.questionAr,
      questionAt: r.questionAt,
      answerAr: r.answerAr,
      answeredAt: r.answeredAt,
      decisionNoteAr: r.decisionNoteAr,
      decidedAt: r.decidedAt,
      createdAt: r.createdAt,
      suggestedCourses: (OPEN_PROPOSAL as readonly string[]).includes(r.status)
        ? suggestCourses({ titleAr: r.titleAr, summaryAr: r.summaryAr }, catalog)
        : ([] as ProposalMatch[]),
    }))
  }

  /** سؤالُ الإدارة قبل القرار — ينقل الاقتراحَ إلى صاحبه ويُشعره.

      والسؤالُ يُطرح على المفتوح وحدَه: سؤالٌ بعد الرفض لا جوابَ له يُغيّر
      شيئا، ولو رُدّ الاقتراحُ إلى `info_requested` بعد بتٍّ لَفتح بابا
      لنقض القرار من حيث لا يُرى. */
  async askTrainer(actorId: string, id: string, questionAr: string) {
    const text = questionAr.trim()
    if (text.length < 5) {
      throw new AuthError('short_question', 'اكتب سؤالَك — سطرٌ غامضٌ يُعيد الاقتراحَ كما هو', 400)
    }
    const row = await this.prisma.trainerCourseProposal.findUnique({
      where: { id },
      include: { profile: { select: { userId: true, application: { select: { fullName: true } } } } },
    })
    if (!row) throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)
    this.assertOpen(row.status)

    const out = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: {
        status: 'info_requested',
        questionAr: text.slice(0, MAX_PROPOSAL_QUESTION),
        questionBy: actorId,
        questionAt: new Date(),
        /* سؤالٌ جديدٌ يمحو جوابَ سؤالٍ قبله: الجوابُ المعروضُ يجب أن يكون
           جوابَ السؤال المعروض، وإلّا قُرئ جوابٌ قديمٌ على سؤالٍ جديد. */
        answerAr: null,
        answeredAt: null,
      },
    })

    /* والسؤالُ يصل صاحبَه: سؤالٌ في شاشةٍ لا يفتحها إلّا مصادفةً ليس سؤالا.

       و`userId` قد يكون فارغا: ملفٌّ أُنشئ قبل أن يُفعّل صاحبُه حسابَه بدعوته.
       فيُسأل الاقتراحُ على كلّ حال — السؤالُ مكتوبٌ في الطابور يقرؤه حين يدخل
       — ولا يُنادى الإشعارُ بمعرّفٍ معدوم. */
    if (row.profile.userId) {
      await safeNotify(this.prisma, {
        userId: row.profile.userId, audience: 'trainer', channel: 'in_app',
        title: `سؤالٌ عن دورتك المقترحة: ${row.titleAr}`,
        body: `${text}\n\nافتح «دوراتي المقترحة» لتجيب — ولك أن تعدّل عنوانَها ونبذتَها معه.`,
        templateKey: 'trainer.course_proposal.question',
        data: { proposalId: id },
      })
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.course_proposal.ask',
      entityType: 'trainer_course_proposal', entityId: id,
      meta: { titleAr: row.titleAr, questionAr: text },
    })
    return out
  }

  /* ═══ ما يبقى بعد القرار — مهمّةُ التأهيل ═══

     التصنيفُ يقول «هذه دورتُنا»، ولا يجعل المدرّبَ يدرّسها: التأهيلُ فعلٌ
     ثانٍ في `/admin/assign-by-trainer`. وبينهما ينامُ الاقتراحُ إلى الأبد إن
     لم يبقَ ما يذكّر به — وهو ما وقع فعلا: اقتراحاتٌ صُنِّفت وأصحابُها غيرُ
     مؤهَّلين لها بعد شهور.

     فالمهمّةُ على **من قرّر** لا على المدرّب: التأهيلُ بيدِ الإدارة لا بيده،
     ومهمّةٌ تُلقى على من لا يملك إنجازَها إزعاجٌ لا تذكير. واسمُه فيها كي
     يُقرأ الصفُّ في «مهامّي» بلا فتحِ شاشةٍ أخرى.

     وهي `high` بقصد: عملٌ نصفُه تمّ ونصفُه معلّق أولى بالإنجاز من عملٍ لم
     يبدأ — والمدرّبُ ينتظر في الطرف الآخر وقد قيل له إنّ دورتَه قُبلت. */
  private async openQualificationTask(
    actor: Assigner,
    input: { proposalId: string; titleAr: string; courseId: string; trainerName: string; wasLinked: boolean },
  ) {
    const tasks = new StaffTaskService(this.prisma)
    await tasks.assign(actor, {
      assigneeId: actor.userId,
      priority: 'high',
      title: `أهِّل ${input.trainerName} للدورة ${input.courseId}`,
      bodyAr: [
        input.wasLinked
          ? `اقتراحُه «${input.titleAr}» صُنِّف نسخةً من ${input.courseId}.`
          : `اقتراحُه «${input.titleAr}» صار الدورةَ ${input.courseId} في الكتالوج.`,
        'ويبقى تأهيلُه لها — وبلا تأهيلٍ لا يُسنَد إلى شعبةٍ منها، فيبقى القرارُ بلا أثر.',
        'التأهيلُ من: /admin/assign-by-trainer',
      ].join('\n'),
    })
  }

  /** «نسخةٌ من رمزٍ قائم» — يُربط ولا يُنشأ إصدارٌ باسم صاحبه.

      وكان بعدها بابٌ بيد المدرّب إلى اسم الدورة (`course_title_edit` · ح-٣)،
      وأُغلق (ق٥ · ١٧ سبتمبر ٢٠٢٦). فمن رُبط اقتراحُه برمزٍ قائمٍ يقرأ اسمَه
      كما هو، وتسميةُ الكتالوج بيد الإدارة. */
  async linkToCourse(actor: Assigner, id: string, courseId: string, noteAr?: string | null) {
    const row = await this.prisma.trainerCourseProposal.findUnique({
      where: { id },
      include: { profile: { select: { application: { select: { fullName: true } } } } },
    })
    if (!row) throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)
    const course = await this.prisma.course.findUnique({ where: { id: courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)

    const out = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: {
        status: 'linked', courseId, decidedBy: actor.userId, decidedAt: new Date(),
        decisionNoteAr: noteAr?.trim() || null,
      },
    })
    await recordAudit(this.prisma, {
      actorId: actor.userId, action: 'trainer.course_proposal.link',
      entityType: 'trainer_course_proposal', entityId: id,
      meta: { courseId, titleAr: row.titleAr },
    })
    await this.openQualificationTask(actor, {
      proposalId: id, titleAr: row.titleAr, courseId,
      trainerName: row.profile.application.fullName, wasLinked: true,
    })
    return out
  }

  /** «دورةٌ جديدة» — تُنشأ في الكتالوج بشاشته، ثمّ يُربط الاقتراحُ بها.

      ولا تُنشأ الدورةُ هنا: نموذجُ الكتالوج يحمل المسارَ والتسلسلَ والساعاتِ
      والمهاراتِ ومدقّقَ التمارين، وثانيةٌ أنحفُ منه تتخلّف عنه بعد شهر. */
  async markBecameCourse(actor: Assigner, id: string, courseId: string, noteAr?: string | null) {
    const row = await this.prisma.trainerCourseProposal.findUnique({
      where: { id },
      include: { profile: { select: { application: { select: { fullName: true } } } } },
    })
    if (!row) throw new AuthError('unknown_proposal', 'لا اقتراحَ بهذا المعرّف', 404)
    const course = await this.prisma.course.findUnique({ where: { id: courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)

    const out = await this.prisma.trainerCourseProposal.update({
      where: { id },
      data: {
        status: 'became_course', courseId, decidedBy: actor.userId, decidedAt: new Date(),
        decisionNoteAr: noteAr?.trim() || null,
      },
    })
    await recordAudit(this.prisma, {
      actorId: actor.userId, action: 'trainer.course_proposal.become_course',
      entityType: 'trainer_course_proposal', entityId: id,
      meta: { courseId, titleAr: row.titleAr },
    })
    await this.openQualificationTask(actor, {
      proposalId: id, titleAr: row.titleAr, courseId,
      trainerName: row.profile.application.fullName, wasLinked: false,
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
