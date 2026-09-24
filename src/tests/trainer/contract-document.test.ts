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
import type { ContractDoc } from '@/application/trainer/contract-sections'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseContractDoc, documentLinesAr, blockLineAr, sectionHeadingAr,
  summaryItem, exampleRow, exampleTotal, feeRuleRows, feeRuleCells,
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


/* ═══ قاعدةُ الأتعاب — ثلاثةُ أعمدةٍ في `v7`، وعمودٌ في المجمَّد ═══

   ── العطبُ الذي تحرسه ──

   العيّنةُ بنت القاعدةَ ثلاثةَ أعمدة: عنوانٌ وقيمةٌ ومتى يُحتسب. ورُدّ في
   #285 لأنّ العنوانَ والشرحَ **لم يكونا في العقد**، وطبعُ ما ليس فيه
   يُلزِم بما لم يُكتب. فكُتبا في المتن بأمر صاحب المنصّة (`v7`)، وصارت
   الخاناتُ مقروءةً منه.

   وخطرُ هذا التحوّل أنّ في الملحق (ب) **جدولَين**: القاعدةُ وصفوفُ المثال.
   ولو خلط المحلّلُ بينهما لَقرأ «1. 20 كلهم من الأكاديمية — 20 × 30: 600
   USD» قاعدةَ أتعابٍ مُلزِمة — وهو مثالٌ نفى العقدُ إلزامَه في 18-4. */
describe('قاعدةُ `v7` تُقرأ ثلاثةَ أعمدةٍ من متنها', () => {
  const annexB = doc.sections.find((s) => s.kind === 'annex' && s.titleAr === 'أساس الأتعاب')!
  const cells = annexB.blocks.map(feeRuleCells).filter(Boolean)

  it('ثلاثةُ صفوفٍ بعناوينها وقيمها من المتن الحيّ', () => {
    expect(cells.length, 'لا تُقرأ القاعدةُ خاناتٍ — فترتدّ فقرات').toBe(3)
    /* والقيمُ من السطر لا من ثابتٍ هنا: كلُّ قيمةٍ فيها رقم */
    for (const c of cells) expect(c!.amountAr, `صفٌّ بلا قيمة: ${c!.labelAr}`).toMatch(/\d/)
    /* ولكلِّ صفٍّ عنوانٌ وشرحٌ — وهما ما لم يكن في `v6` */
    for (const c of cells) {
      expect(c!.labelAr.length, 'صفٌّ بلا عنوان').toBeGreaterThan(2)
      expect(c!.whenAr.length, 'صفٌّ بلا شرح').toBeGreaterThan(10)
    }
  })

  it('وجمعُ الخانات يردّ السطرَ حرفا بحرف', () => {
    const rows = annexB.blocks.filter((b) => feeRuleCells(b))
    rows.forEach((b, i) => {
      const c = cells[i]!
      expect(`${c.labelAr} — ${c.amountAr}: ${c.whenAr}`, 'الخاناتُ لا تردّ السطر')
        .toBe((b as { textAr: string }).textAr)
    })
  })

  /* ═══ ولا يُقرأ المثالُ قاعدةً ═══ */
  it('وصفوفُ المثال لا تُقرأ قاعدةً ولو شابهت شكلَها', () => {
    const exampleLines = annexB.blocks.filter((b) => exampleRow(b))
    expect(exampleLines.length, 'لا صفوفَ مثالٍ في الملحق').toBe(3)
    for (const b of exampleLines) {
      expect(feeRuleCells(b), 'صفُّ مثالٍ قُرئ قاعدةً مُلزِمة').toBeNull()
    }
  })

  it('وسطرٌ بلا قيمةٍ رقميّةٍ ليس قاعدة', () => {
    expect(feeRuleCells({ kind: 'text', textAr: 'عنوان — قيمة: شرح' })).toBeNull()
    expect(feeRuleCells({ kind: 'text', textAr: 'بلا شرطةٍ ولا نقطتين' })).toBeNull()
    expect(feeRuleCells({ kind: 'bullet', textAr: 'نقطة — 5 USD: شرح' })).toBeNull()
  })

  /* ═══ وما يُطبَع فعلا — من خانات الجدول وحدَها ═══

     ولا يُفتَّش في الوثيقة كلِّها: أسطرُ القاعدة لا تتكرّر بعد `v7` (نُزعت
     من 4-1)، لكنّ الدرسَ من #285 باقٍ — المقابلةُ على وسم الصفّ ومساواةً. */
  it('والجدولُ يُصيَّر ثلاثةَ أعمدة، وكلُّ سطرٍ يعود تامّا منه', () => {
    const html = renderToStaticMarkup(createElement(ContractDocument, { doc }))
    expect(html, 'لا عنوانَ لعمود «متى يُحتسب»').toContain('متى يُحتسب')
    const rows = [...html.matchAll(/<tr[^>]*>((?:(?!<\/tr>)[\s\S])*)<\/tr>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, ''))
    const lines = annexB.blocks.filter((b) => feeRuleCells(b))
      .map((b) => (b as { textAr: string }).textAr)
    for (const l of lines) {
      expect(rows, `سطرُ قاعدةٍ لا يخرج تامّا مرتَّبا في صفّه:\n${l}`).toContain(l)
    }
  })
})

/* ═══ والقارئةُ القديمةُ تبقى للمتون المجمَّدة ═══

   عقودُ `v6` وما قبلها وُقّعت وجُمّد متنُها جملةً واحدة. فلو نُزعت قارئتُها
   لَارتدّ ملحقُها فقرةً — لا نقصَ في حرف، لكنّه يُفقِد من وقّع شكلا كان له.
   فتُقاس على متنٍ من ذلك الإصدار لا على الحيّ. */
describe('وقاعدةُ `v6` المجمَّدةُ تبقى مقروءةً صفوفا', () => {
  const V6_RULE = '45 USD عن كل متعلم يسجل في الشعبة التي يقبلها ويقدمها عبر رابط'
    + ' الإحالة الخاص به، و30 USD عن كل متعلم سواه مسجل في الشعبة نفسها.'
    + ' وتحتسب الأتعاب على 8 مقعدا على الأقل ولو قل عدد المسجلين فعلا عن ذلك.'
  const asAnnexB = (textAr: string) => ({
    kind: 'annex' as const, numAr: 'ب', titleAr: 'أساس الأتعاب',
    blocks: [{ kind: 'text' as const, textAr }],
  })

  it('جملةُ `v6` تُقرأ ثلاثةَ صفوفٍ بعمودٍ واحد', () => {
    const rows = feeRuleRows(asAnnexB(V6_RULE), 0)
    expect(rows, 'متنٌ مجمَّدٌ ارتدّ فقرةً').not.toBeNull()
    expect(rows!.length).toBe(3)
    expect(rows!.map((r) => r.beforeAr + r.amountAr + r.afterAr).join(''), 'لا تردّ السطر')
      .toBe(V6_RULE)
  })

  /* ولا تُقرأ خاناتٍ ثلاثا: ليس فيها عنوانٌ ولا شرحٌ مفصولان */
  it('ولا تُقرأ جملةُ `v6` ثلاثةَ أعمدةٍ لا وجودَ لها فيها', () => {
    expect(feeRuleCells({ kind: 'text', textAr: V6_RULE }), 'اختُرعت خاناتٌ ليست في المتن')
      .toBeNull()
  })

  /* ═══ والقارئتان تلتقيان على صفّ `v7` — وهي علّةُ القيد ═══

     صفُّ `v7` تقرؤه القديمةُ أيضا: جملةٌ فيها رقمٌ وحرفٌ تنتهي بنقطة.
     فلولا قيدُ «لا تُسأل القديمةُ إذا وُجدت خانات» لَطُبعت القاعدةُ
     مرّتين في الملحق المختلط أعلاه.

     ولا يكفي ترتيبُ الفرعين في العارض: القيدُ يُسقط القديمةَ أصلا، فلا
     يبقى للترتيب أثر. وهذا ما يُثبته هذا الحارس — أنّ الالتقاءَ واقعٌ
     لا مفترَض. */
  it('وصفُّ `v7` تقرؤه القديمةُ أيضا — فلزم القيدُ لا الترتيب', () => {
    const v7 = 'المقعد العام — 30 USD: عن كل متعلم سواه مسجل في الشعبة نفسها.'
    expect(feeRuleCells({ kind: 'text', textAr: v7 }), 'لا تقرؤه الجديدة').not.toBeNull()
    expect(feeRuleRows(asAnnexB(v7), 0), 'لا تقرؤه القديمة — فالتقديمُ بلا معنى')
      .not.toBeNull()
  })
})

/* ═══ وملحقٌ يخلط الإصدارين لا يُطبَع مرّتين ═══

   العارضُ يسأل القارئتين معا. وشكلٌ لا يصنعه متنٌ اليومَ يصنعه غدا: ملحقٌ
   صدرُه فقرةٌ نثريّةٌ فيها أرقام، وصفوفُ `v7` بعدها. فلو سُئلت القديمةُ عن
   الصدر بلا قيدٍ لَطُبعت القاعدةُ مرّتين — جدولا وصفوفَ نثر — وقرأ الموقِّعُ
   قاعدتين لشيءٍ واحدٍ يقبضه.

   فالقيدُ أنّ القديمةَ لا تُسأل إذا وُجدت خاناتٌ في الملحق أصلا. */
describe('ملحقٌ فيه الشكلان لا يطبع القاعدةَ مرّتين', () => {
  const mixed: ContractDoc = {
    titleAr: 'اتفاقيّة',
    meta: [],
    sections: [{
      kind: 'annex', numAr: 'ب', titleAr: 'أساس الأتعاب',
      blocks: [
        /* صدرٌ نثريٌّ كلُّ جملةٍ فيه برقمٍ وحرف — تقرؤه القارئةُ القديمة */
        { kind: 'text', textAr: 'تحتسب الأتعاب على 8 مقاعد على الأقل.' },
        /* وصفٌّ من `v7` بعده */
        { kind: 'text', textAr: 'المقعد العام — 30 USD: عن كل متعلم مسجل في الشعبة.' },
      ],
    }],
  }

  it('الصدرُ يخرج فقرةً والصفُّ جدولا — ولا صفوفَ نثرٍ معهما', () => {
    const html = renderToStaticMarkup(createElement(ContractDocument, { doc: mixed }))
    expect(html, 'لا جدولَ قاعدةٍ للصفّ').toContain('متى يُحتسب')
    expect(html, 'طُبع الصدرُ صفوفَ نثرٍ أيضا — فقاعدتان لشيءٍ واحد')
      .not.toContain('cd-rrow')
    /* ولا يسقط الصدرُ: يخرج نصّا كما هو */
    const text = html.replace(/<[^>]+>/g, '')
    for (const b of mixed.sections[0].blocks) {
      expect(text, 'سطرٌ سقط من الملحق المختلط').toContain((b as { textAr: string }).textAr)
    }
  })
})
