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
import { deleteObject } from './object-store'
import {
  fileBlockerAr, MAX_BODY_FILE_BYTES, type FilePurpose,
} from '../../src/application/trainer/module-body'

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
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { cohortId: row.cohortId, userId: auth.userId },
      select: { id: true },
    })
    if (enrolled) return row

    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId: auth.userId }, select: { id: true },
    })
    if (profile) {
      const isTrainer = await this.prisma.cohortTrainer.findFirst({
        where: { cohortId: row.cohortId, profileId: profile.id }, select: { id: true },
      })
      if (isTrainer) return row
    }

    throw new AuthError('not_found', 'لا ملفَّ بهذا المفتاح', 404)
  }
}
