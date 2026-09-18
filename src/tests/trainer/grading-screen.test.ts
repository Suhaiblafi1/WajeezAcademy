/* ═══ شاشةُ التقييم تُبنى — والوصلُ بين ما وصل وما يُعرض (م٤) ═══

   «العملُ الذي يتكرّر مئةَ مرّةٍ في الشعبة — ٢٧٦ سطرا بلا اختبارٍ واحد».

   والسلوكُ محروسٌ عند الخادم (`server/tests/learning/grading-queue.test.ts`):
   الاسمُ يصل، والمسطرةُ تُجلَب، والمفتاحُ لا يخرج، ومن لا يملك يُردّ. وما
   هنا **الوصلُ**: أنّ ما وصل يُعرض ويُرسَل — فحقلٌ يصل الشاشةَ ولا تقرؤه
   هو العطبُ الأوّلُ بعينه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const SCREEN = code('src/pages/trainer/GradingQueue.tsx')
const SVC = code('server/services/assessment.service.ts')
const ROUTES = code('server/http/routes/learning-portal.routes.ts')

describe('① اسمُ المتعلّم يُعرض', () => {
  it('⚠️ الشاشةُ تقرأ الاسمَ لا المعرّفَ وحدَه', () => {
    expect(SCREEN, 'الاسمُ غيرُ معلَنٍ في النوع').toMatch(/user: \{ displayName: string \} \| null/)
    expect(SCREEN, 'الاسمُ يصل ولا يُعرض').toContain('q.enrollment.user?.displayName')
  })

  it('والفارغُ يُقال فراغا — لا يُختلق اسمٌ لمن لا اسمَ له', () => {
    const at = SCREEN.indexOf('q.enrollment.user?.displayName')
    expect(SCREEN.slice(at, at + 120)).toContain('??')
  })
})

describe('② المسطرةُ تُجلَب وتُعرض وتُرسَل', () => {
  it('⚠️ الخدمةُ تجلب معاييرَها مرتَّبة', () => {
    const at = SVC.indexOf('async trainerQueue')
    expect(at, 'لا طابور').toBeGreaterThan(0)
    const body = SVC.slice(at, SVC.indexOf('async assertCanReadSubmissionFile'))
    expect(body, 'المسطرةُ لا تُجلَب').toContain('rubric: { include: { criteria: { orderBy: { sequence: \'asc\' } } } }')
  })

  it('⚠️ والشاشةُ تعرض عمودا لكلّ معيار', () => {
    expect(SCREEN, 'لا عمودَ للمعايير').toContain('q.assessment.rubric!.criteria.map((c)')
    expect(SCREEN, 'لا مفتاحَ يميّز معيارَ تسليمٍ عن غيره').toContain('rubricForm[`${q.id}:${c.id}`]')
  })

  it('⚠️ وتُرسلها مع الدرجة — والمسلكُ يقبلها منذ زمنٍ بلا مرسِل', () => {
    const at = SCREEN.indexOf('apiPost("/api/trainer/grade"')
    expect(at, 'لا نداءَ درجة').toBeGreaterThan(0)
    expect(SCREEN.slice(at, at + 260), 'الدرجةُ تُرسَل بلا مسطرة').toContain('rubricScores: rubricOf(q)')
    expect(ROUTES, 'المسلكُ لا يقبلها').toContain('rubricScores: z.array(z.object({ criterionId: z.string().uuid(), score: z.number().min(0) })).optional()')
  })

  it('⚠️ والمجموعُ يُحسب من المعايير — لا رقمٌ يُكتب إلى جانبها', () => {
    /* رقمان لشيءٍ واحدٍ يفترقان: يُقرأ أحدُهما حكما والآخرُ سببا لا يجمعه. */
    expect(SCREEN).toMatch(/const rubricTotal = \(q: QueueItem\) => rubricOf\(q\)\.reduce/)
    const at = SCREEN.indexOf('const hasRubric')
    expect(at, 'لا قسمةَ بين ذي مسطرةٍ وغيره').toBeGreaterThan(0)
    expect(SCREEN.slice(at, at + 260), 'المجموعُ لا يُشتقّ من المعايير').toContain('hasRubric ? rubricTotal(q)')
  })

  it('وحقلُ الرقم العاري يبقى لمن لا مسطرةَ له — ولا يجتمعان', () => {
    expect(SCREEN).toMatch(/\(q\.assessment\.rubric\?\.criteria\.length \?\? 0\) === 0 && \(/)
    expect(SCREEN).toMatch(/\(q\.assessment\.rubric\?\.criteria\.length \?\? 0\) > 0 && \(/)
  })
})

describe('③ مفتاحُ التخزين لا يخرج — وله بابٌ محروس', () => {
  it('⚠️ الخدمةُ تُسقط المفتاحَ وتضع مسارَه', () => {
    const at = SVC.indexOf('async trainerQueue')
    const body = SVC.slice(at, SVC.indexOf('async assertCanReadSubmissionFile'))
    expect(body, 'المفتاحُ ما زال يخرج').toContain('rows.map(({ storageKey, ...s })')
    expect(body, 'لا بابَ للملفّ').toContain('/api/v1/submission-files/')
  })

  it('⚠️ والمسارُ يمرّ بالحارس قبل أن يقرأ', () => {
    const at = ROUTES.indexOf("'/api/v1/submission-files/:storageKey'")
    expect(at, 'لا مسارَ لملفّ التسليم').toBeGreaterThan(0)
    const body = ROUTES.slice(at, at + 1200)
    expect(body, 'المسارُ بلا جلسة').toContain('preHandler: requireAuth')
    expect(body, 'المفتاحُ لا يُفحَص شكلا').toContain('assertSafeKey(storageKey)')
    const guard = body.indexOf('assertCanReadSubmissionFile')
    const read = body.indexOf('getObject(storageKey)')
    expect(guard, 'لا حارسَ على القراءة').toBeGreaterThan(-1)
    expect(read, 'لا قراءة').toBeGreaterThan(-1)
    expect(guard, 'يقرأ قبل أن يحرس').toBeLessThan(read)
  })

  it('⚠️ والحارسُ يردّ بأربعمئةٍ وأربعة — وجودُ ملفٍّ خبرٌ في نفسه', () => {
    const at = SVC.indexOf('async assertCanReadSubmissionFile')
    expect(at, 'لا حارس').toBeGreaterThan(0)
    const body = SVC.slice(at, at + 1400)
    expect(body, 'يُفشي وجودَ الملفّ بثلاثمئةٍ وثلاثة').not.toContain('403')
    expect((body.match(/404/g) ?? []).length, 'لا يُردّ الغريبُ ولا المفقود').toBeGreaterThanOrEqual(2)
    expect(body, 'لا يُسأل عن صاحبه').toContain('row.enrollment.userId === auth.userId')
    expect(body, 'لا يُسأل عن مدرّب شعبته').toContain('row.assessment.cohort.trainers.some')
  })

  it('⚠️ والشاشةُ تفتحه — وكان المُخرَجُ لا سبيلَ إلى رؤيته', () => {
    expect(SCREEN, 'لا بابَ في الشاشة').toContain('href={q.fileUrl}')
    expect(SCREEN).toContain('افتح ملفَّ التسليم')
    expect(SCREEN, 'المفتاحُ ما زال معلَنا في نوع الشاشة').not.toMatch(/storageKey/)
  })
})
