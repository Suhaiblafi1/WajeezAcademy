/* من فتح صفحةَ المنحة — عبّأ النموذجَ أم لم يعبّئه (٣١ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن «وقت فتح الرابط»، وكان لا يُحفظ إلّا مع النموذج: من فتح الصفحةَ وخرج لا أثرَ له، فلا يُعرف كم فتح
   الرابطَ من كلّ مصدرٍ ولا كم عبّأ منهم. وخُيّر بين عدّ الزيارات وتركه فقال: «Do all».

   ═══ ما يقع ═══

   ١) **الصفحةُ تُرسل زيارتَها حين تُفتح** (`recordGrantVisit`): رقما عشوائيّا يحفظه المتصفّح (`visitorId`)، والزيارةَ التي
      فتح بها الصفحةَ وأوّلَ زيارةٍ للموقع منظّفتين (`cleanTouch`). **صفٌّ واحدٌ لكلّ متصفّحٍ في كلّ حملة**: يبقى أوّلُ فتحٍ
      بمصدره، ويُعدّ ما بعده (`visits`، `lastAt`). ولا اسمَ ولا عنوانَ ولا بصمةَ جهاز.
   ٢) **ومن عبّأ النموذجَ من المتصفّح نفسِه يُربط بزيارته** (`linkGrantVisit` من `apply`) — وإن لم تُسجَّل زيارتُه (حُجبت أو
      سبقها النموذج) تُكتب حينها، فلا يزيد من عبّأ على من فتح.
   ٣) **والقائمةُ تقرؤها** (`grantVisitFunnel`): لكلّ مصدرٍ كم فتح وكم عبّأ وكم اشترى، باسم المصدر نفسِه الذي في عمود
      «المصدر» (`registrantSource`).

   والحارس: `server/tests/commerce/grant-visit.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { cleanTouch, type FirstTouch } from '../../src/application/marketing/signup-source'
import { normalizeInfluencerCode } from '../../src/application/commerce/influencer'
import { INFLUENCER_GRANT_SLUG, type GrantSlug } from '../../src/application/commerce/grant'
import { grantFunnel, registrantSource, type GrantFunnel, type RegistrantState } from '../../src/application/commerce/grant-registrants'
import { zonedDay } from '../../src/application/trainer/cohort-period'

export interface GrantVisitInput {
  visitorId: string
  /** كودُ المؤثّر من رابطه — في منحة المؤثّرين وحدَها */
  code?: string | null
  source?: { page?: unknown; first?: unknown } | null
}

const json = (t: FirstTouch | null) => (t ? { ...t } : undefined)

/** كودُ المؤثّر إن طابق مؤثّرا نشطا — وما سواه لا يُحفظ */
async function activeInfluencer(prisma: PrismaClient, slug: GrantSlug, raw: string | null | undefined): Promise<string | null> {
  if (slug !== INFLUENCER_GRANT_SLUG) return null
  const code = normalizeInfluencerCode(raw)
  if (!code) return null
  const found = await prisma.influencer.findFirst({ where: { code, active: true }, select: { code: true } })
  return found?.code ?? null
}

export async function recordGrantVisit(prisma: PrismaClient, slug: GrantSlug, input: GrantVisitInput, now = new Date()): Promise<void> {
  const page = cleanTouch(input.source?.page)
  const first = cleanTouch(input.source?.first)
  const influencerCode = await activeInfluencer(prisma, slug, input.code)
  await prisma.grantVisit.upsert({
    where: { campaign_visitorId: { campaign: slug, visitorId: input.visitorId } },
    create: { campaign: slug, visitorId: input.visitorId, pageTouch: json(page), firstTouch: json(first), influencerCode, firstAt: now, lastAt: now },
    update: { lastAt: now, visits: { increment: 1 } },
  })
}

/** من عبّأ النموذجَ يُربط بزيارته — أو تُكتب له الآن إن لم تُسجَّل */
export async function linkGrantVisit(
  prisma: PrismaClient, slug: GrantSlug, visitorId: string, leadId: string,
  touches: { page: FirstTouch | null; first: FirstTouch | null; influencerCode: string | null }, now = new Date(),
): Promise<void> {
  await prisma.grantVisit.upsert({
    where: { campaign_visitorId: { campaign: slug, visitorId } },
    create: {
      campaign: slug, visitorId, leadId, pageTouch: json(touches.page), firstTouch: json(touches.first), influencerCode: touches.influencerCode,
      firstAt: touches.page?.at && Date.parse(touches.page.at) <= now.getTime() ? new Date(touches.page.at) : now, lastAt: now,
    },
    update: { lastAt: now },
  })
  /* ومن عبّأ ثانيةً من المتصفّح نفسِه لا يُنقل من عميلٍ إلى آخر: يبقى لأوّل من عبّأ منه */
  await prisma.grantVisit.updateMany({ where: { campaign: slug, visitorId, leadId: null }, data: { leadId } })
}

/** لكلّ مصدرٍ: كم فتح الرابط، وكم عبّأ منهم، وكم اشترى */
export async function grantVisitFunnel(prisma: PrismaClient, stateOf: Map<string, RegistrantState>): Promise<GrantFunnel> {
  const visits = await prisma.grantVisit.findMany({
    orderBy: { firstAt: 'asc' },
    select: { campaign: true, pageTouch: true, firstTouch: true, influencerCode: true, firstAt: true, leadId: true },
  })
  /* والمجموعةُ وحدَها تُقرأ هنا — فلا يُسأل عن اسم صاحب رابط المدرّب */
  return grantFunnel(visits.map((v) => {
    const page = cleanTouch(v.pageTouch)
    return {
      group: registrantSource({
        influencer: v.campaign === INFLUENCER_GRANT_SLUG, influencerCode: v.influencerCode,
        channel: page?.channel ?? null, wave: page?.wave ?? null, pageTouch: page, firstTouch: cleanTouch(v.firstTouch),
      }).group,
      day: zonedDay(v.firstAt),
      filled: !!v.leadId,
      state: v.leadId ? stateOf.get(v.leadId) ?? null : null,
    }
  }), visits[0]?.firstAt ?? null)
}
