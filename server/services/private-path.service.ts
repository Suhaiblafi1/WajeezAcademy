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
import { TRAINER_VISIBILITY_SELECT, trainerPubliclyVisible } from './trainer-visibility'
import { PUBLIC_SESSION_WHERE } from './public-catalog.service'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import {
  GO_CODE_LENGTH, GO_CODE_RE, PRIVATE_PATH_PURPOSE, goPath, privatePathPrice, type PrivatePathPayload,
} from '../../src/application/commerce/private-path'
import { grantLastDay } from '../../src/application/commerce/grant'

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
    total: number
  } | null
  /** آخرُ يومٍ للمنحة أو الكود — بتوقيت عمّان (`grantLastDay`) */
  lastDay: string | null
  couponCode: string | null
  /** ما سقط من المسار ولا يُشترى الآن — بسببه */
  unavailable: { titleAr: string; reasonAr: string }[]
  /** يُرسَل مع الشراء فيُنسب الطلبُ إلى من ولّد الرابط (`buyLinkForOrder`) */
  buyLinkToken: string
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
      preview = await new CommerceService(this.prisma).preview(null, cohortIds, p.code ?? undefined)
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
    const couponCode = preview && !preview.couponError ? preview.couponCode : null
    if (couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: couponCode },
        select: { expiresAt: true, grantCode: { select: { campaign: { select: { closesAt: true } } } } },
      })
      const ends = coupon?.grantCode?.campaign.closesAt ?? coupon?.expiresAt ?? null
      lastDay = ends ? grantLastDay(ends) : null
    }

    /* ومجالُ عمله ومستواه من نموذجه — بحسابه أو بنموذجه (`learnerKey`)، وأحدثُ نموذجٍ له إن تعدّد */
    const [kind, id] = p.learnerKey.split(':')
    const lead = id && (kind === 'lead' || kind === 'user')
      ? await this.prisma.lead.findFirst({
        where: { erasedAt: null, ...(kind === 'lead' ? { id } : { userId: id }) },
        orderBy: { createdAt: 'desc' },
        select: { workField: true, careerLevel: true },
      }).catch(() => null)
      : null

    return {
      code,
      firstName: p.firstName,
      profile: { workField: lead?.workField ?? null, careerLevel: lead?.careerLevel ?? null },
      courses,
      price: preview && courses.length > 0 ? privatePathPrice(preview) : null,
      lastDay,
      couponCode,
      unavailable,
      buyLinkToken: p.token,
    }
  }
}
