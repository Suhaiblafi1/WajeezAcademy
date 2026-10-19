/* ما نقترحه نحن على بطاقة المدرّب — يقبله أو يرفضه (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أضف كلماتٍ تشجّع الناس لهذا المدرّب، والمدرّب يوافق أو يرفض».
   ثمّ فصّل: «لم يكن هناك نقاطٌ لـ"لماذا نفتخر بك"! الأمرُ جديد! اطرحه له بطريقة "نريد
   إضافةَ كذا عنك" وامنحه التعديلَ والإضافة… أمّا تعديلُ النبذة فيكون قبل وبعد».
   وهو قرارُ ١٢ أكتوبر في كلّ ما نقترحه على المدرّب: نكتبه نحن جاهزا، ولا نطلب منه
   أن يعمله بنفسه. والقواعدُ في `src/application/trainer/pitch.ts`.

   ── نوعان، وطريقان ──

   · `pitch` «لماذا نفتخر به» — **إضافةٌ لا تعديل**. يصله ما نقترح معبّأً في حقولٍ يعدّلها
     ويضيف إليها. فإن قبله كما هو نُشر فورا. وإن عدّله صار `edited` وعاد إلينا: العنوانُ
     بصوت الأكاديميّة، فلا يُنشر باسمها سطرٌ لم تقرأه (قرارُ صاحب المنصّة، الخيارُ الأوّل
     من اثنين عُرضا عليه). والمعتمِدُ يعتمد تعديلَه كما هو أو بعد تحرير.
   · `bio` نبذتُه بصياغتنا — **«قبل/بعد»** يقبلها أو يرفضها، ولا يعدّلها هنا: من أراد
     نبذةً بكلامه كتبها في بطاقة نبذته (`trainer-public-text.service.ts`).

   واقتراحٌ جديدٌ من نوعٍ يسحب ما كان معلَّقا منه: بطاقتان لشيءٍ واحدٍ تُربكان من يقرّر. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { bioSuggestionProblemAr, cleanPitchLines, pitchProblemAr } from '../../src/application/trainer/pitch'

export type SuggestionKind = 'pitch' | 'bio'

export interface SuggestionView {
  id: string
  kind: SuggestionKind
  before: string[]
  lines: string[]
  editedLines: string[]
  status: string
  createdAt: Date
}

export interface MySuggestions {
  /** لرابط «شاهد أين تظهر» — بطاقتُه في صفحة المدرّبين تحمل هذا المعرّف */
  profileId: string
  /** لعنوان «لماذا نفتخر بـ…» كما سيقرؤه الناس */
  fullName: string
  pitch: { lines: string[]; pending: SuggestionView | null; edited: SuggestionView | null }
  bio: { current: string | null; pending: SuggestionView | null }
}

const VIEW = { id: true, kind: true, before: true, lines: true, editedLines: true, status: true, createdAt: true } as const
const STAFF = ['academic_manager', 'super_admin']
const KIND_AR: Record<SuggestionKind, string> = { pitch: '«لماذا نفتخر به»', bio: 'النبذة' }

/** السطورُ كما تُحفظ بعد حكم نوعها — أو خطأٌ يقول ما ينقص */
function validLines(kind: SuggestionKind, raw: readonly string[]): string[] {
  if (kind === 'bio') {
    const text = (raw[0] ?? '').trim().replace(/[ \t]+/g, ' ')
    const problem = bioSuggestionProblemAr(text)
    if (problem) throw new AuthError('bad_suggestion', problem, 422)
    return [text]
  }
  const lines = cleanPitchLines(raw)
  const problem = pitchProblemAr(lines)
  if (problem) throw new AuthError('bad_suggestion', problem, 422)
  return lines
}

const same = (a: readonly string[], b: readonly string[]) => a.join('\n') === b.join('\n')

export class TrainerSuggestionService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  async propose(profileId: string, actorId: string, kind: SuggestionKind, raw: readonly string[]): Promise<SuggestionView> {
    const lines = validLines(kind, raw)
    const p = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, userId: true, pitchLines: true, bioPublic: true },
    })
    if (!p) throw new AuthError('not_found', 'الملفّ غير موجود', 404)
    const before = kind === 'pitch' ? p.pitchLines : p.bioPublic ? [p.bioPublic] : []
    /* ما يطابق المعروضَ حرفا لا يُرسَل: لا جديدَ فيه يُقرَّر */
    if (same(lines, before)) throw new AuthError('unchanged', 'هذا ما يظهر له الآن — غيّر شيئا ثمّ أرسل', 409)
    const made = await this.prisma.$transaction(async (tx) => {
      await tx.trainerTextSuggestion.updateMany({
        where: { profileId: p.id, kind, status: { in: ['pending', 'edited'] } },
        data: { status: 'withdrawn', decidedAt: new Date() },
      })
      return tx.trainerTextSuggestion.create({
        data: { profileId: p.id, kind, lines, before, createdBy: actorId }, select: VIEW,
      })
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.suggestion.propose', entityType: 'trainer_profile', entityId: p.id,
      meta: { kind, suggestionId: made.id },
    })
    if (p.userId) {
      await safeNotify(this.prisma, {
        userId: p.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.suggestion.proposed',
        title: kind === 'pitch' ? 'نريد أن نضيف عنك «لماذا نفتخر بك»' : 'كتبنا نبذتك بصياغة جديدة',
        body: kind === 'pitch'
          ? 'سطور قصيرة تظهر في بطاقتك بصفحة المدربين. عدّلها أو أضف إليها، أو اقبلها كما هي.'
          : 'نبذتك الآن والصياغة المقترحة جنبا إلى جنب. اقبلها أو ارفضها — لا تتغير قبل قرارك.',
        data: { profileId: p.id, suggestionId: made.id, kind },
      })
    }
    return made as SuggestionView
  }

  /** سحبُ المعلَّق من نوعٍ — عند المدرّب أو عائدا إلينا بتعديله */
  async withdraw(profileId: string, actorId: string, kind: SuggestionKind): Promise<{ ok: true }> {
    const { count } = await this.prisma.trainerTextSuggestion.updateMany({
      where: { profileId, kind, status: { in: ['pending', 'edited'] } },
      data: { status: 'withdrawn', decidedAt: new Date() },
    })
    if (count === 0) throw new AuthError('no_pending_suggestion', 'لا اقتراح ينتظر قرارا', 409)
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.suggestion.withdraw', entityType: 'trainer_profile', entityId: profileId, meta: { kind },
    })
    return { ok: true }
  }

  /** اعتمادُ ما عدّله المدرّبُ في «لماذا نفتخر به» — كما عدّله أو بعد تحرير المعتمِد */
  async approveEdit(profileId: string, actorId: string, raw: readonly string[]): Promise<{ lines: string[] }> {
    const s = await this.prisma.trainerTextSuggestion.findFirst({
      where: { profileId, kind: 'pitch', status: 'edited' }, select: { id: true, editedLines: true },
    })
    if (!s) throw new AuthError('no_edited_suggestion', 'لا تعديل من المدرب ينتظر اعتمادك', 409)
    const lines = validLines('pitch', raw)
    const p = await this.prisma.$transaction(async (tx) => {
      await tx.trainerTextSuggestion.update({ where: { id: s.id }, data: { status: 'accepted', decidedAt: new Date() } })
      return tx.trainerProfile.update({ where: { id: profileId }, data: { pitchLines: lines }, select: { userId: true } })
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.suggestion.approve_edit', entityType: 'trainer_profile', entityId: profileId,
      meta: { suggestionId: s.id, adjusted: !same(lines, s.editedLines) },
    })
    if (p.userId) {
      await safeNotify(this.prisma, {
        userId: p.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.suggestion.edit_approved',
        title: 'اعتمدنا تعديلك على «لماذا نفتخر بك»',
        body: 'ظهر الآن في بطاقتك بصفحة المدربين.',
        data: { profileId },
      })
    }
    return { lines }
  }

  private async profileOf(userId: string) {
    const p = await this.prisma.trainerProfile.findFirst({
      where: { userId },
      select: { id: true, pitchLines: true, bioPublic: true, application: { select: { fullName: true } } },
    })
    if (!p) throw new AuthError('no_trainer_profile', 'لا ملفّ مدرّب لهذا الحساب', 404)
    return p
  }

  async mine(userId: string): Promise<MySuggestions> {
    const p = await this.profileOf(userId)
    const open = await this.prisma.trainerTextSuggestion.findMany({
      where: { profileId: p.id, status: { in: ['pending', 'edited'] } }, orderBy: { createdAt: 'desc' }, select: VIEW,
    }) as SuggestionView[]
    const find = (kind: SuggestionKind, status: string) => open.find((s) => s.kind === kind && s.status === status) ?? null
    return {
      profileId: p.id,
      fullName: p.application.fullName,
      pitch: { lines: p.pitchLines, pending: find('pitch', 'pending'), edited: find('pitch', 'edited') },
      bio: { current: p.bioPublic, pending: find('bio', 'pending') },
    }
  }

  /** قبولُه — كما هو، أو بتعديله في «لماذا نفتخر به» فيعود إلينا */
  async accept(userId: string, suggestionId: string, edited?: readonly string[]): Promise<MySuggestions> {
    const p = await this.profileOf(userId)
    const s = await this.prisma.trainerTextSuggestion.findFirst({
      where: { id: suggestionId, profileId: p.id, status: 'pending' }, select: { id: true, kind: true, lines: true },
    })
    if (!s) throw new AuthError('no_pending_suggestion', 'لا اقتراح ينتظر قرارك', 409)
    const kind = s.kind as SuggestionKind
    /* والنبذةُ «قبل/بعد» لا تُعدَّل هنا — ما يصل معها من سطورٍ يُهمَل */
    const mine = kind === 'pitch' && edited ? validLines('pitch', edited) : null
    if (mine && !same(mine, s.lines)) {
      await this.prisma.trainerTextSuggestion.update({ where: { id: s.id }, data: { status: 'edited', editedLines: mine } })
      await recordAudit(this.prisma, {
        actorId: userId, action: 'trainer.suggestion.edit', entityType: 'trainer_profile', entityId: p.id,
        meta: { kind, suggestionId: s.id },
      })
      await notifyRole(this.prisma, STAFF, {
        channel: 'in_app', templateKey: 'trainer.suggestion.edited',
        title: `عدّل المدرب ${KIND_AR[kind]}`,
        body: `عدّل ${p.application.fullName} السطور المقترحة — راجعها واعتمدها، فلا تظهر قبل اعتمادك.`,
        data: { profileId: p.id },
      }).catch(() => undefined)
      return this.mine(userId)
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerTextSuggestion.update({ where: { id: s.id }, data: { status: 'accepted', decidedAt: new Date() } })
      await tx.trainerProfile.update({
        where: { id: p.id },
        data: kind === 'pitch' ? { pitchLines: s.lines } : { bioPublic: s.lines[0] ?? null },
      })
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.suggestion.accept', entityType: 'trainer_profile', entityId: p.id,
      meta: { kind, suggestionId: s.id },
    })
    await notifyRole(this.prisma, STAFF, {
      channel: 'in_app', templateKey: 'trainer.suggestion.accepted',
      title: `قبل المدرب ${KIND_AR[kind]}`,
      body: `قبل ${p.application.fullName} ما اقترحناه، وظهر في بطاقته بصفحة المدربين.`,
      data: { profileId: p.id },
    }).catch(() => undefined)
    return this.mine(userId)
  }

  async reject(userId: string, suggestionId: string, noteAr?: string): Promise<MySuggestions> {
    const p = await this.profileOf(userId)
    const s = await this.prisma.trainerTextSuggestion.findFirst({
      where: { id: suggestionId, profileId: p.id, status: 'pending' }, select: { id: true, kind: true },
    })
    if (!s) throw new AuthError('no_pending_suggestion', 'لا اقتراح ينتظر قرارك', 409)
    const note = noteAr?.trim() || null
    await this.prisma.trainerTextSuggestion.update({
      where: { id: s.id }, data: { status: 'rejected', decidedAt: new Date(), noteAr: note },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.suggestion.reject', entityType: 'trainer_profile', entityId: p.id,
      meta: { kind: s.kind, suggestionId: s.id }, ...(note ? { reason: note } : {}),
    })
    await notifyRole(this.prisma, STAFF, {
      channel: 'in_app', templateKey: 'trainer.suggestion.rejected',
      title: `رفض المدرب ${KIND_AR[s.kind as SuggestionKind]}`,
      body: `رفض ${p.application.fullName} ما اقترحناه${note ? `: «${note}»` : '.'} وبقيت بطاقته كما كانت.`,
      data: { profileId: p.id },
    }).catch(() => undefined)
    return this.mine(userId)
  }
}
