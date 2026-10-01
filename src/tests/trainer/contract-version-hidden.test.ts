/* ═══ رمزُ إصدار العقد يُحفَظ ولا يُعرَض (١ أكتوبر ٢٠٢٦) ═══
 *
 * قولُ صاحب المنصّة: «dont show the version number to users.. no need!».
 *
 * فالمتنُ لا يطبع الرمزَ بعد اليوم — فما يُوقَّع عليه هو ما يُرى، بلا سطرٍ خفيّ.
 * والمتونُ القديمةُ التي حملته باقيةٌ بحرفها (نصٌّ موقَّعٌ لا يُعاد كتابتُه)،
 * فيُقرأ فيها ترويسةً ولا يُرسَم. وإصدارُ كلّ عقدٍ في `bodyVersion` وفي الأثر.
 * والمقيسُ هنا أنّه لا يبلغ عينا: لا الوثيقةَ المرسومة (صفحةُ التوقيع و«عقدي»
 * والطباعة وشاشةُ المدير كلُّها ترسم `ContractDocument`)، ولا نصَّ شاشةٍ يُدرج
 * متغيّرَ الإصدار.
 *
 * ويُقاس على **المرسوم** لا على ورود اسمٍ في ملفّ: الوثيقةُ تُرسَم فعلا ثمّ
 * يُبحث فيها عن شكل الرمز نفسِه، لا عن كلمة «الصياغة».
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ContractDocument from '@/components/ContractDocument'
import { parseContractDoc } from '@/application/trainer/contract-sections'
import { renderContractBodyAr, type ContractBodyInput } from '@/application/trainer/contract-body'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

/** شكلُ رمز الإصدار — `v21-2026-10-01` وأمثالُه */
const VERSION_CODE = /\bv\d+-\d{4}-\d{2}-\d{2}\b/

const BASE: ContractBodyInput = {
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '١ أكتوبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '15', currency: 'USD', minSeats: 15, referralRate: '25' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
}
const body = renderContractBodyAr(BASE)
/** متنٌ قديمٌ كما حُفظ قبل اليوم: سطرُ الإصدار بعد تاريخ الإصدار */
const OLD = 'v18-2026-09-30'
const oldBody = body.replace(/^(تاريخ الإصدار: .*)$/m, `$1\nإصدار الصياغة: ${OLD}`)
const draw = (src: string) => renderToStaticMarkup(createElement(ContractDocument, { doc: parseContractDoc(src) }))

describe('الوثيقةُ المرسومة بلا رمز الإصدار', () => {
  it('⚠️ المتنُ الجديدُ لا يطبعه — فما يُوقَّع عليه هو ما يُرى', () => {
    expect(body, 'عاد سطرُ الإصدار إلى المتن الذي يُوقَّع عليه').not.toMatch(VERSION_CODE)
    expect(draw(body)).not.toMatch(VERSION_CODE)
  })

  /* المتونُ القديمةُ باقيةٌ بحرفها — وفيها السطر */
  it('⚠️ والمتنُ القديمُ الذي حمله لا يُرسَم فيه — للمدرّب والمدير والطباعة', () => {
    expect(oldBody, 'المثالُ لا يحمل السطرَ — فالفحصُ يقيس الفراغ').toContain(`إصدار الصياغة: ${OLD}`)
    const html = draw(oldBody)
    expect(html, 'رُسم رمزُ الإصدار من متنٍ قديم').not.toMatch(VERSION_CODE)
    expect(html, 'رُسمت خانةُ الإصدار في الترويسة').not.toContain('إصدار الصياغة')
  })

  /* ويُقرأ ترويسةً لا سطرا في الجسم: ولو لم يُعرَف لَسقط شاردا في أوّل قسم */
  it('ويُقرأ في القديم ترويسةً — سجلًّا لا عرضا', () => {
    expect(parseContractDoc(oldBody).meta.find((m) => m.labelAr === 'إصدار الصياغة')?.valueAr).toBe(OLD)
  })

  it('وما سواه من الترويسة يُرسَم كما كان — المرجعُ وتاريخُ الإصدار', () => {
    const html = draw(oldBody)
    expect(html).toContain('WJ-TR-2026-00000')
    expect(html).toContain('١ أكتوبر ٢٠٢٦')
  })
})

/* ═══ ولا شاشةَ تُدرج متغيّرَ الإصدار في نصّها ═══
   يُقاس الإدراجُ نفسُه — `{x.bodyVersion}` و`${x.bodyVersion}` و`{CONTRACT_BODY_VERSION}`
   ومعها `?? "—"` — لا المقارنةُ (`c.bodyVersion === CONTRACT_BODY_VERSION ? …`)، فتلك
   تقرّر عبارةً ولا تطبع رمزا. والتعليقُ يُنزع قبل القياس. */
const ROOTS = ['src/pages', 'src/components']
const files = (dir: string): string[] => readdirSync(join(process.cwd(), dir)).flatMap((n) => {
  const p = join(dir, n)
  return statSync(join(process.cwd(), p)).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : []
})
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const PRINTS = /(\$\{|\{)\s*[\w.?!]*\b(bodyVersion|CONTRACT_BODY_VERSION)\s*(\?\?\s*"[^"]*"\s*)?\}/
/** والاستيرادُ ليس طباعةً: `import { CONTRACT_BODY_VERSION }` يشبه الإدراجَ شكلا */
const withoutImports = (src: string) => src.replace(/^import\s[\s\S]*?\sfrom\s+["'][^"']+["'];?[ \t]*$/gm, '')

describe('الشاشاتُ لا تطبع رمزَ الإصدار', () => {
  it('⚠️ لا إدراجَ لـ`bodyVersion` ولا لـ`CONTRACT_BODY_VERSION` في نصّ شاشة', () => {
    const offenders = ROOTS.flatMap(files).filter((p) => PRINTS.test(withoutImports(code(p))))
    expect(offenders, `شاشةٌ تطبع رمزَ الإصدار: ${offenders.join('، ')}`).toEqual([])
  })

  it('وشاشةُ العقود تقول أحاضرٌ نصُّه أم سابق — فذاك ما يقرّر إعادةَ التوقيع', () => {
    const screen = code('src/pages/admin/TrainerContracts.tsx')
    expect(screen).toMatch(/c\.bodyVersion === CONTRACT_BODY_VERSION \? " · على النصّ الحاضر" : " · على نصٍّ سابق"/)
  })
})
