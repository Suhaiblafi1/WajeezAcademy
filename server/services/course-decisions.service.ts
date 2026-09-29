/* تطبيقُ ملفِّ قراراتِ دوراتِ المدرّبين — المعاينةُ والتطبيق.

   الرسمُ في `src/application/trainer/course-decisions.ts`: يقرأ الملفَّ ويقيس
   كلَّ خطوةٍ على القاعدة، والقولُ في قواعده هناك. وهذا يقرأ القاعدةَ له، ثمّ
   ينفّذ ما سيُطبَّق من **أبواب الأزرار نفسِها**: `CourseProposalService`
   للطابور، و`TrainerReviewService` للتأهيل والإيقاف، و`TrainerApplicationService`
   لسحب الطلب. فلا بابَ خلفيٌّ يكتب في القاعدة ما لا يكتبه الزرّ، ولا خطوةَ
   تفوت أثرَها أو إشعارَها أو مهمّتَها.

   ═══ والتطبيقُ يرسم من جديد ولا يثق بالمعاينة ═══

   بين المعاينة والنقرة دقائقُ قد يُقرَّر فيها شيءٌ من شاشةٍ أخرى. فالتطبيقُ
   يقرأ القاعدةَ ثانيةً ويرسم، ولا ينفّذ إلّا ما سيُطبَّق في الخطّة الجديدة —
   ومدرّبٌ امتنعت خطوةٌ من خطواته يبقى كما هو كلُّه، لا نصفَ قراراته.

   ═══ وما لا يُضمن بمعاملةٍ يُضمن بالقياس ═══

   الخطواتُ لا تقع في معاملةٍ واحدة: كلٌّ منها خدمةٌ لها معاملتُها وبريدُها
   وإشعارُها، وبريدٌ خرج لا يُستردّ بتراجع. فإن تعذّرت خطوةٌ وقف التطبيقُ عندها
   وقال ما طُبّق وما تعذّر ولماذا. ورفعُ الملفّ ثانيةً بعد الإصلاح يُكمل: ما
   طُبّق يُقاس «طُبّق من قبل» فلا يُعاد.

   ═══ ولا تطبيقان معا ═══

   ملفٌّ يُرفع مرّتين في اللحظة نفسِها يرسم الخطّةَ نفسَها مرّتين — فيُدخَل
   الاقتراحُ الجديدُ طابورَه مرّتين. والخادمُ عمليّةٌ واحدة (`deploy/`)، فيكفي
   قفلٌ في الذاكرة. */

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { CourseProposalService } from './course-proposal.service'
import { TrainerReviewService } from './trainer-review.service'
import { TrainerApplicationService, transitionProblemAr, type TrainerStatus } from './trainer-application.service'
import { permissionDescriptionAr } from '../auth/permissions'
import {
  parseDecisionsFile, planDecisions,
  type DecisionsFile, type DecisionsPlan, type DecisionsWorld, type PlannedStep,
} from '../../src/application/trainer/course-decisions'

/** من يطبّق — وصلاحيّاتُه تُقاس بها كلُّ خطوة */
export interface DecisionsActor {
  userId: string
  roles: string[]
  permissions: readonly string[]
}

export interface PreviewResult {
  /** أخطاءُ صيغة الملفّ — وحين تكون لا خطّة */
  errorsAr: string[]
  plan: DecisionsPlan | null
}

export interface ApplyResult {
  /** الخطّةُ كما رُسمت لحظةَ التطبيق */
  plan: DecisionsPlan | null
  /** أرقامُ الخطوات التي طُبّقت الآن */
  applied: number[]
  /** الخطوةُ التي وقف عندها التطبيق — و`null` حين تمّ */
  failed: { n: number; errorAr: string } | null
  /** لمَ لم يبدأ التطبيقُ أصلا — و`null` حين بدأ */
  refusedAr: string | null
}

let applying = false

export class CourseDecisionsService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async preview(raw: unknown, actor: DecisionsActor): Promise<PreviewResult> {
    const parsed = parseDecisionsFile(raw)
    if (!parsed.ok) return { errorsAr: parsed.errorsAr, plan: null }
    return { errorsAr: [], plan: planDecisions(parsed.file, await this.world(parsed.file, actor)) }
  }

  async apply(raw: unknown, actor: DecisionsActor): Promise<ApplyResult> {
    if (applying) {
      return { plan: null, applied: [], failed: null, refusedAr: 'تطبيقُ ملفٍّ آخرَ جارٍ الآن — أعد المحاولة بعد انتهائه' }
    }
    applying = true
    try {
      const parsed = parseDecisionsFile(raw)
      if (!parsed.ok) {
        return { plan: null, applied: [], failed: null, refusedAr: `الملفُّ لا يُقرأ: ${parsed.errorsAr.join(' · ')}` }
      }
      const plan = planDecisions(parsed.file, await this.world(parsed.file, actor))
      if (!plan.applicable) {
        return {
          plan, applied: [], failed: null,
          refusedAr: plan.counts.blocked > 0
            ? `لم يُطبَّق شيء: ${plan.counts.blocked} خطوةً لا تُطبَّق، وما سواها طُبّق من قبل`
            : 'لا جديدَ يُطبَّق — خطواتُ الملفّ كلُّها طُبّقت من قبل',
        }
      }

      const applied: number[] = []
      let failed: ApplyResult['failed'] = null
      /* الاقتراحُ الذي أنشأته خطوةٌ — لقرارٍ يقع عليه بعدها */
      const created = new Map<number, string>()
      for (const step of plan.steps) {
        if (step.state !== 'todo') continue
        try {
          await this.run(step, actor, created)
          applied.push(step.n)
        } catch (e) {
          if (!(e instanceof AuthError)) console.error('[course-decisions] تعذّرت خطوة', step.n, step.kind, e)
          failed = {
            n: step.n,
            errorAr: e instanceof AuthError ? e.message : 'تعذّرت الخطوةُ لعطبٍ في الخادم — وسُجّل ليُقرأ',
          }
          break
        }
      }

      /* صفٌّ يجمع الملفَّ — وكلُّ خطوةٍ كتبت أثرَها بفعل زرّها */
      await recordAudit(this.prisma, {
        actorId: actor.userId, action: 'trainer.course_decisions.apply',
        entityType: 'trainer_course_decisions',
        entityId: createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 16),
        meta: {
          titleAr: plan.titleAr, applied: applied.length,
          alreadyDone: plan.counts.done, failedAt: failed?.n ?? null, failedAr: failed?.errorAr ?? null,
        },
      })
      return { plan, applied, failed, refusedAr: null }
    } finally {
      applying = false
    }
  }

  /** خطوةٌ واحدةٌ من باب زرّها */
  private async run(step: PlannedStep, actor: DecisionsActor, created: Map<number, string>) {
    const proposals = new CourseProposalService(this.prisma)
    const review = new TrainerReviewService(this.prisma)
    const assigner = { userId: actor.userId, roles: actor.roles }
    const proposalId = step.proposalId
      ?? (step.createdByStep !== null ? created.get(step.createdByStep) ?? null : null)
    const need = <T>(v: T | null, what: string): T => {
      if (v === null) throw new AuthError('bad_step', `الخطوة ${step.n} بلا ${what}`, 500)
      return v
    }

    switch (step.kind) {
      case 'create_proposal': {
        const row = await proposals.addByStaff(actor.userId, need(step.profileId, 'ملفّ'), {
          titleAr: need(step.titleAr, 'عنوان'), summaryAr: step.summaryAr,
        })
        created.set(step.n, row.id)
        return
      }
      case 'edit_proposal':
        await proposals.editByStaff(actor.userId, need(proposalId, 'اقتراح'), {
          ...(step.titleAr !== null ? { titleAr: step.titleAr } : {}),
          ...(step.summaryAr !== null ? { summaryAr: step.summaryAr } : {}),
        })
        return
      case 'qualify':
        await review.qualifyForCourse(need(step.profileId, 'ملفّ'), need(step.courseId, 'دورة'), actor.userId)
        return
      case 'link':
        await proposals.linkToCourse(assigner, need(proposalId, 'اقتراح'), need(step.courseId, 'دورة'), step.noteAr)
        return
      case 'became_course':
        await proposals.markBecameCourse(assigner, need(proposalId, 'اقتراح'), need(step.courseId, 'دورة'), step.noteAr)
        return
      case 'ask':
        await proposals.askTrainer(actor.userId, need(proposalId, 'اقتراح'), need(step.questionAr, 'سؤال'))
        return
      case 'reject':
        await proposals.reject(actor.userId, need(proposalId, 'اقتراح'), need(step.noteAr, 'سبب'))
        return
      case 'withdraw':
        /* السحبُ بيد الإدارة لطلبٍ لا يُراد — مكرَّرٌ أو تجريبيّ — من الانتقال
           نفسِه الذي يسحب به المتقدّمُ طلبَه، وسببُه في سجلّ حالته */
        await new TrainerApplicationService(this.prisma)
          .transition(need(step.applicationId, 'طلب'), 'withdrawn', actor.userId, need(step.noteAr, 'سبب'))
        return
      case 'suspend':
        await review.suspendTrainer(need(step.profileId, 'ملفّ'), actor.userId, need(step.noteAr, 'سبب'))
        return
    }
  }

  /** حالُ القاعدة لما يذكره الملفُّ وحدَه */
  private async world(file: DecisionsFile, actor: DecisionsActor): Promise<DecisionsWorld> {
    const apps = await this.prisma.trainerApplication.findMany({
      where: { reference: { in: file.trainers.map((t) => t.reference) } },
      select: {
        id: true, reference: true, fullName: true, status: true,
        profile: {
          select: {
            id: true, userId: true, suspendedAt: true,
            courseProposals: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, titleAr: true, summaryAr: true, status: true, courseId: true, questionAr: true },
            },
            qualifications: { select: { courseId: true, status: true } },
          },
        },
      },
    })
    const courseIds = new Set<string>()
    for (const t of file.trainers) {
      for (const c of t.qualify) courseIds.add(c)
      for (const p of t.proposals) if (p.courseId) courseIds.add(p.courseId)
    }
    const courses = await this.prisma.course.findMany({
      where: { id: { in: [...courseIds] } }, select: { id: true, status: true },
    })
    return {
      trainers: new Map(apps.map((a) => [a.reference, {
        reference: a.reference, fullName: a.fullName, applicationId: a.id, status: a.status,
        profile: a.profile
          ? {
            id: a.profile.id, userId: a.profile.userId, suspended: Boolean(a.profile.suspendedAt),
            proposals: a.profile.courseProposals, qualifications: a.profile.qualifications,
          }
          : null,
      }])),
      courses: new Map(courses.map((c) => [c.id, c.status])),
      actorUserId: actor.userId,
      permissions: new Set(actor.permissions),
      permissionLabelAr: (key) => permissionDescriptionAr(key) ?? key,
      qualifiableStatuses: TrainerReviewService.QUALIFIABLE_STATUSES,
      withdrawProblem: (from) => transitionProblemAr(from as TrainerStatus, 'withdrawn'),
    }
  }
}
