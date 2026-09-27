/* مدّةُ العقد وصرفُ الأتعاب — قراران لصاحب المنصّة (٢٧ سبتمبر ٢٠٢٦).
 *
 * ── ولمَ كُتب هذا الملفُّ بعد أن شُحن ما يحرسه ──
 *
 * نُقض المتنُ سبعَ نقضاتٍ بعد التعديل ليُرى الحرّاسُ وهم يسقطون. فسقطوا على
 * خمسٍ — **ونجت اثنتان**:
 *
 *   ⑥ رُدَّ الصرفُ إلى «انتهاء الشهر» فلم يحمرّ شيء.
 *   ⑦ سقطت مدّةُ الفصل من 17-1 فصارت «لمدة غير محددة» ولم يحمرّ شيء.
 *
 * وهما **القراران الجديدان بعينهما** — أي أنّ أشدَّ ما في التعديل جِدّةً كان
 * أقلَّه حراسةً. ووعدُ مالٍ ووعدُ مدّةٍ يعودان إلى ما كانا عليه في أوّل تعديلٍ
 * يمرّ على هذا الملفّ، ولا يعلم به أحد.
 *
 * ── وما يُقاس هنا ──
 *
 * البنيةُ لا ورودُ الحرف: المُهَلُ من ثوابتها، ونافذةُ الفصل من `termWindowAr`
 * — فلو بُدِّل ثابتٌ تبع المتنُ، ولو كُتب رقمٌ حرفا في المتن انكشف.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderContractBodyAr, type ContractBodyInput } from '@/application/trainer/contract-body'
import { DEFAULT_REQUIRED_DOCUMENTS } from '@/application/trainer/contract-documents'
import {
  PAYOUT_APPROVAL_DAYS, PAYOUT_TRANSFER_DAYS, PAYOUT_OUTER_DAYS,
  payoutTimingNoteAr, termWindowAr,
} from '@/application/trainer/notice-periods'
import { MATERIALS_WINDOW_DAYS } from '@/application/trainer/conditional-offer'

const base: Omit<ContractBodyInput, 'conditional'> = {
  academyPartyLineAr: 'أكاديمية وجيز للتدريب', academyLegalNameAr: 'أكاديمية وجيز للتدريب',
  academyTradingNameAr: 'أكاديمية وجيز', governingLawAr: 'القانون الأردني', disputeVenueAr: 'محاكم عمّان',
  trainerFullName: 'سعادُ المدرّبة', trainerEmail: 't@example.com',
  applicationReference: 'WJ-TR-2026-00042', issuedOnAr: '27 سبتمبر 2026',
  courses: [{ courseId: 'C-ACC-101', titleAr: 'أساسيات المحاسبة' }],
  compensation: { type: 'per_seat', rate: '25', referralRate: '30', minSeats: 12, currency: 'USD' },
  rateWaivedReasonAr: null, hoursNoteAr: null, requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
}
const offer = () => renderContractBodyAr({
  ...base,
  conditional: {
    orientationOnAr: null, deadlineOnAr: null,
    windowDays: MATERIALS_WINDOW_DAYS, extensionDays: 2,
  },
})
const clause = (body: string, n: string) => {
  const m = new RegExp(`^${n} .*$`, 'm').exec(body)
  expect(m, `البند ${n} غائبٌ من المتن`).not.toBeNull()
  return m![0]
}
const summaryLine = (body: string, head: string) =>
  body.split('\n').find((l) => l.startsWith(`· ${head}`))

describe('① الصرفُ من انتهاء الشعبة لا من انتهاء الشهر', () => {
  /* قولُ صاحب المنصّة: «يجب أن يكون بعد انتهاء الدورة وليس الشهر — لكلّ شعبةٍ
     حقوقُها الخاصّة». وهو ما يقع في المحرّك أصلا: `generateForCohort` تُنشئ
     كشفا لكلّ شعبة، وحارسُ التكرار فيها على مرجع الشعبة لا على الفترة. */
  it('البند 4-2 يردّ الآجالَ إلى الشعبة، ولا يذكر الشهرَ البتّة', () => {
    const c = clause(offer(), '4-2')
    expect(c, 'الصرفُ ما زال معلَّقا بالشهر').not.toMatch(/الشهر/)
    expect(c, 'لا يُقال إنّ لكلّ شعبةٍ كشفَها').toMatch(/لكل شعبة كشف مستحقات خاص بها/)
    expect(c, 'أجلُ الاعتماد لا يُردّ إلى انتهاء الشعبة')
      .toMatch(new RegExp(`يعتمد خلال ${PAYOUT_APPROVAL_DAYS} يوما من تاريخ انتهاء الشعبة`))
    expect(c, 'السقفُ لا يُردّ إلى انتهاء الشعبة')
      .toMatch(new RegExp(`${PAYOUT_OUTER_DAYS} يوما من تاريخ انتهاء الشعبة`))
    expect(c, 'أجلُ الصرف غائب').toContain(`${PAYOUT_TRANSFER_DAYS} يوما من اعتماده`)
  })

  it('والخلاصةُ تقول ما يقوله البند — فلا يُقرأ وعدان', () => {
    const line = summaryLine(offer(), 'وصرفها:')
    expect(line, 'سطرُ الصرف غائبٌ من الخلاصة').toBeDefined()
    expect(line!, 'الخلاصةُ ما زالت تَعِد بالشهر').not.toMatch(/الشهر/)
    expect(line!, 'الخلاصةُ لا تقول إنّ لكلّ شعبةٍ كشفَها').toMatch(/لكل شعبة كشفها الخاص/)
  })

  it('وجملةُ «مستحقّاتي» في الشاشة تقولها كذلك — فلا تفترق عن العقد', () => {
    const note = payoutTimingNoteAr()
    expect(note, 'الشاشةُ ما زالت تقول «كشف الشهر»').not.toMatch(/الشهر/)
    expect(note, 'الشاشةُ لا تذكر الشعبة').toMatch(/الشعبة/)
    for (const n of [PAYOUT_APPROVAL_DAYS, PAYOUT_TRANSFER_DAYS, PAYOUT_OUTER_DAYS]) {
      expect(note, `الرقمُ ${n} غائبٌ عن جملة الشاشة`).toContain(String(n))
    }
  })

  it('ومعجمُ العقد لا يصف الكشفَ شهريّا', () => {
    const body = offer()
    const entry = body.split('\n').find((l) => l.startsWith('· كشف المستحقات:'))
    expect(entry, 'سطرُ كشف المستحقّات غائبٌ من المعجم').toBeDefined()
    expect(entry!, 'المعجمُ يقول «بيان شهري» والبندُ يقول لكلّ شعبة').not.toMatch(/شهري/)
    expect(entry!, 'المعجمُ لا يربط الكشفَ بالشعبة').toMatch(/عن كل شعبة/)
  })
})

describe('② والعقدُ لفصلٍ لا لأجلٍ مفتوح', () => {
  const { startAr, endAr } = termWindowAr()

  it('البند 17-1 يقول مدّتَه بنافذة الفصل، لا «مدة غير محددة»', () => {
    const c = clause(offer(), '17-1')
    expect(c, 'عادت المدّةُ مفتوحةً — والعقدُ لفصل').not.toMatch(/لمدة غير محددة/)
    expect(c, 'لا يُقال إنّها تنتهي بانتهاء الفصل').toMatch(/تنتهي بانتهاء فصل التدريب/)
    expect(c, `مبدأُ الفصل «${startAr}» غيرُ مذكور`).toContain(startAr)
    expect(c, `منتهى الفصل «${endAr}» غيرُ مذكور`).toContain(endAr)
  })

  /* «لا يحقّ له أن يمدّدها… كلُّها يجب أن تنتهي في الفصل نفسِه» */
  it('و17-9 يمنع شعبةً تنتهي بعد الفصل', () => {
    const c = clause(offer(), '17-9')
    expect(c, 'لا نصَّ يمنع شعبةً تتجاوز الفصل').toMatch(/لا تفتح للمدرب شعبة تنتهي/)
    expect(c, 'لا يُذكَر منتهى الفصل في المنع').toContain(endAr)
    expect(c, 'لا يُمنَع تمديدُ شعبةٍ قائمة').toMatch(/ولا تمدد شعبة قائمة/)
  })

  it('و17-10 يَعِد بدعوة التجديد ويقول ما تحمله', () => {
    const c = clause(offer(), '17-10')
    expect(c, 'لا وعدَ بدعوة تجديد').toMatch(/دعوة تجديد/)
    expect(c, 'لا يُقال إنّ الأتعابَ قد تتغيّر فيها').toMatch(/أتعابه وقد تزاد/)
    expect(c, 'لا يُقال إنّ المدرّبَ يؤكّد بياناته').toMatch(/محل إقامته|أرقام هاتفه/)
    expect(c, 'يمتدّ العقدُ إلى فصلٍ تالٍ بلا قبوله').toMatch(/إلا بقبوله دعوة التجديد/)
  })

  it('والخلاصةُ تُعلن المدّةَ — فأوّلُ ما يقرأ يقول إلى متى', () => {
    const line = summaryLine(offer(), 'والمدة:')
    expect(line, 'سطرُ المدّة غائبٌ من الخلاصة').toBeDefined()
    expect(line!).toContain(startAr)
    expect(line!).toContain(endAr)
    expect(line!, 'الخلاصةُ لا تذكر دعوةَ التجديد').toMatch(/دعوة تجديد/)
  })

  /* ═══ والنافذةُ تُبنى من ثابتها — ويُقاس ذلك في المصدر لا في المطبوع ═══

     كلُّ فحصٍ أعلاه يقرأ المتنَ المصيَّر، فيخضرّ كذلك على متنٍ كُتبت فيه
     «1 نوفمبر» بيدها: النتيجةُ واحدةٌ اليوم. وتنفصل غدا حين يُبدَّل الثابتُ
     — فيُعدَّل `TERM_END_DAY` وتبقى الوثيقةُ تقول ٣١، ولا يحمرُّ شيء.

     (وهي النقضةُ الثامنةُ التي نجت حين نُقض هذا التعديل، فكُتب لها هذا.)

     فيُقرأ **المصدر**: موضعُ الفصل في 17-1 و17-9 يحمل التعويضَ لا الحرف. */
  it('ونافذةُ الفصل مبنيّةٌ من ثوابتها لا مكتوبةً في المتن', () => {
    expect(startAr, 'مبدأُ الفصل ليس أوّلَ شهر').toMatch(/^1 /)
    expect(endAr, 'منتهى الفصل بلا يومٍ يُقرأ').toMatch(/^\d{1,2} /)
    expect(startAr).not.toBe(endAr)

    const source = readFileSync(
      join(process.cwd(), 'src/application/trainer/contract-body.ts'), 'utf8',
    )
    const line171 = source.split('\n').find((l) => l.startsWith('17-1 تسري'))
    expect(line171, 'البند 17-1 غائبٌ من المصدر').toBeDefined()
    expect(line171!, 'نافذةُ الفصل كُتبت حرفا في 17-1 — فتنفصل عن ثابتها')
      .toContain('${termStartAr}')
    expect(line171!).toContain('${termEndAr}')

    const line179 = source.split('\n').find((l) => l.startsWith('17-9 ولا تفتح'))
    expect(line179, 'البند 17-9 غائبٌ من المصدر').toBeDefined()
    expect(line179!, 'منتهى الفصل كُتب حرفا في 17-9').toContain('${termEndAr}')

    /* ولا يُكتب اسمُ شهرٍ حرفا في متن العقد البتّة — المصدرُ الوحيدُ
       `termWindowAr`، وهو في `notice-periods.ts`. */
    for (const m of ['نوفمبر', 'يناير', 'ديسمبر']) {
      expect(source, `اسمُ شهرٍ «${m}» مكتوبٌ حرفا في متن العقد`).not.toMatch(
        new RegExp(`^(?!\\s*[*/]).*[\u0600-\u06FF] ${m}`, 'm'),
      )
    }
  })
})
