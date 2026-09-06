/* عرض المسار — أرقامٌ حقيقية، كلٌّ منها وعدٌ تُطالَب به الفاتورة.

   كان قرارٌ سابق يُبقي شيئين خلف تسجيلٍ كامل — من يدرّبه وأين يدفع — خلف
   صندوقٍ بثلاث بطاقات أرقام. وقد نُقض هذا القرار بصريح طلب صاحب المنصّة:
   لا داعي للصندوق إطلاقا؛ الزائر يرى كل ما يراه المسجَّل، والتسجيل يُطلب
   فقط لحظة الشراء الفعليّة (انظر describe «التصفح مفتوح للجميع» أدناه).

   وخطر ما تبقّى من عرضٍ رقميّ أنّه يَعِد بمال. فحُرس من ثلاث جهات:
     · «تبدأ من» تُقرأ من أرخص سعر قائمةٍ في الدورات المعروضة نفسها، لا من
       رقمٍ مكتوب في الصفحة — وسعرُ القائمة ترثه الشعبة (cohort.service.ts)
       فتُصدَر به الفاتورة.
     · لا تحويل عملة: العملة تُكتب كما تُصدَر بها الفاتورة. وقد أُزيلت من هذه
       المنصّة تسعيرةٌ مُختلَقة مرّة، ولا تعود.
     · المجموع لا يُعرض ناقصا: دورةٌ بلا سعر تُسقط المجموع كلّه إلى null،
       لأنّ مجموعا ناقصا يُقرأ كاملا. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathwayOffer, formatOfferPrice, PATHWAY_BUNDLE_MAX_PCT } from '../../application/commerce/pathway-offer'
import { FIRST_TIME_PROMO } from '../../application/commerce/first-time-promo'
import { pathwayCourses, pathwaySupportCourses, readyPathwayCourseIds, courseById } from '../../data/courses'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { launch_pathways: { id: string }[]; courses: { course_id: string; list_price: number; list_currency: string }[] }

describe('عرض المسار', () => {
  it('«تبدأ من» أرخص دورة معروضة فعلا — لا رقم مكتوب', () => {
    for (const p of CORE.launch_pathways) {
      const ids = readyPathwayCourseIds(p.id)
      const offer = pathwayOffer(ids)
      const cheapest = Math.min(...ids.map((id) => courseById(id)?.listPrice ?? Infinity))
      expect(offer.fromPrice, p.id).toBe(cheapest)
      expect(offer.fromPrice, p.id).toBeGreaterThan(0)
    }
  })

  it('المجموع يشمل الأساسية والمساندة معا — وهي ما يراه على الشاشة', () => {
    for (const p of CORE.launch_pathways) {
      const core = pathwayCourses[p.id] ?? []
      const sup = (pathwaySupportCourses[p.id] ?? []).map((s) => s.courseId)
      const offer = pathwayOffer([...core, ...sup])
      const sum = [...core, ...sup].reduce((a, id) => a + (courseById(id)?.listPrice ?? 0), 0)
      expect(offer.fullPrice, p.id).toBe(sum)
    }
  })

  it('دورة بلا سعر تُسقط المجموع كلّه — لا مجموع ناقص يُقرأ كاملا', () => {
    const withUnknown = pathwayOffer([...(pathwayCourses['PW-COM-001'] ?? []), 'C-LA-YOUJAD'])
    expect(withUnknown.fullPrice).toBeNull()
    expect(withUnknown.fromPrice).toBeGreaterThan(0)
  })

  it('النسبتان من مصدرهما لا مكتوبتين في الصفحة', () => {
    const offer = pathwayOffer(pathwayCourses['PW-COM-001'] ?? [])
    expect(offer.firstTimePct).toBe(FIRST_TIME_PROMO.percentOff)
    expect(offer.bundleMaxPct).toBe(PATHWAY_BUNDLE_MAX_PCT)
  })

  it('العملة تُكتب كما تُصدَر بها الفاتورة — بلا تحويل', () => {
    expect(formatOfferPrice(125, 'USD')).toBe('$125')
    expect(formatOfferPrice(100, 'JOD')).toBe('100 د.أ')
    expect(formatOfferPrice(90, 'EUR')).toBe('90 EUR')
    expect(new Set(CORE.courses.map((c) => c.list_currency)).size).toBe(1)
  })
})

describe('التصفح مفتوح للجميع — لا بوابة تسجيل على السعر أو الفريق التدريبي', () => {
  const SRC = readFileSync(join(process.cwd(), 'src/pages/Pathway.tsx'), 'utf8')

  /* انقلب القرار: كان الفريق التدريبي ومكان الدفع خلف تسجيلٍ كامل («سجّل
     بالطريقة التي تناسبك» بثلاث بطاقات أرقام وزر «أنشئ حسابك المجاني
     الآن»). وبصريح طلب صاحب المنصّة بعد رؤية الصندوق على الإنتاج: لا داعي
     له إطلاقا — يرى الزائر كل ما يراه المسجَّل، والتسجيل يُطلب فقط لحظة
     الشراء الفعليّة (`pendingCheckout`/`AuthGate`، لا هذا الصندوق). */
  it('لا صندوق «سجّل بالطريقة التي تناسبك» ولا زرّ «أنشئ حسابك المجاني»', () => {
    expect(SRC).not.toMatch(/id="offer"/)
    expect(SRC).not.toMatch(/أنشئ حسابك المجاني الآن/)
  })

  it('الفريق التدريبي وقسم الشراء يُعرضان بلا شرط — لا خلف {user &&', () => {
    expect(SRC).toMatch(/<p id="trainers-reveal"/)
    expect(SRC).not.toMatch(/\{user && \(\s*\n\s*<p id="trainers-reveal"/)
    /* المقيسُ وجودُ المرساة وأنّها بلا شرط — **لا اسمُ وسمِها**. كان الشرطُ
       `<div id="buy"` فاحمرّ يوم صار السطحُ `Panel` في توحيد التصميم، وهو
       تغييرٌ لا يمسّ ما يحرسه هذا السطر. فأيُّ وسمٍ يحملها يفي. */
    expect(SRC).toMatch(/id="buy"/)
    expect(SRC).not.toMatch(/\{user && \(\s*\n\s*<\w+ id="buy"/)
  })

  it('شارة «اعتمده تشخيصك» محذوفة — لا مخفيّة', () => {
    expect(SRC).not.toMatch(/هذا المسار اعتمده تشخيصك — بُني/)
    expect(SRC).not.toMatch(/عد لنتيجتك لإعادة التخصيص/)
  })

  /* كان زرّ الصندوق المحذوف يرسل نيّة شراءٍ وهميّة (`amount:0`) يتلوها قفزٌ
     إلى «trainers-reveal» بعد التسجيل. وبزوال الزرّ صار كل ما يصل بوّابة
     `pendingCheckout` نيّة شراء حقيقية تمرّ مباشرة لخطّتها/دفعها. */
  it('لا مسلك قفزٍ خاص لنيّة عرضٍ وهميّة بعد الآن', () => {
    expect(SRC).not.toMatch(/getElementById\("trainers-reveal"\)\?\.scrollIntoView/)
    expect(SRC).toMatch(/if \(intent\?\.kind === "pathway"\) void goToPlan\(intent\);/)
  })
})

/* عصرُ «طلب التسجيل» انتهى — والحارسُ يمنع عودتَه لا يوثّق مضيَّه.

   قرارُ صاحب المنصّة: «الدفع يكون مباشرة وليس بطلب التسجيل… واجعل عمليّة
   الشراء تتمّ **قبل** نقله لمنصّته». والدعوةُ القديمة («اطلب تسجيلك») كانت
   تقود إلى نافذةٍ تقول إنّ الدفع لم يُفتح بعد وتحيل إلى نموذج تواصل — وهي
   نصٌّ يبقى في الصفحات بعد أن تزول آلتُه، فيَعِد بما لم يعد يقع. */
describe('الشراءُ مباشرٌ في الصفحتين اللتين يقع فيهما القرار', () => {
  const PAGES = ['src/pages/Pathway.tsx', 'src/pages/CoursePath.tsx']

  for (const f of PAGES) {
    const src = readFileSync(join(process.cwd(), f), 'utf8')

    it(`${f}: لوحُ الشراء لا نافذةُ الطلب`, () => {
      expect(src, 'المكوّن المحذوف عاد').not.toMatch(/EnrollRequest/)
      expect(src).toMatch(/<BuyPanel\b/)
    })

    it(`${f}: ولا دعوةَ «اطلب تسجيلك» — النصُّ يَعِد بما يقع`, () => {
      expect(src).not.toMatch(/اطلب تسجيلك/)
    })
  }

  it('واللوحُ يقرأ سعرَه من الخادم لا يحسبه — فالمعروضُ هو المُصدَر', () => {
    const panel = readFileSync(join(process.cwd(), 'src/components/BuyPanel.tsx'), 'utf8')
    expect(panel, 'اللوحُ لا يسأل الخادمَ عن السعر').toMatch(/\/api\/learner\/checkout\/quote/)
    expect(panel).toMatch(/\/api\/learner\/checkout/)
    expect(panel).toMatch(/\/pay/)
    /* رجوعُ المتصفّح ليس دليلَ دفع — التسويةُ بـwebhook موقَّع */
    expect(panel).toMatch(/redirectUrl/)
    /* والكودُ يُرسَل فعلا. كان يُعرض على الشاشة ولا يُرسل، فيُوعَد ولا يُخصم. */
    expect(panel, 'الكودُ يُكتب ولا يُرسَل').toMatch(/couponCode/)
  })

  it('ولا تحويلَ عملةٍ على سطحٍ يقبض المال — فرعُ التحويل كلُّه محذوف', () => {
    for (const f of ['src/services/currency.ts', 'src/components/CurrencyPicker.tsx', 'src/components/EnrollRequest.tsx']) {
      expect(existsSync(join(process.cwd(), f)), `${f} ما زال قائما`).toBe(false)
    }
  })
})

/* بوّابةُ نتيجة التشخيص (ResultGate) حُذفت — «نعم يشمل الجميع» بصريح كلام
   صاحب المنصّة. وحُذف بعدها صندوقُ «بريدٌ مقابل كود الخصم» الذي وُضع بديلا
   عنها، بقراره أيضا: «لا داعي لهذه الخانة لأنه عند الشراء سيضع ايميله».

   فالكودُ صار معلَنا في بطاقة الفئات نفسِها — لأنّه لأوّل شراءٍ لكلّ أحد،
   لا خصمَ فئةٍ يُصدَر بعد تحقّق. وحُذف معه مسارُ الخادم وخدمتُه وبريدُه:
   خادمٌ بلا شاشةٍ تناديه دينٌ لا حارس له. */
describe('بوّابةُ النتيجة وصندوقُ البريد — كلاهما محذوف', () => {
  it('لا ResultGate.tsx ولا استيرادٌ له في صفحة التشخيص', () => {
    expect(existsSync(join(process.cwd(), 'src/components/ResultGate.tsx')), 'ResultGate.tsx ما زال قائما').toBe(false)
    const diag = readFileSync(join(process.cwd(), 'src/pages/Diagnostic.tsx'), 'utf8')
    expect(diag).not.toMatch(/ResultGate/)
  })

  it('لا مكوّنَ التقاطِ بريدٍ ولا مسارَ خادمٍ له — ولا استيرادٌ في أيّ صفحة', () => {
    expect(existsSync(join(process.cwd(), 'src/components/DiscountEmailCapture.tsx'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'server/http/routes/leads.routes.ts'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'server/services/leads.service.ts'))).toBe(false)
    for (const f of ['src/pages/Pathway.tsx', 'src/pages/Diagnostic.tsx']) {
      expect(readFileSync(join(process.cwd(), f), 'utf8'), f).not.toMatch(/DiscountEmailCapture/)
    }
    expect(readFileSync(join(process.cwd(), 'server/http/app.ts'), 'utf8')).not.toMatch(/registerLeadRoutes/)
  })

  it('كودُ أوّل الشراء معلَنٌ في بطاقتَي الفئات — لا مخفيّا وراء بريد', () => {
    for (const f of ['src/pages/Pathway.tsx', 'src/pages/CoursePath.tsx']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      expect(src, f).toMatch(/FIRST_TIME_PROMO\.code/)
      expect(src, `${f}: الجملة الجديدة`).toMatch(/لمعرفة الكود للطلبة وموظفي الحكومة/)
    }
  })

  it('الكود نفسه مصدرٌ واحد — لا رقم مكرَّر في المكوّن', () => {
    expect(FIRST_TIME_PROMO.code).toBe('WA2026')
  })
})
