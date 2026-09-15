/* الروابطُ القصيرة — سكُّها وحلُّها (ط-٣).

   والقاعدةُ التي تحكمها في `src/application/links/short-link.ts`، يقرؤها
   الخادمُ والشاشةُ من موضعٍ واحد: البادئةُ، وطولُ الرمز، وأبجديّتُه، وما
   يجوز أن تكون الوجهةُ عليه.

   ═══ ولمَ يُفحَص الأمانُ هنا أيضا وقد فُحص هناك ═══

   لأنّ الشرطَ على **ما يُكتب في القاعدة** لا على ما تعرضه شاشة: صفٌّ فاسدٌ
   دخل مرّةً يبقى يُحوِّل الناسَ إلى حيث لا نريد وإن أُصلحت الشاشةُ بعدُ.
   فالبابُ يُحرَس عند الكتابة، والقراءةُ تثق بما كُتب. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { isSafeTarget, newShortCode, shortLinkPath } from '../../src/application/links/short-link'
import { publicSiteUrl } from './notification.service'

type Db = PrismaClient | Prisma.TransactionClient

export interface MintedLink {
  code: string
  /** المسارُ النسبيّ — `‎/s/XXXXXX` */
  path: string
  /** العنوانُ الكامل كما يُكتب تحت زرِّ البريد */
  url: string
}

export class ShortLinkService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  /** رابطٌ قصيرٌ جديدٌ لوجهةٍ داخليّة */
  async mint(target: string, actorId: string | null, purpose?: string): Promise<MintedLink> {
    if (!isSafeTarget(target)) {
      throw new AuthError('bad_target', 'الوجهةُ مسارٌ داخليٌّ يبدأ بشرطةٍ واحدة — ولا يُحوَّل إلى عنوانٍ خارجيّ', 400)
    }
    /* تصادمُ رمزٍ من نحو مليارٍ نادر، والنادرُ يقع: يُعاد السكُّ لا يُرمى الطلب. */
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = newShortCode()
      const taken = await this.prisma.shortLink.count({ where: { code } })
      if (taken > 0) continue
      await this.prisma.shortLink.create({ data: { code, target, purpose: purpose ?? null, createdBy: actorId } })
      await recordAudit(this.prisma, {
        actorId, action: 'short_link.create', entityType: 'short_link', entityId: code,
        meta: { target, purpose: purpose ?? null },
      })
      return { code, path: shortLinkPath(code), url: `${publicSiteUrl()}${shortLinkPath(code)}` }
    }
    throw new AuthError('code_exhausted', 'تعذّر سكُّ رمزٍ فريدٍ للرابط', 500)
  }

  /** وجهةُ رمزٍ — أو ٤٠٤

      والمبطَلُ والمجهولُ يُردّان بالجواب نفسِه بقصد: جوابان مختلفان يقولان
      لمن يجرّب الرموزَ أيُّها كان موجودا، وهو ما لا يُعطى مجّانا. */
  async resolve(code: string): Promise<{ target: string }> {
    const row = await this.prisma.shortLink.findUnique({ where: { code } })
    if (!row || row.revokedAt) throw new AuthError('not_found', 'لا وجهةَ لهذا الرابط', 404)
    /* وما كُتب قبل أن يُحرَس البابُ لا يُحوَّل إليه: الشرطُ يُقرأ عند الخروج
       أيضا، فصفٌّ قديمٌ أو مُعدَّلٌ بيدٍ في القاعدة لا يصير تحويلا مفتوحا. */
    if (!isSafeTarget(row.target)) throw new AuthError('not_found', 'لا وجهةَ لهذا الرابط', 404)
    return { target: row.target }
  }

  /** إبطالُ رابطٍ — ولا يُحذف صفُّه */
  async revoke(code: string, actorId: string | null): Promise<void> {
    const row = await this.prisma.shortLink.findUnique({ where: { code } })
    if (!row) throw new AuthError('not_found', 'لا رابطَ بهذا الرمز', 404)
    if (row.revokedAt) return
    await this.prisma.shortLink.update({ where: { code }, data: { revokedAt: new Date() } })
    await recordAudit(this.prisma, {
      actorId, action: 'short_link.revoke', entityType: 'short_link', entityId: code,
    })
  }
}

/** سكٌّ في معاملةٍ قائمة — لمن يسكّ رابطا مع الصفّ الذي يشير إليه */
export async function mintShortLink(db: Db, target: string, actorId: string | null, purpose?: string): Promise<string> {
  if (!isSafeTarget(target)) {
    throw new AuthError('bad_target', 'الوجهةُ مسارٌ داخليٌّ يبدأ بشرطةٍ واحدة — ولا يُحوَّل إلى عنوانٍ خارجيّ', 400)
  }
  const code = newShortCode()
  await db.shortLink.create({ data: { code, target, purpose: purpose ?? null, createdBy: actorId } })
  return code
}
