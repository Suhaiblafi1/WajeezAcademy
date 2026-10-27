/* كودُ «شارك دوراتك» — يُنشأ للمدرّب أوّلَ مرّةٍ يطلبه ويُعاد كما هو. والعلّةُ في `src/application/trainer/share-code.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import { shortLinkPath } from '../../src/application/links/short-link'
import { SHARE_CODE_PERCENT, SHARE_CODE_PREFIX, SHARE_CODE_TAIL } from '../../src/application/trainer/share-code'
import { photoPublicUrl } from './storage.service'
import { ReferralService } from './referral.service'
import { ShortLinkService } from './short-link.service'
import { isJpeg, PREVIEW_MAX_BYTES, previewCopy } from './link-preview'
import { reachOf, type LinkReach } from './link-opens'
import { bestCode } from '../../src/application/trainer/share-kit'
import { leadCohortsOf } from './cohort-lead'

export interface ShareCode { code: string; percentOff: number }

/** ما يُصمَّم منه المنشور: وجهُه، وكودُنا، وأكوادُه القائمةُ بالنسبة — ليظهر أعلاها (`bestCode`) */
export interface ShareKit extends ShareCode {
  name: string
  headline: string | null
  /** صورتُه المعتمدة من مسار المنصّة نفسِها — فتُرسم في المتصفّح بلا حاجزِ مصدر */
  photoUrl: string | null
  hisCodes: { code: string; percentOff: number | null }[]
  /** روابطُه قصيرةً — `‎/s/XXXXXX` بدل «‎/t/صهيب-احمد-لافي» المرمَّز في لينكدإن: رابطُه العامّ، ولكلّ شعبةٍ رابطُها */
  short: { wide: string | null; cohorts: Record<string, string> }
  /** بصمةُ معاينة كلّ رابطٍ قصيرٍ برمزه — وما لا معاينةَ له `null` فترسمها صفحتُه وترفعها (`link-preview.ts`) */
  previews: Record<string, string | null>
  /** ما بلغه كلُّ رابطٍ قصيرٍ برمزه: كم فُتح ومن أيّ منصّة، وكم سجّل منه (`link-opens.ts`) */
  reach: Record<string, LinkReach>
  /** أتمّ شعبةً من قبل — فنشرُه يُفتح على «دعوة لدوراتي» لا «إعلان انضمامي» (`modeFor`) */
  taughtBefore: boolean
}

/** رابطٌ من روابطه القصيرة، والدوراتُ التي يدعو إليها */
interface MyLink { url: string; code: string; refCode: string; courses: { courseTitle: string; startsAt: string | null }[] }

/** غرضُ روابط «شارك دوراتك» القصيرة — به يُعاد ما سُكّ */
export const SHORT_PURPOSE = 'share-kit'

export class TrainerShareCodeService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  /** عُدّةُ المشاركة: كودُنا ووجهُه وأكوادُه القائمة */
  async kit(userId: string): Promise<ShareKit> {
    const ours = await this.mine(userId)
    const profile = await this.prisma.trainerProfile.findUniqueOrThrow({
      where: { userId },
      select: {
        id: true, headline: true, photoUrl: true, application: { select: { fullName: true } },
        codes: { where: { status: 'live', coupon: { active: true } }, select: { percentOff: true, coupon: { select: { code: true } } } },
      },
    })
    const links = await this.myLinks(userId)
    const cohorts: Record<string, string> = {}
    for (const [id, l] of Object.entries(links.cohorts)) cohorts[id] = l.url
    const all = [links.wide, ...Object.values(links.cohorts)].filter((l): l is MyLink => l !== null)
    const rows = await this.prisma.shortLink.findMany({ where: { code: { in: all.map((l) => l.code) } }, select: { code: true, previewSig: true } })
    return {
      ...ours,
      short: { wide: links.wide?.url ?? null, cohorts },
      previews: Object.fromEntries(rows.map((r) => [r.code, r.previewSig])),
      reach: await reachOf(this.prisma, all),
      name: profile.application.fullName,
      headline: profile.headline,
      photoUrl: photoPublicUrl(profile.photoUrl),
      hisCodes: profile.codes.map((c) => ({ code: c.coupon.code, percentOff: c.percentOff })),
      taughtBefore: (await leadCohortsOf(this.prisma, profile.id, ['completed'])).length > 0,
    }
  }

  /* ═══ والرابطُ قصيرٌ يُقرأ (٢٦ أكتوبر ٢٠٢٦) ═══
     «لا تبدو احترافيّة.. يجب أن تكون سهلةَ القراءة» — وكان الرابطُ العامُّ اسمَه بالعربيّة، يصير في لينكدإن
     وفيسبوك حروفا مرمّزةً تملأ سطرين. فلكلّ رابطٍ قصيرٌ ثابت: يُسكّ مرّةً ويُعاد، فما نُشر لا يتغيّر. */
  private async myLinks(userId: string): Promise<{ wide: MyLink | null; cohorts: Record<string, MyLink> }> {
    const referrals = new ReferralService(this.prisma)
    const [wide, cohortLinks] = await Promise.all([
      referrals.wideLinkFor(userId).catch(() => null),
      referrals.cohortLinksFor(userId).catch(() => []),
    ])
    const link = async (url: string, refCode: string, courses: MyLink['courses']): Promise<MyLink> => {
      const short = await this.shortOf(url, userId)
      return { url: short, code: new URL(short).pathname.split('/').pop() ?? '', refCode, courses }
    }
    const cohorts: Record<string, MyLink> = {}
    for (const c of cohortLinks) cohorts[c.cohortId] = await link(c.url, c.code, [{ courseTitle: c.courseTitle, startsAt: c.startsAt }])
    const everything = cohortLinks.map((c) => ({ courseTitle: c.courseTitle, startsAt: c.startsAt }))
    return { wide: wide?.publicReady ? await link(wide.url, wide.code, everything) : null, cohorts }
  }

  /** معاينةُ رابطٍ من روابطه — صورتُه كما رسمتها صفحتُه، والعنوانُ والوصفُ من دوراته هنا */
  async savePreview(userId: string, code: string, image: Buffer, sig: string): Promise<void> {
    if (!isJpeg(image) || image.length > PREVIEW_MAX_BYTES) {
      throw new AuthError('bad_preview', 'صورة المعاينة ليست JPEG أو أكبر من المسموح', 400)
    }
    const kit = await this.kit(userId)
    const links = await this.myLinks(userId)
    const hit = [links.wide, ...Object.values(links.cohorts)].find((l) => l?.code === code)
    if (!hit) throw new AuthError('not_found', 'لا رابط بهذا الرمز لك', 404)
    const copy = previewCopy({
      name: kit.name, courses: hit.courses, wide: hit === links.wide,
      code: bestCode({ code: kit.code, percentOff: kit.percentOff }, kit.hisCodes),
    })
    await this.prisma.shortLink.update({
      where: { code },
      data: { previewImage: new Uint8Array(image), previewTitle: copy.title, previewText: copy.text, previewSig: sig.slice(0, 64), previewAt: new Date() },
    })
  }

  /** رابطٌ قصيرٌ ثابتٌ لعنوانٍ من عناويننا — يُعاد إن سُكّ له من قبل */
  private async shortOf(url: string, userId: string): Promise<string> {
    const u = new URL(url)
    const target = `${u.pathname}${u.search}`
    const have = await this.prisma.shortLink.findFirst({ where: { target, purpose: SHORT_PURPOSE, revokedAt: null }, select: { code: true } })
    if (have) return `${u.origin}${shortLinkPath(have.code)}`
    return (await new ShortLinkService(this.prisma).mint(target, userId, SHORT_PURPOSE)).url
  }

  /** كودُه — يُنشأ مرّةً ثمّ يُعاد. والموقوفُ لا يُعطى كودا */
  async mine(userId: string): Promise<ShareCode> {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true, suspendedAt: true } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const have = await this.prisma.trainerShareCode.findUnique({
      where: { profileId: profile.id }, select: { coupon: { select: { code: true, percentOff: true } } },
    })
    if (have) return { code: have.coupon.code, percentOff: have.coupon.percentOff ?? SHARE_CODE_PERCENT }
    /* والرمزُ عشوائيٌّ فقد يصطدم بكوبونٍ قائم — يُعاد بغيره، والقيدُ الفريدُ هو الحكم */
    for (let i = 0; i < 5; i++) {
      const code = `${SHARE_CODE_PREFIX}${randomUnambiguousCode(SHARE_CODE_TAIL)}`
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const coupon = await tx.coupon.create({ data: { code, percentOff: SHARE_CODE_PERCENT } })
          await tx.trainerShareCode.create({ data: { profileId: profile.id, couponId: coupon.id } })
          return coupon
        })
        await recordAudit(this.prisma, {
          actorId: userId, action: 'referral.share_code.create', entityType: 'trainer_profile', entityId: profile.id,
          meta: { code: row.code, percentOff: SHARE_CODE_PERCENT },
        })
        return { code: row.code, percentOff: SHARE_CODE_PERCENT }
      } catch (e) {
        /* طلبان معا للمدرّب نفسِه: سبق أحدُهما، فيُقرأ ما كتبه */
        const raced = await this.prisma.trainerShareCode.findUnique({
          where: { profileId: profile.id }, select: { coupon: { select: { code: true, percentOff: true } } },
        })
        if (raced) return { code: raced.coupon.code, percentOff: raced.coupon.percentOff ?? SHARE_CODE_PERCENT }
        if (i === 4) throw e
      }
    }
    throw new AuthError('share_code_failed', 'تعذر إنشاء الكود — أعد المحاولة', 500)
  }
}
