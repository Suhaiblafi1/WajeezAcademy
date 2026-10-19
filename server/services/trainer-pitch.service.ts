/* «لماذا اخترناه» — نكتبه نحن عن المدرّب، ويقبله أو يرفضه (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أضف كلماتٍ تشجّع الناس لهذا المدرّب، والمدرّب يوافق أو
   يرفض التعديل». وهو بعينه قرارُ ١٢ أكتوبر في كلّ ما نقترحه على المدرّب: بطاقةُ
   «قبل/بعد» يقبلها أو يرفضها، لا طلبٌ يعمله بنفسه. والقواعدُ في
   `src/application/trainer/pitch.ts`.

   والطريقُ كلُّه:
   · المعتمِدُ يقترح سطورا → صفٌّ `pending` يحمل `before` (المعروضَ الآن) و`lines`.
     ويُسحب ما كان معلَّقا قبله: بطاقتان معلَّقتان لشيءٍ واحدٍ تُربكان من يقرّر.
   · المدرّبُ يقبل → تُكتب السطورُ في `pitchLines`، وهي وحدَها ما تقرؤه الصفحةُ العامّة.
   · أو يرفض → يبقى المعروضُ كما هو، وكلمتُه إن كتبها تصل الإدارة.
   · والمعتمِدُ يسحب المعلَّقَ ما لم يُقرَّر فيه. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { cleanPitchLines, pitchProblemAr } from '../../src/application/trainer/pitch'

export interface PitchPending {
  id: string
  before: string[]
  lines: string[]
  createdAt: Date
}

export interface MyPitch {
  /** ما يُعرض للعامّة الآن — فارغٌ حتّى يقبل أوّلَ اقتراح */
  lines: string[]
  pending: PitchPending | null
}

export class TrainerPitchService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  async propose(profileId: string, actorId: string, raw: readonly string[]): Promise<PitchPending> {
    const lines = cleanPitchLines(raw)
    const problem = pitchProblemAr(lines)
    if (problem) throw new AuthError('bad_pitch', problem, 422)
    const p = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, userId: true, pitchLines: true },
    })
    if (!p) throw new AuthError('not_found', 'الملفّ غير موجود', 404)
    /* ما يطابق المعروضَ حرفا لا يُرسَل: بطاقةٌ «قبل» فيها كـ«بعد» لا تقول شيئا */
    if (lines.join('\n') === p.pitchLines.join('\n')) {
      throw new AuthError('unchanged', 'هذا ما يظهر له الآن — غيّر شيئا ثمّ أرسل', 409)
    }
    const made = await this.prisma.$transaction(async (tx) => {
      await tx.trainerPitchSuggestion.updateMany({
        where: { profileId: p.id, status: 'pending' }, data: { status: 'withdrawn', decidedAt: new Date() },
      })
      return tx.trainerPitchSuggestion.create({
        data: { profileId: p.id, lines, before: p.pitchLines, createdBy: actorId },
      })
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.pitch.propose', entityType: 'trainer_profile', entityId: p.id,
      meta: { suggestionId: made.id, lines: lines.length },
    })
    if (p.userId) {
      await safeNotify(this.prisma, {
        userId: p.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.pitch.proposed',
        title: 'كتبنا عنك «لماذا اخترناك»',
        body: 'سطور قصيرة تظهر في بطاقتك بصفحة المدربين. اقرأها واقبلها أو ارفضها — لا تظهر قبل قبولك.',
        data: { profileId: p.id, suggestionId: made.id },
      })
    }
    return { id: made.id, before: made.before, lines: made.lines, createdAt: made.createdAt }
  }

  /** سحبُ المعلَّق — ولا شيءَ يُسحب إن لم يكن معلَّقا */
  async withdraw(profileId: string, actorId: string): Promise<{ ok: true }> {
    const { count } = await this.prisma.trainerPitchSuggestion.updateMany({
      where: { profileId, status: 'pending' }, data: { status: 'withdrawn', decidedAt: new Date() },
    })
    if (count === 0) throw new AuthError('no_pending_pitch', 'لا اقتراح ينتظر قراره', 409)
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.pitch.withdraw', entityType: 'trainer_profile', entityId: profileId,
    })
    return { ok: true }
  }

  private async profileOf(userId: string) {
    const p = await this.prisma.trainerProfile.findFirst({
      where: { userId },
      select: { id: true, pitchLines: true, application: { select: { fullName: true } } },
    })
    if (!p) throw new AuthError('no_trainer_profile', 'لا ملفّ مدرّب لهذا الحساب', 404)
    return p
  }

  async mine(userId: string): Promise<MyPitch> {
    const p = await this.profileOf(userId)
    const pending = await this.prisma.trainerPitchSuggestion.findFirst({
      where: { profileId: p.id, status: 'pending' }, orderBy: { createdAt: 'desc' },
      select: { id: true, before: true, lines: true, createdAt: true },
    })
    return { lines: p.pitchLines, pending }
  }

  /** قبولُه أو رفضُه — وما ليس معلَّقا له لا يُقرَّر فيه */
  async decide(userId: string, suggestionId: string, accept: boolean, noteAr?: string): Promise<MyPitch> {
    const p = await this.profileOf(userId)
    const s = await this.prisma.trainerPitchSuggestion.findFirst({
      where: { id: suggestionId, profileId: p.id, status: 'pending' }, select: { id: true, lines: true },
    })
    if (!s) throw new AuthError('no_pending_pitch', 'لا اقتراح ينتظر قرارك', 409)
    const note = noteAr?.trim() || null
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerPitchSuggestion.update({
        where: { id: s.id },
        data: { status: accept ? 'accepted' : 'rejected', decidedAt: new Date(), noteAr: accept ? null : note },
      })
      if (accept) await tx.trainerProfile.update({ where: { id: p.id }, data: { pitchLines: s.lines } })
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: accept ? 'trainer.pitch.accept' : 'trainer.pitch.reject',
      entityType: 'trainer_profile', entityId: p.id, meta: { suggestionId: s.id },
      ...(note && !accept ? { reason: note } : {}),
    })
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app', templateKey: accept ? 'trainer.pitch.accepted' : 'trainer.pitch.rejected',
      title: accept ? 'قبل المدرب «لماذا اخترناه»' : 'رفض المدرب «لماذا اخترناه»',
      body: accept
        ? `قبل ${p.application.fullName} السطور، وظهرت في بطاقته بصفحة المدربين.`
        : `رفض ${p.application.fullName} السطور${note ? `: «${note}»` : '.'} وبقيت بطاقته كما كانت.`,
      data: { profileId: p.id },
    }).catch(() => undefined)
    return this.mine(userId)
  }
}
