/* «منحة أعضاء وجيز» — كودٌ شخصيٌّ بنسبةٍ يغيّرها صاحبُ المنصّة (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   حملةٌ إلى أعضاء وجيز (نحو ستّة آلاف رقمٍ وعشرين ألفَ بريد) تعلن الأكاديميّةَ بمنحٍ لهم. وقرارُ
   صاحب المنصّة: «B ولكن الخصم يكون أعلى مثلا ٦٠٪ ويكون خاصّا لأعضاء وجيز ومحدودَ الكمّيّة …
   ويمكن نقلُه لشخصٍ آخر»، ثمّ «A ويحقّ لي تغيير الـ٦٠٪ كما أشاء» — المنحةُ **بدلُ** خصم الباقة.

   ═══ ما يقع ═══

   ١) **كودٌ لكلّ من عبّأ نموذج الحملة** (`issue`) — واحدٌ لكلّ صاحب نموذج: من عبّأه مرّتين أخذ
      كودَه نفسَه. ويُعطى ما دامت الحملةُ مشغّلةً لم تنتهِ ولم يبلغ المُعطى عددَها.
   ٢) **ونسبتُه نسبةُ الحملة يومَ أُعطي** — تُكتب في كوبونه. فتغييرُ النسبة يقع على ما يُعطى بعده،
      وما أُعطي قبله يبقى بما قيل لصاحبه.
   ٣) **ويُستعمل حتى يبلغ حدَّ دوراته ولا يُربط بحساب** — قرارُ صاحب المنصّة (٢٨ أكتوبر ٢٠٢٦): «لماذا لا يقبل أن
      يستعمل الكودَ مرّةً أخرى إن اشترى دورةً أو له طلبٌ سابق؟ قلنا الحدُّ الأعلى ٥ دورات على هذا الكود نفسِه».
      فالحدُّ عددُ الدورات على الكود في كلّ مشترياته (`coursesLeft`)، لا مرّةٌ واحدة — ومن أعطاه غيرَه استعمل ذاك
      ما بقي منه. والاستعمالُ يُحجز مع الطلب ويُفرَج عنه إن هُجر (`coupon-ledger.ts`).
      **وطلبُه الذي لم يُدفع بالكود لا يمنع** — كان يُردّ بـ«أكمله من الفواتير»، فعلق من فتح صفحةَ دفعٍ لم يكملها.
      وصار يشتري بكوده ما بقي من حدّه، وطلبُه المعلَّقُ يُعدّ منه حتى يُدفع أو يُلغى — يكمله أو يلغيه من لوح الشراء
      نفسِه («اترك له الخيار أن يكمل الدفع من خلال نفس المكان»، ٢٨ أكتوبر ٢٠٢٦؛ `BuyPanel.tsx`).
   ٤) **ومنحةٌ واحدةٌ لكلّ متعلّم** — من جمع أكوادَ غيره لا يشتري بكودٍ ثانٍ؛ وإلّا صار «محدودُ العدد»
      بابا لمن جمع أكثر. وكودُه نفسُه يعود إليه حتى حدّه.
   ٥) **والحملةُ تُقرأ عند الاستعمال** — إيقافُها يوقف كلَّ كود، وتمديدُ نهايتها يمدّه.
   ٥ب) **وعلى عددٍ من الدورات بحدٍّ أقصى للكود كلِّه** — «يحقّ لك فقط ٤ دورات»، ثمّ «٥ دورات على هذا الكود نفسِه».
      والحدُّ بيد صاحب المنصّة كالنسبة. والمعدودُ دوراتُ طلباته المحجوزة والمدفوعة بثمنٍ (الهديّةُ لا تُعدّ). وشراءان
      متزامنان في نافذتين قد يتجاوزانه بدورة — لا قفلَ عليه.
   ٦) **وعند الشراء المباشر وحدَه** — بابا الموافقة الإداريّة يردّانه، كما يردّان كودَ المدرّب:
      فيهما لا يُسأل أهو أوّلُ منحةٍ لصاحبه ولا أيُّ السعرين أقلّ.

   وخصمُ المنحة كلُّه من هامش الأكاديميّة: أجرُ المقعد يُدفع للمدرّب كاملا، ونسبةُ الإيراد تُحسب
   على سعر القائمة. فـ`margins` يقابل سعرَ كلّ شعبةٍ مفتوحةٍ بعد المنحة بأجر مقعدها قبل الإطلاق.

   والحارس: `server/tests/commerce/member-grant.test.ts`. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EarningsService } from './earnings.service'
import { cohortLeadTrainers } from './cohort-lead'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import {
  GRANT_CAMPAIGNS, GRANT_CLOSED_AR, GRANT_CODE_PREFIX, GRANT_ONCE_AR, GRANT_SOLD_OUT_AR,
  MEMBER_GRANT_SLUG, grantPrice, grantUsedUpAr, type GrantSlug,
} from '../../src/application/commerce/grant'
import { influencerCommission } from '../../src/application/commerce/influencer'

/** ما يحسب منحةً مستعملة: طلبٌ ينتظر الدفعَ بها أو دُفع — والمردودُ كلُّه يُعيدها */
const GRANT_HOLDS = ['pending_payment', 'paid', 'partially_refunded']

/** الشعبُ التي تُعرض في فحص الهامش — ما يُشترى اليوم أو يكاد */
const MARGIN_STATUSES = ['open', 'full', 'active']

export interface GrantSettingsInput {
  percentOff?: number
  maxCodes?: number | null
  maxCourses?: number
  closesAt?: Date | null
  active?: boolean
}

/** كوبونٌ وجهُه كودُ منحة — كما يقرؤه التسعير */
export interface GrantCoupon {
  id: string
  usedCount: number
  maxUses: number | null
  grantCode: { campaign: { id: string; active: boolean; closesAt: Date | null; maxCourses: number } } | null
}

const isOpen = (c: { active: boolean; closesAt: Date | null }, now: Date) => c.active && (c.closesAt === null || c.closesAt > now)

/* ═══ وحملتان لا واحدة (٢٦ أكتوبر ٢٠٢٦) ═══

   «منحة وجيز» بلا كود، و«منحة مؤثرين وجيز» بكود المؤثّر — قرارُ صاحب المنصّة. والقواعدُ أعلاه واحدةٌ فيهما، ولكلٍّ
   صفُّه بنسبته وعدده ونهايته. وفرقان: كودُ الثانية يحمل مؤثّرَه وعمولتَه يومَ أُعطي (`issue`)، و«منحةٌ واحدةٌ لكلّ
   متعلّم» على الحملتين معا — من اشترى بإحداهما لا يشتري بالأخرى (`assertUsable`). */
export class GrantService {
  private prisma: PrismaClient
  private earnings: EarningsService
  readonly slug: GrantSlug
  constructor(prisma: PrismaClient, slug: GrantSlug = MEMBER_GRANT_SLUG) {
    this.prisma = prisma
    this.earnings = new EarningsService(prisma)
    this.slug = slug
  }

  /** صفُّ الحملة — يُنشأ أوّلَ مرّةٍ موقوفا بإعداداته الافتراضيّة، فلا يُعطى كودٌ قبل أن تُشغَّل */
  campaign() {
    const { nameAr, defaults } = GRANT_CAMPAIGNS[this.slug]
    return this.prisma.grantCampaign.upsert({
      where: { slug: this.slug },
      create: { slug: this.slug, nameAr, ...defaults, active: false },
      update: {},
    })
  }

  /** الإعداداتُ وما جرى بها: كم أُعطي، وكم استُعمل، وكم ينتظر الدفع */
  async settings(now = new Date()) {
    const c = await this.campaign()
    const ofCampaign = { coupon: { grantCode: { campaignId: c.id } } }
    const [used, pending] = await Promise.all([
      this.prisma.order.count({ where: { ...ofCampaign, status: { in: ['paid', 'partially_refunded'] } } }),
      this.prisma.order.count({ where: { ...ofCampaign, status: 'pending_payment' } }),
    ])
    return {
      id: c.id, nameAr: c.nameAr, percentOff: c.percentOff, maxCodes: c.maxCodes, maxCourses: c.maxCourses, closesAt: c.closesAt,
      active: c.active, open: isOpen(c, now), updatedAt: c.updatedAt,
      issued: c.issuedCount, used, pending,
      left: c.maxCodes === null ? null : Math.max(0, c.maxCodes - c.issuedCount),
    }
  }

  /** يغيّرها صاحبُ المنصّة متى شاء — والنسبةُ الجديدةُ على ما يُعطى بعدها */
  async update(input: GrantSettingsInput, actorId: string, now = new Date()) {
    const c = await this.campaign()
    if (input.percentOff !== undefined && !(Number.isInteger(input.percentOff) && input.percentOff >= 1 && input.percentOff <= 100)) {
      throw new AuthError('bad_percent', 'النسبة عدد صحيح من 1 إلى 100', 400)
    }
    if (input.maxCodes != null && !(Number.isInteger(input.maxCodes) && input.maxCodes >= 1)) {
      throw new AuthError('bad_max', 'عدد المنح عدد صحيح موجب', 400)
    }
    if (input.maxCourses !== undefined && !(Number.isInteger(input.maxCourses) && input.maxCourses >= 1)) {
      throw new AuthError('bad_courses', 'عدد الدورات عدد صحيح موجب', 400)
    }
    if (input.maxCodes != null && input.maxCodes < c.issuedCount) {
      throw new AuthError('below_issued', `أعطي ${c.issuedCount} كودا، فلا يقل العدد عنه`, 409)
    }
    const data: Prisma.GrantCampaignUpdateInput = { updatedBy: actorId }
    if (input.percentOff !== undefined) data.percentOff = input.percentOff
    if (input.maxCodes !== undefined) data.maxCodes = input.maxCodes
    if (input.maxCourses !== undefined) data.maxCourses = input.maxCourses
    if (input.closesAt !== undefined) data.closesAt = input.closesAt
    if (input.active !== undefined) data.active = input.active
    const after = await this.prisma.grantCampaign.update({ where: { id: c.id }, data })
    const pick = (x: typeof c) => ({ percentOff: x.percentOff, maxCodes: x.maxCodes, maxCourses: x.maxCourses, closesAt: x.closesAt, active: x.active })
    await recordAudit(this.prisma, {
      actorId, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: c.id,
      before: pick(c), after: pick(after),
    })
    return this.settings(now)
  }

  /** كودُ من عبّأ النموذج — وكودُه نفسُه إن عبّأه من قبل. ومعه مؤثّرُه وعمولتُه إن جاء بكود مؤثّر */
  async issue(
    input: { leadId?: string | null; influencer?: { id: string; commissionPercent: number } | null } = {},
    now = new Date(),
  ): Promise<{ code: string; percentOff: number; closesAt: Date | null; reused: boolean }> {
    const c = await this.campaign()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (input.leadId) {
        const had = await this.prisma.grantCode.findUnique({
          where: { leadId: input.leadId }, include: { coupon: { select: { code: true, percentOff: true } } },
        })
        if (had) return { code: had.coupon.code, percentOff: had.coupon.percentOff ?? c.percentOff, closesAt: c.closesAt, reused: true }
      }
      try {
        return await this.prisma.$transaction(async (tx) => {
          /* العدُّ بشرط الحدّ والتشغيل في الكتابة نفسِها، والنسبةُ تُقرأ منها — فلا يتجاوز
             متزامنان العدد، ولا يأخذ أحدُهما نسبةً تغيّرت بين قراءةٍ وكتابة */
          const rows = await tx.$queryRaw<{ percentOff: number }[]>`
            UPDATE "GrantCampaign" SET "issuedCount" = "issuedCount" + 1
            WHERE "id" = ${c.id}::uuid AND "active" = true
              AND ("closesAt" IS NULL OR "closesAt" > ${now})
              AND ("maxCodes" IS NULL OR "issuedCount" < "maxCodes")
            RETURNING "percentOff"`
          if (rows.length === 0) {
            throw isOpen(c, now)
              ? new AuthError('grant_sold_out', GRANT_SOLD_OUT_AR, 409)
              : new AuthError('grant_closed', GRANT_CLOSED_AR, 409)
          }
          const percentOff = rows[0].percentOff
          const code = `${GRANT_CODE_PREFIX}${randomUnambiguousCode(8)}`
          /* بلا حدّ استعمال — حدُّه عددُ دوراته (`coursesLeft`) */
          const coupon = await tx.coupon.create({ data: { code, percentOff, maxUses: null, active: true } })
          const row = await tx.grantCode.create({
            data: {
              campaignId: c.id, couponId: coupon.id, leadId: input.leadId ?? null,
              influencerId: input.influencer?.id ?? null, commissionPercent: input.influencer?.commissionPercent ?? null,
            },
          })
          await recordAudit(tx, {
            actorId: null, action: 'coupon.grant_issue', entityType: 'grant_campaign', entityId: c.id,
            meta: { grantCodeId: row.id, code, percentOff, leadId: input.leadId ?? null, influencerId: input.influencer?.id ?? null },
          })
          return { code, percentOff, closesAt: c.closesAt, reused: false }
        })
      } catch (e) {
        /* رمزٌ اصطدم، أو صاحبُ النموذج نفسُه في نقرتين — تُعاد المعاملةُ كلُّها بعدِّها، فيأخذ الثاني كودَ الأوّل */
        if (attempt === 2 || !isUniqueViolation(e)) throw e
      }
    }
    throw new AuthError('code_conflict', 'تعذر إعطاء كود، أعد المحاولة', 409)
  }

  /** أيُستعمل هذا الكودُ لهذا المتعلّم الآن؟ — يُسأل عند التسعير قبل فحص الكوبون العامّ، فيُقال السببُ بلغة المنحة */
  async assertUsable(coupon: GrantCoupon, userId: string, now = new Date()): Promise<void> {
    const campaign = coupon.grantCode?.campaign
    if (!campaign) return
    if (!isOpen(campaign, now)) throw new AuthError('grant_closed', GRANT_CLOSED_AR, 409)
    if ((await this.coursesLeft(coupon)) <= 0) throw new AuthError('grant_used', grantUsedUpAr(campaign.maxCourses), 409)
    /* على الحملتين معا — من اشترى بمنحةٍ لا يأخذ فوقها كودَ منحةٍ آخر، وكودُه نفسُه يعود إليه حتى حدّه */
    const once = await this.prisma.order.findFirst({
      where: { userId, status: { in: GRANT_HOLDS }, couponId: { not: coupon.id }, coupon: { grantCode: { isNot: null } } },
      select: { id: true },
    })
    if (once) throw new AuthError('grant_once', GRANT_ONCE_AR, 409)
  }

  /** كم دورةً بقيت على هذا الكود — حدُّ حملته ناقصا دوراتِ طلباته المحجوزة والمدفوعة بثمن. والمعلَّقُ يُعدّ حتى
      يُدفع أو يُلغى (من لوح الشراء نفسِه) — فلا يُشترى بالكود فوق حدّه بطلبين */
  async coursesLeft(coupon: GrantCoupon): Promise<number> {
    const max = coupon.grantCode?.campaign.maxCourses ?? 0
    const used = await this.prisma.orderItem.count({
      where: {
        unitPrice: { gt: 0 },
        order: { couponId: coupon.id, status: { in: GRANT_HOLDS } },
      },
    })
    return max - used
  }

  /** فحصُ الهامش: كلُّ شعبةٍ تُشترى بسعرها بعد المنحة، وأجرُ مقعدها للمدرّب، والفرقُ بينهما.
      وبنسبةٍ تُمرَّر لتُجرَّب قبل أن تُحفظ — وبلا قيمةٍ نسبةُ الحملة. وفي منحة المؤثّرين تُطرح عمولتُه أيضا:
      نسبتُها من سعر القائمة، فما يبقى للأكاديميّة سعرُها بعد المنحة ناقصا أجرَ المقعد وعمولتَه. */
  async margins(percentOff?: number, commissionPercent = 0) {
    const c = await this.campaign()
    const pct = percentOff ?? c.percentOff
    const cohorts = await this.prisma.cohort.findMany({
      where: { status: { in: MARGIN_STATUSES }, price: { gt: 0 } },
      select: {
        id: true, title: true, courseId: true, status: true, price: true, currency: true, capacity: true, startsAt: true,
        course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
      },
      orderBy: [{ startsAt: 'asc' }, { title: 'asc' }],
    })
    const costs = await this.seatCosts(cohorts)
    const rows = cohorts.map((x) => {
      const listPrice = Number(x.price)
      const price = grantPrice(listPrice, pct)
      const { ruleType, ruleRate, seatCost } = costs.get(x.id)!
      const commission = influencerCommission(listPrice, commissionPercent)
      return {
        cohortId: x.id,
        titleAr: `${x.course.versions[0]?.titleAr ?? x.courseId} — ${x.title}`,
        status: x.status, startsAt: x.startsAt, currency: x.currency, capacity: x.capacity,
        listPrice, price, ruleType, ruleRate, seatCost, commission,
        margin: seatCost === null ? null : Math.round((price - seatCost - commission) * 100) / 100,
      }
    })
    return { percentOff: pct, commissionPercent, rows }
  }

  /** أجرُ مقعدٍ واحدٍ لكلّ شعبة: بالمقعد كما هو، وبنسبة الإيراد على سعر القائمة — هكذا يُحسب الكشف
      (`computeCohort`). والثابتُ للشعبة لا يُقسم على مقاعدَ لم تُبَع: يُقال مبلغُه وحدَه، وأجرُ مقعده فارغ. */
  async seatCosts(cohorts: readonly { id: string; courseId: string; price: unknown }[]) {
    const leads = await cohortLeadTrainers(this.prisma, cohorts.map((x) => x.id))
    const out = new Map<string, { ruleType: string | null; ruleRate: number | null; seatCost: number | null }>()
    await Promise.all(cohorts.map(async (x) => {
      const profileId = leads.get(x.id) ?? null
      const rule = profileId ? await this.earnings.activeRule(profileId, { cohortId: x.id, courseId: x.courseId }) : null
      const seatCost = rule?.type === 'per_seat'
        ? Number(rule.rate)
        : rule?.type === 'revenue_share' ? Math.round(Number(x.price) * Number(rule.rate)) / 100 : null
      out.set(x.id, { ruleType: rule?.type ?? null, ruleRate: rule ? Number(rule.rate) : null, seatCost })
    }))
    return out
  }
}

/* ═══ كودُ منحته في حسابه — يُعرض في لوحته ويُطبَّق وحدَه عند أيّ شراء (٣١ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «امنحه فرصةَ استعمال الكود، أوضحه في المنصّة له، وفعّله تلقائيّا عند أيّ شراءٍ له لأربع دوراتٍ
   بالحدّ الأعلى — لأنّه الآن إذا أكمل الدفعَ من المنصّة ونقر على "اشترِ الدورة" من الأسفل… فالنظامُ يأخذ السعرَ الجديد».
   فكان كودُه لا يُعرف إلّا في صفحة المنحة، ومن اشترى من صفحة دورةٍ دفع سعرَها كاملا.

   وكودُه أحدُ اثنين بالترتيب: كودُ منحةٍ اشترى به قبلُ (منحةٌ واحدةٌ لكلّ متعلّم — فهو كودُه وحدَه)، أو كودُ نموذجٍ
   في إحدى الحملتين ببريد حسابه (كـ`myCode`، ويُكتب أثرُ أخذه مرّةً واحدة). ولا كودَ إن أُغلقت حملتُه أو بلغ حدَّ دوراته. */
export interface LearnerGrant {
  code: string | null
  percentOff?: number | null
  nameAr?: string
  left?: number
  max?: number
}

const LEARNER_COUPON = {
  id: true, code: true, percentOff: true, usedCount: true, maxUses: true,
  grantCode: { select: { campaign: { select: { id: true, active: true, closesAt: true, maxCourses: true, nameAr: true } } } },
} as const

export async function learnerGrant(prisma: PrismaClient, userId: string, now = new Date()): Promise<LearnerGrant> {
  const used = await prisma.order.findFirst({
    where: { userId, status: { in: GRANT_HOLDS }, coupon: { grantCode: { isNot: null } } },
    orderBy: { createdAt: 'desc' },
    select: { coupon: { select: LEARNER_COUPON } },
  })
  let coupon = used?.coupon ?? null
  if (!coupon) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    const lead = user?.email
      ? await prisma.lead.findFirst({
        where: { erasedAt: null, email: user.email.toLowerCase(), grantCode: { isNot: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, grantCode: { select: { coupon: { select: LEARNER_COUPON } } } },
      })
      : null
    coupon = lead?.grantCode?.coupon ?? null
    if (lead && coupon) {
      const claimed = await prisma.auditEvent.count({ where: { action: 'coupon.grant_claim', entityId: lead.id, actorId: userId } })
      if (claimed === 0) {
        await recordAudit(prisma, { action: 'coupon.grant_claim', entityType: 'lead', entityId: lead.id, actorId: userId, meta: { via: 'account' } })
      }
    }
  }
  const campaign = coupon?.grantCode?.campaign
  if (!coupon || !campaign || !isOpen(campaign, now)) return { code: null }
  const left = await new GrantService(prisma).coursesLeft(coupon)
  if (left <= 0) return { code: null }
  return { code: coupon.code, percentOff: coupon.percentOff, nameAr: campaign.nameAr, left, max: campaign.maxCourses }
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
}
