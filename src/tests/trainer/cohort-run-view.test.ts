/* ═══ الشعبةُ الجارية تُفتح على «التشغيل» — الخطوة E (١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»)، ثمّ رأى صورَ «قبل/بعد» واختار «Apply»:
   كان تسجيلُ حضور لقاءٍ جارٍ في الخطوة الرابعة من سلّم إعداد الخطّة، والشعبةُ المعتمدةُ تُفتح على
   «الاعتماد». فصار للشعبة الجارية لسانان: «التشغيل» (اللقاءاتُ والحضورُ والتسليمات) تُفتح عليه، و«الخطة»
   فيه السلّمُ كما هو.

   وهذا ينسخ قرارَ ١٥ سبتمبر («الشريطُ يبقى ظاهرا») للشعبة الجارية وحدَها — والتي تُعَدّ بعدُ يبقى سلّمُها
   ظاهرا كما كان، وذاك ما يحرسه ③ هنا.

   والفحصُ على البنية: الدالّةُ تُنادى، والمقتطَعُ من الشيفرة لا من تعليقها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isRunningCohort } from '@/application/trainer/running-cohort'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
const RUN = code('src/pages/trainer/CohortRun.tsx')

describe('① أيّ شعبةٍ جارية', () => {
  it('المفتوحةُ والممتلئةُ والجاريةُ والمنتهية — تُشغَّل', () => {
    for (const s of ['open', 'full', 'active', 'completed']) expect(isRunningCohort(s, 0), s).toBe(true)
  })

  it('والتي تُعَدّ بلا متعلّمين — لا', () => {
    expect(isRunningCohort('draft', 0)).toBe(false)
    expect(isRunningCohort('cancelled', 0)).toBe(false)
  })

  it('وما فيها متعلّمون — تُشغَّل وإن بقيت مسوّدة', () => {
    expect(isRunningCohort('draft', 3)).toBe(true)
  })
})

describe('② الجاريةُ تُفتح على «التشغيل»، ورابطُ الخطوة يُفتح على «الخطة»', () => {
  it('الفتحُ الأوّلُ يختار اللسانَ من حال الشعبة', () => {
    const pick = WS.match(/setView\(([^;]+)\);/)
    expect(pick, 'لا اختيارَ للّسان عند الفتح').not.toBeNull()
    expect(pick![1]).toMatch(/isRunningCohort\(w\.cohort\.status,\s*w\.learners\.length\)/)
    expect(pick![1]).toMatch(/\?\s*"run"\s*:\s*"plan"/)
  })

  it('ومن جاء برابطٍ يطلب خطوةً أو المراجعة — فُتح على «الخطة»', () => {
    const pick = WS.match(/setView\(([^;]+)\);/)![1]
    expect(pick).toContain('!requestedStep.current')
    expect(pick).toContain('!requestedReview.current')
  })

  it('و«افتح المراجعة» من «التشغيل» ينقل إلى «الخطة» على المراجعة', () => {
    const open = WS.match(/onOpenReview=\{\(\) => \{([^}]*)\}\}/)
    expect(open, 'لا طريقَ من «التشغيل» إلى المراجعة').not.toBeNull()
    expect(open![1]).toContain('setView("plan")')
    expect(open![1]).toContain('setStage("review")')
  })
})

describe('③ السلّمُ لا يغيب إلّا عن الجارية', () => {
  it('لسانا «التشغيل» و«الخطة» للجارية وحدَها', () => {
    const tabs = WS.slice(WS.lastIndexOf('{running && (', WS.indexOf('ariaLabel="صفحة الشعبة"')), WS.indexOf('<CohortRun'))
    expect(tabs).toContain('ariaLabel="صفحة الشعبة"')
    expect(tabs).toMatch(/id: "run", label: "التشغيل"/)
    expect(tabs).toMatch(/id: "plan"/)
  })

  it('الشريطُ والسلّمُ تحت «لا تُشغَّل أو الخطة» — فالتي تُعَدّ تراه كما كان', () => {
    const before = WS.slice(WS.indexOf('<CohortRun'), WS.indexOf('<Bar'))
    const gate = before.match(/\{\(([^)]*)\) && \(<>\s*$/)
    expect(gate, 'الشريطُ لم يعد ملفوفا بشرط اللسان').not.toBeNull()
    expect(gate![1].replace(/\s+/g, ' ')).toBe('!running || view === "plan"')
  })

  it('و«التشغيل» يصيَّر للجارية في لسانه وحدَه', () => {
    const at = WS.indexOf('<CohortRun')
    const guard = WS.slice(WS.lastIndexOf('{', at), at)
    expect(guard.replace(/\s+/g, ' ')).toContain('running && view === "run" && (')
  })
})

describe('④ «التشغيل» يحمل عملَ الأسبوع — بالمكوّنات نفسها', () => {
  it('اللقاءاتُ والحضور، والتسليمات', () => {
    expect(RUN).toMatch(/<SessionsAndAttendance cohortId=\{cohortId\} refresh=\{refresh\}/)
    expect(RUN).toMatch(/<CohortSubmissions cohortId=\{cohortId\}/)
  })

  it('و«راسل طلبتها» يفتح مراسلةَ هذه الشعبة لا القائمةَ كلَّها', () => {
    expect(RUN).toContain('to={`/trainer/learners?cohort=${cohortId}`}')
  })

  it('ولا يسقط من السلّم شيء: الخطوتان ما زالتا تحملانهما', () => {
    expect(WS).toMatch(/<SessionsAndAttendance /)
    expect(WS).toMatch(/<CohortSubmissions /)
  })
})
