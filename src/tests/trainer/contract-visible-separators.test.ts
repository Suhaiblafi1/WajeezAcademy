/* تلاصقُ الكلمات في لوح الخلاصة — فاصلٌ `sr-only` لا يحلّ محلَّه شيء.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * صاحبُ المنصّة (٢٩ سبتمبر ٢٠٢٦): «هناك تلاصق بالكلام في بعض الجمل كما في
 * الصوره مثل عمل حروالمدرب.. او لهمن».
 *
 * و«عمل حروالمدرب» هي «عمل حر» و«والمدرب متعاقد مستقل…» التصقتا، و«لهمن» هي
 * «…الذي أبرمت له» و«من 1 نوفمبر…». ومصدرُهما واحد: بندُ الخلاصة يُقطَع
 * قيمةً وتفصيلا وإحالةً، وتُوضَع الفواصلُ بينها `sr-only`.
 *
 * ── والقاعدةُ التي انكسرت ──
 *
 * `sr-only` صوابٌ حيث **يحلّ محلَّ الفاصلِ في العين نَسَقُ اللوح**: «:» بين
 * `dt` و`dd` يحلّ محلَّه انتقالُ السطر، و«—» بين خانتَي جدولٍ يحلّ محلَّه حدُّ
 * الخانة. فالعينُ تقرأ الحدَّ فاصلا.
 *
 * وقيمةُ الخلاصة وتفصيلُها **في سطرٍ واحد** داخل `dd` واحدة: لا حدَّ خانةٍ
 * ولا انتقالَ سطرٍ يحلّ محلَّ الشرطة، و`.cd-n` لونٌ بلا فراغ. فالحرفُ
 * يلتصق بالحرف، ويقرأ الموقِّعُ كلمةً لا وجودَ لها.
 *
 * ── ولمَ لا يكفي حارسُ التمام القائم ──
 *
 * `contract-document.test.ts` يقابل **نصَّ** المصيَّر بالمتن، و`sr-only` نصٌّ
 * قائمٌ في العقدة — فالمقابلةُ تخضرّ والفواصلُ كلُّها مخفيّة. ولذلك يُقاس
 * هنا **ما تراه العين**: تُنزَع عُقَدُ `sr-only` ثمّ يُسأل عن الفاصل.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ContractDocument from '@/components/ContractDocument'
import {
  parseContractDoc, summaryItem, type SummaryItem,
} from '@/application/trainer/contract-sections'
import { renderContractBodyAr } from '@/application/trainer/contract-body'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const body = renderContractBodyAr({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٢٩ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 12, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: { orientationOnAr: '٥ أكتوبر ٢٠٢٦', deadlineOnAr: '١٠ أكتوبر ٢٠٢٦', windowDays: 5, extensionDays: 2 },
})

const doc = parseContractDoc(body)
const markup = renderToStaticMarkup(createElement(ContractDocument, { doc }))

/** ما تراه العينُ: تُنزَع عُقَدُ `sr-only` بمحتواها، ثمّ الوسوم */
/* وحدودُ الكتل تصير أسطرا: لو نُزعت الوسومُ كلُّها سواءً لَالتصق آخرُ فقرةٍ
   بأوّل التي تليها في **النصّ** وهما في العين سطران — فيتّهم الحارسُ تلاصقا
   لا وجودَ له، أو يُخفي تلاصقا حقيقيّا داخل السطر. والمقصودُ ما التصق في
   سطرٍ واحد. */
const BLOCK_RE = /<\/?(?:p|div|dl|dt|dd|table|thead|tbody|tr|td|th|caption|ul|ol|li|section|header|footer|h[1-6]|br)\b[^>]*>/g

const UNTAG = (s: string) => s.replace(BLOCK_RE, '\n').replace(/<[^>]*>/g, '')
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

/* والصفةُ تُطابَق بالقائمة لا بالنصّ الحرفيّ: بناءُ التطوير يحشر
   `code-path="…"` قبل `class`، فنمطٌ يتوقّع `<span class="sr-only">` لا
   يطابق شيئا — ويخضرّ الحارسُ وهو لا يقيس. (وقد وقع.) */
const SR_ONLY_RE = /<span\b[^>]*\bclass="[^"]*\bsr-only\b[^"]*"[^>]*>[^<]*<\/span>/g

/** ما تراه العينُ: تُنزَع عُقَدُ `sr-only` بمحتواها، ثمّ الوسوم */
function visibleText(html: string): string {
  return UNTAG(html.replace(SR_ONLY_RE, ''))
}

const visible = visibleText(markup)

/** بنودُ الخلاصة كما قرأها العارضُ نفسُه — لا قائمةٌ تُكتب هنا فتفترق */
const items: SummaryItem[] = (doc.sections.find((s) => s.kind === 'summary')?.blocks ?? [])
  .map(summaryItem)
  .filter((i): i is SummaryItem => i !== null)

describe('فواصلُ لوح الخلاصة تُرى — فلا تلتصق كلمةٌ بكلمة', () => {
  it('والبنودُ تُقرأ أصلا — فلا يخضرّ الحارسُ على قائمةٍ فارغة', () => {
    expect(items.length, 'لم يُقرأ بندُ خلاصةٍ واحد — فما تحته لا يقيس شيئا').toBeGreaterThan(3)
    expect(items.some((i) => i.noteAr), 'لا بندَ بتفصيلٍ — فالتلاصقُ لا يُقاس').toBe(true)
    expect(items.some((i) => i.refAr), 'لا بندَ بإحالةٍ — فالتلاصقُ الثاني لا يُقاس').toBe(true)
  })

  /* ① القيمةُ وتفصيلُها: «عمل حر» ثمّ «والمدرب متعاقد مستقل…» */
  it('الشرطةُ بين القيمة وتفصيلها تُرى', () => {
    for (const it of items.filter((i) => i.noteAr)) {
      expect(visible, `التصقت قيمةُ «${it.keyAr}» بتفصيلها: «${
        it.valueAr.slice(-12)}${it.noteAr.slice(0, 12)}»`)
        .toContain(`${it.valueAr} — ${it.noteAr}`)
    }
  })

  /* ② والإحالةُ بعدها: «…تنتهي بعده» ثمّ «(البنود 17-1 …)» */
  it('والفراغُ قبل الإحالة يُرى', () => {
    for (const it of items.filter((i) => i.refAr)) {
      const before = it.noteAr || it.valueAr
      expect(visible, `التصقت إحالةُ «${it.keyAr}» بما قبلها: «${
        before.slice(-12)}${it.refAr}»`)
        .toContain(`${before} ${it.refAr}`)
    }
  })

  /* ③ والكلمتان المذكورتان بعينهما — فلا يعود ما رآه صاحبُ المنصّة */
  it('ولا «عمل حروالمدرب» ولا «لهمن» في ما تراه العين', () => {
    expect(visible).not.toContain('حروالمدرب')
    expect(visible).not.toContain('لهمن')
  })

  /* ④ وما يُنسَخ يبقى تامّا — فالإصلاحُ لم يشترِ الرؤيةَ بحرفٍ ساقط */
  it('ونصُّ العقدة يبقى المتنَ حرفا بحرف', () => {
    const full = UNTAG(markup)
    for (const it of items) {
      expect(full, `سقط من المنسوخ تفصيلُ «${it.keyAr}»`).toContain(it.valueAr)
      if (it.noteAr) expect(full).toContain(it.noteAr)
      if (it.refAr) expect(full).toContain(it.refAr)
    }
  })
})

/* ولمَ هذا الفحصُ موجود: نمطُ `sr-only` هو أداةُ القياس كلُّها. فإن لم
   يطابق شيئا خضرّ كلُّ ما فوقه وهو لا يقيس — وقد وقع مرّةً في هذه الجلسة
   حين حشر بناءُ التطوير `code-path` قبل `class`. فتُقاس الأداةُ نفسُها. */
describe('وأداةُ القياس تُقاس', () => {
  it('نمطُ `sr-only` يطابق فواصلَ اللوح فعلا', () => {
    const hits = markup.match(SR_ONLY_RE) ?? []
    expect(hits.length, 'لم يطابق النمطُ فاصلا واحدا — فما فوقه لا يقيس شيئا')
      .toBeGreaterThan(4)
    expect(visible.length, 'نُزع المتنُ كلُّه لا الفواصلَ وحدَها')
      .toBeGreaterThan(UNTAG(markup).length * 0.9)
  })
})
