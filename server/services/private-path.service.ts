/* «مسارٌ خاصّ» — يُسكّ مع رابط الشراء، ويُقرأ لصفحته العامّة (٥ نوفمبر ٢٠٢٦).

   القاعدةُ والشكلُ في `src/application/commerce/private-path.ts`. وهنا:
   · **السكّ** (`mintPrivatePath`) — يناديه `BuyLinkService.generate` بعد أن صدّق الصلاحيّةَ والدوراتِ والكود ورمزَ النسبة.
     رمزٌ من ثمانية أحرف، وصفٌّ في `ShortLink` بغرض `private_path` وتفاصيلِه في `payload`. ومن له مسارٌ قبله يُكتب في
     القديم أنّ له نسخةً أحدث (`supersededBy`) — فيُحوَّل منه إليها، ولا يُمحى.
   · **القراءة** (`PrivatePathService.view`) — عامّةٌ بلا حساب: الرمزُ هو السرّ. تعيد الاسمَ الأوّلَ وحدَه، والدوراتِ بأسبابها
     ومدرّبيها (المنشورين وحدَهم — `trainerPubliclyVisible`) وأوّلِ لقاءاتها، والسعرَ من المعاينة نفسِها التي يُدفع بها
     (`CommerceService.preview`) — فلا حسابَ هنا يخالف الفاتورة. ولا بريدَ ولا هاتفَ ولا شيءَ من ملفّه سوى اسمه الأوّل.
     وتُعدّ الفتحةُ كما تُعدّ فتحاتُ كلّ رابطٍ قصير (`recordOpen`: بلا زاحف، ومرّةً في نصف ساعة).
   والحارس: `server/tests/commerce/private-path.test.ts`. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordOpen } from './link-opens'
import { GRANT_HOLDS, GrantService, learnerGrant } from './grant.service'
import { recordAudit } from './audit'
import { pageCourses } from './grant-scope.service'
import { TRAINER_VISIBILITY_SELECT, trainerPubliclyVisible } from './trainer-visibility'
import { PUBLIC_SESSION_WHERE } from './public-catalog.service'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import {
  GO_CODE_LENGTH, GO_CODE_RE, PRIVATE_PATH_PURPOSE, PUBLIC_PATH_LEAD_CHANNEL, firstLastNameAr, firstNameAr, goPath, type GiftRule, privatePathPrice,
  type PrivatePathPayload, type PublicPathDef,
} from '../../src/application/commerce/private-path'
import { GRANT_CLOSED_AR, grantLastDay, grantMaxCoursesAr, grantTitleAr, grantUsedUpAr, type CampaignSlug } from '../../src/application/commerce/grant'
import { priceCart } from '../../src/application/commerce/cart-pricing'

type Db = PrismaClient | Prisma.TransactionClient

const NOT_FOUND_AR = 'هذا الرابط غير صحيح. تأكد من نسخه كاملا، أو اطلب رابطا جديدا من مستشارك.'

/** يسكّ رابطَ المسار ويُعلّم نسخَه القديمةَ لصاحبه — ويعيد رمزَه */
export async function mintPrivatePath(db: Db, actorId: string, payload: Omit<PrivatePathPayload, 'v'>): Promise<string> {
  const data = { v: 1, ...payload } as PrivatePathPayload
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomUnambiguousCode(GO_CODE_LENGTH)
    if (await db.shortLink.count({ where: { code } }) > 0) continue
    const older = await db.shortLink.findMany({
      where: { purpose: PRIVATE_PATH_PURPOSE, revokedAt: null, payload: { path: ['learnerKey'], equals: payload.learnerKey } },
      select: { id: true, payload: true },
    })
    await db.shortLink.create({
      data: { code, target: goPath(code), purpose: PRIVATE_PATH_PURPOSE, createdBy: actorId, payload: data as unknown as Prisma.InputJsonValue },
    })
    for (const o of older) {
      const p = (o.payload ?? {}) as Record<string, unknown>
      if (p.supersededBy) continue
      await db.shortLink.update({ where: { id: o.id }, data: { payload: { ...p, supersededBy: code } as Prisma.InputJsonValue } })
    }
    return code
  }
  throw new AuthError('code_exhausted', 'تعذر تجهيز رمز للرابط، أعد المحاولة', 500)
}

export interface PrivatePathView {
  code: string
  firstName: string
  /** الاسمُ الأوّلُ والأخير لعنوان «مسار {الاسم} الشخصي» — من ملفّه الآن، وإلّا الأوّلُ المحفوظُ مع الرابط (٨ نوفمبر ٢٠٢٦) */
  nameAr: string
  /** من نموذج المنحة — للعنوان والسطر تحته وحدَهما (`privatePathHeadline`). ولا شيءَ سواهما من ملفّه */
  profile: { workField: string | null; careerLevel: string | null }
  courses: {
    n: number
    courseId: string
    cohortId: string
    titleAr: string
    reasonAr: string | null
    trainerName: string | null
    firstSessionAt: Date | null
  }[]
  price: {
    currency: string
    before: number
    grant: number
    grantNameAr: string | null
    grantPct: number | null
    total: number
  } | null
  /** آخرُ يومٍ للمنحة أو الكود — بتوقيت عمّان (`grantLastDay`) */
  lastDay: string | null
  couponCode: string | null
  /** ما سقط من المسار ولا يُشترى الآن — بسببه */
  unavailable: { titleAr: string; reasonAr: string }[]
  /** كم دورةً يضيفها إلى المسار بكوده نفسِه — ما بقي على كود المنحة (`coursesLeft`) ناقصا دوراتِ المسار.
      و`null` لمسارٍ بلا كود منحة: لا «أضف دورة» بسعرها الكامل (٢١ نوفمبر ٢٠٢٦، `pathAddsLeft`) */
  coursesLeft: number | null
  /** دوراتُ صفحة منحة الكود — منها وحدَها بدائلُ «استبدالها» و«أضف دورة» (٢١ نوفمبر ٢٠٢٦، «Only Black Friday courses»).
      و`null` لمسارٍ بلا كود منحة: كلُّ ما يُشترى كما كان (`pathCandidatesWithin`) */
  grantCourseIds: string[] | null
  /** يُرسَل مع الشراء فيُنسب الطلبُ إلى من ولّد الرابط (`buyLinkForOrder`) — ولا رمزَ للمسار العامّ */
  buyLinkToken: string | null
  /** المسارُ العامّ (`/go/BF80`، ٢٢ نوفمبر ٢٠٢٦): رمزُه، وهل يُطلب الدخول، وسطرٌ إن لم يُعطَ كودا (مغلقة، أو منحةٌ سابقة) */
  publicPath?: { code: string; signIn: boolean; noteAr: string | null }
  /** لماذا لا يسع الكودُ دوراتِ المسار العامّ كلَّها — فيُنقص ما اختاره */
  priceProblemAr?: string | null
  /** الدورةُ الهديّة وشرطُها — وسعرُها الأصليّ ليُعرض مشطوبا (٨ نوفمبر ٢٠٢٦، `private-path-gift.ts`) */
  gift: {
    courseId: string
    cohortId: string
    titleAr: string
    trainerName: string | null
    firstSessionAt: Date | null
    listPrice: number
    currency: string
    rule: GiftRule
    minCourses: number
    /** لا تُشترى الآن — بسببه، فلا تُعرض وعدا لا يُوفى */
    unavailableAr: string | null
  } | null
}

export class PrivatePathService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** صفحةُ المسار — أو عنوانُ نسختها الأحدث، أو ٤٠٤ بجملةٍ عربيّة */
  async view(rawCode: string, req: { ip: string; userAgent: string | undefined }): Promise<PrivatePathView | { movedTo: string }> {
    const code = rawCode.trim().toUpperCase()
    if (!GO_CODE_RE.test(code)) throw new AuthError('not_found', NOT_FOUND_AR, 404)
    const row = await this.prisma.shortLink.findUnique({ where: { code }, select: { purpose: true, revokedAt: true, payload: true } })
    if (!row || row.revokedAt || row.purpose !== PRIVATE_PATH_PURPOSE || !row.payload) throw new AuthError('not_found', NOT_FOUND_AR, 404)
    const p = row.payload as unknown as PrivatePathPayload

    /* ونسخةٌ أحدثُ — يُتبَع خيطُها إلى آخره (بحدّ) فيُحوَّل إلى ما يُشترى اليوم */
    if (p.supersededBy) {
      let next = p.supersededBy
      for (let hop = 0; hop < 10; hop += 1) {
        const n = await this.prisma.shortLink.findUnique({ where: { code: next }, select: { payload: true, revokedAt: true } })
        const np = n?.payload as unknown as PrivatePathPayload | null
        if (!n || n.revokedAt || !np?.supersededBy) break
        next = np.supersededBy
      }
      return { movedTo: next }
    }

    await recordOpen(this.prisma, code, { ip: req.ip, userAgent: req.userAgent, via: null })
    return this.render(code, p)
  }

  /* ═══ «مسارٌ عامّ» `/go/BF80` (٢٢ نوفمبر ٢٠٢٦) ═══
     القاعدةُ في `src/application/commerce/private-path.ts` (`PUBLIC_PATHS`). وهنا:
     · **بلا حساب يرى كلَّ شيءٍ إلّا اسمَه** — قرارُ صاحب المنصّة (٢٣ نوفمبر ٢٠٢٦): «They should see everything, and once
       they click to pay, then create account or sign in». دوراتُه بشعبها من صفحة حملته (`pageCourses`)، والسعرُ بنسبة الحملة
       الآن كأنّه بكودها (`campaignPreview`) — بلا كودٍ يُخترع — و«أضف دورة» بحدّ الحملة، وآخرُ يومها. و`signIn` يقول للصفحة
       إنّ الحسابَ يُطلب عند «أكمل التسجيل»، ثمّ يُعطى كودَه من نداء المتعلّم.
     · **وبحسابه**: باسمه وكودِ منحته (`publicPathCode`)، والسعرُ من المعاينة نفسِها بكوده. ولا استبدال — يختار من الثلاث
       ما يشتريه، ويُعاد السعرُ من الخادم.
     · **و«أضف دورة» من دورات المنحة وحدَها** — قرارُ صاحب المنصّة (٢٢ نوفمبر ٢٠٢٦): «اسمح لهم بإضافة دورات، لكن من الدورات
       الباقية في منحة بلاك فرايدي فقط». فـ`grantCourseIds` قائمةُ صفحة حملة المسار (`def.campaign`) أيًّا كان كودُه،
       و`coursesLeft` ما بقي على كوده ناقصا دوراتِ المسار **بلا حدٍّ عند الصفر**: فمن بقي على كوده دورتان يرى −1، فإن أزال
       واحدةً من الثلاث أضاف واحدة (`publicPathAddsLeft`). وبلا كود منحةٍ كلاهما `null`: لا إضافة.
     · والكودُ يبقى في الجواب ولو لم يسع الثلاثَ معا (بقي عليه أقلّ): يُقال السببُ (`priceProblemAr`)، فيُنقص ما اختاره
       ويُعاد السعرُ بالكود نفسِه — لا يُسقط الكودُ فيُعرض السعرُ كاملا بلا سبب. */
  async publicView(def: PublicPathDef, userId: string | null, now = new Date()): Promise<PrivatePathView> {
    const shown = await pageCourses(this.prisma, def.campaign as CampaignSlug, null, now, def.courseIds)
    const courses: PrivatePathPayload['courses'] = []
    const missing: string[] = []
    for (const courseId of def.courseIds) {
      const c = shown.courses.find((x) => x.courseId === courseId)
      if (c) courses.push({ courseId, cohortId: c.cohortId, reasonAr: null })
      else missing.push(courseId)
    }
    const unavailable: PrivatePathView['unavailable'] = []
    if (missing.length > 0) {
      const rows = await this.prisma.course.findMany({
        where: { id: { in: missing } }, select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
      })
      for (const id of missing) unavailable.push({ titleAr: rows.find((r) => r.id === id)?.versions[0]?.titleAr ?? id, reasonAr: 'لا شعبة مفتوحة لها الآن' })
    }
    const meta = (signIn: boolean, noteAr: string | null) => ({ code: def.code, signIn, noteAr })

    if (!userId) {
      const camp = await new GrantService(this.prisma, def.campaign as CampaignSlug).campaign()
      const open = campaignOpen(camp, now)
      const out = await this.render(def.code, { courses, code: null, firstName: '', learnerKey: '', token: '' }, { campaign: def.campaign as CampaignSlug, now })
      /* وما يضيفه: حدُّ دورات الكود الذي سيُعطاه ناقصا الثلاث — بلا حدٍّ عند الصفر، كالمتعلّم (`publicPathAddsLeft`) */
      const grantCourseIds = open
        ? [...new Set((await pageCourses(this.prisma, def.campaign as CampaignSlug, null, now)).courses.map((c) => c.courseId))]
        : null
      return {
        ...out, unavailable: [...out.unavailable, ...unavailable],
        coursesLeft: open ? camp.maxCourses - out.courses.length : null, grantCourseIds,
        lastDay: open && camp.closesAt ? grantLastDay(camp.closesAt) : null,
        publicPath: meta(true, open ? null : GRANT_CLOSED_AR),
      }
    }
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } })
    const got = await publicPathCode(this.prisma, def.campaign as CampaignSlug, userId, now)
    const out = await this.render(def.code, {
      courses, code: got.code, firstName: firstNameAr(account?.displayName), learnerKey: `user:${userId}`, token: '',
    }, { keepCode: true, belowZero: true })
    const grantCourseIds = out.coursesLeft === null
      ? null
      : [...new Set((await pageCourses(this.prisma, def.campaign as CampaignSlug, null, now)).courses.map((c) => c.courseId))]
    return {
      ...out, unavailable: [...out.unavailable, ...unavailable], grantCourseIds,
      publicPath: meta(false, got.noteAr),
    }
  }

  /** الصفحةُ من دوراتها وكودها — للمسار الخاصّ من رابطه، وللعامّ من تعريفه */
  private async render(
    code: string,
    p: Pick<PrivatePathPayload, 'courses' | 'code' | 'firstName' | 'learnerKey' | 'token' | 'gift'>,
    /** `belowZero`: ما بقي على الكود ناقصا دوراتِ المسار بلا حدٍّ عند الصفر — للمسار العامّ (`publicPathAddsLeft`) */
    /* `campaign`: الزائرُ في المسار العامّ — يُسعَّر بنسبة حملته بلا كود (`campaignPreview`) */
    opts: { priced?: boolean; keepCode?: boolean; belowZero?: boolean; campaign?: CampaignSlug; now?: Date } = {},
  ): Promise<PrivatePathView> {
    const cohortIds = p.courses.map((c) => c.cohortId)
    const cohorts = await this.prisma.cohort.findMany({
      where: { id: { in: cohortIds } },
      select: {
        id: true, courseId: true, startsAt: true,
        course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
        trainers: {
          where: { role: 'lead' },
          select: { profile: { select: { ...TRAINER_VISIBILITY_SELECT, application: { select: { fullName: true } } } } },
        },
        sessions: { where: PUBLIC_SESSION_WHERE, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
      },
    })
    const byId = new Map(cohorts.map((c) => [c.id, c]))

    /* السعرُ من المعاينة نفسِها التي يدفع بها — بلا حسابِ أحد (`preview`). وما لا يُشترى منها يُقال بسببه */
    const { CommerceService } = await import('./commerce.service')
    let preview: Awaited<ReturnType<InstanceType<typeof CommerceService>['preview']>> | null = null
    try {
      preview = opts.campaign && !p.code
        ? await campaignPreview(this.prisma, opts.campaign, cohortIds, opts.now)
        : await new CommerceService(this.prisma).preview(null, cohortIds, p.code ?? undefined)
    } catch (e) {
      if (!(e instanceof AuthError)) throw e
    }
    const excluded = new Map((preview?.excluded ?? []).map((x) => [x.cohortId, x.messageAr]))
    const titleOf = (cohortId: string) => byId.get(cohortId)?.course.versions[0]?.titleAr ?? byId.get(cohortId)?.courseId ?? '—'

    const courses: PrivatePathView['courses'] = []
    const unavailable: PrivatePathView['unavailable'] = []
    for (const c of p.courses) {
      const row = byId.get(c.cohortId)
      if (!row || excluded.has(c.cohortId) || !preview?.items.some((i) => i.cohortId === c.cohortId)) {
        unavailable.push({ titleAr: titleOf(c.cohortId), reasonAr: excluded.get(c.cohortId) ?? 'لم تعد متاحة للشراء' })
        continue
      }
      const lead = row.trainers.map((t) => t.profile).find(trainerPubliclyVisible)
      courses.push({
        n: courses.length + 1, courseId: row.courseId, cohortId: row.id, titleAr: titleOf(row.id), reasonAr: c.reasonAr,
        trainerName: lead ? lead.application.fullName : null,
        firstSessionAt: row.sessions[0]?.startsAt ?? row.startsAt ?? null,
      })
    }

    /* وآخرُ يوم: نهايةُ حملة كود المنحة، أو انتهاءُ الكوبون — وما لا نهايةَ له لا يُقال */
    let lastDay: string | null = null
    let coursesLeft: number | null = null
    let grantCourseIds: string[] | null = null
    const couponCode = opts.keepCode && p.code ? p.code : preview && !preview.couponError ? preview.couponCode : null
    if (couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: couponCode },
        select: {
          id: true, usedCount: true, maxUses: true, expiresAt: true,
          grantCode: {
            select: { influencerId: true, campaign: { select: { id: true, slug: true, active: true, closesAt: true, maxCourses: true } } },
          },
        },
      })
      const ends = coupon?.grantCode?.campaign.closesAt ?? coupon?.expiresAt ?? null
      lastDay = ends ? grantLastDay(ends) : null
      /* ═══ وكم يضيف بكوده (٢١ نوفمبر ٢٠٢٦، «Allow adding») ═══
         ما بقي على الكود في كلّ مشترياته — عدُّ الدفع نفسُه (`GrantService.coursesLeft`) — ناقصا ما في المسار. فمن اشترى
         بكوده دورةً في مكانٍ آخر نقص ما يضيفه هنا. وكوبونٌ ليس كودَ منحةٍ لا حدَّ له يُقال، فلا يُضاف به */
      if (coupon?.grantCode) {
        const left = await new GrantService(this.prisma).coursesLeft(coupon)
        /* وفي المسار العامّ بلا حدٍّ عند الصفر: يُزال من دوراته ما يفسح لغيرها */
        coursesLeft = opts.belowZero ? left - courses.length : Math.max(0, left - courses.length)
        /* ═══ والبدائلُ من دورات صفحة منحته وحدَها (٢١ نوفمبر ٢٠٢٦، «Only Black Friday courses») ═══
           قرارُ صاحب المنصّة: ما يُستبدل به أو يُضاف في مسارٍ على كود حملةٍ هو ما تعرضه صفحةُ تلك الحملة — بقائمة المدير
           لها ولمؤثّرها (`pageCourses`)، لا كلُّ ما يُشترى. ودوراتُ المسار نفسُها تبقى ولو لم تكن فيها. والدفعُ لا يتغيّر */
        const shown = await pageCourses(this.prisma, coupon.grantCode.campaign.slug as CampaignSlug, coupon.grantCode.influencerId)
        grantCourseIds = [...new Set(shown.courses.map((c) => c.courseId))]
      }
    }

    /* واسمُه الأوّلُ والأخيرُ ومجالُ عمله ومستواه — بحسابه أو بنموذجه (`learnerKey`)، وأحدثُ نموذجٍ له إن تعدّد.
       والاسمُ من حسابه أوّلا ثمّ نموذجِه، وإلّا الأوّلُ المحفوظُ مع الرابط. ولا شيءَ سواها من ملفّه */
    const [kind, id] = p.learnerKey.split(':')
    const lead = id && (kind === 'lead' || kind === 'user')
      ? await this.prisma.lead.findFirst({
        where: { erasedAt: null, ...(kind === 'lead' ? { id } : { userId: id }) },
        orderBy: { createdAt: 'desc' },
        select: { fullName: true, workField: true, careerLevel: true },
      }).catch(() => null)
      : null
    const account = id && kind === 'user'
      ? await this.prisma.user.findUnique({ where: { id }, select: { displayName: true } }).catch(() => null)
      : null
    const nameAr = firstLastNameAr(account?.displayName) || firstLastNameAr(lead?.fullName) || p.firstName

    /* والهديّةُ: بطاقتُها بعنوانها ومدرّبها المنشور وأوّلِ لقائها، وسعرِها الأصليّ من المعاينة نفسِها (بلا كودٍ ولا هديّة) */
    let gift: PrivatePathView['gift'] = null
    if (p.gift) {
      const g = p.gift
      const row = await this.prisma.cohort.findUnique({
        where: { id: g.cohortId },
        select: {
          id: true, courseId: true, startsAt: true,
          course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
          trainers: { where: { role: 'lead' }, select: { profile: { select: { ...TRAINER_VISIBILITY_SELECT, application: { select: { fullName: true } } } } } },
          sessions: { where: PUBLIC_SESSION_WHERE, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
        },
      })
      let listPrice = 0
      let currency = preview?.currency ?? 'USD'
      let unavailableAr: string | null = row ? null : 'لم تعد متاحة'
      try {
        const q = await new CommerceService(this.prisma).preview(null, [g.cohortId])
        const item = q.items.find((i) => i.cohortId === g.cohortId)
        listPrice = item?.listPrice ?? 0
        currency = q.currency
        if (!item) unavailableAr = q.excluded[0]?.messageAr ?? 'لم تعد متاحة للشراء'
      } catch (e) {
        if (!(e instanceof AuthError)) throw e
        unavailableAr = e.messageAr
      }
      const lead = row?.trainers.map((t) => t.profile).find(trainerPubliclyVisible)
      gift = {
        courseId: g.courseId, cohortId: g.cohortId,
        titleAr: row?.course.versions[0]?.titleAr ?? g.courseId,
        trainerName: lead ? lead.application.fullName : null,
        firstSessionAt: row?.sessions[0]?.startsAt ?? row?.startsAt ?? null,
        listPrice, currency, rule: g.rule, minCourses: g.minCourses, unavailableAr,
      }
    }

    return {
      code,
      gift,
      firstName: p.firstName,
      nameAr,
      profile: { workField: lead?.workField ?? null, careerLevel: lead?.careerLevel ?? null },
      courses,
      price: preview && courses.length > 0 && opts.priced !== false ? privatePathPrice(preview) : null,
      lastDay: opts.priced === false ? null : lastDay,
      couponCode,
      unavailable,
      coursesLeft,
      grantCourseIds,
      buyLinkToken: p.token || null,
      ...(opts.keepCode || opts.campaign ? { priceProblemAr: preview?.couponError?.messageAr ?? null } : {}),
    }
  }
}

const campaignOpen = (c: { active: boolean; closesAt: Date | null }, now: Date) => c.active && (c.closesAt === null || c.closesAt > now)

/* ═══ سعرُ الزائر في المسار العامّ — بنسبة حملته الآن، بلا كود (٢٣ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «They should see everything». فالزائرُ بلا حساب يرى السعرَ كما سيدفعه بكودها: المعاينةُ نفسُها بلا كود
   (`CommerceService.preview` — ما يُشترى وما استُبعد وسعرُ القائمة)، ثمّ `priceCart` نفسُه الذي يكتب به الدفعُ الفاتورة بنسبة
   الحملة بدلَ الباقة (كما يقع كودُ المنحة، `replacesBundle`). ولا كودَ يُخترع ولا يُكتب شيء: الكودُ يُعطى بعد الدخول
   (`publicPathCode`)، والدفعُ يسعّر من جديد به. وما فوق حدّ دورات الحملة يُقال سببُه ويُعرض بلا منحة — كما يقول الكودُ نفسُه.
   والحملةُ المغلقةُ سعرُها بلا منحة. وبه تُسعَّر الصفحةُ أوّلَ ما تُفتح، وكلُّ اختيارٍ بعده (`/api/public/go/:code/preview`). */
export async function campaignPreview(prisma: PrismaClient, slug: CampaignSlug, cohortIds: string[], now = new Date()) {
  const { CommerceService } = await import('./commerce.service')
  const q = await new CommerceService(prisma).preview(null, cohortIds)
  const camp = await new GrantService(prisma, slug).campaign()
  if (!campaignOpen(camp, now)) return q
  const pricing = priceCart(
    q.items.map((i) => ({ cohortId: i.cohortId, courseId: i.courseId, titleAr: i.titleAr, listPrice: i.listPrice })),
    null, { percentOff: camp.percentOff, amountOff: null, replacesBundle: true }, q.currency,
  )
  if (pricing.grantBeaten) return q
  if (pricing.paidCount > camp.maxCourses) {
    return { ...q, couponError: { code: 'grant_max_courses', messageAr: grantMaxCoursesAr(camp.maxCourses) } }
  }
  return {
    ...q,
    subtotal: pricing.subtotal, listTotal: pricing.listTotal, bundlePct: pricing.bundlePct, bundleDiscount: pricing.bundleDiscount,
    capDiscount: pricing.capDiscount, planCredit: pricing.planCredit, couponDiscount: pricing.couponDiscount,
    discount: pricing.discount, total: pricing.total,
    grantPct: camp.percentOff as number | null, grantNameAr: grantTitleAr(camp, null) as string | null,
    items: pricing.lines.map((l) => ({
      cohortId: l.cohortId, courseId: l.courseId, titleAr: l.titleAr, listPrice: l.listPrice, unitPrice: l.unitPrice, isGift: l.isGift, couponApplies: l.couponApplies,
    })),
  }
}

/* ═══ كودُ منحته في المسار العامّ — وإن لم يكن له أُعطي فورا (٢٢ نوفمبر ٢٠٢٦، «Give code instantly») ═══
   · **الحملةُ مغلقة**: لا كود، ويُقال «المنحة مغلقة الآن».
   · **اشترى بكود هذه الحملة قبلُ**: هو كودُه ما بقي عليه — وحدُّه باقٍ، فإن لم يبقَ عليه شيءٌ قيل السبب.
   · **واشترى بمنحةٍ غيرِها يأخذ كودَها على كلّ حال** — قرارُ صاحب المنصّة (٢٣ نوفمبر ٢٠٢٦): «They get 80% anyway, even if their
     code is linked to another grant»، نسخا لـ«كودُه ذاك، ولا كودَ جديد». فيُعطى كودَها من نموذجٍ بقناة المسار (`go`) — وهو وحدَه
     يتجاوز «منحةٌ واحدةٌ لكلّ متعلّم» (`grantOnceExempt`)، فلا يُعطى كودَ نموذجٍ آخرَ يردّه الدفع.
   · **له كودُ هذه الحملة** ببريد حسابه: هو نفسُه.
   · **وإلّا يُعطى كودَها على حسابه**: نموذجٌ في الحملة باسم حسابه وبريده وبلا هاتف (يُنشأ مرّةً تحت قفلٍ بالبريد، فلا
     تُنشئ نقرتان نموذجين)، ثمّ `GrantService.issue` نفسُه بعدِّه ونسبتِه وأثرِه (`coupon.grant_issue`). ويُكتب أثرُ النموذج
     (`coupon.grant_apply`) باسم صاحب الحساب ومن أين جاء. */
export async function publicPathCode(
  prisma: PrismaClient, slug: CampaignSlug, userId: string, now = new Date(),
): Promise<{ code: string | null; noteAr: string | null }> {
  const grants = new GrantService(prisma, slug)
  const camp = await grants.campaign()
  if (!campaignOpen(camp, now)) return { code: null, noteAr: GRANT_CLOSED_AR }
  const used = await prisma.order.findMany({
    where: { userId, status: { in: GRANT_HOLDS }, coupon: { grantCode: { isNot: null } } },
    orderBy: { createdAt: 'desc' },
    select: { coupon: { select: { id: true, code: true, usedCount: true, maxUses: true, grantCode: { select: {
      campaign: { select: { id: true, slug: true, active: true, closesAt: true, maxCourses: true } },
    } } } } },
  })
  const own = used.map((o) => o.coupon).find((c) => c?.grantCode?.campaign.slug === slug)
  if (own?.grantCode) {
    return (await grants.coursesLeft(own)) > 0
      ? { code: own.code, noteAr: null }
      : { code: null, noteAr: grantUsedUpAr(own.grantCode.campaign.maxCourses) }
  }
  const usedOther = used.length > 0
  const mine: { code: string | null } = usedOther ? { code: null } : await learnerGrant(prisma, userId, now)
  if (mine.code) {
    const of = await prisma.coupon.findUnique({ where: { code: mine.code }, select: { grantCode: { select: { campaign: { select: { slug: true } } } } } })
    if (of?.grantCode?.campaign.slug === slug) return { code: mine.code, noteAr: null }
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } })
  const email = user?.email?.trim().toLowerCase()
  if (!email) return { code: mine.code, noteAr: null }
  const leadId = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`public-path:${slug}:${email}`}))`
    /* ومن اشترى بمنحةٍ غيرِها: نموذجُ المسار وحدَه — فكودُ نموذجٍ آخرَ في الحملة يردّه «منحةٌ واحدة» */
    const had = await tx.lead.findFirst({
      where: { campaign: slug, erasedAt: null, email, ...(usedOther ? { channel: PUBLIC_PATH_LEAD_CHANNEL } : {}) },
      orderBy: { createdAt: 'asc' }, select: { id: true },
    })
    if (had) return had.id
    const lead = await tx.lead.create({
      data: { fullName: user?.displayName?.trim() || email, email, phone: null, source: 'campaign', campaign: slug, channel: PUBLIC_PATH_LEAD_CHANNEL, userId },
    })
    await recordAudit(tx, {
      action: 'coupon.grant_apply', entityType: 'lead', entityId: lead.id, actorId: userId,
      meta: { leadId: lead.id, campaign: slug, via: 'public_path', channel: PUBLIC_PATH_LEAD_CHANNEL },
    })
    return lead.id
  })
  try {
    const g = await grants.issue({ leadId }, now)
    return { code: g.code, noteAr: null }
  } catch (e) {
    if (!(e instanceof AuthError) || !['grant_closed', 'grant_sold_out'].includes(e.code)) throw e
    return { code: mine.code, noteAr: mine.code ? null : e.messageAr }
  }
}
