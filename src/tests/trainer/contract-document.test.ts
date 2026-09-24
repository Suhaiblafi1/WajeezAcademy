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
    const src = read('src/application/trainer/contract-sections.ts')
    expect(src).not.toMatch(/الأتعاب|السرّيّة|الملكية الفكرية/)
    expect(src).toMatch(/export function parseContractDoc/)
  })
})

describe('والوثيقةُ تعرض كلّ ما حلّله المحلّل', () => {
  /* المحلّلُ تامٌّ ولا ينفع إن أسقط العارضُ نوعا منه: نقطةٌ لا تُرسَم
     تغيب عن عين الموقِّع كما تغيب لو أسقطها المحلّل. */
  it('أنواعُ الكتل الثلاثةُ تُرسَم نصّا — ولا واحدٌ منها يُرسَم عدما', () => {
    const src = read('src/components/ContractDocument.tsx')
    const blocks = src.slice(src.indexOf('function Blocks'), src.indexOf('export default'))
    expect(blocks.length, 'لم تُقرأ دالّةُ الكتل أصلا').toBeGreaterThan(200)
    /* والفحصُ على **ما يُخرَج** لا على ورودِ اسم النوع: `kind === 'bullet'`
       يبقى مكتوبا ولو صار فرعُه `return null`، وهي مصيدةُ الخضرة الكاذبة
       التي يحذّر منها CLAUDE.md. فيُعَدّ ما يُطبَع من نصِّ الكتلة. */
    expect(
      (blocks.match(/\{b\.textAr\}/g) ?? []).length,
      'فرعٌ من فروع الكتل لا يطبع نصَّها — وقِّع على ما لم يُعرَض',
    ).toBe(3)
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
