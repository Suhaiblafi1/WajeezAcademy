/* شريطُ الموقع العامّ — رأسان يجب أن يبقيا واحدا.

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من صغر التبويبات على الحاسوب. وحين
   كُبِّرت وُجد أنّ للموقع **رأسَين**: واحدٌ في `SiteShell` لكلّ الصفحات،
   وآخرُ مكتوبٌ بيده داخلَ `Home` للصفحة الرئيسة. فتغييرُ أحدهما وحدَه يترك
   الزائرَ يرى مقاسا في الرئيسة وآخرَ حين ينتقل — وهو العطبُ الذي سُمّي في
   دفتر العمل «تُصلح شاشةً فتعيدها التي بعدها».

   والفحصُ على **التطابق** لا على قيمةٍ بعينها: من غيّر المقاسَ غيّره في
   الرأسين، ومن أراد قيمةً أخرى فله ذلك ما دام الرأسان عليها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** صنفُ الشريط الأفقيّ في رأسٍ ما — الشريطُ المخفيُّ دون حدٍّ ما (١٣٦٠ بكسلا اليوم) */
function navClass(src: string): string {
  const m = src.match(/<nav className="(hidden items-center[^"]*(?:\b(?:md|lg|xl|2xl)|min-\[\d+px\]):flex\b[^"]*)"/)
  if (!m) throw new Error('لم يُعثر على شريط الرأس — تغيّرت بنيةُ الرأس')
  return m[1]
}

describe('رأسا الموقع على مقاسٍ واحد', () => {
  const shell = navClass(read('src/components/SiteShell.tsx'))
  const home = navClass(read('src/pages/Home.tsx'))

  it('⚠️ الشريطان متطابقان — فلا يرى الزائرُ مقاسا في الرئيسة وآخرَ بعدها', () => {
    expect(home, `رأسُ الرئيسة «${home}» ورأسُ الموقع «${shell}»`).toBe(shell)
  })

  it('⚠️ ويكبران على الحاسوب — كان المقاسُ واحدا من اللوح إلى أعرض شاشة', () => {
    /* شكوى ١٣ سبتمبر ٢٠٢٦: «التبويبات صغيرة على اللابتوب» */
    expect(shell, 'لا كِبَرَ على الشاشة الكبيرة').toMatch(/\blg:text-(base|lg|xl)\b/)
  })

  it('والكِبَرُ من `lg` لا من `md` — فاللوحُ تتزاحم فيه الخمسةُ مع العلامة', () => {
    expect(shell, 'كبر الشريطُ على اللوح فتزاحم').not.toMatch(/\bmd:text-(base|lg|xl)\b/)
  })
})

/* ═══ وعلى روابطَ واحدة — و«من نحن» أوّلُها (٢٣ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «من نحن» في الشريط مكانَ المنهجيّة، وأوّلَ ما فيه.
   والرأسان كتبا روابطَهما بأيديهما، وافترقا فعلا قبل القرار: «المنهجية» في
   الرئيسة و«منهجية وجيز» في غيرها. فالحارسُ على التطابق كما هو على المقاس —
   يُنقل الرابطُ في أحدهما وحدَه فيسقط. والفرقُ المقصودُ الوحيد مرساةُ
   التشخيص: في الرئيسة `#diagnostic`، وفي غيرها `/#diagnostic` إليها. */
function navLinks(src: string): { label: string; href: string }[] {
  const block = src.match(/const links[^=]*=\s*\[([\s\S]*?)\n\s*\]/)
  if (!block) throw new Error('لم تُعثر على روابط الرأس — تغيّرت بنيةُ الرأس')
  return [...block[1].matchAll(/\{\s*label:\s*'([^']+)',\s*href:\s*'([^']+)'/g)]
    .map((m) => ({ label: m[1], href: m[2].replace(/^\/#/, '#') }))
}

describe('ورأسا الموقع على روابطَ واحدة', () => {
  const shellSrc = read('src/components/SiteShell.tsx')
  const homeSrc = read('src/pages/Home.tsx')
  const shell = navLinks(shellSrc)
  const home = navLinks(homeSrc)

  it('يُقرأ من الرأسين شيءٌ أصلا — وإلّا مرّ ما بعده على فراغ', () => {
    expect(shell.length).toBeGreaterThan(3)
    expect(home.length).toBeGreaterThan(3)
  })

  it('⚠️ الرأسان يعرضان الروابطَ نفسَها بالترتيب نفسِه', () => {
    expect(home).toEqual(shell)
  })

  it('⚠️ و«من نحن» أوّلُ الشريط — قرارُ صاحب المنصّة', () => {
    expect(shell[0]).toEqual({ label: 'من نحن', href: '/p/about' })
  })

  it('والمنهجيّةُ خرجت من الشريط لا من الموقع — تبقى في التذييلَين', () => {
    expect(shell.some((l) => l.href === '/methodology'), 'المنهجيّةُ عادت إلى الشريط').toBe(false)
    expect(shellSrc, 'تذييلُ الصفحات الداخليّة فقد رابطَ المنهجيّة').toMatch(/<Link to="\/methodology"/)
    expect(homeSrc, 'تذييلُ الرئيسة فقد رابطَ المنهجيّة').toMatch(/\{ label: 'المنهجية', to: '\/methodology' \}/)
  })
})

/* ═══ ولا عرضَ بلا تنقّل، ولا تبويبَ ينكسر سطرين (٤ أكتوبر ٢٠٢٦) ═══

   كانت التبويباتُ تنكسر سطرين على حاسوبٍ عرضُه ١٢٨٠: الشريطُ يُعرض من `md`
   وتلتفّ عناصرُه حين يضيق. فصار يُعرض من حيث يتّسع: قِيس على مواضع الحروف
   فتراكب على العلامة عند ١٢٨٠، ومن ١٣٦٠ بقي بينه وبين جارَيه ٤٣ بكسلا فأكثر
   (`SiteShell.tsx`). وزرُّ القائمة يغطّي ما دونه.

   والخطرُ في هذا النقل أن يفترق الحدّان: يُخفى الشريطُ إلى `xl` ويبقى زرُّ
   القائمة مخفيّا من `md` — فيرى زائرُ اللوح رأسا بلا روابطَ ولا قائمة. فالفحصُ
   على **تطابق الحدود الثلاثة** في الرأسين، من أصنافها لا من تعليقٍ فوقها. */
const bpOf = (cls: string, what: 'flex' | 'hidden'): string | null =>
  cls.match(new RegExp(`(?:^|\\s)(sm|md|lg|xl|2xl|min-\\[\\d+px\\]):${what}(?:\\s|$)`))?.[1] ?? null

function menuButtonClass(src: string): string {
  const at = src.indexOf('aria-controls="mobile-menu"')
  if (at < 0) throw new Error('لم يُعثر على زرّ القائمة — تغيّرت بنيةُ الرأس')
  const open = src.lastIndexOf('<button', at)
  const m = src.slice(open, at).match(/className="([^"]*)"/)
  if (!m) throw new Error('زرُّ القائمة بلا صنف')
  return m[1]
}

function mobileNavClass(src: string): string {
  const m = src.match(/<nav id="mobile-menu"[^>]*?className="([^"]*)"/)
  if (!m) throw new Error('لم تُعثر على قائمة الجوال — تغيّرت بنيةُ الرأس')
  return m[1]
}

describe('ولا عرضَ بلا تنقّل، ولا تبويبَ ينكسر سطرين', () => {
  for (const [name, path] of [['رأس الموقع', 'src/components/SiteShell.tsx'], ['رأس الرئيسة', 'src/pages/Home.tsx']] as const) {
    const src = read(path)
    const nav = navClass(src)

    it(`⚠️ ${name}: الشريطُ يظهر حيث يختفي زرُّ القائمة وقائمتُه — بالحدّ نفسِه`, () => {
      const shown = bpOf(nav, 'flex')
      expect(shown, 'الشريطُ بلا حدٍّ يظهر منه').not.toBeNull()
      expect(bpOf(menuButtonClass(src), 'hidden'), 'زرُّ القائمة يختفي قبل أن يظهر الشريط').toBe(shown)
      expect(bpOf(mobileNavClass(src), 'hidden'), 'قائمةُ الجوال تختفي قبل أن يظهر الشريط').toBe(shown)
    })

    it(`⚠️ ${name}: والشريطُ من ١٣٦٠ بكسلا — حيث قِيس أنّه يتّسع بلا تراكب`, () => {
      expect(bpOf(nav, 'flex')).toBe('min-[1360px]')
    })

    it(`${name}: ولا يلتفّ تبويبٌ ولا زرُّ المؤشر سطرين`, () => {
      expect(nav.split(/\s+/), 'تبويباتُ الشريط تلتفّ').toContain('whitespace-nowrap')
      const cta = src.match(/className="(btn-teal hidden[^"]*md:inline-flex[^"]*)"/)
      expect(cta, 'لم يُعثر على زرّ المؤشر في الرأس').not.toBeNull()
      expect(cta![1].split(/\s+/), 'زرُّ «ابدأ مؤشر وجيز» يلتفّ').toContain('whitespace-nowrap')
    })
  }
})
