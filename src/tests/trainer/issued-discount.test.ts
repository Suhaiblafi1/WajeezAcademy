/* خصمُ المدرّب — مبلغٌ من حسابه هو، بسقفٍ وتسويةٍ لا تُجزَّأ.

   ─────────── ما يُحرَس هنا، ولمَ هو بعينه ───────────

   هذا البابُ يُخرج مالا من جيب إنسانٍ بعد شهرٍ من نقرةٍ يفعلها اليوم. وثلاثةُ
   أعطابٍ فيه تقع **صامتةً** ولا تظهر إلّا في كشفٍ بعد شهر:

   ① **سقفٌ لا يُطبَّق** — فيُصدر ألفا على مئتين، ويُستعمَل المال، ثمّ لا
      يُحسم لأنّ البند 4-10 يمنع أن يُطالَب دَينا — فتتحمّله الأكاديميّة،
      وهو عكسُ القرار نفسِه.
   ② **وكشفٌ يخرج سالبا** — وهو مطالبةٌ بمالٍ في ذمّته، يمنعها البندُ صراحة.
   ③ **ونصّان لحدٍّ واحد** — الشاشةُ تقول «لا يتجاوز رصيدَك» ويردّ الخادمُ
      «مبلغ غير صالح»، فيقرأ المدرّبُ جوابين لسؤالٍ واحد.

   والمقيسُ سلوكُ القواعد لا ورودُ عبارةٍ فيها. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MAX_ISSUED_DISCOUNT, MIN_ISSUED_DISCOUNT,
  discountBudget, issueBlockerAr, settleAgainst,
} from '@/application/trainer/issued-discount'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const budget = (over: Partial<Parameters<typeof discountBudget>[0]> = {}) => discountBudget({
  pending: 100, approved: 50, projected: 200, outstanding: 0, currency: 'USD', ...over,
})

describe('الرصيدُ: ما له عندنا ناقصا ما أصدره ولم يُسوَّ', () => {
  it('يجمع المنتظَرَ والمعتمَدَ والمتوقَّع، ويطرح ما أصدره', () => {
    const b = budget({ outstanding: 80 })
    expect(b.allowance, 'الجمعُ ليس جمعَ الثلاثة').toBe(350)
    expect(b.outstanding).toBe(80)
    expect(b.remaining).toBe(270)
  })

  /* والمدفوعُ ليس منه بالبناء: `discountBudget` لا تأخذه أصلا — فلو أُضيف
     يوما لَحُسب للمدرّب مالٌ خرج إليه فعلا ولا يُحسم منه. */
  it('ولا ينزل المتبقّي تحت الصفر مهما تجاوز ما أصدره', () => {
    const b = budget({ outstanding: 900 })
    expect(b.remaining, 'رصيدٌ سالبٌ يُقرأ دَينا').toBe(0)
  })
})

describe('الحاجزُ نصٌّ واحدٌ تقرؤه الشاشةُ والخادم', () => {
  it('يمرّ المبلغُ داخلَ الرصيد، ويُردّ ما فوقه بذكر الرقمين', () => {
    expect(issueBlockerAr(100, budget()), 'رُدّ مبلغٌ داخلَ الرصيد').toBeNull()
    const over = issueBlockerAr(400, budget())
    expect(over, 'مرّ مبلغٌ فوق الرصيد').toBeTruthy()
    expect(over, 'الرسالةُ لا تقول الرصيدَ فلا يعرف كم يكتب').toContain('350')
  })

  it('ويُردّ الصفرُ والسالبُ وما ليس رقما', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(issueBlockerAr(bad, budget()), `مرّ ${bad}`).toBeTruthy()
    }
  })

  it('ويُردّ ما دون الأدنى وما فوق سقفِ المرّة الواحدة', () => {
    expect(issueBlockerAr(MIN_ISSUED_DISCOUNT - 0.5, budget()), 'مرّ ما دون الأدنى').toBeTruthy()
    /* برصيدٍ يتّسع: المردودُ هو السقفُ لا الرصيد */
    const wide = budget({ projected: 100_000 })
    expect(issueBlockerAr(MAX_ISSUED_DISCOUNT + 1, wide), 'مرّ ما فوق سقفِ المرّة').toBeTruthy()
    expect(issueBlockerAr(MAX_ISSUED_DISCOUNT, wide), 'رُدّ ما يساوي السقفَ تماما').toBeNull()
  })

  it('وثلاثُ منازلَ عشريّةٍ تُردّ — فالمال منزلتان ولا يُقرَّب صامتا', () => {
    expect(issueBlockerAr(10.125, budget()), 'مرّ مبلغٌ بثلاث منازل').toBeTruthy()
    expect(issueBlockerAr(10.12, budget())).toBeNull()
  })
})

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

/* ═══ «مبلغ لا نسبة» قرارٌ يُحرَس في البابِ لا في النيّة ═══

   القواعدُ أعلاه لا تعرف شيئا عن النسب — لأنّها لا تستقبلها أصلا. وذاك
   يُثبت أنّ الحسابَ سليم، ولا يُثبت أنّ البابَ لا يفتح لها: يكفي أن يضيف
   أحدٌ `percentOff` إلى مخطّط المسار أو حقلا في الشاشة ليصير الخصمُ نسبةً
   بلا أن يحمرَّ شيءٌ ممّا سبق.

   وعلّةُ المنع في رأس `issued-discount.ts`: النسبةُ تجعل ما يتحمّله المدرّبُ
   دالّةً في سعرٍ نملكه نحن، وتُطبَّق على السلّة كلِّها فيتحمّل عن خمسِ دوراتٍ
   ما نواه عن واحدة. */
describe('ولا بابَ للنسبة في خصم المدرّب — لا في المسار ولا في الشاشة', () => {
  const read = (p: string) => readFileSync(join(root, p), 'utf8')

  /** قسمُ خصوم المدرّب من ملفّ المسارات — من تعليق بابها إلى ما بعد آخرِها */
  function discountRoutes(): string {
    const src = read('server/http/routes/learning-portal.routes.ts')
    const at = src.indexOf('/api/trainer/me/discounts')
    expect(at, 'لا بابَ لخصوم المدرّب أصلا — أنُقل المسار؟').toBeGreaterThan(-1)
    const end = src.indexOf("/api/trainer/me/discounts/:id/revoke")
    expect(end, 'بابُ الإلغاء غائب').toBeGreaterThan(at)
    return src.slice(at, end + 400)
  }

  it('مخطّطُ الإصدار يستقبل `amount` ولا يستقبل نسبةً بأيّ اسم', () => {
    const section = discountRoutes()
    expect(section, 'المسارُ لا يستقبل مبلغا').toMatch(/amount:\s*z\.number\(\)/)
    for (const word of ['percentOff', 'percent', 'pct']) {
      expect(section, `دخل «${word}» بابَ خصمِ المدرّب — فصار الخصمُ نسبةً`).not.toContain(word)
    }
  })

  it('وشاشةُ «دعوتي» لا تعرض حقلَ نسبةٍ ولا ترسلها', () => {
    const page = read('src/pages/trainer/Referral.tsx')
    const at = page.indexOf('function MyDiscounts')
    expect(at, 'لوحةُ الخصوم غائبةٌ عن «دعوتي»').toBeGreaterThan(-1)
    const panel = page.slice(at, page.indexOf('export default function Referral'))
    expect(panel, 'اللوحةُ لا ترسل مبلغا').toContain('amount')
    for (const word of ['percentOff', 'percent:']) {
      expect(panel, `حقلُ «${word}» في لوحةِ خصمِ المدرّب`).not.toContain(word)
    }
  })
})
