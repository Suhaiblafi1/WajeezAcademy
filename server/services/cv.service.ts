/* خدمة السير الذاتية — رفع اختياري بموافقة صريحة موثقة، تخزين خاص،
   كل مشاهدة أو تنزيل مسجل في سجل التدقيق، وحذف وفق السياسة.
   القاعدة الصارمة: السيرة لا تُرسل إلى أي ذكاء اصطناعي ولا تدخل قرار التشخيص حاليا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS } from './storage.service'

const MAX_CV_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png',
])
const CONSENT_TEXT_VERSION = 'cv-upload-v1' // نص الموافقة: مشاركة سيرتي مع فريق وجيز لغرض الإرشاد فقط

export class CvService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** رفع سيرة — موافقة صريحة إلزامية، تحقق نوع وحجم على الخادم، يعيد رابط رفع موقعا */
  async upload(userId: string, input: {
    originalName: string; mime: string; sizeBytes: number; consent: boolean
  }, ip?: string) {
    if (!input.consent) {
      throw new AuthError('consent_required', 'رفع السيرة يتطلب موافقتك الصريحة على مشاركتها مع فريق وجيز')
    }
    if (!ALLOWED_MIMES.has(input.mime)) {
      throw new AuthError('bad_type', 'صيغة غير مدعومة — المقبول: PDF أو Word أو صورة')
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_CV_BYTES) {
      throw new AuthError('too_large', 'حجم السيرة يتجاوز 10MB', 413)
    }

    const consent = await this.prisma.consentRecord.create({
      data: { userId, kind: 'cv_upload', textVersion: CONSENT_TEXT_VERSION, ip },
    })
    const storageKey = newStorageKey()
    const cv = await this.prisma.cvSubmission.create({
      data: { userId, consentId: consent.id, storageKey, originalName: input.originalName, mime: input.mime, sizeBytes: input.sizeBytes },
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'cv.upload', entityType: 'cv_submission', entityId: cv.id, ip })
    const exp = Date.now() + SIGNED_URL_TTL_MS
    return { cv, uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}` }
  }

  async listMine(userId: string) {
    return this.prisma.cvSubmission.findMany({
      where: { userId, status: 'active' },
      select: { id: true, originalName: true, mime: true, sizeBytes: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** رابط قراءة موقع — لصاحب السيرة، أو لمستشار مسند له حالة العميل، أو لمدير cv.manage.
      كل مشاهدة تُسجل باسم من شاهد ووقتها */
  async readUrl(cvId: string, viewerId: string, viewerPermissions: string[], ip?: string) {
    const cv = await this.prisma.cvSubmission.findUnique({ where: { id: cvId } })
    if (!cv || cv.status !== 'active') throw new AuthError('not_found', 'السيرة غير موجودة', 404)

    const isOwner = cv.userId === viewerId
    const canManage = viewerPermissions.includes('cv.manage')
    let isAssignedAdvisor = false
    if (!isOwner && !canManage && viewerPermissions.includes('cv.view')) {
      isAssignedAdvisor = !!(await this.prisma.advisorAssignment.findFirst({
        where: { advisorId: viewerId, unassignedAt: null, case: { clientId: cv.userId } },
      }))
    }
    if (!isOwner && !canManage && !isAssignedAdvisor) {
      throw new AuthError('forbidden', 'لا تملك صلاحية عرض هذه السيرة', 403)
    }
    await recordAudit(this.prisma, {
      actorId: viewerId, action: isOwner ? 'cv.view_own' : 'cv.view', entityType: 'cv_submission', entityId: cvId, ip,
    })
    const exp = Date.now() + SIGNED_URL_TTL_MS
    return `/api/v1/documents/${cv.storageKey}?exp=${exp}&sig=${signKey(cv.storageKey, exp, 'read')}`
  }

  /** حذف وفق السياسة — حذف منطقي موثق لا إزالة فعلية من الأثر */
  async remove(cvId: string, actorId: string, actorPermissions: string[], reason: string) {
    const cv = await this.prisma.cvSubmission.findUnique({ where: { id: cvId } })
    if (!cv || cv.status !== 'active') throw new AuthError('not_found', 'السيرة غير موجودة', 404)
    if (cv.userId !== actorId && !actorPermissions.includes('cv.manage')) {
      throw new AuthError('forbidden', 'حذف سيرة الغير يتطلب صلاحية الإدارة', 403)
    }
    if (reason.trim().length < 5) throw new AuthError('no_reason', 'الحذف يتطلب سببا موثقا')
    const updated = await this.prisma.cvSubmission.update({
      where: { id: cvId }, data: { status: 'deleted', deletedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cv.delete', entityType: 'cv_submission', entityId: cvId, reason,
    })
    return updated
  }
}
