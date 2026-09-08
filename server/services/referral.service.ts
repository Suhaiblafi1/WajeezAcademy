/* رابطُ دعوةِ المدرّب — من سجّل به يُحسب له بأجرٍ مختلف.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): لكلّ شعبةٍ رابطٌ للمدرّب ينشره في صفحاته،
   وكلُّ من سجّل منه يُعدّ له. والسعرُ على الطالب **واحد** من أيّ طريق؛ ما يتغيّر
   أجرُ المدرّب عن المقعد: `rate` للعامّ و`referralRate` لمن جاء برابطه. ويرى
   من جاء برابطه بعلامةٍ عند اسمه — «ليتأكّد أنّنا لم نغشّ».

   ═══ ثلاثةُ قرارات ═══

   • الرمزُ يُنشأ مرّةً ويبقى: لو تغيّر ضاع ما نُشر على وسائط التواصل.
   • رمزٌ لا يخصّ الشعبةَ المشتراة **يُهمَل ولا يُوقف الدفع**: خطأٌ في نسخ
     الرابط لا يستحقّ أن يضيع بيعٌ بسببه. ويُقيَّد أثرٌ ليُرى إن تكرّر.
   • المصدرُ يُختم على التسجيل عند التسوية ولا يُغيَّر بعدها: هو حجّةُ الأجر،
     وتغييرُه بعد الدفع بابُ نزاع. */

import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { publicSiteUrl } from './notification.service'

/** رمزٌ يُقرأ ويُنسخ: ثمانيةُ أحرفٍ من أبجديّةٍ بلا التباس (لا 0/O ولا 1/I) */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newCode(): string {
  const bytes = randomBytes(8)
  let out = 'WJ-'
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

export class ReferralService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  /** رابطُ المدرّب لشعبته — يُنشأ أوّلَ مرّةٍ ثمّ يُعاد كما هو */
  async linkFor(userId: string, cohortId: string): Promise<{ code: string; url: string }> {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const link = await this.prisma.cohortTrainer.findFirst({ where: { cohortId, profileId: profile.id } })
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { courseId: true } })

    let row = await this.prisma.trainerReferralLink.findUnique({ where: { cohortId_profileId: { cohortId, profileId: profile.id } } })
    if (!row) {
      row = await this.prisma.trainerReferralLink.create({ data: { cohortId, profileId: profile.id, code: newCode() } })
      await recordAudit(this.prisma, {
        actorId: userId, action: 'referral.link.create', entityType: 'cohort', entityId: cohortId, meta: { code: row.code },
      })
    }
    return { code: row.code, url: `${publicSiteUrl()}/build/${cohort.courseId}?ref=${encodeURIComponent(row.code)}` }
  }

  /** الرمزُ إلى شعبته ومدرّبه — أو لا شيء */
  async resolve(code: string | null | undefined) {
    const c = code?.trim()
    if (!c) return null
    return this.prisma.trainerReferralLink.findUnique({ where: { code: c }, select: { cohortId: true, profileId: true, code: true } })
  }

  /** عند الدفع: الرمزُ يُقبل إن خصّ شعبةً من المشتراة — وإلّا يُهمَل بأثرٍ لا بخطأ */
  async acceptAtCheckout(userId: string, cohortIds: string[], code: string | null | undefined): Promise<{ cohortId: string; code: string } | null> {
    const link = await this.resolve(code)
    if (!link) {
      if (code?.trim()) {
        await recordAudit(this.prisma, { actorId: userId, action: 'checkout.referral_ignored', entityType: 'user', entityId: userId, meta: { code, reason: 'unknown' } })
      }
      return null
    }
    if (!cohortIds.includes(link.cohortId)) {
      await recordAudit(this.prisma, { actorId: userId, action: 'checkout.referral_ignored', entityType: 'user', entityId: userId, meta: { code, reason: 'other_cohort', cohortId: link.cohortId } })
      return null
    }
    return { cohortId: link.cohortId, code: link.code }
  }
}
