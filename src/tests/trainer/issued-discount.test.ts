/* خصمُ المدرّب — ما بقي من المبلغ، وبابُ النسبة الذي حلّ محلَّه.

   ─────────── ما يُحرَس هنا، ولمَ هو بعينه ───────────

   كان هذا الملفُّ يحرس «مبلغا لا نسبة» (قرار ٢١ سبتمبر ٢٠٢٦): رصيدٌ يُصدَر
   تحته، وحاجزٌ بنصٍّ واحد، وبابٌ لا يستقبل نسبة. ثمّ نسخه صاحبُ المنصّة في ٢٧
   سبتمبر: «اصدار كود وليس خصم مباشر، والخصم يكون نسبة وليس رقما» — وسقفُه ٣٠٪
   على دوراته وحدَها. فذهبت حراسةُ الرصيد مع الرصيد (لا يُصدَر جديدٌ بالمبلغ يُقاس
   عليه)، وانقلب حارسُ الباب: **النسبةُ بابُه الوحيد، والمبلغُ مغلق**.

   وبقي ما لا يتغيّر بالقرار: التسويةُ التي لا تُجزَّأ ولا تُخرج كشفا سالبا —
   يستعملها الكودُ الجديدُ كما استعملها المبلغ.

   والمقيسُ بنيةُ الباب والتسوية لا ورودُ عبارةٍ فيهما. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { settleAgainst } from '@/application/trainer/issued-discount'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('التسويةُ: الكشفُ لا يخرج سالبا، وما لا يسعه يُؤجَّل كاملا', () => {
  const d = (id: string, amount: number) => ({ id, amount })

  it('ما وسعه الكشفُ يُؤخَذ، والباقي يبقى منتظرا', () => {
    const { taken, deferred, net } = settleAgainst(100, [d('a', 40), d('b', 30), d('c', 90)])
    expect(taken.map((t) => t.id)).toEqual(['a', 'b'])
    expect(deferred.map((t) => t.id)).toEqual(['c'])
    expect(net).toBe(30)
  })

  it('ولا يُشطَر خصمٌ نصفين — إمّا كاملا وإمّا يُؤجَّل', () => {
    const { taken, deferred, net } = settleAgainst(50, [d('a', 80)])
    expect(taken, 'شُطر خصمٌ فصار نصفُه هنا ونصفُه هناك').toHaveLength(0)
    expect(deferred.map((t) => t.id)).toEqual(['a'])
    expect(net, 'الكشفُ نقص بلا بندِ حسم').toBe(50)
  })

  /* ② العطبُ الذي يجعل الكشفَ مطالبةً: مجموعُ البنود دون الصفر */
  it('والصافي لا يكون سالبا مهما كثُرت الخصوم', () => {
    const many = Array.from({ length: 20 }, (_, i) => d(`x${i}`, 30))
    const { taken, net } = settleAgainst(100, many)
    const sum = taken.reduce((s, t) => s + t.amount, 0)
    expect(net, 'كشفٌ سالبٌ — وهو مطالبةٌ بمالٍ في ذمّته').toBeGreaterThanOrEqual(0)
    expect(net).toBe(100 - sum)
  })

  it('وخصمٌ لا يسعه الكشفُ لا يمنع أصغرَ منه بعده — ولا يُقفَز عن الأقدم بلا سبب', () => {
    /* الترتيبُ بالأقدم استعمالا يقع في الاستعلام، وهذه تُثبت أنّ الدالّةَ
       تحترمه: تمرّ على القائمة كما جاءت ولا تعيد ترتيبَها بالأصغر. */
    const { taken } = settleAgainst(100, [d('كبير', 120), d('صغير', 20)])
    expect(taken.map((t) => t.id)).toEqual(['صغير'])
  })

  it('وبلا خصومٍ يبقى الكشفُ كما هو', () => {
    const { taken, deferred, net } = settleAgainst(210, [])
    expect(taken).toHaveLength(0)
    expect(deferred).toHaveLength(0)
    expect(net).toBe(210)
  })
})

/* ═══ والبابُ نسبةٌ لا مبلغ — القرارُ الجديدُ يُحرَس في الباب لا في النيّة ═══

   القواعدُ تحسب ما يُعطى لها، ولا تُثبت أيَّ بابٍ يُفتح: يكفي أن يُعاد مسارُ
   «أصدِرْ خصما بمبلغ» أو حقلُ مبلغٍ في الشاشة ليعود المبلغُ بلا أن يحمرّ شيء.
   والسقفُ نفسُه: بابٌ يقبل الأربعين يُحسم به من المدرّب فوق ما في عقده.

   والتعليقُ يُنزع قبل القياس: في هذه الملفّات تعليقاتٌ تذكر المبلغَ تاريخا، ولا
   يُحكم على بابٍ بما يُحكى عنه. */
describe('وبابُ خصم المدرّب نسبةٌ مسقوفة — والمبلغُ مغلق', () => {
  const read = (p: string) => readFileSync(join(root, p), 'utf8')
  const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

  /** قسمُ أكواد المدرّب من ملفّ المسارات — من بابها الأوّل إلى باب الإلغاء */
  function codeRoutes(): string {
    const src = code('server/http/routes/learning-portal.routes.ts')
    const at = src.indexOf("'/api/trainer/me/codes'")
    expect(at, 'لا بابَ لأكواد المدرّب أصلا — أنُقل المسار؟').toBeGreaterThan(-1)
    const end = src.indexOf('/api/trainer/me/discounts', at)
    expect(end, 'بابُ الخصوم القديمة غائبٌ بعد أبواب الأكواد').toBeGreaterThan(at)
    return src.slice(at, end)
  }

  it('⚠️ الإصدارُ يستقبل نسبةً صحيحةً بين حدَّي القواعد — ولا مبلغا', () => {
    const section = codeRoutes()
    expect(section, 'النسبةُ ليست بين حدَّي القواعد').toMatch(
      /percentOff:\s*z\.number\(\)\.int\(\)\.min\(MIN_TRAINER_CODE_PERCENT\)\.max\(MAX_TRAINER_CODE_PERCENT\)/,
    )
    expect(section, 'دخل المبلغُ بابَ الكود').not.toMatch(/\bamount\s*:/)
  })

  it('⚠️ وبابُ الإصدار بالمبلغ أُغلق — يبقى الإلغاءُ والقراءة', () => {
    const src = code('server/http/routes/learning-portal.routes.ts')
    expect(src, 'عاد بابُ «أصدِرْ خصما بمبلغ»').not.toMatch(/app\.post\(\s*'\/api\/trainer\/me\/discounts'\s*,/)
    expect(src, 'غاب إلغاءُ الخصم القديم — وما صدر يبقى على شروطه').toContain("'/api/trainer/me/discounts/:id/revoke'")
  })

  it('⚠️ وشاشةُ «دعوتي» ترسل نسبةً، ولا تُصدر مبلغا', () => {
    const page = code('src/pages/trainer/Referral.tsx')
    const at = page.indexOf('function MyCodes')
    expect(at, 'لوحةُ الأكواد غائبةٌ عن «دعوتي»').toBeGreaterThan(-1)
    const panel = page.slice(at, page.indexOf('function LegacyDiscounts'))
    expect(panel, 'اللوحةُ لا ترسل نسبة').toMatch(/percentOff:\s*input\.percentOff/)
    expect(panel, 'حاجزُ الشاشة ليس حاجزَ الخادم').toContain('codeBlockerAr(')
    expect(panel, 'دخل المبلغُ لوحةَ الأكواد').not.toMatch(/\bamount\s*[:,]/)
    /* ولوحةُ القديم تقرأ وتُلغي — ولا تُصدر */
    const legacy = page.slice(page.indexOf('function LegacyDiscounts'), page.indexOf('export default function Referral'))
    expect(legacy, 'لوحةُ الخصوم القديمة تُصدر خصما').not.toMatch(/apiPost\(\s*"\/api\/trainer\/me\/discounts"/)
  })
})
