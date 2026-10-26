/* كودُ «شارك دوراتك» — يُنشأ للمدرّب أوّلَ مرّةٍ يطلبه ويُعاد كما هو. والعلّةُ في `src/application/trainer/share-code.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import { SHARE_CODE_PERCENT, SHARE_CODE_PREFIX, SHARE_CODE_TAIL } from '../../src/application/trainer/share-code'
import { photoPublicUrl } from './storage.service'

export interface ShareCode { code: string; percentOff: number }

/** ما يُصمَّم منه المنشور: وجهُه، وكودُنا، وأكوادُه القائمةُ بالنسبة — ليظهر أعلاها (`bestCode`) */
export interface ShareKit extends ShareCode {
  name: string
  headline: string | null
  /** صورتُه المعتمدة من مسار المنصّة نفسِها — فتُرسم في المتصفّح بلا حاجزِ مصدر */
  photoUrl: string | null
  hisCodes: { code: string; percentOff: number | null }[]
}

export class TrainerShareCodeService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  /** عُدّةُ المشاركة: كودُنا ووجهُه وأكوادُه القائمة */
  async kit(userId: string): Promise<ShareKit> {
    const ours = await this.mine(userId)
    const profile = await this.prisma.trainerProfile.findUniqueOrThrow({
      where: { userId },
      select: {
        headline: true, photoUrl: true, application: { select: { fullName: true } },
        codes: { where: { status: 'live', coupon: { active: true } }, select: { percentOff: true, coupon: { select: { code: true } } } },
      },
    })
    return {
      ...ours,
      name: profile.application.fullName,
      headline: profile.headline,
      photoUrl: photoPublicUrl(profile.photoUrl),
      hisCodes: profile.codes.map((c) => ({ code: c.coupon.code, percentOff: c.percentOff })),
    }
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
