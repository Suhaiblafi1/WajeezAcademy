/* ═══ آخرُ المسار على الشاشات — ما اختاره صاحبُ المنصّة (٣ أكتوبر ٢٠٢٦) ═══
 *
 * سار في مسار اعتماد الخطط من «أرسِلها» إلى «مفتوحة للتسجيل» واختار ستّةً من
 * مقترحاتي («1, 2, 3a, 4a, 5a, 6»). وما يقوم منها على الخادم يُحرَس في
 * `server/tests/trainer/last-mile.test.ts`؛ وهذا ما يقوم على الشاشات وقواعدها:
 *
 * ①  نصُّ التسجيل من حال الشعبة — بترتيب الخادم نفسِه، فلا تقول الشاشةُ «مفتوحة»
 *     لما يردّه.
 * ②  «التالي» في بطاقة «شعبي» يتبع حالَ الخطّة.
 * ③أ والشاراتُ الحمراءُ في شروط الفتح تفتح لسانَها، والرابطُ يجلب الشروطَ معه.
 * ④أ «أرسِلها» وفي اليد تعديلٌ لم يُحفظ — يُسأل ولا يُرسَل المحفوظُ صامتا.
 * ⑤أ خبرُ الاعتماد يقول ما وقع، وجرسُ التفعيل يقول الخَتمَ كما وقع.
 * ⑥  بندُ الجرس يفتح خبرَه — والخطّةُ تُفتح مبسوطةً في طابورها.
 *
 * ── ويُقرأ على البنية لا على ورود حرفٍ في ملفّ ──
 *
 * القواعدُ الخالصةُ تُختبَر بمدخلاتها. وما يقوم في شاشةٍ (أيّ دالّةٍ تنادي الإرسال،
 * وما يُمرَّر إلى بوّابته) يُقرأ بمحلّل TypeScript نفسِه — لا بنصٍّ يُطابَق فيمرّ
 * على تعليق. وكلٌّ رُئي ساقطا بنقض ما يحرسه (رسالةُ الالتزام).
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adminRegistrationLine, lineText, registrationState, trainerRegistrationLine,
} from '@/application/learning/registration-state'
import { cohortAcceptsRegistration } from '../../../server/services/registration-window'
import { boardNextStep, sendBlock } from '@/application/trainer/plan-gate'
import { planApprovedTrainerMsg } from '@/application/trainer/plan-decision'
import { finalApprovalBellAr, finalApprovalMail } from '../../../server/services/trainer-decision-mail'
import { notificationHref } from '@/application/notifications/destinations'
import { OPEN_GAP, tabForGap } from '@/application/learning/open-gaps'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/* ─────────── أدواتُ الشجرة ─────────── */

function tree(rel: string): ts.SourceFile {
  return ts.createSourceFile(rel, readFileSync(join(root, rel), 'utf8'), ts.ScriptTarget.Latest, true,
    rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}
function all(node: ts.Node, pred: (n: ts.Node) => boolean): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (n: ts.Node) => { if (pred(n)) out.push(n); ts.forEachChild(n, visit) }
  visit(node)
  return out
}
/** جسمُ الدالّة المسنَدة إلى `const name = …` */
function constFn(sf: ts.SourceFile, name: string): ts.Node {
  const decl = all(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === name)[0] as ts.VariableDeclaration | undefined
  if (!decl?.initializer) throw new Error(`لا دالّةَ باسم ${name} — تغيّر بناءُ الشاشة فتغيّر الحارس`)
  return decl.initializer
}
/** نداءٌ لدالّةٍ باسمها في عقدة */
function callsOf(node: ts.Node, sf: ts.SourceFile, callee: string): ts.CallExpression[] {
  return all(node, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === callee) as ts.CallExpression[]
}
/** أفي هذه العقدة معرّفٌ بهذا الاسم */
function mentions(node: ts.Node, name: string): boolean {
  return all(node, (n) => ts.isIdentifier(n) && n.text === name).length > 0
}
/** اسمُ الدالّة المسنَدة التي تحوي العقدة — أقربُ `const x = (…) => …` */
function enclosingConst(n: ts.Node, sf: ts.SourceFile): string | null {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && p.initializer && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) {
      return p.name.getText(sf)
    }
  }
  return null
}

/* ─────────── ① التسجيل ─────────── */

describe('① نصُّ التسجيل من حال الشعبة — بترتيب الخادم', () => {
  const now = new Date('2026-11-01T10:00:00Z')
  const past = new Date('2026-10-01T10:00:00Z')
  const future = new Date('2026-12-01T10:00:00Z')

  it('«مفتوحة» في الشاشة حيث يقبل الخادمُ وحدَه — على كلّ تركيب', () => {
    for (const registrationOpen of [true, false]) {
      for (const plans of [[], [{ status: 'submitted' }], [{ status: 'approved' }], [{ status: 'superseded' }, { status: 'draft' }]]) {
        for (const joinClosesAt of [null, past, future]) {
          const server = cohortAcceptsRegistration({ registrationOpen, plans, joinClosesAt }, now).open
          const awaitingPlan = plans.length > 0 && !plans.some((p) => ['approved', 'published', 'superseded'].includes(p.status))
          const screen = registrationState({ registrationOpen, awaitingPlan, joinClosesAt }, now) === 'open'
          expect(screen, `علم ${registrationOpen} · خطط ${JSON.stringify(plans)} · التحاق ${joinClosesAt?.toISOString() ?? '—'}`).toBe(server)
        }
      }
    }
  })

  it('شعبةُ الإعداد — علمُها منزول: لا «يُفتح باعتمادك» ولا «مفتوح»، ويُقال أين تُفتح', () => {
    const before = lineText(adminRegistrationLine({ registrationOpen: false, awaitingPlan: true, joinClosesAt: null }, now)!)
    expect(before).toContain('لا يفتحه اعتمادُك')
    expect(before).not.toContain('يُفتح باعتمادك')
    const after = lineText(adminRegistrationLine({ registrationOpen: false, awaitingPlan: false, joinClosesAt: future }, now)!)
    expect(after).toContain('لم تُفتح بعد')
    expect(after).not.toContain('مفتوح')
    expect(after).toContain('«الهُويّة والحالة»')
    const trainer = lineText(trainerRegistrationLine({ registrationOpen: false, awaitingPlan: false, joinClosesAt: future }, now))
    expect(trainer).toContain('لم تُفتح للتسجيل بعد')
    expect(trainer).not.toContain('فُتحت')
  })

  it('والشعبةُ التي رُفع علمُها تبقى على قولها: يُفتح باعتمادك، ثمّ مفتوحٌ حتّى موعدها الثاني', () => {
    expect(lineText(adminRegistrationLine({ registrationOpen: true, awaitingPlan: true, joinClosesAt: null }, now)!))
      .toContain('يُفتح باعتمادك')
    const open = adminRegistrationLine({ registrationOpen: true, awaitingPlan: false, joinClosesAt: future }, now)!
    expect(open.lead).toContain('الالتحاقُ مفتوحٌ حتّى')
    expect(open.date).toBeTruthy()
  })
})

/* ─────────── ② «التالي» ─────────── */

describe('② «التالي» في بطاقة «شعبي» يتبع حالَ الخطّة', () => {
  const checklist = [
    { key: 'identity', labelAr: 'المعلوماتُ الأساسيّة', done: true, optional: false },
    { key: 'approval', labelAr: 'أكّد أنّك توافق على كلّ ما فيها وأرسلها للاعتماد', done: false, optional: false },
  ]
  it('أُرسلت: انتظارٌ لا «أرسلها»', () => {
    const n = boardNextStep({ planStatus: 'submitted', registrationOpen: false, checklist })
    expect(n).toMatchObject({ key: 'awaiting_decision', waiting: true })
    expect(n!.labelAr).not.toContain('أرسلها')
  })
  it('رُدّت: الملاحظةُ لا «أرسلها»', () => {
    expect(boardNextStep({ planStatus: 'changes_requested', registrationOpen: false, checklist }))
      .toMatchObject({ key: 'address_notes' })
  })
  it('اعتُمدت والشعبةُ مغلقة: تفتحها الأكاديمية — ومفتوحة: لا شيء', () => {
    const done = checklist.map((c) => ({ ...c, done: true }))
    expect(boardNextStep({ planStatus: 'approved', registrationOpen: false, checklist: done }))
      .toMatchObject({ key: 'awaiting_open', waiting: true })
    expect(boardNextStep({ planStatus: 'approved', registrationOpen: true, checklist: done })).toBeNull()
  })
  it('مسودّة: ما يحجب الإرسالَ أوّلا، كما كان', () => {
    const draft = [{ key: 'modules', labelAr: 'المحاور', done: false, optional: false }, ...checklist]
    expect(boardNextStep({ planStatus: 'draft', registrationOpen: false, checklist: draft })).toMatchObject({ key: 'modules' })
  })
})

/* ─────────── ③أ شروطُ الفتح ─────────── */

describe('③أ شروطُ الفتح تقول أين تُوفى — ويجلبها الرابطُ معه', () => {
  it('السعةُ والمالُ في «التسجيل والمال»، والجدولُ في «الجدول واللقاءات»', () => {
    expect(tabForGap(OPEN_GAP.capacity)).toBe('enrollment')
    expect(tabForGap(OPEN_GAP.financial)).toBe('enrollment')
    expect(tabForGap(OPEN_GAP.schedule)).toBe('schedule')
    expect(tabForGap('خطّةُ المدرّب لم تُعتمَد بعد')).toBeNull()
  })

  it('الرابطُ إلى شعبةٍ (`?cohort=`) يجلب شروطَ فتحها — لا يبسطها على دوّامة', () => {
    const sf = tree('src/pages/admin/AdminCohorts.tsx')
    const load = constFn(sf, 'load')
    const deepLink = all(load, (n) => ts.isIfStatement(n) && n.expression.getText(sf) === 'row')[0] as ts.IfStatement | undefined
    expect(deepLink, 'لا فرعَ للرابط في `load`').toBeTruthy()
    const fetches = all(deepLink!.thenStatement, (n) => ts.isCallExpression(n) && /open-checklist/.test(n.arguments[0]?.getText(sf) ?? ''))
    expect(fetches.length, 'الرابطُ يبسط البطاقةَ ولا يجلب شروطَها').toBeGreaterThan(0)
  })

  it('و«افتح الشعبة» يقول ردَّه بجانبه — بابُه `openCohort` لا `act` العامّ', () => {
    const sf = tree('src/pages/admin/AdminCohorts.tsx')
    const openBtn = all(sf, (n) => ts.isJsxElement(n) && n.getText(sf).includes('افتح الشعبة') && ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'Button')[0] as ts.JsxElement | undefined
    expect(openBtn).toBeTruthy()
    const onClick = openBtn!.openingElement.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'onClick')
    expect(onClick && mentions(onClick, 'openCohort'), 'زرُّ الفتح يمرّ بـ`act` فيُقال ردُّه أعلى الصفحة وحدَها').toBe(true)
    expect(callsOf(constFn(sf, 'openCohort'), sf, 'setOpenError').length).toBeGreaterThan(0)
  })
})

/* ─────────── ④أ الإرسالُ مع تعديلٍ لم يُحفظ ─────────── */

describe('④أ «أرسِلها» وفي اليد تعديلٌ لم يُحفظ', () => {
  it('الترتيب: الموافقةُ، ثمّ التعديلُ الذي لم يُحفظ — قبل النواقص، فقد يوفيها', () => {
    expect(sendBlock({ confirmed: false, unsaved: true, blocking: 2 })).toBe('confirm')
    expect(sendBlock({ confirmed: true, unsaved: true, blocking: 2 })).toBe('unsaved')
    expect(sendBlock({ confirmed: true, unsaved: false, blocking: 2 })).toBe('blocking')
    expect(sendBlock({ confirmed: true, unsaved: false, blocking: 0 })).toBeNull()
  })

  const sf = tree('src/pages/trainer/CohortWorkspace.tsx')

  it('«أرسِلها» يسأل البوّابةَ بما في اليد فعلا — `dirty` لا قيمةٌ ثابتة', () => {
    const submit = constFn(sf, 'submitNow')
    const gate = callsOf(submit, sf, 'sendBlock')[0]
    expect(gate, '«أرسِلها» لا يسأل البوّابة').toBeTruthy()
    const arg = gate!.arguments[0]
    const unsaved = arg && ts.isObjectLiteralExpression(arg)
      ? arg.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'unsaved')
      : undefined
    expect(unsaved && mentions(unsaved.initializer, 'dirty'), 'التعديلُ غيرُ المحفوظ لا يصل البوّابة').toBe(true)
    /* وجوابُ «unsaved» يقف ويسأل — لا يمضي إلى الإرسال */
    const stopOnUnsaved = all(submit, (n) => ts.isIfStatement(n)
      && all(n.expression, (x) => ts.isStringLiteral(x) && x.text === 'unsaved').length > 0
      && all(n.thenStatement, (x) => ts.isReturnStatement(x)).length > 0
      && callsOf(n.thenStatement, sf, 'setUnsavedAsk').length > 0)
    expect(stopOnUnsaved.length, 'التعديلُ غيرُ المحفوظ لا يقف الإرسال').toBe(1)
  })

  it('ولا يُرسَل إلّا من الأبواب الثلاثة — و«احفظ وأرسِل» يحفظ قبل أن يرسل', () => {
    const sends = all(sf, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === 'apiPost'
      && /\/plan\/submit/.test(n.arguments[0]?.getText(sf) ?? '')) as ts.CallExpression[]
    expect(sends.length).toBeGreaterThan(0)
    for (const s of sends) {
      expect(['submitNow', 'saveThenSend', 'sendSaved'], `إرسالٌ من غير بابه في ${enclosingConst(s, sf)}`)
        .toContain(enclosingConst(s, sf))
    }
    const saveThenSend = constFn(sf, 'saveThenSend')
    const persist = callsOf(saveThenSend, sf, 'persist')[0]
    const send = sends.find((s) => enclosingConst(s, sf) === 'saveThenSend')
    expect(persist && send && persist.getStart(sf) < send.getStart(sf), '«احفظ وأرسِل» يرسل ولم يحفظ').toBe(true)
  })
})

/* ─────────── ⑤أ والأخبار ─────────── */

describe('⑤أ خبرُ الاعتماد يقول ما وقع — والتفعيلُ بخَتمه', () => {
  const base = { cohortTitle: 'شعبةُ التجربة', qualifiedCourseAr: null, meetingsApproved: 0, meetingsFailed: 0, tasksApplied: 0 }

  it('شعبةٌ علمُها منزول: لا «بمن التحق فيها» ولا «وصلت المسجَّلين»', () => {
    const m = planApprovedTrainerMsg({ ...base, registrationOpen: false, meetingsApproved: 4 })
    expect(m.body).toContain('لم تُفتح للتسجيل بعد')
    expect(m.body).toContain('لقاءاتُك (4)')
    expect(m.body).not.toMatch(/التحق|المسجَّلين/)
    expect(m.heading).not.toContain('جاهزةٌ الآن')
  })

  it('ومفتوحة: كما كانت — بمن التحق، ولقاؤها الواحدُ بمفرده', () => {
    const m = planApprovedTrainerMsg({ ...base, registrationOpen: true, meetingsApproved: 1 })
    expect(m.body).toContain('بمن التحق فيها')
    expect(m.body).toContain('واعتُمد معها لقاؤك ووصل المسجَّلين')
  })

  it('والتأهيلُ في الخبر نفسِه — وكلمةُ المعتمِد تُضاف ولا تمحو الخبر', () => {
    const m = planApprovedTrainerMsg({ ...base, registrationOpen: false, qualifiedCourseAr: 'دورةُ الإعداد', noteAr: 'أحسنت' })
    expect(m.body.startsWith('أُضيفت «دورةُ الإعداد» إلى دوراتك.')).toBe(true)
    expect(m.body).toContain('وكلمةُ الإدارة: أحسنت')
    expect(m.body).toContain('لم تُفتح للتسجيل بعد')
  })

  it('وجرسُ التفعيل بالخَتم كما وقع — والبريدُ لا يَعِد بنشرٍ ولا فتحٍ لم يقعا', () => {
    expect(finalApprovalBellAr('now')).toContain('وقّعنا العقدَ من جهتنا')
    expect(finalApprovalBellAr('earlier')).not.toContain('وقّعنا')
    expect(finalApprovalBellAr('none')).not.toContain('العقد')
    const mail = JSON.stringify(finalApprovalMail({
      fullName: 'مدرّب', reference: 'R-1', approvedCoursesAr: ['دورة'], sealed: 'now',
      contractUrl: 'https://x/c', portalUrl: 'https://x/p', approvedOnAr: '3 أكتوبر 2026',
    }).doc)
    expect(mail).not.toContain('يُنشَر ملفُّك')
    expect(mail).toContain('حين نعتمد نشرَه')
    expect(mail).toContain('حين تفتحها الأكاديمية')
  })
})

/* ─────────── ⑥ الجرس ─────────── */

describe('⑥ بندُ الجرس يفتح خبرَه', () => {
  it('خطّةٌ أُرسلت تُفتح مبسوطةً في طابورها — بشعبتها من بيانات الإشعار', () => {
    expect(notificationHref('cohort.plan.submitted', 'staff', { cohortId: 'abc', planId: 'p1' }))
      .toBe('/admin/pending-plans?cohort=abc')
    expect(notificationHref('cohort.plan.submitted', 'staff', {})).toBe('/admin/pending-plans')
    expect(notificationHref('trainer.activated', 'trainer', { contract: true })).toBe('/trainer')
    expect(notificationHref('لا مفتاح', 'staff', {})).toBeNull()
  })

  it('والنقرُ يفتح وجهتَه — `openItem` يسأل `notificationHref` ثمّ ينتقل', () => {
    const sf = tree('src/components/NotificationBell.tsx')
    const openItem = constFn(sf, 'openItem')
    expect(callsOf(openItem, sf, 'notificationHref').length).toBe(1)
    expect(callsOf(openItem, sf, 'navigate').length).toBe(1)
    const itemButtons = all(sf, (n) => ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'button'
      && n.openingElement.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'key')) as ts.JsxElement[]
    expect(itemButtons.length).toBe(1)
    const onClick = itemButtons[0]!.openingElement.attributes.properties
      .find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'onClick')
    expect(onClick && mentions(onClick, 'openItem'), 'بندُ الجرس يُعلَّم مقروءا ولا يُفتح').toBe(true)
  })
})

/* ─────────── ③أ اللوحُ بعد الاعتماد الأخير ─────────── */

describe('③أ لوحُ «ما بقي عليك» يظهر حيث فُعِّل', () => {
  it('يُعرض بعد اعتمادٍ فعّل مدرّبَه — وبه وحدَه', () => {
    const sf = tree('src/components/admin/TrainerPlanReview.tsx')
    const shown = all(sf, (n) => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && n.left.getText(sf) === 'activated' && /TrainerNextSteps/.test(n.right.getText(sf)))
    expect(shown.length, 'اللوحُ لا يُعرض أو يُعرض بلا شرط').toBe(1)
    const raised = all(sf, (n) => ts.isIfStatement(n) && /prep\?\.activated/.test(n.expression.getText(sf))
      && callsOf(n.thenStatement, sf, 'setActivated').length > 0)
    expect(raised.length, 'لا يُرفع اللوحُ بتفعيل المدرّب').toBe(1)
  })
})
