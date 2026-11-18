/* صهيب — مؤثّرٌ بكود SUHAIB وعمولة ٥٪ وحسابه، يُنشأ أو يُشغَّل مرّةً بلا نقرةٍ في الإدارة (١٨ نوفمبر ٢٠٢٦).
   قرارُ صاحب المنصّة: «ضع فيه كود suhaib كانفلونسر بالنظام وفعّل حسابه suhaiblafi2@gmail.com رقم 0797708080 والنسبة ٥٪».
   والعلّةُ في `applySuhaibLaunch` (`server/services/influencer.service.ts`).

   ① **صفُّه الموقوفُ يُشغَّل** — منذ أوقف بلاك فرايدي المؤثّرين: بعمولته ٥٪ ورقمه، ويُربط بحسابه ببريده، بأثرٍ بسببه بلا فاعل.
   ② **ومرّةً واحدة** — الثانيةُ لا شيء، فما غيّره صاحبُ المنصّة بعدُ يبقى.
   ③ **وعمولتُه ٥٪ على بلاك فرايدي برابطه** `?ch=SUHAIB` كما تأخذ كاسيت (`BLACK_FRIDAY_PAID_INFLUENCERS`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { InfluencerService, SUHAIB_LAUNCH_REASON, applySuhaibLaunch } from '../../services/influencer.service'
import { SUHAIB_INFLUENCER, blackFridayCommission } from '../../../src/application/commerce/influencer'

let prisma: PrismaClient
let influencers: InfluencerService
let ownerId = ''
const STAMP = Date.now()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  influencers = new InfluencerService(prisma)
  ownerId = (await new AuthService(prisma).register(`suhaib-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
}, 240_000)

describe('صهيب مؤثرا بعمولة 5%', () => {
  it('⚠️ صفه الموقوف يشغل بعمولته ورقمه ويربط بحسابه — مرة واحدة بأثره، وعمولته 5% على بلاك فرايدي برابطه', async () => {
    /* وملفٌّ قبله في العامل نفسِه قد أدار وظيفةَ المنح فأنشأه — فتُمحى مرّتُه ويُعاد صفُّه موقوفا كما في الإنتاج (`helpers/db.ts`) */
    await prisma.auditEvent.deleteMany({ where: { reason: SUHAIB_LAUNCH_REASON } })
    const had = await prisma.influencer.findFirst({ where: { code: 'SUHAIB' }, select: { id: true } })
    const id = had?.id ?? (await influencers.create({
      nameAr: 'Suhaib', code: 'SUHAIB', commissionPercent: 15, email: `suhaib-old-${STAMP}@test.local`,
    }, ownerId)).id
    await prisma.influencer.update({ where: { id }, data: { active: false, commissionPercent: 15, phone: null } })

    expect(await applySuhaibLaunch(prisma), 'لم يشغل صفه').toBe(id)
    const row = await prisma.influencer.findUniqueOrThrow({ where: { id }, include: { user: { select: { email: true } } } })
    expect(row).toMatchObject({ active: true, commissionPercent: 5, phone: SUHAIB_INFLUENCER.phone })
    expect(row.user?.email, 'لم يربط بحسابه').toBe(SUHAIB_INFLUENCER.email)
    expect(await prisma.auditEvent.count({ where: { action: 'influencer.update', actorId: null, reason: SUHAIB_LAUNCH_REASON } })).toBe(1)

    expect(await applySuhaibLaunch(prisma), 'وقع مرتين').toBeNull()
    expect(blackFridayCommission('SUHAIB', 5), 'لا عمولة له على بلاك فرايدي').toBe(5)
    expect(SUHAIB_INFLUENCER).toMatchObject({ code: 'SUHAIB', commissionPercent: 5, phone: '+962797708080', email: 'suhaiblafi2@gmail.com' })
  })
})
