/* صفحةُ «مسار {الاسم الأوّل}» — `/go/<رمز>` (٥ نوفمبر ٢٠٢٦). والخادمُ في `server/tests/commerce/private-path.test.ts`.

   وهنا ما تقوله الصفحةُ وما لا تقوله: زرٌّ واحدٌ «أكمل التسجيل» يفتح لوحَ الدفع القائم بالدورات والكود نفسيهما ورمزِ مولّده،
   ولا اقتراحَ لغيرها ولا «ابنِ مسارك»، ولا تُفهرَس، والأرقامُ من الخادم لا من حسابٍ فيها. ومعاينةُ واتساب معاينةُ الموقع
   (`index.html`) — فلا اسمَ ولا كودَ فيها. والفحصُ على البنية، والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanReason, firstNameAr, goPath, GO_CODE_RE, PATH_REASON_MAX, PATH_SUBTITLE_AR, privatePathPrice, REASON_LABEL_AR,
} from '@/application/commerce/private-path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/PrivatePath.tsx')
const APP = code('src/App.tsx')
const BUILDER = code('src/components/BuyLinkBuilder.tsx')
const PATHWAY = code('src/pages/Pathway.tsx')
const JOURNEY = code('src/components/CourseJourney.tsx')

describe('صفحة المسار الخاص', () => {
  it('⚠️ «أكمل التسجيل» يفتح لوح الدفع القائم بالدورات والكود نفسيهما — من البطاقة ومن الزر الثابت، بطريق واحد', () => {
    /* زرّان بقرار صاحب المنصّة (٨ نوفمبر ٢٠٢٦): البطاقةُ أسفلَ الصفحة، وزرٌّ صغيرٌ ثابتٌ على الشاشة. وطريقُهما واحد (`buy`) */
    expect(PAGE.match(/أكمل التسجيل/g)?.length, 'زر شراء ثالث أو بلا زر').toBe(2)
    expect(PAGE).toMatch(/<Button tone="confirm" className="mt-4 w-full" onClick=\{buy\} disabled=\{!ready\}>أكمل التسجيل<\/Button>/)
    expect(PAGE).toMatch(/onClick=\{ready \? buy : \(\) => document\.getElementById\("buy"\)/)
    expect(PAGE.match(/<BuyPanel\b/g)?.length, 'لوح دفع ثان').toBe(1)
    /* بدوراتها كما هي الآن — بعد الاستبدال إن كان — وبشعبها المختارة */
    expect(PAGE).toMatch(/<BuyPanel[\s\S]*?initialCoupon=\{v\.couponCode \?\? ""\}[\s\S]*?lines=\{courseIds\.map\(\(id\) => \(\{ courseId: id, name: titleOf\(id\), cohortId: picked\[id\] \}\)\)\}/)
    expect(PAGE, 'لا ينسب الطلب إلى مولد الرابط').toMatch(/rememberBuyLink\(r\.buyLinkToken\)/)
  })

  it('⚠️ لا اقتراح لغيرها ولا «ابن مسارك» — ولا حساب للسعر فيها', () => {
    expect(PAGE).not.toMatch(/ابن(ِ)? مسارك|suggest|Suggested|priceCart|grantPrice/)
    /* ولا ما يقترحه قالبُ المسار المعتاد خارجه: «أضف دورة»، و«مسار جاهز يناسبك»، و«مجّانا لك الآن»، وبدائلُ الموسم */
    expect(PAGE).not.toMatch(/ReadySeasonPathway|FreeNowPerks|pathwayExtraOptions|useSeasonReplacements|أضف دورة/)
    expect(PAGE).toMatch(/swapOnly: true,[\s\S]*?maxReached: true,/)
    expect(PAGE, 'بدائل دورات لا تشترى هذا الموسم').not.toMatch(/\bunavailable,\n/)
    /* والمسارُ من الخادم وحدَه — من الطلب المبكر، وما خاب منه عاديّا */
    expect(PAGE).toMatch(/const path = `\/api\/public\/go\/\$\{code\}`;/)
    expect(PAGE).toMatch(/takeEarly\(path\)/)
    expect(PAGE).toMatch(/apiGet<[^>]+>\(path\)/)
  })

  it('⚠️ لا تفهرس — ومعاينة واتساب معاينة الموقع بلا اسم ولا كود', () => {
    expect(PAGE).toMatch(/<SeoHead[^>]*noindex/)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toMatch(/<meta property="og:site_name" content="أكاديمية وجيز" \/>/)
    expect(html).toMatch(/<meta property="og:image" content="%VITE_SITE_ORIGIN%\/og-image\.png\?v=2" \/>/)
  })

  it('⚠️ طريقها في التطبيق — والأداة تعطي الرابط القصير بسبب لكل دورة', () => {
    expect(APP).toMatch(/<Route path="\/go\/:code" element=\{<PrivatePathPage \/>\} \/>/)
    expect(BUILDER).toMatch(/const full = r\.goUrl \?\? /)
    expect(BUILDER).toMatch(/aria-label="سبب اختيار الدورة"[\s\S]*?maxLength=\{PATH_REASON_MAX\}/)
  })

  it('الاسم الأول وحده، والسبب سطر بحده، والرمز بشكله', () => {
    expect(firstNameAr('  صهيب عبد الله الخطيب ')).toBe('صهيب')
    expect(cleanReason('  سطر\n  ثان  ')).toBe('سطر ثان')
    expect(cleanReason('   ')).toBeNull()
    expect(cleanReason('أ'.repeat(500))?.length).toBe(PATH_REASON_MAX)
    expect(goPath('X7K2PQ9A')).toBe('/go/X7K2PQ9A')
    for (const bad of ['', 'abc', '../etc', 'X7K2PQ9A-', 'X'.repeat(13)]) expect(GO_CODE_RE.test(bad), bad).toBe(false)
  })
})

/* ═══ وبقالب صفحة المسار المعتادة (٨ نوفمبر ٢٠٢٦) ═══
   «تُعرض /go/:token بالقالب نفسه الذي تستخدمه صفحات المسار المعتادة، بكل تفاصيله» — مع العنوان والسبب البارز،
   والسعرُ يُسأل عنه الخادمُ بعد كلّ استبدال. */
describe('صفحة المسار الخاص بقالب صفحة المسار', () => {
  it('⚠️ القالب نفسه: الشريط وصندوق «منظومة كاملة» من موضع واحد تقرؤه الصفحتان، والرحلة نفسها بالشعب', () => {
    for (const [name, src] of [['/go', PAGE], ['/pathways', PATHWAY]] as const) {
      expect(src, `${name} بلا شريط القالب`).toMatch(/<PathwayTopBar user=\{/)
      expect(src, `${name} بلا «منظومة كاملة»`).toMatch(/<PathwayEcosystemPanel \/>/)
    }
    expect(PATHWAY, 'نسخة ثانية من «منظومة كاملة» في صفحة المسار').not.toMatch(/تأخذ منظومة كاملة/)
    /* والشعبُ ظاهرةٌ (صورةُ المدرّب ونبذتُه و«مباشر» وأوّلُ لقاء) — `showSchedule` يفتحها في `CohortPicker` */
    expect(PAGE).toMatch(/<CourseJourney[\s\S]*?showSchedule[\s\S]*?picked=\{picked\}[\s\S]*?onPick=/)
  })

  it('⚠️ العنوان والسطر تحته آليان من دوراته الآن، و«سبب اختيارها لك» بارزا أسفل كل دورة', () => {
    expect(PATH_SUBTITLE_AR).toBe('دورات اخترناها لك بناءً على خبرتك')
    expect(REASON_LABEL_AR).toBe('سبب اختيارها لك')
    expect(PAGE).toMatch(/<h1[^>]*>\{headline\.titleAr\}<\/h1>\s*<p[^>]*>\{headline\.subtitleAr\}<\/p>/)
    /* ومن السلّة الحاليّة لا من دورات الرابط — فيتبدّلان مع «استبدالها» */
    expect(PAGE).toMatch(/privatePathHeadline\(\{[\s\S]*?courses: courseIds\.map\(/)
    expect(PAGE).toMatch(/reasonsProminentLabelAr=\{REASON_LABEL_AR\}/)
    /* وفي الرحلة: تحت زرّ العنوان مباشرةً — وسطرُ «لماذا هي في خطتك» لا يتكرّر معه، ويبقى لغيرها كما كان */
    /* أسفلَ الدورة (٨ نوفمبر ٢٠٢٦): بعد شعبها ومهاراتها، لا تحت عنوانها */
    expect(JOURNEY).not.toMatch(/<\/CollapsibleTrigger>\s*\{reasonsProminentLabelAr && reasons\?\.\[c\.id\] && \(/)
    const at = (re: RegExp) => JOURNEY.search(re)
    expect(at(/data-testid="course-reason"/)).toBeGreaterThan(at(/<CohortPicker\s/))
    expect(at(/data-testid="course-reason"/)).toBeGreaterThan(at(/c\.relatedSkills\.slice/))
    expect(JOURNEY).toMatch(/\{!reasonsProminentLabelAr && reasons\?\.\[c\.id\] && \(/)
    expect(PATHWAY, 'صفحة المسار المعتادة صار سببها بارزا').not.toMatch(/reasonsProminentLabelAr/)
  })

  it('⚠️ بعد الاستبدال أو تبديل الشعبة: السعر من الخادم بالكود نفسه، والزر معطل حتى يصل بلا مشكلة', () => {
    expect(PAGE).toMatch(/apiPost<PreviewReply>\("\/api\/public\/checkout\/preview", \{[\s\S]*?couponCode: v\.couponCode[\s\S]*?asVisitor: true,/)
    expect(PAGE).toMatch(/setAnswered\(\{ key, state: "ready", price: privatePathPrice\(r\), problemAr \}\)/)
    expect(PAGE).toMatch(/const ready = current\.state === "ready" && current\.price !== null && !current\.problemAr/)
    expect(PAGE).toMatch(/<Button tone="confirm"[^>]*onClick=\{buy\} disabled=\{!ready\}>أكمل التسجيل<\/Button>/)
    /* والبدائلُ بقاعدة المسار الجاهز: العددُ ثابت، وما يُشترى هذا الموسم */
    expect(PAGE).toMatch(/swapCandidates\(\{/)
  })

  it('قراءة السعر من معاينة الخادم: الأصلي، وكل ما طرح منه، وما يدفع — بلا حساب غيره', () => {
    expect(privatePathPrice({
      currency: 'JOD', subtotal: 400, couponDiscount: 150, bundleDiscount: 30, capDiscount: 10, planCredit: 5, total: 205, grantNameAr: 'منحة وجيز',
    })).toEqual({ currency: 'JOD', before: 400, grant: 195, grantNameAr: 'منحة وجيز', total: 205 })
    expect(privatePathPrice({ currency: 'JOD', subtotal: 100, couponDiscount: 0, bundleDiscount: 0, capDiscount: 0, planCredit: 0, total: 100 }).grantNameAr).toBeNull()
  })
})

describe('فتح صفحة المسار الخاص بلا وميض (٨ نوفمبر ٢٠٢٦)', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8')

  it('⚠️ طلب المسار والشعب والكتالوج الخفيف يبدأ مع الصفحة على /go — والصفحة تقرأ الخفيف', () => {
    const early = /<script>\s*\/\*[\s\S]*?\*\/\s*(\(function \(\) \{[\s\S]*?__wajeezEarly[\s\S]*?\}\)\(\);)/.exec(html)?.[1] ?? ''
    expect(early).toMatch(/\^\\\/go\\\/\(\[A-Za-z0-9\]\{6,12\}\)/)
    expect(early).toContain('"/api/public/go/" + go[1].toUpperCase()')
    expect(early).toMatch(/else if \(go\) urls = \[[^\n]*?"\/api\/public\/cohorts", "\/api\/public\/core-catalog\?lite=1"\]/)
    expect(early, 'الكتالوج الكامل (٢ ميغا) عاد إلى /go').not.toContain('"/api/public/core-catalog"')
    expect(PAGE).toMatch(/usePublishedContent\(\{ lite: true \}\)/)
  })

  it('⚠️ نص الرئيسة يخفى حين لا يطابق canonical المسار المفتوح — وتظهر علامة تحميل', () => {
    expect(html).toMatch(/link\[rel="canonical"\][\s\S]*?setAttribute\("data-shell-other", ""\)/)
    expect(html).toMatch(/\[data-shell-other\] #root > \[data-seo\] \{ display: none; \}/)
    /* قبل #root لا بعده — فلا يُرسم النصُّ ثمّ يُخفى */
    expect(html.indexOf('data-shell-other')).toBeLessThan(html.indexOf('<div id="root">'))
  })

  it('⚠️ لا بطاقات مختصرة قبل الكتالوج والشعب — هيكل ثم القالب', () => {
    expect(PAGE).toMatch(/const journeyReady = hasCoreCatalog\(\) && cohortsLoaded;/)
    expect(PAGE).toMatch(/\{!journeyReady \? \([\s\S]*?animate-pulse[\s\S]*?\) : \([\s\S]*?<CourseJourney[\s\S]*?outsideCatalog\.length > 0/)
  })
})

describe('كيف يختار بين الشعب (٨ نوفمبر ٢٠٢٦)', () => {
  it('⚠️ فوق الشعب: نفس الدورة والشهادة، والفرق الموعد والمدرب والمحاور — لا «اختر الموعد والمدرب» وحدها', () => {
    const picker = code('src/components/CohortPicker.tsx')
    expect(picker).not.toContain('— اختر الموعد والمدرب')
    expect(picker).toMatch(/\{cohortsCountAr\(cohorts\.length\)\} \{COHORT_CHOICE_LEAD_AR\}/)
    expect(picker).toContain('"لنفس الدورة ونفس الشهادة. اختر واحدة حسب:"')
    for (const label of ['الموعد', 'المدرب', 'المحاور']) expect(picker).toContain(`{ label: "${label}", text: "`)
    expect(picker).toMatch(/COHORT_CHOICE_HINTS_AR\.map\(/)
  })
})

describe('تفاصيل الدورة زر ظاهر قبل الشعب (٨ نوفمبر ٢٠٢٦)', () => {
  it('⚠️ «كل تفاصيل الدورة» زر بسهم ظاهر — والتفاصيل تنفتح في مكانها قبل الشعب لا بعدها ولا في نافذة', () => {
    const at = (re: RegExp) => JOURNEY.search(re)
    const toggle = at(/data-testid="course-details-toggle"/)
    expect(toggle).toBeGreaterThan(-1)
    expect(JOURNEY).toMatch(/data-testid="course-details-toggle"[\s\S]*?كل تفاصيل الدورة[\s\S]*?إخفاء التفاصيل[\s\S]*?<ChevronDown className="h-5 w-5/)
    const content = at(/<CollapsibleContent className="overflow-hidden/)
    expect(content, 'التفاصيل قبل الزر').toBeGreaterThan(toggle)
    expect(content, 'التفاصيل بعد الشعب').toBeLessThan(at(/<CohortPicker\s/))
    /* ولا سهمٌ صغيرٌ بجانب العنوان بعدُ — زرٌّ واحدٌ يُرى */
    expect(JOURNEY).not.toMatch(/\{c\.title\}\s*<\/span>\s*<ChevronDown/)
  })
})

describe('الدفع زر صغير ثابت، والبطاقة بعد «تفتح تلقائيا» (٨ نوفمبر ٢٠٢٦)', () => {
  it('⚠️ البطاقة أسفل الصفحة بعد جملة فتح المنصة، والزر الثابت يختفي حين تظهر', () => {
    const at = (re: RegExp) => PAGE.search(re)
    expect(at(/data-testid="private-path-price"/)).toBeGreaterThan(at(/تفتح تلقائيا بعد أول دفع ناجح/))
    expect(at(/data-testid="private-path-price"/)).toBeGreaterThan(at(/<PathwayEcosystemPanel \/>/))
    expect(PAGE).toMatch(/\{showPrice && !buyInView && !buyOpen && !authOpen && \([\s\S]*?fixed inset-x-0 bottom-0[\s\S]*?data-testid="private-path-sticky-buy"/)
    expect(PAGE).toMatch(/new IntersectionObserver\(\(\[e\]\) => setBuyInView\(e\.isIntersecting\)/)
  })
})

describe('الهاتف والأسهم الصغيرة (٨ نوفمبر ٢٠٢٦)', () => {
  it('⚠️ على الهاتف: الرقم بجانب العنوان لا عمودا، وخط الرحلة يخفى', () => {
    expect(JOURNEY).toMatch(/z-10 hidden h-8 w-8[^"]*sm:grid/)
    expect(JOURNEY).toMatch(/sm:hidden">\s*\{isSupport \? <LifeBuoy className="h-3 w-3" \/> : i \+ 1\}/)
    expect(JOURNEY).toMatch(/absolute right-\[15px\] top-10 hidden [^"]*sm:block/)
  })
  it('⚠️ «لقاءات مباشرة» و«كل الشعب»: سهم يرى وكلمة تقول ما خلفه', () => {
    const live = code('src/components/LiveSessionDates.tsx')
    expect(live).toMatch(/\{open \? "إخفاء" : "كل المواعيد"\}\s*<ChevronDown className=\{`h-4 w-4/)
    expect(code('src/components/CohortPicker.tsx')).toMatch(/كل الشعب \(\{cohorts\.length\}\)\s*<ChevronDown className="h-4 w-4"/)
  })
  it('⚠️ الشريط العلوي سطر واحد على الهاتف', () => {
    const chrome = code('src/components/PathwayChrome.tsx')
    expect(chrome).toMatch(/<span className="hidden text-sm font-medium sm:inline">الرئيسية<\/span>/)
    expect(chrome).toMatch(/whitespace-nowrap font-black">أكاديمية وجيز/)
    expect(chrome).toMatch(/<span className="hidden sm:inline">\{user\}<\/span>/)
  })
})
