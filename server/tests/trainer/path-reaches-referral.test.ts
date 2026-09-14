/* ن-٨ · تمامُ و-١ — رابطُ الدعوة يبلغ ما جمعه المدرّبُ بنفسه.

   ═══ العطبُ الذي كُتب له ═══

   صفحةُ المدرّب العامّة (`/t/<اسمه>`) هي ما يشيره رابطُ دعوته. وكانت تعرض
   **شعبَه المفتوحةَ وحدَها** — وهي ما أسندته الإدارةُ إليه، لا ما اختاره
   هو. فمن بنى مسارا باسمه ونُشر على الرفّ العامّ، لم يكن رابطُه يبلغه:
   يقع الزائرُ على قائمةِ شعبٍ متفرّقةٍ لا على ما رتّبه له صاحبُها.

   وسؤالُ الصفحة في بوّابة المدرّب «ما الذي توصي به من يتابعك؟» كان جوابُه
   الوحيدُ «صفحتُك تعرض شعبَك» — وذلك عرضٌ لا توصية.

   ═══ وما يُحرَس هنا ═══

   ١) المسارُ المنشورُ يخرج مع الصفحة العامّة.
   ٢) وغيرُ المنشور لا يخرج — مسوّدةٌ أو منتظِرُ اعتمادٍ ليس وعدا لأحد.
   ٣) وقاعدةُ اعتماد النشر (ن-٢) فوقهما: مدرّبٌ لم يُعتمد ظهورُه لا صفحةَ له
      أصلا، فلا يُقرأ مسارُه من بابٍ خلفيّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PublicCatalogService } from '../../services/public-catalog.service'

let prisma: PrismaClient
let pub: PublicCatalogService
let profileId = ''
const S = Date.now().toString(36).slice(-5)
const SLUG = `mudarrib-${S}`

const mkPath = async (titleAr: string, status: string) =>
  prisma.trainerPath.create({
    data: {
      profileId, titleAr, status, blurbAr: 'نبذةٌ قصيرة',
      ...(status === 'published' ? { slug: `${SLUG}-${titleAr}`, publishedAt: new Date() } : {}),
    },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  pub = new PublicCatalogService(prisma)
  const auth = new AuthService(prisma)

  const u = await auth.register(`path-ref-${S}@test.local`, 'Pass#12345', 'مدرّبُ الاختبار')
  await auth.setRoles(u.userId, ['trainer'])
  const app = await prisma.trainerApplication.create({
    data: { reference: `TA-${S}`, fullName: 'سميرُ الاختبار', email: `path-ref-${S}@test.local`, status: 'active', userId: u.userId },
  })
  const profile = await prisma.trainerProfile.create({
    data: {
      userId: u.userId, applicationId: app.id, publicSlug: SLUG,
      publicVisibility: true, isVerified: true, publishApprovedAt: new Date(),
      headline: 'مدرّبٌ للاختبار',
    },
  })
  profileId = profile.id
}, 240_000)

describe('صفحةُ المدرّب العامّة تحمل ما جمعه', () => {
  it('المسارُ المنشورُ يخرج معها', async () => {
    await mkPath('مسارُ البداية', 'published')
    const page = await pub.trainerPublicPage(SLUG)
    expect(page.paths.map((p) => p.titleAr), 'المسارُ المنشورُ لا يبلغ زائرَ الرابط').toContain('مسارُ البداية')
  })

  it('وغيرُ المنشور لا يخرج — مسوّدةٌ ليست وعدا لأحد', async () => {
    await mkPath('مسوّدةٌ لم تُرسَل', 'draft')
    await mkPath('ينتظر الاعتماد', 'submitted')
    await mkPath('سُحب من الرفّ', 'retired')
    const page = await pub.trainerPublicPage(SLUG)
    const shown = page.paths.map((p) => p.titleAr)
    for (const hidden of ['مسوّدةٌ لم تُرسَل', 'ينتظر الاعتماد', 'سُحب من الرفّ']) {
      expect(shown, `«${hidden}» يُعرض للناس وهو ليس منشورا`).not.toContain(hidden)
    }
    expect(shown).toContain('مسارُ البداية')
  })

  /* ═══ وقاعدةُ ن-٢ فوق هذا كلِّه ═══
     لو نُزع اعتمادُ نشرِ المدرّب سقطت الصفحةُ كلُّها ٤٠٤ — فلا يُقرأ مسارُه
     من بابٍ خلفيّ، ولا يُعرض اسمُه على الناس بغير إذن. */
  it('ومدرّبٌ لم يُعتمد ظهورُه لا صفحةَ له — فلا مسارَ يُقرأ منها', async () => {
    await prisma.trainerProfile.update({ where: { id: profileId }, data: { publishApprovedAt: null } })
    await expect(pub.trainerPublicPage(SLUG)).rejects.toThrow(/لا مدرّب/)
    await prisma.trainerProfile.update({ where: { id: profileId }, data: { publishApprovedAt: new Date() } })
  })
})
