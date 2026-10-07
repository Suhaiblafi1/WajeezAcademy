/* ═══ قالبُ الكرّاسة مملوءا بخطّة الشعبة (٧ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «أنجعل القالبَ PDF قابلا للتعبئة ليسهل عليهم؟». فعُرضت عليه
   ثلاثُ طرقٍ بفروقها، فاختار Word مملوءا بما كتبه المدرّبُ في الخطوات قبلها —
   ثمّ رأى نموذجا مملوءا من شعبةٍ حقيقيّة ولقطات الخطوة، فقال: «Yes, apply it».

   وما يُحرس هنا:
     ① الملءُ من الخطّة: المحاورُ بترتيبها ومواعيدُها، وأوّلُ لقاءٍ حقيقيٍّ لا المبدئيّ
        ولا الملغى، والمصادرُ بلا المسجَّل، ومشروعُ التخرّج — ولمحاورَ بعينها كذلك.
     ② الملفُّ يحمل ما مُلئ، ويُبقي ما لم يُكتب بين قوسين، والخطُّ مضمَّنٌ بوزنيه.
     ③ لا صفحةَ بيضاء: الأقسامُ تبدأ صفحاتِها بعناوينها لا بفقرة فاصل.
     ④ القالبان الفارغان في `public/templates` مبنيّان من المولّد نفسِه.
     ⑤ والشاشةُ تنزّله، ومسلكُه للمدرّب في شعبته.

   والفحصُ على البنية لا على ورودِ حرفٍ في تعليق: التعليقاتُ تُنزع قبل المطابقة. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import {
  RESOURCE_KIND_AR, blankFill, workbookDocx, workbookFileName, workbookFill, type WorkbookFillInput,
} from '../../../server/services/workbook-docx'
import { RESOURCE_META } from '@/components/resource-kind-meta'
import { RESOURCE_KINDS } from '@/application/trainer/plan-overlay'
import { WORKBOOK_TEMPLATES, workbookTemplateHref } from '@/application/trainer/cohort-workbooks'
import { dayLabelAr } from '@/application/trainer/axis-timeline'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const input: WorkbookFillInput = {
  courseTitle: 'التحضيرُ للتفاوض', cohortTitle: 'شعبة الخريف', trainerName: 'مدرّب وجيز',
  period: { startsOn: '2026-12-01', endsOn: '2026-12-21' },
  content: {
    summaryAr: 'دورةٌ قصيرةٌ للتفاوض في العمل.',
    level: { from: 'beginner', to: 'intermediate' },
    modules: [
      { moduleId: 'm1', titleAr: 'أساسيّات التفاوض', outcomeAr: 'يفرّق بين الموقف والمصلحة.', bodyAr: 'الفكرةُ **الأولى** في سطر.\n\n- نقطةٌ أولى\n- [مرجع](https://x.test/r)' },
      { moduleId: 'm2', titleAr: 'التحضيرُ والبدائل', outcomeAr: 'يحدّد بديلَه الأفضل.', activityAr: 'اكتب بديلَك الأفضل.', artifactAr: 'مذكّرةُ تحضير' },
      { moduleId: 'm3', titleAr: 'إدارةُ الحوار' },
    ],
    slots: [
      { startsOn: '2026-12-01', endsOn: '2026-12-07', moduleIds: ['m1'] },
      { startsOn: '2026-12-08', endsOn: '2026-12-14', moduleIds: ['m2'] },
      { startsOn: '2026-12-15', endsOn: '2026-12-21', moduleIds: ['m3'] },
    ],
    resources: [
      { title: 'فصلُ البدائل', url: 'https://x.test/book', kind: 'book', moduleId: 'm2' },
      { title: 'تسجيلُ اللقاء', url: 'https://x.test/rec', category: 'recorded', moduleId: 'm2' },
    ],
  },
  baseModules: [],
  sessions: [
    { startsAt: '2026-12-09T15:00:00Z', status: 'scheduled', placeholder: true, moduleIds: ['m2'] },
    { startsAt: '2026-12-10T15:00:00Z', status: 'cancelled', placeholder: false, moduleIds: ['m2'] },
    { startsAt: '2026-12-12T15:00:00Z', status: 'scheduled', placeholder: false, moduleIds: ['m2'] },
  ],
  assessments: [
    { title: 'مهمّةُ المحور', type: 'assignment', briefAr: null },
    { title: 'مذكّرةُ تحضيرٍ كاملة', type: 'project', briefAr: 'مذكّرةٌ من صفحتين.' },
  ],
}

const xmlOf = async (data: Buffer, part = 'word/document.xml') => (await JSZip.loadAsync(data)).file(part)!.async('string')
const textOf = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')

describe('① الملءُ من الخطّة', () => {
  const fill = workbookFill(input)!

  it('⚠️ المحاورُ بترتيبها ومواعيدُها — وما كتبه في كلّ محور', () => {
    expect(fill.kind).toBe('course')
    expect(fill.modules.map((m) => [m.n, m.title, m.startsOn])).toEqual([
      [1, 'أساسيّات التفاوض', '2026-12-01'], [2, 'التحضيرُ والبدائل', '2026-12-08'], [3, 'إدارةُ الحوار', '2026-12-15'],
    ])
    expect(fill.modules[1]).toMatchObject({ outcome: 'يحدّد بديلَه الأفضل.', activity: 'اكتب بديلَك الأفضل.', artifact: 'مذكّرةُ تحضير' })
    expect(fill.levelAr).toBeTruthy()
    expect(fill.periodAr).toMatch(/^من .+ إلى .+$/)
  })

  it('⚠️ أوّلُ لقاءٍ حقيقيّ — لا المبدئيُّ ولا الملغى', () => {
    const real = workbookFill(input)!.modules[1].liveAr ?? ''
    expect(real, 'قُرئ لقاءٌ مبدئيٌّ أو ملغى').toContain('12')
    expect(fill.modules[0].liveAr).toBeNull()
  })

  it('⚠️ المصادرُ بأنواعها — والمسجَّلُ لا يُعدّ مصدرَ قراءة', () => {
    expect(fill.modules[1].resources).toEqual([{ title: 'فصلُ البدائل', kindAr: 'كتاب', url: 'https://x.test/book' }])
  })

  it('ومشروعُ التخرّج من المهامّ', () => {
    expect(fill.project).toEqual({ title: 'مذكّرةُ تحضيرٍ كاملة', brief: 'مذكّرةٌ من صفحتين.' })
  })

  it('⚠️ ولمحاورَ بعينها: بترتيب الخطّة لا بترتيب الطلب — والمجهولُ يُردّ', () => {
    const pair = workbookFill(input, ['m3', 'm2'])!
    expect(pair.kind).toBe('module')
    expect(pair.modules.map((m) => m.n)).toEqual([2, 3])
    expect(workbookFill(input, ['nope'])).toBeNull()
  })

  it('وبلا محاورَ في الخطّة تُقرأ محاورُ الدورة — كما تعرضها الورشة', () => {
    const fresh = workbookFill({ ...input, content: null, baseModules: [{ moduleId: 'b1', titleAr: 'محورُ الكتالوج' }] })!
    expect(fresh.modules.map((m) => m.title)).toEqual(['محورُ الكتالوج'])
  })

  it('وأسماءُ أنواع المصادر أسماءُ الشاشة نفسُها', () => {
    for (const k of RESOURCE_KINDS) expect(RESOURCE_KIND_AR[k], k).toBe(RESOURCE_META[k].label)
  })

  it('واسمُ الملفّ بلا ما يمنعه نظامُ الملفّات', () => {
    expect(workbookFileName({ ...fill, courseTitle: 'أ/ب: ج' })).toBe('كرّاسة أ ب ج.docx')
    expect(workbookFileName(workbookFill(input, ['m2', 'm3'])!)).toBe('كرّاسة المحوران ٢ و٣ — التحضيرُ للتفاوض.docx')
  })
})

describe('② الملفُّ يحمل ما مُلئ، وما لم يُكتب يبقى بين قوسين', () => {
  it('⚠️ في الملفّ المملوء: الدورةُ ومحاورُها وما يخرج به المتعلّمُ ومتنُه — والباقي بقوسيه', async () => {
    const t = textOf(await xmlOf(await workbookDocx(workbookFill(input)!)))
    for (const s of ['التحضيرُ للتفاوض', 'مدرّب وجيز', 'أساسيّات التفاوض', 'يحدّد بديلَه الأفضل.', 'اكتب بديلَك الأفضل.', 'مذكّرةُ تحضيرٍ كاملة', 'فصلُ البدائل']) {
      expect(t, `لم يُملأ: ${s}`).toContain(s)
    }
    /* والمتنُ Markdownُ المنصّة: العريضُ بلا نجومه، والرابطُ نصُّه ثمّ عنوانُه */
    expect(t).toContain('الفكرةُ الأولى في سطر.')
    expect(t, 'بقيت نجومُ العريض').not.toContain('**')
    expect(t).toContain('مرجع (https://x.test/r)')
    expect(t, 'مُلئ الغلافُ ومكانُه باقٍ').not.toContain('[اسمُ الدورة]')
    expect(t, 'ضاع ما يكتبه المدرّبُ بيده').toContain('[صِف الموقفَ في سطرين')
  })

  it('والفارغُ بقوسيه كلِّها', async () => {
    const t = textOf(await xmlOf(await workbookDocx(blankFill('course'))))
    expect(t).toContain('[اسمُ الدورة]')
    expect(t).toContain('[اسمُ المحور]')
  })

  it('⚠️ والمجموعةُ على غلافها بمحاورها ومداها', async () => {
    const t = textOf(await xmlOf(await workbookDocx(workbookFill(input, ['m2', 'm3'])!)))
    expect(t).toContain('المحوران ٢ و٣ من دورة التحضيرُ للتفاوض')
    expect(t, 'الموعدُ موعدان لا مدًى').toContain(`${dayLabelAr('2026-12-08')} – ${dayLabelAr('2026-12-21')}`)
  })

  it('⚠️ والخطُّ مضمَّنٌ بوزنيه — ويبقى بعد أن يحفظه المدرّب', async () => {
    const data = await workbookDocx(blankFill('module'))
    const fonts = await xmlOf(data, 'word/fontTable.xml')
    expect(fonts).toMatch(/<w:embedRegular /)
    expect(fonts, 'العريضُ يُرسم من العاديّ').toMatch(/<w:embedBold /)
    expect(await xmlOf(data, 'word/settings.xml'), 'يُسقطه Word عند الحفظ').toContain('<w:embedTrueTypeFonts/>')
  })

  /* ═══ ويفتحه Word — لا LibreOffice وحدَه (٧ أكتوبر ٢٠٢٦) ═══
     بلّغ صاحبُ المنصّة: «هناك خطأ عند تحميل الملفات». وكان مفتاحُ الخطّ العاديّ — يكتبه
     `docx` — بحروفٍ صغيرة، والمخطّطُ (`ST_Guid`) لا يقبل إلّا الكبيرة: يقف Word عند الملفّ،
     وLibreOffice الذي عاينّا به يتجاوز عنه. فيُحرس المفتاحُ بنمط المخطّط نفسِه، ويُحرس أنّ كلَّ
     خطٍّ مضمَّنٍ يُفكّ بمفتاحه إلى ملفّه الأصليّ — فلا يُصلَح الحرفُ ويفسد الخطّ. */
  it('⚠️ ومفتاحُ كلّ خطٍّ مضمَّنٍ بنمط المخطّط — ويُفكّ به إلى خطّه الأصليّ', async () => {
    const ST_GUID = /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/
    const original: Record<string, Buffer> = {
      embedRegular: readFileSync(join(process.cwd(), 'server/assets/fonts/IBMPlexSansArabic-Regular.ttf')),
      embedBold: readFileSync(join(process.cwd(), 'server/assets/fonts/IBMPlexSansArabic-Bold.ttf')),
    }
    const docs = {
      'الفارغُ للدورة': await workbookDocx(blankFill('course')),
      'الفارغُ للمحور': await workbookDocx(blankFill('module')),
      'المملوء': await workbookDocx(workbookFill(input)!),
    }
    for (const [name, data] of Object.entries(docs)) {
      const zip = await JSZip.loadAsync(data)
      const table = await zip.file('word/fontTable.xml')!.async('string')
      const rels = await zip.file('word/_rels/fontTable.xml.rels')!.async('string')
      const embeds = [...table.matchAll(/<w:(embed\w+) r:id="([^"]+)" w:fontKey="([^"]+)"\/>/g)]
      expect(embeds.map((m) => m[1]).sort(), name).toEqual(['embedBold', 'embedRegular'])
      for (const [, kind, rid, key] of embeds) {
        expect(key, `${name}: مفتاحُ ${kind} ليس بنمط المخطّط — Word لا يفتح الملفّ`).toMatch(ST_GUID)
        const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
        const font = Buffer.from(await zip.file(`word/${target}`)!.async('nodebuffer'))
        const bytes = key.replace(/[{}-]/g, '').match(/../g)!.map((h) => parseInt(h, 16)).reverse()
        for (let i = 0; i < 32; i++) font[i] ^= bytes[i % 16]
        expect(font.equals(original[kind]), `${name}: ${kind} لا يُفكّ بمفتاحه إلى خطّه`).toBe(true)
      }
    }
  })
})

describe('③ لا صفحةَ بيضاء', () => {
  it('⚠️ الأقسامُ تبدأ صفحاتِها بعناوينها — لا بفقرة فاصلٍ تسقط وحدَها', async () => {
    const fill = workbookFill(input)!
    const xml = await xmlOf(await workbookDocx(fill))
    /* «قبل أن تبدأ» وكلُّ محورٍ ومشروعُ التخرّج و«ملاحظاتي» */
    expect(xml.match(/<w:pageBreakBefore\/>/g)?.length, 'قسمٌ يبدأ بفقرة فاصل').toBe(fill.modules.length + 3)
    /* وفاصلٌ صريحٌ واحد: بعد الغلاف، وقبل صفحة المدرّب — لا قبل قسم */
    expect(xml.match(/<w:br w:type="page"\/>/g)?.length).toBe(1)
  })
})

describe('④ القالبان الفارغان مبنيّان من المولّد نفسِه', () => {
  it('⚠️ ما في `public/templates` هو ما يكتبه المولّدُ اليوم — فلا يفترق الفارغُ عن المملوء', async () => {
    for (const [kind, tpl] of [['course', WORKBOOK_TEMPLATES.course], ['module', WORKBOOK_TEMPLATES.modules]] as const) {
      const committed = await xmlOf(readFileSync(join(process.cwd(), 'public', tpl.href)))
      const now = await xmlOf(await workbookDocx(blankFill(kind)))
      expect(committed === now, `${tpl.href} قديم — شغّل npx tsx scripts/workbook-template/build.ts`).toBe(true)
      /* ومفتاحا خطّيه بنمط المخطّط — فالملفُّ الملتزَمُ قبل الإصلاح يسقط هنا (٧ أكتوبر ٢٠٢٦) */
      const fonts = await xmlOf(readFileSync(join(process.cwd(), 'public', tpl.href)), 'word/fontTable.xml')
      for (const [, key] of fonts.matchAll(/w:fontKey="([^"]+)"/g)) {
        expect(key, `${tpl.href}: مفتاحُ خطٍّ بحروفٍ صغيرة — أعد بناءه`).toMatch(/^\{[0-9A-F-]{36}\}$/)
      }
    }
  })
})

describe('⑤ الشاشةُ تنزّله، ومسلكُه للمدرّب في شعبته', () => {
  const WS = code('src/pages/trainer/CohortWorkspace.tsx')
  const block = WS.slice(WS.indexOf('stage === "workbooks" &&'), WS.indexOf('stage === "sessions" &&'))

  it('⚠️ للدورة زرٌّ، ولكلّ كرّاسة محورٍ زرُّها — بمسار القاعدة', () => {
    expect(block).toContain('href={`${API_BASE}${workbookTemplateHref(ws.cohort.id)}`}')
    expect(block, 'بطاقةُ المحور بلا قالبها').toContain('href={`${API_BASE}${workbookTemplateHref(ws.cohort.id, g.moduleIds)}`}')
    expect(workbookTemplateHref('c1', ['m2', 'm3'])).toBe('/api/trainer/cohorts/c1/workbook-template?modules=m2,m3')
  })

  it('⚠️ وما لم يُحفَظ يُقال — فالقالبُ يُملأ بالمحفوظ', () => {
    expect(block).toMatch(/\{Object\.values\(dirty\)\.some\(Boolean\) && \(/)
  })

  it('⚠️ والمسلكُ بصلاحيّة خطّة الشعبة، والخدمةُ تقرأ ورشتَه هو', () => {
    const ROUTES = code('server/http/routes/learning-portal.routes.ts')
    const route = ROUTES.slice(ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workbook-template'"), ROUTES.indexOf("app.put('/api/trainer/cohorts/:id/plan'"))
    expect(route).toContain("preHandler: requirePermission('trainer.cohort.plan')")
    expect(route).toContain('plans.workbookTemplate(req.auth!.userId, id, ids)')
    const SVC = code('server/services/cohort-plan.service.ts')
    const svc = SVC.slice(SVC.indexOf('async workbookTemplate('), SVC.indexOf('async summaries('))
    expect(svc, 'لا تمرّ بملكيّة الشعبة').toContain('const ws = await this.workspace(userId, cohortId)')
  })
})
