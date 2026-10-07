/* خطّةُ الشعبة حزمةً تُنزَّل للمراجعة (٧ أكتوبر ٢٠٢٦).

   البناءُ المحضُ في `plan-review-bundle.ts`: أيُّ ملفّاتٍ تدخل الحزمةَ وبأيّ أسماء،
   وما يقوله `خطة-الشعبة.md` — وأوّلُه «حقائقُ المراجعة» التي تُبنى عليها قواعدُ
   الموسم: يومُ الانتهاء، وآخرُ لقاءٍ مباشر، وموعدُ مشروع التخرّج، وإلى متى يُقرأ. */

import { describe, expect, it } from 'vitest'
import { bundleFiles, reviewMarkdown, safeName, type ReviewBundleInput } from '@/application/trainer/plan-review-bundle'
import { cohortDayAr, whenAr } from '@/application/learning/cohort-gate'

const input = (over: Partial<ReviewBundleInput> = {}): ReviewBundleInput => ({
  courseTitle: 'أتمتة العمليات',
  cohortTitle: 'أتمتة العمليات — شعبة ديسمبر',
  trainerName: 'مدرّبٌ تجريبيّ',
  status: 'submitted',
  submittedAt: '2026-10-05T09:00:00Z',
  period: { startsOn: '2026-12-01', endsOn: '2027-01-30' },
  content: {
    kind: 'trainer',
    summaryAr: 'شعبةٌ تُخرج خريطةَ أتمتة.',
    modules: [
      { moduleId: 'M1', titleAr: 'رسمُ العمليّة', outcomeAr: 'خريطةٌ واحدة', activityAr: 'ارسم عمليّةً من عملك', artifactAr: 'الخريطة', bodyAr: 'سطرٌ أوّل\n# ليس عنوانا' },
      { moduleId: 'M2', titleAr: 'قياسُ الهدر', bodyFileKey: 'key-body-m2-0000', bodyFileName: 'هدر.pdf' },
      { moduleId: 'M3', titleAr: 'اختيارُ الأداة' },
      { moduleId: 'M4', titleAr: 'خطّةُ التنفيذ' },
    ],
    slots: [
      { startsOn: '2026-12-01', endsOn: '2026-12-07', moduleIds: ['M1', 'M2'] },
      { startsOn: '2026-12-08', endsOn: '2026-12-14', moduleIds: ['M3'] },
      { startsOn: '2026-12-15', endsOn: '2027-01-30', moduleIds: ['M4'] },
    ],
    workbook: {
      title: 'كرّاسةُ الأتمتة', bodyFileKey: 'key-workbook-00000', bodyFileName: 'كراسة.pdf',
      parts: [{ moduleId: 'M1', whereAr: 'ص ٣' }, { moduleId: 'M3', whereAr: 'ص ٢٠' }],
    },
    resources: [
      { title: 'كتابُ الهدر', kind: 'book', category: 'reading', moduleId: 'M2', bodyFileKey: 'key-res-book-0000', bodyFileName: 'lean/../x:y?.pdf' },
      { title: 'محاضرةٌ عامّة', url: 'https://youtube.test/v1', kind: 'video', category: 'public', moduleId: 'M1', noteAr: 'من الدقيقة ٤' },
      { title: 'مرجعٌ للشعبة', url: 'https://ref.test/', kind: 'link', category: 'public' },
    ],
  },
  sessions: [
    { id: 'S2', title: 'لقاءُ الأداة', startsAt: '2026-12-20T16:00:00Z', endsAt: '2026-12-20T18:30:00Z', moduleIds: ['M3'], approvalState: 'pending', status: 'scheduled' },
    { id: 'S1', title: 'لقاءُ الافتتاح', startsAt: '2026-12-02T16:00:00Z', endsAt: '2026-12-02T18:00:00Z', moduleIds: ['M1', 'M2'], approvalState: 'pending', status: 'scheduled', noteAr: 'أحضروا\nعمليّةً', attachmentKey: 'key-session-att-0', attachmentName: 'شرائح.pptx' },
    { id: 'S0', title: 'مبدئيّ', startsAt: '2026-12-01T16:00:00Z', endsAt: '2026-12-01T18:00:00Z', placeholder: true, status: 'scheduled' },
  ],
  assessments: [
    { id: 'T1', title: 'واجبُ الخريطة', type: 'assignment', moduleId: 'M1', dueAt: '2026-12-07T20:59:00Z', maxScore: 10, status: 'draft', briefAr: 'ارسمها', attachments: [{ title: 'نموذج', bodyFileKey: 'key-task-att-00000', bodyFileName: 'نموذج.docx' }] },
    { id: 'T2', title: 'مشروعُ التخرّج', type: 'project', moduleId: 'M4', dueAt: '2027-01-25T20:59:00Z', maxScore: 100, status: 'draft', briefAr: 'خطّةُ أتمتةٍ كاملة' },
  ],
  now: new Date('2026-10-07T08:00:00Z'),
  ...over,
})

describe('الملفّاتُ في الحزمة', () => {
  it('كلُّ ملفٍّ رفعه المدرّب — الكرّاسة ومتونُ المحاور والمصادرُ ومرفقاتُ اللقاءات والمهامّ', () => {
    const files = bundleFiles(input())
    expect(files.map((f) => f.key)).toEqual([
      'key-workbook-00000', 'key-body-m2-0000', 'key-res-book-0000', 'key-session-att-0', 'key-task-att-00000',
    ])
    expect(files[0]!.path).toBe('files/الكراسة — كراسة.pdf')
    expect(files[1]!.path).toBe('files/محاور/المحور 2 — قياسُ الهدر — هدر.pdf')
    expect(files[3]!.path).toBe('files/لقاءات/لقاءُ الافتتاح — شرائح.pptx')
    expect(files[4]!.path).toBe('files/مهام/واجبُ الخريطة — نموذج — نموذج.docx')
  })

  it('اسمُ المدرّب الحرُّ لا يصنع مجلّدا ولا يخرج من الحزمة — والامتدادُ يبقى', () => {
    const p = bundleFiles(input()).find((f) => f.key === 'key-res-book-0000')!.path
    expect(p.startsWith('files/مصادر/')).toBe(true)
    expect(p.slice('files/مصادر/'.length)).not.toMatch(/[/\\:?]/)
    expect(p).not.toContain('..')
    expect(p.endsWith('.pdf')).toBe(true)
  })

  it('المفتاحُ يدخل مرّة، والمساران المتطابقان يُفرَّقان برقم', () => {
    const base = input()
    const c = base.content as { resources: Record<string, unknown>[] }
    const files = bundleFiles({
      ...base,
      content: {
        ...c,
        resources: [
          { title: 'ملف', moduleId: 'M1', bodyFileKey: 'key-dup-a-0000000', bodyFileName: 'a.pdf' },
          { title: 'ملف', moduleId: 'M1', bodyFileKey: 'key-dup-b-0000000', bodyFileName: 'a.pdf' },
          { title: 'ملف', moduleId: 'M1', bodyFileKey: 'key-dup-a-0000000', bodyFileName: 'a.pdf' },
        ],
      },
    })
    const res = files.filter((f) => f.path.startsWith('files/مصادر/'))
    expect(res.map((f) => f.path)).toEqual(['files/مصادر/المحور 1 — ملف — a.pdf', 'files/مصادر/المحور 1 — ملف — a (2).pdf'])
  })

  it('safeName: لا فاصلَ ولا نقطةَ في أوّله، والقصُّ بالحروف', () => {
    expect(safeName('../a/b')).toBe('a b')
    expect(safeName('   ')).toBe('ملف')
    expect(safeName('سطر\nثانٍ\tثالث')).toBe('سطر ثانٍ ثالث')
    expect(Array.from(safeName('ك'.repeat(200), 10))).toHaveLength(10)
  })
})

describe('خطة-الشعبة.md', () => {
  const files = bundleFiles(input())
  const md = reviewMarkdown(input(), files, new Map([['key-session-att-0', 'أكبر من 25MB']]))

  it('حقائقُ المراجعة: الانتهاء، وآخرُ لقاءٍ مباشر، وموعدُ مشروع التخرّج، وإلى متى يُقرأ', () => {
    const facts = md.split('## حقائق المراجعة')[1]!.split('\n## ')[0]!
    expect(facts).toContain(`من ${cohortDayAr('2026-12-01')} إلى ${cohortDayAr('2027-01-30')} — 61 يوما`)
    /* المبدئيُّ لا يُعدّ لقاءً: لقاءان، أوّلُهما الافتتاحُ وآخرُهما لقاءُ الأداة */
    expect(facts).toContain('**اللقاءات المباشرة:** 2 — مجموعها 4.5 ساعة')
    expect(facts).toContain(`**أول لقاء مباشر:** ${whenAr('2026-12-02T16:00:00Z')}`)
    expect(facts).toContain(`**آخر لقاء مباشر:** ${whenAr('2026-12-20T16:00:00Z')}`)
    expect(facts).toContain(`**موعد مشروع التخرج (مشروعُ التخرّج):** ${whenAr('2027-01-25T20:59:00Z')}`)
    expect(facts).toContain(`حتى:** ${cohortDayAr('2027-07-30')}`)
    expect(facts).toContain('**محاورُ بلا مصدر:** المحور 3، المحور 4')
  })

  it('كلُّ محورٍ بحقوله الأربعة ومتنِه — ومتنُه اقتباسٌ لا يصنع عنوانا', () => {
    expect(md).toContain('#### المحور 1: رسمُ العمليّة')
    expect(md).toContain('- **مخرَج المحور:** خريطةٌ واحدة')
    expect(md).toContain('- **التطبيق العملي:** ارسم عمليّةً من عملك')
    expect(md).toContain('> # ليس عنوانا')
    expect(md.split('\n')).not.toContain('# ليس عنوانا')
    expect(md).toContain('- **المحتوى النظري:** ملفٌّ مرفوع: `files/محاور/المحور 2 — قياسُ الهدر — هدر.pdf`')
  })

  it('اللقاءُ بيومه وساعتيه ومدّته ومحاوره — وملاحظتُه ومرفقُه وإن لم يدخل', () => {
    expect(md).toContain('**لقاءُ الافتتاح**')
    expect(md).toContain('إلى 9:00 مساءً (ساعتان) · للمحاور 1 و2 · بانتظار الاعتماد')
    expect(md).toContain('  - ملاحظته: أحضروا عمليّةً')
    expect(md).toContain('  - مرفقه: ملفٌّ مرفوع لم يدخل الحزمة (أكبر من 25MB)')
    expect(md).toContain('- ~~files/لقاءات/لقاءُ الافتتاح — شرائح.pptx~~ — لم يدخل: أكبر من 25MB')
    expect(md).not.toContain('مبدئيّ')
  })

  /* والنوعُ ما يراه المتعلّم — يُشتقّ من الصنف (`displayKind`): العامُّ رابطٌ وإن
     حُفظ «فيديو»، كما في الشاشة */
  it('المصادرُ بنوعها ورابطها وملاحظتها، وما لا محورَ له في آخرها', () => {
    expect(md).toContain('- **[رابط] محاضرةٌ عامّة** · https://youtube.test/v1')
    expect(md).toContain('  - ملاحظة: من الدقيقة ٤')
    const general = md.split('## للشعبة كلها — ما لا محور له')[1]!
    expect(general).toContain('**[رابط] مرجعٌ للشعبة** · https://ref.test/')
  })

  it('الكرّاسةُ وأين يبدأ فيها كلُّ محور — وما قاله المدرّبُ في شكلها', () => {
    expect(md).toContain('- **الطريقة:** كرّاسةٌ واحدةٌ للدورة')
    expect(md).toContain('- **شكلها:** لم يقل أعلى القالب هي')
    expect(md).toContain('**الكراسة:** واحدةٌ للدورة — ملفٌّ مرفوع · لم يقل أعلى القالب هي')
    expect(md).toContain('- **اسمها:** كرّاسةُ الأتمتة')
    expect(md).toContain('- ملفٌّ مرفوع: `files/الكراسة — كراسة.pdf`')
    expect(md).toContain('- **أين يبدأ كلُّ محور فيها:** المحور 1: ص ٣ · المحور 3: ص ٢٠')
  })

  it('وروابطُ خطوات المدرّب — لكلّ خطوةٍ رابطُها، وبلا عنوانٍ لا قسم', () => {
    expect(md).not.toContain('## روابط خطوات المدرّب')
    const withLinks = reviewMarkdown(input({ links: { siteUrl: 'https://www.wajeezacademy.com/', cohortId: 'c-77' } }), files)
    expect(withLinks).toContain('## روابط خطوات المدرّب')
    expect(withLinks).toContain('- **الكرّاسة:** https://www.wajeezacademy.com/trainer/cohort/c-77?step=workbooks')
    expect(withLinks).toContain('- **المهامّ والمصادر:** https://www.wajeezacademy.com/trainer/cohort/c-77?step=assignments')
  })

  it('ملاحظاتُ الردّ السابق تُقال إن كانت', () => {
    expect(md).not.toContain('## ملاحظات الإدارة في الرد السابق')
    const again = reviewMarkdown(input({ reviewerNotes: { workbooks: 'أضف موضعَ المحور ٢' } }), files)
    expect(again).toContain('## ملاحظات الإدارة في الرد السابق')
    expect(again).toContain('**الكرّاسة:**')
    expect(again).toContain('> أضف موضعَ المحور ٢')
  })
})

/* ═══ وكرّاسةٌ لكلّ محور (٦ أكتوبر ٢٠٢٦) ═══
   المدرّبُ يختار: واحدةٌ للدورة أو لكلّ محورٍ كرّاستُه (`cohort-workbooks.ts`). والطريقتان
   تُحفظان معا — فالحزمةُ تحمل ملفّاتِ المختارة وحدَها، وتقول لكلّ كرّاسةٍ أعلى قالب وجيز هي. */
describe('كرّاسةٌ لكلّ محور', () => {
  const base = input()
  const perModule = input({
    content: {
      ...(base.content as Record<string, unknown>),
      workbookMode: 'modules',
      workbooks: [
        { moduleIds: ['M1', 'M2'], bodyFileKey: 'key-wb-m12-000000', bodyFileName: 'م12.pdf', onTemplate: true },
        { moduleIds: ['M3'], url: 'https://drive.test/m3', ownMaterial: true },
      ],
    },
  })
  const files = bundleFiles(perModule)
  const md = reviewMarkdown(perModule, files)

  it('ملفُّ كلِّ كرّاسةٍ في الحزمة — وكرّاسةُ الدورة المحفوظةُ في الطريقة الأخرى لا', () => {
    expect(files.map((f) => f.path)).toContain('files/كراسات/كراسة المحورين 1 و2 — م12.pdf')
    expect(files.map((f) => f.key)).not.toContain('key-workbook-00000')
  })

  it('لكلّ كرّاسةٍ سطرُها: ملفُّها أو رابطُها وشكلُها — والناقصةُ تُسمّى', () => {
    expect(md).toContain('- **الطريقة:** كرّاسةٌ لكلّ محورٍ أو لمحاورَ متجاورة')
    expect(md).toContain('- **كرّاسةُ المحورين 1 و2:** ملفٌّ مرفوع: `files/كراسات/كراسة المحورين 1 و2 — م12.pdf` · على قالب وجيز')
    expect(md).toContain('- **كرّاسةُ المحور 3:** https://drive.test/m3 · مادّةُ المدرّب الجاهزة — ليست على القالب')
    expect(md).toContain('- **كرّاسةُ المحور 4:** لم تُوضع بعد')
    expect(md).toContain('**الكراسة:** لكلّ محور — 2 من 3 موضوعة · 1 مادّةُ المدرّب الجاهزة لا على القالب')
    expect(md).not.toContain('لم تُوضع بعد.')
  })
})
