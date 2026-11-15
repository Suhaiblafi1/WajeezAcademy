/* دوراتُ كلّ منحةٍ على الخادم — قراءتُها وتثبيتُها واختيارُ المدير لها (١٥ نوفمبر ٢٠٢٦).

   القاعدةُ نفسُها في `src/application/commerce/grant-scope.ts` بقراراتها، وهنا تحميلُ الصفوف لها، فلا يكتبها موضعٌ
   ثانٍ: صفحةُ كلّ حملة (`grant-landing.service.ts#view`)، وصفحةُ المؤثّر ومادّةُ تصاميمه، والدفعُ (`cart.service.ts#priceFor`)،
   وتذكيرُ البريد، كلُّها تنادي ما هنا.

   ═══ وما يقع هنا ═══

   ١) **النطاقُ الحيّ**: حملةٌ بقائمتها، ومؤثّرٌ بقائمته داخلَ قائمة حملته (`influencerScope`).
   ٢) **ونطاقُ الكود** (`couponGrantScope`): الثابتُ إن دُفع به، وإلّا الحيُّ لحملته ومؤثّره.
   ٣) **والتثبيتُ مع أوّل دفع** (`freezeGrantScopeOnPaid`): في معاملة صيرورة الطلب مدفوعا نفسِها، ومرّةً واحدة — الكتابةُ
      بشرط أن لم يثبت، فدفعتان متزامنتان لا تكتبان مرّتين.
   ٤) **واختيارُ المدير** (`GrantCourseChoiceService`): لكلّ حملةٍ من دوراتها المنشورة، ولكلّ مؤثّرٍ من قائمة حملته وحدَها.
      وكلُّ تغييرٍ يُكتب أثرُه بمن غيّره وما كان وما صار — كإعدادات المنحة (`coupon.grant_settings`). */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { GrantCoursesService } from './grant-courses.service'
import { GRANT_CAMPAIGNS, INFLUENCER_GRANT_SLUG, type GrantSlug } from '../../src/application/commerce/grant'
import {
  frozenScopeData, grantCodeScope, inScope, liveGrantScope, scopeOfIds, type CourseScope,
} from '../../src/application/commerce/grant-scope'

type Db = PrismaClient | Prisma.TransactionClient

/** ما يُقرأ من الكود لمعرفة دوراته — مع حملته ومؤثّره */
export const GRANT_SCOPE_SELECT = {
  firstPaidAt: true, allCoursesAtFirstPaid: true, courseIdsAtFirstPaid: true,
  campaign: { select: { courseIds: true } },
  influencer: { select: { courseIds: true } },
} as const

/** دوراتُ كودٍ من صفّه المحمَّل بـ`GRANT_SCOPE_SELECT` */
export function scopeOfGrantRow(row: {
  firstPaidAt: Date | null; allCoursesAtFirstPaid: boolean; courseIdsAtFirstPaid: string[]
  campaign: { courseIds: string[] }; influencer: { courseIds: string[] } | null
}): CourseScope {
  return grantCodeScope({
    campaignCourseIds: row.campaign.courseIds, influencerCourseIds: row.influencer?.courseIds ?? null,
    firstPaidAt: row.firstPaidAt, allCoursesAtFirstPaid: row.allCoursesAtFirstPaid, courseIdsAtFirstPaid: row.courseIdsAtFirstPaid,
  })
}

/** قائمةُ الحملة كما حُفظت — وبلا صفٍّ بعدُ تلقائيّة */
async function campaignIds(db: Db, slug: GrantSlug): Promise<string[]> {
  return (await db.grantCampaign.findUnique({ where: { slug }, select: { courseIds: true } }))?.courseIds ?? []
}

/** دوراتُ الحملة اليوم */
export async function campaignScope(db: Db, slug: GrantSlug): Promise<CourseScope> {
  return scopeOfIds(await campaignIds(db, slug))
}

/** دوراتُ مؤثّرٍ اليوم — قائمتُه داخلَ قائمة «منحة مؤثرين وجيز». وبلا مؤثّرٍ قائمةُ الحملة */
export async function influencerScope(db: Db, influencerId: string | null | undefined): Promise<CourseScope> {
  const [camp, inf] = await Promise.all([
    campaignIds(db, INFLUENCER_GRANT_SLUG),
    influencerId ? db.influencer.findUnique({ where: { id: influencerId }, select: { courseIds: true } }) : null,
  ])
  return liveGrantScope(camp, inf?.courseIds ?? null)
}

/** دوراتُ صفحة حملةٍ — ومنحةُ المؤثّرين بمؤثّرها */
export function pageScope(db: Db, slug: GrantSlug, influencerId: string | null | undefined): Promise<CourseScope> {
  return slug === INFLUENCER_GRANT_SLUG ? influencerScope(db, influencerId) : campaignScope(db, slug)
}

/** دوراتُ كود منحةٍ بكوبونه — و`undefined` إن لم يكن الكوبونُ كودَ منحة */
export async function couponGrantScope(db: Db, couponId: string): Promise<CourseScope | undefined> {
  const row = await db.grantCode.findUnique({ where: { couponId }, select: GRANT_SCOPE_SELECT })
  return row ? scopeOfGrantRow(row) : undefined
}

/** يثبت دوراتِ كود الطلب مع أوّل شراءٍ مدفوعٍ به — يُنادى في معاملة صيرورة الطلب مدفوعا (`settleOrder`) */
export async function freezeGrantScopeOnPaid(tx: Prisma.TransactionClient, orderId: string, now = new Date()): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true } })
  if (!order?.couponId) return
  const row = await tx.grantCode.findUnique({ where: { couponId: order.couponId }, select: { id: true, ...GRANT_SCOPE_SELECT } })
  if (!row || row.firstPaidAt) return
  const live = liveGrantScope(row.campaign.courseIds, row.influencer?.courseIds ?? null)
  await tx.grantCode.updateMany({ where: { id: row.id, firstPaidAt: null }, data: { firstPaidAt: now, ...frozenScopeData(live) } })
}

/* ═══ اختيارُ المدير ═══ */

/** دورةٌ في قائمة الاختيار — و`shown`: تظهر في الصفحة الآن (لها شعبةٌ تُشترى بالشروط) */
export interface ChoiceCourse { courseId: string; titleAr: string; shown: boolean }
export interface CourseChoice {
  /** تلقائيّة: بلا اختيار */
  auto: boolean
  /** ما اختاره — ومنه ما خرج من قائمة الحملة بعدُ (للمؤثّر) لا يُعدّ */
  courseIds: string[]
  /** ما يختار منه */
  courses: ChoiceCourse[]
}

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

export class GrantCourseChoiceService {
  private prisma: PrismaClient
  private pool: GrantCoursesService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.pool = new GrantCoursesService(prisma)
  }

  /** عناوينُ الدورات بآخر نسخة — مرتّبةً بأسمائها */
  private async titles(where: Prisma.CourseWhereInput): Promise<{ courseId: string; titleAr: string }[]> {
    const rows = await this.prisma.course.findMany({
      where, select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
    })
    return rows.map((r) => ({ courseId: r.id, titleAr: r.versions[0]?.titleAr ?? r.id }))
      .sort((a, b) => a.titleAr.localeCompare(b.titleAr, 'ar'))
  }

  /** ما يظهر الآن في صفحةٍ بنطاقها */
  private async shownIds(scope: CourseScope, now: Date): Promise<Set<string>> {
    return new Set((await this.pool.openCourses(now, scope)).courses.map((c) => c.courseId))
  }

  /** صفُّ الحملة — يُنشأ موقوفا بإعداداته الافتراضيّة كما في `GrantService.campaign` */
  private campaign(slug: GrantSlug) {
    const { nameAr, defaults } = GRANT_CAMPAIGNS[slug]
    return this.prisma.grantCampaign.upsert({ where: { slug }, create: { slug, nameAr, ...defaults, active: false }, update: {} })
  }

  /** دوراتُ حملة: ما اختاره منها، ويختار من كلّ دورةٍ منشورة (ومعها ما اختاره ولم يعد منشورا، ليُرفع) */
  async campaignChoice(slug: GrantSlug, now = new Date()): Promise<CourseChoice> {
    const c = await this.campaign(slug)
    const [courses, shown] = await Promise.all([
      this.titles({ OR: [{ status: 'published' }, { id: { in: c.courseIds } }] }),
      this.shownIds(scopeOfIds(c.courseIds), now),
    ])
    return { auto: c.courseIds.length === 0, courseIds: c.courseIds, courses: courses.map((x) => ({ ...x, shown: shown.has(x.courseId) })) }
  }

  /** يحفظ دوراتِ حملة — والفارغةُ تعيدها تلقائيّة */
  async setCampaignCourses(slug: GrantSlug, ids: readonly string[], actorId: string, now = new Date()): Promise<CourseChoice> {
    const c = await this.campaign(slug)
    const want = [...new Set(ids)]
    if (want.length > 0) {
      const ok = new Set((await this.prisma.course.findMany({
        where: { id: { in: want }, OR: [{ status: 'published' }, { id: { in: c.courseIds } }] }, select: { id: true },
      })).map((x) => x.id))
      if (want.some((id) => !ok.has(id))) throw new AuthError('bad_course', 'اختر من الدورات المنشورة', 400)
    }
    if (!sameIds(want, c.courseIds)) {
      await this.prisma.grantCampaign.update({ where: { id: c.id }, data: { courseIds: want, updatedBy: actorId } })
      await recordAudit(this.prisma, {
        actorId, action: 'coupon.grant_courses', entityType: 'grant_campaign', entityId: c.id,
        before: { courseIds: c.courseIds }, after: { courseIds: want }, meta: { campaign: slug },
      })
    }
    return this.campaignChoice(slug, now)
  }

  /** ما يختار منه المؤثّر: قائمةُ «منحة مؤثرين وجيز» — المختارةُ إن اختيرت، وإلّا ما يظهر فيها الآن */
  private async influencerCandidates(now: Date): Promise<{ courseId: string; titleAr: string }[]> {
    const camp = await this.campaign(INFLUENCER_GRANT_SLUG)
    if (camp.courseIds.length > 0) return this.titles({ id: { in: camp.courseIds } })
    return (await this.pool.openCourses(now, null)).courses.map((x) => ({ courseId: x.courseId, titleAr: x.courseTitleAr }))
  }

  async influencerChoice(id: string, now = new Date()): Promise<CourseChoice> {
    const inf = await this.prisma.influencer.findUnique({ where: { id }, select: { courseIds: true } })
    if (!inf) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const [candidates, scope] = await Promise.all([this.influencerCandidates(now), influencerScope(this.prisma, id)])
    const shown = await this.shownIds(scope, now)
    const offered = new Set(candidates.map((x) => x.courseId))
    return {
      auto: inf.courseIds.length === 0,
      courseIds: inf.courseIds.filter((x) => offered.has(x) && inScope(scope, x)),
      courses: candidates.map((x) => ({ ...x, shown: shown.has(x.courseId) })),
    }
  }

  /** يحفظ دوراتِ مؤثّر — من قائمة حملته وحدَها، والفارغةُ تعيده إلى قائمتها كلِّها */
  async setInfluencerCourses(id: string, ids: readonly string[], actorId: string, now = new Date()): Promise<CourseChoice> {
    const inf = await this.prisma.influencer.findUnique({ where: { id }, select: { courseIds: true } })
    if (!inf) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const want = [...new Set(ids)]
    const offered = new Set((await this.influencerCandidates(now)).map((x) => x.courseId))
    if (want.some((x) => !offered.has(x))) throw new AuthError('bad_course', 'اختر من دورات منحة المؤثرين', 400)
    if (!sameIds(want, inf.courseIds)) {
      await this.prisma.influencer.update({ where: { id }, data: { courseIds: want } })
      await recordAudit(this.prisma, {
        actorId, action: 'influencer.courses', entityType: 'influencer', entityId: id,
        before: { courseIds: inf.courseIds }, after: { courseIds: want },
      })
    }
    return this.influencerChoice(id, now)
  }
}
