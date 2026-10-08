/* اختباراتُ المستوى — تحديدُ مستوى الإنجليزيّة وفحوصُ المهارة في المجالات (٨ أكتوبر ٢٠٢٦).
   البنكُ ومراجعتُه والتصحيح، لكلّ موضوعٍ في جدولٍ واحد.

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
} from '../../src/domain/placement/english-placement'
import {
  CHECK_LEVELS,
  fieldBankIsOpen,
  isFieldSubject,
  scoreFieldCheck,
  type CheckLevel,
  type FieldSubject,
} from '../../src/domain/placement/field-check'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export type PlacementSubject = 'english' | FieldSubject
export const PLACEMENT_SKILLS = ['grammar', 'vocabulary', 'reading', 'knowledge'] as const

export function isPlacementSubject(s: string): s is PlacementSubject {
  return s === 'english' || isFieldSubject(s)
}

/** السؤالُ كما يُقرأ: مستوى الإنجليزيّة بحروفه الكبيرة (A1)، وسلّمُ المجال برمزه (basics) */
function toItem(r: PlacementQuestion) {
  return {
    id: r.id,
    subject: r.subject,
    level: r.subject === 'english' ? (r.level.toUpperCase() as PlacementCefr) : (r.level as CheckLevel),
    skill: r.skill,
    passage: r.passage,
    stem: r.stem,
    options: r.options as string[],
    answer_index: r.answerIndex,
  }
}
type Item = ReturnType<typeof toItem>

const ORDER = [{ level: 'asc' as const }, { position: 'asc' as const }]

/** سلّمُ الموضوع وحكمُ فتحه — الإنجليزيّةُ ستّةٌ لكلّ مستوى من خمسة، والمجالُ أربعةٌ من ثلاثة */
function ladderOf(subject: PlacementSubject): readonly string[] {
  return subject === 'english' ? PLACEMENT_LEVELS : CHECK_LEVELS
}
function isOpen(subject: PlacementSubject, items: Item[]): boolean {
  return subject === 'english' ? bankIsOpen(items as never) : fieldBankIsOpen(items as never)
}

export interface PlacementEdit {
  stem?: string
  passage?: string | null
  options?: string[]
  answerIndex?: number
}

export class PlacementService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async approved(subject: PlacementSubject): Promise<Item[]> {
    const rows = await this.prisma.placementQuestion.findMany({ where: { subject, status: 'approved' }, orderBy: ORDER })
    return rows.map(toItem)
  }

  /** ما يراه المتعلّم: الأسئلةُ المعتمَدة بلا أجوبتها — أو لا شيء إن لم يُفتح البنك */
  async publicBank(subject: PlacementSubject) {
    const items = await this.approved(subject)
    const open = isOpen(subject, items)
    return { open, items: open ? items.map((i) => publicItem(i as never)) : [] }
  }

  /** يصحّح الأجوبة على المعتمَد من الموضوع وحدَه — وما ليس منه يُتجاهَل */
  async score(subject: PlacementSubject, answers: Record<string, number>) {
    const items = await this.approved(subject)
    if (!isOpen(subject, items)) {
      throw new AuthError('placement_closed', 'الاختبارُ لم يُفتح بعد — أسئلتُه قيد المراجعة', 409)
    }
    return subject === 'english' ? scorePlacement(items as never, answers) : scoreFieldCheck(items as never, answers)
  }

  /** ما يراه المراجع: كلُّ سؤالٍ بجوابه وحالته، ومعدودُ المعتمَد لكلّ مستوى */
  async reviewList(subject: PlacementSubject) {
    const rows = await this.prisma.placementQuestion.findMany({ where: { subject }, orderBy: ORDER })
    const items = rows.map(toItem)
    const approved = items.filter((_, k) => rows[k].status === 'approved')
    return {
      open: isOpen(subject, approved),
      per_level: ladderOf(subject).map((level) => ({
        level,
        approved: approved.filter((i) => i.level === level).length,
        total: items.filter((i, k) => i.level === level && rows[k].status !== 'retired').length,
      })),
      items: rows.map((r, k) => ({
        ...items[k],
        status: r.status,
        review_note_ar: r.reviewNoteAr,
        reviewed_at: r.reviewedAt,
      })),
    }
  }

  async edit(subject: PlacementSubject, id: string, actorId: string, patch: PlacementEdit) {
    const row = await this.find(subject, id)
    const options = patch.options ?? (row.options as string[])
    const answerIndex = patch.answerIndex ?? row.answerIndex
    if (new Set(options.map((o) => o.trim())).size !== options.length) {
      throw new AuthError('placement_options_duplicate', 'خياران بالنصّ نفسِه — كلُّ خيارٍ يختلف عن غيره', 400)
    }
    if (answerIndex < 0 || answerIndex >= options.length) {
      throw new AuthError('placement_answer_out_of_range', 'الجوابُ الصحيحُ ليس أحدَ الخيارات', 400)
    }
    const passage = patch.passage === undefined ? row.passage : patch.passage?.trim() || null
    if (row.skill === 'reading' && !passage) {
      throw new AuthError('placement_passage_required', 'سؤالُ القراءة يحتاج نصَّه', 400)
    }
    const updated = await this.prisma.placementQuestion.update({
      where: { id },
      data: {
        stem: patch.stem?.trim() ?? row.stem,
        passage,
        options: options.map((o) => o.trim()),
        answerIndex,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'placement.question.update', entityType: 'placement_question', entityId: id,
      before: { stem: row.stem, passage: row.passage, options: row.options, answerIndex: row.answerIndex },
      after: { stem: updated.stem, passage: updated.passage, options: updated.options, answerIndex: updated.answerIndex },
    })
    return { ...toItem(updated), status: updated.status }
  }

  /** اعتمادٌ أو إسقاط — والمُسقَطُ يُعتمَد من جديد إن عاد عنه المراجع */
  async decide(subject: PlacementSubject, id: string, actorId: string, approve: boolean, noteAr?: string) {
    const row = await this.find(subject, id)
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

  /** السؤالُ في موضوعه — فلا يُعدَّل سؤالُ مجالٍ من رابط موضوعٍ آخر */
  private async find(subject: PlacementSubject, id: string) {
    const row = await this.prisma.placementQuestion.findUnique({ where: { id } })
    if (!row || row.subject !== subject) throw new AuthError('placement_not_found', 'السؤالُ غيرُ موجود', 404)
    return row
  }
}
