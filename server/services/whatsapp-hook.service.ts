/* بابُ منصّة محادثات واتساب — «راسل المستشارُ طالبا» يُسجَّل تواصلا في حالته (١٩ أكتوبر ٢٠٢٦).

   ═══ لماذا ═══

   قرارُ صاحب المنصّة: واتساب الأكاديمية يُربط بمنصّةٍ توزّع العملاءَ على المستشارين — فالمحادثةُ
   هناك لا هنا. وثلاثةُ أشياءَ عندنا تقوم على تواصلٍ مسجَّل: تذكيرُ اليوم وإبلاغُ اليومين
   (`remindDue`)، وعمولةُ ما أسنده النظام (`attributedRevenue`). فمن راسل هناك ولم يسجّل هنا
   ذُكّر بما فعل، وبُلّغ عنه، وفاتته عمولةُ ما عمل. وقرارُه بين ثلاثة (زرٌّ أسرعُ للتسجيل،
   أو تُخبرنا المنصّةُ وحدَها، أو الانتظار): **تُخبرنا المنصّة**.

   ═══ ولمَ بابٌ عامٌّ لا لمنصّةٍ بعينها ═══

   المنصّةُ لم تُختَر بعد. وكلُّ منصّةٍ منها — أو Make وZapier بينها وبيننا — ترسل طلبَ HTTP
   بجسمٍ نكتبه نحن. فالبابُ يقبل جسما واحدا معروفا، وشاشةُ التكاملات تقول صيغتَه.

   ═══ وأربعةُ حدود ═══

   ١) **رمزٌ في الترويسة** — بابٌ يكتب ما تبدأ به عمولةٌ لا يُفتح لمن لا يعرف سرَّه، ويُقارَن
      بزمنٍ ثابت.
   ٢) **الطالبُ برقمه، والمستشارُ ببريده** — رقمُ واتساب يُطابَق بذيله (`phone-tail.ts`) برقم
      العميل المحتمل أو بملفّ المتعلّم (`LearnerProfile.phone`)، وبريدُ المستشار في المنصّة بريدُ
      حسابه هنا.
   ٣) **ولا يُسجَّل إلّا لمستشار الحالة** — من راسل طالبا ليس في عهدته لا يُكتب له تواصلٌ فيها:
      الإسنادُ بيد إنسان (`remindDue`)، وتواصلُ غيره لا يُسقط تذكيرَ صاحبها ولا يبدأ عمولتَه.
   ٤) **ومرّةً كلَّ ستّ ساعاتٍ للحالة** — المحادثةُ عشراتُ الرسائل، والسجلُّ يحتاج أنّها وقعت
      لا عددَها.

   والجوابُ ٢٠٠ لكلّ ما وصل بالرمز، وفيه سببُه إن لم يُسجَّل: منصّةٌ تعيد المحاولةَ على غيره
   تُغرقنا بحدثٍ لن يتغيّر جوابُه. وآخرُ ما وصل يُقال في شاشة التكاملات (`recordWhatsAppHookPulse`). */

import { createHash, timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { recordWhatsAppHookPulse } from './integrations.service'
import { phoneTail } from '../../src/application/advisor/phone-tail'

export const HOOK_CONTACT_EVERY_HOURS = 6
export const HOOK_SUMMARY_DEFAULT_AR = 'راسل الطالب عبر واتساب — من منصة المحادثات'

export function hookTokenMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/** الرمزُ من `Authorization: Bearer …` أو من `X-Wajeez-Token` — بعضُ المنصّات لا تكتب الأولى */
export function tokenFromHeaders(headers: Record<string, unknown>): string | undefined {
  const bearer = /^Bearer\s+(.+)$/i.exec(String(headers.authorization ?? ''))?.[1]?.trim()
  const custom = String(headers['x-wajeez-token'] ?? '').trim()
  return bearer || custom || undefined
}

export type HookOutcome = 'logged' | 'throttled' | 'unknown_advisor' | 'no_case' | 'not_assigned' | 'bad_phone'

export const HOOK_OUTCOME_AR: Record<HookOutcome, string> = {
  logged: 'سجل تواصل المستشار في حالة الطالب',
  throttled: 'سجل تواصله في هذه الحالة قبل أقل من ست ساعات',
  unknown_advisor: 'بريد المستشار لا يطابق مستشارا نشطا عندنا',
  no_case: 'لا حالة مفتوحة بهذا الرقم',
  not_assigned: 'الطالب في عهدة مستشار آخر',
  bad_phone: 'رقم الطالب غير صالح',
}

export class WhatsAppHookService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async handle(input: { studentPhone: string; advisorEmail: string; summary?: string }, now = new Date()) {
    const outcome = await this.resolve(input, now)
    await recordWhatsAppHookPulse(this.prisma, { at: now.toISOString(), outcome, outcomeAr: HOOK_OUTCOME_AR[outcome] })
    return { logged: outcome === 'logged', outcome, messageAr: HOOK_OUTCOME_AR[outcome] }
  }

  private async resolve(input: { studentPhone: string; advisorEmail: string; summary?: string }, now: Date): Promise<HookOutcome> {
    const tail = phoneTail(input.studentPhone)
    if (!tail) return 'bad_phone'
    const advisor = await this.prisma.user.findFirst({
      where: {
        email: { equals: input.advisorEmail.trim(), mode: 'insensitive' },
        status: 'active', roles: { some: { roleId: 'advisor' } },
      },
      select: { id: true },
    })
    if (!advisor) return 'unknown_advisor'

    /* الرقمُ يُقرأ أرقاما وحدَها في القاعدة كما في `phoneTail` — ما أدخله مستشارٌ بمسافاتٍ أو
       شرطاتٍ يطابق ما وصل من واتساب بلا شيء منها. والمسجَّلةُ معها: المتابعةُ بعد التسجيل تواصل */
    const cases = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM "AdvisorCase" c
      LEFT JOIN "Lead" l ON l.id = c."leadId"
      LEFT JOIN "LearnerProfile" p ON p."userId" = c."clientId"
      WHERE c.status NOT IN ('closed', 'not_interested')
        AND (right(regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g'), 9) = ${tail}
          OR right(regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g'), 9) = ${tail})`
    if (cases.length === 0) return 'no_case'

    const link = await this.prisma.advisorAssignment.findFirst({
      where: { caseId: { in: cases.map((c) => c.id) }, advisorId: advisor.id, unassignedAt: null },
      orderBy: { assignedAt: 'desc' },
      select: { caseId: true },
    })
    if (!link) return 'not_assigned'

    const recent = await this.prisma.contactEvent.findFirst({
      where: {
        caseId: link.caseId, createdBy: advisor.id, source: 'whatsapp_hook',
        createdAt: { gte: new Date(now.getTime() - HOOK_CONTACT_EVERY_HOURS * 3_600_000) },
      },
      select: { id: true },
    })
    if (recent) return 'throttled'

    await this.prisma.contactEvent.create({
      data: {
        caseId: link.caseId, channel: 'whatsapp', direction: 'out', source: 'whatsapp_hook',
        summary: (input.summary?.trim() || HOOK_SUMMARY_DEFAULT_AR).slice(0, 300),
        createdBy: advisor.id, createdAt: now,
      },
    })
    /* وأوّلُ تواصلٍ ينقل الحالةَ من «جديدة» كما ينقلها تسجيلُ المستشار بيده (`addContactEvent`) */
    await this.prisma.advisorCase.updateMany({ where: { id: link.caseId, status: 'new' }, data: { status: 'contacted' } })
    await recordAudit(this.prisma, {
      actorId: null, action: 'advisor.contact.hook', entityType: 'advisor_case', entityId: link.caseId,
      meta: { advisorId: advisor.id, source: 'whatsapp_hook' },
    })
    return 'logged'
  }
}
