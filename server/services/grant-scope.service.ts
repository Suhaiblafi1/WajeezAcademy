/* دوراتُ صفحة كلّ منحةٍ على الخادم — قراءتُها واختيارُ المدير لها (١٥ نوفمبر ٢٠٢٦).

   القاعدةُ نفسُها في `src/application/commerce/grant-scope.ts` بقراراتها، وهنا تحميلُ الصفوف لها، فلا يكتبها موضعٌ
   ثانٍ: صفحةُ كلّ حملة (`grant-landing.service.ts#view`)، وصفحةُ المؤثّر ومادّةُ تصاميمه، وتذكيرُ البريد — كلُّها تنادي
   `pageCourses`. ولا شيءَ هنا يمسّ الدفع: الكودُ يخصم على أيّ دورةٍ حتى حدّه («Discount all courses»).

   ═══ وما يقع هنا ═══

   ١) **دوراتُ الصفحة** (`pageCourses`): حملةٌ بقائمتها، ومؤثّرٌ بقائمته داخلَ قائمة حملته. وإن لم يبقَ له ما يُعرض
      بقائمته فقائمةُ الحملة كلُّها — «Full grant list»: ولو كانت الحملةُ تلقائيّةً وما اختير له لا شعبةَ له تُشترى.
   ٢) **واختيارُ المدير** (`GrantCourseChoiceService`): لكلّ حملةٍ من دوراتها المنشورة، ولكلّ مؤثّرٍ من قائمة حملته وحدَها.
      وكلُّ تغييرٍ يُكتب أثرُه بمن غيّره وما كان وما صار — كإعدادات المنحة (`coupon.grant_settings`).
   ٣) **و«بلاك فرايدي وجيز» حملةُ مؤثّرين كالثانية** (١٥ نوفمبر ٢٠٢٦، `isInfluencerGrant`): دوراتُها قائمتُها هي، ودوراتُ
      المؤثّر فيها قائمتُه نفسُها داخلَ قائمتها — وإن لم يقع منها فيها شيءٌ فقائمتُها كلُّها، كمنحة المؤثّرين. وقائمتُه
      تُختار من دورات منحة المؤثّرين كما كانت: هي قائمتُه الواحدة في الحملتين. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { GrantCoursesService, type BuyableCohort } from './grant-courses.service'
import { GRANT_CAMPAIGNS, INFLUENCER_GRANT_SLUG, isInfluencerGrant, type CampaignSlug, type GrantSlug } from '../../src/application/commerce/grant'
import { isPartnerCampaign, PARTNER_NOT_FOUND_AR } from '../../src/application/commerce/partner-grant'
import { liveGrantScope, scopeOfIds, type CourseScope } from '../../src/application/commerce/grant-scope'

type Db = PrismaClient | Prisma.TransactionClient

/** قائمةُ الحملة كما حُفظت — وبلا صفٍّ بعدُ تلقائيّة */
async function campaignIds(db: Db, slug: CampaignSlug): Promise<string[]> {
  return (await db.grantCampaign.findUnique({ where: { slug }, select: { courseIds: true } }))?.courseIds ?? []
}

/** دوراتُ الحملة اليوم */
export async function campaignScope(db: Db, slug: CampaignSlug): Promise<CourseScope> {
  return scopeOfIds(await campaignIds(db, slug))
}

/** دوراتُ مؤثّرٍ اليوم — قائمتُه داخلَ قائمة حملته («منحة مؤثرين وجيز» ما لم تُسمَّ). وبلا مؤثّرٍ قائمةُ الحملة */
export async function influencerScope(
  db: Db, influencerId: string | null | undefined, slug: GrantSlug = INFLUENCER_GRANT_SLUG,
): Promise<CourseScope> {
  const [camp, inf] = await Promise.all([
    campaignIds(db, slug),
    influencerId ? db.influencer.findUnique({ where: { id: influencerId }, select: { courseIds: true } }) : null,
  ])
  return liveGrantScope(camp, inf?.courseIds ?? null)
}

/** ما تعرضه صفحةُ حملةٍ اليوم — ومنحةُ المؤثّرين بمؤثّرها، وإن لم يبقَ له ما يُعرض فقائمةُ الحملة كلُّها */
export async function pageCourses(
  prisma: PrismaClient, slug: CampaignSlug, influencerId: string | null | undefined, now = new Date(),
): Promise<{ termAr: string | null; courses: BuyableCohort[] }> {
  const pool = new GrantCoursesService(prisma)
  /* ═══ وصفحةُ الشريك بقائمته — وإن لم يبقَ منها ما يُشترى فكلُّ ما يُشترى (١٥ نوفمبر ٢٠٢٦) ═══
     طلبُ صاحب المنصّة ألّا تكون صفحةُ الشريك فارغة. فإن أُغلقت شعبُ ما اختاره كلُّها عُرض ما يُشترى اليوم — كـ«Full grant
     list» في صفحة المؤثّر — والكودُ يخصم على أيّ دورةٍ حتى حدّه في الحالين */
  if (isPartnerCampaign(slug)) {
    const scope = await campaignScope(prisma, slug)
    const mine = await pool.openCourses(now, scope)
    return mine.courses.length > 0 || scope === null ? mine : pool.openCourses(now, null)
  }
  if (!isInfluencerGrant(slug)) return pool.openCourses(now, await campaignScope(prisma, slug))
  const [own, campaign] = await Promise.all([influencerScope(prisma, influencerId, slug), campaignScope(prisma, slug)])
  const mine = await pool.openCourses(now, own)
  if (mine.courses.length > 0 || own === campaign) return mine
  return pool.openCourses(now, campaign)
}

/* ═══ اختيارُ المدير ═══ */

/** دورةٌ في قائمة الاختيار — و`shown`: تظهر في الصفحة الآن بالاختيار القائم.

    ═══ وما لا شعبةَ له لا يُعرض (١٥ نوفمبر ٢٠٢٦) ═══

    قرارُ صاحب المنصّة: «اجعلني أرى الدورات التي لها شعب فقط، واجعلني أرى اسم المدرب ومتى تبدأ أول شعبة». فالقائمةُ
    ما له شعبةٌ تُشترى الآن بشروط لوح الدفع (`GrantCoursesService.pool` بلا نطاق) — ومع كلٍّ مدرّبُ تلك الشعبة الأصيلُ
    المنشورُ ويومُ بدئها. وما اختير قبلُ ولا شعبةَ له الآن يبقى في الاختيار (`courseIds`) ولا يُعرض؛ يعود حين تُفتح شعبتُه. */
export interface ChoiceCourse {
  courseId: string
  titleAr: string
  shown: boolean
  /** مدرّبُ أقرب شعبةٍ تُشترى — الأصيلُ المنشور، وإلّا `null` */
  trainerName: string | null
  /** يومُ بدء أقرب شعبةٍ تُشترى */
  startsAt: Date | null
}
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

  /** كلُّ دورةٍ لها شعبةٌ تُشترى الآن — بمدرّب أقرب شعبةٍ ويوم بدئها، مرتّبةً بأسمائها */
  private async buyable(now: Date): Promise<Omit<ChoiceCourse, 'shown'>[]> {
    return (await this.pool.openCourses(now, null)).courses.map((c) => ({
      courseId: c.courseId, titleAr: c.courseTitleAr, trainerName: c.trainer?.name ?? null, startsAt: c.startsAt,
    }))
  }

  /** ما يظهر الآن في صفحةٍ بنطاقها */
  private async shownIds(scope: CourseScope, now: Date): Promise<Set<string>> {
    return new Set((await this.pool.openCourses(now, scope)).courses.map((c) => c.courseId))
  }

  /** ما يظهر الآن في صفحة مؤثّر — بالرجوع إلى قائمة الحملة كما تعرضها صفحتُه (`pageCourses`) */
  private async shownForInfluencer(id: string, now: Date): Promise<Set<string>> {
    return new Set((await pageCourses(this.prisma, INFLUENCER_GRANT_SLUG, id, now)).courses.map((c) => c.courseId))
  }

  /** صفُّ الحملة — يُنشأ موقوفا بإعداداته الافتراضيّة كما في `GrantService.campaign`. والشريكُ لا يُنشأ هنا */
  private async campaign(slug: CampaignSlug) {
    if (isPartnerCampaign(slug)) {
      const row = await this.prisma.grantCampaign.findUnique({ where: { slug } })
      if (!row) throw new AuthError('not_found', PARTNER_NOT_FOUND_AR, 404)
      return row
    }
    const { nameAr, defaults } = GRANT_CAMPAIGNS[slug]
    return this.prisma.grantCampaign.upsert({ where: { slug }, create: { slug, nameAr, ...defaults, active: false }, update: {} })
  }

  /** دوراتُ حملة: ما اختاره منها، ويختار من كلّ دورةٍ منشورة (ومعها ما اختاره ولم يعد منشورا، ليُرفع) */
  async campaignChoice(slug: CampaignSlug, now = new Date()): Promise<CourseChoice> {
    const c = await this.campaign(slug)
    const [courses, shown] = await Promise.all([this.buyable(now), this.shownIds(scopeOfIds(c.courseIds), now)])
    return { auto: c.courseIds.length === 0, courseIds: c.courseIds, courses: courses.map((x) => ({ ...x, shown: shown.has(x.courseId) })) }
  }

  /** يحفظ دوراتِ حملة — والفارغةُ تعيدها تلقائيّة */
  async setCampaignCourses(slug: CampaignSlug, ids: readonly string[], actorId: string, now = new Date()): Promise<CourseChoice> {
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
    const [candidates, open, shown] = await Promise.all([this.influencerCandidates(now), this.buyable(now), this.shownForInfluencer(id, now)])
    const offered = new Set(candidates.map((x) => x.courseId))
    /* وما خرج من قائمة الحملة لا يُعدّ — وإن لم يبقَ له شيءٌ فهو على قائمتها كلِّها، كما تعرضها صفحتُه */
    const kept = inf.courseIds.filter((x) => offered.has(x))
    return {
      auto: kept.length === 0,
      courseIds: kept,
      /* ويُعرض منها ما له شعبةٌ تُشترى الآن وحدَه */
      courses: open.filter((x) => offered.has(x.courseId)).map((x) => ({ ...x, shown: shown.has(x.courseId) })),
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
