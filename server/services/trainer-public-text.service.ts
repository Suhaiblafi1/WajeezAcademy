/* عنوانُ المدرّب ونبذتُه — يكتبهما هو، ويعدّلهما المعتمِدُ إن شاء، ثمّ يعتمد.

   القرارُ وقواعدُ الطول في `src/application/trainer/public-text.ts`. وهنا
   الطريقُ كلُّه، على مثال الصورة (`approvePendingPhoto`):

   · المدرّبُ يرسل → يسكن `headlinePending` و`bioPending`، ولا تمسّ الصفحةُ
     العامّةُ شيئا. ويصل الإدارةَ خبرُه.
   · المعتمِدُ يقرأ ما أرسله **معبّأً في حقلين يحرّرهما** → «اعتمِدْ» يكتب ما في
     الحقلين — كما أرسله أو كما عدّله — في `headline` و`bioPublic`.
   · أو يردّه بسبب → يُمحى المعلَّقُ، ويبقى السببُ في حسابه حتّى يرسل ثانية.

   والمعتمَدُ قبله يبقى معروضا ما دام الجديدُ معلَّقا: إرسالٌ لم يُقرأ لا يُخلي
   صفحةَ أحد. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { publicTextProblemAr } from '../../src/application/trainer/public-text'

export interface MyPublicText {
  headline: string | null
  bioPublic: string | null
  headlinePending: string | null
  bioPending: string | null
  pendingAt: Date | null
  rejectNoteAr: string | null
  /** أظاهرٌ اسمُه للعامّة الآن — فيُقال له متى يُرى ما يكتب */
  published: boolean
}

export class TrainerPublicTextService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  private async profileOf(userId: string) {
    const p = await this.prisma.trainerProfile.findFirst({
      where: { userId },
      select: {
        id: true, headline: true, bioPublic: true, headlinePending: true, bioPending: true,
        publicTextPendingAt: true, publicTextRejectNoteAr: true, publishApprovedAt: true,
        application: { select: { fullName: true } },
      },
    })
    if (!p) throw new AuthError('no_trainer_profile', 'لا ملفَّ مدرّبٍ لهذا الحساب', 404)
    return p
  }

  async mine(userId: string): Promise<MyPublicText> {
    const p = await this.profileOf(userId)
    return {
      headline: p.headline, bioPublic: p.bioPublic,
      headlinePending: p.headlinePending, bioPending: p.bioPending,
      pendingAt: p.publicTextPendingAt, rejectNoteAr: p.publicTextRejectNoteAr,
      published: p.publishApprovedAt !== null,
    }
  }

  async submit(userId: string, input: { headline: string; bio: string }): Promise<MyPublicText> {
    const p = await this.profileOf(userId)
    const headline = input.headline.trim()
    const bio = input.bio.trim()
    const problem = publicTextProblemAr(headline, bio)
    if (problem) throw new AuthError('bad_public_text', problem, 422)
    /* ما يطابق المعتمَدَ حرفا لا يُرسَل: لا جديدَ يُقرأ، وطابورٌ لا شيءَ فيه يكذب */
    if (headline === (p.headline ?? '') && bio === (p.bioPublic ?? '')) {
      throw new AuthError('unchanged', 'هذا ما هو معتمَدٌ لك الآن — غيّر شيئا ثمّ أرسِل', 409)
    }
    await this.prisma.trainerProfile.update({
      where: { id: p.id },
      data: {
        headlinePending: headline, bioPending: bio,
        publicTextPendingAt: new Date(), publicTextRejectNoteAr: null,
      },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.public_text.submit', entityType: 'trainer_profile', entityId: p.id,
    })
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app', templateKey: 'trainer.public_text.submitted',
      title: 'نبذةُ مدرّبٍ تنتظر اعتمادك',
      body: `أرسل ${p.application.fullName} عنوانَه المهنيَّ ونبذتَه لصفحة «المدربون» — اقرأهما وعدّلهما إن شئت ثمّ اعتمِدْ.`,
      data: { profileId: p.id },
    }).catch(() => undefined)
    return this.mine(userId)
  }

  /** الاعتمادُ بما في الحقلين — كما أرسله، أو كما عدّله المعتمِد */
  async approve(profileId: string, actorId: string, input: { headline: string; bioPublic: string }) {
    const p = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true, headlinePending: true, bioPending: true, publicTextPendingAt: true },
    })
    if (!p) throw new AuthError('not_found', 'الملفُّ غيرُ موجود', 404)
    if (!p.publicTextPendingAt) throw new AuthError('no_pending_text', 'لا نبذةَ تنتظر الاعتماد', 409)
    const headline = input.headline.trim()
    const bioPublic = input.bioPublic.trim()
    /* والمعتمِدُ لا يُحاسَب بسقف الكلمات — قد يُبقي نبذةً أطولَ عن قصد —
       لكنّه لا يعتمد فراغا: ذاك ردٌّ لا اعتماد. */
    if (headline.length < 3 || bioPublic.length < 3) {
      throw new AuthError('empty_public_text', 'العنوانُ والنبذةُ لا يُعتمَدان فارغَين — أو ردَّهما', 422)
    }
    const edited = headline !== (p.headlinePending ?? '') || bioPublic !== (p.bioPending ?? '')
    await this.prisma.trainerProfile.update({
      where: { id: p.id },
      data: {
        headline, bioPublic,
        headlinePending: null, bioPending: null, publicTextPendingAt: null, publicTextRejectNoteAr: null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.public_text.approve', entityType: 'trainer_profile', entityId: p.id,
      meta: { edited },
    })
    if (p.userId) {
      await safeNotify(this.prisma, {
        userId: p.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.public_text.approved',
        title: 'اعتُمدت نبذتُك',
        body: edited
          ? 'اعتمدنا عنوانَك المهنيَّ ونبذتَك بعد تحريرٍ يسير — تجدهما كما اعتُمدا في «إعدادات الحساب».'
          : 'اعتمدنا عنوانَك المهنيَّ ونبذتَك كما كتبتَهما.',
        data: { profileId: p.id },
      })
    }
    return { headline, bioPublic, edited }
  }

  async reject(profileId: string, actorId: string, reasonAr: string) {
    const p = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, userId: true, publicTextPendingAt: true },
    })
    if (!p) throw new AuthError('not_found', 'الملفُّ غيرُ موجود', 404)
    if (!p.publicTextPendingAt) throw new AuthError('no_pending_text', 'لا نبذةَ تنتظر الاعتماد', 409)
    const reason = reasonAr.trim()
    if (reason.length < 3) throw new AuthError('reason_required', 'اكتب له سببَ الردّ — يقرؤه في حسابه', 422)
    await this.prisma.trainerProfile.update({
      where: { id: p.id },
      data: {
        headlinePending: null, bioPending: null, publicTextPendingAt: null,
        publicTextRejectNoteAr: reason.slice(0, 500),
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.public_text.reject', entityType: 'trainer_profile', entityId: p.id,
      reason: reason.slice(0, 500),
    })
    if (p.userId) {
      await safeNotify(this.prisma, {
        userId: p.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.public_text.rejected',
        title: 'لم نعتمد نبذتَك بعد',
        body: `السبب: ${reason.slice(0, 200)} — عدّلها في «إعدادات الحساب» وأرسِلها ثانية.`,
        data: { profileId: p.id },
      })
    }
    return { ok: true }
  }
}
