/* خدمة الاسترجاع المتباعد (البند ح-٤).

   ما يفعله هذا الملف: يفتح بطاقة لكل سؤال استرجاع في وحدة أتمّها المتعلم،
   ويجدول عودتها على سلّم التباعد، ويسجل نتيجة كل استرجاع.

   ⚠ وما لا يفعله — وهو الأهم: لا يكتب في متجه المهارات ولا يقربه. المستوى
   يأتي من القياس (مؤشر وجيز والقياس البعديّ ح-٧) لا من بطاقة تُحلّ في المتصفح.
   من تذكّر جوابا فقد تذكّره، وهذا دليل تذكّر لا دليل إتقان. الفصل مقصود:
   لو غذّت البطاقات القياس لصار «كنت ٢ وصرت ٤» رقما يستطيع صاحبه تحريكه.

   والتصحيح يقع في المتصفح من الكتالوج المنشور نفسه الذي يقرأه المتعلم — فلا
   نسخة ثانية من الأسئلة على الخادم تتباعد عن الأولى. من أراد أن يغالط نفسه
   في بطاقاته فليس في ذلك ضرر على أحد: البطاقات لا تُصدر شهادة ولا تُحرّك قياسا. */

import { readableVersionOf } from '../catalog/module-version-visibility'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { parseChecks } from '../../src/application/content/module-checks'
import { MAX_STEP, nextDueAt, nextStep } from '../../src/application/student/retrieval-schedule'

export class RetrievalService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** الدورات التي يحق للمتعلم فتح بطاقات وحداتها — تسجيلاته غير المنسحبة */
  private async myCourseIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId, status: { notIn: ['dropped'] } },
      select: { cohort: { select: { courseId: true } } },
    })
    return new Set(rows.map((r) => r.cohort.courseId))
  }

  /** أسئلة الوحدة من أحدث إصدارٍ **منشور** — المصدر نفسه الذي يراه المتعلم، لا المسوّدة */
  private async checksOf(moduleId: string) {
    const version = await this.prisma.courseModuleVersion.findFirst(readableVersionOf(moduleId))
    if (!version) return null
    return { titleAr: version.titleAr, checks: parseChecks(version.checksAr).checks }
  }

  /**
   * يفتح بطاقات وحدة بعد إتمام تمرينها — idempotent: الموجود لا يُعاد جدولته
   * فلا يُصفّر تباعدٌ اكتُسب بإعادة زيارة الصفحة.
   */
  async openCards(userId: string, moduleId: string, now = new Date()) {
    const mod = await this.prisma.courseModule.findUnique({ where: { id: moduleId } })
    if (!mod) throw new AuthError('not_found', 'الوحدة غير موجودة', 404)
    const mine = await this.myCourseIds(userId)
    if (!mine.has(mod.courseId)) throw new AuthError('forbidden', 'هذه الوحدة ليست في دورة مسجَّل فيها', 403)

    const parsed = await this.checksOf(moduleId)
    if (!parsed || parsed.checks.length === 0) {
      return { moduleId, opened: 0, existing: 0, reasonAr: 'لا تمرين استرجاع في هذه الوحدة' }
    }

    const existing = await this.prisma.retrievalCard.findMany({ where: { userId, moduleId } })
    const have = new Set(existing.map((c) => c.checkIndex))
    const toOpen = parsed.checks
      .map((c, i) => ({ i, skillSlug: c.skillSlug }))
      .filter((c) => !have.has(c.i))
    if (toOpen.length > 0) {
      await this.prisma.retrievalCard.createMany({
        data: toOpen.map((c) => ({
          userId, moduleId, checkIndex: c.i, skillSlug: c.skillSlug,
          /* تبدأ من الخطوة صفر: تعود بعد يوم */
          step: 0, dueAt: nextDueAt(0, now),
        })),
        skipDuplicates: true,
      })
    }
    return { moduleId, opened: toOpen.length, existing: existing.length, reasonAr: null }
  }

  /** بطاقاتي كلها — الاشتقاق (ما استُحق، والتالي) يقع في العميل بوحدة نقية */
  async myCards(userId: string) {
    const rows = await this.prisma.retrievalCard.findMany({
      where: { userId }, orderBy: [{ dueAt: 'asc' }, { moduleId: 'asc' }, { checkIndex: 'asc' }],
    })
    return rows.map((r) => ({
      moduleId: r.moduleId,
      checkIndex: r.checkIndex,
      skillSlug: r.skillSlug,
      step: r.step,
      dueAt: r.dueAt.toISOString(),
      lastCorrect: r.lastCorrect,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
    }))
  }

  /**
   * يسجل نتيجة استرجاع: الصحيح يتقدم خطوة، والخطأ يعيد إلى أول السلّم.
   * لا يُقبل تسجيل على بطاقة لم تستحق بعد — وإلا صار السلّم قابلا للتسريع.
   */
  async answer(userId: string, moduleId: string, checkIndex: number, correct: boolean, now = new Date()) {
    const card = await this.prisma.retrievalCard.findUnique({
      where: { userId_moduleId_checkIndex: { userId, moduleId, checkIndex } },
    })
    if (!card) throw new AuthError('not_found', 'لا بطاقة استرجاع لهذا السؤال', 404)
    if (card.dueAt.getTime() > now.getTime()) {
      throw new AuthError('not_due', 'لم يستحق استرجاع هذه البطاقة بعد — التباعد هو الفائدة', 409)
    }
    const step = nextStep(card.step, correct)
    const updated = await this.prisma.retrievalCard.update({
      where: { id: card.id },
      data: {
        step,
        dueAt: nextDueAt(step, now),
        lastAnswerAt: now,
        lastCorrect: correct,
        correctCount: card.correctCount + (correct ? 1 : 0),
        wrongCount: card.wrongCount + (correct ? 0 : 1),
      },
    })
    return {
      moduleId, checkIndex,
      step: updated.step,
      dueAt: updated.dueAt.toISOString(),
      atTop: updated.step >= MAX_STEP,
    }
  }
}
