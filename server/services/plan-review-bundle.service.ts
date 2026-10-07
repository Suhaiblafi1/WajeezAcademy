/* ═══ خطّةُ الشعبة حزمةً تُنزَّل للمراجعة (٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: زرُّ تنزيلٍ في شاشة الإدارة تُراجَع به خططُ المدرّبين
   خارجَ المنصّة. والنصُّ المقروءُ ومسارُ كلِّ ملفٍّ فيها يُبنيان محضين في
   `src/application/trainer/plan-review-bundle.ts`؛ وهنا جمعُ المدخل من القاعدة،
   وقراءةُ الملفّات من المخزن، وضغطُها ZIP.

   ── ما يُقرأ هو ما يُقرأ في الشاشة ──

   مدخلُ الحزمة `latestForCohort` نفسُه الذي تقرؤه «المراجعة» (`TrainerPlanReview`)،
   وما زيد عليه اثنان لا تعرضهما الشاشةُ في المنهج: ملاحظةُ كلّ لقاءٍ ومرفقُه،
   واسمُ الدورة في الكتالوج. فلا تقول الحزمةُ غيرَ ما يراه المعتمِد.

   ── وما لا يدخل الحزمة يُقال ──

   ملفٌّ غاب عن المخزن، أو جاوز حدَّه، أو جاء بعد أن امتلأت الحزمة: يُكتب في
   `خطة-الشعبة.md` بسببه، ولا يُسكت عنه فيُظنّ أنّ المدرّبَ لم يرفعه. والحدّان
   لذاكرة الحاوية لا للمراجِع: ملفّاتُ الخطّة أربعةُ ميغابايتاتٍ في الرفع
   (`MAX_BODY_FILE_BYTES`)، وما يجاوز ٢٥ فتسجيلٌ لا وثيقة.

   ── ويُسجَّل في الأثر ──

   الحزمةُ تحمل موادَّ المدرّب غيرَ المنشورة (البند ١١-١ من الاتفاقيّة يجعلها
   سرّيّة). فكلُّ تنزيلٍ صفٌّ في أثر الشعبة باسم من نزّلها: `cohort.plan.review_bundle`. */

import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import { CohortPlanService } from './cohort-plan.service'
import { getObject, getObjectMeta } from './object-store'
import { recordAudit } from './audit'
import { publicSiteUrl } from './notification.service'
import {
  bundleFiles, reviewMarkdown, safeName, type BundleFile, type ReviewBundleInput, type ReviewSession,
} from '../../src/application/trainer/plan-review-bundle'
import { zonedDay } from '../../src/application/trainer/cohort-period'

/** حدُّ الملفّ الواحد — ما فوقه تسجيلٌ لا وثيقةٌ تُراجَع */
export const BUNDLE_FILE_MAX_BYTES = 25 * 1024 * 1024
/** حدُّ الحزمة كلِّها — ذاكرةُ الحاوية، والملفّاتُ تُقرأ قبل الضغط */
export const BUNDLE_TOTAL_MAX_BYTES = 150 * 1024 * 1024

export const PLAN_MD_NAME = 'خطة-الشعبة.md'

export interface ReviewBundle {
  /** اسمُ الملفّ المقترحُ للتنزيل — يُرمَّز في الترويسة */
  fileName: string
  zip: Buffer
  /** الشعبُ التي دخلتها — للأثر وللاختبار */
  cohortIds: string[]
}

interface Budget { used: number }

export class PlanReviewBundleService {
  private prisma: PrismaClient
  private plans: CohortPlanService

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.plans = new CohortPlanService(prisma)
  }

  /** خطّةُ شعبةٍ واحدة — أو `null` إن لم يبدأ مدرّبُها خطّةً بعد */
  async forCohort(actorId: string, cohortId: string, now = new Date()): Promise<ReviewBundle | null> {
    const zip = new JSZip()
    const folder = await this.addPlan(zip, cohortId, null, { used: 0 }, now)
    if (!folder) return null
    await this.audit(actorId, [cohortId], false)
    return { fileName: `${folder}.zip`, zip: await this.generate(zip), cohortIds: [cohortId] }
  }

  /* ═══ الخططُ المنتظِرةُ كلُّها — حزمةٌ واحدة ═══
     بترتيب الطابور نفسِه (`pending` — أقدمُها إرسالا أوّلا)، ولكلّ خطّةٍ مجلّدُها
     مرقّما، و`فهرس.md` في رأسها يسمّيها. */
  async allPending(actorId: string, now = new Date()): Promise<ReviewBundle> {
    const queue = await this.plans.pending()
    const zip = new JSZip()
    const budget: Budget = { used: 0 }
    const index: string[] = [`# خطط تنتظر الاعتماد — ${zonedDay(now)}`, '']
    const included: string[] = []
    let n = 0
    for (const p of queue) {
      n += 1
      const prefix = `${String(n).padStart(2, '0')}. ${p.trainerName}`
      const folder = await this.addPlan(zip, p.cohort.id, prefix, budget, now)
      if (!folder) continue
      included.push(p.cohort.id)
      index.push(`${n}. **${p.trainerName}** — ${p.cohort.title} (${p.courseTitle}) → \`${folder}/${PLAN_MD_NAME}\``)
    }
    if (included.length === 0) index.push('لا خطّةَ تنتظر الاعتماد الآن.')
    zip.file('فهرس.md', `${index.join('\n')}\n`)
    if (included.length) await this.audit(actorId, included, true)
    return { fileName: `خطط-تنتظر-الاعتماد-${zonedDay(now)}.zip`, zip: await this.generate(zip), cohortIds: included }
  }

  /** يضيف خطّةً إلى الحزمة في مجلّدها، ويُعيد اسمَ المجلّد — أو `null` بلا خطّة */
  private async addPlan(zip: JSZip, cohortId: string, prefix: string | null, budget: Budget, now: Date): Promise<string | null> {
    const plan = await this.plans.latestForCohort(cohortId)
    if (!plan) return null
    const [cohort, extras] = await Promise.all([
      this.prisma.cohort.findUnique({
        where: { id: cohortId },
        select: { course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } } },
      }),
      this.prisma.cohortSession.findMany({
        where: { cohortId },
        select: { id: true, noteAr: true, attachmentKey: true, attachmentName: true },
      }),
    ])
    const extra = new Map(extras.map((s) => [s.id, s]))
    const sessions: ReviewSession[] = plan.sessions.map((s) => ({
      ...s,
      noteAr: extra.get(s.id)?.noteAr ?? null,
      attachmentKey: extra.get(s.id)?.attachmentKey ?? null,
      attachmentName: extra.get(s.id)?.attachmentName ?? null,
    }))
    const input: ReviewBundleInput = {
      courseTitle: cohort?.course.versions[0]?.titleAr ?? null,
      cohortTitle: plan.cohortTitle,
      trainerName: plan.trainerName,
      status: plan.status,
      submittedAt: plan.submittedAt,
      period: plan.period,
      content: plan.content,
      sessions,
      assessments: plan.assessments,
      approvedOnce: plan.approvedOnce,
      reviewerNotes: plan.reviewerNotes,
      links: { siteUrl: publicSiteUrl(), cohortId },
      now,
    }

    const folder = safeName(prefix ? `${prefix} — ${plan.cohortTitle}` : `خطة ${plan.cohortTitle} — ${plan.trainerName ?? 'مدرّب'}`, 90)
    const files = bundleFiles(input)
    /* ═══ ولا يدخل إلّا ملفُّ هذه الشعبة ═══
       المفتاحُ في محتوى الخطّة نصٌّ كتبه المدرّب. فلو قُرئ كما هو لأدخل الحزمةَ
       أيَّ كائنٍ في المخزن يعرف مفتاحَه — ملفَّ شعبةٍ أخرى أو تسليمَ متعلّم.
       فالحَكَمُ ما يحكم به بابُ القراءة نفسُه (`assertCanRead`): صفُّ `CohortFile`
       لهذه الشعبة. ومرفقُ اللقاء على صفّ لقائها، ومن صفّه قُرئ. */
    const registered = await this.prisma.cohortFile.findMany({
      where: { cohortId, storageKey: { in: files.map((f) => f.key) } },
      select: { storageKey: true },
    })
    const owned = new Set([
      ...registered.map((r) => r.storageKey),
      ...extras.map((s) => s.attachmentKey).filter((k): k is string => !!k),
    ])
    const skipped = new Map<string, string>()
    for (const f of files) {
      const why = owned.has(f.key)
        ? await this.addFile(zip, `${folder}/${f.path}`, f, budget)
        : 'ليس من ملفّات هذه الشعبة'
      if (why) skipped.set(f.key, why)
    }
    zip.file(`${folder}/${PLAN_MD_NAME}`, reviewMarkdown(input, files, skipped))
    zip.file(`${folder}/plan.json`, JSON.stringify(plan, null, 2))
    return folder
  }

  /** يقرأ الملفَّ من المخزن ويضيفه — ويُعيد سببَ تركه إن تُرك */
  private async addFile(zip: JSZip, path: string, f: BundleFile, budget: Budget): Promise<string | null> {
    const meta = await getObjectMeta(f.key).catch(() => null)
    if (meta && meta.sizeBytes > BUNDLE_FILE_MAX_BYTES) return `حجمه ${mb(meta.sizeBytes)} — أكبر من ${mb(BUNDLE_FILE_MAX_BYTES)}`
    const body = await getObject(f.key).catch(() => null)
    if (!body) return 'غير موجود في المخزن'
    if (body.length > BUNDLE_FILE_MAX_BYTES) return `حجمه ${mb(body.length)} — أكبر من ${mb(BUNDLE_FILE_MAX_BYTES)}`
    if (budget.used + body.length > BUNDLE_TOTAL_MAX_BYTES) return `امتلأت الحزمة (${mb(BUNDLE_TOTAL_MAX_BYTES)}) — نزّل خطّتَه وحدَها`
    budget.used += body.length
    zip.file(path, body)
    return null
  }

  private generate(zip: JSZip): Promise<Buffer> {
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'UNIX' })
  }

  private async audit(actorId: string, cohortIds: string[], bulk: boolean) {
    for (const cohortId of cohortIds) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.review_bundle',
        entityType: 'cohort', entityId: cohortId, meta: { bulk },
      })
    }
  }
}

const mb = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`
