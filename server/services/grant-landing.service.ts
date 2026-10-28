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

   والحارس: `server/tests/commerce/grant-landing.test.ts` و`influencer-grant.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'
import { GrantService } from './grant.service'
import { GrantCoursesService } from './grant-courses.service'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { mintShortLink } from './short-link.service'
import { publicSiteUrl } from './site-url'
import { PUBLIC_SESSIONS_CAP, PUBLIC_SESSION_WHERE } from './public-catalog.service'
import { normalizePhone } from '../../src/application/advisor/guest-contact'
import {
  CAREER_LEVELS, GRANT_CONSENT_AR, GRANT_INTEREST_DOMAINS, GRANT_MAX_INTERESTS, GRANT_SHARE_PATH, GRANT_SUMMARY_GOALS, WORK_FIELDS, campaignTag, grantCourseSummary, leadProfileAr,
  type GrantCourseSummary,
} from '../../src/application/commerce/grant-landing'
import { courseDomain } from '../../src/application/catalog/course-domain'
import { INFLUENCER_GRANT_NAME_AR, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_NAME_AR, MEMBER_GRANT_SLUG, type GrantSlug } from '../../src/application/commerce/grant'
import { INFLUENCER_CODE_BAD_AR, INFLUENCER_GRANT_PATH, influencerLink, normalizeInfluencerCode } from '../../src/application/commerce/influencer'
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
}

const OPEN_CASE = { notIn: ['closed', 'enrolled', 'not_interested'] }

/** الحملتان — بهما يُقبل طلبُ المستشار ممّن عبّأ أيَّهما */
const GRANT_SLUGS: GrantSlug[] = [MEMBER_GRANT_SLUG, INFLUENCER_GRANT_SLUG]
/** غرضُ رابط الهديّة القصير — به يُعرف صفُّه فيُعاد ولا يُصنع ثانية */
const GRANT_SHARE_PURPOSE = 'grant.share'

export class GrantLandingService {
  private prisma: PrismaClient
  private grants: GrantService
  private courses: GrantCoursesService
  private advisors: AdvisorService
  readonly slug: GrantSlug
  constructor(prisma: PrismaClient, slug: GrantSlug = MEMBER_GRANT_SLUG) {
    this.prisma = prisma
    this.slug = slug
    this.grants = new GrantService(prisma, slug)
    this.courses = new GrantCoursesService(prisma)
    this.advisors = new AdvisorService(prisma)
  }

  /** المؤثّرُ النشطُ بكوده — أو لا أحد */
  async influencerByCode(raw: string | null | undefined) {
    const code = normalizeInfluencerCode(raw)
    if (!code) return null
    return this.prisma.influencer.findFirst({
      where: { code, active: true }, select: { id: true, nameAr: true, code: true, commissionPercent: true },
    })
  }

  /** صفحةُ منحة المؤثّرين: حالُها ودوراتُها، واسمُ المؤثّر إن كان كودُه في الرابط صحيحا */
  async influencerView(raw: string | null | undefined, now = new Date()) {
    const found = await this.influencerByCode(raw)
    return {
      influencer: found ? { nameAr: found.nameAr, code: found.code } : null, ...(await this.view(now)),
      /* وهديّتُها برابط مؤثّرها — قصيرا كهديّة «منحة وجيز» */
      sharePath: found ? await this.shareLink(`${INFLUENCER_GRANT_PATH}/${found.code}`) : null,
    }
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

  /** ما تعرضه الصفحة: حالُ المنحة، ودوراتُها بفصلها — دوراتٌ فقط، بلا أجور المدرّبين */
  async view(now = new Date()) {
    const [s, open] = await Promise.all([this.grants.settings(now), this.courses.openCourses(now)])
    const [summaries, sessions] = await Promise.all([
      this.summaries(open.courses.map((c) => c.courseId)), this.sessions(open.courses.map((c) => c.cohortId)),
    ])
    return {
      /* ولا عددَ للمنح الباقية — قرارُ صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): «العددُ الكبير قد يقلّل من قيمتها» */
      /* و`soldOut`: نفدت أكوادُها والمنحةُ مفتوحة — فمن عبّأ ولم يأخذ كودا يبقى عند سببه، ويعود إلى النموذج حين تُزاد (٢٨ أكتوبر ٢٠٢٦) */
      campaign: { open: s.open, percentOff: s.percentOff, maxCourses: s.maxCourses, closesAt: s.closesAt, soldOut: s.left === 0 },
      sharePath: this.slug === MEMBER_GRANT_SLUG ? await this.shareLink(GRANT_SHARE_PATH) : null,
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
      })),
    }
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
    const phone = normalizePhone(input.phone)
    if (fullName.length < 2) throw new AuthError('bad_name', 'اكتب اسمك', 400)
    if (!phone) throw new AuthError('bad_phone', 'رقم واتساب غير صحيح، اكتبه بالأرقام', 400)
    if (!WORK_FIELDS.includes(input.workField)) throw new AuthError('bad_field', 'اختر مجال عملك من القائمة', 400)
    const careerLevel = input.careerLevel?.trim() || null
    if (careerLevel && !CAREER_LEVELS.includes(careerLevel)) throw new AuthError('bad_level', 'اختر مستواك من القائمة', 400)
    const interests = [...new Set((input.interests ?? []).map((x) => x.trim()))]
    if (interests.length > GRANT_MAX_INTERESTS) throw new AuthError('bad_interests', `اختر حتى ${GRANT_MAX_INTERESTS} مجالات`, 400)
    if (interests.some((x) => !GRANT_INTEREST_DOMAINS.has(x))) throw new AuthError('bad_interests', 'اختر ما تريد تطويره من القائمة', 400)
    const forInfluencer = this.slug === INFLUENCER_GRANT_SLUG
    const named = forInfluencer ? await this.influencerByCode(input.influencerCode) : null
    if (forInfluencer && !named) throw new AuthError('bad_influencer_code', INFLUENCER_CODE_BAD_AR, 400)

    const had = await this.prisma.lead.findFirst({
      where: { campaign: this.slug, erasedAt: null, OR: [{ phone }, { email }] },
      orderBy: { createdAt: 'asc' },
    })
    const lead = had ?? await this.prisma.lead.create({
      data: {
        fullName, email, phone, source: 'campaign', campaign: this.slug, consentAr: GRANT_CONSENT_AR,
        channel: named ? campaignTag(named.code) : campaignTag(input.channel), wave: campaignTag(input.wave), workField: input.workField,
        careerLevel, interests, influencerId: named?.id ?? null,
      },
    })
    if (!had) {
      await recordAudit(this.prisma, {
        action: 'coupon.grant_apply', entityType: 'lead', entityId: lead.id, ip,
        meta: { leadId: lead.id, channel: lead.channel, wave: lead.wave, campaign: this.slug, influencerId: lead.influencerId },
      })
    }
    /* المؤثّرُ الذي يُحسب له: من جاء بكوده أوّلَ مرّة — وعمولتُه كما هي اليوم، تُكتب في كوده إن أُعطي الآن */
    const credited = !forInfluencer ? null
      : !lead.influencerId || lead.influencerId === named!.id ? named
        : await this.prisma.influencer.findUnique({ where: { id: lead.influencerId }, select: { id: true, nameAr: true, code: true, commissionPercent: true } })

    let grant: { code: string | null; sentTo: string | null; percentOff: number; closesAt: Date | null } | null = null
    let reasonAr: string | null = null
    try {
      const g = await this.grants.issue({ leadId: lead.id, influencer: credited ? { id: credited.id, commissionPercent: credited.commissionPercent } : null }, now)
      const to = lead.email ?? email
      await this.mailCode(to, lead.fullName, g.code, g.percentOff, g.closesAt, credited?.code ?? null)
      grant = g.reused
        ? { code: null, sentTo: maskEmail(to), percentOff: g.percentOff, closesAt: g.closesAt }
        : { code: g.code, sentTo: null, percentOff: g.percentOff, closesAt: g.closesAt }
    } catch (e) {
      if (!(e instanceof AuthError) || !['grant_closed', 'grant_sold_out'].includes(e.code)) throw e
      reasonAr = e.message
    }
    return {
      ref: lead.id, grant, reasonAr,
      ...(forInfluencer ? { influencer: credited ? { nameAr: credited.nameAr, code: credited.code } : null } : {}),
      ...(await this.view(now)),
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
                grantCode: { select: { campaign: { select: { id: true, active: true, closesAt: true, maxCourses: true } } } },
              },
            },
          },
        },
      },
    })
    const coupon = lead?.grantCode?.coupon
    if (!lead || !coupon || (await this.grants.coursesLeft(coupon, userId)) <= 0) return { code: null }
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
    const lead = await this.prisma.lead.findFirst({ where: { id: ref, campaign: { in: GRANT_SLUGS }, erasedAt: null }, select: { id: true, campaign: true } })
    if (!lead) throw new AuthError('not_found', 'عبئ النموذج أولا', 404)
    const own = lead.campaign === this.slug ? this : new GrantLandingService(this.prisma, lead.campaign as GrantSlug)
    const v = await own.view(now)
    const open = new Set(v.openCourses.map((c) => c.courseId))
    const picks = [...new Set(courseIds)].filter((id) => open.has(id)).slice(0, v.campaign.maxCourses)
    await this.prisma.lead.update({ where: { id: lead.id }, data: { grantPicks: picks, grantPicksAt: now } })
    return { picks }
  }

  async askAdvisor(ref: string, noteAr?: string | null, ip?: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: ref, campaign: { in: GRANT_SLUGS }, erasedAt: null } })
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
    const url = influencerCode ? influencerLink(publicSiteUrl(), influencerCode) : `${publicSiteUrl()}/grant`
    const last = closesAt ? fmtDate(new Date(closesAt.getTime() - 1)) : null
    const member = this.slug === MEMBER_GRANT_SLUG
    const nameAr = member ? MEMBER_GRANT_NAME_AR : INFLUENCER_GRANT_NAME_AR
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
          { kind: 'note', text: 'الكود يستعمل مرة واحدة، ويمكنك أن تهديه لغيرك.' },
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

/** ما يُعدّ شراءً بالمنحة — دُفع ولو رُدّ بعضُه */
const BOUGHT = ['paid', 'partially_refunded']

/** نتائجُ الحملة لصاحب المنصّة: من عبّأ، ومن أخذ كودا، ومن اشترى، وبكم — بالقناة والدفعة، وبمجال العمل.
    والشراءُ يُنسب إلى قناة **صاحب الكود** لا المشتري: كودٌ أُهدي لصديقٍ فاشترى به جاء من القناة التي
    أوصلت الكودَ أصلا. والمبلغُ ما دُفع بعملته (الحملةُ بالدولار). */
export async function grantResults(prisma: PrismaClient) {
  const campaign = await new GrantService(prisma).campaign()
  const [leads, fields, codes, cases] = await Promise.all([
    prisma.lead.groupBy({ by: ['channel', 'wave'], where: { campaign: MEMBER_GRANT_SLUG }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['workField'], where: { campaign: MEMBER_GRANT_SLUG }, _count: { _all: true } }),
    prisma.grantCode.findMany({
      where: { campaignId: campaign.id },
      select: {
        lead: { select: { channel: true, wave: true } },
        coupon: { select: { orders: { where: { status: { in: BOUGHT } }, select: { total: true } } } },
      },
    }),
    prisma.advisorCase.count({ where: { lead: { campaign: MEMBER_GRANT_SLUG } } }),
  ])
  type Row = { channel: string | null; wave: string | null; leads: number; codes: number; bought: number; revenue: number }
  const key = (c: string | null, w: string | null) => `${c ?? ''}|${w ?? ''}`
  const rows = new Map<string, Row>()
  const row = (c: string | null, w: string | null) => {
    const k = key(c, w)
    if (!rows.has(k)) rows.set(k, { channel: c, wave: w, leads: 0, codes: 0, bought: 0, revenue: 0 })
    return rows.get(k)!
  }
  for (const l of leads) row(l.channel, l.wave).leads += l._count._all
  for (const g of codes) {
    const r = row(g.lead?.channel ?? null, g.lead?.wave ?? null)
    r.codes += 1
    for (const o of g.coupon.orders) { r.bought += 1; r.revenue += Number(o.total) }
  }
  const list = [...rows.values()]
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.leads - a.leads)
  const sum = (k: 'leads' | 'codes' | 'bought' | 'revenue') => Math.round(list.reduce((s, r) => s + r[k], 0) * 100) / 100
  return {
    totals: { leads: sum('leads'), codes: sum('codes'), bought: sum('bought'), revenue: sum('revenue'), advisorCases: cases },
    rows: list,
    fields: fields.map((f) => ({ workField: f.workField, leads: f._count._all })).sort((a, b) => b.leads - a.leads),
  }
}
