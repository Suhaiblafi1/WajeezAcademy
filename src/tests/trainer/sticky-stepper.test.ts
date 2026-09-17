/* ═══ سلّمُ الخطوات يبقى في اليد، ويضمر كي لا يبتلع الشاشة ═══

   طلبُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦):

   ① «الشريطُ العلويُّ لتعديل الشعب يجب أن يبقى ظاهرا للمدرّب حتّى يخرج من
      خانة الشعب كلِّها».

      وكان يُصيَّر تحت شرطِ `phase === "prepare"` وحدَه، فيختفي بتبديل الطور
      إلى «مركز التواصل» — فيفقد المدرّبُ سلّمَه ولا يجد طريقَ العودة إلّا
      بلسانٍ فوقه لا يدلّ عليه شيء. وكان يمضي مع التمرير كذلك.

   ② «اجعل الستبر أصغرَ عندما نرفع للأعلى ليتبقّى مساحةٌ جيّدةٌ للمدرّب
      بتعبئة ما هو مطلوبٌ منه».

      فالالتصاقُ وحدَه لا يكفي: رأسٌ لاصقٌ بحلقته وعنوانه وأسطرِ حالته يأكل
      ثلثَ الشاشة في كلّ تمرير، وهو أسوأُ من رأسٍ يمضي.

   والفحصُ على البنية لا على ورودِ صنفٍ في ملفّ: الشرطُ المزال، والمتغيّرُ
   الذي يحمل حالةَ الضمور، والمقاسان المختلفان اللذان يتبدّلان به. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
const LAYOUT = code('src/pages/trainer/TrainerLayout.tsx')

/** جسدُ خطِّ الخطوات — من فتحِ `<ol>` إلى إغلاقه */
const rail = WS.slice(WS.indexOf('<ol className="grid gap-2 md:grid-cols-6">'), WS.indexOf('</ol>'))

describe('① السلّمُ يبقى ظاهرا حتّى يخرج من الشعبة', () => {
  it('⚠️ لا يُصيَّر تحت شرطِ الطور — كان يختفي في «مركز التواصل»', () => {
    const head = WS.slice(WS.indexOf('<Panel'), WS.indexOf('</Panel>'))
    expect(head, 'خطُّ الخطوات غاب عن الرأس').toContain('<ol className="grid gap-2 md:grid-cols-6">')
    /* ما بين لسانِ الطورين وخطِّ الخطوات: لو بقي فيه شرطُ طورٍ لعاد الخطُّ
       يختفي في «مركز التواصل». والقطعةُ هي الحكم لا الملفُّ كلُّه — فالشرطُ
       نفسُه مشروعٌ في مواضعَ أخرى من الشاشة. */
    const betweenTabsAndRail = head.slice(head.indexOf('<TabBar'), head.indexOf('<ol className="grid gap-2 md:grid-cols-6">'))
    expect(betweenTabsAndRail, 'خطُّ الخطوات ما زال مشروطا بطور التجهيز').not.toContain('phase === "prepare"')
  })

  it('والرأسُ لاصقٌ تحت شريط البوّابة — لا فوقه ولا بأعلى الإطار', () => {
    expect(WS, 'الرأسُ يمضي مع التمرير').toMatch(/className=\{`sticky z-30/)
    /* والمقدارُ من المتغيّر المنشور لا رقما مكتوبا بيد: الشريطُ يلفّ سطرَه
       على الهاتف فيطول، ويتبدّل بمعامل التكبير — فرقمٌ هنا يفترق عنه. */
    expect(WS, 'المقدارُ رقمٌ مكتوبٌ بيده').toMatch(/var\(--staff-sticky-top, 0px\)/)
  })

  it('والشريطُ يقيس نفسَه وينشر ارتفاعَه — وإلّا فالمتغيّرُ لا يُكتب', () => {
    expect(LAYOUT).toMatch(/new ResizeObserver\(publish\)/)
    expect(LAYOUT).toMatch(/setProperty\("--staff-sticky-top"/)
    expect(LAYOUT, 'المقاسُ لا يُربَط بالشريط').toMatch(/<header ref=\{headerRef\}/)
  })

  it('ونقرةُ خطوةٍ تعيده إلى التجهيز — وإلّا فسلّمٌ يُرى ولا يُصعد', () => {
    expect(WS).toMatch(/const openStage = \(s: Stage\) => \{ setPhase\("prepare"\); setStage\(s\); \}/)
    expect(rail).toMatch(/onClick=\{\(\) => openStage\(s\.key\)\}/)
  })
})

describe('② ويضمر بالتمرير — مقاسان لا مقاسٌ واحد', () => {
  it('حالةُ الضمور تُشتقّ من التمرير فعلا', () => {
    expect(WS).toMatch(/const \[compact, setCompact\] = useState\(false\)/)
    expect(WS, 'لا مستمعَ تمريرٍ — فالضمورُ لا يقع').toMatch(/window\.addEventListener\("scroll", onScroll/)
    /* وعتبةٌ فوق الصفر: عند الصفر تبدّل ارتعاشةُ إصبعٍ الحالةَ فيهتزّ الرأس */
    const threshold = /setCompact\(window\.scrollY > (\d+)\)/.exec(WS)
    expect(threshold, 'لا عتبةَ للضمور').toBeTruthy()
    expect(Number(threshold![1]), 'العتبةُ صفرٌ — فالرأسُ يهتزّ').toBeGreaterThan(0)
  })

  it('والنصفُ الأعلى من الرأس يُطوى — الحلقةُ والعنوانُ وأسطرُ الحالة', () => {
    expect(WS).toMatch(/flex flex-wrap items-start gap-5 \$\{compact \? "hidden" : ""\}/)
  })

  it('ودوائرُ الخطوات تصغر — مقاسان يتبدّلان لا مقاسٌ ثابت', () => {
    expect(rail, 'الدائرةُ مقاسٌ واحدٌ لا يتبدّل').toMatch(/compact \? "h-7 w-7 text-fine" : "h-10 w-10 text-sm"/)
  })

  it('⚠️ و«لم يُحفَظ» لا تُطوى مع ما يُطوى — تعديلٌ في اليد لا يُكتم', () => {
    /* أسهلُ ما يقع هنا: طيُّ السطر الثاني كلِّه توفيرا للمساحة، فيضمر
       الرأسُ وقد كتب المدرّبُ ما لم يحفظه — فيغادر الصفحةَ ولا شيءَ يقول. */
    expect(rail).toMatch(/\(!compact \|\| dirty\[s\.key\]\)/)
    expect(rail, 'النقطةُ الذهبيّةُ سقطت مع الضمور').toMatch(/\{dirty\[s\.key\] && \(/)
  })
})
