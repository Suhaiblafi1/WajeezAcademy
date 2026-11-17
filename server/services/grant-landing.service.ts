/* صفحةُ «منحة أعضاء وجيز» — من النموذج إلى الكود والدورات (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرارات ═══

   · «A»: **من يعبّئ النموذج يأخذ الكودَ فورا ويختار دوراتِه ويدفع بنفسه**، والمستشارُ لمن يطلبه —
     «فبهذه الحركة قد نكون قد أتممنا عمليّة الشراء قبل أن نذهب ونعود بإرسال رسالةٍ له ثانية».
   · **مفتوحةٌ لكلّ من يعبّئه** حتّى تنتهي المنح.
   · **والحسابُ يُنشأ حين يدفع** — النموذجُ أربعُ خاناتٍ لازمة، وسؤالان اختياريّان (مستواه، وما
     يريد تطويرَه) أُضيفا بقراره (٢٠ أكتوبر ٢٠٢٦) — «الجديدُ منها اختياريّ»: لا يُسقط نموذجا تُرك فيه.

   ═══ ما يقع ═══

   ١) **عميلٌ محتملٌ واحدٌ لكلّ هاتفٍ أو بريد** في الحملة — ولا يُجمع بالنموذج كودان بالهاتف نفسِه.
   ٢) **وكودُه في الصفحة وفي بريده.** ومن عبّأه ثانيةً لا يُعرض له الكودُ في الصفحة: يُرسَل ثانيةً إلى
      **البريد المحفوظ** ويُقال له أين — وإلّا كفى أن يكتب أحدٌ رقمَ غيره ليأخذ منحتَه.
   ٣) **والمنحةُ المغلقةُ أو المنتهيةُ لا تُسقط العميل** — يُحفظ ويُقال له السببُ، وزرُّ المستشار قائم.
   ٤) **والدوراتُ للزائر بلا أجور المدرّبين** — ما يُشترى في الفصل القادم القريب (`grant-courses.service.ts`).
   ٥) **و«تواصل مع مستشار» حالةٌ واحدة** تُسند تلقائيّا — بمرجعه الذي أخذه من النموذج لا بهاتفٍ يكتبه
      أيُّ أحد.

   ═══ وصفحةُ «منحة مؤثرين وجيز» بالخدمة نفسِها (٢٦ أكتوبر ٢٠٢٦) ═══

   النموذجُ واحدٌ وفرقُه خانةٌ: **كودُ المؤثّر**، لازمٌ فيها — يكتبه المتابعُ أو يأتي مكتوبا في رابط المؤثّر. وكودٌ لا
   يطابق مؤثّرا نشطا يُردّ بسببه ولا يُحفظ صاحبُه: منحتُها لمن جاء بكود. والعميلُ يحمل مؤثّرَه، وكودُ منحته يحمل مؤثّرَه
   وعمولتَه يومَ أُعطي (`grant.service.ts#issue`). **والأوّلُ يبقى**: من عبّأها بكود مؤثّرٍ ثمّ بكود غيره يُحسب للأوّل —
   كما يأخذ كودَه الأوّل نفسَه. والقناةُ كودُ المؤثّر بحروفٍ صغيرة، فتُقرأ نتائجُها بالقناة كما تُقرأ نتائجُ الأولى.

   ═══ و«بلاك فرايدي وجيز» حملةُ مؤثّرين ثانية (١٥ نوفمبر ٢٠٢٦) ═══

   بالقاعدة نفسِها (`isInfluencerGrant`): كودُ المؤثّر لازم، وصفحتُها برابطه `/grant/bf/<كوده>`. وكودُ المؤثّر يُقرأ بما كان له
   أيضا (`influencerCodeWhere`)، فرابطُه القديمُ يعمل بعد أن يتغيّر. ونسبةُ الصفحة ما يأخذه متابعُه هو: خصمُ مؤثّره إن كُتب له.

   والحارس: `server/tests/commerce/grant-landing.test.ts` و`influencer-grant.test.ts` و`black-friday-grant.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'
import { GRANT_HOLDS, GrantService } from './grant.service'
import { pageCourses } from './grant-scope.service'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { mintShortLink } from './short-link.service'
import { publicSiteUrl } from './site-url'
import { PUBLIC_SESSIONS_CAP, PUBLIC_SESSION_WHERE } from './public-catalog.service'
import { GRANT_PHONE_REQUIRED_AR, normalizeIntlPhone } from '../../src/application/advisor/guest-contact'
import { cleanTouch } from '../../src/application/marketing/signup-source'
import { linkGrantVisit } from './grant-visit.service'
import {
  type GrantCourseOutcome, grantProjectLineAr,
  CAREER_LEVELS, GRANT_CODE_RE, GRANT_CONSENT_AR, GRANT_INTEREST_DOMAINS, GRANT_MAX_INTERESTS, GRANT_SHARE_PATH, GRANT_SUMMARY_GOALS, OPEN_GRANT_SHARE_PATH, WORK_FIELDS, campaignTag, grantCodeLink, grantCourseSummary, leadProfileAr,
  type GrantCourseSummary,
} from '../../src/application/commerce/grant-landing'
import { courseDomain } from '../../src/application/catalog/course-domain'
import { resolveCompletionRules } from '../../src/application/learning/completion-rules'
import { BLACK_FRIDAY_GRANT_SLUG, GRANT_CAMPAIGNS, GRANT_ONCE_AR, GRANT_SLUGS, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, grantPagePath, isInfluencerGrant, type CampaignSlug, type GrantSlug } from '../../src/application/commerce/grant'
import { PARTNER_SLUG_PREFIX } from '../../src/application/commerce/partner-grant'
import { INFLUENCER_CODE_BAD_AR, blackFridayCommission, influencerBrand, influencerClosesAt, influencerGrantPath, influencerLink, influencerPercentOff, influencerWhatsAppTextAr, normalizeInfluencerCode } from '../../src/application/commerce/influencer'
import { influencerCodeWhere } from './influencer.service'
import { shortLinkPath } from '../../src/application/links/short-link'
import { fmtDate } from '../../src/application/text/format-ar'

export interface GrantApplyInput {
  fullName: string
  phone: string
  email: string
  workField: string
  careerLevel?: string | null
  interests?: readonly string[]
  channel?: string | null
  wave?: string | null
  /** كودُ المؤثّر — لازمٌ في منحة المؤثّرين، ولا يُقرأ في الأولى */
  influencerCode?: string | null
  /** ما أرسله المتصفّح عن زيارتيه: التي فتح فيها صفحةَ المنحة، وأوّلُ زيارةٍ للموقع — يُنظَّف قبل أن يُكتب (`cleanTouch`) */
  source?: { page?: unknown; first?: unknown } | null
  /** رقمُ متصفّحه العشوائيّ — به يُربط بزيارته لصفحة المنحة (`grant-visit.service.ts`) */
  visitorId?: string | null
}

const OPEN_CASE = { notIn: ['closed', 'enrolled', 'not_interested'] }

/** وجهةُ الهديّة لكلّ حملةٍ بلا مؤثّر — ومنحةُ المؤثّرين برابط مؤثّرها (`influencerView`) */
const SHARE_PATH: Partial<Record<CampaignSlug, string>> = { [MEMBER_GRANT_SLUG]: GRANT_SHARE_PATH, [OPEN_GRANT_SLUG]: OPEN_GRANT_SHARE_PATH }
/** غرضُ رابط الهديّة القصير — به يُعرف صفُّه فيُعاد ولا يُصنع ثانية */
const GRANT_SHARE_PURPOSE = 'grant.share'
/** ما يُقرأ من المؤثّر في النموذج — وخصمُه يُكتب في كوده (`grant.service.ts#issue`) */
const INFLUENCER_SELECT = { id: true, nameAr: true, code: true, commissionPercent: true, percentOff: true, closesAt: true } as const

/** المؤثّرُ كما تعرضه صفحتُه: اسمُه وكودُه — ومن له رأسٌ مشتركٌ (`BUILT_IN_INFLUENCER_LOGOS`) رأسُه بشعاره ورسالةُ واتساب
    تنتهي باسمه (١٧ نوفمبر ٢٠٢٦). ومن لا رأسَ له يبقى كما كان */
const influencerFace = (i: { nameAr: string; code: string }) => {
  const brand = influencerBrand(i.code)
  return { nameAr: i.nameAr, code: i.code, ...(brand ? { brand, whatsAppText: influencerWhatsAppTextAr(i.nameAr) } : {}) }
}

export class GrantLandingService {
  private prisma: PrismaClient
  private grants: GrantService
  private advisors: AdvisorService
  /** والصفحةُ بالخدمة نفسِها لمنحة الشريك أيضا (`partner-<رابطه>`، ١٥ نوفمبر ٢٠٢٦): `view` و`savePicks` وحدَهما — نموذجُها
      بريدُ الجامعة لا هذا النموذج (`partner-grant.service.ts`) */
  readonly slug: CampaignSlug
  constructor(prisma: PrismaClient, slug: CampaignSlug = MEMBER_GRANT_SLUG) {
    this.prisma = prisma
    this.slug = slug
    this.grants = new GrantService(prisma, slug)
    this.advisors = new AdvisorService(prisma)
  }

  /** معرّفُ الحملة في أبواب النموذج والمؤثّر — وهي للحملات الأربع وحدَها، فمنحةُ الشريك لا تمرّ بها */
  private get formSlug(): GrantSlug {
    return this.slug as GrantSlug
  }

  /** المؤثّرُ النشطُ بكوده — أو بكودٍ كان له، فرابطُه القديمُ يعمل ويُقال كودُه اليوم (١٥ نوفمبر ٢٠٢٦) — أو لا أحد */
  async influencerByCode(raw: string | null | undefined) {
    const code = normalizeInfluencerCode(raw)
    if (!code) return null
    return this.prisma.influencer.findFirst({
      where: { ...influencerCodeWhere(code), active: true }, select: INFLUENCER_SELECT,
    })
  }

  /** صفحةُ حملة المؤثّرين: حالُها ودوراتُها، واسمُ المؤثّر إن كان كودُه في الرابط صحيحا — ودوراتُه هو إن اختيرت له،
      ونسبتُها ما يأخذه متابعُه هو */
  async influencerView(raw: string | null | undefined, now = new Date()) {
    const found = await this.influencerByCode(raw)
    const v = await this.view(now, found?.id ?? null)
    return {
      influencer: found ? influencerFace(found) : null, ...v,
      campaign: { ...v.campaign, percentOff: influencerPercentOff(v.campaign.percentOff, found?.percentOff) },
      /* وهديّتُها برابط مؤثّرها في حملتها — قصيرا كهديّة «منحة وجيز» */
      sharePath: found ? await this.shareLink(`${influencerGrantPath(this.formSlug)}/${found.code}`) : null,
    }
  }

  /** صفحةُ بلاك فرايدي برابط مؤثّرٍ ذي رأسٍ مشترك (`?ch=<كوده>`، ١٧ نوفمبر ٢٠٢٦) — حالُها ودوراتُها كما هي، ومعها المؤثّرُ
      لرأسه وزرّ واتسابه. ومن لا رأسَ له (`influencerBrand`) تبقى صفحتُه كما كانت */
  async channelView(ch: string | null | undefined, now = new Date()) {
    const [v, found] = await Promise.all([this.view(now), this.influencerByCode(ch)])
    return { ...v, influencer: found && influencerBrand(found.code) ? influencerFace(found) : null }
  }

  /* ═══ رابطُ الهديّة القصير (٢٧ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «الرابط يجب أن يكون قصيرا جدّا وليس بهذا الطول». فرابطٌ واحدٌ لكلّ وجهةٍ يُصنع أوّلَ مرّةٍ
     ويُعاد بعدها — لا رابطٌ لكلّ زائر. ومن تعذّر صنعُه أخذ الطويلَ في الصفحة كما كان: الهديّةُ لا تقف على رابط. */
  private async shareLink(target: string): Promise<string | null> {
    try {
      const had = await this.prisma.shortLink.findFirst({
        where: { target, purpose: GRANT_SHARE_PURPOSE, revokedAt: null }, orderBy: { createdAt: 'asc' }, select: { code: true },
      })
      return shortLinkPath(had?.code ?? await mintShortLink(this.prisma, target, null, GRANT_SHARE_PURPOSE))
    } catch {
      return null
    }
  }

  /** ما تعرضه الصفحة: حالُ المنحة، ودوراتُها بفصلها — دوراتٌ فقط، بلا أجور المدرّبين.
      ودوراتُها ما اختاره المديرُ للحملة، ولمؤثّرها في منحة المؤثّرين — وبلا اختيارٍ تلقائيّة (١٥ نوفمبر ٢٠٢٦، `grant-scope.ts`).
      والقائمةُ للصفحة وحدَها: الكودُ يخصم على أيّ دورةٍ حتى حدّه */
  async view(now = new Date(), influencerId: string | null = null) {
    const [s, open] = await Promise.all([
      this.grants.settings(now), pageCourses(this.prisma, this.slug, influencerId, now),
    ])
    /* وصفحةُ المؤثّر بآخر يومه إن كُتب له — يغلب نهايةَ الحملة، وتشغيلُها شرطٌ باقٍ (١٧ نوفمبر ٢٠٢٦، `influencerClosesAt`) */
    const own = influencerId && isInfluencerGrant(this.slug)
      ? (await this.prisma.influencer.findUnique({ where: { id: influencerId }, select: { closesAt: true } }))?.closesAt ?? null
      : null
    const closesAt = influencerClosesAt(s.closesAt, own)
    const isOpenNow = own ? s.active && (closesAt === null || closesAt > now) : s.open
    const [summaries, sessions, outcomes] = await Promise.all([
      this.summaries(open.courses.map((c) => c.courseId)), this.sessions(open.courses.map((c) => c.cohortId)),
      this.outcomes(open.courses),
    ])
    return {
      /* ولا عددَ للمنح الباقية — قرارُ صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): «العددُ الكبير قد يقلّل من قيمتها» */
      /* و`soldOut`: نفدت أكوادُها والمنحةُ مفتوحة — فمن عبّأ ولم يأخذ كودا يبقى عند سببه، ويعود إلى النموذج حين تُزاد (٢٨ أكتوبر ٢٠٢٦) */
      campaign: { open: isOpenNow, percentOff: s.percentOff, maxCourses: s.maxCourses, closesAt, soldOut: s.left === 0 },
      sharePath: SHARE_PATH[this.slug] ? await this.shareLink(SHARE_PATH[this.slug]!) : null,
      termAr: open.termAr,
      openCourses: open.courses.map((c) => ({
        courseId: c.courseId, titleAr: c.courseTitleAr, cohortId: c.cohortId, startsAt: c.startsAt, price: c.price,
        domainAr: courseDomain(c.courseId),
        /* والمقاعدُ والمدرّبُ لـ«بقي X مقاعد» و«مع مدربك» في صفّ الدورة */
        seatsLeft: c.seatsLeft, trainer: c.trainer,
        /* ونبذتُها تحت سهمٍ في صفّها — فلا ينتقل إلى الموقع ليعرف عمّ هي (`grantCourseSummary`) */
        summary: summaries.get(c.courseId) ?? null,
        /* ومواعيدُ لقاءاتها — يُقال بها فورا إن تعارضت مع ما اختاره قبلها، ولا يُقترح له دورتان تتعارضان */
        sessions: sessions.get(c.cohortId) ?? [],
        /* وما يخرج به منها حقّا: مشروعُها ومهامُّها وشرطُ شهادتها — من صفوفها وحدَها (١٦ نوفمبر ٢٠٢٦، `GrantCourseOutcome`) */
        ...(outcomes.get(c.cohortId) ?? { projectAr: null, tasks: 0, quizzes: 0, certificate: { rules: [] } }),
      })),
    }
  }

  /** ما يخرج به من كلّ شعبةٍ معروضة (١٦ نوفمبر ٢٠٢٦) — والعلّةُ في `grant-landing.ts` («ما ستخرج به»):
      مشروعُ آخر نسخةٍ من الدورة، ومهامُّ الشعبة المنشورةُ للمتعلّمين، وقواعدُ إكمالها السارية كما يُصدِر بها الإصدار */
  private async outcomes(courses: readonly { courseId: string; cohortId: string }[]): Promise<Map<string, GrantCourseOutcome>> {
    if (courses.length === 0) return new Map()
    const courseIds = [...new Set(courses.map((c) => c.courseId))]
    const cohortIds = courses.map((c) => c.cohortId)
    const [projects, tasks, rules] = await Promise.all([
      this.prisma.courseVersion.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: [{ courseId: 'asc' }, { version: 'desc' }],
        distinct: ['courseId'],
        select: { courseId: true, project: { select: { descriptionAr: true } } },
      }),
      /* ما يراه المسجَّلُ نفسُه (`learnerCohortView`): المنشورُ وحدَه — لا مسودّةٌ ولا مغلقة */
      this.prisma.cohortAssessment.groupBy({
        by: ['cohortId', 'type'], where: { cohortId: { in: cohortIds }, status: 'published' }, _count: { _all: true },
      }),
      this.prisma.completionRule.findMany({
        where: { OR: [{ cohortId: { in: cohortIds } }, { courseId: { in: courseIds }, cohortId: null }] },
        select: { courseId: true, cohortId: true, type: true, threshold: true, required: true },
      }),
    ])
    const projectOf = new Map(projects.map((p) => [p.courseId, grantProjectLineAr(p.project?.descriptionAr)]))
    const out = new Map<string, GrantCourseOutcome>()
    for (const c of courses) {
      const mine = tasks.filter((t) => t.cohortId === c.cohortId)
      const resolved = resolveCompletionRules(
        rules.filter((r) => r.courseId === c.courseId && r.cohortId === null),
        rules.filter((r) => r.cohortId === c.cohortId),
      )
      out.set(c.cohortId, {
        projectAr: projectOf.get(c.courseId) ?? null,
        tasks: mine.filter((t) => t.type !== 'quiz').reduce((n, t) => n + t._count._all, 0),
        quizzes: mine.filter((t) => t.type === 'quiz').reduce((n, t) => n + t._count._all, 0),
        certificate: { rules: resolved.map((r) => ({ type: r.type, threshold: r.threshold })) },
      })
    }
    return out
  }

  /** لقاءاتُ كلِّ شعبةٍ بموعدها — ما يُعلَن في صفحة الدورة نفسِه (`PUBLIC_SESSION_WHERE`)، بالبداية والنهاية وحدهما */
  private async sessions(cohortIds: string[]): Promise<Map<string, { startsAt: Date; endsAt: Date | null }[]>> {
    if (cohortIds.length === 0) return new Map()
    const rows = await this.prisma.cohortSession.findMany({
      where: { cohortId: { in: cohortIds }, ...PUBLIC_SESSION_WHERE },
      orderBy: { startsAt: 'asc' },
      select: { cohortId: true, startsAt: true, endsAt: true },
    })
    const out = new Map<string, { startsAt: Date; endsAt: Date | null }[]>()
    for (const r of rows) {
      const list = out.get(r.cohortId) ?? []
      if (list.length < PUBLIC_SESSIONS_CAP) list.push({ startsAt: r.startsAt, endsAt: r.endsAt })
      out.set(r.cohortId, list)
    }
    return out
  }

  /** نبذةُ كلِّ دورةٍ من آخر نسخةٍ لها — كعنوانها في دورات المنحة (`grant-courses.service.ts`) */
  private async summaries(courseIds: string[]): Promise<Map<string, GrantCourseSummary>> {
    if (courseIds.length === 0) return new Map()
    const rows = await this.prisma.courseVersion.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: [{ courseId: 'asc' }, { version: 'desc' }],
      distinct: ['courseId'],
      select: {
        courseId: true, shortPromiseAr: true, descriptionAr: true, audienceAr: true,
        objectives: { orderBy: { sequence: 'asc' }, take: GRANT_SUMMARY_GOALS, select: { textAr: true } },
      },
    })
    const out = new Map<string, GrantCourseSummary>()
    for (const r of rows) {
      const sum = grantCourseSummary(r)
      if (sum) out.set(r.courseId, sum)
    }
    return out
  }

  /** النموذج: عميلٌ محتملٌ وكودُه — أو سببُ غيابه */
  async apply(input: GrantApplyInput, ip?: string, now = new Date()) {
    const fullName = input.fullName.trim()
    const email = input.email.trim().toLowerCase()
    /* دوليٌّ برمز دولته — لا رقمٌ محلّيٌّ بلا مفتاح (١٧ نوفمبر ٢٠٢٦، `normalizeIntlPhone`) */
    const phone = normalizeIntlPhone(input.phone)
    if (fullName.length < 2) throw new AuthError('bad_name', 'اكتب اسمك', 400)
    if (!phone) throw new AuthError('bad_phone', GRANT_PHONE_REQUIRED_AR, 400)
    if (!WORK_FIELDS.includes(input.workField)) throw new AuthError('bad_field', 'اختر مجال عملك من القائمة', 400)
    const careerLevel = input.careerLevel?.trim() || null
    if (careerLevel && !CAREER_LEVELS.includes(careerLevel)) throw new AuthError('bad_level', 'اختر مستواك من القائمة', 400)
    const interests = [...new Set((input.interests ?? []).map((x) => x.trim()))]
    if (interests.length > GRANT_MAX_INTERESTS) throw new AuthError('bad_interests', `اختر حتى ${GRANT_MAX_INTERESTS} مجالات`, 400)
    if (interests.some((x) => !GRANT_INTEREST_DOMAINS.has(x))) throw new AuthError('bad_interests', 'اختر ما تريد تطويره من القائمة', 400)
    /* وحملتا المؤثّرين بقاعدةٍ واحدة: منحةُ المؤثّرين و«بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦) */
    const forInfluencer = isInfluencerGrant(this.slug)
    const named = forInfluencer ? await this.influencerByCode(input.influencerCode) : null
    if (forInfluencer && !named) throw new AuthError('bad_influencer_code', INFLUENCER_CODE_BAD_AR, 400)
    /* ═══ ومن جاء بلاك فرايدي برابط مؤثّرٍ يُنسب إليه — بلا عمولة (١٧ نوفمبر ٢٠٢٦) ═══
       بلاك فرايدي ليست حملةَ مؤثّرين (١٦ نوفمبر): لا كودَ مؤثّرٍ في نموذجها ولا عمولةَ على أكوادها، وفحصُ الهامش يحسبها كذلك.
       وأُرسل لكاسيت رابطُها `?ch=kaseet`، فمن جاء بقناةٍ هي كودُ مؤثّرٍ نشطٍ يُكتب عميلُه وكودُه له فيراه في لوحه، وعمولةُ كوده
       صفر — والعمولةُ عليها قرارٌ لصاحب المنصّة لم يُتّخذ. والقناةُ وحدَها: كودُ مؤثّرٍ يُكتب في النموذج لا يُحسب له (١٦ نوفمبر).
       والأوّلُ يبقى: من عبّأ قبلُ لا يُنقل */
    const tagged = this.slug === BLACK_FRIDAY_GRANT_SLUG ? await this.influencerByCode(input.channel) : null

    const had = await this.prisma.lead.findFirst({
      where: { campaign: this.slug, erasedAt: null, OR: [{ phone }, { email }] },
      orderBy: { createdAt: 'asc' },
    })
    /* ومتى فتح صفحةَ المنحة ومن أين — ليُعرف مصدرُه في قائمة من عبّأ (`grant-registrants.ts`) */
    const pageTouch = cleanTouch(input.source?.page)
    const firstTouch = cleanTouch(input.source?.first)
    const lead = had ?? await this.prisma.lead.create({
      data: {
        fullName, email, phone, source: 'campaign', campaign: this.slug, consentAr: GRANT_CONSENT_AR,
        channel: named ? campaignTag(named.code) : campaignTag(input.channel), wave: campaignTag(input.wave), workField: input.workField,
        careerLevel, interests, influencerId: named?.id ?? tagged?.id ?? null,
        pageTouch: pageTouch ? { ...pageTouch } : undefined, firstTouch: firstTouch ? { ...firstTouch } : undefined,
        pageOpenedAt: pageTouch?.at && Date.parse(pageTouch.at) <= now.getTime() ? new Date(pageTouch.at) : null,
      },
    })
    if (input.visitorId) {
      await linkGrantVisit(this.prisma, this.formSlug, input.visitorId, lead.id, { page: pageTouch, first: firstTouch, influencerCode: named?.code ?? null }, now)
    }
    if (!had) {
      await recordAudit(this.prisma, {
        action: 'coupon.grant_apply', entityType: 'lead', entityId: lead.id, ip,
        meta: { leadId: lead.id, channel: lead.channel, wave: lead.wave, campaign: this.slug, influencerId: lead.influencerId },
      })
    }
    /* المؤثّرُ الذي يُحسب له: من جاء بكوده أوّلَ مرّة — وعمولتُه كما هي اليوم، تُكتب في كوده إن أُعطي الآن */
    /* ═══ ومن أُعطي كودا يُحسب لمؤثّر كوده — ولو أُوقف (٥ نوفمبر ٢٠٢٦) ═══
       الكودُ يحمل مؤثّرَه وعمولتَه يومَ أُعطي (`issue`)، ومن عبّأ ثانيةً يأخذ كودَه نفسَه — فعمولتُه لصاحب كوده، كما يُقال للمؤثّر
       حين يُوقف: «عمولة من أخذ كودا قبل ذلك محسوبة لك». وكانت الصفحةُ تقول للمتابع «جئت عن طريق» المؤثّرِ الذي كتب كودَه الآن
       — وعمولتُه لغيره. فيُقال له مؤثّرُ كوده. */
    const coded = forInfluencer
      ? (await this.prisma.grantCode.findUnique({
          where: { leadId: lead.id }, select: { influencer: { select: INFLUENCER_SELECT } },
        }))?.influencer ?? null
      : null
    const credited = !forInfluencer ? null
      : coded ?? (!lead.influencerId || lead.influencerId === named!.id ? named
        /* والأوّلُ إن كان ما زال نشطا — من أُوقف لا يُكتب له كودٌ جديد ولا عمولتُه، فيُحسب لمن جاء بكوده الآن (٣١ أكتوبر ٢٠٢٦) */
        : await this.prisma.influencer.findFirst({ where: { id: lead.influencerId, active: true }, select: INFLUENCER_SELECT }) ?? named)

    let grant: { code: string | null; sentTo: string | null; percentOff: number; closesAt: Date | null } | null = null
    let reasonAr: string | null = null
    /* ═══ ومن اشترى بالمنحة الأخرى لا يُعطى كودَ هذه (٣١ أكتوبر ٢٠٢٦) ═══
       منحةٌ واحدةٌ لكلّ متعلّم على الحملتين معا، والدفعُ يردّ الكودَ الثاني (`grant_once` في `assertUsable`). وكانت الصفحةُ
       تعطيه كودا وتعرض له أسعارَها، ثمّ يُردّ عند الدفع — ويُعدّ في «سجّلوا» عند مؤثّره. فيُقال له السببُ هنا. والمدفوعُ
       وحدَه: من ترك طلبا بلا دفعٍ لا يُردّ به */
    const usedOther = await this.prisma.order.findFirst({
      where: {
        user: { email }, status: { in: ['paid', 'partially_refunded'] },
        coupon: { grantCode: { campaign: { slug: { not: this.slug } } } },
      },
      select: { id: true },
    })
    if (usedOther) reasonAr = GRANT_ONCE_AR
    else try {
      /* ومن جاء بلاك فرايدي برابط مؤثّرٍ: عمولتُه إن كان ممّن يأخذها عليها (`blackFridayCommission`)، وإلّا صفر */
      const viaLink = !forInfluencer && !credited && lead.influencerId && this.slug === BLACK_FRIDAY_GRANT_SLUG
        ? await this.prisma.influencer.findUnique({ where: { id: lead.influencerId }, select: { code: true, commissionPercent: true } })
        : null
      const g = await this.grants.issue({
        leadId: lead.id,
        influencer: credited ? { id: credited.id, commissionPercent: credited.commissionPercent, percentOff: credited.percentOff, closesAt: credited.closesAt }
          : !forInfluencer && lead.influencerId && this.slug === BLACK_FRIDAY_GRANT_SLUG ? { id: lead.influencerId, commissionPercent: viaLink ? blackFridayCommission(viaLink.code, viaLink.commissionPercent) : 0, percentOff: null, closesAt: null }
          : null,
      }, now)
      const to = lead.email ?? email
      await this.mailCode(to, lead.fullName, g.code, g.percentOff, g.closesAt, credited?.code ?? null)
      grant = g.reused
        ? { code: null, sentTo: maskEmail(to), percentOff: g.percentOff, closesAt: g.closesAt }
        : { code: g.code, sentTo: null, percentOff: g.percentOff, closesAt: g.closesAt }
    } catch (e) {
      if (!(e instanceof AuthError) || !['grant_closed', 'grant_sold_out'].includes(e.code)) throw e
      reasonAr = e.message
    }
    const v = await this.view(now, credited?.id ?? null)
    return {
      ref: lead.id, grant, reasonAr,
      ...(forInfluencer ? { influencer: credited ? { nameAr: credited.nameAr, code: credited.code } : null } : {}),
      ...v,
      /* ونسبةُ الصفحة ما يأخذه متابعُ مؤثّره — فهديّتُه برابط مؤثّره تقول ما يأخذه صديقُه (١٥ نوفمبر ٢٠٢٦) */
      ...(forInfluencer ? { campaign: { ...v.campaign, percentOff: influencerPercentOff(v.campaign.percentOff, credited?.percentOff) } } : {}),
    }
  }

  /* ═══ كودُ منحته لصاحب الحساب — ببريد النموذج (٢٧ أكتوبر ٢٠٢٦) ═══
     من عبّأ النموذجَ ثانيةً، أو فتح الصفحةَ من جهازٍ آخر، يُقال له «أرسلناه إلى بريدك» ولا يُعرض الكود — فكان لوحُ الدفع
     يفتح بلا منحةٍ وبسعرٍ غير الذي رآه. وقرارُ صاحب المنصّة: «يجب أن يصلح ويتغيّر من جهتك»، وخُيّر فاختار **المطابقة
     بالبريد**: حسابٌ بريدُه بريدُ نموذجٍ في هذه الحملة يأخذ كودَه، ولو لم يوثّق بريدَه بعدُ (الدفعُ لا ينتظر التوثيق).
     وعُرض عليه أثرُها: من سبق صاحبَ بريدٍ إلى حسابٍ ببريده أخذ منحتَه، ويستعيد صاحبُ البريد حسابَه ببريده. فيُكتب الأثر.
     ولا كودَ بلغ حدَّ دوراته — ودونه يُعطى ولو اشترى به قبلُ: الحدُّ على الكود في كلّ مشترياته (٢٨ أكتوبر ٢٠٢٦،
     `GrantService.coursesLeft`). */
  async myCode(userId: string, ip?: string): Promise<{ code: string | null; percentOff?: number | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!user?.email) return { code: null }
    const lead = await this.prisma.lead.findFirst({
      where: { campaign: this.slug, erasedAt: null, email: user.email.toLowerCase(), grantCode: { isNot: null } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        grantCode: {
          select: {
            coupon: {
              select: {
                id: true, code: true, percentOff: true, usedCount: true, maxUses: true,
                grantCode: { select: { campaign: { select: { id: true, active: true, closesAt: true, maxCourses: true } }, influencer: { select: { closesAt: true } } } },
              },
            },
          },
        },
      },
    })
    const coupon = lead?.grantCode?.coupon
    if (!lead || !coupon || (await this.grants.coursesLeft(coupon)) <= 0) return { code: null }
    /* ═══ ومن اشترى بكود منحةٍ غيرِه لا يُعطى هذا (٤ نوفمبر ٢٠٢٦) ═══
       منحةٌ واحدةٌ لكلّ متعلّم (`assertUsable`)، فهذا الكودُ يُردّ عند الدفع. وكان يُعطى فتسعّر به الصفحةُ ولوحُ الدفع، ثمّ
       يُردّ فيُعرض عليه الدفعُ بلا منحة — وكودُه الذي اشترى به باقٍ بدوراته. فلا يُعطى، ولوحُ الدفع يطبّق كودَه (`learnerGrant`) */
    const other = await this.prisma.order.findFirst({
      where: { userId, status: { in: GRANT_HOLDS }, couponId: { not: coupon.id }, coupon: { grantCode: { isNot: null } } },
      select: { id: true },
    })
    if (other) return { code: null }
    await recordAudit(this.prisma, {
      action: 'coupon.grant_claim', entityType: 'lead', entityId: lead.id, actorId: userId, ip,
      meta: { campaign: this.slug },
    })
    /* ونسبتُه يومَ أُعطي — فتُسعَّر الصفحةُ بما يُدفع */
    return { code: coupon.code, percentOff: coupon.percentOff }
  }

  /** «تواصل مع مستشار» — حالةٌ واحدةٌ لصاحب المرجع، تُسند تلقائيّا */
  /** الدوراتُ التي اختارها في صفحة المنحة — تُحفظ في ملفّه فيراها المستشار (٢٧ أكتوبر ٢٠٢٦).

      كانت في متصفّحه وحدَه، فلا يعرفها من يتّصل به إلّا إن كتبها في واتساب. قرارُ صاحب المنصّة: «Do all» على اقتراحٍ
      هذا ثالثُه. والمفتاحُ رقمُ طلبه (`ref`) كما في `askAdvisor`: لا يعرفه إلّا متصفّحُه. ولا يُحفظ إلّا ما يُشترى اليوم
      في حملته، وبحدِّ دوراتها — فلا يكتب أحدٌ في ملفٍّ ما لا يُختار. */
  async savePicks(ref: string, courseIds: string[], now = new Date()) {
    const lead = await this.prisma.lead.findFirst({
      /* ومن أكّد بريدَه في منحة شريكٍ يحفظ ما اختاره كذلك — فيراه المستشارُ في ملفّه (١٥ نوفمبر ٢٠٢٦) */
      where: { id: ref, OR: [{ campaign: { in: [...GRANT_SLUGS] } }, { campaign: { startsWith: PARTNER_SLUG_PREFIX } }], erasedAt: null },
      select: { id: true, campaign: true, influencerId: true, grantCode: { select: { influencerId: true } } },
    })
    if (!lead) throw new AuthError('not_found', 'عبئ النموذج أولا', 404)
    const own = lead.campaign === this.slug ? this : new GrantLandingService(this.prisma, lead.campaign as CampaignSlug)
    /* ودوراتُ مؤثّر كوده — أو من جاء بكوده إن لم يأخذ كودا */
    const v = await own.view(now, lead.grantCode?.influencerId ?? lead.influencerId)
    const open = new Set(v.openCourses.map((c) => c.courseId))
    const picks = [...new Set(courseIds)].filter((id) => open.has(id)).slice(0, v.campaign.maxCourses)
    await this.prisma.lead.update({ where: { id: lead.id }, data: { grantPicks: picks, grantPicksAt: now } })
    return { picks }
  }

  /* ═══ من فتح زرَّ بريد كوده في جهازٍ آخر (١٧ نوفمبر ٢٠٢٦، `grantCodeLink`) ═══
     يُعاد ما تحتاجه الصفحةُ لتُفتح على اختيار دوراته: مرجعُه، واسمُه الأوّلُ للتحيّة، ونسبةُ كوده، وما اختاره في النموذج.
     **ولا بريدَه ولا رقمَه**: الكودُ يُهدى، ومن أُهدي إليه لا يُكشف له بريدُ صاحبه — يكتب بريدَه هو عند الدفع.
     وكودٌ من حملةٍ غيرِ هذه، أو لعميلٍ مُحي، لا يُعرف هنا. */
  async resume(code: string): Promise<{ ref: string; code: string; name: string; percentOff: number | null; interests: string[]; workField: string }> {
    const c = code.trim().toUpperCase()
    const g = !GRANT_CODE_RE.test(c) ? null : await this.prisma.grantCode.findFirst({
      where: { coupon: { code: c }, campaign: { slug: this.slug }, lead: { erasedAt: null } },
      select: { coupon: { select: { percentOff: true } }, lead: { select: { id: true, fullName: true, interests: true, workField: true } } },
    })
    if (!g?.lead) throw new AuthError('not_found', 'لا منحة بهذا الكود', 404)
    return {
      ref: g.lead.id, code: c, name: g.lead.fullName.trim().split(/\s+/)[0] ?? '',
      percentOff: g.coupon.percentOff, interests: g.lead.interests, workField: g.lead.workField ?? '',
    }
  }

  async askAdvisor(ref: string, noteAr?: string | null, ip?: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: ref, campaign: { in: [...GRANT_SLUGS] }, erasedAt: null } })
    if (!lead) throw new AuthError('not_found', 'عبئ النموذج أولا', 404)
    const open = await this.prisma.advisorCase.findFirst({ where: { leadId: lead.id, status: OPEN_CASE }, select: { id: true } })
    if (open) return { ok: true as const }
    const note = noteAr?.trim().slice(0, 500) || null
    const kase = await this.prisma.advisorCase.create({
      data: {
        leadId: lead.id,
        nextAction: ['تواصل أول — طلب مستشارا من صفحة المنحة', leadProfileAr(lead)].filter(Boolean).join(' · '),
        ...(note ? { contactEvents: { create: { channel: 'in_app', direction: 'in', summary: `كتب: ${note}` } } } : {}),
      },
    })
    await recordAudit(this.prisma, {
      action: 'advisor.case.guest_request', entityType: 'advisor_case', entityId: kase.id, ip,
      meta: { leadId: lead.id, campaign: lead.campaign },
    })
    try { await this.advisors.autoAssign(kase.id) } catch { /* بلا مستشارٍ متاح: تبقى في «حالات بلا مستشار» */ }
    return { ok: true as const }
  }

  /* ═══ بريدُ الكود — بقالب الأكاديمية لا نصّا خاما (٢٧ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «رسالةُ البريد يجب أن تكون احترافيّة». فعنوانٌ وشكرٌ وكودٌ في جدولٍ وزرٌّ يفتح الدورات،
     ولا «عضو» ولا «مستخدم»: «قرّاءُ وجيز» (قرارُه في اليوم نفسِه). ومن جاء بكود مؤثّرٍ يعود إلى صفحة منحته هي — فيها نسبتُه ودوراتُها. */
  private async mailCode(to: string, name: string, code: string, percentOff: number, closesAt: Date | null, influencerCode: string | null = null) {
    /* وصاحبُ «منحة وجيز العامة» يعود إلى صفحتها هي — فيها نسبتُها ودوراتُها (`grantPagePath`) */
    /* وزرُّه يحمل كودَه، فيُفتح على اختيار دوراته ولو في جهازٍ آخر (١٧ نوفمبر ٢٠٢٦، `grantCodeLink`) */
    const url = influencerCode ? influencerLink(publicSiteUrl(), influencerCode, this.formSlug) : grantCodeLink(`${publicSiteUrl()}${grantPagePath(this.slug)}`, code)
    const last = closesAt ? fmtDate(new Date(closesAt.getTime() - 1)) : null
    const member = this.slug === MEMBER_GRANT_SLUG
    /* والنموذجُ للحملات الأربع وحدَها — منحةُ الشريك لا تمرّ بـ`apply` */
    const { nameAr } = GRANT_CAMPAIGNS[this.formSlug]
    await enqueueMail(this.prisma, {
      to, purpose: 'grant.code',
      subject: `كود ${nameAr} الخاص بك`,
      ...renderMail({
        greetingName: name,
        /* المنحةُ بنسبتها لا بما يبقى — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦)، كسطر الصفحة الأولى */
        preheader: `منحتك تصل إلى ${percentOff}% من سعر دورات أكاديمية وجيز.`,
        heading: 'منحتك جاهزة',
        blocks: [
          { kind: 'p', text: member
            ? 'شكرا لأنك من قراء وجيز. يسعدنا أن نقدم لك منحة حصرية في منتجنا الجديد: أكاديمية وجيز.'
            : 'يسعدنا أن نقدم لك منحة في أكاديمية وجيز.' },
          { kind: 'facts', rows: [
            { label: 'كود منحتك', value: code },
            { label: 'المنحة', value: `تصل إلى ${percentOff}% من سعر الدورات` },
            ...(last ? [{ label: 'آخر يوم', value: last }] : []),
          ] },
          { kind: 'cta', label: 'اختر دوراتك', href: url },
          { kind: 'p', text: 'لقاءات مباشرة على Zoom مع مدربين معتمدين، وتطبيقات عملية، وشهادة ورسالة توصية لمن يلتزم.' },
          /* لا «مرّةً واحدة»: الكودُ يُستعمل في أكثر من طلبٍ حتى حدّ دوراته — قرارُ صاحب المنصّة (٢٨ أكتوبر ٢٠٢٦، `coursesLeft`) */
          { kind: 'note', text: 'يمكنك أن تستعمل الكود في أكثر من طلب حتى حد دوراته، أو أن تهديه لغيرك.' },
        ],
      }),
    })
  }
}

/** «j•••@gmail.com» — يُقال أين ذهب الكودُ بلا أن يُكشف بريدُ أحدٍ لمن كتب رقمَه */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  return domain ? `${name.slice(0, 1)}•••@${domain}` : '•••'
}

