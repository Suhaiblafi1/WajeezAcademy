/* الحفظُ لا يحبس المدرّب (٥ أكتوبر ٢٠٢٦).

   بلاغُ صاحب المنصّة: «لماذا لا يستطيع المدرّبون حفظَ عملهم وهم يبنون موادَّهم
   في بوّابتهم؟». والعطبُ ثلاثُ حلقاتٍ في سلسلةٍ واحدة:

   ① الحفظُ يرسل الخطّةَ كاملة، فما يُردّ في خطوةٍ يُسقط حفظَ كلّ خطوة.
   ② ومصدرٌ بلا رابطٍ كان يُردّ — وكلُّ «كتابِ فلان» نُقل من لوح «موادّ دوراتك»
      القديم صار مصدرا بلا رابط.
   ③ والخطواتُ تُفتح بالترتيب، فلا يبلغ المدرّبُ «المصادر» ليصلح ما يمنع حفظَ
      «المعلومات الأساسيّة». فلا يُحفظ شيءٌ أبدا.

   والخادمُ يقيس ② في `server/tests/trainer/carried-sources-save.test.ts`، وحارسُ
   البنية في `module-body.test.ts`. وهنا الشاشة: ما يمنع الحفظَ يُفتح موضعُه،
   ويُقال «لم يُحفظ» لا «لم تتمّ»، وحدودُ النصّ تُقال قبل أن يُرسَل شيء. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_MAX, planTextProblemsAr } from '../../application/trainer/plan-limits'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const between = (src: string, start: string, end: string) => {
  const at = src.indexOf(start)
  if (at < 0) return ''
  const stop = src.indexOf(end, at + start.length)
  return stop < 0 ? '' : src.slice(at, stop)
}
const screen = code('src/pages/trainer/CohortWorkspace.tsx')

describe('ما يُكتب أطولَ من حدّه يُسمّى بموضعه', () => {
  const base = { summaryAr: '', modules: [{ titleAr: 'محورٌ أوّل' }], resources: [] as { title: string; category?: string | null }[] }

  it('في حدّه لا يُقال شيء', () => {
    expect(planTextProblemsAr({
      ...base,
      summaryAr: 'ن'.repeat(PLAN_MAX.summaryAr),
      modules: [{ titleAr: 'محور', outcomeAr: 'م'.repeat(PLAN_MAX.outcomeAr) }],
    })).toEqual([])
  })

  it('وما جاوزه يُقال بخطوته وبرقم محوره', () => {
    const out = planTextProblemsAr({
      ...base,
      summaryAr: 'ن'.repeat(PLAN_MAX.summaryAr + 1),
      modules: [{ titleAr: 'محور' }, { titleAr: 'محور', outcomeAr: 'م'.repeat(PLAN_MAX.outcomeAr + 5) }],
      resources: [{ title: 'ع'.repeat(PLAN_MAX.resourceTitle + 1), category: 'recorded' }, { title: 'ك'.repeat(PLAN_MAX.resourceTitle + 1) }],
    })
    expect(out.map((p) => p.place)).toEqual(['identity', 'modules', 'recorded', 'resources'])
    expect(out[1].text, 'لا يُقال أيُّ محور').toContain('المحور 2')
    expect(out[1].text, 'لا يُقال كم كتب').toContain(String(PLAN_MAX.outcomeAr + 5))
  })

  it('والمخطّطُ يقرأ الحدودَ نفسَها — لا رقما مكتوبا بيده', () => {
    const schema = between(code('server/http/routes/learning-portal.routes.ts'), 'const planContent = z.object(', 'liveNoteAr:')
    expect(schema, 'لم يُعثر على مخطّط الخطّة').toBeTruthy()
    for (const field of ['summaryAr', 'outcomeAr', 'activityAr', 'artifactAr'] as const) {
      expect(schema, `حدُّ «${field}» مكتوبٌ رقما في المخطّط — فيفترق عمّا تقوله الشاشة`).toMatch(new RegExp(`${field}: z\\.string\\(\\)\\.max\\(PLAN_MAX\\.${field}\\)`))
    }
    expect(schema).toMatch(/titleAr: z\.string\(\)\.min\(PLAN_TITLE_MIN\)\.max\(PLAN_MAX\.moduleTitle\)/)
    expect(schema).toMatch(/title: z\.string\(\)\.min\(PLAN_TITLE_MIN\)\.max\(PLAN_MAX\.resourceTitle\)/)
  })
})

describe('ما يمنع الحفظَ لا يحبس المدرّب', () => {
  it('الشاشةُ تسمّي الحدودَ قبل أن يُرسَل شيء', () => {
    const save = between(screen, 'const saveProblems = (', 'return out;')
    expect(save, 'لم يُعثر على شرط الحفظ').toBeTruthy()
    expect(save, 'الحدودُ لا تُفحص قبل الإرسال — فيُردّ الحفظُ بـ«modules.2.outcomeAr»').toContain('planTextProblemsAr(content)')
  })

  it('وكلُّ ما يمنعه يحمل خطوتَه — وتلك الخطوةُ تُفتح وإن كانت مقفلةً بالترتيب', () => {
    const save = between(screen, 'const saveProblems = (', 'return out;')
    const pushes = save.match(/out\.push\(/g) ?? []
    const staged = save.match(/out\.push\(\{ stage:/g) ?? []
    expect(pushes.length, 'لم يُعثر على ما يمنع الحفظ').toBeGreaterThan(0)
    expect(staged.length, 'ما يمنع الحفظَ بلا خطوةٍ يُصلَح فيها').toBe(pushes.length)

    const persist = between(screen, 'const persist = async (', 'await apiPut(')
    expect(persist, 'ما منع الحفظَ لا يُحمَل بمواضعه').toMatch(/setGaps\([^;]*refused:/)

    const canOpen = between(screen, 'const canOpen = (', ';\n')
    expect(canOpen, 'الخطوةُ التي فيها ما يمنع الحفظَ تبقى مقفلة — فيُحبس المدرّب').toContain('gaps?.refused.includes(STAGES[i].key)')
  })

  it('و«لم يُحفظ» غيرُ «حُفظ ولم تتمّ» — ولكلٍّ رأسُه', () => {
    const banner = between(screen, '{gaps && gaps.items.length > 0 && (', '</Inset>')
    expect(banner, 'لم يُعثر على قائمة ما ينقص').toBeTruthy()
    expect(banner).toContain('gaps.refused.length > 0')
    expect(banner).toContain('لم يُحفظ شيءٌ بعد')
    expect(banner).toContain('ما كتبتَه محفوظ')
    expect(banner, 'لا زرَّ يفتح موضعَ ما منع الحفظ').toContain('openStage(x.key)')

    const cont = between(screen, 'const saveAndContinue = async', 'const submitNow = async')
    expect(cont, 'ما حُفظ ولم تتمّ خطوتُه يُقال كأنّه لم يُحفظ').toMatch(/setGaps\(gapsFor\(stage, fresh\), \{ saved:/)
  })
})

/* ═══ ولا يضيع ما كُتب بالتنقّل (٥ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «إن تنقّلوا بين الخطوات قبل أن يُتمّوها فليكن كلُّ شيءٍ في
   أمان، أو أعطِهم زرّا يحفظ ولا يُعدّ به تامّا» — واختار الاثنين معا. وكان
   التنقّلُ بين الخطوات لا يحفظ شيئا، والنقرُ على صفحةٍ أخرى في البوّابة يُذهب ما
   كُتب بلا تحذير (`beforeunload` لا يقع على تنقّلٍ داخلَ الصفحة). */
describe('③ ولا يضيع ما كُتب بالتنقّل', () => {
  const openStage = between(screen, 'const openStage = async (s: Stage) => {', '\n  };')

  it('مغادرةُ الخطوة تحفظ ما في اليد قبل أن تفتح غيرَها', () => {
    expect(openStage, 'لم يُعثر على فتح الخطوة').toBeTruthy()
    expect(openStage, 'الانتقالُ لا يحفظ — فيضيع ما كُتب').toContain('await persist()')
    expect(openStage.indexOf('await persist()'), 'الحفظُ بعد الانتقال لا قبله').toBeLessThan(openStage.lastIndexOf('setStage(s)'))
    expect(openStage, 'حفظٌ رُدّ ينقل المدرّبَ عمّا يمنعه').toMatch(/if \(!\(await persist\(\)\)\) \{[^\n]*return; \}/)
  })

  it('والخطوةُ التي فيها ما يمنع الحفظَ تُفتح بلا حفظ — وإلّا عاد الحبس', () => {
    expect(openStage).toContain('saveProblems().some((p) => p.stage === s)')
  })

  it('والخروجُ من الشعبة إلى صفحةٍ أخرى يحفظ — لا تحذيرَ الإغلاق وحدَه', () => {
    expect(screen, 'لا شيءَ يقع عند الخروج من الشعبة').toMatch(/return \(\) => onLeave\.current\?\.\(\);/)
    const leave = between(screen, 'leaveSave.current = ', '\n  };')
    expect(leave, 'لم يُعثر على حفظ الخروج').toBeTruthy()
    expect(leave, 'الخروجُ لا يرسل الخطّة').toContain('apiPut(`/api/trainer/cohorts/${cohortId}/plan`, content)')
    expect(leave, 'ما يمنع الحفظَ عند الخروج لا يُقال').toContain('saveProblems().length')
  })

  it('و«احفظ — لم تكتمل بعد» عائمٌ ما دام في اليد ما لم يُحفظ: يحفظ ويبقى، ولا يُتمّ شيئا', () => {
    /* وليس في صفّ الرأس: الصفُّ يسع زرّا واحدا (قِيس في المتصفّح) — فركب الثاني على السلّم */
    const head = screen.slice(screen.indexOf('<Bar'), screen.indexOf('</Bar>'))
    expect(head, 'زرٌّ ثانٍ في صفّ الرأس — يركب على أسماء الخطوات ويبتلع نقرتَه').not.toContain('saveDraft()')
    expect(screen, 'لا شرطَ يُظهر الزرَّ العائم').toMatch(/const showDraftSave = !atApproval && !locked && Object\.values\(dirty\)\.some\(Boolean\);/)
    const fab = between(screen, '{showDraftSave && (', '</Button>')
    expect(fab, 'الزرُّ العائمُ لا يُرسم').toBeTruthy()
    expect(fab, 'الزرُّ ليس عائما').toMatch(/className="fixed bottom-4 end-4/)
    expect(fab).toContain('saveDraft()')
    expect(fab).toContain('احفظ — لم تكتمل بعد')
    const draft = between(screen, 'const saveDraft = async () => {', '\n  };')
    expect(draft, 'زرُّ الحفظ مسوّدةً لا يحفظ').toContain('await persist()')
    expect(draft, 'زرُّ الحفظ مسوّدةً ينقل المدرّب').not.toContain('setStage(')
  })
})
