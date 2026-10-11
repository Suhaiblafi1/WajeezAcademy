/* الحفظُ التلقائيّ وقائمةُ الفحص الحيّة وعددُ النواقص على الخطوات — ملفُّ صاحب
   المنصّة «تحسينات بوابة مدرّب وجيز» (١١ أكتوبر ٢٠٢٦).

   مؤشّرُ الحفظ محضٌ يُفحص بقيمه. والشاشةُ تُفحص على بنيتها (التعليقاتُ تُنزع قبل
   الفحص): النواقصُ هي ما يقوله «التالي» حين لا ينقل (`gapsFor`) لا عدٌّ ثانٍ
   يفترق عنه. وذهبت اللوحةُ الجانبيّة بقرار صاحب المنصّة — وصار الناقصُ يُعلَّم
   في موضعه بإطارٍ أحمر بعد الخروج من الخانة أو «التالي» (الوصفُ الأخير أدناه). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { autosaveLineAr, autosaveView, savedAgoAr } from '@/application/trainer/autosave'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const WS = code('src/pages/trainer/CohortWorkspace.tsx')

describe('مؤشّرُ الحفظ — يقول حالَه بكلمات', () => {
  it('«قبل ثوانٍ» ثمّ بالدقائق', () => {
    expect(savedAgoAr(3_000)).toBe('قبل ثوانٍ')
    expect(savedAgoAr(60_000)).toBe('قبل دقيقة')
    expect(savedAgoAr(120_000)).toBe('قبل دقيقتين')
    expect(savedAgoAr(5 * 60_000)).toBe('قبل 5 دقائق')
    expect(savedAgoAr(30 * 60_000)).toBe('قبل 30 دقيقة')
    expect(savedAgoAr(2 * 3600_000)).toBe('قبل أكثر من ساعة')
  })

  it('الجاري أوّلا، ثمّ ما يمنع، ثمّ ما سقط، ثمّ ما ينتظر', () => {
    const base = { saving: false, dirty: true, problem: null, failed: null, savedAt: null }
    expect(autosaveView({ ...base, saving: true, problem: 'x' }).kind).toBe('saving')
    expect(autosaveView({ ...base, problem: 'المحور 2 بلا عنوان', failed: 'y' })).toEqual({ kind: 'blocked', reason: 'المحور 2 بلا عنوان' })
    expect(autosaveView({ ...base, failed: 'تعذّر الاتّصال' }).kind).toBe('failed')
    expect(autosaveView(base).kind).toBe('pending')
    expect(autosaveView({ ...base, dirty: false, savedAt: 5 })).toEqual({ kind: 'saved', at: 5 })
    expect(autosaveView({ ...base, dirty: false })).toEqual({ kind: 'idle' })
  })

  it('والسطرُ بجملته — ولا شيءَ يُقال قبل أيّ تعديل', () => {
    expect(autosaveLineAr({ kind: 'saved', at: 1_000 }, 4_000)).toBe('حُفظ قبل ثوانٍ')
    expect(autosaveLineAr({ kind: 'blocked', reason: 'اسمُ الشعبة ثلاثةُ أحرفٍ فأكثر' }, 0)).toBe('لم يُحفظ — اسمُ الشعبة ثلاثةُ أحرفٍ فأكثر')
    expect(autosaveLineAr({ kind: 'idle' }, 0)).toBeNull()
  })
})

describe('النواقصُ على الخطوات', () => {
  it('النواقصُ هي ما يقوله «التالي» — لا عدٌّ ثانٍ يفترق عنه', () => {
    expect(WS).toMatch(/const missingOf = \(k: Stage\): string\[\] => \(k === "approval" \|\| doneOf\(k\) \? \[\] : gapsFor\(k, ws\)\);/)
    /* و`gapsFor` يُعرَّف قبل أن يُنادى في الرسم — وإلّا سقطت الصفحةُ بخطإ «قبل التعريف» */
    expect(WS.indexOf('const gapsFor = ')).toBeLessThan(WS.indexOf('const missing = new Map('))
  })

  it('وعددُها تحت اسم كلّ خطوة — ومسموعٌ في اسمها', () => {
    const rail = WS.slice(WS.indexOf('<ol className="flex w-full'), WS.indexOf('</ol>', WS.indexOf('<ol className="flex w-full')))
    expect(rail).toContain('const lack = missing.get(s.key)?.length ?? 0;')
    expect(rail).toMatch(/\{lack\} ناقص/)
    expect(rail).toContain('${lack ? ` · ينقصها ${lack}` : ""}')
  })
})

describe('حالةُ اللقاء تتحدّث بعد حفظه — لا بعد إعادة تحميل الصفحة', () => {
  it('ما يقوله «التالي» حين لا ينقل يُقرأ من المحفوظ الآن — إلّا ما منع الحفظَ وخطوةَ الإرسال', () => {
    expect(WS).toContain('const shownGaps: string[] = !gaps ? [] : gaps.refused.length > 0 || stage === "approval" ? gaps.items : doneOf(stage) ? [] : gapsFor(stage, ws);')
    expect(WS).toContain('{shownGaps.map((g) => <li key={g}>{g}</li>)}')
    expect(WS, 'عاد الصندوقُ يقرأ ما كُتب مرّةً').not.toContain('{gaps.items.map(')
  })

  it('وقائمةُ «اللقاءات المجدولة» تُقرأ ثانيةً حين يتبدّل ما في الشعبة من لقاءات', () => {
    expect(WS).toContain('<SessionsAndAttendance cohortId={ws.cohort.id} refresh={sessionsKey} />')
    expect(WS).toMatch(/const sessionsKey = ws\.sessions\.map\(/)
    const SA = code('src/pages/trainer/SessionsAndAttendance.tsx')
    expect(SA).toContain('useEffect(() => { void load(); }, [load, refresh]);')
  })
})

/* ═══ ولا يشعر المدرّبُ بالتحديث — لا يُكتب الأقدمُ فوق الأحدث (١١ أكتوبر ٢٠٢٦) ═══
   حفظٌ تلقائيٌّ في الطريق ينتظره كلُّ حفظٍ يدويّ، وكلُّ تحميلٍ من الخادم، وحفظُ الخروج. */
describe('الحفظُ التلقائيُّ لا يتسابق مع غيره', () => {
  it('⚠️ التحميلُ ينتظره — فلا يُستبدل بما في الخادم ما كتبه للتوّ', () => {
    const load = WS.slice(WS.indexOf('const load = useCallback('), WS.indexOf('try {', WS.indexOf('const load = useCallback(')))
    expect(load).toContain('if (autoFlight.current) await autoFlight.current.catch(() => {});')
  })

  it('⚠️ والحفظُ اليدويُّ ينتظره — إلّا التلقائيُّ نفسُه', () => {
    expect(WS).toMatch(/const persist = async \(over\?: PlanContent, fromAuto = false\): Promise<boolean> => \{\s*if \(planLocked\) return true;\s*if \(!fromAuto && autoFlight\.current\) await autoFlight\.current\.catch\(\(\) => \{\}\);/)
    expect(WS).toContain('if (!(await persist(snap, true))) return;')
    expect(WS).toContain('autoFlight.current = flight;')
  })

  it('⚠️ وحفظُ الخروج بعده لا معه', () => {
    const leave = WS.slice(WS.indexOf('leaveSave.current = '), WS.indexOf('\n  };', WS.indexOf('leaveSave.current = ')))
    expect(leave.indexOf('(autoFlight.current ?? Promise.resolve())')).toBeGreaterThan(-1)
    expect(leave.indexOf('(autoFlight.current ?? Promise.resolve())')).toBeLessThan(leave.indexOf('apiPut('))
  })

  it('وانقطاعُ الشبكة يُعاد وحدَه — وما ردّه الخادمُ بسببٍ لا يُعاد بعينه', () => {
    expect(WS).toContain('if (!(e instanceof ApiError) || e.status >= 500) {')
    expect(WS).toContain('}, [editKey, autoSaving, busy, autoMeta.failedKey]);')
  })
})

/* ═══ الناقصُ في موضعه لا في لوحة — ولا من البداية (١١ أكتوبر ٢٠٢٦) ═══
   «لم يعجبني الشريطُ الجانبيّ.. اجعل تنبيهاتِ النواقص بإشارةٍ حمراءَ حول كلّ شيءٍ
   ناقص مع توضيح ما هو ناقصٌ ببوب أب! وليس من البداية.. فقط إذا دخل الخانةَ وخرج
   منها أو نقر على متابعة» — صاحب المنصّة. */
describe('الإطارُ الأحمرُ على الناقص', () => {
  const FF = code('src/pages/trainer/FieldFlag.tsx')

  it('ذهبت اللوحةُ الجانبيّةُ وسطرُ الهاتف — لا عمودَ يأخذ من المتن', () => {
    expect(WS).not.toMatch(/<aside\b/)
    expect(WS).not.toMatch(/LiveChecklist/)
    expect(WS).not.toContain('lg:grid-cols-[minmax(0,1fr)_17rem]')
  })

  it('⚠️ لا يُرسم من البداية: بعد الخروج من الخانة، أو بعد «التالي» في خطوتها', () => {
    expect(FF).toContain('const on = Boolean(problem) && shown;')
    expect(FF).toContain('onBlurCapture={() => onLeave(id)}')
    expect(WS).toContain('shown: flagAll === stage || (!whole && touched.has(id)), onLeave: touch,')
    expect(WS).toMatch(/useState<ReadonlySet<string>>\(\(\) => new Set\(\)\)/)
    expect(WS).toContain('useState<Stage | null>(null);')
    /* و«التالي» الذي لم ينقل هو ما يُعلّم الخطوةَ كلَّها — وما منع الحفظَ كذلك */
    const next = WS.slice(WS.indexOf('const saveAndContinue = async'), WS.indexOf('const stageLabel = '))
    expect(next).toMatch(/setGaps\(gapsFor\(stage, fresh\), \{ saved: !planLocked \}\);\s*setFlagAll\(stage\);/)
    const persist = WS.slice(WS.indexOf('const persist = async'), WS.indexOf('await apiPut(`/api/trainer/cohorts/${ws.cohort.id}/plan`'))
    expect(persist).toContain('setFlagAll(stage);')
  })

  it('والإطارُ حول كلّ خانةٍ تنقص — بالقاعدة التي يحكم بها «التالي»', () => {
    expect(WS).toContain(`<FieldFlag {...flagProps("title", titleProblem())} className="sm:col-span-2">`)
    expect(WS).toContain(`<FieldFlag {...flagProps("level", levelProblem(content, planStatus))} className="sm:col-span-2">`)
    expect(WS).toMatch(/<FieldFlag \{\.\.\.flagProps\("audience", audienceProblem\(content, planStatus\)\)\}/)
    expect(WS).toMatch(/<FieldFlag \{\.\.\.flagProps\("period", periodProblem\(content, /)
    expect(WS).toContain('<FieldFlag as="li" key={m.moduleId} {...flagProps(`module:${m.moduleId}`, moduleProblem(m))}>')
    expect(WS).toContain('if (practiceGaps([m]).length) out.push(')
    for (const whole of ['"workbooks", serverProblem("workbooks"), true', '"sessions", serverProblem("sessions"), true', '`tab:${taskTab}`, rowProblem(TASK_TABS[taskTab].key), true', '"tab:resources", rowProblem("resources"), true']) {
      expect(WS).toContain(`<FieldFlag {...flagProps(${whole})}>`)
    }
  })

  it('والإطارُ لا يزيح ما حوله، والنافذةُ تُفتح من علامتها لا وهو يكتب', () => {
    expect(FF).toMatch(/on \? "rounded-lg outline outline-2 outline-offset-4 outline-red-500"/)
    expect(FF).toMatch(/className="peer absolute /)
    expect(FF).toMatch(/role="tooltip"[\s\S]*?hidden[^"]*peer-hover:block peer-focus:block/)
    expect(FF, 'النافذةُ تُفتح وهو يكتب في الخانة').not.toMatch(/group-(focus-within|hover):block/)
  })
})

/* ═══ «لمن» و«الهدف» قائمتان منسدلتان لا شبكتا بطاقات (١١ أكتوبر ٢٠٢٦) ═══
   «اجعلها اختيارا من متعدّدٍ من انسدال، لكي لا تأخذ مساحةً كبيرة» — صاحب المنصّة. */
describe('الاختيارُ من متعدّدٍ في سطرٍ واحد', () => {
  const MP = code('src/components/MultiPick.tsx')

  it('السؤالان كلاهما `MultiPick` — ولا شبكةَ بطاقاتٍ في الشاشة', () => {
    expect((WS.match(/<MultiPick\b/g) ?? []).length).toBe(2)
    expect(WS).toMatch(/<MultiPick\s+name="لمن هذه الشعبة"/)
    expect(WS).toMatch(/<MultiPick\s+name="هدفُ المتعلّم"/)
    expect(WS).not.toMatch(/<OptionGrid\b/)
  })

  it('والقائمةُ تطفو بأرضيّةٍ صلبة، وتُغلق بنقرةٍ خارجها من `document`', () => {
    expect(MP).toMatch(/<Inset tone="solid" role="listbox"/)
    expect(MP).toContain("document.addEventListener('mousedown', away)")
    expect(MP).not.toMatch(/fixed inset-0/)
  })
})

/* ═══ «بقي قبل الإرسال» أسماءُ خطواتٍ تُفتح لا فقرةُ جُمل (١١ أكتوبر ٢٠٢٦) ═══ */
describe('ما بقي قبل الإرسال — سطرٌ بأسماء الخطوات', () => {
  it('كلُّ خطوةٍ فيها ناقصٌ زرٌّ يفتحها — ولا تُسرد جُملُ القائمة كلُّها', () => {
    const box = WS.slice(WS.indexOf('<p className="font-bold">بقي قبل الإرسال:</p>'), WS.indexOf('</Inset>', WS.indexOf('<p className="font-bold">بقي قبل الإرسال:</p>')))
    expect(box).toContain('blocking.some((b) => stageOfKey(b.key) === x.key)')
    expect(box).toContain('onClick={() => void openStage(x.key)}>{x.label}</Button>')
    expect(WS, 'عادت الفقرة').not.toContain('بقي قبل الإرسال: {blocking.map((b) => b.labelAr).join(" · ")}')
  })
})

describe('فحصُ ما قبل الإرسال عند المدرّب — ما يحتاج نظرةً وحدَه', () => {
  it('المتحقّقُ يُعدّ ولا يُسرد عند المدرّب، ويُسرد كاملا عند المعتمِد', () => {
    const SC = code('src/components/PlanScorecard.tsx')
    expect(SC).toContain('const items = openOnly ? all.filter((i) => i.status !== "ok") : all;')
    expect(SC).toContain('const n = scorecardCounts(all);')
    expect(WS).toMatch(/heading="فحصٌ قبل الإرسال"\s+openOnly/)
    expect(code('src/components/admin/TrainerPlanReview.tsx')).not.toMatch(/<PlanScorecard[^>]*openOnly/)
  })
})
