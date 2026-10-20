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
  expect(from, `لا لوحة للدرجة ${stage}`).toBeGreaterThan(-1)
  expect(to, `لا لوحة للدرجة ${next}`).toBeGreaterThan(from)
  return WS.slice(from, to)
}

describe('الدرجات بترتيب المنهج', () => {
  it('⚠️ المعلومات ← المحاور ومواعيدها ← الكرّاسات ← اللقاءات ← المهامّ والمصادر ← الاعتماد', () => {
    const order = [...WS.matchAll(/\{ key: "(\w+)", label:/g)].map((m) => m[1])
    expect(order).toEqual(['identity', 'modules', 'workbooks', 'sessions', 'assignments', 'approval'])
  })

  /* وصارت ثلاثةَ صفوف (٣٠ سبتمبر ٢٠٢٦): المهامُّ العمليّة والمصادرُ ومشروعُ التخرّج */
  it('⚠️ و«المهامّ والمصادر» تتمّ بصفوفها الثلاثة معا — لا بأحدها', () => {
    expect(WS).toMatch(/assignments: \["assignments", "resources", "project"\]/)
    /* والشريطُ يعلّم الدرجةَ بالقاعدة نفسِها — وكان يقرأ صفَّ مفتاحها وحدَه،
       فعلّم «المهامّ والمصادر» تامّةً والمصادرُ ناقصة (قِيس في المتصفّح) */
    const rail = WS.slice(WS.indexOf('{STAGES.map((s, i) => {'), WS.indexOf('</ol>', WS.indexOf('{STAGES.map((s, i) => {')))
    expect(rail, 'الشريط لا يقرأ تمام الدرجة').toContain('const done = doneOf(s.key)')
    expect(rail, 'الشريط يقرأ صفّا واحدا').not.toMatch(/byKey\.get\(s\.key\)/)
  })
})

/* ═══ نصيحةُ البدء — ديسمبر أو أواخرَ نوفمبر (٤ أكتوبر ٢٠٢٦) ═══
   «نصيحةً فقط… واجعلها ودودةً جدّا». وقاعدتُها ونصُّها في `start-advice.ts`. */
describe('① نصيحة البدء في المعلومات الأساسيّة', () => {
  const block = stageBlock('identity', 'modules')
  const ui = block.slice(block.indexOf('const advice ='), block.indexOf('})()}', block.indexOf('const advice =')))

  /* وكانت لا تُقال لشعبةٍ اعتُمدت؛ ثمّ قال صاحبُ المنصّة: «لا شيءَ معتمَدٌ بعد، فأعطهم
     النصيحة» — فتُقال لكلّ شعبة (٤ أكتوبر ٢٠٢٦) */
  it('⚠️ تقال من القاعدة بتاريخ البدء الذي في يده — ولكلّ شعبة بلا استثناء', () => {
    expect(block).toMatch(/const advice = startAdvice\(content\.startsOn, today\);/)
    expect(ui, 'عادت النصيحة تحجب عن بعض الشعب').not.toMatch(/approvedOnce|locked/)
    expect(ui).toContain('START_ADVICE_AR[advice]')
    expect(ui).toContain('START_ADVICE_AR.thanks')
  })

  it('⚠️ وتاريخا المدّة يمرّان بما يجعل المواعيد تتبعها — ويقال لمن رتّبها بيده', () => {
    expect(block).toContain('onChange={(e) => setPeriodField({ startsOn: e.target.value || null })}')
    expect(block).toContain('onChange={(e) => setPeriodField({ endsOn: e.target.value || null })}')
    const fn = WS.slice(WS.indexOf('const setPeriodField ='), WS.indexOf('const span ='))
    expect(fn, 'المواعيد لا تتبع المدّة').toMatch(/followPeriod\(slots, moduleIds, p\)/)
    expect(fn, 'تتبع مدّة لم تصلح').toContain('periodProblem(p) === null')
    expect(WS).toMatch(/const periodTip = slotsOn && planPeriod && span && !locked && slotsOutsidePeriod\(slots, planPeriod\) \?/)
    expect(block, 'لا يقال لمن رتّب مواعيده بيده حيث غيّر مدّته').toContain('{periodTip && <div className="sm:col-span-2">{periodTip}</div>}')
    expect(stageBlock('modules', 'workbooks')).toContain('{periodTip && <div className="mt-3">{periodTip}</div>}')
  })

  it('⚠️ وودودة لا تمنع: لا لون تحذير، ولا تمسّ زرّ الحفظ', () => {
    expect(ui, 'النصيحة بلون التحذير').not.toMatch(/tone="warn"|text-gold-ink|tone="danger"/)
    expect(ui).toContain('tone="accent"')
    expect(WS.slice(WS.indexOf('const saveProblems'), WS.indexOf('const persist')), 'صارت النصيحة مانعا للحفظ').not.toContain('startAdvice')
  })
})

describe('② المحاور داخل مواعيدها', () => {
  const block = stageBlock('modules', 'workbooks')

  it('⚠️ ما يمنع المواعيد يقال من القاعدة نفسها', () => {
    expect(block).toContain('slotProblems(slots, moduleIds, planPeriod)')
  })

  it('⚠️ والجمع يقف عند الحدّ — زرّه مطفأ ما لم يسمح `canMerge`', () => {
    expect(block).toMatch(/disabled=\{locked \|\| !canMerge\(slots, si, moduleIds\.length\)\}/)
    expect(block).toContain('mergeSlots(slots, si)')
    expect(block).toContain('splitSlot(slots, si, j + 1)')
  })

  it('⚠️ والمحاور تتغيّر فتتبعها المواعيد — نقلا وإضافة وحذفا', () => {
    const move = WS.slice(WS.indexOf('const moveAxis'), WS.indexOf('const moveAxis') + 400)
    expect(move).toContain('reflowSlots(')
    /* والجديدُ لا يُكدَّس في آخر موعد (٤ أكتوبر ٢٠٢٦) — قاعدتُه في `addAxisToSlots` */
    expect(block, 'المحور الجديد لا يلحق موعدا').toContain('addAxisToSlots(slots, [...moduleIds, moduleId], planPeriod)')
    expect(WS, 'عاد الجديد يكدّس في آخر موعد').not.toContain('appendToSlots(')
    const del = WS.slice(WS.indexOf('titleAr="حذف المحور"'), WS.indexOf('titleAr="حذف المحور"') + 900)
    expect(del, 'المحذوف يبقى في موعده').toContain('dropFromSlots(slots, pendingModule.module.moduleId)')
  })

  /* ومنذ ١٧ أكتوبر ٢٠٢٦ لا توزيعَ أوّلَ يُرتَّب: الخطّةُ التي في يده تأخذ مواعيدَ محاورها من لقاءاتها،
     والمكتوبُ فيها يسقط حين يحفظها — والبصمةُ من المحفوظ فيعلّم «لم يحفظ» حتّى يحفظ */
  it('⚠️ والتي في يده تصير على اللقاءات — والبصمة من المحفوظ فيعلّم «لم يحفظ»', () => {
    const load = WS.slice(WS.indexOf('const load = useCallback'), WS.indexOf('useEffect(() => { void load(true)'))
    expect(load).toMatch(/const editable = status === "draft" \|\| status === "changes_requested"/)
    expect(load).toMatch(/editable && !timedByMeetings\(saved\)/)
    expect(load).toContain('timing: MEETINGS_TIMING, slots: undefined')
    expect(load, 'عاد التوزيع الأوّل يرتّب مواعيد').not.toContain('defaultSlots(')
    expect(load, 'البصمة من المرتّب لا من المحفوظ').toContain('modules: modulesKey(saved)')
  })

  it('وإعادة التوزيع تمرّ بالاستئذان — وتحمل الكرّاسات مع أوّل محاورها', () => {
    expect(WS).toContain('onClick={() => setPendingReflow(true)}')
    const confirm = WS.slice(WS.indexOf('titleAr="إعادة توزيع المواعيد"'), WS.indexOf('</ConfirmAction>', WS.indexOf('titleAr="إعادة توزيع المواعيد"')))
    expect(confirm).toContain('respreadSlots(slots, moduleIds, planPeriod)')
    /* ومن «اللقاءات» تُحفظ حالا — فبطاقاتُها على المحفوظ الذي يحكم به الخادم */
    expect(confirm).toMatch(/if \(stage === "sessions"\) void respreadAndSave\(next\);\s*else setSlots\(next\);/)
  })

  /* ═══ والموعدُ المزدحمُ يُقال ومعه زرٌّ يوزّع — نصيحةٌ لا مانع (٤ أكتوبر ٢٠٢٦) ═══ */
  it('⚠️ والمزدحم يقال في الدرجتين — بالقاعدة، ولا يقال حين لا يغيّر الزرّ شيئا', () => {
    expect(WS).toContain('const crowded = crowdedSlots(slots)')
    expect(WS).toMatch(/const spreadable = slotsOn && planPeriod !== null && !sameSlots\(slots, defaultSlots\(moduleIds, planPeriod\)\)/)
    expect(WS).toMatch(/const crowdTip = crowded\.length > 0 && spreadable && !locked \?/)
    const tip = WS.slice(WS.indexOf('const crowdTip ='), WS.indexOf(') : null;', WS.indexOf('const crowdTip =')))
    expect(tip).toContain('onClick={() => setPendingReflow(true)}')
    expect(tip, 'النصيحة بلون التحذير').not.toMatch(/tone="warn"/)
    expect(block).toContain('{crowdTip && <div className="mt-3">{crowdTip}</div>}')
    expect(stageBlock('sessions', 'assignments')).toContain('{crowdTip && <div className="mt-3">{crowdTip}</div>}')
  })
})

/* كانت لكلّ موعدٍ كرّاسة، وصارت واحدةً للدورة ومعها موضعُ كلّ محورٍ فيها
   (قرارُ صاحب المنصّة، ٣٠ سبتمبر ٢٠٢٦). */
/* وصارت خيارين (٦ أكتوبر ٢٠٢٦): للدورة أو لكلّ محور — وحرّاسُ الخيارين ومجموعاتِ
   المحاور وقالبِ وجيز في `cohort-workbooks.test.ts`. وهنا كرّاسةُ الدورة وملفُّها. */
describe('③ الكرّاسة — كرّاسة الدورة وملفّها', () => {
  const block = stageBlock('workbooks', 'sessions')
  const FILE = WS.slice(WS.indexOf('function WorkbookFile('), WS.indexOf('const MATERIAL_OPTIONS'))

  it('⚠️ كرّاسة الدورة يحكم عليها بقاعدة الخادم — لا بطاقة لكلّ موعد', () => {
    expect(block, 'عادت كرّاسة لكلّ موعد').not.toContain('slots.map(')
    expect(block).toContain('workbookDone(wb)')
    expect(block).toMatch(/<WorkbookFile cohortId=\{ws\.cohort\.id\} refId="workbook-cohort"/)
  })

  it('⚠️ ولكلّ محور خانة موضعه فيها — فيتبعها المتعلّم محورا محورا', () => {
    expect(block).toMatch(/content\.modules\.map\(\(m, i\) =>[\s\S]*?aria-label=\{`أين يبدأ المحور \$\{i \+ 1\} في الكرّاسة`\}[\s\S]*?onChange=\{\(e\) => setWhere\(m\.moduleId, e\.target\.value\)\}/)
  })

  /* «PDF only but the template is Word» — صاحبُ المنصّة (٦ أكتوبر ٢٠٢٦) */
  it('⚠️ والرفع بغرض «workbook» — PDF وحده — لا «plan_resource»', () => {
    expect(FILE, 'لا يرفع بغرض الكرّاسة').toMatch(/purpose="workbook"/)
    expect(FILE, 'عاد الرفع مصدرا يقبل Word والشرائح').not.toMatch(/purpose="plan_resource"/)
  })

  it('⚠️ ولا يجتمع ملفّ ورابط — الرفع يمحو الرابط، والرابط يخفي الرفع', () => {
    expect(FILE).toContain('onChange({ ...next, url: null })')
    expect(FILE).toMatch(/!\(value\.url \?\? ""\)\.trim\(\) && \(/)
    expect(FILE).toContain('aria-label={`رابط ${name}`}')
  })
})

describe('④ اللقاءات — بطاقة لكلّ موعد', () => {
  const block = stageBlock('sessions', 'assignments')

  it('⚠️ للشعبة ذات المواعيد بطاقات مواعيد، ولما سبقها جدولتها القديمة', () => {
    expect(block).toMatch(/sessionsOn \? \(\(\) => \{[\s\S]*<SlotSessions[\s\S]*\}\)\(\) : byMeetings \? \(/)
    expect(block).toContain('<TrainerSchedule')
    /* ومنذ ١٧ أكتوبر ٢٠٢٦ للخطّة التي على اللقاءات بطاقةٌ واحدةٌ بمدّة الشعبة ومحاورها كلِّها */
    expect(block).toContain('wholePeriod={byMeetings}')
  })

  it('⚠️ والربط يقال إنّه يسري فورا بلا اعتماد — لا «يقرّر وحده» (٢٨ سبتمبر ٢٠٢٦)', () => {
    expect(SLOT, 'لا يقال للمدرّب إنّ ربط المعتمد يسري فورا')
      .toMatch(/s\.approvalState === "approved"\s*\?\s*`ربط[^`]*ويسري لمتعلّميك فورا بلا اعتماد`/)
    expect(WS, 'قيل للمدرّب إنّ الربط يقرّر وحده').not.toContain('وما تغيّره في اللقاءات والمهامّ يقرّر وحده')
    expect(WS).toContain('أمّا ربط لقاء بمحاوره فيسري فورا بلا اعتماد')
  })

  it('⚠️ والجلسة المسجّلة بعد الاعتماد: يقال إنّ محورها ويوم فتحها يسريان وإنّ ما سواهما ينتظر (٢٨ سبتمبر ٢٠٢٦)', () => {
    /* وكان يقول «محورها وحده» — ثمّ قال صاحب المنصّة: «free the recording's opening day too» */
    expect(SLOT, 'لا يقال للمدرّب أيّ تعديل في الجلسة المسجّلة يسري لحظته')
      .toMatch(/\{approvedOnce && recorded\.length > 0 && \([\s\S]{0,200}المحور ويوم الفتح يسريان فورا، وغيرهما تعتمده الإدارة/)
    expect(SLOT, 'عاد يوم الفتح إلى ما ينتظر الإدارة').not.toMatch(/أمّا اسمها ورابطها ويوم فتحها/)
    expect(WS, 'الورشة لا تقول للبطاقة إنّ الخطّة اعتمدت').toContain('approvedOnce={ws.approvedOnce ?? false}')
  })

  it('⚠️ وما لم يربط بمحور يربط هنا ولا يضيع', () => {
    expect(block).toContain('/api/trainer/sessions/${x.id}/axes')
    expect(block).toContain('const loose = mine.filter((x) => slotOf(x) === -1)')
  })

  it('⚠️ والبطاقة تكتب الساعة بتوقيت الشعبة — لا بساعة متصفّح المدرّب', () => {
    expect(SLOT).toMatch(/const at = \(date: string, clock: string\) => \{[\s\S]{0,120}zonedInstant\(date,/)
    expect(SLOT, 'اللقاء يرسل بساعة المتصفّح').not.toMatch(/new Date\(`\$\{form\.date\}T/)
    expect(SLOT).toContain('startsAt: at(form.date, form.from)')
  })

  /* ═══ ونُسخ السقف (٤ أكتوبر ٢٠٢٦): «يربطها بمحورٍ أو اثنين أو أكثر… لكن لا تدعه
     يضع لقاءً لمحورٍ في غير وقته» ═══ */
  it('⚠️ واللقاء لمحور أو أكثر بلا سقف — ووقته في وقت محاوره يقال قبل الإرسال', () => {
    expect(SLOT, 'عاد سقف على محاور اللقاء').not.toMatch(/MAX_AXES|SESSION_AXES_MAX|moduleIds\.length >= \d|const full = /)
    expect(SLOT, 'يرسل لقاء بلا محور').toContain('form.moduleIds.length === 0')
    expect(SLOT).toContain('moduleIds: form.moduleIds')
    expect(SLOT, 'يترك لقاء قائم بلا محور').toContain('if (next.length === 0) return;')
    expect(SLOT).toMatch(/const outside = Boolean\(form\.date\) && !sessionInsideSlot\(/)
    expect(SLOT, 'يرسل لقاء في غير وقت محاوره').toMatch(/disabled=\{busy \|\| title\.length < 2 \|\| !timed \|\| outside \|\|/)
  })

  /* ═══ «يضيفون ما شاؤوا — ساعاتٌ أكثرُ جودةٌ أعلى» (٤ أكتوبر ٢٠٢٦) ═══ */
  it('⚠️ والنصائح لا تقلّل اللقاءات — بل تقول إنّ الساعات الأكثر جودة أعلى', () => {
    expect(block).toContain('ساعات أكثر جودة أعلى')
    expect(block, 'عادت نصيحة «لا تكثر»').not.toContain('لا تكثر')
    expect(SLOT, 'عادت نصيحة «اجمعها» في بطاقة الموعد').not.toMatch(/slotSessionTips|اجمعهما|يجمع محاور الموعد كلّها/)
  })

  it('⚠️ ونموذج اللقاء ينصح بأواخر نوفمبر حين يختار يوم قبله — ودودا لا يمنع', () => {
    const tip = SLOT.slice(SLOT.indexOf('sessionDayAdvice(form.date'), SLOT.indexOf('</p>', SLOT.indexOf('sessionDayAdvice(form.date')))
    expect(SLOT).toContain('!outside && sessionDayAdvice(form.date, zonedDay(new Date()))')
    expect(tip).toContain('SESSION_DAY_ADVICE_AR')
    expect(tip, 'النصيحة بلون التحذير').not.toMatch(/gold|warn/)
    /* زرُّ نموذج اللقاء الجديد — لا زرُّ «احفظ الموعدَ الجديد» الذي قبله في البطاقة */
    const save = SLOT.indexOf('احفظ اللقاء')
    const send = SLOT.slice(SLOT.lastIndexOf('<Button tone="confirm"', save), save)
    expect(send, 'صارت النصيحة مانعا للإرسال').not.toContain('sessionDayAdvice')
  })

  it('⚠️ والإضافة والربط يحفظان المواعيد أوّلا — فالخادم يحكم على المحفوظ', () => {
    expect(block).toContain('beforeWrite={saveSlotsFirst}')
    expect(WS).toMatch(/const saveSlotsFirst = async \(\): Promise<boolean> => \{\s*if \(!dirty\.modules\) return true;/)
    for (const [fn, call] of [['const add = async', 'apiPost('], ['const relink = async', 'apiPatch(']] as const) {
      const body = SLOT.slice(SLOT.indexOf(fn), SLOT.indexOf('finally', SLOT.indexOf(fn)))
      const guard = body.indexOf('if (beforeWrite && !(await beforeWrite())) return;')
      expect(guard, `${fn}: لا يحفظ المواعيد قبل النداء`).toBeGreaterThan(-1)
      expect(guard, `${fn}: يحفظ بعد النداء`).toBeLessThan(body.indexOf(call))
    }
  })

  it('⚠️ وما لم يربط يعرض له ما يقع في وقته من المحاور وحده — كما يحكم الخادم', () => {
    const live = block.slice(block.indexOf('{loose.map((x) => {'), block.indexOf('{looseRecorded.map('))
    expect(live).toMatch(/const held = sessionEnd\(x\)\.getTime\(\) < Date\.now\(\);/)
    expect(live).toMatch(/return si !== -1 && \(held \|\| sessionInsideSlot\(x, sessionSlots\[si\]\)\);/)
    expect(live).toContain('{fits.map(({ m, k }) =>')
    expect(live, 'يعرض كلّ محور ولو في غير وقته').not.toContain('content.modules.map((m, k) => <option')
  })

  /* ═══ «اعرض لي الوقتَ المسموحَ به وحدَه» (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦) ═══
     كان الحقلُ تقويما بحدّين يُرشد ولا يمنع — يُكتب فيه أيُّ يومٍ ثمّ تُقال ملاحظة. */
  it('⚠️ واللقاء والجلسة المسجّلة داخل موعدهما — يومهما من قائمة أيّام الموعد لا من تقويم مفتوح', () => {
    expect(SLOT, 'عاد تقويم مفتوح في بطاقة الموعد').not.toMatch(/type="date"/)
    /* اللقاءُ الجديد، وتغييرُ موعد لقاءٍ قائم، ويومُ فتح المسجّلة — كلُّها من أيّام الموعد */
    expect(SLOT).toMatch(/<SlotDaySelect slot=\{slot\} upcoming value=\{form\.date\}[^>]*onChange=\{\(date\) => setForm\(\{ \.\.\.form, date \}\)\} \/>/)
    expect(SLOT).toMatch(/<SlotDaySelect slot=\{slot\} upcoming value=\{move\.date\}/)
    expect(SLOT).toMatch(/<SlotDaySelect slot=\{slot\} value=\{date\}[^>]*onChange=\{\(d\) => onPatchRecorded\(i, \{ opensAt: at\(d, clock\)\.toISOString\(\) \}\)\} \/>/)
    expect(code('src/pages/trainer/SlotDaySelect.tsx')).toMatch(/const days = useMemo\(\(\) => slotDays\(slot, today\), \[slot, today\]\);/)
    expect(code('src/pages/trainer/SlotDaySelect.tsx'), 'يختار ثانية يوم خارج الموعد').toMatch(/\{foreign && <option value=\{value\} disabled>/)
    const weekly = code('src/pages/trainer/WeeklySessions.tsx')
    expect(weekly, 'عاد تقويم مفتوح في التكرار الأسبوعيّ').not.toMatch(/type="date"/)
    expect(weekly).toMatch(/<SlotDaySelect slot=\{slot\} upcoming value=\{r\.date\}/)
    expect(SLOT).toContain('formDay > EARLY_DAYS')
  })

  /* ═══ والمباشرُ والمسجّلُ قائمةٌ واحدة، والمحورُ باسمه (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦) ═══
     «يبدوان شيئين لمحورين مختلفين… أعطني قائمةَ المحاور أختار منها، لا أن أعود فأتذكّر ما كان محوري». */
  it('⚠️ ولقاءات الموعد قائمة واحدة بزرّين متجاورين — والمحور يختار باسمه', () => {
    const list = SLOT.slice(SLOT.indexOf('لقاءات هذا الموعد</p>'), SLOT.indexOf('لقاء مباشر جديد'))
    expect(list, 'المسجّل خرج من قائمة اللقاءات').toMatch(/\{sessions\.map\(\(s\) => \{[\s\S]*<Chip tone="info" icon=\{Video\}>مباشر<\/Chip>[\s\S]*\{recorded\.map\(\(\{ row, i \}\) => \{[\s\S]*<Chip tone="neutral" icon=\{Film\}>مسجّلة<\/Chip>/)
    expect(list).toMatch(/\+ لقاء مباشر\s*<\/Button>\s*<Button[^>]*icon=\{Film\}[\s\S]{0,300}\+ جلسة مسجّلة/)
    expect(SLOT).toContain('أضف لقاء مباشرا، أو جلسة مسجّلة، أو الاثنين — وما شئت من كلّ منهما، لمحور واحد أو أكثر.')
    /* المحورُ باسمه في كلّ موضعٍ يُختار فيه */
    expect(SLOT).toMatch(/const axisNameAr = \(id: string\) => \{[\s\S]{0,120}`المحور \$\{axisNo\.get\(id\) \?\? "؟"\}\$\{t \? ` · \$\{t\}` : ""\}`/)
    expect(SLOT, 'محاور اللقاء الجديد أرقام بلا أسماء').toMatch(/axisPicker\(form\.moduleIds, axes,/)
    expect(SLOT, 'محاور اللقاء القائم أرقام بلا أسماء').toMatch(/axisPicker\(s\.moduleIds \?\? \[\], choices,/)
    expect(SLOT).toMatch(/\{axes\.map\(\(id\) => <option key=\{id\} value=\{id\}>\{axisNameAr\(id\)\}<\/option>\)\}/)
    expect(SLOT, 'عاد المحور رقما وحده').not.toMatch(/>\s*المحور \{axisNo\.get\(id\)\}\s*</)
  })
})

describe('⑤ المهامّ والمصادر بمحاورها', () => {
  const block = stageBlock('assignments', 'approval')

  it('⚠️ المهمّة لا تحفظ بلا محور في شعبة لها مواعيد', () => {
    expect(block).toMatch(/disabled=\{busy \|\| taskForm\.title\.trim\(\)\.length < 3 \|\| \(timelineOn && !taskForm\.moduleId\)\}/)
    expect(block).toContain('aria-label="محور المهمّة"')
  })

  it('⚠️ وآخر موعدها آخر موعد محورها ما لم يكتب غيره — وآخر ذلك اليوم بتوقيت الشعبة', () => {
    expect(block).toMatch(/const auto = !taskForm\.dueAt \|\| \(before && taskForm\.dueAt === before\.endsOn\)/)
    expect(block).toContain('dueAt: auto ? (after?.endsOn ?? "") : taskForm.dueAt')
    expect(WS).toContain('zonedInstant(taskForm.dueAt, [23, 59, 59, 999])')
    expect(WS, 'عاد آخر الموعد منتصف ليل أوّل اليوم بغرينتش').not.toContain('new Date(taskForm.dueAt)')
  })

  it('⚠️ والمصدر يربط بمحوره أو يجعل قراءة مسبقة — والمسجّل ليس هنا', () => {
    /* قائمةٌ مضغوطة (١١ أكتوبر ٢٠٢٦): المحورُ شارةٌ في الصفّ، والقراءةُ المسبقةُ في تعديله */
    const LIST = code('src/pages/trainer/PlanResources.tsx')
    expect(block).toContain('<PlanResources')
    expect(LIST).toContain('aria-label={`محور «${name}»`}')
    expect(LIST).toContain('onPatch(i, { preReading: e.target.checked || null })')
    expect(code('src/application/trainer/resource-list.ts'), 'المسجّل في قائمة المصادر').toContain("filter(({ r }) => resourceCategory(r) !== 'recorded')")
  })
})

describe('المسالك', () => {
  it('⚠️ محاور اللقاء بلا تكرار — وحدّها حجم المدخل لا «محوران» — عند الإنشاء وعند الربط', () => {
    expect(ROUTES).toMatch(/const axesArray = z\.array\([\s\S]{0,80}\.max\(SESSION_AXES_MAX/)
    expect(ROUTES).toMatch(/const uniqueAxes = \(ids: string\[\]\) => new Set\(ids\)\.size === ids\.length/)
    expect(ROUTES).toMatch(/const sessionAxesSchema = axesArray\.refine\(uniqueAxes/)
    expect(ROUTES).toMatch(/const sessionAxesRequired = axesArray\s*\.min\(1,[\s\S]{0,120}\.refine\(uniqueAxes/)
    expect(ROUTES).toContain('moduleIds: sessionAxesSchema.optional()')
    /* والربطُ بعد الإنشاء لا يترك اللقاءَ بلا محور */
    expect(ROUTES).toMatch(/app\.patch\('\/api\/trainer\/sessions\/:sessionId\/axes'[\s\S]{0,400}z\.object\(\{ moduleIds: sessionAxesRequired \}\)\.strict\(\)/)
  })

  it('⚠️ والخطّة تحفظ مواعيدها ومحاور مصادرها — لا يسقطها المخطّط صامتا', () => {
    const plan = ROUTES.slice(ROUTES.indexOf('const planContent = z.object'), ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
    expect(plan).toMatch(/slots: z\.array\(z\.object\(\{/)
    expect(plan).toMatch(/workbook: z\.object\(\{/)
    expect(plan).toMatch(/moduleId: z\.string\(\)\.trim\(\)\.max\(64\)\.nullish\(\)/)
    expect(plan).toMatch(/preReading: z\.boolean\(\)\.nullish\(\)/)
  })
})

describe('والمعتمد يرى المواعيد', () => {
  /* والبطاقةُ صارت مكوّنا تعرضه بطاقةُ الشعبة و«خططٌ تنتظر اعتمادك» معا (٣ أكتوبر ٢٠٢٦) */
  const OPS = code('src/components/admin/TrainerPlanReview.tsx')

  /* المرحلة ٣: صار سطرُ الموعد صفحةَ المنهج كاملة — الصفحةَ نفسَها التي يقرؤها
     المدرّبُ قبل الإرسال. وتواريخُ الموعد ومحاورُه وكرّاستُه بقاعدة الخادم
     (`workbookDone`) يحرسها بناؤها المحضُ في `curriculum-view.test.ts`، وما
     لا مواعيدَ له يُقرأ محورا محورا هناك كذلك. وهنا أنّ البطاقةَ تبنيها فعلا
     من الخطّة **ولقاءاتها ومهامّها** — لا من الخطّة وحدَها. */
  it('⚠️ بطاقة الخطّة تعرض المنهج كاملا — بالخطّة ولقاءاتها ومهامّها', () => {
    expect(OPS).toMatch(/<CurriculumReview\s+view=\{curriculumView\(\{/)
    expect(OPS).toContain('content: trainerPlan.content')
    expect(OPS, 'المنهج بلا لقاءات').toContain('sessions: trainerPlan.sessions')
    expect(OPS, 'المنهج بلا مهامّ').toContain('assessments: trainerPlan.assessments')
  })
})
