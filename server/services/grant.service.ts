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
   ٣) **ويُستعمل مرّةً واحدة ولا يُربط بحساب** — كوبونٌ بحدّ استعمالٍ واحد، فمن أعطاه غيرَه استعمله
      ذاك. والاستعمالُ يُحجز مع الطلب ويُفرَج عنه إن هُجر (`coupon-ledger.ts`).
   ٤) **ومنحةٌ واحدةٌ لكلّ متعلّم** — من جمع أكوادَ غيره لا يشتري بها مرّتين؛ وإلّا صار «محدودُ العدد»
      بابا لمن جمع أكثر.
   ٥) **والحملةُ تُقرأ عند الاستعمال** — إيقافُها يوقف كلَّ كود، وتمديدُ نهايتها يمدّه.
   ٥ب) **وعلى أربع دوراتٍ بحدٍّ أقصى في الشراء** — «يحقّ لك فقط ٤ دورات». والحدُّ بيد صاحب المنصّة
      كالنسبة، ومنحةٌ واحدةٌ لكلّ متعلّم تجعله حدَّه في كلّ مشترياته.
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
  GRANT_CAMPAIGNS, GRANT_CLOSED_AR, GRANT_CODE_PREFIX, GRANT_ONCE_AR, GRANT_PENDING_AR, GRANT_SOLD_OUT_AR,
  GRANT_USED_AR, MEMBER_GRANT_SLUG, grantPrice, type GrantSlug,
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
          const coupon = await tx.coupon.create({ data: { code, percentOff, maxUses: 1, active: true } })
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
    const mine = await this.prisma.order.findFirst({
      where: { userId, couponId: coupon.id, status: 'pending_payment' }, select: { id: true },
    })
    if (mine) throw new AuthError('grant_pending', GRANT_PENDING_AR, 409)
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) throw new AuthError('grant_used', GRANT_USED_AR, 409)
    /* على الحملتين معا — من اشترى بمنحة وجيز لا يأخذ فوقها منحةَ المؤثّرين، ولا العكس */
    const once = await this.prisma.order.findFirst({
      where: { userId, status: { in: GRANT_HOLDS }, coupon: { grantCode: { isNot: null } } },
      select: { id: true },
    })
    if (once) throw new AuthError('grant_once', GRANT_ONCE_AR, 409)
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

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
}
