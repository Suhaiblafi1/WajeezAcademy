/* ملفّاتُ التعديلات دفعةً واحدة (١٠ أكتوبر ٢٠٢٦) — يُقرأ كلُّ ملفٍّ قبل رفعه: أيُّ خطّةٍ هو،
   وكم بندا فيه. وما لا يُقرأ يعود بسببه لا يرمي — فلا يوقف ما بعده من الدفعة. */

import { describe, expect, it } from 'vitest'
import { editFilePath, isPdfName, pdfKey, pickedPdfs, KEEP_LATEST_AR, keepLatestPath, missingWorkbooksAr, withWorkbookKeys, workbookFilesNeeded, keptLatestAr, readEditsFile, uploadedLineAr } from '@/application/trainer/plan-edits-bulk'

const PLAN = '7c1a3a52-2a7e-4a36-9a43-0d1d2b6b8f10'
const file = (over: Record<string, unknown> = {}) => JSON.stringify({
  format: 'wajeez.plan-edits/1', planId: PLAN, titleAr: 'دورة الإقناع — ماريا',
  items: [
    { kind: 'plan', required: true, reasonAr: 'س', set: { summaryAr: 'ن' } },
    { kind: 'plan', reasonAr: 'س', set: { titleAr: 'ع' } },
    { kind: 'plan', required: false, reasonAr: 'س', set: { audienceAr: 'ج' } },
  ],
  ...over,
})

describe('قراءة الملفّ', () => {
  it('يعرف خطّته وعدد بنوده وكم منها مطلوب — ويحمل ما يرفع كما هو', () => {
    const r = readEditsFile('06.json', file())
    expect(r).toMatchObject({ ok: true, planId: PLAN, titleAr: 'دورة الإقناع — ماريا', count: 3, required: 1 })
    expect(r.ok && r.body).toEqual(JSON.parse(file()))
  })

  it('⚠️ ملفّ لا يذكر خطّته يردّ بسببه — لا يخمّن موضعه', () => {
    expect(readEditsFile('x.json', file({ planId: undefined }))).toEqual({
      name: 'x.json', ok: false, problemAr: 'لا يذكر الملفّ خطّته (planId) — ارفعه من بطاقة خطّته',
    })
    expect(readEditsFile('x.json', file({ planId: '  ' })).ok).toBe(false)
  })

  it('⚠️ وما ليس JSON أو ليس ملفّ تعديلات يعود بسببه ولا يرمي', () => {
    expect(readEditsFile('a.pdf', '%PDF-1.7')).toMatchObject({ ok: false, problemAr: 'ليس ملفّ JSON مقروءا' })
    expect(readEditsFile('b.json', '[1,2]')).toMatchObject({ ok: false, problemAr: 'ليس ملفّ تعديلات' })
    expect(readEditsFile('c.json', 'null')).toMatchObject({ ok: false, problemAr: 'ليس ملفّ تعديلات' })
    expect(readEditsFile('d.json', file({ items: [] }))).toMatchObject({ ok: false, problemAr: 'الملفّ بلا تعديلات' })
  })

  it('والعنوان الفارغ لا يعرض اسما', () => {
    expect(readEditsFile('e.json', file({ titleAr: ' ' }))).toMatchObject({ ok: true, titleAr: null })
  })
})

describe('ما يقال بعد الرفع', () => {
  it('العدد بصيغته العربيّة، والمطلوب إن وجد', () => {
    expect(uploadedLineAr(19, 3)).toBe('رفع مسوّدة: 19 بندا، 3 منها مطلوبة')
    expect(uploadedLineAr(5, 1)).toBe('رفع مسوّدة: 5 بنود، 1 منها مطلوب')
    expect(uploadedLineAr(13, 0)).toBe('رفع مسوّدة: 13 بندا')
  })

  /* وكانت هنا سطورُ الاستبدال والسحب وخلاصةُ الدفعة وطرقُ الرفع الثلاث (١٠ و١٢ أكتوبر). وذهبت بقول صاحب المنصّة
     «فقط تحميل ورفع» (٢٦ أكتوبر ٢٠٢٦) — وخلاصةُ الصندوق الواحد في \`review-upload.test.ts\`. */
})

describe('«احذف المكرر» في بطاقة الخطة — يبقى آخر ملف رفع (١٢ أكتوبر ٢٠٢٦)', () => {
  /* وكان معه زرٌّ للخطط كلِّها في «خطط تنتظر اعتمادك» — وذهب بقول صاحب المنصّة «فقط تحميل ورفع» (٢٦ أكتوبر ٢٠٢٦) */
  it('⚠️ مسلكه مسلك الخادم — للخطة', () => {
    expect(keepLatestPath(PLAN)).toBe(`/api/admin/cohort-plans/${PLAN}/edits/keep-latest`)
  })

  it('⚠️ ويقول ما يقع به: يبقى آخر ملف، وما قرّر فيه المدرّب لا يمسّ', () => {
    expect(KEEP_LATEST_AR.whatAr).toMatch(/آخر ملف رفعته/)
    expect(KEEP_LATEST_AR.whatAr).toMatch(/لا يمس/)
  })

  it('وسطر البطاقة يقول كم سحب بصيغة عدده — ولا يعد بإعادة لا تقع', () => {
    expect(keptLatestAr(1)).toBe('سحب 1 بند من ملفات أقدم، وبقي آخر ملف رفعته.')
    expect(keptLatestAr(35)).toMatch(/^سحب 35 بندا من ملفات أقدم/)
  })

  it('⚠️ ونصوصه بلا تشكيل إعرابيّ — اللغة البيضاء', () => {
    const all = [KEEP_LATEST_AR.labelAr, KEEP_LATEST_AR.whatAr, keptLatestAr(5)].join(' ')
    expect(all).not.toMatch(/[\u064B-\u0650\u0652]/)
  })
})

describe('الكرّاسات المصحّحة مع ملف التعديلات (١٢ أكتوبر ٢٠٢٦)', () => {
  const body = { planId: PLAN, items: [
    { kind: 'workbook_replace', moduleId: 'M1', reasonAr: 'س', file: { name: ' كراسة 1.pdf ' } },
    { kind: 'workbook_replace', moduleId: 'M2', reasonAr: 'س', file: { name: 'كراسة 2.pdf', key: 'قائم-سلفا-123', mime: 'application/pdf' } },
    { kind: 'plan', reasonAr: 'س', set: { summaryAr: 'ن' } },
  ] }

  it('⚠️ يسمّي ما يحتاج رفعا — بلا مفتاح، مرة واحدة لكل اسم', () => {
    expect(workbookFilesNeeded(body)).toEqual(['كراسة 1.pdf'])
    expect(workbookFilesNeeded({ items: [...body.items, body.items[0]] })).toEqual(['كراسة 1.pdf'])
  })

  it('⚠️ ويكتب المفتاح في بنده وحده، ولا يمسّ الأصل ولا ما له مفتاح', () => {
    const out = withWorkbookKeys(body, { 'كراسة 1.pdf': 'مفتاح-جديد-456' }) as typeof body
    expect(out.items[0]!.file).toEqual({ name: ' كراسة 1.pdf ', key: 'مفتاح-جديد-456', mime: 'application/pdf' })
    expect(out.items[1]!.file).toEqual(body.items[1]!.file)
    expect(body.items[0]!.file).not.toHaveProperty('key')
  })

  /* ومرفقُ المهمّة الجديدُ مثلُ الكرّاسة (١٧ أكتوبر ٢٠٢٦، `task_attachment`) — والعنوانُ وحدَه لا يطلب ملفّا */
  it('⚠️ ومرفق المهمّة الجديد يختار مع الملف ويكتب مفتاحه في بنده — والعنوان وحده لا يطلب ملفّا', () => {
    const withTask = { items: [
      { kind: 'task_attachment', assessmentId: 'x', match: { title: 'نموذج' }, reasonAr: 'س', file: { name: 'مستخرج.pdf' } },
      { kind: 'task_attachment', assessmentId: 'y', match: { title: 'موذج' }, reasonAr: 'س', title: 'نموذج' },
    ] }
    expect(workbookFilesNeeded(withTask)).toEqual(['مستخرج.pdf'])
    const out = withWorkbookKeys(withTask, { 'مستخرج.pdf': 'مفتاح-789' }) as typeof withTask
    expect(out.items[0]!.file).toEqual({ name: 'مستخرج.pdf', key: 'مفتاح-789', mime: 'application/pdf' })
    expect(out.items[1]).toEqual(withTask.items[1])
  })

  it('والمسار، والـPDF يعرف باسمه، وما لم يختر يقال باسمه', () => {
    expect(editFilePath(PLAN)).toBe(`/api/admin/cohort-plans/${PLAN}/edit-files`)
    expect([isPdfName('a.PDF '), isPdfName('a.json')]).toEqual([true, false])
    /* ويقال «الملف» لا «ملف الكراسة» — فقد يكون مرفق مهمّة (١٧ أكتوبر ٢٠٢٦) */
    expect(missingWorkbooksAr(['أ.pdf'])).toBe('الملف «أ.pdf» ليس بين ما اخترته — اختره مع ملف التعديلات')
    expect(missingWorkbooksAr(['أ.pdf', 'ب.pdf'])).toMatch(/^الملفات «أ.pdf»، «ب.pdf»/)
    expect(missingWorkbooksAr(['أ.pdf'])).not.toMatch(/[\u064B-\u0650\u0652]/)
  })
})

/* ═══ الكرّاسةُ المختارةُ تُعرف ولو فُكّت في ماك (١٧ أكتوبر ٢٠٢٦) ═══
   رُدّ ملفُّ حفصة بـ«ليس بين ما اخترته» والملفّاتُ مختارة: الاسمُ في البند حرفُ همزةٍ واحد (NFC)،
   والملفُّ بعد الفكّ حرفان (NFD) — والعينُ لا ترى فرقا. */
describe('اسمُ الـPDF يقابَل بصورته الواحدة', () => {
  const name = 'أمن الشبكات — الكراسة.pdf'
  const mac = name.normalize('NFD')

  it('المسحُ صادق: الاسمان مختلفان حرفا ومتّفقان قراءة', () => {
    expect(mac === name).toBe(false)
    expect(mac.normalize('NFC')).toBe(name)
  })

  it('⚠️ ملفٌّ اسمُه بصورة ماك يُعرف باسم البند', () => {
    const pdfs = pickedPdfs([{ name: mac }, { name: 'ملف.json' }])
    expect(pdfs.has(pdfKey(name)), 'لم يُعرف الملفُّ المختار').toBe(true)
    expect(pdfs.get(pdfKey(name))?.name).toBe(mac)
    expect(pdfs.size, 'عُدّ ملفُّ التعديلات كرّاسة').toBe(1)
  })

  it('والفراغُ في الطرفين لا يُفرّق', () => {
    expect(pdfKey(` ${mac} `)).toBe(pdfKey(name))
  })
})
