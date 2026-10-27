/* ═══ فتحاتُ روابط المدرّب — تُعدّ ويُقال له كم ومن أين (٢٧ أكتوبر ٢٠٢٦) ═══

   اقترح Claude «عدّادا لروابط المدرّب»، فقال صاحبُ المنصّة: «كلّهم». وكلُّ ضغطةٍ على رابطٍ قصيرٍ تمرّ بالخادم أصلا
   (`‎/s/:code` في `public.routes.ts`، لأجل المعاينة)، فتُكتب هناك فتحةً واحدة:

   · **الإنسانُ وحدَه يُعدّ** — زاحفُ المعاينة يفتح الرابطَ حين يُلصق قبل أن يضغطه أحد (`isCrawler`).
   · **ومن عاد في نصف ساعةٍ لا يُعدّ ثانية** — بصمتُه عنوانُه ومتصفّحُه مجزَّآن، ولا يُحفظ عنوانُه نفسُه.
   · **والمنصّةُ من الرابط** (`?p=wa`، `share-via.ts`) — وما نُسخ بيده بلا منصّةٍ «مباشر».

   والمسجّلون من كلّ رابطٍ لا يُكتبون هنا: التسجيلُ يحمل رمزَ الإحالة أصلا (`Enrollment.referralCode`)، فيُعدّ به. */

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { isCrawler, viaOf } from '../../src/application/links/share-via'

/** من فتح الرابطَ ثانيةً في هذه المدّة يُعدّ مرّة */
export const REOPEN_WINDOW_MS = 30 * 60 * 1000

/** يكتب فتحةً لرابطٍ إن فتحه إنسانٌ لم يفتحه في نصف الساعة الأخيرة — ولا يرمي: العدُّ لا يمنع أحدا من الوصول */
export async function recordOpen(
  prisma: PrismaClient, code: string, req: { ip: string; userAgent: string | undefined; via: unknown },
): Promise<boolean> {
  if (isCrawler(req.userAgent)) return false
  try {
    const link = await prisma.shortLink.findUnique({ where: { code }, select: { id: true } })
    if (!link) return false
    const visitor = createHash('sha256').update(`${req.ip}|${req.userAgent ?? ''}`).digest('base64url').slice(0, 22)
    const recent = await prisma.shortLinkOpen.count({
      where: { linkId: link.id, visitor, at: { gte: new Date(Date.now() - REOPEN_WINDOW_MS) } },
    })
    if (recent > 0) return false
    await prisma.shortLinkOpen.create({ data: { linkId: link.id, visitor, via: viaOf(req.via) } })
    return true
  } catch {
    return false
  }
}

export interface LinkReach {
  /** كم إنسانا فتحه */
  opens: number
  /** فتحاتُه بمنصّاتها — `direct` لما نُسخ بيده */
  byVia: Record<string, number>
  /** كم ملتحقا سجّل برمز إحالته */
  registered: number
}

/** ما بلغه كلُّ رابط — برمزه القصير، ورمزِ الإحالة الذي يحمله */
export async function reachOf(prisma: PrismaClient, links: { code: string; refCode: string }[]): Promise<Record<string, LinkReach>> {
  if (links.length === 0) return {}
  const rows = await prisma.shortLink.findMany({ where: { code: { in: links.map((l) => l.code) } }, select: { id: true, code: true } })
  const idOf = new Map(rows.map((r) => [r.code, r.id]))
  const [opens, enrolled] = await Promise.all([
    prisma.shortLinkOpen.groupBy({ by: ['linkId', 'via'], where: { linkId: { in: rows.map((r) => r.id) } }, _count: { _all: true } }),
    /* والملتحقُ وحدَه — كما يُعدّ في «مستحقّاتي» (`ReferralService.reachOf`): قائمةُ الانتظار ليست مقعدا */
    prisma.enrollment.groupBy({
      by: ['referralCode'],
      where: { referralCode: { in: links.map((l) => l.refCode) }, status: { in: ['enrolled', 'completed'] } },
      _count: { _all: true },
    }),
  ])
  const out: Record<string, LinkReach> = {}
  for (const l of links) {
    const id = idOf.get(l.code)
    const mine = opens.filter((o) => o.linkId === id)
    const byVia: Record<string, number> = {}
    for (const o of mine) byVia[o.via ?? 'direct'] = (byVia[o.via ?? 'direct'] ?? 0) + o._count._all
    out[l.code] = {
      opens: mine.reduce((a, o) => a + o._count._all, 0),
      byVia,
      registered: enrolled.find((e) => e.referralCode === l.refCode)?._count._all ?? 0,
    }
  }
  return out
}
