/* «التسويق» — ما يقدّمه المدرّبُ ليُعرَّف به، وملصقاتٌ تصمّمها الإدارةُ له.

   ═══ القرار (٢٩ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أضِف قسما اسمُه التسويق؛ يرفع فيه المدرّبُ رابطَ
   فيديو يتحدّث فيه عن نفسه وعن دوراته أو مسار تعلّمه ليقنع الناسَ
   بالانضمام. ونحن الإدارةَ نصمّم ملصقا لكلّ دورةٍ له أو مسار، ويرفع هو
   صورتَه أيضا لنصنع التصميمَ الذي يحتاج أن يوافق عليه قبل أن نستعمله علنا».

   ═══ ثلاثةُ أشياء، ولكلٍّ صاحبُه ═══

   ① **الفيديو رابطٌ لا ملفّ** — تعريفٌ به (`bio`)، وواحدٌ لكلّ دورةٍ أو
      مسار. والفيديو لا يُرفع إلى المنصّة بقرارٍ قديم (سقفُ الجسم أربعةُ
      ميغابايت)، فيُلصق رابطُه من يوتيوب أو Drive أو غيرهما.
   ② **الصورُ** يرفعها هو، وتختار منها الإدارةُ ما يصلح للملصق. ملفٌّ في
      المخزن حين يكون الرفعُ مفعّلا (`FILE_UPLOADS=on`)، ورابطٌ حين لا يكون —
      فلا يقف القسمُ على قرار تشغيل.
   ③ **الملصق** تصمّمه الإدارة (`trainer.publish` — «الموافقة على ظهور
      المدرّب للعامّة»، وهذا ظهورُه للعامّة بعينه). ويمرّ بحالاتٍ:

        draft ← تُرفع بايتاتُه ← pending (يصل المدرّبَ ويُشعَر)
          ← approved          يوافق — فيصير صالحا للاستعمال العامّ
          ← changes_requested يطلب تعديلا بسببٍ يكتبه — فتعود الإدارةُ بنسخة
        وكلُّ نسخةٍ جديدةٍ تُزيح ما قبلها غيرَ الموافَق عليه (`superseded`).

      **ولا استعمالَ علنيٌّ بلا موافقته**: الحالُ `approved` وحدَها تقول ذلك،
      ولا يكتبها إلّا بابُه هو (`decidePoster`) — لا بابٌ للإدارة.

   ═══ وما يملكه كلٌّ منهما ═══

   المدرّبُ يكتب فيديوهاتِه وصورَه لدوراتٍ أُهِّل لها ومساراتٍ بناها —
   لا لغيرها. والإدارةُ لا تكتب فيديوهاتِه ولا صورَه، ولا تقرّر عنه في
   ملصقه. والملفُّ يُستخرَج من حسابه لا من جسم الطلب. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import {
  assertFileUploadsEnabled, fileUploadsEnabled, newStorageKey, signKey,
  MAX_MARKETING_IMAGE_BYTES, PHOTO_MIMES, SIGNED_URL_TTL_MS,
} from './storage.service'
import { deleteObject } from './object-store'
import { MATERIALS_STATUSES, portalDoorProblemAr } from '../../src/application/trainer/portal-access'
import {
  cleanMarketingUrl, MAX_MARKETING_NOTE, MAX_MARKETING_PHOTOS, type MarketingTargetKind,
} from '../../src/application/trainer/marketing'

/** ما يُعرض — ساعةٌ تكفي جلسةَ عملٍ على ملصق، والرابطُ يُجدَّد بكلّ تحميل */
const READ_TTL_MS = 60 * 60 * 1000

function readUrl(storageKey: string): string {
  const exp = Date.now() + READ_TTL_MS
  return `/api/v1/documents/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'read')}`
}

function writeUrl(storageKey: string): string {
  const exp = Date.now() + SIGNED_URL_TTL_MS
  return `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`
}

interface Target { kind: 'course' | 'path'; id: string; titleAr: string }

type PosterRow = {
  id: string; targetKind: string; targetId: string; version: number
  storageKey: string | null; url: string | null; status: string
  staffNoteAr: string | null; trainerNoteAr: string | null
  createdAt: Date; submittedAt: Date | null; decidedAt: Date | null
}

function posterView(p: PosterRow) {
  return {
    id: p.id, targetKind: p.targetKind, targetId: p.targetId, version: p.version,
    imageUrl: p.storageKey ? readUrl(p.storageKey) : p.url,
    status: p.status, staffNoteAr: p.staffNoteAr, trainerNoteAr: p.trainerNoteAr,
    createdAt: p.createdAt, submittedAt: p.submittedAt, decidedAt: p.decidedAt,
  }
}

export class TrainerMarketingService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ═══════════ المدرّب ═══════════ */

  /** ملفُّ صاحب الجلسة — والموقوفُ لا يكتب. بابُ الموادّ نفسُه: التعريفُ
      بالدورة من إعدادها، ويُفتح بتوقيع العرض المشروط. */
  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: { select: { status: true, fullName: true } } },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملفَّ مدرّبٍ مرتبطا بهذا الحساب', 404)
    const problem = portalDoorProblemAr('materials', {
      status: profile.application.status, suspendedAt: profile.suspendedAt,
    })
    if (problem) throw new AuthError('suspended', problem, 403)
    return profile
  }

  /** ما يجوز أن يُسوَّق له: دوراتٌ أُهِّل لها، ومساراتٌ بناها ولم تُرفض */
  private async targetsOf(profileId: string): Promise<Target[]> {
    const [quals, paths] = await Promise.all([
      this.prisma.trainerCourseQualification.findMany({
        where: { profileId, status: 'qualified' },
        select: {
          courseId: true,
          course: { select: { currentVersion: true, versions: { select: { version: true, titleAr: true } } } },
        },
      }),
      this.prisma.trainerPath.findMany({
        where: { profileId, status: { not: 'rejected' } },
        select: { id: true, titleAr: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    return [
      ...quals.map((q) => ({
        kind: 'course' as const, id: q.courseId,
        titleAr: q.course.versions.find((v) => v.version === q.course.currentVersion)?.titleAr ?? '',
      })),
      ...paths.map((p) => ({ kind: 'path' as const, id: p.id, titleAr: p.titleAr })),
    ]
  }

  private assertTarget(targets: Target[], kind: string, id: string): Target {
    const t = targets.find((x) => x.kind === kind && x.id === id)
    if (!t) throw new AuthError('unknown_target', 'ليست من دوراتك ولا مسارا لك', 404)
    return t
  }

  /** كلُّ ما في القسم لصاحبه — أو للإدارة عن ملفٍّ بعينه */
  private async view(profileId: string, forStaff: boolean) {
    const [targets, videos, photos, posters] = await Promise.all([
      this.targetsOf(profileId),
      this.prisma.trainerMarketingVideo.findMany({ where: { profileId } }),
      this.prisma.trainerMarketingPhoto.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.trainerPoster.findMany({
        /* والمسوّدةُ لا تُرى للمدرّب: لم تُرسَل إليه بعد، وقد لا تكون بايتاتُها رُفعت */
        where: { profileId, ...(forStaff ? {} : { status: { not: 'draft' } }) },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      }),
    ])
    const videoOf = (kind: string, id: string) => {
      const v = videos.find((x) => x.targetKind === kind && x.targetId === id)
      return v ? { url: v.url, noteAr: v.noteAr, updatedAt: v.updatedAt } : null
    }
    return {
      uploadsEnabled: fileUploadsEnabled(),
      bioVideo: videoOf('bio', ''),
      photos: photos.map((p) => ({
        id: p.id, captionAr: p.captionAr, createdAt: p.createdAt,
        imageUrl: p.storageKey ? readUrl(p.storageKey) : p.url,
      })),
      targets: targets.map((t) => ({
        ...t,
        video: videoOf(t.kind, t.id),
        posters: posters.filter((p) => p.targetKind === t.kind && p.targetId === t.id).map(posterView),
      })),
    }
  }

  async mine(userId: string) {
    const profile = await this.profileForUser(userId)
    return this.view(profile.id, false)
  }

  /** رابطُ فيديو — يُكتب أو يُبدَّل، و`url: null` يمحوه */
  async setVideo(userId: string, input: { targetKind: MarketingTargetKind; targetId?: string | null; url: string | null; noteAr?: string | null }) {
    const profile = await this.profileForUser(userId)
    const targetId = input.targetKind === 'bio' ? '' : String(input.targetId ?? '')
    if (input.targetKind !== 'bio') {
      this.assertTarget(await this.targetsOf(profile.id), input.targetKind, targetId)
    }
    const where = { profileId_targetKind_targetId: { profileId: profile.id, targetKind: input.targetKind, targetId } }

    if (input.url === null || input.url.trim() === '') {
      await this.prisma.trainerMarketingVideo.deleteMany({ where: { profileId: profile.id, targetKind: input.targetKind, targetId } })
      await recordAudit(this.prisma, {
        actorId: userId, action: 'trainer.marketing.video.remove', entityType: 'trainer_profile', entityId: profile.id,
        meta: { targetKind: input.targetKind, targetId },
      })
      return { removed: true }
    }
    const url = cleanMarketingUrl(input.url)
    if (!url) throw new AuthError('bad_url', 'الرابطُ يبدأ بـhttps:// — ألصِقْه كما يظهر في المتصفّح', 422)
    const noteAr = String(input.noteAr ?? '').trim().slice(0, MAX_MARKETING_NOTE) || null
    const row = await this.prisma.trainerMarketingVideo.upsert({
      where,
      create: { profileId: profile.id, targetKind: input.targetKind, targetId, url, noteAr },
      update: { url, noteAr },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.marketing.video.set', entityType: 'trainer_profile', entityId: profile.id,
      meta: { targetKind: input.targetKind, targetId },
    })
    return { url: row.url, noteAr: row.noteAr, updatedAt: row.updatedAt }
  }

  /** صورةٌ للملصقات — ملفٌّ برابطِ رفعٍ موقّت، أو رابطٌ حين يكون الرفعُ مطفأً */
  async addPhoto(userId: string, input: { mime?: string | null; url?: string | null; captionAr?: string | null }) {
    const profile = await this.profileForUser(userId)
    const count = await this.prisma.trainerMarketingPhoto.count({ where: { profileId: profile.id } })
    if (count >= MAX_MARKETING_PHOTOS) {
      throw new AuthError('too_many', `يكفي ${MAX_MARKETING_PHOTOS} صور — احذف واحدةً قبل أن تضيف`, 409)
    }
    const captionAr = String(input.captionAr ?? '').trim().slice(0, MAX_MARKETING_NOTE) || null

    if (input.url) {
      const url = cleanMarketingUrl(input.url)
      if (!url) throw new AuthError('bad_url', 'الرابطُ يبدأ بـhttps://', 422)
      const row = await this.prisma.trainerMarketingPhoto.create({ data: { profileId: profile.id, url, captionAr } })
      await recordAudit(this.prisma, {
        actorId: userId, action: 'trainer.marketing.photo.add', entityType: 'trainer_profile', entityId: profile.id,
        meta: { photoId: row.id, byLink: true },
      })
      return { id: row.id }
    }

    assertFileUploadsEnabled('والبديلُ الآن: ألصِقْ رابطَ صورتك (Drive أو غيره).')
    if (!(PHOTO_MIMES as readonly string[]).includes(String(input.mime))) {
      throw new AuthError('bad_mime', 'الصورةُ JPEG أو PNG أو WebP', 422)
    }
    /* الصفُّ قبل الرابط: `resolveStorageOwner` يقرأ المالكَ من القاعدة */
    const storageKey = newStorageKey()
    const row = await this.prisma.trainerMarketingPhoto.create({ data: { profileId: profile.id, storageKey, captionAr } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.marketing.photo.add', entityType: 'trainer_profile', entityId: profile.id,
      meta: { photoId: row.id, byLink: false },
    })
    return { id: row.id, uploadUrl: writeUrl(storageKey), maxBytes: MAX_MARKETING_IMAGE_BYTES }
  }

  async removePhoto(userId: string, photoId: string) {
    const profile = await this.profileForUser(userId)
    const row = await this.prisma.trainerMarketingPhoto.findFirst({ where: { id: photoId, profileId: profile.id } })
    if (!row) throw new AuthError('not_found', 'لا صورةَ بهذا المعرّف', 404)
    await this.prisma.trainerMarketingPhoto.delete({ where: { id: row.id } })
    if (row.storageKey) { try { await deleteObject(row.storageKey) } catch { /* غيابُها ليس عطبا */ } }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.marketing.photo.remove', entityType: 'trainer_profile', entityId: profile.id,
      meta: { photoId: row.id },
    })
    return { removed: true }
  }

  /** ═══ قرارُه في الملصق — وهو وحدَه من يكتب `approved` ═══ */
  async decidePoster(userId: string, posterId: string, decision: 'approve' | 'changes', noteAr?: string | null) {
    const profile = await this.profileForUser(userId)
    const poster = await this.prisma.trainerPoster.findFirst({ where: { id: posterId, profileId: profile.id } })
    if (!poster) throw new AuthError('not_found', 'لا ملصقَ بهذا المعرّف', 404)
    if (poster.status !== 'pending') throw new AuthError('bad_state', 'هذا الملصقُ لا ينتظر قرارَك', 409)
    const note = String(noteAr ?? '').trim()
    if (decision === 'changes' && note.length < 5) {
      throw new AuthError('note_required', 'اكتب ما تريد تعديلَه — سطرٌ واحدٌ يكفي', 422)
    }
    const at = new Date()
    /* شرطُ الحال في الكتابة نفسِها: نقرتان متزامنتان لا تكتبان قرارين */
    const res = await this.prisma.trainerPoster.updateMany({
      where: { id: poster.id, status: 'pending' },
      data: {
        status: decision === 'approve' ? 'approved' : 'changes_requested',
        trainerNoteAr: note ? note.slice(0, MAX_MARKETING_NOTE) : null,
        decidedAt: at,
      },
    })
    if (res.count === 0) throw new AuthError('bad_state', 'سبقك قرارٌ على هذا الملصق — حدّث الصفحة', 409)
    await recordAudit(this.prisma, {
      actorId: userId,
      action: decision === 'approve' ? 'trainer.poster.approve' : 'trainer.poster.request_changes',
      entityType: 'trainer_profile', entityId: profile.id,
      meta: { posterId: poster.id, targetKind: poster.targetKind, targetId: poster.targetId, version: poster.version },
    })
    /* ويصل خبرُه من صمّمه — فالتعديلُ عنده والاستعمالُ بإذنه */
    if (poster.createdBy) {
      await safeNotify(this.prisma, {
        userId: poster.createdBy, channel: 'in_app', audience: 'staff',
        templateKey: 'trainer.poster.decided',
        title: decision === 'approve' ? 'وافق المدرّبُ على ملصقه' : 'طلب المدرّبُ تعديلَ ملصقه',
        body: decision === 'approve'
          ? `وافق ${profile.application.fullName} على النسخة ${poster.version} — صار صالحا للاستعمال العامّ.`
          : `طلب ${profile.application.fullName} تعديلَ النسخة ${poster.version}: ${note}`,
        data: { posterId: poster.id, profileId: profile.id },
      })
    }
    return { status: decision === 'approve' ? 'approved' : 'changes_requested' }
  }

  /* ═══════════ الإدارة — `trainer.publish` ═══════════ */

  /** من له في القسم شيء — وما ينتظر كلَّ واحد */
  async adminList() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: { userId: { not: null } },
      select: {
        id: true,
        application: { select: { fullName: true, email: true, status: true } },
        _count: { select: { marketingVideos: true, marketingPhotos: true } },
        posters: { select: { status: true } },
      },
    })
    return profiles
      /* من يعمل على موادّه (`MATERIALS_STATUSES`)، ومن سبق أن كان له في القسم شيء */
      .filter((p) => MATERIALS_STATUSES.includes(p.application.status) || p._count.marketingVideos + p._count.marketingPhotos + p.posters.length > 0)
      .map((p) => ({
        profileId: p.id,
        fullName: p.application.fullName,
        email: p.application.email,
        videos: p._count.marketingVideos,
        photos: p._count.marketingPhotos,
        posters: {
          pending: p.posters.filter((x) => x.status === 'pending').length,
          approved: p.posters.filter((x) => x.status === 'approved').length,
          changesRequested: p.posters.filter((x) => x.status === 'changes_requested').length,
        },
      }))
      .sort((a, b) => b.posters.changesRequested - a.posters.changesRequested
        || (b.videos + b.photos) - (a.videos + a.photos)
        || a.fullName.localeCompare(b.fullName, 'ar'))
  }

  async adminDetail(profileId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, application: { select: { fullName: true, email: true } } },
    })
    if (!profile) throw new AuthError('not_found', 'لا ملفَّ مدرّبٍ بهذا المعرّف', 404)
    return { profileId: profile.id, fullName: profile.application.fullName, email: profile.application.email, ...(await this.view(profile.id, true)) }
  }

  /** نسخةُ ملصقٍ جديدة — مسوّدةً حتّى تُرسَل. ملفٌّ برابطِ رفع، أو رابطُ تصميمٍ جاهز */
  async createPoster(actorId: string, profileId: string, input: {
    targetKind: 'course' | 'path'; targetId: string; mime?: string | null; url?: string | null; staffNoteAr?: string | null
  }) {
    const targets = await this.targetsOf(profileId)
    this.assertTarget(targets, input.targetKind, input.targetId)
    const last = await this.prisma.trainerPoster.findFirst({
      where: { profileId, targetKind: input.targetKind, targetId: input.targetId },
      orderBy: { version: 'desc' }, select: { version: true },
    })
    const staffNoteAr = String(input.staffNoteAr ?? '').trim().slice(0, MAX_MARKETING_NOTE) || null
    const base = {
      profileId, targetKind: input.targetKind, targetId: input.targetId,
      version: (last?.version ?? 0) + 1, staffNoteAr, createdBy: actorId, status: 'draft',
    }
    if (input.url) {
      const url = cleanMarketingUrl(input.url)
      if (!url) throw new AuthError('bad_url', 'الرابطُ يبدأ بـhttps://', 422)
      const row = await this.prisma.trainerPoster.create({ data: { ...base, url } })
      return { id: row.id }
    }
    assertFileUploadsEnabled('والبديلُ الآن: ألصِقْ رابطَ التصميم.')
    if (!(PHOTO_MIMES as readonly string[]).includes(String(input.mime))) {
      throw new AuthError('bad_mime', 'الملصقُ JPEG أو PNG أو WebP', 422)
    }
    const storageKey = newStorageKey()
    const row = await this.prisma.trainerPoster.create({ data: { ...base, storageKey } })
    return { id: row.id, uploadUrl: writeUrl(storageKey), maxBytes: MAX_MARKETING_IMAGE_BYTES }
  }

  /** الإرسالُ إلى المدرّب — ويُزيح كلَّ نسخةٍ قبلها لم يوافق عليها */
  async submitPoster(actorId: string, posterId: string) {
    const poster = await this.prisma.trainerPoster.findUnique({
      where: { id: posterId },
      include: { profile: { select: { userId: true } } },
    })
    if (!poster) throw new AuthError('not_found', 'لا ملصقَ بهذا المعرّف', 404)
    if (poster.status !== 'draft') throw new AuthError('bad_state', 'أُرسل هذا الملصقُ من قبل', 409)
    if (!poster.url && !poster.storageKey) throw new AuthError('no_image', 'لا تصميمَ في هذه النسخة', 409)
    const at = new Date()
    await this.prisma.$transaction([
      this.prisma.trainerPoster.updateMany({
        where: {
          profileId: poster.profileId, targetKind: poster.targetKind, targetId: poster.targetId,
          id: { not: poster.id }, status: { in: ['draft', 'pending', 'changes_requested'] },
        },
        data: { status: 'superseded' },
      }),
      this.prisma.trainerPoster.update({ where: { id: poster.id }, data: { status: 'pending', submittedAt: at } }),
    ])
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.poster.submit', entityType: 'trainer_profile', entityId: poster.profileId,
      meta: { posterId: poster.id, targetKind: poster.targetKind, targetId: poster.targetId, version: poster.version },
    })
    if (poster.profile.userId) {
      await safeNotify(this.prisma, {
        userId: poster.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.poster.submitted',
        title: 'ملصقٌ جديدٌ ينتظر موافقتك',
        body: `صمّمنا ملصقا لـ${poster.targetKind === 'course' ? 'دورتك' : 'مسارك'} — `
          + 'لا نستعمله علنا حتّى توافق عليه أو تطلب تعديله.',
        data: { posterId: poster.id },
      })
    }
    return { status: 'pending' }
  }

  /** حذفُ مسوّدةٍ لم تُرسَل — ما أُرسل سجلٌّ لا يُمحى */
  async deleteDraftPoster(actorId: string, posterId: string) {
    const poster = await this.prisma.trainerPoster.findUnique({ where: { id: posterId } })
    if (!poster) throw new AuthError('not_found', 'لا ملصقَ بهذا المعرّف', 404)
    if (poster.status !== 'draft') throw new AuthError('bad_state', 'لا تُحذف إلّا مسوّدةٌ لم تُرسَل', 409)
    await this.prisma.trainerPoster.delete({ where: { id: poster.id } })
    if (poster.storageKey) { try { await deleteObject(poster.storageKey) } catch { /* لا شيء */ } }
    void actorId
    return { removed: true }
  }
}
