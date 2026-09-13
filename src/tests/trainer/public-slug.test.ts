/* اسمُ المدرّب في العنوان — `/t/<slug>`.

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «يظهر مسارٌ خاصٌّ باسم المدرّب
   للعامّة في الرابط ليقوموا بالتسجيل فيه». فالاختبارُ على ما يُشتقّ من
   الاسم: أن يبقى عربيّا، وأن يتّحد المشكولُ بغير المشكول، وألّا يصطدم
   اثنان باسمٍ واحد. */

import { describe, expect, it } from 'vitest'
import { SLUG_MAX, slugifyName, uniqueSlug } from '@/application/trainer/public-slug'

describe('الاسمُ يصير مسارا', () => {
  it('العربيّةُ تبقى عربيّةً — لا تُنقحر إلى لاتينيّةٍ لا يعرفها صاحبُها', () => {
    expect(slugifyName('محمد العتيبي')).toBe('محمد-العتيبي')
  })

  it('والتشكيلُ والتطويلُ يُنزعان — فـ«محمّد» و«محمد» مسارٌ واحدٌ لا مساران', () => {
    expect(slugifyName('محمّد العُتيبي')).toBe(slugifyName('محمد العتيبي'))
    expect(slugifyName('محـــمد')).toBe('محمد')
  })

  it('والفراغاتُ المتتاليةُ فاصلةٌ واحدة، ولا فاصلةَ في الطرفين', () => {
    expect(slugifyName('  سارة   الحربي  ')).toBe('سارة-الحربي')
  })

  it('وما ليس حرفا ولا رقما يصير فاصلةً لا يُحذف صامتا', () => {
    expect(slugifyName('د. خالد (المدرّب)')).toBe('د-خالد-المدرب')
  })

  it('واللاتينيّةُ تصغر، والأرقامُ تبقى', () => {
    expect(slugifyName('John Smith 2')).toBe('john-smith-2')
  })

  it('والطولُ محدود — ولا ينتهي المقتطعُ بفاصلة', () => {
    /* الاسمُ هنا مبنيٌّ ليقع الاقتطاعُ **على فاصلة** بالضبط: كلماتٌ من
       أربعةِ أحرفٍ بينها فراغٌ واحد، فالمواضعُ ٤ و٩ و… و٥٩ فواصل. واسمٌ
       بلا فواصلَ يمرّ وإن لم يُنظَّف الطرفُ بعد الاقتطاع — فلا يحرس. */
    const name = Array(13).fill('ابجد').join(' ')
    const long = slugifyName(name)
    expect(long).not.toBeNull()
    expect((long as string).length).toBeLessThanOrEqual(SLUG_MAX)
    expect(long, 'المقتطعُ ينتهي بفاصلة').not.toMatch(/-$/)
  })

  it('واسمٌ لا يبقى منه حرفٌ صالحٌ يعيد `null` — لا مسارا فارغا ولا شرطات', () => {
    expect(slugifyName('؟؟؟ !!!')).toBeNull()
    expect(slugifyName('   ')).toBeNull()
  })
})

describe('ولا يصطدم اثنان بمسارٍ واحد', () => {
  it('الأوّلُ يأخذ اسمَه مجرّدا', () => {
    expect(uniqueSlug('محمد-العتيبي', new Set())).toBe('محمد-العتيبي')
  })

  it('ومن تلاه يأخذ ما بعده — بلا قفزٍ على رقم', () => {
    expect(uniqueSlug('محمد', new Set(['محمد']))).toBe('محمد-2')
    expect(uniqueSlug('محمد', new Set(['محمد', 'محمد-2']))).toBe('محمد-3')
  })

  it('واللاحقةُ تُقتطع من الاسم لا تُزاد عليه — فلا يتجاوز الحدَّ', () => {
    const base = 'ا'.repeat(SLUG_MAX)
    const out = uniqueSlug(base, new Set([base]))
    expect(out.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(out).toMatch(/-2$/)
  })
})
