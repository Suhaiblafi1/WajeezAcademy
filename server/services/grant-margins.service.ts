/* الهامشُ في كلّ المنح — لوحٌ واحدٌ في رأس كلّ صفحة منحة (١٦ نوفمبر ٢٠٢٦). والعلّةُ في `src/application/commerce/grant-margins.ts`.

   ═══ ما يقع ═══

   ١) **لكلّ حملةٍ صفٌّ بنسبتها المحفوظة** — الأربعُ ثمّ الشركاء. والعمولةُ صفرٌ إلّا في حملتَي المؤثّرين: أعلى عمولةٍ لمؤثّرٍ
      نشط، كما يقرؤها «فحص الهامش» في صفحتهما (`influencer.routes.ts`) — فلا يُرى هامشٌ أحسنُ ممّا يقع.
   ٢) **ولكلّ مؤثّرٍ نشطٍ صفٌّ تحت كلٍّ من حملتَي المؤثّرين** — بخصمه هو (`percentOff`، وفارغُه نسبةُ الحملة) وعمولتِه هو:
      ما يقع حقّا على من جاء بكوده. والموقوفُ لا يُعطى به كودٌ جديدٌ فلا صفَّ له.
   ٣) **والحسابُ حسابُ «فحص الهامش» نفسُه** (`GrantService.margins`) بنسبةٍ وعمولةٍ تُمرَّران — لا يُكتب ثانية. ونتيجتُه لا تتعلّق
      بالحملة إذا مُرّرت النسبة، فيُحسب لكلّ زوجٍ (نسبة، عمولة) مرّةً واحدة: المؤثّرون بخصم حملتهم وعمولتها الشائعة صفٌّ واحدٌ
      محسوب، لا قراءةٌ لكلّ مؤثّر. */

import type { PrismaClient } from '@prisma/client'
import { GrantService } from './grant.service'
import {
  BLACK_FRIDAY_GRANT_SLUG, GRANT_CAMPAIGNS, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, isInfluencerGrant, type GrantSlug,
} from '../../src/application/commerce/grant'
import { INFLUENCER_COMMISSION_DEFAULT, influencerPercentOff } from '../../src/application/commerce/influencer'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { marginStats, type MarginStats } from '../../src/application/commerce/grant-margins'

/** ترتيبُ الحملات في اللوح — كما يقرؤها صاحبُ المنصّة: منحتا الجميع، ثمّ منحتا المؤثّرين */
const ORDER: readonly GrantSlug[] = [MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, INFLUENCER_GRANT_SLUG, BLACK_FRIDAY_GRANT_SLUG]

export interface InfluencerMarginRow extends MarginStats {
  id: string
  nameAr: string
  code: string
  /** الخصمُ الذي يأخذه متابعُه في هذه الحملة */
  percentOff: number
  /** أهو خصمُه هو أم نسبةُ الحملة */
  ownPercent: boolean
  commissionPercent: number
}

export interface CampaignMarginRow extends MarginStats {
  slug: string
  nameAr: string
  /** حملةٌ من الأربع أم شريك */
  group: 'campaign' | 'partner'
  active: boolean
  percentOff: number
  commissionPercent: number
  /** أعلى عمولةٍ لمؤثّرٍ نشط — في حملتَي المؤثّرين */
  topCommission: boolean
  influencers?: InfluencerMarginRow[]
}

export async function grantMarginsSummary(prisma: PrismaClient): Promise<{ currency: string; campaigns: CampaignMarginRow[] }> {
  /* الحسابُ بحملةٍ أيّا كانت: النسبةُ تُمرَّر، فلا يقرأ منها إلّا صفَّها */
  const calc = new GrantService(prisma)
  const cache = new Map<string, Promise<MarginStats>>()
  const statsFor = (pct: number, commission: number) => {
    const key = `${pct}|${commission}`
    let hit = cache.get(key)
    if (!hit) {
      hit = calc.margins(pct, commission).then((r) => marginStats(r.rows, LEDGER_CURRENCY))
      cache.set(key, hit)
    }
    return hit
  }

  const [settings, partners, active] = await Promise.all([
    Promise.all(ORDER.map((slug) => new GrantService(prisma, slug).campaign())),
    prisma.grantCampaign.findMany({ where: { kind: 'partner' }, orderBy: { createdAt: 'asc' } }),
    prisma.influencer.findMany({
      where: { active: true }, orderBy: { createdAt: 'asc' },
      select: { id: true, nameAr: true, code: true, percentOff: true, commissionPercent: true },
    }),
  ])
  const top = active.reduce<number | null>((m, x) => (m === null || x.commissionPercent > m ? x.commissionPercent : m), null)
    ?? INFLUENCER_COMMISSION_DEFAULT

  const campaigns = await Promise.all(settings.map(async (c): Promise<CampaignMarginRow> => {
    const forInfluencers = isInfluencerGrant(c.slug)
    const commissionPercent = forInfluencers ? top : 0
    return {
      slug: c.slug, nameAr: GRANT_CAMPAIGNS[c.slug as GrantSlug].nameAr, group: 'campaign', active: c.active,
      percentOff: c.percentOff, commissionPercent, topCommission: forInfluencers,
      ...(await statsFor(c.percentOff, commissionPercent)),
      ...(forInfluencers
        ? {
            influencers: await Promise.all(active.map(async (x): Promise<InfluencerMarginRow> => {
              const pct = influencerPercentOff(c.percentOff, x.percentOff)
              return {
                id: x.id, nameAr: x.nameAr, code: x.code, percentOff: pct, ownPercent: x.percentOff !== null,
                commissionPercent: x.commissionPercent, ...(await statsFor(pct, x.commissionPercent)),
              }
            })),
          }
        : {}),
    }
  }))
  /* والشركاء بعدها — منحةٌ لكلّ شريكٍ بنسبتها، بلا عمولة (`partner-grant.ts`) */
  const partnerRows = await Promise.all(partners.map(async (p): Promise<CampaignMarginRow> => ({
    slug: p.slug, nameAr: p.nameAr, group: 'partner', active: p.active, percentOff: p.percentOff, commissionPercent: 0,
    topCommission: false, ...(await statsFor(p.percentOff, 0)),
  })))
  return { currency: LEDGER_CURRENCY, campaigns: [...campaigns, ...partnerRows] }
}
