/* مفضّلةُ الزائر المسجَّل (ع-٨).

   ═══ ما تفعله، وما لا تفعله ═══

   تحفظ **رمزا ونوعا** لصاحبٍ بعينه. ولا تعرف الكتالوجَ ولا تتحقّق منه:
   الكتالوجُ ملفّاتٌ تُبنى مع الواجهة، ولا يقرؤها الخادم. فمن حفظ رمزا لا
   وجودَ له حفظ صفّا لا يُعرض — والشاشةُ تقابل المحفوظَ بالكتالوج الحيّ،
   فيسقط ما لا يُعرف هناك.

   وهذا أسلمُ من التحقّق: خادمٌ يردّ رمزا لا يعرفه يمنع الحفظَ كلَّما تأخّر
   نشرُ الكتالوج عن نشر الخادم — وهما يُنشران معا ولكن لا يلزم. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import {
  favoriteBlockerAr, type FavoriteKind,
} from '../../src/application/catalog/favorites'

export class FavoritesService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ما حفظه — الأحدثُ أوّلا، فآخرُ ما أعجبه أوّلُ ما يراه */
  async mine(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { kind: true, refId: true, createdAt: true },
    })
    return rows.map((r) => ({ kind: r.kind as FavoriteKind, refId: r.refId, savedAt: r.createdAt }))
  }

  /** يُضاف — ونقرتان لا تُنشئان صفّين (`upsert` على القيد الفريد) */
  async add(userId: string, kind: string, refId: string) {
    const blocker = favoriteBlockerAr(kind, refId)
    if (blocker) throw new AuthError('bad_favorite', blocker, 400)
    const id = refId.trim()
    await this.prisma.favorite.upsert({
      where: { userId_kind_refId: { userId, kind, refId: id } },
      update: {},
      create: { userId, kind, refId: id },
    })
    return { kind, refId: id, saved: true }
  }

  /** يُزال — وحذفُ ما ليس محفوظا ليس خطأً: القلبُ يُنقر مرّتين */
  async remove(userId: string, kind: string, refId: string) {
    const blocker = favoriteBlockerAr(kind, refId)
    if (blocker) throw new AuthError('bad_favorite', blocker, 400)
    await this.prisma.favorite.deleteMany({ where: { userId, kind, refId: refId.trim() } })
    return { kind, refId: refId.trim(), saved: false }
  }

  /* ═══ وما حُفظ في المتصفّح قبل اليوم لا يضيع ═══

     المفضّلةُ كانت `localStorage`. ومن حفظ فيها أمس يفتح المنصّةَ اليومَ
     فتُرفع مفضّلتُه إلى حسابه مرّةً واحدة، ثمّ يُمحى المخزنُ المحلّيّ.

     و`skipDuplicates` لا `upsert` في حلقة: الرفعُ دفعةٌ واحدةٌ مهما كثر،
     وما كان محفوظا يبقى بتاريخه الأوّل فلا يقفز إلى رأس القائمة. */
  async merge(userId: string, refs: readonly { kind: string; refId: string }[]) {
    const clean = refs
      .filter((r) => favoriteBlockerAr(r.kind, r.refId) === null)
      .map((r) => ({ userId, kind: r.kind, refId: r.refId.trim() }))
    if (clean.length === 0) return { merged: 0 }
    const res = await this.prisma.favorite.createMany({ data: clean, skipDuplicates: true })
    return { merged: res.count }
  }
}
