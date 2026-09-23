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

/** صنفُ الشريط الأفقيّ في رأسٍ ما — الشريطُ المخفيُّ دون `md` */
function navClass(src: string): string {
  const m = src.match(/<nav className="(hidden items-center[^"]*md:flex[^"]*)"/)
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
