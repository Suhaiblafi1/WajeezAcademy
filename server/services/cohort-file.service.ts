/* ملفُّ شعبةٍ — رفعُه وقراءتُه (ع-٢ · د-٣).

   ═══ من يرفع، ومن يقرأ ═══

   يرفع **مدرّبُ الشعبة** وحدَه: هو صاحبُ خطّتها. ويقرأ **من التحق بها** —
   ومعه الإدارةُ حين تراجع الخطّة قبل اعتمادها، وإلّا اعتُمدت وثيقةٌ لم
   يفتحها أحد.

   ═══ ولا يُسلَّم الملفُّ من مساره ═══

   التخزينُ خاصٌّ، والقراءةُ تمرّ بفحصِ صلاحيّةٍ ثمّ تُخدَم البايتاتُ من
   الخادم — لا رابطٌ دائمٌ يُنسخ في محادثةٍ فيُفتح بعد شهرٍ بلا حساب. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import {
  assertFileUploadsEnabled, newStorageKey, signKey, SIGNED_URL_TTL_MS,
} from './storage.service'
import { deleteObject, objectExists } from './object-store'
import {
  fileBlockerAr, MAX_BODY_FILE_BYTES, type FilePurpose,
} from '../../src/application/trainer/module-body'
import { projectPlanForLearner, readTypedLinks } from '../../src/application/trainer/plan-overlay'
import { assessmentOpensAt } from '../../src/application/learning/cohort-gate'
import { loadLearnerGate } from './learner-gate'

export class CohortFileService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ═══ مدرّبُ هذه الشعبة ═══

     والرابطُ `TrainerProfile.userId` لا `application.userId`: هو ما تقرؤه
     `ownedCohort` في خدمة الخطّة، وهو عمودُ الحساب على الملفّ نفسِه. وكنتُ
     كتبتُها أوّلا عبر الطلب — وهو عمودٌ آخرُ قد يكون فارغا لمدرّبٍ ملفُّه
     مربوطٌ بحسابه، فيُردّ صاحبُ الشعبة عن شعبته.

     والموقوفُ لا يرفع: `profileOf` تردّه، فيُردّ هنا كذلك. */
  private async requireCohortTrainer(cohortId: string, userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, select: { id: true, suspendedAt: true },
    })
    if (!profile || profile.suspendedAt) {
      throw new AuthError('not_trainer', 'لا ملفَّ مدرّبٍ نشطا لهذا الحساب', 403)
    }
    const link = await this.prisma.cohortTrainer.findFirst({
      where: { cohortId, profileId: profile.id }, select: { id: true },
    })
    if (!link) throw new AuthError('not_trainer', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
    return profile
  }

  /** رابطُ رفعٍ موقَّت — والصفُّ يُكتب أوّلا ليعرفه `resolveStorageOwner` */
  async startUpload(
    userId: string, cohortId: string, purpose: FilePurpose, refId: string,
    input: { mime: string; originalName: string },
  ) {
    assertFileUploadsEnabled('والبديلُ الآن: ألصِق رابطا، أو اكتب المحتوى في المحرّر.')
    /* وتقريرُ المراجعة للمعتمِد وحدَه — بابُه `startReviewReportUpload`. والمسارُ يردّه قبل
       هذا (`TRAINER_FILE_PURPOSES`)، وهذا السطرُ لمن نادى الخدمةَ من غير المسار */
    if (purpose === 'review_report') throw new AuthError('forbidden', 'تقريرُ المراجعة يرفعه من يعتمد الخطّة', 403)
    await this.requireCohortTrainer(cohortId, userId)

    const blocker = fileBlockerAr(purpose, input.mime)
    if (blocker) throw new AuthError('bad_mime', blocker, 422)

    const name = input.originalName.trim().slice(0, 200) || 'ملفّ'
    const storageKey = newStorageKey()
    await this.prisma.cohortFile.create({
      data: { cohortId, purpose, refId, storageKey, originalName: name, mime: input.mime, uploadedBy: userId },
    })

    const exp = Date.now() + SIGNED_URL_TTL_MS
    const sig = signKey(storageKey, exp, 'write')
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.file.upload',
      entityType: 'cohort', entityId: cohortId, meta: { purpose, refId, mime: input.mime },
    })
    return {
      storageKey,
      uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${sig}`,
      maxBytes: MAX_BODY_FILE_BYTES,
      originalName: name,
      mime: input.mime,
    }
  }

  /* ═══ تقريرُ المراجعة — يرفعه المعتمِدُ مع قراره (٨ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: يصل تقريرُ مراجعة الخطّة المدرّبَ **من المنصّة نفسِها** — يُرفع
     على بطاقة المراجعة، ويُحفظ مع الخطّة، وتذكره رسالةُ القرار، ويجده المدرّبُ في رأس صفحة
     شعبته. لا بريدا يُرسَل من خارجها.

     فهو ملفُّ شعبةٍ بغرضه (`review_report`) ورمزُه معرّفُ الخطّة — منه يُعرف أيُّ قرارٍ
     حمله. ويُرفع والخطّةُ بانتظار القرار وحدَها: ما يُرفع بعده لا تذكره رسالةٌ ولا يدري به
     أحد. ويقرؤه من يقرأ ملفّاتِ الشعبة (`assertCanRead`): مدرّبُها والإدارة، لا المتعلّم. */
  private async submittedPlan(planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId }, select: { id: true, cohortId: true, status: true },
    })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (plan.status !== 'submitted') {
      throw new AuthError('not_submitted', 'يُرفع التقريرُ والخطّةُ بانتظار قرارك — ثمّ تذكره رسالةُ القرار', 409)
    }
    return plan
  }

  async startReviewReportUpload(adminId: string, planId: string, input: { mime: string; originalName: string }) {
    assertFileUploadsEnabled('والبديلُ الآن: اكتب ما في التقرير في ملاحظات «اطلب تعديلات» أو في كلمة الاعتماد.')
    const plan = await this.submittedPlan(planId)
    const blocker = fileBlockerAr('review_report', input.mime)
    if (blocker) throw new AuthError('bad_mime', blocker, 422)

    const name = input.originalName.trim().slice(0, 200) || 'تقرير المراجعة'
    const storageKey = newStorageKey()
    await this.prisma.cohortFile.create({
      data: {
        cohortId: plan.cohortId, purpose: 'review_report', refId: plan.id,
        storageKey, originalName: name, mime: input.mime, uploadedBy: adminId,
      },
    })
    const exp = Date.now() + SIGNED_URL_TTL_MS
    const sig = signKey(storageKey, exp, 'write')
    await recordAudit(this.prisma, {
      actorId: adminId, action: 'cohort.file.upload',
      entityType: 'cohort', entityId: plan.cohortId, meta: { purpose: 'review_report', refId: plan.id, mime: input.mime },
    })
    return {
      storageKey,
      uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${sig}`,
      maxBytes: MAX_BODY_FILE_BYTES,
      originalName: name,
      mime: input.mime,
    }
  }

  async removeReviewReport(adminId: string, planId: string, storageKey: string) {
    const plan = await this.submittedPlan(planId)
    const row = await this.prisma.cohortFile.findUnique({
      where: { storageKey }, select: { id: true, cohortId: true, purpose: true, refId: true },
    })
    if (!row || row.purpose !== 'review_report' || row.refId !== plan.id) {
      throw new AuthError('not_found', 'لا تقريرَ بهذا المفتاح لهذه الخطّة', 404)
    }
    await this.prisma.cohortFile.delete({ where: { id: row.id } })
    try { await deleteObject(storageKey) } catch { /* غيابُها ليس عطبا */ }
    await recordAudit(this.prisma, {
      actorId: adminId, action: 'cohort.file.remove',
      entityType: 'cohort', entityId: row.cohortId, meta: { purpose: row.purpose, refId: row.refId },
    })
    return { removed: true }
  }

  /** تقاريرُ مراجعة الشعبة — أحدثُها أوّلا، ولخطّةٍ بعينها إن سُمّيت. والرفعُ الذي لم
      يكتمل (بلا بايتات) لا يُعدّ: صفُّه يُكتب قبل الرفع ليعرفه المخزن */
  async reviewReports(cohortId: string, planId?: string) {
    const rows = await this.prisma.cohortFile.findMany({
      where: { cohortId, purpose: 'review_report', ...(planId ? { refId: planId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { storageKey: true, originalName: true, mime: true, sizeBytes: true, refId: true, createdAt: true },
    })
    const present = await Promise.all(rows.map((r) => objectExists(r.storageKey).catch(() => false)))
    return rows.filter((_, i) => present[i])
  }

  /** ما عُرف عن ملفّاتِ هذه الشعبة — تقرؤه الشاشتان بمفاتيحها */
  async describe(cohortId: string, keys: readonly string[]) {
    if (keys.length === 0) return []
    return this.prisma.cohortFile.findMany({
      where: { cohortId, storageKey: { in: [...keys] } },
      select: { storageKey: true, purpose: true, refId: true, originalName: true, mime: true, sizeBytes: true },
    })
  }

  /* ═══ الحذفُ يُفكّ الإشارةَ ولا يمحو الماضي ═══

     تُمحى البايتاتُ والصفُّ معا. ومن أراد ملفّا آخرَ رفع غيرَه — ولا يبقى
     في المخزن ما لا تشير إليه خطّةٌ حيّة. */
  async detach(userId: string, cohortId: string, storageKey: string) {
    await this.requireCohortTrainer(cohortId, userId)
    const row = await this.prisma.cohortFile.findUnique({
      where: { storageKey }, select: { id: true, cohortId: true, purpose: true, refId: true },
    })
    if (!row || row.cohortId !== cohortId) throw new AuthError('not_found', 'لا ملفَّ بهذا المفتاح', 404)

    await this.prisma.cohortFile.delete({ where: { id: row.id } })
    try { await deleteObject(storageKey) } catch { /* غيابُها ليس عطبا */ }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.file.remove',
      entityType: 'cohort', entityId: cohortId, meta: { purpose: row.purpose, refId: row.refId },
    })
    return { removed: true }
  }

  /* ═══ ومن يقرأ ═══

     المتعلّمُ المسجَّلُ في الشعبة، أو مدرّبُها، أو من يملك مراجعةَ الخطط.
     وما عدا هؤلاء يُردّ **بأربعمئةٍ وأربعة** لا بثلاثمئةٍ وثلاثة: وجودُ
     ملفٍّ لشعبةٍ بعينها خبرٌ في نفسه، ولا يُعطاه من لا يملكها. */
  async assertCanRead(storageKey: string, auth: { userId: string; permissions: readonly string[] }) {
    const row = await this.prisma.cohortFile.findUnique({
      where: { storageKey },
      select: { cohortId: true, originalName: true, mime: true, purpose: true },
    })
    if (!row) throw new AuthError('not_found', 'لا ملفَّ بهذا المفتاح', 404)

    /* والمعتمِدُ يقرأ قبل أن يعتمد: `cohort.plan.approve` هي صلاحيّةُ من
       يقرّر في الخطّة، و`cohort.manage` من يدير الشعب. ولولاهما لاعتُمدت
       وثيقةٌ لم يفتحها أحد.

       و«`cohort.plan.review`» كنتُ كتبتُها هنا أوّلا — مفتاحٌ لا وجودَ له في
       المنصّة. وشرطٌ على مفتاحٍ مخترَعٍ يُقرأ حارسا وهو `false` أبدا. */
    if (auth.permissions.includes('cohort.plan.approve') || auth.permissions.includes('cohort.manage')) {
      return row
    }
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId: auth.userId }, select: { id: true },
    })
    if (profile) {
      const isTrainer = await this.prisma.cohortTrainer.findFirst({
        where: { cohortId: row.cohortId, profileId: profile.id }, select: { id: true },
      })
      if (isTrainer) return row
    }

    /* ═══ والمتعلّمُ يقرأ ما فُتح له — لا كلَّ ما في الشعبة (٢(ب-٢)) ═══

       كان الحارسُ «أله صفُّ تسجيلٍ في الشعبة؟» — فيقرأ المنسحبُ والمنتظرُ في
       القائمة، ويقرأ المسجَّلُ كلَّ ملفٍّ رفعه المدرّب: متنَ محورٍ لم يحن
       موعدُه، وكرّاسةَ موعدٍ قادم، وملفّا في مسودّةٍ لم تُعتمد بعد. والشاشةُ
       تحجبها، والمفتاحُ يُقرأ من نداءٍ مباشر.

       فصار الحكمُ ما يحكم به محتوى الشعبة نفسُه: الملفُّ مقروءٌ حين يكون
       مفتاحُه فيما يصل المتعلّمَ الآن من خطّتها المعتمَدة
       (`projectPlanForLearner` بالبوّابة نفسِها) — ولا ملفَّ بعد انتهاء الوصول. */
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { cohortId: row.cohortId, userId: auth.userId, status: { in: ['enrolled', 'completed'] } },
      select: { id: true },
    })
    if (enrolled && (await this.openToLearner(row.cohortId, storageKey))) return row

    throw new AuthError('not_found', 'لا ملفَّ بهذا المفتاح', 404)
  }

  /** أيصل هذا المفتاحُ المتعلّمَ الآن — متنُ محورٍ فُتح، أو كرّاسةُ الشعبة أو موعدٍ فُتح، أو مصدرٌ أو مرفقُ مهمّةٍ فُتح */
  private async openToLearner(cohortId: string, storageKey: string, now = new Date()): Promise<boolean> {
    const loaded = await loadLearnerGate(this.prisma, cohortId, now)
    if (!loaded || loaded.gate.access === 'ended') return false
    const view = projectPlanForLearner(loaded.plan, now, loaded.gate)
    if (!view) return false
    /* ومرفقاتُ المهامّ المرفوعة (٣٠ سبتمبر ٢٠٢٦) — لمهمّةٍ منشورةٍ فُتحت له،
       بالبوّابة نفسِها التي يرى بها المهمّة: قبل فتحها لا يُقرأ مرفقُها */
    const tasks = await this.prisma.cohortAssessment.findMany({
      where: { cohortId, status: 'published' },
      select: { moduleId: true, attachments: true },
    })
    const taskKeys = tasks
      .filter((t) => {
        const at = assessmentOpensAt(loaded.gate, t.moduleId)
        return at === null || at.getTime() <= now.getTime()
      })
      .flatMap((t) => readTypedLinks(t.attachments).map((l) => l.bodyFileKey))
    const keys = [
      ...taskKeys,
      ...view.modules.map((m) => m.bodyFileKey),
      ...(view.slots ?? []).map((s) => s.workbook?.bodyFileKey),
      /* وكرّاسةُ الشعبة الواحدة — ومفتاحُها لا يصل الإسقاطَ قبل أوّل يومٍ فيها */
      view.workbook?.file?.bodyFileKey,
      /* وكرّاساتُ المحاور — كلٌّ بموعد أسبق محاورها (٦ أكتوبر ٢٠٢٦) */
      ...(view.moduleWorkbooks ?? []).map((w) => w.file?.bodyFileKey),
      ...view.resources.map((r) => r.bodyFileKey),
    ]
    return keys.includes(storageKey)
  }
}
