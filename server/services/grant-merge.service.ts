/* «منحة وجيز» و«منحة وجيز العامة» تصيران «بلاك فرايدي وجيز» بسبعين بالمئة — لكلّ من أخذ كودا فيهما (١٦ نوفمبر ٢٠٢٦).

   ═══ القرار ═══

   قال صاحبُ المنصّة: «اريد ان تتحول منحة وجيز ٦٠٪ الى بلاك فرايدي وتتغير لكل طالب لديه كود فيها، ويصبح رابطه يعكس البلاك
   فرايدي لو فتح الرابط نفسه القديم بنفس الكود… وايضا منحة وجيز العامة تتغير كلها وتصبح ٧٠٪ ك بلاك فرايدي». وسُئل عن أكواد
   بلاك فرايدي التي أُعطيت بـ٨٠٪، فاختار **«Lower them to 70%: one discount for everyone»** مع بريدٍ قصيرٍ يشرح. وقال: «delete all
   influencers links.. we are not going to use it for now, but keep the option to the admin to add later».

   ═══ ما يقع — مرّةً واحدة، بأثرٍ يقول كم ═══

   ١) **عملاءُ الحملتين وأكوادُهما ينتقلون إلى بلاك فرايدي**: `Lead.campaign` و`GrantCode.campaignId` — فالكودُ نفسُه، ومن عبّأ
      نموذجَ بلاك فرايدي ببريده أو رقمه يجد كودَه (`apply` يقرأ عميلَ الحملة)، ونهايتُه وحدُّ دوراته نهايةُ بلاك فرايدي وحدُّها.
   ٢) **وكلُّ كودٍ في بلاك فرايدي بـ٧٠٪** — ما كان ٦٠ أو ٥٠ يرتفع، وما كان ٨٠ ينزل (`Coupon.percentOff`)، ونسبةُ الحملة ٧٠.
      وبريدٌ لمن نزل كودُه يقول ذلك — بقالب الأكاديمية، ولو ألغى رسائلَ التسويق: هو تغييرٌ في منحته لا تسويق.
   ٣) **والحملتان القديمتان تُوقفان** — لا كودَ فيهما بعدُ، وصفحتاهما تفتحان بلاك فرايدي (`App.tsx`).
   ٤) **والمؤثّرون كلُّهم يُوقفون** — لا يُعطى بكودهم كودٌ جديد، وملفّاتُهم وكشوفُهم وما أُعطي قبلُ باقٍ، والمديرُ يعيدهم أو
      يضيف غيرَهم متى شاء. ولا يمسّ ذلك ما استحقّوه عن أكوادٍ أُعطيت قبله.

   والحارس: `server/tests/commerce/grant-merge.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { publicSiteUrl } from './site-url'
import {
  BLACK_FRIDAY_GRANT_NAME_AR, BLACK_FRIDAY_GRANT_PATH, BLACK_FRIDAY_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG,
} from '../../src/application/commerce/grant'

/** نسبةُ بلاك فرايدي لكلّ كود — قرارُ صاحب المنصّة (١٦ نوفمبر ٢٠٢٦) */
export const BLACK_FRIDAY_MERGE_PERCENT = 70
export const BLACK_FRIDAY_MERGE_REASON = 'قرار صاحب المنصة (16 نوفمبر 2026): منحة وجيز والعامة تصيران بلاك فرايدي بـ70% لكل كود، ويوقف المؤثرون'
const MERGED = [MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG] as const

export async function applyBlackFridayMerge(prisma: PrismaClient): Promise<{ moved: number; lowered: number; raised: number } | null> {
  /* ولا تُنقل الأكوادُ إلّا إلى بلاك فرايدي مشغَّلة — وإلّا صارت أكوادا لا تُستعمل */
  const bf = await prisma.grantCampaign.findUnique({ where: { slug: BLACK_FRIDAY_GRANT_SLUG }, select: { id: true, active: true } })
  if (!bf?.active) return null
  const done = await prisma.auditEvent.count({
    where: { action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: bf.id, actorId: null, reason: BLACK_FRIDAY_MERGE_REASON },
  })
  if (done > 0) return null
  const old = await prisma.grantCampaign.findMany({ where: { slug: { in: [...MERGED] } }, select: { id: true, slug: true } })
  const oldIds = old.map((c) => c.id)

  const result = await prisma.$transaction(async (tx) => {
    const movedCodes = await tx.grantCode.updateMany({ where: { campaignId: { in: oldIds } }, data: { campaignId: bf.id } })
    await tx.lead.updateMany({ where: { campaign: { in: [...MERGED] } }, data: { campaign: BLACK_FRIDAY_GRANT_SLUG } })
    /* من نزل كودُه — يُقال له بريدا */
    const lowered = await tx.grantCode.findMany({
      where: { campaignId: bf.id, coupon: { percentOff: { gt: BLACK_FRIDAY_MERGE_PERCENT } } },
      select: { lead: { select: { id: true, fullName: true, email: true, erasedAt: true } }, coupon: { select: { code: true, percentOff: true } } },
    })
    const raised = await tx.coupon.updateMany({
      where: { grantCode: { campaignId: bf.id }, OR: [{ percentOff: { lt: BLACK_FRIDAY_MERGE_PERCENT } }, { percentOff: null }] },
      data: { percentOff: BLACK_FRIDAY_MERGE_PERCENT },
    })
    await tx.coupon.updateMany({
      where: { grantCode: { campaignId: bf.id }, percentOff: { gt: BLACK_FRIDAY_MERGE_PERCENT } },
      data: { percentOff: BLACK_FRIDAY_MERGE_PERCENT },
    })
    await tx.grantCampaign.update({ where: { id: bf.id }, data: { percentOff: BLACK_FRIDAY_MERGE_PERCENT } })
    await tx.grantCampaign.updateMany({ where: { id: { in: oldIds } }, data: { active: false } })
    const influencers = await tx.influencer.updateMany({ where: { active: true }, data: { active: false } })
    const site = publicSiteUrl()
    let mailed = 0
    for (const g of lowered) {
      const to = g.lead?.email
      if (!to || g.lead?.erasedAt) continue
      const subject = `تحديث منحتك: ${BLACK_FRIDAY_GRANT_NAME_AR} بخصم ${BLACK_FRIDAY_MERGE_PERCENT}%`
      await enqueueMail(tx, {
        to, purpose: 'grant.notice', subject,
        ...renderMail({
          greetingName: g.lead?.fullName ?? undefined,
          heading: subject,
          preheader: `كودك ${g.coupon.code} يعمل بخصم ${BLACK_FRIDAY_MERGE_PERCENT}% على كل الدورات.`,
          blocks: [
            { kind: 'p', text: `وحدنا خصم ${BLACK_FRIDAY_GRANT_NAME_AR} لكل المشتركين، فصار ${BLACK_FRIDAY_MERGE_PERCENT}% بدل ${g.coupon.percentOff}% الذي وصلك في بريدنا السابق. نعتذر عن هذا التغيير.` },
            { kind: 'p', text: 'كودك هو نفسه، ويطبق وحده عند الشراء من حسابك.' },
            { kind: 'facts', rows: [{ label: 'كود منحتك', value: g.coupon.code }, { label: 'الخصم', value: `${BLACK_FRIDAY_MERGE_PERCENT}%` }] },
            { kind: 'cta', label: 'اختر دوراتك', href: `${site}${BLACK_FRIDAY_GRANT_PATH}` },
          ],
        }),
      })
      mailed += 1
    }
    const meta = {
      moved: movedCodes.count, lowered: lowered.length, raised: raised.count, mailed,
      influencersStopped: influencers.count, from: [...MERGED], percentOff: BLACK_FRIDAY_MERGE_PERCENT,
    }
    await recordAudit(tx, {
      actorId: null, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: bf.id,
      reason: BLACK_FRIDAY_MERGE_REASON, after: { percentOff: BLACK_FRIDAY_MERGE_PERCENT }, meta,
    })
    return { moved: movedCodes.count, lowered: lowered.length, raised: raised.count }
  })
  return result
}
