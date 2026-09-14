/* الرمزُ يُحفظ نصّا — قرارٌ، وثمنُه مكتوب.

   ═══ القرار ═══

   قال صاحبُ المنصّة (١٤ سبتمبر ٢٠٢٦): «أريد أن أتمكّن من إعادة نسخِ الرابط
   للمفعَّلين بدلا من إنشاء جديد». فعُرض عليه أنّ الرمزَ لا يُحفظ أصلا — في
   القاعدة `sha256` وحدَه — وأنّ البديلَ تجديدٌ على الصفّ نفسِه. فقال:
   «تخزين». ثمّ عُرض عليه التشفيرُ بلا متغيّرِ بيئةٍ جديد، فقال: «عاريا —
   الرابط ليس سرّيّا لهذه الدرجة».

   ═══ والثمنُ يُقال هنا لأنّه لا يُرى في شيفرة ═══

   كلُّ مَقلَبٍ ليليٍّ صار **دفترَ روابطَ حيّة**. ويستقرّ على قرص الخادم
   ويُحمل في نسخ Hetzner — ملفٌّ يُنسخ ويُنقل ويُسترجَع في مواضعَ ليست
   الخادمَ نفسَه. ومن ملك رابطا فتح بلا حساب ملفَّ المتقدّم: بياناتِه، وروابطَ
   موقَّعةً تُنزّل سيرتَه وشهاداتِه، ومُعرِّفيه بأسمائهم وملاحظاتهم، وكلامَ
   المراجعين فيه.

   ═══ فما الذي يُحرَس إذن ═══

   ما بقي من ضماناتٍ بعد القرار — وهي التي لو سقطت لصار الثمنُ أكبرَ ممّا
   قُبل:

   ١) **الميّتُ لا يُنسَخ.** الملغى والمنتهي رمزُهما في القاعدة ولا يفتح
      شيئا. فلو خرج عنوانُهما لَأغرى بنسخِ ما لا يعمل، ولَوسّع انتشارَ رمزٍ
      قد يُحيا بتمديدٍ لاحق. والإلغاءُ خاصّةً قرارٌ: «لا يقرأ هذا بعد اليوم».

   ٢) **والقديمُ لا يُنسَخ.** روابطُ ما قبل الهجرة لا رمزَ لها، ولا يُستخرج
      من هاشها. فتلك تُجدَّد — ولا تُعرض للنسخ فيُظنّ العطبُ في الزرّ.

   ٣) **والرمزُ لا يخرج مجرّدا.** يخرج عنوانا جاهزا، فلا تركّبه الشاشةُ ولا
      يظهر في حقلٍ ثانٍ يُنسى عند التدقيق.

   ═══ وكيف رُئي كلٌّ ساقطا ═══

   أُزيل شرطُ `revokedAt` فخرج عنوانُ الملغى. وأُزيل شرطُ الأجل فخرج عنوان
   المنتهي. وأُسقط `tokenClear` من الإنشاء فبقي `copyUrl` فارغا للجديد. ثمّ
   أُعيدت الثلاثة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'

let prisma: PrismaClient
let links: TrainerDossierLinkService
let applicationId = ''
const ACTOR = '00000000-0000-0000-0000-000000000011'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  links = new TrainerDossierLinkService(prisma)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: 'WJ-TR-TOKEN-1',
      fullName: 'متقدّمُ اختبار الرمز',
      email: 'token-store@test.local',
      status: 'submitted',
    },
  })
  applicationId = app.id
}, 240_000)

const rowFor = async (linkId: string) => {
  const all = await links.list(applicationId)
  const found = all.find((r) => r.id === linkId)
  if (!found) throw new Error('الصفُّ غير موجود')
  return found
}

describe('الحيُّ يُنسَخ بحرفه', () => {
  it('الرابطُ الجديدُ يخرج عنوانا جاهزا — هو نفسُه الذي أُنشئ', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئٌ أوّل' })
    const row = await rowFor(made.link.id)
    expect(row.copyUrl, 'لا عنوانَ للنسخ رغم حفظ الرمز').toBeTruthy()
    expect(row.copyUrl, 'العنوانُ المنسوخُ ليس الرابطَ الذي أُنشئ').toBe(made.url)
  })

  it('والتجديدُ يُبدّله — فالمنسوخُ بعده هو الجديدُ لا القديم', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئٌ يُجدَّد له' })
    const before = (await rowFor(made.link.id)).copyUrl
    const rotated = await links.rotate(applicationId, made.link.id, ACTOR)
    const after = (await rowFor(made.link.id)).copyUrl
    expect(after).not.toBe(before)
    expect(after).toBe(rotated.url)
  })
})

describe('والميّتُ لا يُنسَخ', () => {
  it('الملغى: لا عنوان — والإلغاءُ قرارٌ لا يُلتفّ حوله بزرّ نسخ', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئٌ يُلغى' })
    await links.revoke(applicationId, made.link.id, ACTOR)
    expect(
      (await rowFor(made.link.id)).copyUrl,
      'خرج عنوانُ رابطٍ ملغى: نسخةٌ منه تلتفّ على قرار الإلغاء.',
    ).toBeNull()
  })

  it('والمنتهي أجلُه: لا عنوان — ينسخه صاحبُه فلا يفتح شيئا', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئٌ ينتهي أجلُه' })
    await prisma.trainerDossierLink.update({
      where: { id: made.link.id }, data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect((await rowFor(made.link.id)).copyUrl).toBeNull()
  })

  it('وما أُنشئ قبل حفظ الرمز: لا عنوان — يُجدَّد ولا يُنسَخ', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'رابطٌ قديم' })
    /* تحاكي صفّا من قبل الهجرة: هاشٌ بلا رمز */
    await prisma.trainerDossierLink.update({
      where: { id: made.link.id }, data: { tokenClear: null },
    })
    expect((await rowFor(made.link.id)).copyUrl).toBeNull()
  })
})

describe('والرمزُ لا يخرج مجرّدا', () => {
  it('لا حقلَ باسمه في صفوف القائمة — عنوانٌ جاهزٌ فقط', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئُ الحقول' })
    const row = await rowFor(made.link.id)
    expect(
      Object.keys(row).some((k) => k.toLowerCase().includes('token')),
      'خرج الرمزُ في حقلٍ مستقلّ — يُنسى عند التدقيق ويُسجَّل حيث لا يُقصد.',
    ).toBe(false)
  })
})
