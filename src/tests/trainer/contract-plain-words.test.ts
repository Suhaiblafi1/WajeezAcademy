/* كلماتٌ تُبسَّط لمن ليس فصيحا — أمرُ صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦).
 *
 * «غير كلمه رُكب لاي كلمه عربيه مفهومه… وقل لي كلمات اخرى ترى تبسيطها مهم
 * لمن هو غير فصيح باللغه»، ثمّ: «المتن تصبح المحتوى او النص… متنه.. تصبح
 * محتواه»، ثمّ: «ايضا كلمه بيان».
 *
 * ── ولمَ تُقاس على المتن المصيَّر ──
 *
 * وثيقةٌ يقرؤها إنسانٌ ويوقّع عليها. وفحصٌ يطابق سطرا في ملفّ مصدرٍ يخضرّ
 * ولو لم يبلغ ذلك السطرُ الوثيقةَ — وقد وقع في هذا المستودَع ثلاثَ مرّات.
 *
 * ── وما لا يُمَسّ ──
 *
 * «بيانات» بمعنى المعلومات تبقى: هي غيرُ «بيان» بمعنى الإفادة، وخمسَ عشرةَ
 * مرّةً في الوثيقة. فحارسٌ يمنع الجذرَ كلَّه يمنع ما لم يُطلَب منعُه —
 * ويُثبَت هنا أنّها باقية، لا أنّها زالت.
 */

import { describe, expect, it } from 'vitest'
import { renderContractBodyAr, type ContractBodyInput } from '@/application/trainer/contract-body'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const BASE: ContractBodyInput = {
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٣٠ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 12, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
}
/* والمشروطُ وذو الساعات كذلك: فروعٌ لا تُطبَع في الأوّل، وفيها كانت
   «بيان» و«استرشادي» — فحارسٌ يقرأ واحدا يترك البقيّةَ بلا عين. */
const VARIANTS: Record<string, string> = {
  'بسيط': renderContractBodyAr(BASE),
  'مشروط': renderContractBodyAr({
    ...BASE,
    conditional: { orientationOnAr: '٥ أكتوبر ٢٠٢٦', deadlineOnAr: '١٠ أكتوبر ٢٠٢٦', windowDays: 5, extensionDays: 2 },
  }),
  'بحديثِ ساعات': renderContractBodyAr({ ...BASE, hoursNoteAr: 'نحو 16 ساعة' }),
  'بساعاتٍ في اللقطة': renderContractBodyAr({
    ...BASE,
    courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى', totalHours: 16, recordedHours: 4 } as never],
  }),
}

/** الكلمةُ المتروكة، وبمَ حلّت — يُقرأ سببُ المنع من الجدول نفسِه */
const RETIRED: readonly [RegExp, string, string][] = [
  /* ═══ و«متن» تُطابَق كلمةً لا حروفا في كلمة (٣٠ سبتمبر ٢٠٢٦) ═══

     كان النمطُ `/متن/` حرفا في أيّ موضع، فسقط الحارسُ على «المتنازع فيه»
     في البند 4-14 — وهي كلمةٌ صحيحةٌ لا علاقةَ لها بالممنوع. وكان سيسقط
     على «يمتنع» و«متناول» و«المتنوع» كذلك.

     وهو العطبُ الذي يحذّر منه CLAUDE.md بعينه: «طابقوا نصّا في تعليق، أو
     اسما جزءا من اسم — فالفحصُ على البنية لا على ورود حرف». وأختُه في هذا
     الجدول (`بيان`) كانت تحتاط له بنظرةٍ أمامية، وهذه لم تكن.

     فصار المطابَق: سابقةً جرٍّ أو تعريفٍ اختيارية، ثمّ «متن»، ثمّ ضميرا
     اختياريّا، ثمّ **حدَّ كلمة** — فلا يمرّ «المتن» ولا «متنه»، ولا يسقط
     على «المتنازع». وجدولُ `MATCHER_CASES` أدناه يُثبت الوجهَين. */
  [/(?:^|[^ا-ي])[بلوكف]?(?:ال)?متن(?:ه|ها|هما|هم|ي|نا)?(?![ا-ي])/, 'متن',
    'النصّ (في العقد) أو المحتوى (في الوحدات)'],
  [/بيان(?!ات|اتك|اته)/, 'بيان', 'إرشاد · معلومة · ورقة · تفصيل'],
  [/عون/, 'عون', 'تُعين'],
  [/خالف لفظه/, 'خالف لفظه', 'اختلف عمّا في البنود'],
  [/المعتبر/, 'المعتبر', 'الملزِمة'],
  [/استرشادي/, 'استرشادي', 'للإرشاد'],
  [/ركّب|رُكِّب|تركيب/, 'ركّب', 'أنشأ'],
]

/* والنمطُ نفسُه يُقاس على جدولٍ — فحارسٌ لا يُعرَف ما يمسك وما يترك
   يخضرّ على الخطأ في الوجهَين: يسقط على كلمةٍ صحيحةٍ، أو يمرّ الممنوعُ
   تحته ولا يُدرى. */
const MATCHER_CASES: readonly [string, boolean][] = [
  ['ولا يجوز تعديل المتن بعد التوقيع.', true],
  ['وهذا متنه كما وقّعه.', true],
  ['ومتنها محفوظ في القاعدة.', true],
  ['وما جاء في المتن، فهو الملزم.', true],
  ['ويقرأ بالمتن لا بالخلاصة.', true],
  /* وهذه صحيحةٌ كلُّها — لو سقط عليها الحارسُ لَمنع لغةً لا حرجَ فيها */
  ['ويبقى القدر المتنازع فيه موقوفا.', false],
  ['ويمتنع عن الكتابة فوقه.', false],
  ['وهو في متناول المدرب.', false],
  ['والمحتوى المتنوع يعين على الفهم.', false],
  ['ولا يمتنع من معالجته معالجة مهنية.', false],
]

describe('ونمطُ «متن» يمسك الكلمةَ ولا يمسك حروفَها في غيرها', () => {
  const [re] = RETIRED.find(([, w]) => w === 'متن')!
  for (const [sample, banned] of MATCHER_CASES) {
    it(`${banned ? 'يمسك' : 'يترك'}: «${sample}»`, () => {
      expect(re.test(sample)).toBe(banned)
    })
  }
})

describe('الكلماتُ الصعبةُ لا تعود إلى وثيقةٍ تُوقَّع', () => {
  for (const [name, body] of Object.entries(VARIANTS)) {
    it(`لا كلمةَ متروكةً في المتن «${name}»`, () => {
      /* الشاهدُ المضادّ أوّلا: لو لم يُصيَّر شيءٌ لَخضرّ المنعُ على الفراغ */
      expect(body.length, 'لم يُصيَّر المتن').toBeGreaterThan(5000)
      expect(body, 'المتنُ ليس متنَ العقد').toContain('البند 1 — صفة العلاقة')
      for (const [re, word, instead] of RETIRED) {
        expect(re.test(body), `عادت «${word}» إلى المتن — وموضعُها ${instead}`).toBe(false)
      }
    })
  }

  it('وما حلّ محلَّها موجودٌ فعلا — لا حُذفت الجملةُ كلُّها', () => {
    const b = VARIANTS['بسيط']
    expect(b, 'سقطت جملةُ الخلاصة بدل أن تُبسَّط').toContain('وهذه الخلاصة تعين على القراءة')
    expect(b, 'سقط تعريفُ كشف المستحقات').toContain('كشف المستحقات: ورقة تكتب للمدرب')
    expect(b, 'سقطت خاتمةُ المعجم').toContain('فإن اختلف عما في البنود، فالبنود هي الملزمة')
    expect(b, 'سقط إرشادُ المدّة').toContain('وهذا إرشاد لا شرط')
    expect(b, 'سقطت معلومةُ 15-4').toMatch(/15-4 وإذا ثبت أن معلومة جوهرية/)
  })

  /* ═══ والشكلُ معقودٌ على كلمة، فيُقاس عقدُه ═══

     `isAdvisoryNote` كانت تكتشف الفقرةَ بـ«استرشادي». ولمّا بُسّطت الكلمةُ
     كفّت عن مطابقة شيء، ففقدت الفقرةُ شكلَها ولم يسقط فحصٌ واحد — لأنّ
     الحرفَ لم ينقص، والشكلَ وحدَه ذهب. فيُمسَك العقدُ هنا: أن تكتشف فقرةً
     بعينها، لا أن تُقرأ كلمةٌ في ملفّ. */
  it('وفقرةُ الإرشاد يمسكها كاشفُها — فلا تفقد شكلَها بتبسيطِ كلمة', async () => {
    const { parseContractDoc, isAdvisoryNote } = await import('@/application/trainer/contract-sections')
    const blocks = parseContractDoc(VARIANTS['بسيط']).sections.flatMap((s) => s.blocks)
    const adv = blocks.filter(isAdvisoryNote)
    expect(adv.length, 'لم يعد كاشفُ فقرة الإرشاد يمسك شيئا').toBe(1)
    expect((adv[0] as { textAr: string }).textAr, 'أمسك فقرةً غيرَ فقرة الساعات')
      .toContain('ولا يبين هذا الملحق عدد ساعات كل دورة')
  })

  /* ═══ و«يحرر» تبقى في البند 4-10 وإقراره وحدَهما ═══

     `CODE_TERMS_VERSION` معقودٌ على بصمة نصّ 4-10 (`trainer-code-terms`):
     فتبديلُ حرفٍ فيه يرفع الإصدارَ، ورفعُ الإصدار **يُلزم كلَّ مدرّبٍ قَبِل
     الشروطَ أن يقبلها ثانيةً** قبل أوّل كودٍ يصدره. وهو ثمنٌ لا يُدفع
     لتبسيطِ كلمةٍ بلا إذنِ صاحب المنصّة.

     فتُبسَّط في المعجم حيث لا ثمنَ لها، وتبقى هناك — ويُقاس الأمران معا
     كيلا يُظنّ بقاؤها سهوا. */
  it('و«يحرر» بقيت في 4-10 وإقراره وحدَهما — لا سهوا بل لثمنٍ يُدفَع', () => {
    const b = VARIANTS['بسيط']
    expect(b, 'بُسّطت في 4-10 فيُطلَب القبولُ من كلّ من قَبِل').toContain('في أول كشف مستحقات يحرر للمدرب')
    expect(b, 'لم تُبسَّط حيث لا ثمنَ لها').toContain('كشف المستحقات: ورقة تكتب للمدرب')
    const n = (b.match(/يحرر/g) ?? []).length
    expect(n, `«يحرر» في ${n} موضعا من المتن — والمسموحُ البند 4-10 وحدَه`).toBe(1)
  })

  it('وإقرارُ الكود مثلُه — وهو يُعرَض عند التوقيع لا يُطبَع في المتن', async () => {
    const { contractAcks } = await import('@/application/trainer/contract-body')
    const ack = contractAcks(true).find((a) => a.key === 'issued_discount')
    expect(ack, 'سقط إقرارُ الخصم الذي يصدره المدرّب').toBeTruthy()
    expect(ack!.textAr, 'بُدّل نصُّ الإقرار فيُطلَب القبولُ من كلّ من قَبِل')
      .toContain('في أول كشف مستحقات يحرر لي')
  })

  it('و«بيانات» بمعنى المعلومات باقيةٌ — فالمنعُ على المعنى لا على الجذر', () => {
    const b = VARIANTS['بسيط']
    const n = (b.match(/بيانات|بياناتك/g) ?? []).length
    expect(n, 'مُسحت «بيانات» وهي غيرُ المقصودة').toBeGreaterThan(5)
    expect(b, 'ضاع بندُ بيانات الحساب البنكيّ').toContain('بيانات حسابه البنكي')
  })
})
