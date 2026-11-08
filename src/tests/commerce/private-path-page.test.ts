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
  it('⚠️ زر واحد «أكمل التسجيل» يفتح لوح الدفع القائم بالدورات والكود نفسيهما', () => {
    expect(PAGE.match(/أكمل التسجيل/g)?.length, 'أكثر من زر شراء أو بلا زر').toBe(1)
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
    expect(PAGE).toMatch(/apiGet<[^>]+>\(`\/api\/public\/go\/\$\{code\}`\)/)
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

  it('⚠️ «مسار {الاسم الأول}» وتحته السطر، و«سبب اختيارها لك» بارزا تحت عنوان كل دورة', () => {
    expect(PATH_SUBTITLE_AR).toBe('دورات اخترناها لك بناءً على خبرتك')
    expect(REASON_LABEL_AR).toBe('سبب اختيارها لك')
    expect(PAGE).toMatch(/<h1[^>]*>مسار \{v\.firstName\}<\/h1>\s*<p[^>]*>\{PATH_SUBTITLE_AR\}<\/p>/)
    expect(PAGE).toMatch(/reasonsProminentLabelAr=\{REASON_LABEL_AR\}/)
    /* وفي الرحلة: تحت زرّ العنوان مباشرةً — وسطرُ «لماذا هي في خطتك» لا يتكرّر معه، ويبقى لغيرها كما كان */
    expect(JOURNEY).toMatch(/<\/CollapsibleTrigger>\s*\{reasonsProminentLabelAr && reasons\?\.\[c\.id\] && \(/)
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
