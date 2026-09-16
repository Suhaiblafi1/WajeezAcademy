/* ثلاثُ شكاوى من شاشةٍ حيّة (١٥ سبتمبر ٢٠٢٦) — وحارسُ كلٍّ منها.
 *
 * البلاغاتُ الثلاثةُ من صاحب المنصّة، وهو ينظر في الموقع على هاتفه:
 *
 *   ١) صفحةُ الدخول تدعو الداخلَ إلى التشخيص — «وهو أصلا مدرّب».
 *   ٢) أرقامُ الرئيسة «دفشة».
 *   ٣) ذيلُ البطاقة مزدحم: الحجمُ ملاصقٌ للافتة.
 *
 * ولا واحدٌ منها يُحمِّر اختبارا: كلُّها صحيحةُ البنية، عاطلةُ المعنى. فما
 * يُحرَس هنا **القرار** لا الشكل: أنّ الدعوةَ مشروطةٌ بمن أنت، وأنّ الرقمَ
 * لا يعود ضخما، وأنّ ما فُصل لا يعود ملتصقا.
 *
 * والفحصُ على **الموضع والبنية** لا على ورودِ حرف — فتعليقاتُ هذا المستودَع
 * تشرح ما أُزيل فتذكر أسماءَه، وحارسٌ يطابق نصًّا في تعليقٍ حارسٌ يخضرّ
 * لسببٍ خاطئ.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')

describe('١ · بابُ الدخول يسأل «من أنت» قبل أن يقترح', () => {
  const AUTH = code('src/pages/Auth.tsx')

  it('البطاقةُ سطران، وكلُّ سطرٍ مشروطٌ بصفةِ الداخل', () => {
    const entries = [...AUTH.matchAll(/<Inset[^>]*interactive[\s\S]*?<\/Inset>/g)].map((m) => m[0])
    expect(entries.length, 'عددُ أبواب البطاقة تغيّر — يُراجَع القرارُ لا الاختبار').toBe(2)
    for (const e of entries) {
      /* «إن كنت …» هي الشرط. وبابٌ بلا شرطٍ يخاطب الجميعَ بصفةٍ واحدة،
         وهو بعينه ما شُكي منه: دعوةُ المدرّب إلى تشخيصِ متعلّم. */
      expect(e, 'بابٌ يخاطب الداخلَ بلا صفة').toContain('إن كنت')
    }
  })

  it('وللمدرّب بابُه — إلى طلب الانضمام لا إلى التشخيص', () => {
    expect(AUTH, 'لا بابَ للمدرّب في صفحةٍ يبلغها من طلبِ الانضمام نفسِه').toContain('/join-trainer')
    /* والمسارُ قائمٌ فعلا — لا وعدٌ برابطٍ مكسور */
    expect(code('src/App.tsx'), 'مسارُ انضمام المدرّبين مفقود').toContain('/join-trainer')
  })
})

describe('٢ · أرقامُ الرئيسة تصغر', () => {
  const BAR = code('src/components/TrustMetricsBar.tsx')

  it('لا رقمَ فوق `text-3xl` — ولا مقاسٌ حرفيٌّ يتجاوزه من الباب الخلفيّ', () => {
    /* السلّمُ يُقرأ من الصنف نفسِه: ما فوق الثالث ضخم. و`text-[2.75rem]`
       كانت الحيلةَ القائمةَ فعلا — فتُمنع بالقياس لا بالاسم. */
    const tooBig = [...BAR.matchAll(/text-(\d)xl\b/g)].map((m) => Number(m[1])).filter((n) => n > 3)
    expect(tooBig, `رقمٌ ضخمٌ عاد: text-${tooBig[0]}xl`).toEqual([])

    const literal = [...BAR.matchAll(/text-\[([\d.]+)rem\]/g)].map((m) => Number(m[1]))
    const over = literal.filter((r) => r > 1.875) // ١٫٨٧٥rem = text-3xl
    expect(over, `مقاسٌ حرفيٌّ فوق السلّم: ${over.join(' · ')}rem`).toEqual([])
  })

  it('وطبقةُ المربّع سقطت — الأيقونةُ في سطر اللصيقة لا فوقه', () => {
    expect(BAR, 'مربّعُ الأيقونة ٤٨×٤٨ ما زال قائما').not.toMatch(/h-12 w-12/)
  })

  it('واللصيقةُ قبل القيمة في البنية — `dl` تُقرأ مصطلحا ثمّ وصفا', () => {
    /* كانت `dd` قبل `dt` فتُقرأ الوصفُ قبل مصطلحه على قارئ الشاشة.
       والعرضُ يبقى «الرقمُ أوّلا» بـ`order` — البنيةُ للقارئ والترتيبُ للعين. */
    expect(BAR.indexOf('<dt'), 'المصطلحُ ما زال بعد وصفه').toBeLessThan(BAR.indexOf('<dd'))
  })
})

describe('٣ · ذيلُ البطاقة يتنفّس', () => {
  const BEST = code('src/pages/home/Bestsellers.tsx')
  /* شريطُ المسارات وشريطُ الدورات — كلٌّ يُقاس في مداه هو، فلا يخضرّ
     أحدُهما بما في الآخر. */
  const PW = BEST.slice(BEST.indexOf('morePaths.map'), BEST.indexOf('moreCourses.length'))
  const CR = BEST.slice(BEST.indexOf('moreCourses.map'))

  it('بطاقةُ المسار: الحجمُ في سطرٍ، و«تفاصيل المسار» في سطرٍ بعده', () => {
    const size = PW.indexOf('pathwaySizeAr(b.item)')
    const cta = PW.indexOf('تفاصيل المسار')
    expect(size, 'سطرُ الحجم مفقود').toBeGreaterThan(-1)
    expect(cta, 'لافتةُ المسار مفقودة').toBeGreaterThan(-1)
    expect(size, 'الحجمُ نزل تحت اللافتة').toBeLessThan(cta)
    /* والفصلُ يُقاس بإغلاقِ عنصرٍ بينهما — لا بمسافةٍ ولا بصنف */
    expect(PW.slice(size, cta), 'الحجمُ واللافتةُ في عنصرٍ واحدٍ كما كانا').toContain('</span>')
  })

  it('بطاقةُ الدورة: الرقاقةُ فوق الأسابيع — وهو التبديلُ بعينه', () => {
    const pill = CR.indexOf('b.item.skill')
    const weeks = CR.indexOf('b.item.weeks')
    const cta = CR.indexOf('تفاصيل الدورة')
    expect(pill, 'رقاقةُ المهارة مفقودة').toBeGreaterThan(-1)
    expect(weeks, 'سطرُ الأسابيع مفقود').toBeGreaterThan(-1)
    expect(pill, 'الرقاقةُ ما زالت تحت الأسابيع').toBeLessThan(weeks)
    expect(weeks, 'الأسابيعُ لم تنزل إلى الذيل').toBeLessThan(cta)
  })

  it('وذيلُ الدورة صفٌّ من اثنين — الأسابيعُ واللافتة', () => {
    /* «٢ أسابيع» كلمتان تجاوران اللافتةَ بلا انكسار، والرقاقةُ كانت تنكسر
       سطرين إلى جانبها. فالصفُّ باقٍ ومحتواه هو الذي تبدّل. */
    const weeks = CR.indexOf('b.item.weeks')
    const tail = CR.slice(CR.lastIndexOf('mt-auto', weeks), weeks)
    expect(tail, 'ذيلُ الدورة لم يعد صفًّا ذا طرفين').toContain('justify-between')
  })
})
