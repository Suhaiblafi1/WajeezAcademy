/* بنيةُ العقد المعروضة — ولا يسقط سطر.
 *
 * ── العطبُ الذي يحرسه أوّلا ──
 *
 * المتنُ يُجمَّد في `bodyAr` وتُحفظ بصمتُه، ويُوقَّع على **ما عُرض**. فمحلّلٌ
 * يُسقط سطرا لا يطابق أنماطَه يُخفيه عن عين الموقِّع ويُبقيه في المهشَّم —
 * فيوقّع إنسانٌ على نصٍّ لم يُعرَض له قطّ. وهذا أخطرُ ما في تحويل المتن من
 * كتلةٍ واحدةٍ إلى وثيقةٍ مبنيّة.
 *
 * فالحارسُ الأوّلُ هنا يقابل ما ستعرضه الوثيقةُ بأسطر المتن غيرِ الفارغة،
 * على **المتن الحيّ** لا على نصٍّ مختلَق: ٣٥٩ سطرا، عشرون بندا وأربعةُ
 * ملاحق.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ContractDocument from '@/components/ContractDocument'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseContractDoc, documentLinesAr, blockLineAr, sectionHeadingAr,
  summaryItem, exampleRow, exampleTotal, feeRuleRows,
} from '@/application/trainer/contract-sections'
import { renderContractBodyAr, type ConditionalTerms } from '@/application/trainer/contract-body'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** المتنُ الحيّ بحروفه — لا نصٌّ مختلَقٌ يجامل المحلّل */
/** المتنُ الحيُّ بحروفه — لا نصٌّ مختلَقٌ يجامل المحلّل */
const liveBody = (conditional: ConditionalTerms | null) => renderContractBodyAr({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr ?? '',
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr ?? 'أكاديمية وجيز',
  governingLawAr: ACADEMY_LEGAL.governingLawAr ?? '',
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr ?? '',
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٢٣ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }, { courseId: 'C-2', titleAr: 'دورةٌ ثانية' }],
  compensation: { type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: '45' },
  rateWaivedReasonAr: null,
  hoursNoteAr: 'أربعُ وحدات',
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional,
})

/* والقياسُ على الصورتَين: العرضُ المشروطُ يزيد بنودا ومواعيد، فمحلّلٌ
   يتمّ على أحدِهما وحدَه ليس تامّا. */
const CONDITIONAL: ConditionalTerms = {
  orientationOnAr: '١ أكتوبر ٢٠٢٦',
  deadlineOnAr: '٨ أكتوبر ٢٠٢٦',
  windowDays: 7,
  extensionDays: 2,
}

const LIVE = liveBody(null)

const sourceLines = LIVE.split('\n').map((l) => l.trim()).filter(Boolean)
const doc = parseContractDoc(LIVE)

describe('لا يسقط سطر — المعروضُ هو الموقَّعُ عليه', () => {
  it('كلُّ سطرٍ غيرِ فارغٍ من المتن يخرج في الوثيقة، بترتيبه وحرفِه', () => {
    /* المقابلةُ على القائمة كلِّها لا على عددها: عددٌ يتساوى وسطرٌ يُبدَّل
       بآخرَ يمرّ، والمقصودُ أن يُعرَض ما وُقّع عليه بعينه. */
    expect(documentLinesAr(doc)).toEqual(sourceLines)
  })

  /* والعرضُ المشروطُ يزيد بنودا ومواعيد — ومحلّلٌ يتمّ على صورةٍ
     واحدةٍ وحدَها ليس تامّا. وهذا هو المتنُ الذي يوقّعُه المدرّبُ اليوم. */
  it('وكذلك في العرض المشروط — وهو متنٌ أطول', () => {
    const body = liveBody(CONDITIONAL)
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lines.length, 'المشروطُ لا يزيد شيئا — أفُقدَ الفرق؟').toBeGreaterThan(sourceLines.length)
    expect(documentLinesAr(parseContractDoc(body))).toEqual(lines)
  })

  it('والمتنُ المقيسُ هو الحيُّ لا مختلَقٌ — عشرون بندا وأربعةُ ملاحق', () => {
    expect(doc.sections.filter((s) => s.kind === 'clause')).toHaveLength(20)
    expect(doc.sections.filter((s) => s.kind === 'annex')).toHaveLength(4)
    expect(sourceLines.length).toBeGreaterThan(150)
  })

  /* وسطرٌ لا يطابق نمطا ليس عذرا للإسقاط: يصير نصّا كما هو */
  it('وسطرٌ غريبٌ لا يطابق نمطا يخرج نصّا — لا يُهمَل', () => {
    const odd = 'عنوان\n\nالبند 1 — أوّل\n\nسطرٌ لا نمطَ له ¤ ولا رقم\n'
    expect(documentLinesAr(parseContractDoc(odd))).toEqual(['عنوان', 'البند 1 — أوّل', 'سطرٌ لا نمطَ له ¤ ولا رقم'])
  })

  /* وما ورد قبل أوّل عنوانٍ لا يضيع — وهو أسهلُ موضعٍ يسقط فيه سطر */
  it('وما قبل أوّل عنوانٍ يخرج أيضا', () => {
    const early = 'عنوان\n\nسطرٌ سابقٌ لكلّ عنوان\n\nالبند 1 — أوّل\n'
    expect(documentLinesAr(parseContractDoc(early))).toContain('سطرٌ سابقٌ لكلّ عنوان')
  })
})

describe('الترويسةُ ثلاثةٌ بأسمائها لا كلُّ سطرٍ فيه نقطتان', () => {
  it('المرجعُ وتاريخُ الإصدار وإصدارُ الصياغة', () => {
    expect(doc.meta.map((m) => m.labelAr)).toEqual(['المرجع', 'تاريخ الإصدار', 'إصدار الصياغة'])
  })

  /* و«label:» يرد ثمانيا في المتن، خمسٌ منها داخل البنود — فلو أُخذ كلُّ ما
     فيه نقطتان ترويسةً لانتُزعت جملٌ من أماكنها إلى الصدر. */
  it('ولا يُنتزع سطرٌ فيه نقطتان من داخل بندٍ إلى الصدر', () => {
    const inside = doc.sections
      .flatMap((s) => s.blocks.map(blockLineAr))
      .filter((t) => /^[^:]{1,24}:\s/.test(t) || /^· [^:]{1,24}:\s/.test(t))
    expect(inside.length, 'لا سطرَ بنقطتين داخل الأقسام — أتغيّر المتن؟').toBeGreaterThan(4)
    for (const t of inside) {
      expect(doc.meta.some((m) => t.startsWith(`${m.labelAr}:`)), `انتُزِع إلى الصدر: ${t.slice(0, 40)}`).toBe(false)
    }
    /* و«الطرف الأول:» في الديباجة هو موضعُ الخطر بعينه — ولو أُخِذ كلُّ ما فيه نقطتان لَصار ترويسة */
    expect(inside.some((t) => t.startsWith('الطرف الأول:'))).toBe(true)
  })
})

describe('الترقيمُ يُبرَز ولا يُطرَح', () => {
  it('«4-1» يُفصَل رقما ونصّا، ويُعاد سطرا كما كان', () => {
    const four = doc.sections.find((s) => s.kind === 'clause' && s.numAr === '4')!
    const first = four.blocks.find((b) => b.kind === 'clause')!
    expect(first.kind === 'clause' && first.numAr).toBe('4-1')
    expect(blockLineAr(first).startsWith('4-1 ')).toBe(true)
  })

  it('وعنوانُ القسم يُعاد بناؤه حرفا بحرف', () => {
    const four = doc.sections.find((s) => s.kind === 'clause' && s.numAr === '4')!
    expect(sectionHeadingAr(four)).toBe('البند 4 — الأتعاب')
    const annex = doc.sections.find((s) => s.kind === 'annex')!
    expect(sectionHeadingAr(annex)).toBe(`الملحق (${annex.numAr}) — ${annex.titleAr}`)
  })

  it('والنقاطُ تُعرف نقاطا', () => {
    const bullets = doc.sections.flatMap((s) => s.blocks).filter((b) => b.kind === 'bullet')
    expect(bullets.length, 'لا نقطةَ في المتن — أتغيّر؟').toBeGreaterThan(0)
  })
})

describe('البنيةُ مشتقّةٌ من المتن لا مكتوبةٌ إلى جانبه', () => {
  it('لا قائمةَ بنودٍ مكتوبةً بيدٍ في وحدة البنية', () => {
    /* مصدرٌ ثانٍ يفترق عن المتن يومَ يُعدَّل أحدُهما، فيوقّع على غير ما رأى */
    /* والتعليقُ يُنزَع أوّلا: رأسُ الوحدة يشرح لمَ لا تُكتب قائمةُ البنود
       باليد، فيسوق أسماءَها في سياقه — ولو قُرئ النصُّ خاما لَسقط الحارسُ
       على شرحِ ما يحرسُه. وهي مصيدةُ «طابقوا نصّا في تعليق» بعينِها. */
    const src = read('src/application/trainer/contract-sections.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(src).not.toMatch(/الأتعاب|السرّيّة|الملكية الفكرية/)
    expect(src).toMatch(/export function parseContractDoc/)
  })
})

describe('والوثيقةُ تعرض كلّ ما حلّله المحلّل', () => {
  /* المحلّلُ تامٌّ ولا ينفع إن أسقط العارضُ نوعا منه: نقطةٌ لا تُرسَم
     تغيب عن عين الموقِّع كما تغيب لو أسقطها المحلّل. */
  it('أنواعُ الكتل الثلاثةُ تُرسَم نصّا — ولا واحدٌ منها يُرسَم عدما', () => {
    const src = read('src/components/ContractDocument.tsx')
    const blocks = src.slice(src.indexOf('function Para'), src.indexOf('function Summary'))
    expect(blocks.length, 'لم تُقرأ دالّةُ الكتل أصلا').toBeGreaterThan(200)
    /* والفحصُ على **ما يُخرَج** لا على ورودِ اسم النوع: `kind === 'bullet'`
       يبقى مكتوبا ولو صار فرعُه `return null`، وهي مصيدةُ الخضرة الكاذبة
       التي يحذّر منها CLAUDE.md. فيُعَدّ ما يُطبَع من نصِّ الكتلة. */
    expect(
      (blocks.match(/\{b\.textAr\}/g) ?? []).length,
      'فرعٌ من فروع الكتل لا يطبع نصَّها — وقِّع على ما لم يُعرَض',
    ).toBe(5)
    expect(blocks, 'كتلةٌ تُرسَم عدما — تغيب عن عين الموقِّع وتبقى في المهشّم').not.toMatch(/return null/)
    for (const kind of ['clause', 'bullet']) {
      expect(blocks, `نوعُ كتلةٍ لا يُمَيَّز: ${kind}`).toMatch(new RegExp(`kind === '${kind}'`))
    }
  })

  it('وتُمرّ على الكتل كلِّها بلا غربلة', () => {
    const src = read('src/components/ContractDocument.tsx')
    expect(src).toMatch(/section\.blocks\.map\(/)
    expect(src, 'غربلةٌ على الكتل — ما سقط منها وُقِّع عليه ولم يُعرَض').not.toMatch(/blocks\.filter\(/)
  })

  it('والأقسامُ كلُّها تُعرَض — والخلاصةُ تُنقَل لا تُحذَف', () => {
    const src = read('src/components/ContractDocument.tsx')
    /* الخلاصةُ تُرفَع إلى لوحِها، والباقي ما سواها — فلا يسقط قسم */
    expect(src).toMatch(/const rest = doc\.sections\.filter\(\(s\) => s !== summary\)/)
    expect(src).toMatch(/rest\.map\(/)
  })
})

/* ═══ والدليلُ الأخير: ما يُطبَع فعلا ═══

   الحرّاسُ أعلاه تقرأ المصدرَ نصّا، ونصٌّ يُقرأ لا يُثبِت ما يراه الموقِّع:
   فرعٌ يردّ `null`، أو وسمٌ يحمل `hidden` — والاسمُ مكتوبٌ في الملفّ فيمرّ.

   و`react-dom/server` موجودٌ في المستودَع ولا يحتاج DOM، فيُصيَّر المكوّنُ
   ويُقابَل مُخرَجُه بالمتن حرفا بحرف. وهذا هو الدليلُ على أنّ المعروضَ
   هو الموقَّعُ عليه — لا قراءةً في ملفّ مصدر. */
describe('ما يُطبَع فعلا هو المتنُ نفسُه', () => {
  /** نصُّ المُخرَج بلا وسوم، والفراغاتُ تُوحّد */
  const rendered = (d: typeof doc) => renderToStaticMarkup(createElement(ContractDocument, { doc: d }))
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')

  it('كلُّ سطرٍ من المتن يُطبَع في الوثيقة المُصيَّرة', () => {
    const html = rendered(doc)
    const missing = sourceLines.filter((l) => !html.includes(l))
    expect(missing, `سطرٌ في المتن لا يظهر للموقِّع:\n${missing.slice(0, 4).join('\n')}`).toEqual([])
  })

  it('وكذلك في العرض المشروط', () => {
    const body = liveBody(CONDITIONAL)
    const html = rendered(parseContractDoc(body))
    const missing = body.split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !html.includes(l))
    expect(missing, `سطرٌ لا يظهر:\n${missing.slice(0, 4).join('\n')}`).toEqual([])
  })

  /* وحاضرٌ في الوسم ليس مرئيّا بالضرورة: `hidden` أو `display:none` يخفيان ما
     يُطبع، فيمرّ حارسُ النصّ ويبقى السطرُ غائبا عن عين الموقِّع. */
  it('ولا يُخفَى مطبوعٌ بـ`hidden` ولا بـ`display:none`', () => {
    const html = renderToStaticMarkup(createElement(ContractDocument, { doc }))
    expect(html, 'وسمٌ مخفيٌّ في الوثيقة').not.toMatch(/\shidden[=\s>]/)
    expect(html, '`display:none` في الوثيقة').not.toMatch(/display:\s*none/)
  })

  /* ولا تُبدّل أرقامٌ: «4-1» تبقى كما وُقّع عليها */
  it('وأرقامُ البنود بحروفها لا تُحوّل', () => {
    const html = rendered(doc)
    expect(html).toContain('4-1')
    expect(html, 'حُوّلت الأرقامُ — فالمعروضُ غيرُ الموقَّع عليه').not.toContain('٤-١')
  })
})

/* ═══ القراءاتُ الثانية — شكلٌ مشتقٌّ لا رقمٌ مكتوب ═══

   عيّنةُ التصميم بنت جدولَ الأتعاب وشبكةَ الخلاصة نصّا مكتوبا باليد فيه
   ٤٥ و٣٠ و٨، وتُحلّ محلّ متن الملحق (ب). ولو نُقل كما هو لَطبع العقدُ
   أرقاما ثابتةً مهما كان ما وُقّع عليه — وهو ما تحرسُه هذه. */
describe('القراءاتُ الثانيةُ تُشتقّ من السطر', () => {
  const blocks = doc.sections.flatMap((s) => s.blocks)

  it('بنودُ الخلاصة تُقرأ مفتاحا وقيمةً من المتن الحيّ', () => {
    const items = blocks.map(summaryItem).filter(Boolean)
    expect(items.length, 'لا يُقرأ بندٌ من الخلاصة — فالشبكةُ ترتدّ فقرات').toBeGreaterThanOrEqual(4)
    expect(items[0]!.keyAr).toBe('الصفة')
    expect(items[0]!.valueAr).toBe('عمل حر')
  })

  it('وصفوفُ المثال تُقرأ مع مجموعها', () => {
    const rows = blocks.map(exampleRow).filter(Boolean)
    expect(rows.length, 'لا يُقرأ صفٌّ — فالجدولُ يرتدّ فقرات').toBe(3)
    expect(blocks.map(exampleTotal).filter(Boolean)).toHaveLength(1)
    /* والمبلغُ من السطر لا من ثابتٍ في الشيفرة */
    expect(rows[0]!.amountAr).toMatch(/USD$/)
  })

  it('وما لا يطابق شكلَه يرتدّ ولا يُخترَع له شيء', () => {
    expect(summaryItem({ kind: 'text', textAr: 'سطرٌ عاديّ' })).toBeNull()
    expect(summaryItem({ kind: 'bullet', textAr: 'بلا نقطتين أصلا' })).toBeNull()
    expect(exampleRow({ kind: 'text', textAr: 'ليس صفّا' })).toBeNull()
  })

  /* وهذا حارسُ العيّنة بعينه: لا رقمَ مالٍ في العارض */
  it('ولا رقمَ أتعابٍ مكتوبٌ في الوثيقة ولا في المحلّل', () => {
    for (const f of ['src/components/ContractDocument.tsx', 'src/application/trainer/contract-sections.ts']) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, `${f}: رقمٌ مكتوبٌ باليد — والعقدُ يطبع ما في متنه لا ما هنا`)
        .not.toMatch(/\bUSD\b|\b45\b|\b30\b/)
    }
  })
})

/* ═══ قاعدةُ الأتعاب صفوفا — والصفُّ مقتطَعٌ لا مكتوب ═══

   ── العطبُ الذي يحرسه ──

   عيّنةُ التصميم بنتها جدولا بعنوانٍ («المقعد عبر رابط إحالتك») وعمودِ
   شرحٍ («كلُّ مسجّلٍ دخل من رابطك») — وكلاهما **ليس في العقد**. ولو نُقلا
   لَقرأ الموقِّعُ في وثيقته كلاما لم يوقّع عليه، وهو أخطرُ من نقصِ سطرٍ:
   نقصُ السطر يُخفي، والزيادةُ تُلزِم بما لم يُكتب.

   وعطبٌ ثانٍ أخفى: إعادةُ الترتيب. «وتحتسب الأتعاب على 8 مقعدا على الأقل»
   لو نُقل مبلغُها إلى خانةٍ أولى بقي «وتحتسب الأتعاب على … على الأقل»
   جملةً مكسورة — ولا يسقط عليها حارسُ التمام لأنّ الحروفَ كلَّها حاضرة.
   فالحارسُ هنا على **الترتيب** لا على الحضور. */
describe('قاعدةُ الأتعاب تُقرأ صفوفا من سطرها', () => {
  const annexB = doc.sections.find((s) => s.kind === 'annex' && s.titleAr === 'أساس الأتعاب')!
  const rows = feeRuleRows(annexB, 0)

  it('تُقرأ من المتن الحيّ، ولكلِّ جملةٍ صفُّها', () => {
    expect(annexB, 'لا ملحقَ أتعابٍ في المتن الحيّ').toBeTruthy()
    expect(rows, 'لا تُقرأ القاعدةُ صفوفا — فترتدّ فقرةً').not.toBeNull()
    expect(rows!.length, 'عددُ الصفوف ليس عددَ جمل القاعدة').toBe(3)
    /* والمبلغُ مقروءٌ من السطر: كلُّ صفٍّ فيه رقم، ولا رقمَ مكتوبٌ هنا */
    for (const r of rows!) expect(r.amountAr, `صفٌّ بلا مبلغ: ${r.beforeAr}`).toMatch(/\d/)
  })

  /* ═══ التمامُ بالبناء لا بالوعد ═══
     جمعُ الصفوف يردّ سطرَ القاعدة حرفا بحرف — فلا حرفَ يسقط ولا يُزاد. */
  it('وجمعُ الصفوف يردّ السطرَ حرفا بحرف', () => {
    const back = rows!.map((r) => r.beforeAr + r.amountAr + r.afterAr).join('')
    expect(back, 'الصفوفُ لا تردّ السطرَ — فالمعروضُ غيرُ الموقَّع عليه')
      .toBe((annexB.blocks[0] as { textAr: string }).textAr)
  })

  /* والمبلغُ يبقى حيث كُتب: ما قبله في المتن قبله في الصفّ */
  it('ولا يُنقل المبلغُ من موضعه في الجملة', () => {
    const line = (annexB.blocks[0] as { textAr: string }).textAr
    for (const r of rows!) {
      const whole = r.beforeAr + r.amountAr + r.afterAr
      expect(line, 'جملةٌ أُعيد ترتيبُها').toContain(whole)
      if (r.beforeAr) {
        expect(whole.indexOf(r.beforeAr), 'ما قبل المبلغ جاء بعده').toBeLessThan(whole.indexOf(r.amountAr))
      }
    }
  })

  /* ═══ وما ليس قاعدةً يرتدّ فقرةً ═══ */
  it('وما ليس أوّلَ ملحقِ الأتعاب لا يُصفّ', () => {
    /* البندُ الذي يذكر الأسعارَ في ذيل الملحق جملُه كلُّها بأرقام — فلولا
       قيدُ الموضع لَصار جدولا وهو تعليقٌ لا قاعدة. */
    expect(feeRuleRows(annexB, 1), 'كتلةٌ ليست الأولى قُرئت قاعدةً').toBeNull()
    /* والقياسُ بنصّ القاعدة بعينه: لو وُضع في بندٍ لَما صار صفوفا، وإلّا
       فالحارسُ يمرّ لأنّ البندَ لا يطابق الشكلَ لا لأنّ الموضعَ مُنع. */
    const ruleText = (annexB.blocks[0] as { textAr: string }).textAr
    for (const kind of ['clause', 'summary', 'preamble'] as const) {
      expect(feeRuleRows({ kind, numAr: null, titleAr: '', blocks: [{ kind: 'text', textAr: ruleText }] }, 0),
        `قسمٌ (${kind}) قُرئ قاعدةً`).toBeNull()
    }
    for (const a of doc.sections.filter((s) => s.kind === 'annex' && s.titleAr !== 'أساس الأتعاب')) {
      expect(feeRuleRows(a, 0), `ملحقٌ (${a.numAr}) قُرئ قاعدةً`).toBeNull()
    }
  })

  it('وجملةٌ بلا رقمٍ تردّ القاعدةَ كلَّها نثرا', () => {
    const asAnnex = (textAr: string) => ({
      kind: 'annex' as const, numAr: 'ب', titleAr: 'أساس الأتعاب',
      blocks: [{ kind: 'text' as const, textAr }],
    })
    /* حالُ عقدٍ لم يُتّفق فيه على أتعابٍ بعد — شطرُه الثاني بلا رقم */
    expect(feeRuleRows(asAnnex('لم يتفق الطرفان بعد على أساس الأتعاب، ويحدد باتفاق مكتوب قبل أول إسناد.'), 0),
      'نثرٌ بلا أرقامٍ صار صفوفا').toBeNull()
    /* ولا صفوفَ من لا شيء: كتلةٌ خاويةٌ تردّ `null` لا مصفوفةً فارغة */
    expect(feeRuleRows(asAnnex(''), 0), 'كتلةٌ خاويةٌ ردّت صفوفا').toBeNull()
    /* وترقيمُ قائمةٍ ليس شرطَ مال: «1. » رقمٌ بلا نطق. ولولا اشتراطُ الحرف
       لَصار كلُّ ملحقٍ مرقَّمٍ بنودُه أرقامٌ جدولَ أتعاب. */
    expect(feeRuleRows(asAnnex('1. الهوية سارية 6 أشهر. 2. السيرة في 3 صفحات.'), 0),
      'قائمةٌ مرقّمةٌ صارت قاعدةَ أتعاب').toBeNull()
    /* وذيلٌ بلا نقطةٍ تُغلقه: لا يُقتطَع نصفُ نصٍّ ويُترَك نصفُه */
    expect(feeRuleRows(asAnnex('20 مقعدا. وذيلٌ بلا حدّ'), 0), 'ذيلٌ مفتوحٌ قُبل').toBeNull()
    /* وكسرةُ العدد ليست حدَّ جملة */
    const frac = feeRuleRows(asAnnex('12.5 USD عن كل مقعد.'), 0)
    expect(frac, 'كسرةٌ رُدّت').not.toBeNull()
    expect(frac!.length, 'قُطعت الجملةُ عند كسرة العدد').toBe(1)
    expect(frac![0].amountAr, 'المبلغُ بُتر عند الكسرة').toBe('12.5 USD')
  })

  /* ═══ وما يُطبَع فعلا — ومن الصفوف وحدَها ═══

     ── ولمَ لا يُفتَّش في الوثيقة كلِّها ──

     سطرُ القاعدة **مطبوعٌ مرّتين**: البندُ 4-1 يطبع `feeClause` نفسَه ثمّ
     يذيّله بإحالةٍ إلى الملحق. فحارسٌ يسأل «أفي الوثيقة هذا السطر؟» يجده
     في البند ويمرّ — ولو ضاع من الملحق كلُّه. وقد مرّ هكذا فعلا: نُقض
     `afterAr` فلم يسقط.

     فالمقابلةُ على وسم الصفوف وحدَه، ومساواةً لا احتواءً. */
  it('والصفوفُ تُصيَّر صفوفا، وجمعُها وحدَه يردّ سطرَ القاعدة', () => {
    const html = renderToStaticMarkup(createElement(ContractDocument, { doc }))
    const cells = [...html.matchAll(/<p[^>]*class="cd-rrow"[^>]*>([\s\S]*?)<\/p>/g)]
    expect(cells.length, 'عددُ الصفوف المُصيَّرة ليس عددَ الجمل').toBe(rows!.length)
    expect(html, 'لا مبلغَ مُبرَزٌ في الصفوف').toContain('cd-ramt')
    const back = cells.map((m) => m[1].replace(/<[^>]+>/g, '')).join('')
    expect(back, 'الصفوفُ المُصيَّرةُ لا تردّ سطرَ القاعدة حرفا بحرف')
      .toBe((annexB.blocks[0] as { textAr: string }).textAr)
  })
})
