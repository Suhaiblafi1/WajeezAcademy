/* خدمة المستشارين — حالات العملاء من لحظة التشخيص حتى التسجيل أو الإغلاق.
   القاعدة: المستشار يرى الحالات المسندة إليه فقط، والملاحظات الداخلية لا تظهر للعميل. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { ROLE_PERMISSIONS } from '../auth/permissions'
import {
  GUEST_CONTACT_CONSENT_AR, GUEST_SNAPSHOT_MAX_CHARS, normalizePhone,
} from '../../src/application/advisor/guest-contact'

export const CASE_STATUSES = [
  'new', 'contacted', 'needs_review', 'follow_up', 'recommended', 'enrolled', 'not_interested', 'closed',
] as const

export interface DiagnosticSummary {
  attachedAt: string | null
  topPathwayName: string | null
  confidenceBand: string | null
  needsAdvisor: boolean
  goalAr: string | null
  reasons: string[]
  gaps: { skill: string; current: string; target: string; priority: string }[]
}

/** خلاصةُ تشخيص العميل — من نتيجته المرفقة بحسابه (`diagnosticSnapshot`) لا
    من إجاباتٍ خامّة تبقى على جهازه وحده. أسبابُ الترشيح وأوجهُ النمو
    منظّمةً، لا نصّا سرديّا يزول بإغلاق التبويب. */
export function summarizeDiagnostic(
  snapshot: unknown,
  goalAr: string | null | undefined,
  attachedAt: Date | null | undefined,
): DiagnosticSummary | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const s = snapshot as Record<string, unknown>
  const top = s.top as { name?: string } | null | undefined
  const gapDetails = Array.isArray(s.gapDetails)
    ? (s.gapDetails as { skill?: string; current?: string; target?: string; priority?: string }[])
    : []
  const reasons = Array.isArray(s.reasons) ? (s.reasons as unknown[]).filter((r): r is string => typeof r === 'string') : []
  return {
    attachedAt: attachedAt ? attachedAt.toISOString() : null,
    topPathwayName: typeof top?.name === 'string' ? top.name : null,
    confidenceBand: typeof s.confidenceBand === 'string' ? s.confidenceBand : null,
    needsAdvisor: Boolean(s.needsAdvisor),
    goalAr: goalAr ?? null,
    reasons: reasons.slice(0, 5),
    gaps: gapDetails.slice(0, 6).map((g) => ({
      skill: g.skill ?? '', current: g.current ?? '', target: g.target ?? '', priority: g.priority ?? '',
    })),
  }
}

/** نتيجةُ تشخيصٍ جاءت من بابٍ عامّ — كائنٌ في حدّ حجمه، أو لا شيء.

    لا يُردّ الطلبُ بسببها: من ترك رقمَه يريد أن يُكلَّم، والنتيجةُ تُعين
    المستشارَ ولا تشترط عليه. فما جاء غيرَ كائنٍ أو أكبرَ من حدّه يسقط وحدَه
    ويبقى الطلب. والحدُّ ثمانيةُ أضعافِ نتيجةٍ حقيقيّة (١٨–٢٥ ألف حرفٍ قيست
    في ١٨ أكتوبر ٢٠٢٦) — يتّسع لجولة تعميقٍ ولا يتّسع لحشوٍ يملأ القاعدة. */
function guestSnapshot(raw: unknown): object | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  try {
    return JSON.stringify(raw).length <= GUEST_SNAPSHOT_MAX_CHARS ? raw : null
  } catch {
    return null
  }
}

/* ═══════════ ما يُحسب للمستشار من دفعات عملائه — حسابٌ واحدٌ له ولإدارته ═══════════

   كان حسابان يفترقان: «عمولتي» يعدّ ما دُفع من يوم الإسناد على كلّ الإسنادات، وملفُّه
   عند الإدارة يعدّ ما دفعه العميلُ في عمره كلِّه على النشطة وحدَها. فيقرأ المستشارُ
   رقما ويقرأ من يدفع له رقما آخر — وهو أوّلُ ما يُختلف عليه. فصار حسابا واحدا يقرآنه.

   ── وكلُّ الإسنادات لا النشطةَ وحدَها ──

   كان الشرطُ `unassignedAt: null`، فمن أغلق حالةً ورُفع إسنادُها — وهو ما يقع عند كلّ
   بيعةٍ تمّت — سقطت عمولتُها من حسابه. أي أنّ إتمامَ العمل كان يمحو أجرَه.

   ── ومن يوم إسناده لا من عمر العميل ──

   كان يُحسب ما دفعه العميلُ في عمره كلِّه — بما اشتراه قبل أن يعرف المستشارَ أصلا.
   فالنسبةُ على ما دُفع من يوم إسناده فصاعدا: ما قبلَه ليس من عمله.

   ── والإسنادُ التلقائيّ لا يُحسب إلّا بتواصل (١٩ أكتوبر ٢٠٢٦) ──

   قرارُ صاحب المنصّة بين ثلاثة (يُحسب كلُّه، أو بعد تواصلٍ مسجَّل، أو لا يُحسب أبدا):
   **بعد تواصلٍ مسجَّل، والسجلُّ يُصدَّق** — وكلُّ تواصلٍ مكتوبٌ باسم صاحبه ووقته فيُراجَع.
   فما أسنده النظامُ (`automatic`) لا يبدأ حسابُه من يوم الإسناد بل من أوّل تواصلٍ سجّله
   المستشارُ نفسُه في تلك الحالة؛ ولا تواصلَ قبل الدفع = لا شيءَ عن تلك الدفعة. وما أسنده
   إداريٌّ أو أدخله المستشارُ بيده يبقى من يوم إسناده كما كان. */
export async function attributedRevenue(prisma: PrismaClient, advisorId: string): Promise<number> {
  const assignments = await prisma.advisorAssignment.findMany({
    where: { advisorId },
    select: { caseId: true, assignedAt: true, automatic: true, case: { select: { clientId: true } } },
  })
  const autoCaseIds = assignments.filter((a) => a.automatic).map((a) => a.caseId)
  const contacts = autoCaseIds.length > 0
    ? await prisma.contactEvent.findMany({
        where: { caseId: { in: autoCaseIds }, createdBy: advisorId },
        select: { caseId: true, createdAt: true },
      })
    : []

  const firstTouch = new Map<string, Date>()
  for (const a of assignments) {
    const clientId = a.case.clientId
    if (!clientId) continue
    const start = a.automatic
      ? contacts
          .filter((c) => c.caseId === a.caseId && c.createdAt >= a.assignedAt)
          .reduce<Date | null>((min, c) => (!min || c.createdAt < min ? c.createdAt : min), null)
      : a.assignedAt
    if (!start) continue
    const prev = firstTouch.get(clientId)
    if (!prev || start < prev) firstTouch.set(clientId, start)
  }
  const clientIds = [...firstTouch.keys()]
  if (clientIds.length === 0) return 0

  const paid = await prisma.order.findMany({
    where: { userId: { in: clientIds }, status: 'paid' },
    select: { userId: true, total: true, paidAt: true, createdAt: true },
  })
  return paid.reduce((sum, o) => {
    const since = firstTouch.get(o.userId)
    /* `paidAt` قد يغيب على صفٍّ قديم — فيُقرأ تاريخُ الطلب بدلا منه */
    const when = o.paidAt ?? o.createdAt
    return since && when >= since ? sum + Number(o.total) : sum
  }, 0)
}

export class AdvisorService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ── ربط التشخيص بالحساب — الجسر بين الضيف والمنظومة ── */

  /** يرفق نتيجة التشخيص بالحساب: ملف متعلم + عميل محتمل + حالة مستشار جديدة.

      و`completedAt` لنتيجةٍ حفظها الجهازُ وصاحبُه ضيفٌ ثمّ رُفعت حين دخل
      (`syncPendingDiagnostic`): لا تُكتب فوق نتيجةٍ أحدثَ منها في حسابه. من أعاد
      التشخيصَ من جهازٍ آخر لا تمحو نتيجتَه الجديدةَ نسخةٌ قديمةٌ بقيت في متصفّحٍ
      ثانٍ — والأحدثُ ما يُقارَن بوقت إرفاق ما في الحساب. */
  async attachDiagnostic(userId: string, snapshot: unknown, ip?: string, opts: { completedAt?: Date } = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new AuthError('bad_snapshot', 'نتيجة التشخيص غير صالحة')
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AuthError('unknown_user', 'المستخدم غير موجود', 404)

    if (opts.completedAt) {
      const held = await this.prisma.learnerProfile.findUnique({ where: { userId }, select: { attachedAt: true } })
      if (held?.attachedAt && held.attachedAt >= opts.completedAt) return { lead: null, case: null }
    }

    await this.prisma.learnerProfile.upsert({
      where: { userId },
      update: { diagnosticSnapshot: snapshot as object, attachedAt: new Date() },
      create: { userId, diagnosticSnapshot: snapshot as object, attachedAt: new Date() },
    })

    /* عميل محتمل أو تحديث القائم */
    let lead = await this.prisma.lead.findFirst({ where: { userId } })
    if (!lead) {
      /* ── وزائرٌ ترك رقمَه ببريده قبل أن يسجّل ──

         حالتُه قائمةٌ تنتظر أن يُثبت بريدَه فتلحقه (`lead-link.ts`). وفتحُ
         ثانيةٍ له هنا يجعله عميلين في عين المستشار حين تلحق الأولى. فلا تُفتح،
         ولا تُربط هنا أيضا: البريدُ لم يُثبَت بعد. ولا يُعاد منها شيءٌ في الجواب
         — رقمُ ذلك الزائر واسمُه لا يُقرآن ببريدٍ كُتب. */
      const pending = await this.prisma.advisorCase.findFirst({
        where: {
          clientId: null, status: { notIn: ['closed', 'enrolled', 'not_interested'] },
          lead: { userId: null, email: { equals: user.email, mode: 'insensitive' } },
        },
        select: { id: true },
      })
      if (pending) {
        await recordAudit(this.prisma, {
          actorId: userId, action: 'diagnostic.attach', entityType: 'advisor_case', entityId: pending.id, ip,
          meta: { awaitingVerification: true },
        })
        return { lead: null, case: null }
      }
      lead = await this.prisma.lead.create({
        data: { fullName: user.displayName, email: user.email, source: 'diagnostic', userId, diagnosticSnapshot: snapshot as object },
      })
    }

    /* حالة مستشار — لا تكرار لحالة مفتوحة لنفس العميل */
    let kase = await this.prisma.advisorCase.findFirst({
      where: { leadId: lead.id, status: { notIn: ['closed', 'enrolled', 'not_interested'] } },
    })
    const opened = !kase
    kase ??= await this.prisma.advisorCase.create({
      data: { leadId: lead.id, clientId: userId, diagnosticSnapshot: snapshot as object, nextAction: 'تواصل أول مع العميل' },
    })

    await recordAudit(this.prisma, {
      actorId: userId, action: 'diagnostic.attach', entityType: 'advisor_case', entityId: kase.id, ip,
      meta: { leadId: lead.id },
    })
    if (opened) await this.autoAssignQuietly(kase.id)
    return { lead, case: kase }
  }

  /* ── الإدارة: الإسناد ── */

  /** `actorId` فارغٌ حين يُسند النظامُ نفسُه (`autoAssign`) — فيبقى ذلك ظاهرا في `assignedBy`.
      و`automatic` لمن اختار النظامُ مستشارَه ولو بطلب إداريّ (`redistribute`): عمولتُه
      لا تبدأ إلّا بتواصل (`attributedRevenue`) — فالمستشارُ الجديدُ لم يعمل فيها بعد. */
  async assign(caseId: string, advisorId: string, actorId: string | null, opts: { automatic?: boolean } = {}) {
    const kase = await this.prisma.advisorCase.findUnique({ where: { id: caseId } })
    if (!kase) throw new AuthError('not_found', 'الحالة غير موجودة', 404)
    const advisor = await this.prisma.user.findUnique({ where: { id: advisorId }, include: { roles: true } })
    if (!advisor || !advisor.roles.some((r) => r.roleId === 'advisor')) {
      throw new AuthError('not_advisor', 'المستخدم ليس مستشارا', 409)
    }
    /* إلغاء الإسنادات السابقة ثم إسناد جديد — تاريخ الإسناد يبقى */
    await this.prisma.advisorAssignment.updateMany({
      where: { caseId, unassignedAt: null }, data: { unassignedAt: new Date() },
    })
    const link = await this.prisma.advisorAssignment.create({
      data: { caseId, advisorId, assignedBy: actorId, automatic: opts.automatic ?? actorId === null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.case.assign', entityType: 'advisor_case', entityId: caseId,
      meta: { advisorId, ...(actorId ? {} : { automatic: true }) },
    })
    /* ── ولا يُسنَد أحدٌ في صمت ──

       كان الإسنادُ لا يكتب إشعارا، فيكتشف المستشارون الحالاتِ الجديدةَ
       **بإعادة التحميل**. وهذا خبرُ عملٍ يترتّب عليه واجب — فلا يُكتَم،
       وجمهورُه `staff` لأنّ بوّابةَ المستشار تقرأ جرسَها من هناك. */
    const who = await this.prisma.advisorCase.findUnique({
      where: { id: caseId },
      select: { lead: { select: { fullName: true } }, client: { select: { displayName: true } } },
    })
    const clientName = who?.client?.displayName ?? who?.lead?.fullName ?? 'عميل جديد'
    await safeNotify(this.prisma, {
      userId: advisorId, channel: 'in_app', audience: 'staff',
      templateKey: 'advisor.case.assigned',
      title: 'أسندت إليك حالة جديدة',
      body: `حالة «${clientName}» صارت في عهدتك — افتحها من «حالاتي» وابدأ بأوّل تواصل.`,
      data: { caseId },
    })
    return link
  }

  /* المستشارون المتاحون للإسناد — بصلاحيّة الإسناد نفسِها.

     كانت الشاشةُ تقرأ `/api/admin/users` وترشّح منه ذوي دور المستشار،
     وذاك محروسٌ بـ`admin.users.view`. فمن مُنح إسنادَ الحالات ولم يُمنح
     إدارةَ المستخدمين تسقط عنه القائمةُ صامتةً، **فتنكشف تحتها خانةُ
     «معرف المستشار (UUID)»** — قيمةٌ لا تعرضها شاشةٌ يملكها.

     أي أنّ حقلَ اللصق لم يكن خيارَ تصميم، بل أثرَ حارسٍ لا يطابق الفعل.
     فالقائمةُ الآن محروسةٌ بما يحرس الإسنادَ نفسَه. */
  async assignableAdvisors() {
    const rows = await this.prisma.user.findMany({
      where: { status: 'active', roles: { some: { roleId: 'advisor' } } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, email: true },
    })
    return rows
  }

  async listUnassigned() {
    return this.prisma.advisorCase.findMany({
      where: { assignments: { none: { unassignedAt: null } }, status: { notIn: ['closed', 'enrolled', 'not_interested'] } },
      include: { lead: true, client: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  /* ═══════════ الإسنادُ التلقائيّ — لأقلّ المستشارين حالاتٍ مفتوحة ═══════════

     كانت كلُّ حالةٍ جديدةٍ تقف في طابور «حالات بلا مستشار» حتّى يُسندها إداريٌّ
     بيده. ولمّا صار الزائرُ يترك رقمَه آخرَ التشخيص صار الطابورُ يمتلئ كلَّ يوم،
     ومن ترك رقمَه ينتظر يدا لا مستشارا. وقرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦) بين
     ثلاثة (أقلُّهم حالاتٍ، أو بالدور، أو يدويٌّ بتنبيه): **أقلُّهم حالاتٍ مفتوحة** —
     يبقى الحِملُ متوازنا، ولا يُثقَل من أُسند إليه أمس عشرٌ.

     والتعادلُ لمن طال عهدُه بآخر إسناد، ثمّ بالمعرّف — فلا يُترك لترتيب القاعدة.
     ولا مستشارَ نشطا = لا إسناد: تبقى في الطابور كما كانت. والإداريُّ يرى ما
     أُسند تلقائيّا ويغيّره (`listAutoAssigned`) — لا يُنتزع منه القرار. */
  async autoAssign(caseId: string, opts: { exclude?: string[]; actorId?: string | null } = {}): Promise<string | null> {
    const advisors = await this.prisma.user.findMany({
      where: {
        status: 'active', roles: { some: { roleId: 'advisor' } },
        ...(opts.exclude?.length ? { id: { notIn: opts.exclude } } : {}),
      },
      select: { id: true },
    })
    if (advisors.length === 0) return null
    const ids = advisors.map((a) => a.id)
    const [open, last] = await Promise.all([
      this.prisma.advisorAssignment.groupBy({
        by: ['advisorId'],
        where: { advisorId: { in: ids }, unassignedAt: null, case: { status: { notIn: ['closed', 'enrolled', 'not_interested'] } } },
        _count: { _all: true },
      }),
      this.prisma.advisorAssignment.groupBy({
        by: ['advisorId'], where: { advisorId: { in: ids } }, _max: { assignedAt: true },
      }),
    ])
    const openOf = new Map(open.map((r) => [r.advisorId, r._count._all]))
    const lastOf = new Map(last.map((r) => [r.advisorId, r._max.assignedAt?.getTime() ?? 0]))
    const chosen = [...ids].sort((a, b) =>
      (openOf.get(a) ?? 0) - (openOf.get(b) ?? 0)
      || (lastOf.get(a) ?? 0) - (lastOf.get(b) ?? 0)
      || a.localeCompare(b),
    )[0]!
    await this.assign(caseId, chosen, opts.actorId ?? null, { automatic: true })
    return chosen
  }

  /** الإسنادُ التلقائيّ بعد فتح الحالة — وتعثّرُه لا يُسقط ما فُتح: تبقى في الطابور */
  private async autoAssignQuietly(caseId: string) {
    try {
      const chosen = await this.autoAssign(caseId)
      if (!chosen) await this.alertNoAdvisor(caseId)
    } catch (e) {
      console.error('[advisor] تعذّر الإسناد التلقائيّ — تبقى الحالة في الطابور', caseId, e)
    }
  }

  /* ═══ ولا مستشارَ نشطا — يُقال لمن يُسند، لا تنتظر الحالةُ صامتة (١٩ أكتوبر ٢٠٢٦) ═══

     كانت الحالةُ تقع في الطابور ولا يعلم بها أحد حتّى يفتح إداريٌّ الشاشةَ مصادفةً —
     ومن ترك رقمَه ينتظر. فيُبلَّغ كلُّ من يملك الإسنادَ بدوره (`advisor.assign` من
     `ROLE_PERMISSIONS`، لا قائمةٌ تُكتب باليد فتفترق عنها).

     ومرّةً كلَّ ستِّ ساعاتٍ لا مع كلّ حالة: يومٌ بلا مستشارٍ قد يحمل عشرين زائرا،
     وعشرون جرسا لخبرٍ واحدٍ تُعلّم الإداريَّ ألّا يقرأ الجرس. والشاشةُ تعدّ الباقي. */
  private async alertNoAdvisor(caseId: string) {
    const recent = await this.prisma.notification.count({
      where: { templateKey: 'advisor.case.no_advisor', queuedAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
    })
    if (recent > 0) return
    const roles = Object.entries(ROLE_PERMISSIONS)
      .filter(([, keys]) => keys.includes('advisor.assign'))
      .map(([role]) => role)
    await notifyRole(this.prisma, roles, {
      channel: 'in_app',
      templateKey: 'advisor.case.no_advisor',
      title: 'حالة تنتظر مستشارا',
      body: 'وصلت حالة جديدة ولا مستشار نشط يستلمها. فعّل مستشارا أو أسندها من «حالات بلا مستشار».',
      data: { caseId },
    })
  }

  /* ═══════════ تغييرُ مستشار أيّ حالةٍ مفتوحة — لا ما أُسند تلقائيّا وحدَه ═══════════

     كانت شاشةُ الإسناد تعرض ما لا مستشارَ له وما أسنده النظامُ في ثلاثين يوما. فما
     أسنده إداريٌّ بيده، أو ما قدُم، لا شاشةَ تغيّر مستشارَه — فمن غادر أو أُثقل بقيت
     حالاتُه عنده. فالبحثُ هنا في كلّ حالةٍ مفتوحةٍ مسندة، باسم صاحبها أو بريده أو رقمه. */
  async searchOpenCases(q: string) {
    const term = q.trim()
    if (term.length < 2) return []
    const like = { contains: term, mode: 'insensitive' as const }
    return this.prisma.advisorCase.findMany({
      where: {
        status: { notIn: ['closed', 'enrolled', 'not_interested'] },
        assignments: { some: { unassignedAt: null } },
        OR: [
          { client: { displayName: like } }, { client: { email: like } },
          { lead: { fullName: like } }, { lead: { email: like } }, { lead: { phone: { contains: term } } },
        ],
      },
      include: {
        lead: true,
        client: { select: { displayName: true, email: true } },
        assignments: { where: { unassignedAt: null }, select: { advisorId: true, assignedAt: true, advisor: { select: { displayName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    })
  }

  /** المستشارون بحالاتهم المفتوحة — والموقوفُ منهم معهم: من غادر هو من تُنقل حالاتُه */
  async advisorLoads() {
    const [advisors, open] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { roleId: 'advisor' } } },
        select: { id: true, displayName: true, email: true, status: true },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.advisorAssignment.groupBy({
        by: ['advisorId'],
        where: { unassignedAt: null, case: { status: { notIn: ['closed', 'enrolled', 'not_interested'] } } },
        _count: { _all: true },
      }),
    ])
    const openOf = new Map(open.map((r) => [r.advisorId, r._count._all]))
    return advisors.map((a) => ({ ...a, openCases: openOf.get(a.id) ?? 0 }))
  }

  /* ═══ ومستشارٌ غادر أو أُثقل: حالاتُه المفتوحةُ تُوزَّع على غيره بضغطة ═══

     كلُّ حالةٍ مفتوحةٍ عنده تذهب لأقلّ الآخرين حالاتٍ — بقاعدة الإسناد التلقائيّ نفسِها
     (`autoAssign`)، فلا يأخذها كلَّها أوّلُ اسمٍ في القائمة. والمغلقةُ تبقى له: إسنادُها
     شاهدُ عمله وعمولتِه. والمستشارُ الجديدُ لم يعمل فيها بعد، فعمولتُه منها كعمولة
     الإسناد التلقائيّ: من أوّل تواصلٍ يسجّله. ولا مستشارَ غيرُه نشطا = تبقى عنده. */
  async redistribute(fromAdvisorId: string, actorId: string): Promise<{ moved: number; stayed: number }> {
    const links = await this.prisma.advisorAssignment.findMany({
      where: {
        advisorId: fromAdvisorId, unassignedAt: null,
        case: { status: { notIn: ['closed', 'enrolled', 'not_interested'] } },
      },
      select: { caseId: true },
      orderBy: { assignedAt: 'asc' },
    })
    let moved = 0
    for (const l of links) {
      if (await this.autoAssign(l.caseId, { exclude: [fromAdvisorId], actorId })) moved += 1
    }
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.cases.redistribute', entityType: 'user', entityId: fromAdvisorId,
      meta: { moved, stayed: links.length - moved },
    })
    return { moved, stayed: links.length - moved }
  }

  /** ما أسنده النظامُ ولم يغيّره إداريٌّ بعد — مفتوحا، في آخر ثلاثين يوما */
  async listAutoAssigned() {
    return this.prisma.advisorCase.findMany({
      where: {
        status: { notIn: ['closed', 'enrolled', 'not_interested'] },
        assignments: { some: { unassignedAt: null, automatic: true, assignedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } },
      },
      include: {
        lead: true,
        client: { select: { displayName: true, email: true } },
        assignments: { where: { unassignedAt: null }, select: { advisorId: true, assignedAt: true, advisor: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  /* ═══════════ من يشتري بلا تشخيص يجد مستشارا ═══════════

     كانت الحالةُ تولد من التشخيص أو من يد مستشار. فمن جاء إلى صفحة دورةٍ
     وطلب التسجيلَ أو دفع بلا تشخيصٍ لا يراه مستشارٌ أبدا. وقرارُ صاحب المنصّة
     (١٩ أكتوبر ٢٠٢٦) بين ثلاثة (عند التسجيل، أو عند أوّل طلب تسجيلٍ أو دفع، أو
     عند الدفع): **عند أوّل طلب تسجيلٍ أو دفع** — من أبدى نيّةً حقيقيّة، ولم يدفع
     بعد فيلحقه المستشارُ قبل الدفع.

     ولا تُفتح لمن عرفه مستشارٌ قبلُ: حالةٌ له بأيّ حال — مفتوحةً أو مغلقة —
     تعني أنّ مستشارا قرأه، وإسنادُه باقٍ فيراه في «طلابي». ولا لمن ترك رقمَه
     ضيفا ببريده وحالتُه تنتظر توثيقَه — تلحقه تلك (`lead-link.ts`). */
  async ensureBuyerCase(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { email: true, displayName: true, isTestAccount: true },
    })
    /* وحسابُ التجربة لا يفتح حالةَ بيع: يُثقل حِملَ مستشارٍ بعميلٍ لا وجودَ له
       (`test-account.ts`) */
    if (!user || user.isTestAccount) return null
    const known = await this.prisma.advisorCase.findFirst({
      where: {
        OR: [
          { clientId: userId },
          { lead: { userId } },
          {
            clientId: null, status: { notIn: ['closed', 'enrolled', 'not_interested'] },
            lead: { userId: null, email: { equals: user.email, mode: 'insensitive' } },
          },
        ],
      },
      select: { id: true },
    })
    if (known) return null
    const kase = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: { fullName: user.displayName, email: user.email, source: 'site', userId },
      })
      const created = await tx.advisorCase.create({
        data: { leadId: lead.id, clientId: userId, nextAction: 'طلب تسجيلا بلا تشخيص — تواصل قبل الدفع' },
      })
      await recordAudit(tx, {
        actorId: userId, action: 'advisor.case.buyer_opened', entityType: 'advisor_case', entityId: created.id,
        meta: { leadId: lead.id },
      })
      return created
    })
    await this.autoAssignQuietly(kase.id)
    return kase.id
  }

  /* ═══════════ دفع العميلُ — فحالتُه «سجّل» ═══════════

     كان المستشارُ يقرأ في «حالاتي» عميلا دفع وسُجّل وحالتُه «تواصلنا» — لا يعرف
     أنّ البيع تمّ إلّا إن فتح الحالة وقرأ التسجيلات، أو غيّرها بيده. وقرارُ صاحب
     المنصّة (١٩ أكتوبر ٢٠٢٦) بين اثنين (تتحوّل وحدَها، أو شارةُ «دفع» ويحوّلها هو):
     **تتحوّل وحدَها** — والحالةُ `enrolled` موجودةٌ لهذا بالضبط.

     ولا يخسر المستشارُ شيئا: إسنادُه باقٍ فيبقى العميلُ في «طلابي»، وعمولتُه تُحسب
     من الطلبات المدفوعة لا من الحالة. ويُبلَّغ: بيعٌ تمّ خبرُ عمل. */
  async markClientPaid(userId: string, orderId: string): Promise<number> {
    const cases = await this.prisma.advisorCase.findMany({
      where: {
        status: { notIn: ['closed', 'enrolled', 'not_interested'] },
        OR: [{ clientId: userId }, { lead: { userId } }],
      },
      select: {
        id: true, status: true,
        client: { select: { displayName: true } }, lead: { select: { fullName: true } },
        assignments: { where: { unassignedAt: null }, select: { advisorId: true } },
      },
    })
    for (const c of cases) {
      await this.prisma.advisorCase.update({ where: { id: c.id }, data: { status: 'enrolled', nextAction: null } })
      await recordAudit(this.prisma, {
        actorId: null, action: 'advisor.case.client_paid', entityType: 'advisor_case', entityId: c.id,
        before: { status: c.status }, after: { status: 'enrolled' }, meta: { orderId },
      })
      const name = c.client?.displayName ?? c.lead?.fullName ?? 'عميلك'
      for (const a of c.assignments) {
        await safeNotify(this.prisma, {
          userId: a.advisorId, channel: 'in_app', audience: 'staff',
          templateKey: 'advisor.case.client_paid',
          title: 'عميلك دفع وسجّل',
          body: `«${name}» دفع وصار مسجّلا — حالته صارت «سجّل»، ويبقى في «طلابي».`,
          data: { caseId: c.id },
        })
      }
    }
    return cases.length
  }

  /* ═══════════ المستشارُ يُدخل من قابله ═══════════

     كانت الحالاتُ تولد من **متعلّمٍ مسجَّلٍ أنهى التشخيص** ثمّ يُسنِدها
     إداريّ — ولا مسارَ غيرُه إطلاقا. فالمستشارُ الذي قابل عميلا في معرضٍ أو
     مكالمةٍ لا يستطيع إدخالَه: ينتظر أن يأتيَ الرجلُ إلى الموقع ويُنهي
     تشخيصا، ثمّ ينتظر إداريّا يُسنِدَه إليه.

     فهذا يُنشئ العميلَ المحتمَل وحالتَه **ويُسندها إليه في الفعل نفسِه** —
     من أدخل من قابله هو صاحبُها؛ لا معنًى لطابورِ إسنادٍ لحالةٍ لها صاحب.

     ── وحدّان يُقالان صراحةً ──

     ١) **قناةُ وصولٍ واحدةٌ على الأقلّ** (بريدٌ أو هاتف): حالةٌ بلا سبيلٍ
        إلى صاحبها ليست حالةً بل سطرا.
     ٢) **ولا تشخيصَ يُدَّعى**: `diagnosticSnapshot` تبقى فارغةً — ما لم
        يُقَس لا يُكتب، وشاشةُ الحالة تعرض «لا تشخيصَ بعد» فتُقرأ كما هي. */
  async createOwnCase(advisorId: string, input: {
    fullName: string; email?: string | null; phone?: string | null; note?: string | null
  }) {
    const fullName = input.fullName.trim()
    const email = input.email?.trim().toLowerCase() || null
    const phone = input.phone?.trim() || null
    if (fullName.length < 2) throw new AuthError('bad_name', 'الاسم حرفان على الأقلّ', 400)
    if (!email && !phone) {
      throw new AuthError('no_contact', 'بريد أو هاتف — حالة بلا سبيل إلى صاحبها لا تفتح', 400)
    }

    /* لا حالتان مفتوحتان لعميلٍ واحد — ولو أدخله اثنان */
    if (email) {
      const open = await this.prisma.advisorCase.findFirst({
        where: {
          status: { notIn: ['closed', 'enrolled', 'not_interested'] },
          OR: [{ lead: { email } }, { client: { email } }],
        },
        select: { id: true },
      })
      if (open) {
        throw new AuthError('case_exists', 'لهذا البريد حالة مفتوحة بالفعل — افتحها بدل إنشاء ثانية', 409)
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      /* حسابُ العميل إن كان له حسابٌ ببريده — فتُقرأ سيرتُه وتقدّمُه */
      const client = email ? await tx.user.findUnique({ where: { email }, select: { id: true } }) : null
      const lead = await tx.lead.create({
        data: { fullName, email, phone, source: 'advisor', userId: client?.id ?? null },
      })
      const kase = await tx.advisorCase.create({
        data: { leadId: lead.id, clientId: client?.id ?? null, nextAction: 'تواصل أول مع العميل' },
      })
      /* من أدخله هو صاحبُه — إسنادٌ في الفعل نفسِه لا طابورٌ ثانٍ */
      await tx.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedBy: advisorId } })
      if (input.note?.trim()) {
        await tx.advisorNote.create({ data: { caseId: kase.id, authorId: advisorId, body: input.note.trim() } })
      }
      await recordAudit(tx, {
        actorId: advisorId, action: 'advisor.case.create_own', entityType: 'advisor_case', entityId: kase.id,
        meta: { leadId: lead.id, hasAccount: Boolean(client) },
      })
      return kase
    })
    return created
  }

  /* ═══════════ الزائرُ يطلب بنفسه أن يُتواصَل معه ═══════════

     آخرَ التشخيص، لمن لا حساب له (والعلّةُ في `guest-contact.ts`). يُنشئ
     عميلا محتملا وحالةً تُسنَد لأقلّ المستشارين حالاتٍ (`autoAssign`) — وإن لا
     مستشارَ نشطا وقعت في طابور «حالات بلا مستشار» كما كانت.

     ── وثلاثةُ حدودٍ تُقال صراحةً ──

     ١) **لا يُربط بحسابٍ ببريده.** البريدُ هنا مكتوبٌ لا مُثبَت: من كتب بريدَ
        غيره لا يصل بحالته إلى حساب ذاك — تسجيلاتِه وسيرتِه في عين المستشار.
        فالربطُ بالحساب لا يقع إلّا بإثبات البريد (`lead-link.ts`).
     ٢) **ولا حالتان مفتوحتان لصاحبٍ واحد** — ولو أرسل مرّتين أو من جهازين.
        فإن وُجدت حالةٌ مفتوحةٌ ببريده أو رقمه كُتب في سيرتها أنّه عاد يطلب،
        وبما كتب. ولا يُمسّ عميلُها ولا نتيجتُها: من يعرف بريدَ غيره لا يبدّل
        بطلبه رقمَ ذاك أو تشخيصَه في عين مستشاره.
     ٣) **والجوابُ واحدٌ في الحالين.** بابٌ عامٌّ يقول «لهذا البريد حالة» يكشف
        لأيّ أحدٍ من يتعامل معنا — فلا يُقال عن الموجود شيء. */
  async requestContactAsGuest(input: {
    fullName: string; email?: string | null; phone?: string | null; snapshot?: unknown
  }, ip?: string): Promise<{ ok: true }> {
    const fullName = input.fullName.trim()
    const email = input.email?.trim().toLowerCase() || null
    const typedPhone = input.phone?.trim() || null
    const phone = typedPhone ? normalizePhone(typedPhone) : null
    if (fullName.length < 2) throw new AuthError('bad_name', 'اكتب اسمك — حرفان على الأقل', 400)
    if (typedPhone && !phone) throw new AuthError('bad_phone', 'رقم واتساب غير صحيح — اكتبه بالأرقام', 400)
    if (!email && !phone) throw new AuthError('no_contact', 'اكتب رقم واتساب أو بريدا لنتواصل معك', 400)
    const snapshot = guestSnapshot(input.snapshot)

    const open = await this.prisma.advisorCase.findFirst({
      where: {
        status: { notIn: ['closed', 'enrolled', 'not_interested'] },
        OR: [
          ...(email ? [{ lead: { email } }, { client: { email } }] : []),
          ...(phone ? [{ lead: { phone } }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (open) {
      await this.prisma.contactEvent.create({
        data: {
          caseId: open.id, channel: 'in_app', direction: 'in',
          summary: `عاد يطلب أن نتواصل معه من آخر التشخيص — ${[
            `الاسم: ${fullName}`, phone ? `واتساب: ${phone}` : null, email ? `البريد: ${email}` : null,
          ].filter(Boolean).join(' · ')}`,
        },
      })
      await recordAudit(this.prisma, {
        action: 'advisor.case.guest_request', entityType: 'advisor_case', entityId: open.id, ip,
        meta: { repeated: true, byPhone: Boolean(phone), byEmail: Boolean(email) },
      })
      return { ok: true }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          fullName, email, phone, source: 'diagnostic', consentAr: GUEST_CONTACT_CONSENT_AR,
          ...(snapshot ? { diagnosticSnapshot: snapshot } : {}),
        },
      })
      const kase = await tx.advisorCase.create({
        data: {
          leadId: lead.id, nextAction: 'تواصل أول — طلبه بنفسه آخر التشخيص',
          ...(snapshot ? { diagnosticSnapshot: snapshot } : {}),
        },
      })
      await recordAudit(tx, {
        action: 'advisor.case.guest_request', entityType: 'advisor_case', entityId: kase.id, ip,
        meta: { leadId: lead.id, byPhone: Boolean(phone), byEmail: Boolean(email), withResult: Boolean(snapshot) },
      })
      return kase
    })
    await this.autoAssignQuietly(created.id)
    return { ok: true }
  }

  /* ── بوابة المستشار — المسند إليه فقط ── */

  /** حارس: هل هذه الحالة مسندة لهذا المستشار الآن؟ */
  async assertAssigned(advisorId: string, caseId: string) {
    const link = await this.prisma.advisorAssignment.findFirst({
      where: { caseId, advisorId, unassignedAt: null },
    })
    if (!link) throw new AuthError('not_assigned', 'هذه الحالة ليست مسندة إليك', 403)
    return link
  }

  async myCases(advisorId: string, status?: string) {
    const links = await this.prisma.advisorAssignment.findMany({
      where: { advisorId, unassignedAt: null },
      select: { caseId: true },
    })
    return this.prisma.advisorCase.findMany({
      where: { id: { in: links.map((l) => l.caseId) }, ...(status ? { status } : {}) },
      include: {
        lead: true,
        client: { select: { displayName: true, email: true } },
        followUps: { where: { doneAt: null }, orderBy: { scheduledAt: 'asc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  /** عمولتي المستحقّة فعلا من عملائي الدافعين — بحساب ملفّه عند الإدارة نفسِه
      (`attributedRevenue`)، لكن للمستشار نفسه لا لمن يديره. كانت الإدارة وحدها ترى هذا الرقم. */
  async myEarnings(advisorId: string) {
    const MIN_RATINGS_TO_SHOW = 3
    const [profile, activeCases, revenueFromReferrals, ratingAgg] = await Promise.all([
      this.prisma.advisorProfile.findUnique({ where: { userId: advisorId } }),
      this.prisma.advisorAssignment.count({ where: { advisorId, unassignedAt: null } }),
      attributedRevenue(this.prisma, advisorId),
      /* المعدَّلُ على كلّ التقييمات المرسَلة لا على المعتمَد منها.

         كان مقيَّدا بـ`publishStatus: 'approved'` — وهي القاعدة التي يمنعها
         المخطَّطُ نفسُه صراحة: الاعتمادُ يحكم **التعليقَ المكتوب وحدَه** لا
         الدرجة، «لو اختارت الإدارةُ أيَّ الدرجات تدخل فيه لصار الرقمُ
         مصنوعا». و`rating.service` يحسبه بلا هذا القيد — فكانت للمستشار
         قاعدةٌ تخالف قاعدةَ المدرّب والدورة. */
      this.prisma.rating.aggregate({
        where: { subjectType: 'advisor', subjectId: advisorId },
        _avg: { score: true }, _count: true,
      }),
    ])

    /* لا عمولةَ بلا نسبةٍ اتّفقت عليها الإدارة صراحة — «لم تُحدَّد بعد» غير «صفر» */
    const commissionPct = profile ? Number(profile.commissionPct) : null
    const commissionOwed = commissionPct !== null ? Math.round(revenueFromReferrals * commissionPct) / 100 : null

    return {
      commissionPct, commissionOwed, revenueFromReferrals, currency: 'USD',
      /* «الحالات النشطة» تعني النشطةَ فعلا — بخلاف مقام العمولة */
      activeCases,
      ratingAvg: ratingAgg._count >= MIN_RATINGS_TO_SHOW ? Number(ratingAgg._avg.score) : null,
      ratingCount: ratingAgg._count,
    }
  }

  /** ملف الحالة الكامل للمستشار — العميل والتشخيص والنتيجة وأثر القرار والتواصل والملاحظات والمهام */
  async caseDetail(advisorId: string, caseId: string) {
    await this.assertAssigned(advisorId, caseId)
    const kase = await this.prisma.advisorCase.findUnique({
      where: { id: caseId },
      include: {
        lead: true,
        client: {
          select: {
            displayName: true, email: true,
            learnerProfile: true,
            cvSubmissions: {
              where: { status: 'active' },
              select: { id: true, originalName: true, mime: true, sizeBytes: true, createdAt: true },
            },
          },
        },
        notes: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        followUps: { orderBy: { scheduledAt: 'desc' } },
        contactEvents: { orderBy: { createdAt: 'desc' } },
        assignments: { orderBy: { assignedAt: 'desc' } },
      },
    })
    if (!kase) throw new AuthError('not_found', 'الحالة غير موجودة', 404)
    return kase
  }

  /* ── الوجه الثاني: المتابعة الأكاديمية ──

     المستشار ليس بائعا ينصرف بعد الإغلاق. دورُه المعلَن استشاريّ: يبقى
     يتابع تقدّم من أسندناهم إليه، ويرى تقييماتهم ومواعيد شعبهم، فيتدخّل
     قبل أن يتعثّروا لا بعد أن يتركوا.

     وكان لا يرى شيئا من ذلك: خمسُ صلاحيّاتٍ تكفي للبيع وحده. فمن سأله
     عميلُه «أين وصلت؟» لم يجد جوابا في المنصّة. */

  /** الصورة الأكاديمية لعميلٍ مسند — تسجيلاته وتقدّمها وجلساتُه القادمة وخطّته */
  async learnerSnapshot(advisorId: string, caseId: string) {
    await this.assertAssigned(advisorId, caseId)
    const kase = await this.prisma.advisorCase.findUnique({
      where: { id: caseId },
      select: { clientId: true },
    })
    if (!kase) throw new AuthError('not_found', 'الحالة غير موجودة', 404)
    /* لا حساب للعميل بعد — حالةٌ مشروعة لا خطأ: عميلٌ محتمل لم يسجّل */
    if (!kase.clientId) return { hasAccount: false as const, enrollments: [], upcomingSessions: [], plan: null, diagnostic: null }

    const userId = kase.clientId
    const now = new Date()

    const [enrollments, upcoming, plan, profile] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        select: {
          id: true, status: true, createdAt: true,
          courseProgress: { select: { percent: true } },
          cohort: {
            select: {
              id: true, title: true, status: true, startsAt: true,
              course: { select: { id: true, status: true } },
            },
          },
          moduleProgress: { select: { moduleId: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cohortSession.findMany({
        where: {
          startsAt: { gte: now },
          cohort: { enrollments: { some: { userId, status: 'enrolled' } } },
        },
        select: {
          id: true, title: true, startsAt: true, endsAt: true, status: true,
          cohort: { select: { id: true, title: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
      this.prisma.learnerPlan.findFirst({
        where: { userId, status: 'active' },
        select: {
          id: true, nameAr: true, hostPathwayId: true, giftCourseId: true,
          items: { select: { courseId: true, sequence: true }, orderBy: { sequence: 'asc' } },
        },
      }),
      this.prisma.learnerProfile.findUnique({
        where: { userId },
        select: { diagnosticSnapshot: true, attachedAt: true, goalAr: true },
      }),
    ])

    /* خلاصةُ التشخيص — كانت سطورا مبنيّة في المتصفح من إجاباتٍ لا تصل
       الخادم أصلا (session storage)، فلا يراها المستشار قط. الرابطُ هنا
       بنتيجة التشخيص المرفقة بالحساب فعلا (`attachDiagnostic`) — أوجهُ
       النمو وأسبابُ الترشيح ودرجةُ الثقة، لا نصٌّ يزول بإغلاق التبويب. */
    const diagnostic = summarizeDiagnostic(profile?.diagnosticSnapshot, profile?.goalAr, profile?.attachedAt)

    return { hasAccount: true as const, enrollments, upcomingSessions: upcoming, plan, diagnostic }
  }

  /* ── التشغيل على الحالة — كلها محروسة بالإسناد ── */

  async setStatus(advisorId: string, caseId: string, status: string, note?: string) {
    if (!CASE_STATUSES.includes(status as (typeof CASE_STATUSES)[number])) {
      throw new AuthError('bad_status', 'حالة غير معروفة')
    }
    await this.assertAssigned(advisorId, caseId)
    const before = await this.prisma.advisorCase.findUnique({ where: { id: caseId } })
    const updated = await this.prisma.advisorCase.update({ where: { id: caseId }, data: { status } })
    await recordAudit(this.prisma, {
      actorId: advisorId, action: 'advisor.case.status', entityType: 'advisor_case', entityId: caseId,
      before: { status: before?.status }, after: { status }, reason: note,
    })
    return updated
  }

  async setNextAction(advisorId: string, caseId: string, nextAction: string, nextFollowUpAt?: Date) {
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorCase.update({ where: { id: caseId }, data: { nextAction, nextFollowUpAt } })
  }

  async addNote(advisorId: string, caseId: string, body: string) {
    if (body.trim().length < 3) throw new AuthError('empty_note', 'الملاحظة فارغة')
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorNote.create({ data: { caseId, authorId: advisorId, body } })
  }

  async addTask(advisorId: string, caseId: string, title: string, dueAt?: Date) {
    if (title.trim().length < 3) throw new AuthError('empty_task', 'عنوان المهمة فارغ')
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorTask.create({ data: { caseId, title, dueAt, createdBy: advisorId } })
  }

  async completeTask(advisorId: string, taskId: string) {
    const task = await this.prisma.advisorTask.findUnique({ where: { id: taskId } })
    if (!task) throw new AuthError('not_found', 'المهمة غير موجودة', 404)
    await this.assertAssigned(advisorId, task.caseId)
    return this.prisma.advisorTask.update({ where: { id: taskId }, data: { status: 'done', doneAt: new Date() } })
  }

  async addFollowUp(advisorId: string, caseId: string, input: { scheduledAt: Date; channel?: string; note?: string }) {
    await this.assertAssigned(advisorId, caseId)
    const fu = await this.prisma.followUp.create({
      data: { caseId, scheduledAt: input.scheduledAt, channel: input.channel ?? 'whatsapp', note: input.note, createdBy: advisorId },
    })
    /* المتابعة القادمة تنعكس على الحالة */
    await this.prisma.advisorCase.update({ where: { id: caseId }, data: { nextFollowUpAt: input.scheduledAt } })
    return fu
  }

  async completeFollowUp(advisorId: string, followUpId: string, outcome: string, note?: string) {
    const fu = await this.prisma.followUp.findUnique({ where: { id: followUpId } })
    if (!fu) throw new AuthError('not_found', 'المتابعة غير موجودة', 404)
    await this.assertAssigned(advisorId, fu.caseId)
    return this.prisma.followUp.update({
      where: { id: followUpId }, data: { doneAt: new Date(), outcome, note: note ?? fu.note },
    })
  }

  async addContactEvent(advisorId: string, caseId: string, input: { channel: string; direction?: 'out' | 'in'; summary: string }) {
    if (input.summary.trim().length < 3) throw new AuthError('empty_summary', 'ملخص التواصل فارغ')
    await this.assertAssigned(advisorId, caseId)
    const event = await this.prisma.contactEvent.create({
      data: { caseId, channel: input.channel, direction: input.direction ?? 'out', summary: input.summary, createdBy: advisorId },
    })
    /* أول تواصل ينقل الحالة من new تلقائيا */
    const kase = await this.prisma.advisorCase.findUnique({ where: { id: caseId } })
    if (kase?.status === 'new') {
      await this.prisma.advisorCase.update({ where: { id: caseId }, data: { status: 'contacted' } })
    }
    return event
  }
}
