/* اختبارُ تحديد مستوى الإنجليزيّة — البنكُ ومراجعتُه والتصحيح (٨ أكتوبر ٢٠٢٦).

   ثلاثةُ أسطحٍ لا تتداخل:
   · المتعلّم: يقرأ الأسئلةَ المعتمَدة **بلا أجوبتها**، ويرسل أجوبتَه فيُصحَّح هنا —
     فالجوابُ الصحيحُ لا يغادر الخادمَ أبدا. ولا يُفتح الاختبارُ حتّى يكون لكلّ مستوى
     أسئلتُه المعتمَدة (`bankIsOpen`): اختبارٌ بمستوى فارغٍ يحكم بما لم يقِسه.
   · المراجع (`placement.review`): يرى كلَّ سؤالٍ بجوابه وحالته، ويعدّل نصَّه، ويعتمده
     أو يُسقطه. وكلُّ ذلك في سجلّ الأثر باسمه.
   · ولا شيءَ يُحفظ عن المتعلّم هنا: التصحيحُ حسابٌ يُردّ، والنتيجةُ تعود إلى صفحته. */

import type { PrismaClient, PlacementQuestion } from '@prisma/client'
import {
  PLACEMENT_LEVELS,
  bankIsOpen,
  publicItem,
  scorePlacement,
  type PlacementCefr,
  type PlacementItem,
} from '../../src/domain/placement/english-placement'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export const PLACEMENT_SKILLS = ['grammar', 'vocabulary', 'reading'] as const

function toItem(r: PlacementQuestion): PlacementItem {
  return {
    id: r.id,
    level: r.level.toUpperCase() as PlacementCefr,
    skill: r.skill as PlacementItem['skill'],
    passage: r.passageEn,
    stem: r.stemEn,
    options: r.options as string[],
    answer_index: r.answerIndex,
  }
}

const ORDER = [{ level: 'asc' as const }, { position: 'asc' as const }]

export interface PlacementEdit {
  stemEn?: string
  passageEn?: string | null
  options?: string[]
  answerIndex?: number
}

export class PlacementService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async approved(): Promise<PlacementItem[]> {
    const rows = await this.prisma.placementQuestion.findMany({ where: { status: 'approved' }, orderBy: ORDER })
    return rows.map(toItem)
  }

  /** ما يراه المتعلّم: الأسئلةُ المعتمَدة بلا أجوبتها — أو لا شيء إن لم يُفتح البنك */
  async publicBank() {
    const items = await this.approved()
    const open = bankIsOpen(items)
    return { open, items: open ? items.map(publicItem) : [] }
  }

  /** يصحّح الأجوبة على المعتمَد وحدَه — وما ليس منه يُتجاهَل */
  async score(answers: Record<string, number>) {
    const items = await this.approved()
    if (!bankIsOpen(items)) {
      throw new AuthError('placement_closed', 'اختبارُ تحديد المستوى لم يُفتح بعد — أسئلتُه قيد المراجعة', 409)
    }
    return scorePlacement(items, answers)
  }

  /** ما يراه المراجع: كلُّ سؤالٍ بجوابه وحالته، ومعدودُ المعتمَد لكلّ مستوى */
  async reviewList() {
    const rows = await this.prisma.placementQuestion.findMany({ orderBy: ORDER })
    const approved = rows.filter((r) => r.status === 'approved').map(toItem)
    return {
      open: bankIsOpen(approved),
      per_level: PLACEMENT_LEVELS.map((level) => ({
        level,
        approved: approved.filter((i) => i.level === level).length,
        total: rows.filter((r) => r.level === level.toLowerCase() && r.status !== 'retired').length,
      })),
      items: rows.map((r) => ({
        ...toItem(r),
        status: r.status,
        review_note_ar: r.reviewNoteAr,
        reviewed_at: r.reviewedAt,
      })),
    }
  }

  async edit(id: string, actorId: string, patch: PlacementEdit) {
    const row = await this.find(id)
    const options = patch.options ?? (row.options as string[])
    const answerIndex = patch.answerIndex ?? row.answerIndex
    if (new Set(options.map((o) => o.trim())).size !== options.length) {
      throw new AuthError('placement_options_duplicate', 'خياران بالنصّ نفسِه — كلُّ خيارٍ يختلف عن غيره', 400)
    }
    if (answerIndex < 0 || answerIndex >= options.length) {
      throw new AuthError('placement_answer_out_of_range', 'الجوابُ الصحيحُ ليس أحدَ الخيارات', 400)
    }
    const passage = patch.passageEn === undefined ? row.passageEn : patch.passageEn?.trim() || null
    if (row.skill === 'reading' && !passage) {
      throw new AuthError('placement_passage_required', 'سؤالُ القراءة يحتاج نصَّه', 400)
    }
    const updated = await this.prisma.placementQuestion.update({
      where: { id },
      data: {
        stemEn: patch.stemEn?.trim() ?? row.stemEn,
        passageEn: passage,
        options: options.map((o) => o.trim()),
        answerIndex,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'placement.question.update', entityType: 'placement_question', entityId: id,
      before: { stem: row.stemEn, passage: row.passageEn, options: row.options, answerIndex: row.answerIndex },
      after: { stem: updated.stemEn, passage: updated.passageEn, options: updated.options, answerIndex: updated.answerIndex },
    })
    return { ...toItem(updated), status: updated.status }
  }

  /** اعتمادٌ أو إسقاط — والمُسقَطُ يُعتمَد من جديد إن عاد عنه المراجع */
  async decide(id: string, actorId: string, approve: boolean, noteAr?: string) {
    const row = await this.find(id)
    const status = approve ? 'approved' : 'retired'
    const updated = await this.prisma.placementQuestion.update({
      where: { id },
      data: { status, reviewNoteAr: noteAr?.trim() || null, reviewedBy: actorId, reviewedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId, action: approve ? 'placement.question.approve' : 'placement.question.retire',
      entityType: 'placement_question', entityId: id,
      reason: noteAr?.trim() || undefined, before: { status: row.status }, after: { status },
    })
    return { id: updated.id, status: updated.status }
  }

  private async find(id: string) {
    const row = await this.prisma.placementQuestion.findUnique({ where: { id } })
    if (!row) throw new AuthError('placement_not_found', 'السؤالُ غيرُ موجود', 404)
    return row
  }
}
