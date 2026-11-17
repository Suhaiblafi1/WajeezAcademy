/* «فحص الهامش» لأيّ منحة — يُختار من فوق جدوله (١٦ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة، وهو في صفحة بلاك فرايدي: «أريد فوق هذا الجدول أن أختار المنحةَ التي أرى جدولَها، خاصّةً للمؤثّرين
   والشركاء لأنّهم كثيرون.. بلاك فرايدي واحدة.. ولا حاجةَ للجدول الذي وضعتَه في رأس الصفحة». فذهب لوحُ «الهامش في كل المنح»،
   وصار فوق «فحص الهامش» اختيارٌ واحد: المنحُ الأربع، ثمّ كلُّ مؤثّرٍ نشط، ثمّ كلُّ شريك.

   ═══ ما يقع ═══

   ١) **لكلّ منحةٍ خيارٌ بنسبتها المحفوظة.** والعمولةُ صفرٌ إلّا في «منحة مؤثرين وجيز»: أعلى عمولةٍ لمؤثّرٍ نشط، فلا يُرى
      هامشٌ أحسنُ ممّا يقع. و«بلاك فرايدي وجيز» لم تعد حملةَ مؤثّرين (`grant-merge.service.ts`) — فلا عمولةَ فيها.
   ٢) **ولكلّ مؤثّرٍ نشطٍ خيارُه** — بخصمه هو (وفارغُه نسبةُ منحة المؤثّرين) وعمولتِه هو: ما يقع حقّا على من جاء بكوده.
      والموقوفُ لا يُعطى به كودٌ جديدٌ فلا خيارَ له.
   ٣) **ولكلّ شريكٍ خيارُه** بنسبته، وحصّتُه ممّا يُدفع تُطرح من الهامش (`partnerShare`).
   ٤) **والحسابُ حسابُ «فحص الهامش» نفسُه** (`GrantService.margins`) بنسبةٍ وعمولةٍ وحصّةٍ تُمرَّر — لا يُكتب ثانية. والنسبةُ
      تُجرَّب قبل أن تُحفظ: تُمرَّر فتغلب نسبةَ الخيار. */

import type { PrismaClient } from '@prisma/client'
import { GrantService } from './grant.service'
import {
  BLACK_FRIDAY_GRANT_SLUG, GRANT_CAMPAIGNS, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, isInfluencerGrant, type CampaignSlug, type GrantSlug,
} from '../../src/application/commerce/grant'
import { INFLUENCER_COMMISSION_DEFAULT, blackFridayCommission, influencerPercentOff } from '../../src/application/commerce/influencer'

/** ترتيبُ المنح في الاختيار — كما يقرؤها صاحبُ المنصّة */
const ORDER: readonly GrantSlug[] = [MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG]

/** مفتاحُ خيار المؤثّر — والمنحُ والشركاءُ مفتاحُهم صفُّ حملتهم */
export const influencerMarginKey = (id: string) => `influencer:${id}`

export interface MarginOption {
  key: string
  group: 'campaign' | 'influencer' | 'partner'
  nameAr: string
  /** الحملةُ التي يُحسب بها */
  slug: CampaignSlug
  active: boolean
  percentOff: number
  commissionPercent: number
  sharePercent: number
  /** كودُ المؤثّر */
  code?: string
}

export async function marginOptions(prisma: PrismaClient): Promise<MarginOption[]> {
  const [settings, partners, influencers] = await Promise.all([
    Promise.all(ORDER.map((slug) => new GrantService(prisma, slug).campaign())),
    prisma.grantCampaign.findMany({ where: { kind: 'partner' }, orderBy: { createdAt: 'asc' } }),
    prisma.influencer.findMany({
      where: { active: true }, orderBy: { createdAt: 'asc' },
      select: { id: true, nameAr: true, code: true, formerCodes: true, percentOff: true, commissionPercent: true },
    }),
  ])
  const top = influencers.reduce<number | null>((m, x) => (m === null || x.commissionPercent > m ? x.commissionPercent : m), null)
    ?? INFLUENCER_COMMISSION_DEFAULT
  const infCampaign = settings.find((c) => c.slug === INFLUENCER_GRANT_SLUG)!

  return [
    ...settings.map((c): MarginOption => ({
      key: c.slug, group: 'campaign', nameAr: GRANT_CAMPAIGNS[c.slug as GrantSlug].nameAr, slug: c.slug as CampaignSlug, active: c.active,
      percentOff: c.percentOff, commissionPercent: isInfluencerGrant(c.slug) ? top : 0, sharePercent: 0,
    })),
    ...influencers.map((x): MarginOption => ({
      key: influencerMarginKey(x.id), group: 'influencer', nameAr: x.nameAr, code: x.code, slug: INFLUENCER_GRANT_SLUG,
      active: infCampaign.active, percentOff: influencerPercentOff(infCampaign.percentOff, x.percentOff),
      commissionPercent: x.commissionPercent, sharePercent: 0,
    })),
    /* ومن يأخذ عمولتَه على بلاك فرايدي برابطه (`BLACK_FRIDAY_PAID_INFLUENCERS`) صفٌّ له بنسبة بلاك فرايدي وعمولته */
    ...influencers.filter((x) => blackFridayCommission(x, x.commissionPercent) > 0).map((x): MarginOption => {
      const bf = settings.find((c) => c.slug === BLACK_FRIDAY_GRANT_SLUG)!
      return {
        key: `${BLACK_FRIDAY_GRANT_SLUG}:${x.id}`, group: 'influencer', nameAr: `${GRANT_CAMPAIGNS[BLACK_FRIDAY_GRANT_SLUG].nameAr} — ${x.nameAr}`, code: x.code,
        slug: BLACK_FRIDAY_GRANT_SLUG, active: bf.active, percentOff: bf.percentOff, commissionPercent: blackFridayCommission(x, x.commissionPercent), sharePercent: 0,
      }
    }),
    ...partners.map((p): MarginOption => ({
      key: p.slug, group: 'partner', nameAr: p.nameAr, slug: p.slug as CampaignSlug, active: p.active,
      percentOff: p.percentOff, commissionPercent: 0, sharePercent: p.partnerSharePercent ?? 0,
    })),
  ]
}

/** «فحص الهامش» لخيارٍ واحد — ونسبةٌ تُمرَّر تُجرَّب مكانَ نسبته. و`null` لمفتاحٍ لا خيارَ له */
export async function marginsFor(prisma: PrismaClient, key: string, percentOff?: number) {
  const option = (await marginOptions(prisma)).find((o) => o.key === key)
  if (!option) return null
  const r = await new GrantService(prisma, option.slug).margins(percentOff ?? option.percentOff, option.commissionPercent, option.sharePercent)
  return { option, ...r }
}
