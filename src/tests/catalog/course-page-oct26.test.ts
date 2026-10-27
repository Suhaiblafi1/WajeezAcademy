/* صفحةُ الدورة ولوحُ الشراء — ثلاثةُ طلباتٍ لصاحب المنصّة (٢٦ أكتوبر ٢٠٢٦).

   ① «ابنِ مسارك بنفسك» يقترح ما له شعبةٌ وحدَه، وأربعا: «لا تقترح له دوراتٍ ليس لديها شعب، وقلّل الاقتراحات
      إلى أربع». رُئي ساقطا على `suggestNext(picked, 8)`.
   ② و«ما يرافق الدورة» سطرٌ واحدٌ بأربع نقاط لا صندوقٌ ببطاقات: «اجعله بنقاطٍ في سطرٍ واحد.. أقلّ أهميّة وأصغر».
   ③ و«كلّ ما في هذا الطلب لك بالفعل» معه زرٌّ إلى «تعلّمي»: «لماذا لا يوجد هنا زرّ يأخذه إلى تعلّمي مباشرة؟».
   والشيفرةُ تُقرأ بلا تعليقاتها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { suggestBuyable, suggestNext, BUYABLE_SUGGESTIONS } from '@/application/catalog/course-path'
import { courses } from '@/data/courses'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PATHWAY = code('src/pages/Pathway.tsx')

describe('① الاقتراح يشترى', () => {
  const anchor = courses[0]!.id
  const all = suggestNext([anchor], Number.MAX_SAFE_INTEGER)

  it('⚠️ ما لا شعبة له لا يقترح — والترتيب هو هو', () => {
    const open = new Set(all.filter((_, i) => i % 3 === 0).map((s) => s.courseId))
    const out = suggestBuyable([anchor], (id) => open.has(id))
    expect(out.every((s) => open.has(s.courseId)), 'اقترحت دورة بلا شعبة').toBe(true)
    expect(out.map((s) => s.courseId)).toEqual(all.filter((s) => open.has(s.courseId)).slice(0, BUYABLE_SUGGESTIONS).map((s) => s.courseId))
  })

  it('⚠️ وأربع لا أكثر، ولا شيء حين لا شعبة', () => {
    expect(BUYABLE_SUGGESTIONS).toBe(4)
    expect(suggestBuyable([anchor], () => true)).toHaveLength(Math.min(4, all.length))
    expect(suggestBuyable([anchor], () => false)).toEqual([])
  })

  it('⚠️ والصفحة تقرأ الشعب في الاقتراح', () => {
    expect(code('src/pages/CoursePath.tsx')).toMatch(/suggestBuyable\(picked, \(id\) => \(cohorts\.get\(id\)\?\.length \?\? 0\) > 0\)/)
  })
})

describe('② ما يرافق الدورة سطر واحد', () => {
  it('⚠️ قائمة نقاط في شريط رقيق — لا بطاقة ولا شرح تحت كل نقطة', () => {
    const page = code('src/pages/CoursePath.tsx')
    expect(page).toMatch(/<Inset as="ul" aria-label="ما يرافق الدورة" className="[^"]*flex flex-wrap[^"]*">/)
    const block = page.slice(page.indexOf('aria-label="ما يرافق الدورة"'), page.indexOf('</Inset>', page.indexOf('aria-label="ما يرافق الدورة"')))
    expect(block).toContain('text-fine')
    expect(block, 'عاد الشرح تحت كل نقطة').not.toMatch(/b\.d\b/)
    expect(page, 'عاد صندوق العنوان').not.toMatch(/<Sparkles[^>]*\/> ما يرافق الدورة/)
  })
})

describe('③ زر إلى «تعلمي»', () => {
  it('⚠️ حين لا شيء يشترى: رابط إلى /student/learning في الصندوق نفسه', () => {
    const buy = code('src/components/BuyPanel.tsx')
    const box = buy.slice(buy.indexOf('{nothingLeft && ('), buy.indexOf('{nothingLeft && (') + 700)
    expect(box).toMatch(/<Button as=\{Link\} to="\/student\/learning"/)
  })

  /* ومن عاد من صفحة الدفع دون أن يدفع لا يقال له «لك بالفعل» — بل ما بقي، وبابُه (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ وطلب لم يكتمل دفعه: «فواتيري» لا «تعلّمي»', () => {
    const buy = code('src/components/BuyPanel.tsx')
    expect(buy).toMatch(/const unpaidLeft = nothingLeft && !!quote\?\.excluded\.some\(\(x\) => x\.reason === "order_pending"\);/)
    const box = buy.slice(buy.indexOf('{nothingLeft && ('), buy.indexOf('{nothingLeft && (') + 1400)
    expect(box).toMatch(/^\{nothingLeft && \(!unpaidLeft \? \(/)
    expect(box).toMatch(/\) : \([\s\S]*لك طلب بهذه الدورات لم يكتمل دفعه\. أكمله من «فواتيري»\.[\s\S]*<Button as=\{Link\} to="\/student\/billing"/)
  })
})

describe('④ مشتري المسار: ثلاثة مقترحات', () => {
  it('⚠️ ثلاث لا أكثر', async () => {
    const { PATHWAY_EXTRA_OPTIONS } = await import('@/application/catalog/course-path')
    expect(PATHWAY_EXTRA_OPTIONS).toBe(3)
  })
})

/* ═══ ⑤ ومن أين الثلاث (٢٦ أكتوبر ٢٠٢٦) ═══
   «اقترح من دورات المسار نفسه أو الأقرب للفئة، وحاول أن تكون المقترحة لها شعبٌ مفتوحة» (صاحب المنصّة).
   ثمّ رأى في مسار الأسرة والتربية العلاقاتِ العامّةَ والإقناعَ «من فئة موظفون ومختصون» — والفئةُ جمهورٌ لا
   موضوع — فقال: «نعم افحصها وأصلحها». فالقربُ بالموضوع، والجمهورُ آخرَ الكلّ.
   رُئي ساقطا على الصيغة السابقة: الحالةُ الأولى بعينها، والمهارةُ الشائعة تُعدّ قربا. */
describe('⑤ مقترحات المسار: المسار ثم الأقرب موضوعا، وما له شعبة أولا', async () => {
  const { pathwayExtraOptions } = await import('@/application/catalog/course-path')
  const { pathwayCourses, pathwaySupportCourses, readyPathwayCourseIds, courses: all } = await import('@/data/courses')
  const FAM = 'PW-FAM-001'
  const famBase = readyPathwayCourseIds(FAM)
  const ownOf = (pid: string) => new Set([...(pathwayCourses[pid] ?? []), ...(pathwaySupportCourses[pid] ?? []).map((s) => s.courseId), ...all.filter((c) => c.pathwayId === pid).map((c) => c.id)])

  it('⚠️ الحالة كما رئيت: الأسرة لا يقترح لها العلاقات العامة والإقناع وإن فتحت شعبهما', () => {
    const open = new Set(['C-COMX-104', 'C-COMX-108', 'C-PSY-109'])
    const out = pathwayExtraOptions(FAM, famBase, (id) => open.has(id)).map((s) => s.courseId)
    expect(out[0]).toBe('C-PSY-109')
    expect(out).toHaveLength(3)
    expect(out).not.toContain('C-COMX-104')
    expect(out).not.toContain('C-COMX-108')
  })

  it('⚠️ والمهارة الشائعة لا تعد قربا — «الإصغاء الفعال» في دورات كثيرة', () => {
    const out = pathwayExtraOptions(FAM, famBase, (id) => id === 'C-BIZ-101').map((s) => s.courseId)
    expect(out).toHaveLength(3)
    expect(out).not.toContain('C-BIZ-101')
  })

  it('⚠️ ولا شيء مما في المسار — ودورات المسار نفسه قبل غيرها', () => {
    const pid = Object.keys(pathwayCourses).find((id) => all.some((c) => c.pathwayId === id && !readyPathwayCourseIds(id).includes(c.id)))!
    const base = readyPathwayCourseIds(pid)
    const own = ownOf(pid)
    const out = pathwayExtraOptions(pid, base, () => true, 50)
    expect(out.length).toBeGreaterThan(0)
    for (const s of out) expect(base, s.courseId).not.toContain(s.courseId)
    const firstOther = out.findIndex((s) => !own.has(s.courseId))
    const lastOwn = out.map((s) => own.has(s.courseId)).lastIndexOf(true)
    expect(lastOwn).toBeGreaterThanOrEqual(0)
    if (firstOther >= 0) expect(lastOwn).toBeLessThan(firstOther)
  })

  it('⚠️ وما له شعبة أولا — ولو كان آخر القريب', () => {
    const near = pathwayExtraOptions(FAM, famBase, () => false, 50)
    const last = near[near.length - 1]!
    expect(pathwayExtraOptions(FAM, famBase, (id) => id === last.courseId)[0]!.courseId).toBe(last.courseId)
  })
})

/* ═══ ⑥ والهندسة: المفتوح القريب وحده، وإلّا القريب «سنقدّمها لك الفصل القادم» (٢٧ أكتوبر ٢٠٢٦) ═══
   رأى صاحب المنصّة لمسار الهندسة دورةَ إعداد المعلّمين «لجمهور مسارك نفسه»، فقال: «استخدم الدورات المفتوحة حاليّا
   فقط، وإن لم تجد شيئا قريبا فاقترح أخرى بدون شعبة، ويكون له: سنقدّمها لك الفصل القادم».
   رُئي ساقطا على الصيغة السابقة: جمهورُ المسار يُبلَغ، ولا جارَ للهندسة. */
describe('⑥ مسار بلا قريب له شعبة', async () => {
  const { pathwayExtraOptions, NEXT_SEASON_AR } = await import('@/application/catalog/course-path')
  const { readyPathwayCourseIds, courseById } = await import('@/data/courses')
  const ENGR = 'PW-ENGR-001'
  const base = readyPathwayCourseIds(ENGR)

  it('⚠️ البعيد لا يقترح وإن فتحت شعبته — والثلاث من إدارة المشاريع جارتها', () => {
    const open = new Set(['C-COMX-103', 'C-COMX-104', 'C-COMX-107'])
    const out = pathwayExtraOptions(ENGR, base, (id) => open.has(id))
    expect(out).toHaveLength(3)
    for (const s of out) {
      expect(open.has(s.courseId), s.courseId).toBe(false)
      expect(courseById(s.courseId)?.pathwayId, s.courseId).toBe('PW-EMP-003')
    }
  })

  it('⚠️ وما لا شعبة له يقول «سنقدمها لك الفصل القادم» مكان السعر', () => {
    expect(NEXT_SEASON_AR).toBe('سنقدّمها لك الفصل القادم')
    expect(PATHWAY).not.toContain('لم تفتح شعبتها بعد')
    expect(PATHWAY).toMatch(/:\s*<span[^>]*>\{NEXT_SEASON_AR\}<\/span>/)
  })
})
