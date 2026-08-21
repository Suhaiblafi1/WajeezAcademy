import { describe, expect, it } from 'vitest'
import { MAX_CHECKS, parseChecks, validateChecks } from '../../application/content/module-checks'

const Q = [
  'س: ما الصفة الناقصة؟',
  '- انتظام المدخلات',
  '+ تكرارها اليومي',
  '- حسم القرار',
  'ش: التكرار وحده لا يكفي.',
].join('\n')

describe('تمرين الاسترجاع — التحليل (ح-٣)', () => {
  it('فارغ لا أسئلة ولا أخطاء — الغياب ليس خطأ', () => {
    for (const v of [null, undefined, '', '   \n  ']) {
      expect(parseChecks(v)).toEqual({ checks: [], errorsAr: [] })
    }
  })

  it('سؤال كامل يُحلَّل بخياراته وصحيحه وشرحه', () => {
    const { checks, errorsAr } = parseChecks(Q)
    expect(errorsAr).toEqual([])
    expect(checks).toHaveLength(1)
    expect(checks[0]).toEqual({
      promptAr: 'ما الصفة الناقصة؟',
      options: ['انتظام المدخلات', 'تكرارها اليومي', 'حسم القرار'],
      correctIndex: 1,
      explainAr: 'التكرار وحده لا يكفي.',
      chapterIndex: null,
    })
  })

  it('عدة أسئلة يفصلها سطر فارغ أو «س:» جديدة', () => {
    expect(parseChecks(`${Q}\n\n${Q.replace('ما الصفة الناقصة؟', 'سؤال ثان')}`).checks).toHaveLength(2)
    expect(parseChecks(`${Q}\n${Q.replace('ما الصفة الناقصة؟', 'سؤال ثان')}`).checks).toHaveLength(2)
  })

  it('الشرح اختياري', () => {
    const { checks, errorsAr } = parseChecks('س: سؤال\n- أ\n+ ب')
    expect(errorsAr).toEqual([])
    expect(checks[0].explainAr).toBeNull()
  })

  it('النقطة والنجمة والشرطة كلها علامات خيار، و+ للصحيح', () => {
    const { checks } = parseChecks('س: س\n* أ\n+ ب\n- ج')
    expect(checks[0].options).toEqual(['أ', 'ب', 'ج'])
    expect(checks[0].correctIndex).toBe(1)
  })

  it('النقطتان العربيتان «：» مقبولتان كالإنجليزية', () => {
    expect(parseChecks('س： سؤال\n- أ\n+ ب').checks).toHaveLength(1)
  })

  it('بلا جواب صحيح: خطأ مقروء ولا سؤال يُقبل', () => {
    const { checks, errorsAr } = parseChecks('س: سؤال\n- أ\n- ب')
    expect(checks).toHaveLength(0)
    expect(errorsAr.join(' ')).toContain('لا جواب صحيح')
  })

  it('أكثر من جواب صحيح: خطأ — الاسترجاع سؤال بجواب واحد', () => {
    const { checks, errorsAr } = parseChecks('س: سؤال\n+ أ\n+ ب')
    expect(checks).toHaveLength(0)
    expect(errorsAr.join(' ')).toContain('أكثر من جواب صحيح')
  })

  it('خيار واحد: خطأ — لا استرجاع بلا بديل', () => {
    expect(parseChecks('س: سؤال\n+ أ').errorsAr.join(' ')).toContain('خيارين على الأقل')
  })

  it('خيار أو شرح قبل أي سؤال: خطأ مقروء', () => {
    expect(parseChecks('- أ').errorsAr.join(' ')).toContain('خيار قبل أي سؤال')
    expect(parseChecks('ش: شرح').errorsAr.join(' ')).toContain('شرح قبل أي سؤال')
  })

  it('سطر غير مفهوم يُبلَّغ عنه ولا يُتجاهل صامتا', () => {
    const { errorsAr } = parseChecks('س: سؤال\n- أ\n+ ب\nسطر عشوائي')
    expect(errorsAr.join(' ')).toContain('سطر غير مفهوم')
  })

  it('تجاوز حدّ الأسئلة يُبلَّغ ويُقتَص', () => {
    const many = Array.from({ length: MAX_CHECKS + 2 }, (_, i) => `س: سؤال ${i}\n- أ\n+ ب`).join('\n\n')
    const { checks, errorsAr } = parseChecks(many)
    expect(checks).toHaveLength(MAX_CHECKS)
    expect(errorsAr.join(' ')).toContain('الحدّ')
  })

  it('CRLF لا يفسد التحليل', () => {
    expect(parseChecks('س: سؤال\r\n- أ\r\n+ ب').checks).toHaveLength(1)
  })


  it('«ف: N» يربط السؤال بفصل فيديو فيصير نقطة تفتيش (ح-٢)', () => {
    const { checks, errorsAr } = parseChecks('س: سؤال\nف: 2\n- أ\n+ ب')
    expect(errorsAr).toEqual([])
    expect(checks[0].chapterIndex).toBe(2)
  })

  it('سؤال بلا «ف:» يبقى سؤال وحدة لا نقطة تفتيش', () => {
    expect(parseChecks('س: سؤال\n- أ\n+ ب').checks[0].chapterIndex).toBeNull()
  })

  it('ربط بفصل قبل أي سؤال: خطأ مقروء', () => {
    expect(parseChecks('ف: 1').errorsAr.join(' ')).toContain('ربط بفصل قبل أي سؤال')
  })

  it('التحقق عند الحفظ: يقبل الصالح ويرفض ما لا يُفهم وما لا سؤال فيه', () => {
    expect(validateChecks(Q)).toEqual({ ok: true })
    expect(validateChecks('')).toMatchObject({ ok: false })
    expect(validateChecks('كلام بلا صيغة')).toMatchObject({ ok: false })
    const bad = validateChecks('س: سؤال\n- أ\n- ب')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errorsAr[0]).toContain('لا جواب صحيح')
  })
})
