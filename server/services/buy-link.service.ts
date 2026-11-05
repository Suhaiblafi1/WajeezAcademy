/* «جهّز رابط شراء» — رابطُ `/build` يولّده السوبر أدمن أو المستشار لمتعلّمٍ بعينه (٥ نوفمبر ٢٠٢٦، المرحلة الثانية).

   ═══ من يولّد ولمن ═══
   · **السوبر أدمن** (`super_admin`) لأيّ متعلّم — من صفّه في صفحات المنح (معرّفُ نموذجه `leadId`).
   · **المستشار** لمن في حالاته المسندة إليه الآن وحدَه (`caseId` بإسنادٍ قائم) — وغيرُه يُردّ «ليست مسندة إليك».
   · ولا دورَ ثالث. والفحصُ هنا في الخادم، والشاشةُ تُخفي الزرَّ فقط.

   ═══ وما لا يملكه المستشارُ بها ═══
   لا سعرَ ولا خصمَ ولا كودَ جديد: الكودُ الذي يُوضع في رابطه كودُ متعلّمه نفسُه (منحتُه) أو لا كود. والخصمُ الإضافيُّ
   يبقى بابُه «طلبات المستشارين» (`advisor-request.service.ts`). والسوبر أدمن يضع كودَ المتعلّم أو أيَّ كوبونٍ قائمٍ صالح —
   ولا يُنشئ هنا شيئا. والسعرُ في الحالين من المعاينة نفسِها (`CommerceService.preview`).

   ═══ والأثرُ والعمولة ═══
   كلُّ توليدٍ يُكتب أثرا (`buy_link.generate`): من ولّد، ولمن، وأيُّ الدورات والكود، ومتى. والرابطُ يحمل رمزا موقَّعا
   (`bl`) لا يُزوَّر: معرّفُ الأثر ونوعُ مولّده (`admin` أو `advisor`) وتوقيعُهما. وعند الشراء يُقرأ الرمزُ في الخادم ويُكتب
   في أثر الطلب (`order.checkout`)، ولا يُوثق بشيءٍ آخر في الرابط.

   وقاعدةُ العمولة — قرارُ صاحب المنصّة (٥ نوفمبر ٢٠٢٦، «Hybrid»): تبقى قاعدةُ اليوم (نسبةُ المستشار من كلّ دفعةٍ لمتعلّمه
   في نوبته)، **إلّا ما جاء من رابطٍ ولّده السوبر أدمن أو من رابط حملة واتساب** فلا عمولةَ مستشارٍ عليه
   (`commissionExcludedOrders`، يقرؤه `attributedOrders`). وعمولةُ المؤثّرين لا تُمسّ.

   والحارس: `server/tests/commerce/buy-link-tool.test.ts`. */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { derivedSecret } from './storage.service'
import { buildLinkPath, type BuildLinkAdd } from '../../src/application/commerce/build-link'
import { MAX_BUILT_COURSES } from '../../src/application/commerce/discount-policy'
import { isWhatsappCampaign, WHATSAPP_CAMPAIGN_TRACKING } from '../../src/application/commerce/buy-link-campaign'
import { cleanReason, firstNameAr, goPath } from '../../src/application/commerce/private-path'
import { mintPrivatePath } from './private-path.service'
import { publicSiteUrl } from './site-url'

export type BuyLinkKind = 'admin' | 'advisor'

export interface BuyLinkActor {
  userId: string
  roles: readonly string[]
}

export type BuyLinkTarget = { leadId: string } | { caseId: string }

export interface BuyLinkInput {
  courseId: string
  cohortId?: string | null
  adds?: BuildLinkAdd[]
  /** الكود — للسوبر أدمن كوبونٌ قائم، وللمستشار كودُ متعلّمه وحدَه. وفارغٌ = بلا كود */
  code?: string | null
  /** رابطُ حملة واتساب — للسوبر أدمن وحدَه، ولا عمولةَ مستشارٍ عليه */
  whatsapp?: boolean
  /** سببُ كلّ دورةٍ في «المسار الخاصّ» — بمعرّفها، قصيرا (`PATH_REASON_MAX`) */
  reasons?: Record<string, string>
}

const sign = (payload: string) => createHmac('sha256', derivedSecret('buy-link')).update(payload).digest('base64url').slice(0, 22)

/** الرمزُ الموقَّع في الرابط — `<معرّف الأثر>.<النوع>.<التوقيع>` */
export function buyLinkToken(linkId: string, kind: BuyLinkKind): string {
  return `${linkId}.${kind}.${sign(`${linkId}.${kind}`)}`
}

/** يصدّق الرمز — أو `null` لما زُوّر أو شُوّه */
export function verifyBuyLinkToken(token: unknown): { linkId: string; kind: BuyLinkKind } | null {
  if (typeof token !== 'string' || token.length > 120) return null
  const [linkId, kind, sig, ...rest] = token.split('.')
  if (rest.length > 0 || !linkId || !sig || (kind !== 'admin' && kind !== 'advisor')) return null
  const want = Buffer.from(sign(`${linkId}.${kind}`))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  return { linkId, kind }
}

/** ما يُكتب في أثر الطلب عن رابطه — بعد التصديق، ومن أثر توليده لا من الرابط */
export async function buyLinkForOrder(prisma: PrismaClient, token: unknown): Promise<{ id: string; kind: BuyLinkKind; by: string; whatsapp?: true } | null> {
  const v = verifyBuyLinkToken(token)
  if (!v) return null
  const ev = await prisma.auditEvent.findFirst({
    where: { action: 'buy_link.generate', meta: { path: ['linkId'], equals: v.linkId } },
    select: { actorId: true, meta: true },
  })
  const kind = (ev?.meta as { kind?: string } | null)?.kind
  if (!ev?.actorId || kind !== v.kind) return null
  /* ورابطُ حملة واتساب يُقال في أثر الطلب من توليده لا من وسم المتصفّح — فصفحةُ المسار الخاصّ (`/go`) لا وسمَ في عنوانها،
     و«اشترى عبر حملة واتساب» يبقى صحيحا (`orderViaAr`) — ٥ نوفمبر ٢٠٢٦ */
  const whatsapp = (ev.meta as { whatsapp?: unknown } | null)?.whatsapp === true
  return { id: v.linkId, kind: v.kind, by: ev.actorId, ...(whatsapp ? { whatsapp: true as const } : {}) }
}

/** طلباتٌ لا عمولةَ مستشارٍ عليها — رابطُ السوبر أدمن أو حملةُ واتساب، من أثر طلبها (قرارُ «Hybrid») */
export async function commissionExcludedOrders(prisma: PrismaClient, orderIds: readonly string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set()
  const evs = await prisma.auditEvent.findMany({
    where: { action: 'order.checkout', entityId: { in: [...orderIds] } },
    select: { entityId: true, meta: true },
  })
  const out = new Set<string>()
  for (const e of evs) {
    const m = (e.meta ?? {}) as { buyLink?: { kind?: string }; touch?: unknown }
    /* ورابطُ المستشار يغلب أثرَ حملةٍ قديم (٥ نوفمبر ٢٠٢٦): المصدرُ آخرُ زيارةٍ بإشارةٍ يحفظها المتصفّحُ بلا أجل، ورابطُ
       المستشار لا إشارةَ فيه (`bl` وحدَه) — فمن نقر حملةَ واتساب مرّةً ثمّ اشترى من رابط مستشاره بعد أسابيع سقطت عمولتُه */
    if (m.buyLink?.kind === 'advisor') continue
    if (m.buyLink?.kind === 'admin' || isWhatsappCampaign(m.touch)) out.add(e.entityId!)
  }
  return out
}

export class BuyLinkService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** من يولّد لمن — ويُرمى لكلّ ما سواهما */
  private async resolve(actor: BuyLinkActor, target: BuyLinkTarget) {
    if ('leadId' in target) {
      if (!actor.roles.includes('super_admin')) throw new AuthError('forbidden', 'هذه الأداة للمدير الأعلى والمستشار وحدهما', 403)
      const lead = await this.prisma.lead.findFirst({
        where: { id: target.leadId, erasedAt: null },
        select: { id: true, fullName: true, userId: true, grantCode: { select: { coupon: { select: { code: true, active: true } } } } },
      })
      if (!lead) throw new AuthError('not_found', 'المتعلم غير موجود', 404)
      return { kind: 'admin' as const, entityType: 'lead', entityId: lead.id, name: lead.fullName, leadId: lead.id, userId: lead.userId, ownCode: lead.grantCode?.coupon?.active ? lead.grantCode.coupon.code : null }
    }
    const assigned = await this.prisma.advisorAssignment.findFirst({
      where: { caseId: target.caseId, advisorId: actor.userId, unassignedAt: null },
      select: { case: { select: { id: true, leadId: true, clientId: true, lead: { select: { fullName: true } }, client: { select: { displayName: true, email: true } } } } },
    })
    /* والسوبر أدمن يولّد من صفّ المنحة لا من حالةٍ ليست له — فلا بابَ هنا لغير المسند إليه */
    if (!assigned) throw new AuthError('not_assigned', 'هذه الحالة ليست مسندة إليك', 403)
    const c = assigned.case
    /* كودُ منحته: من نموذج حالته، أو من نموذجٍ بحسابه أو ببريده — قراءةٌ لا تكتب شيئا */
    const lead = await this.prisma.lead.findFirst({
      where: {
        erasedAt: null, grantCode: { isNot: null },
        OR: [
          ...(c.leadId ? [{ id: c.leadId }] : []),
          ...(c.clientId ? [{ userId: c.clientId }] : []),
          ...(c.client?.email ? [{ email: { equals: c.client.email, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { grantCode: { select: { coupon: { select: { code: true, active: true } } } } },
    })
    return {
      kind: 'advisor' as const, entityType: 'advisor_case', entityId: c.id,
      name: c.client?.displayName ?? c.lead?.fullName ?? '—', leadId: c.leadId, userId: c.clientId,
      ownCode: lead?.grantCode?.coupon?.active ? lead.grantCode.coupon.code : null,
    }
  }

  /** ما تفتح به الأداة: اسمُ المتعلّم وكودُه إن كان — ونوعُ المولّد */
  async prepare(actor: BuyLinkActor, target: BuyLinkTarget) {
    const r = await this.resolve(actor, target)
    return { kind: r.kind, learnerName: r.name, code: r.ownCode, canChooseCode: r.kind === 'admin', canWhatsapp: r.kind === 'admin' }
  }

  /** يولّد الرابطَ ويكتب أثرَه — ولا يمسّ سعرا ولا كودا */
  async generate(actor: BuyLinkActor, target: BuyLinkTarget, input: BuyLinkInput) {
    const r = await this.resolve(actor, target)
    const adds = (input.adds ?? []).filter((a, i, all) => a.courseId !== input.courseId && all.findIndex((b) => b.courseId === a.courseId) === i)
    if (adds.length + 1 > MAX_BUILT_COURSES) throw new AuthError('too_many', `${MAX_BUILT_COURSES} دورات بحد أقصى`, 400)

    /* الدوراتُ والشعبُ تُصدَّق هنا: دورةٌ منشورة، وشعبةٌ من دورتها نفسِها */
    const wanted = [{ courseId: input.courseId, cohortId: input.cohortId ?? null }, ...adds]
    const courses = await this.prisma.course.findMany({ where: { id: { in: wanted.map((w) => w.courseId) }, status: 'published' }, select: { id: true } })
    if (courses.length !== wanted.length) throw new AuthError('bad_course', 'دورة غير موجودة أو غير منشورة', 400)
    const cohortIds = wanted.flatMap((w) => (w.cohortId ? [w.cohortId] : []))
    if (cohortIds.length > 0) {
      const found = await this.prisma.cohort.findMany({ where: { id: { in: cohortIds } }, select: { id: true, courseId: true } })
      for (const w of wanted) {
        if (w.cohortId && found.find((f) => f.id === w.cohortId)?.courseId !== w.courseId) {
          throw new AuthError('bad_cohort', 'الشعبة لا تتبع دورتها', 400)
        }
      }
    }

    /* الكود: المستشارُ لا يضع إلّا كودَ متعلّمه — ولا يُنشئ ولا يختار غيرَه. والسوبر أدمن كوبونا قائما صالحا */
    let code = input.code?.trim().toUpperCase() || null
    if (r.kind === 'advisor') {
      if (code && code !== r.ownCode) throw new AuthError('code_not_allowed', 'لا تضع إلا كود منحة المتعلم نفسه. والخصم الإضافي من «طلبات المستشارين»', 403)
    } else if (code) {
      const c = await this.prisma.coupon.findUnique({ where: { code }, select: { active: true } })
      if (!c?.active) throw new AuthError('bad_coupon', 'الكود غير موجود أو موقوف', 400)
    }
    if (input.whatsapp && r.kind !== 'admin') throw new AuthError('forbidden', 'رابط حملة واتساب للمدير الأعلى وحده', 403)
    code = code ?? null

    /* ═══ والمسارُ الخاصّ يُصدَّق بالمعاينة نفسِها قبل أن يُرسل (٥ نوفمبر ٢٠٢٦) ═══
       صفحتُه تعرض سعرا وزرَّ «أكمل التسجيل» — فما يردّه الدفعُ يُقال لمن يولّده الآن لا للمتعلّم بعد أن يفتحه: كودٌ لا
       يسع عددَ الدورات، أو شعبةٌ امتلأت أو مسجَّلٌ فيها. والمعاينةُ هي حسابُ الدفع نفسُه (`CommerceService.preview`). */
    /* والمسارُ لمن اختيرت لكلّ دورةٍ فيه شعبتُها — والأداةُ تختارها دائما. وما سواه (نداءٌ بلا شعب) رابطُ `/build` الطويلُ كما كان */
    const asPath = wanted.every((w) => !!w.cohortId)
    if (asPath) {
      const { CommerceService } = await import('./commerce.service')
      const check = await new CommerceService(this.prisma).preview(r.userId ?? null, cohortIds, code ?? undefined)
      if (check.couponError) throw new AuthError('path_code', check.couponError.messageAr, 409)
      if (check.excluded.length > 0) throw new AuthError('path_unavailable', check.excluded[0].messageAr, 409)
    }

    const linkId = randomUUID()
    const token = buyLinkToken(linkId, r.kind)
    const tracking: Record<string, string> = { ...(input.whatsapp ? WHATSAPP_CAMPAIGN_TRACKING : {}), bl: token }
    const path = buildLinkPath({ courseId: input.courseId, cohortId: input.cohortId ?? null, adds, code, tracking })
    const goCode = !asPath ? null : await mintPrivatePath(this.prisma, actor.userId, {
      linkId, token, kind: r.kind,
      learnerKey: r.userId ? `user:${r.userId}` : `lead:${r.leadId}`,
      firstName: firstNameAr(r.name),
      courses: wanted.map((w) => ({ courseId: w.courseId, cohortId: w.cohortId!, reasonAr: cleanReason(input.reasons?.[w.courseId]) })),
      code, whatsapp: Boolean(input.whatsapp),
    })
    await recordAudit(this.prisma, {
      actorId: actor.userId, action: 'buy_link.generate', entityType: r.entityType, entityId: r.entityId,
      meta: {
        linkId, kind: r.kind, learner: { name: r.name, leadId: r.leadId, userId: r.userId },
        courses: wanted, code, whatsapp: Boolean(input.whatsapp), goCode,
      },
    })
    return {
      path, linkId,
      goPath: goCode ? goPath(goCode) : null,
      goUrl: goCode ? `${publicSiteUrl()}${goPath(goCode)}` : null,
    }
  }
}
