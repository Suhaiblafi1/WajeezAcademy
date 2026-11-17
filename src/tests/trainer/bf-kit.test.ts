/* عُدّةُ بلاك فرايدي للمدرّب (١٧ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `src/application/trainer/bf-kit.ts`.

   ① رابطُه صفحةُ المنحة برمز رابطه — فيُرى من جاء منه في قائمة المنحة بمدرّبه.
   ② ونصوصُه برابطه وأرقام المنحة كما هي، وآخرُ يومها بتوقيت عمّان — بلا حركاتٍ إلّا الشدّة، وبلا «عرضك».
   ③ وتظهر في «شارك دوراتك» برمز رابطه، ولا تظهر والمنحةُ مغلقة. والتصميمان على الموقع. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BF_KIT_DESIGNS, BF_KIT_WA, bareLink, bfKitLink, bfKitTexts, bfLastDayAr } from '@/application/trainer/bf-kit'

const ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('① رابط المدرب إلى المنحة', () => {
  it('⚠️ صفحة بلاك فرايدي برمز رابطه', () => {
    expect(bfKitLink('https://www.wajeezacademy.com/', 'AB12CD')).toBe('https://www.wajeezacademy.com/grant/bf?ref=AB12CD')
  })
})

describe('② نصوصه', () => {
  const link = 'https://www.wajeezacademy.com/grant/bf?ref=AB12CD'
  const t = bfKitTexts({ link, percentOff: 80, maxCourses: 4, lastDayAr: bfLastDayAr('2026-11-21T21:00:00.000Z'), name: 'لين كنعان' })
  const all = [t.social, t.emailSubject, t.email, t.whatsapp]

  it('⚠️ آخر يوم بتوقيت عمان: نهاية المنحة أول اليوم التالي', () => {
    expect(bfLastDayAr('2026-11-21T21:00:00.000Z')).toBe('السبت 21 نوفمبر')
  })

  it('⚠️ كل نص برابطه ونسبة المنحة وآخر يومها، والبريد بحد دوراتها وتوقيعه', () => {
    for (const s of [t.social, t.email, t.whatsapp]) {
      expect(s, 'نص بلا رابطه').toContain(link)
      expect(s).toContain('80%')
      expect(s).toContain('حتى السبت 21 نوفمبر')
    }
    expect(t.emailSubject).toContain('80%')
    /* وواتساب الأكاديمية في نصوصه الثلاثة — «add the whatsapp link for their messages» (١٧ نوفمبر ٢٠٢٦) */
    expect(BF_KIT_WA).toBe('wajeezacademy.com/wa')
    for (const s of [t.social, t.email, t.whatsapp]) expect(s, 'نص بلا واتساب الأكاديمية').toContain(`\n${BF_KIT_WA}`)
    expect(t.email).toContain('حتى 4 دورات')
    expect(t.email.trim().endsWith('لين كنعان'), 'البريد بلا توقيعه').toBe(true)
    expect(bfKitTexts({ link, percentOff: 80, maxCourses: 4, lastDayAr: null }).social).not.toContain('حتى')
  })

  it('⚠️ لغة بيضاء: لا حركات إلا الشدة، ولا «عرضك»', () => {
    for (const s of all) {
      expect(s).not.toMatch(/[ً-ِْ]/)
      expect(s).not.toContain('عرضك')
    }
  })
})

describe('③ في «شارك دوراتك»', () => {
  it('⚠️ تظهر برمز رابطه، ولا تظهر والمنحة مغلقة', () => {
    expect(read('src/pages/trainer/Referral.tsx')).toMatch(/<BlackFridayKit refCode=\{referral\.code\} name=\{kit\?\.name \?\? null\} shortLink=\{kit\?\.short\.bf \?\? null\} \/>/)
    /* والقصيرُ إن كان، بلا https ولا www — «اختصر الرابط للمدرّبين» (١٧ نوفمبر ٢٠٢٦) */
    expect(read('src/components/trainer/BlackFridayKit.tsx')).toMatch(/const link = bareLink\(shortLink \?\? bfKitLink\(window\.location\.origin, refCode\)\);/)
    expect(bareLink('https://www.wajeezacademy.com/s/ABC123')).toBe('wajeezacademy.com/s/ABC123')
    const kit = read('src/components/trainer/BlackFridayKit.tsx')
    expect(kit).toMatch(/apiGet<\{ campaign: BfCampaign \}>\("\/api\/public\/grant\/bf"\)/)
    expect(kit).toMatch(/if \(!campaign\?\.open \|\| !texts\) return null;/)
  })

  it('⚠️ والتصميمان على الموقع بصيغة يقرؤها كل بريد', () => {
    for (const d of BF_KIT_DESIGNS) {
      expect(d.src).toMatch(/\.jpg$/)
      expect(existsSync(join(ROOT, 'public', d.src)), `لا ملف ${d.src}`).toBe(true)
    }
  })
})
