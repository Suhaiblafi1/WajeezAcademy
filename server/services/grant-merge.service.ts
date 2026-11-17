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
import { GrantService } from './grant.service'
import { liveChannels } from './notification.service'
import { optedOut, unsubscribeLinks } from './mail-optout.service'
import { fmtDateLong } from '../../src/application/text/format-ar'
import {
  BLACK_FRIDAY_GRANT_NAME_AR, BLACK_FRIDAY_GRANT_PATH, BLACK_FRIDAY_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, grantCoursesAr,
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

/* ═══ وأكوادُ بلاك فرايدي تتبع نسبتَها — كلُّها، لا ما يُعطى بعد الحفظ وحدَه (١٧ نوفمبر ٢٠٢٦) ═══

   رفع صاحبُ المنصّة بلاك فرايدي إلى 80% من صفحتها، فبقي كلُّ من أخذ كودَه قبلُ — ومنهم كلُّ من انتقل إليها من «منحة وجيز»
   و«العامة» — على 70%، وقال: «but the discount is now 80%!! why you don't sync». فنسبةُ كلّ كودٍ فيها نسبتُها هي: تُكتب
   عند الحفظ (`GrantService.update`)، ويلحقها العاملُ كلَّ ساعةٍ لما سبق — رفعا أو خفضا. وما دُفع لا يُمسّ: الكوبونُ يقول
   سعرَ ما يُشترى به بعدُ، والطلبُ يحفظ سعرَه. وكلُّ مزامنةٍ غيّرت شيئا تُكتب أثرا بسببها. */
export const BLACK_FRIDAY_SYNC_REASON = 'قرار صاحب المنصة (17 نوفمبر 2026): كل أكواد بلاك فرايدي بنسبتها، لا ما يعطى بعد الحفظ وحده'

export async function syncBlackFridayCodes(prisma: PrismaClient, actorId: string | null = null): Promise<{ changed: number; percentOff: number } | null> {
  const bf = await prisma.grantCampaign.findUnique({ where: { slug: BLACK_FRIDAY_GRANT_SLUG }, select: { id: true, percentOff: true } })
  if (!bf) return null
  const out = await prisma.coupon.updateMany({
    where: { grantCode: { campaignId: bf.id }, OR: [{ percentOff: { not: bf.percentOff } }, { percentOff: null }] },
    data: { percentOff: bf.percentOff },
  })
  if (out.count > 0) {
    await recordAudit(prisma, {
      actorId, action: 'coupon.grant_settings', entityType: 'grant_campaign', entityId: bf.id,
      reason: BLACK_FRIDAY_SYNC_REASON, after: { percentOff: bf.percentOff }, meta: { codesSynced: out.count },
    })
  }
  return { changed: out.count, percentOff: bf.percentOff }
}

/* ═══ وبريدٌ لمن ارتفع كودُه إلى 70% — مرّةً، عصرَ ١٧ نوفمبر ٢٠٢٦ بتوقيت عمّان ═══

   قال صاحبُ المنصّة: «Yes send them tomorrow afternoon»، ووافق على نصّه بعد أن رآه، وقال في آخر يوم: «Keep 21 and tell them
   22nd the registration is fully closed until next semester! Hurry up and register now with biggest discount ever!». فيصل من
   كان كودُه في «منحة وجيز» (60%) أو «العامة» (50%) — يُعرف بأثر إعطائه (`coupon.grant_issue` بمعرّف حملته القديمة) — بنسبته
   القديمة في البريد، ويُعرف به من ذُكِّر (`coupon.grant_notice` بمرحلة `bf70`) فلا يصله ثانية. ولا يصل من ألغى رسائلَ التسويق،
   ولا من استعمل كودَه كلَّه، ولا يُكتب شيءٌ والبريدُ مفصول أو بلاك فرايدي مغلقة. */
/* الخامسةُ عصرا بتوقيت عمّان (كان الثالثة) — لتصل مزامنةُ الـ80% قبله فيقول البريدُ نسبتَه الصحيحة (١٧ نوفمبر ٢٠٢٦) */
export const BF_UPGRADE_SEND_AT = new Date('2026-11-17T14:00:00.000Z')
export const BF_UPGRADE_STAGE = 'bf70'

export async function sendBlackFridayUpgradeNotice(prisma: PrismaClient, now = new Date()): Promise<{ sent: number }> {
  if (now < BF_UPGRADE_SEND_AT) return { sent: 0 }
  const bf = await prisma.grantCampaign.findUnique({
    where: { slug: BLACK_FRIDAY_GRANT_SLUG }, select: { id: true, active: true, closesAt: true, percentOff: true, maxCourses: true },
  })
  if (!bf?.active || (bf.closesAt && bf.closesAt <= now)) return { sent: 0 }
  if (!(await liveChannels(prisma)).includes('email')) return { sent: 0 }
  const old = await prisma.grantCampaign.findMany({ where: { slug: { in: [...MERGED] } }, select: { id: true } })
  if (old.length === 0) return { sent: 0 }
  /* الأكوادُ التي أُعطيت في الحملتين القديمتين — بنسبتها يومَ أُعطيت */
  const issued = await prisma.auditEvent.findMany({
    where: { action: 'coupon.grant_issue', entityType: 'grant_campaign', entityId: { in: old.map((c) => c.id) } },
    select: { meta: true },
  })
  const oldPct = new Map<string, number>()
  for (const r of issued) {
    const m = (r.meta ?? {}) as { grantCodeId?: string; percentOff?: number }
    if (m.grantCodeId && typeof m.percentOff === 'number') oldPct.set(m.grantCodeId, m.percentOff)
  }
  const told = new Set((await prisma.auditEvent.findMany({
    where: { action: 'coupon.grant_notice', entityType: 'lead', meta: { path: ['stage'], equals: BF_UPGRADE_STAGE } },
    select: { entityId: true },
  })).map((r) => r.entityId))
  const codes = await prisma.grantCode.findMany({
    where: { id: { in: [...oldPct.keys()] }, campaignId: bf.id, lead: { erasedAt: null, email: { not: null } } },
    select: {
      id: true,
      lead: { select: { id: true, fullName: true, email: true } },
      coupon: { select: { id: true, code: true, percentOff: true, usedCount: true, maxUses: true } },
    },
  })
  const off = await optedOut(prisma, codes.map((c) => c.lead!.email!))
  const grants = new GrantService(prisma)
  const site = publicSiteUrl()
  const lastDay = bf.closesAt ? fmtDateLong(new Date(bf.closesAt.getTime() - 1)) : null
  let sent = 0
  for (const g of codes) {
    const lead = g.lead!
    const was = oldPct.get(g.id)!
    if (told.has(lead.id) || off.has(lead.email!.toLowerCase())) continue
    if (was >= (g.coupon.percentOff ?? 0)) continue
    const left = await grants.coursesLeft({
      ...g.coupon, grantCode: { campaign: { id: bf.id, active: bf.active, closesAt: bf.closesAt, maxCourses: bf.maxCourses } },
    })
    if (left <= 0) continue
    const pct = g.coupon.percentOff ?? bf.percentOff
    /* بلغةٍ أبسطَ وأحيا (١٧ نوفمبر ٢٠٢٦: «اجعل اللغة أبسط وأكثر حيوية وتشجيع») */
    const subject = `مفاجأة: خصمك صار ${pct}%`
    const links = unsubscribeLinks(lead.email!)
    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        action: 'coupon.grant_notice', entityType: 'lead', entityId: lead.id,
        meta: { stage: BF_UPGRADE_STAGE, grantCodeId: g.id, from: was, to: pct },
      })
      await enqueueMail(tx, {
        to: lead.email!, purpose: 'grant.reminder', subject, unsubscribeUrl: links.oneClick,
        ...renderMail({
          unsubscribeUrl: links.page,
          greetingName: lead.fullName ?? undefined,
          heading: `خصمك صار ${pct}%`,
          preheader: `نفس كودك، وخصم أكبر${lastDay ? `. حتى ${lastDay} فقط` : ''}.`,
          blocks: [
            { kind: 'p', text: `رفعنا منحتك من ${was}% إلى ${pct}%، وهذا أكبر خصم قدمناه على الإطلاق.` },
            { kind: 'p', text: `كودك نفسه، ويعمل وحده عند الدفع. اختر حتى ${grantCoursesAr(left)} وابدأ.` },
            ...(lastDay
              ? [{ kind: 'p' as const, text: `العرض حتى ${lastDay} فقط، وبعدها يغلق التسجيل حتى الفصل القادم.` }]
              : []),
            { kind: 'facts', rows: [
              { label: 'كود منحتك', value: g.coupon.code },
              { label: 'الخصم', value: `${pct}%` },
            ] },
            { kind: 'cta', label: 'احجز دوراتك الآن', href: `${site}${BLACK_FRIDAY_GRANT_PATH}` },
          ],
        }),
      })
    })
    sent += 1
  }
  return { sent }
}
