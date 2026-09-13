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
     وتغييرُه بعد الدفع بابُ نزاع.

   ═══ الرابطُ الواسع (١٣ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أتِح للمدرّب رابطَ دعوةٍ لكافّة دوراته وليس لدورةٍ
   دورة»، و«يظهر مسارٌ باسم المدرّب للعامّة في الرابط ليسجّلوا فيه». فللمدرّب
   رمزٌ واحدٌ لا يخصّ شعبةً (`cohortId = null`) وصفحةٌ عامّةٌ باسمه.

   والقاعدةُ الثانيةُ أعلاه تبقى كما هي بلا توسيعٍ في الأثر: الرابطُ الواسع
   يُقبل على **ما يدرّبه صاحبُه** من سلّة الشراء لا على كلّ ما فيها. فمن
   اشترى شعبتَه وشعبةَ غيرِه في طلبٍ واحدٍ يُحسب له ما درّبه وحدَه. */

import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { slugifyName, uniqueSlug } from '../../src/application/trainer/public-slug'
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

  /* ─────────── الرابطُ الواسع ─────────── */

  /** ملفُّ المدرّب النشِط — أو خطأٌ صريح */
  private async activeProfile(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      include: { application: { select: { fullName: true } } },
    })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    return profile
  }

  /**
   * مسارُه في العنوان — يُشتقّ مرّةً ويبقى.
   *
   * والمأخوذُ يُقرأ من الجدول لحظةَ الاشتقاق، فقد يتسابق اثنان على اسمٍ
   * واحد. ولذلك الكتابةُ تُعاد عند اصطدام الفرادة: الخاسرُ يشتقّ ثانيةً
   * فيجد اسمَ الرابح مأخوذا ويأخذ ما بعده.
   */
  private async ensureSlug(profile: { id: string; publicSlug: string | null; application: { fullName: string } }): Promise<string> {
    if (profile.publicSlug) return profile.publicSlug
    const base = slugifyName(profile.application.fullName)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rows = await this.prisma.trainerProfile.findMany({
        where: { publicSlug: { not: null } }, select: { publicSlug: true },
      })
      const taken = new Set(rows.map((r) => r.publicSlug as string))
      /* اسمٌ لا يبقى منه حرفٌ صالحٌ لا يُترك بلا مسار: الرمزُ بديلُه. */
      const slug = uniqueSlug(base ?? newCode().toLowerCase(), taken)
      try {
        await this.prisma.trainerProfile.update({ where: { id: profile.id }, data: { publicSlug: slug } })
        return slug
      } catch {
        const again = await this.prisma.trainerProfile.findUnique({ where: { id: profile.id }, select: { publicSlug: true } })
        if (again?.publicSlug) return again.publicSlug
      }
    }
    throw new AuthError('slug_conflict', 'تعذّر اشتقاقُ مسارٍ عامٍّ لاسمك — راجِع الإدارة', 409)
  }

  /** رابطُ المدرّب على كامل ما يدرّب — ومعه مسارُه العامّ وحالةُ ظهوره */
  async wideLinkFor(userId: string): Promise<{ code: string; slug: string; url: string; publicReady: boolean }> {
    const profile = await this.activeProfile(userId)
    const slug = await this.ensureSlug(profile)

    let row = await this.prisma.trainerReferralLink.findFirst({ where: { profileId: profile.id, cohortId: null } })
    if (!row) {
      row = await this.prisma.trainerReferralLink.create({ data: { cohortId: null, profileId: profile.id, code: newCode() } })
      await recordAudit(this.prisma, {
        actorId: userId, action: 'referral.link.create', entityType: 'trainer_profile', entityId: profile.id, meta: { code: row.code, scope: 'wide', slug },
      })
    }
    return {
      code: row.code,
      slug,
      url: `${publicSiteUrl()}/t/${encodeURIComponent(slug)}`,
      /* البوّابةُ الواحدة (`trainer-visibility.ts`): صفحتُه لا تُعرض قبل
         اعتماد نشر ملفّه — فالرابطُ يُعطى ويُقال متى يعمل، لا يُخفى. */
      publicReady: profile.publicVisibility && profile.isVerified && profile.publishApprovedAt !== null,
    }
  }

  /**
   * كم سجّل عبر روابطه — الواسعِ وروابطِ الشعب معا.
   *
   * والعدُّ على الختم في التسجيل (`referralProfileId`) لا على النقرات: هو
   * الرقمُ الذي يُدفع عليه، فلا يُعرض للمدرّب رقمٌ أكبرُ منه.
   */
  async reachOf(userId: string): Promise<{ registered: number }> {
    const profile = await this.activeProfile(userId)
    const registered = await this.prisma.enrollment.count({
      where: { referralProfileId: profile.id, status: { not: 'dropped' } },
    })
    return { registered }
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
    /* الرابطُ الواسعُ يُقبل على ما يدرّبه صاحبُه من السلّة وحدَه — لا على
       كلّ ما فيها. والأوّلُ بترتيب السلّة حين درّب أكثرَ من واحدة. */
    if (link.cohortId === null) {
      const mine = await this.prisma.cohortTrainer.findMany({
        where: { profileId: link.profileId, cohortId: { in: cohortIds } },
        select: { cohortId: true },
      })
      const owned = new Set(mine.map((m) => m.cohortId))
      const hit = cohortIds.find((id) => owned.has(id)) ?? null
      if (!hit) {
        await recordAudit(this.prisma, { actorId: userId, action: 'checkout.referral_ignored', entityType: 'user', entityId: userId, meta: { code, reason: 'not_his_cohort' } })
        return null
      }
      return { cohortId: hit, code: link.code }
    }
    if (!cohortIds.includes(link.cohortId)) {
      await recordAudit(this.prisma, { actorId: userId, action: 'checkout.referral_ignored', entityType: 'user', entityId: userId, meta: { code, reason: 'other_cohort', cohortId: link.cohortId } })
      return null
    }
    return { cohortId: link.cohortId, code: link.code }
  }
}
