/* سلّمُ التجهيز على خطّ المحاور — الشاشةُ تنادي القاعدةَ ولا تعيد كتابتها.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «معلوماتٌ عن الشعبة الأساسيّة… وبعدها
   المحاورُ ومواعيدُها… وبعدها الكرّاساتُ لكلّ محور… بعدها اللقاءاتُ المسجّلة…
   بعدها اللقاءاتُ المباشرة… وبعدها المهامُّ والواجباتُ وغيرُها… وبعدها
   المرحلةُ الأخيرة». والقاعدةُ المحضةُ في `axis-timeline.ts` يقرؤها الخادمُ
   والشاشةُ معا — فالفحصُ هنا أنّ الشاشةَ **تناديها** في مواضعها، على البنية
   لا على ورودِ كلمةٍ في تعليق (التعليقاتُ تُنزع قبل الفحص). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
const SLOT = code('src/pages/trainer/SlotSessions.tsx')
const ROUTES = code('server/http/routes/learning-portal.routes.ts')

/** لوحةُ درجةٍ بعينها — من شرطها إلى شرط التي تليها */
function stageBlock(stage: string, next: string): string {
  const from = WS.indexOf(`stage === "${stage}" &&`)
  const to = WS.indexOf(`stage === "${next}" &&`)
  expect(from, `لا لوحةَ للدرجة ${stage}`).toBeGreaterThan(-1)
  expect(to, `لا لوحةَ للدرجة ${next}`).toBeGreaterThan(from)
  return WS.slice(from, to)
}

describe('الدرجاتُ بترتيب المنهج', () => {
  it('⚠️ المعلوماتُ ← المحاورُ ومواعيدُها ← الكرّاسات ← اللقاءات ← المهامُّ والمصادر ← الاعتماد', () => {
    const order = [...WS.matchAll(/\{ key: "(\w+)", label:/g)].map((m) => m[1])
    expect(order).toEqual(['identity', 'modules', 'workbooks', 'sessions', 'assignments', 'approval'])
  })

  /* وصارت ثلاثةَ صفوف (٣٠ سبتمبر ٢٠٢٦): المهامُّ العمليّة والمصادرُ ومشروعُ التخرّج */
  it('⚠️ و«المهامُّ والمصادر» تتمّ بصفوفها الثلاثة معا — لا بأحدها', () => {
    expect(WS).toMatch(/assignments: \["assignments", "resources", "project"\]/)
    /* والشريطُ يعلّم الدرجةَ بالقاعدة نفسِها — وكان يقرأ صفَّ مفتاحها وحدَه،
       فعلّم «المهامّ والمصادر» تامّةً والمصادرُ ناقصة (قِيس في المتصفّح) */
    const rail = WS.slice(WS.indexOf('{STAGES.map((s, i) => {'), WS.indexOf('</ol>', WS.indexOf('{STAGES.map((s, i) => {')))
    expect(rail, 'الشريطُ لا يقرأ تمامَ الدرجة').toContain('const done = doneOf(s.key)')
    expect(rail, 'الشريطُ يقرأ صفّا واحدا').not.toMatch(/byKey\.get\(s\.key\)/)
  })
})

describe('② المحاورُ داخلَ مواعيدها', () => {
  const block = stageBlock('modules', 'workbooks')

  it('⚠️ ما يمنع المواعيدَ يُقال من القاعدة نفسِها', () => {
    expect(block).toContain('slotProblems(slots, moduleIds, planPeriod)')
  })

  it('⚠️ والجمعُ يقف عند الحدّ — زرُّه مطفأٌ ما لم يسمح `canMerge`', () => {
    expect(block).toMatch(/disabled=\{locked \|\| !canMerge\(slots, si, moduleIds\.length\)\}/)
    expect(block).toContain('mergeSlots(slots, si)')
    expect(block).toContain('splitSlot(slots, si, j + 1)')
  })

  it('⚠️ والمحاورُ تتغيّر فتتبعها المواعيد — نقلا وإضافةً وحذفا', () => {
    const move = WS.slice(WS.indexOf('const moveAxis'), WS.indexOf('const moveAxis') + 400)
    expect(move).toContain('reflowSlots(')
    expect(block, 'المحورُ الجديدُ لا يلحق موعدا').toContain('appendToSlots(slots, moduleId)')
    const del = WS.slice(WS.indexOf('titleAr="حذفُ المحور"'), WS.indexOf('titleAr="حذفُ المحور"') + 900)
    expect(del, 'المحذوفُ يبقى في موعده').toContain('dropFromSlots(slots, pendingModule.module.moduleId)')
  })

  it('⚠️ والتوزيعُ الأوّلُ يُرتَّب للمسودّة وحدَها — والبصمةُ من المحفوظ فيُعلَّم «لم يُحفَظ»', () => {
    const load = WS.slice(WS.indexOf('const load = useCallback'), WS.indexOf('useEffect(() => { void load(true)'))
    expect(load).toMatch(/const editable = status === "draft" \|\| status === "changes_requested"/)
    expect(load).toMatch(/editable && !\(saved\.slots\?\.length\)/)
    expect(load).toContain('defaultSlots(')
    expect(load, 'البصمةُ من المُرتَّب لا من المحفوظ').toContain('modules: modulesKey(saved)')
  })

  it('وإعادةُ التوزيع تمرّ بالاستئذان — وتحمل الكرّاساتِ مع أوّل محاورها', () => {
    expect(WS).toContain('onClick={() => setPendingReflow(true)}')
    const confirm = WS.slice(WS.indexOf('titleAr="إعادةُ توزيع المواعيد"'), WS.indexOf('titleAr="إعادةُ توزيع المواعيد"') + 700)
    expect(confirm).toContain('o.moduleIds[0] === x.moduleIds[0]')
  })
})

/* كانت لكلّ موعدٍ كرّاسة، وصارت واحدةً للدورة ومعها موضعُ كلّ محورٍ فيها
   (قرارُ صاحب المنصّة، ٣٠ سبتمبر ٢٠٢٦). */
describe('③ الكرّاسة — واحدةٌ للدورة', () => {
  const block = stageBlock('workbooks', 'sessions')

  it('⚠️ كرّاسةٌ واحدةٌ يُحكم عليها بقاعدة الخادم — لا بطاقةٌ لكلّ موعد', () => {
    expect(block, 'عادت كرّاسةٌ لكلّ موعد').not.toContain('slots.map(')
    expect(block).toContain('workbookDone(wb)')
    expect(block).toMatch(/purpose="plan_resource"/)
    expect(block).toMatch(/refId="workbook-cohort"/)
    expect(block).toContain('aria-label="رابطُ الكرّاسة"')
  })

  it('⚠️ ولكلّ محورٍ خانةُ موضعه فيها — فيتبعها المتعلّمُ محورا محورا', () => {
    expect(block).toMatch(/content\.modules\.map\(\(m, i\) =>[\s\S]*?aria-label=\{`أين يبدأ المحور \$\{i \+ 1\} في الكرّاسة`\}[\s\S]*?onChange=\{\(e\) => setWhere\(m\.moduleId, e\.target\.value\)\}/)
  })

  it('⚠️ ولا يجتمع ملفٌّ ورابط — الرفعُ يمحو الرابط، والرابطُ يُخفي الرفع', () => {
    expect(block).toContain('setWorkbook({ ...next, url: null })')
    expect(block).toMatch(/!\(wb\?\.url \?\? ""\)\.trim\(\) && \(/)
  })
})

describe('④ اللقاءات — بطاقةٌ لكلّ موعد', () => {
  const block = stageBlock('sessions', 'assignments')

  it('⚠️ للشعبة ذات المواعيد بطاقاتُ مواعيد، ولما سبقها جدولتُها القديمة', () => {
    expect(block).toMatch(/slotsOn \? \(\(\) => \{[\s\S]*<SlotSessions[\s\S]*\}\)\(\) : \(/)
    expect(block).toContain('<TrainerSchedule')
  })

  it('⚠️ والربطُ يُقال إنّه يسري فورا بلا اعتماد — لا «يُقرَّر وحدَه» (٢٨ سبتمبر ٢٠٢٦)', () => {
    expect(SLOT, 'لا يُقال للمدرّب إنّ ربطَ المعتمَد يسري فورا')
      .toMatch(/s\.approvalState === "approved"\s*\?\s*`رُبط[^`]*ويسري لمتعلّميك فورا بلا اعتماد`/)
    expect(WS, 'قيل للمدرّب إنّ الربطَ يُقرَّر وحدَه').not.toContain('وما تغيّره في اللقاءات والمهامّ يُقرَّر وحدَه')
    expect(WS).toContain('أمّا ربطُ لقاءٍ بمحاوره فيسري فورا بلا اعتماد')
  })

  it('⚠️ والجلسةُ المسجّلة بعد الاعتماد: يُقال إنّ محورَها ويومَ فتحها يسريان وإنّ ما سواهما ينتظر (٢٨ سبتمبر ٢٠٢٦)', () => {
    /* وكان يقول «محورُها وحدَه» — ثمّ قال صاحبُ المنصّة: «free the recording's opening day too» */
    expect(SLOT, 'لا يُقال للمدرّب أيُّ تعديلٍ في الجلسة المسجّلة يسري لحظتَه')
      .toMatch(/\{approvedOnce && \([\s\S]{0,200}فمحورُ الجلسة المسجّلة ويومُ فتحها يسريان لمتعلّميك متى حفظت، بلا اعتماد[\s\S]{0,200}يصل الإدارةَ أوّلا/)
    expect(SLOT, 'عاد يومُ الفتح إلى ما ينتظر الإدارة').not.toMatch(/أمّا اسمُها ورابطُها ويومُ فتحها/)
    expect(WS, 'الورشةُ لا تقول للبطاقة إنّ الخطّةَ اعتُمدت').toContain('approvedOnce={ws.approvedOnce ?? false}')
  })

  it('⚠️ وما لم يُربط بمحورٍ يُربط هنا ولا يضيع', () => {
    expect(block).toContain('/api/trainer/sessions/${x.id}/axes')
    expect(block).toContain('const loose = mine.filter((x) => slotOf(x) === -1)')
  })

  it('⚠️ والبطاقةُ تكتب الساعةَ بتوقيت الشعبة — لا بساعة متصفّح المدرّب', () => {
    expect(SLOT).toMatch(/const at = \(date: string, clock: string\) => \{[\s\S]{0,120}zonedInstant\(date,/)
    expect(SLOT, 'اللقاءُ يُرسَل بساعة المتصفّح').not.toMatch(/new Date\(`\$\{form\.date\}T/)
    expect(SLOT).toContain('startsAt: at(form.date, form.from)')
  })

  it('⚠️ واللقاءُ لمحورٍ أو محورين — والسقفُ من القاعدة لا رقمٌ مكتوب', () => {
    expect(SLOT).toContain('next.length > MAX_AXES_PER_SESSION')
    expect(SLOT).toContain('form.moduleIds.length >= MAX_AXES_PER_SESSION')
    expect(SLOT, 'يُرسَل لقاءٌ بلا محور').toContain('form.moduleIds.length === 0')
    expect(SLOT).toContain('moduleIds: form.moduleIds')
  })

  it('⚠️ واللقاءُ والجلسةُ المسجّلةُ داخلَ موعدهما — والتنبيهُ بعد اليوم الثالث من القاعدة', () => {
    expect(SLOT).toMatch(/min=\{slot\.startsOn\} max=\{slot\.endsOn\}/)
    expect((SLOT.match(/min=\{slot\.startsOn\} max=\{slot\.endsOn\}/g) ?? []).length, 'حقلٌ بلا حدود الموعد').toBe(2)
    expect(SLOT).toContain('formDay > EARLY_DAYS')
  })
})

describe('⑤ المهامُّ والمصادرُ بمحاورها', () => {
  const block = stageBlock('assignments', 'approval')

  it('⚠️ المهمّةُ لا تُحفظ بلا محورٍ في شعبةٍ لها مواعيد', () => {
    expect(block).toMatch(/disabled=\{busy \|\| taskForm\.title\.trim\(\)\.length < 3 \|\| \(slotsOn && !taskForm\.moduleId\)\}/)
    expect(block).toContain('aria-label="محور المهمّة"')
  })

  it('⚠️ وآخرُ موعدها آخرُ موعد محورها ما لم يكتب غيرَه — وآخرُ ذلك اليوم بتوقيت الشعبة', () => {
    expect(block).toMatch(/const auto = !taskForm\.dueAt \|\| \(before && taskForm\.dueAt === before\.endsOn\)/)
    expect(block).toContain('dueAt: auto ? (after?.endsOn ?? "") : taskForm.dueAt')
    expect(WS).toContain('zonedInstant(taskForm.dueAt, [23, 59, 59, 999])')
    expect(WS, 'عاد آخرُ الموعد منتصفَ ليل أوّل اليوم بغرينتش').not.toContain('new Date(taskForm.dueAt)')
  })

  it('⚠️ والمصدرُ يُربط بمحوره أو يُجعل قراءةً مسبقة — والمسجَّلُ ليس هنا', () => {
    expect(block).toMatch(/slotsOn && cat !== "recorded" && \(/)
    expect(block).toContain('aria-label={`محورُ المصدر ${i + 1}`}')
    expect(block).toContain('patch({ preReading: e.target.checked || null })')
    expect(WS).toMatch(/const resourceCats[^\n]*slotsOn \? RESOURCE_CATEGORIES\.filter\(\(c\) => c !== "recorded"\)/)
  })
})

describe('المسالك', () => {
  it('⚠️ محورا اللقاء: اثنان على الأكثر بلا تكرار — عند الإنشاء وعند الربط', () => {
    expect(ROUTES).toMatch(/const axesArray = z\.array\([\s\S]{0,80}\.max\(MAX_AXES_PER_SESSION/)
    expect(ROUTES).toMatch(/const uniqueAxes = \(ids: string\[\]\) => new Set\(ids\)\.size === ids\.length/)
    expect(ROUTES).toMatch(/const sessionAxesSchema = axesArray\.refine\(uniqueAxes/)
    expect(ROUTES).toMatch(/const sessionAxesRequired = axesArray\s*\.min\(1,[\s\S]{0,120}\.refine\(uniqueAxes/)
    expect(ROUTES).toContain('moduleIds: sessionAxesSchema.optional()')
    /* والربطُ بعد الإنشاء لا يترك اللقاءَ بلا محور */
    expect(ROUTES).toMatch(/app\.patch\('\/api\/trainer\/sessions\/:sessionId\/axes'[\s\S]{0,400}z\.object\(\{ moduleIds: sessionAxesRequired \}\)\.strict\(\)/)
  })

  it('⚠️ والخطّةُ تحفظ مواعيدَها ومحاورَ مصادرها — لا يُسقطها المخطّطُ صامتا', () => {
    const plan = ROUTES.slice(ROUTES.indexOf('const planContent = z.object'), ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
    expect(plan).toMatch(/slots: z\.array\(z\.object\(\{/)
    expect(plan).toMatch(/workbook: z\.object\(\{/)
    expect(plan).toMatch(/moduleId: z\.string\(\)\.trim\(\)\.max\(64\)\.nullish\(\)/)
    expect(plan).toMatch(/preReading: z\.boolean\(\)\.nullish\(\)/)
  })
})

describe('والمعتمِدُ يرى المواعيد', () => {
  const OPS = code('src/pages/admin/CohortOps.tsx')

  /* المرحلة ٣: صار سطرُ الموعد صفحةَ المنهج كاملة — الصفحةَ نفسَها التي يقرؤها
     المدرّبُ قبل الإرسال. وتواريخُ الموعد ومحاورُه وكرّاستُه بقاعدة الخادم
     (`workbookDone`) يحرسها بناؤها المحضُ في `curriculum-view.test.ts`، وما
     لا مواعيدَ له يُقرأ محورا محورا هناك كذلك. وهنا أنّ البطاقةَ تبنيها فعلا
     من الخطّة **ولقاءاتها ومهامّها** — لا من الخطّة وحدَها. */
  it('⚠️ بطاقةُ الخطّة تعرض المنهجَ كاملا — بالخطّة ولقاءاتها ومهامّها', () => {
    expect(OPS).toMatch(/<CurriculumReview\s+view=\{curriculumView\(\{/)
    expect(OPS).toContain('content: trainerPlan.content')
    expect(OPS, 'المنهجُ بلا لقاءات').toContain('sessions: trainerPlan.sessions')
    expect(OPS, 'المنهجُ بلا مهامّ').toContain('assessments: trainerPlan.assessments')
  })
})
