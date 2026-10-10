/* تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦).
   الفحصُ لحظةَ الرفع، ولقطةُ «قبل»، والتطبيقُ بلا مساسٍ بالأصل، وما يُعرض للمدرّب. */

import { describe, expect, it } from 'vitest'
import {
  applyContentEdit, contentBefore, planEditStep, planEditView, rowEditProblem, sameSnapshot,
  sessionSnapshot, suggestedEditsLineAr, taskSnapshot, type EditableContent, type PlanEdit,
} from '@/application/trainer/plan-edits'

const plan = (): EditableContent => ({
  summaryAr: 'نبذة',
  liveNoteAr: null,
  modules: [
    { moduleId: 'M1', titleAr: 'الجمهور', outcomeAr: 'يحلّل', artifactAr: 'خريطة' },
    { moduleId: 'M2', titleAr: 'الرسالة', outcomeAr: 'يصوغ', artifactAr: null },
  ],
  resources: [
    { title: 'CIPR', url: 'https://cipr.co.uk/a', category: 'public', kind: 'link', moduleId: 'M1' },
    { title: 'كتابٌ عامّ', url: null, category: 'reading', kind: 'book' },
  ],
})

describe('الخطوةُ التي يقع فيها التعديل', () => {
  it('المحورُ في «المحاور»، والمصادرُ والمهامُّ في «المهامّ والمصادر»، واللقاءاتُ في «اللقاءات»', () => {
    expect(planEditStep({ kind: 'module', moduleId: 'M1', set: { artifactAr: 'x' } })).toBe('modules')
    expect(planEditStep({ kind: 'resource_add', resource: { title: 'مصدر' } })).toBe('assignments')
    expect(planEditStep({ kind: 'task_change', assessmentId: 'a', set: { dueAt: null } })).toBe('assignments')
    expect(planEditStep({ kind: 'session_move', sessionId: 's', startsAt: 'x', endsAt: 'y' })).toBe('sessions')
    expect(planEditStep({ kind: 'plan', set: { summaryAr: 'x' } })).toBe('identity')
    expect(planEditStep({ kind: 'plan', set: { liveNoteAr: 'x' } })).toBe('sessions')
  })
})

describe('الفحصُ لحظةَ الرفع — ولقطةُ «قبل»', () => {
  it('حقلُ المحور: لقطتُه ما فيه الآن، والفارغُ «لم يُكتب»', () => {
    const r = contentBefore({ kind: 'module', moduleId: 'M2', set: { artifactAr: 'صفحةٌ واحدة', outcomeAr: 'يكتب' } }, plan())
    expect(r).toEqual({ ok: true, value: { artifactAr: null, outcomeAr: 'يصوغ' } })
  })

  it('⚠️ محورٌ ليس في الخطّة، أو حقلٌ ليس من حقوله، أو عنوانٌ يُمحى — يُردّ بسببه', () => {
    expect(contentBefore({ kind: 'module', moduleId: 'M9', set: { artifactAr: 'x' } }, plan())).toMatchObject({ ok: false, problemAr: expect.stringContaining('M9') })
    expect(contentBefore({ kind: 'module', moduleId: 'M1', set: { bodyFileKey: 'k' } as never }, plan())).toMatchObject({ ok: false })
    expect(contentBefore({ kind: 'module', moduleId: 'M1', set: { titleAr: '' } }, plan())).toMatchObject({ ok: false })
    expect(contentBefore({ kind: 'module', moduleId: 'M1', set: {} }, plan())).toMatchObject({ ok: false })
  })

  it('⚠️ والحدودُ حدودُ حفظ المدرّب: مُسلَّمٌ أطولُ من ألف حرفٍ لا يُقترح', () => {
    expect(contentBefore({ kind: 'module', moduleId: 'M1', set: { artifactAr: 'ب'.repeat(1001) } }, plan())).toMatchObject({ ok: false })
    expect(contentBefore({ kind: 'module', moduleId: 'M1', set: { artifactAr: 'ب'.repeat(1000) } }, plan())).toMatchObject({ ok: true })
  })

  it('⚠️ مصدرٌ جديد: لا يُكرَّر ما في الخطّة، ولا رابطَ بلا http، ولا محورَ مجهول', () => {
    const p = plan()
    expect(contentBefore({ kind: 'resource_add', resource: { title: 'CIPR', url: 'https://cipr.co.uk/a', moduleId: 'M1' } }, p))
      .toMatchObject({ ok: false, problemAr: expect.stringContaining('فعلا') })
    expect(contentBefore({ kind: 'resource_add', resource: { title: 'مقال', url: 'hbrarabic.com/x' } }, p)).toMatchObject({ ok: false })
    expect(contentBefore({ kind: 'resource_add', resource: { title: 'مقال', url: 'https://x.com', moduleId: 'M7' } }, p)).toMatchObject({ ok: false })
    expect(contentBefore({ kind: 'resource_add', resource: { title: 'مقال', url: 'https://x.com', moduleId: 'M2' } }, p)).toEqual({ ok: true, value: null })
  })

  it('⚠️ والمصدرُ الذي يُعدَّل يُعرف بعنوانه ورابطه — ولا يُخمَّن بين اثنين', () => {
    const p = plan()
    expect(contentBefore({ kind: 'resource_change', match: { title: 'CIPR', url: 'https://cipr.co.uk/a' }, set: { moduleId: 'M2' } }, p))
      .toMatchObject({ ok: true, value: { title: 'CIPR', moduleId: 'M1' } })
    expect(contentBefore({ kind: 'resource_change', match: { title: 'CIPR', url: 'https://other' }, set: { moduleId: 'M2' } }, p))
      .toMatchObject({ ok: false })
    p.resources.push({ title: 'CIPR', url: 'https://cipr.co.uk/a', moduleId: 'M2' })
    expect(contentBefore({ kind: 'resource_remove', match: { title: 'CIPR', url: 'https://cipr.co.uk/a' } }, p))
      .toMatchObject({ ok: false, problemAr: expect.stringContaining('أكثرُ من مصدر') })
    expect(contentBefore({ kind: 'resource_remove', match: { title: 'CIPR', url: 'https://cipr.co.uk/a', moduleId: 'M2' } }, p))
      .toMatchObject({ ok: true })
  })
})

describe('التطبيق — لا يمسّ الأصل', () => {
  it('حقلُ المحور يُكتب في محوره وحدَه', () => {
    const p = plan()
    const r = applyContentEdit(p, { kind: 'module', moduleId: 'M2', set: { artifactAr: 'صفحة' } })
    expect(r.ok && r.value.modules[1].artifactAr).toBe('صفحة')
    expect(r.ok && r.value.modules[0].artifactAr).toBe('خريطة')
    expect(p.modules[1].artifactAr, 'الأصلُ كما هو').toBeNull()
  })

  it('المصدرُ الجديدُ يُحفظ كما تكتبه شاشةُ المدرّب: صنفُه صريح، ونوعُه منه', () => {
    const r = applyContentEdit(plan(), { kind: 'resource_add', resource: { title: ' مقال ', url: 'https://x.com', moduleId: 'M2' } })
    expect(r.ok && r.value.resources.at(-1)).toEqual({ title: 'مقال', url: 'https://x.com', category: 'public', kind: 'link', moduleId: 'M2' })
  })

  it('وتعديلُ المصدر وحذفُه يقعان على المقصود وحدَه', () => {
    const changed = applyContentEdit(plan(), { kind: 'resource_change', match: { title: 'CIPR', url: 'https://cipr.co.uk/a' }, set: { url: 'https://cipr.co.uk/b' } })
    expect(changed.ok && changed.value.resources.map((r) => r.url)).toEqual(['https://cipr.co.uk/b', null])
    const removed = applyContentEdit(plan(), { kind: 'resource_remove', match: { title: 'كتابٌ عامّ', url: null } })
    expect(removed.ok && removed.value.resources.map((r) => r.title)).toEqual(['CIPR'])
  })

  it('والصنفُ إن تغيّر تبعه نوعُه', () => {
    const r = applyContentEdit(plan(), { kind: 'resource_change', match: { title: 'CIPR', url: 'https://cipr.co.uk/a' }, set: { category: 'reading' } })
    expect(r.ok && r.value.resources[0]).toMatchObject({ category: 'reading', kind: 'book' })
  })

  it('⚠️ وما لا يقع يُردّ بسببه — لا يُطبَّق نصفا', () => {
    expect(applyContentEdit(plan(), { kind: 'module', moduleId: 'M9', set: { artifactAr: 'x' } })).toMatchObject({ ok: false })
    expect(applyContentEdit(plan(), { kind: 'task_add', task: { title: 'مهمّة', type: 'assignment' } })).toMatchObject({ ok: false })
  })
})

describe('أتغيّر الموضعُ منذ الاقتراح؟', () => {
  it('الفارغُ والغائبُ سواء، والترتيبُ لا يهمّ', () => {
    expect(sameSnapshot({ a: null, b: 'x' }, { b: 'x', a: '' })).toBe(true)
    expect(sameSnapshot(null, null)).toBe(true)
  })

  it('⚠️ وما كتبه المدرّبُ بيده بعد الرفع تغييرٌ يُرى', () => {
    expect(sameSnapshot({ artifactAr: null }, { artifactAr: 'كتبتُه أنا' })).toBe(false)
    expect(sameSnapshot(null, { a: 1 })).toBe(false)
  })

  it('والموعدُ يُقارَن لحظةً لا نصّا', () => {
    const at = new Date('2026-12-07T20:59:59.999Z')
    expect(sameSnapshot(taskSnapshot({ dueAt: at }, ['dueAt']), { dueAt: '2026-12-07T20:59:59.999Z' })).toBe(true)
    expect(sameSnapshot(sessionSnapshot({ startsAt: at, endsAt: null }), { startsAt: '2026-12-07T20:59:59.999+00:00', endsAt: null })).toBe(true)
    expect(sameSnapshot({ dueAt: '2026-12-07T20:59:59.999Z' }, { dueAt: '2026-12-08T20:59:59.999Z' })).toBe(false)
  })
})

describe('المهامُّ واللقاءات — ما يُعرف من الخطّة', () => {
  it('⚠️ مهمّةٌ لمحورٍ مجهول، أو بنوعٍ مخترَع، أو بموعدٍ لا يُقرأ — تُردّ', () => {
    const p = plan()
    expect(rowEditProblem({ kind: 'task_add', task: { title: 'خطّة الأمان', type: 'assignment', moduleId: 'M9' } }, p)).toMatch(/M9/)
    expect(rowEditProblem({ kind: 'task_add', task: { title: 'خطّة الأمان', type: 'essay' as never } }, p)).toMatch(/نوع/)
    expect(rowEditProblem({ kind: 'task_change', assessmentId: 'a', set: { dueAt: 'غدا' } }, p)).toMatch(/لحظة/)
    expect(rowEditProblem({ kind: 'task_change', assessmentId: 'a', set: {} }, p)).not.toBeNull()
    expect(rowEditProblem({ kind: 'task_add', task: { title: 'خطّة الأمان', type: 'assignment', moduleId: 'M2', dueAt: '2026-12-09T21:59:00.000Z' } }, p)).toBeNull()
  })

  it('⚠️ ولقاءٌ ينتهي قبل أن يبدأ لا يُقترح', () => {
    expect(rowEditProblem({ kind: 'session_move', sessionId: 's', startsAt: '2026-12-05T16:00:00.000Z', endsAt: '2026-12-05T15:00:00.000Z' }, plan())).not.toBeNull()
    expect(rowEditProblem({ kind: 'session_move', sessionId: 's', startsAt: '2026-12-05T16:00:00.000Z', endsAt: '2026-12-05T18:00:00.000Z' }, plan())).toBeNull()
  })
})

describe('ما يراه المدرّب', () => {
  const ctx = { moduleIds: ['M1', 'M2'], taskTitle: () => 'الواجب الأوّل', sessionTitle: () => 'اللقاء الثاني' }

  it('حقلٌ واحدٌ في محور: «المحور 2 — ما يسلّمه المتعلّم»، قبله فارغٌ وبعده النصّ', () => {
    const edit: PlanEdit = { kind: 'module', moduleId: 'M2', set: { artifactAr: 'صفحةٌ واحدة' } }
    const v = planEditView(edit, { artifactAr: null }, ctx)
    expect(v.titleAr).toBe('المحور 2 — ما يسلّمه المتعلّم')
    expect(v.stepAr).toBe('المحاور ومواعيدها')
    expect(v.rows).toEqual([{ labelAr: 'ما يسلّمه المتعلّم', beforeAr: null, afterAr: 'صفحةٌ واحدة', long: true }])
  })

  it('مصدرٌ جديد: لمحوره برقمه، وصنفُه باسمه', () => {
    const v = planEditView({ kind: 'resource_add', resource: { title: 'مقال', url: 'https://x.com', moduleId: 'M2' } }, null, ctx)
    expect(v.titleAr).toBe('مصدرٌ جديدٌ للمحور 2')
    expect(v.rows.find((r) => r.labelAr === 'الصنف')?.afterAr).toBe('فيديوهاتٌ وروابطُ عامّة')
    expect(v.rows.every((r) => r.beforeAr === null)).toBe(true)
  })

  it('نقلُ لقاء: الموعدُ قبلُ وبعدُ بتوقيت عمّان', () => {
    const v = planEditView(
      { kind: 'session_move', sessionId: 's', startsAt: '2026-12-05T16:00:00.000Z', endsAt: '2026-12-05T18:00:00.000Z' },
      { startsAt: '2026-12-01T13:00:00.000Z', endsAt: '2026-12-01T15:00:00.000Z' }, ctx,
    )
    expect(v.titleAr).toBe('نقلُ لقاء: «اللقاء الثاني»')
    expect(v.rows[0].afterAr).toBe('السبت، 5 ديسمبر في 7:00 م حتّى 9:00 م')
    expect(v.rows[0].beforeAr).toBe('الثلاثاء، 1 ديسمبر في 4:00 م حتّى 6:00 م')
  })

  it('⚠️ والرابطُ العربيُّ يُقرأ بحروفه لا مرمَّزا — ويُفتح بأصله', () => {
    const url = 'https://hbrarabic.com/%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84/'
    const v = planEditView({ kind: 'resource_add', resource: { title: 'مقال', url, moduleId: 'M1' } }, null, ctx)
    const row = v.rows.find((r) => r.labelAr === 'الرابط')!
    expect(row.afterAr).toBe('https://hbrarabic.com/التواصل/')
    expect(row.afterHref).toBe(url)
    expect(row.beforeHref).toBeUndefined()
  })

  it('ومحورُ المصدر يُقرأ برقمه في «قبل» و«بعد»', () => {
    const v = planEditView({ kind: 'resource_change', match: { title: 'CIPR', url: 'https://cipr.co.uk/a' }, set: { moduleId: 'M2' } }, { moduleId: 'M1' }, ctx)
    expect(v.rows).toEqual([{ labelAr: 'المحور', beforeAr: 'المحور 1', afterAr: 'المحور 2' }])
  })
})

describe('سطرُ رسالة القرار', () => {
  it('بلا تعديلاتٍ لا سطر', () => {
    expect(suggestedEditsLineAr(0, 0)).toBeNull()
  })

  it('العددُ بصيغته، والمطلوبُ منه يُسمّى', () => {
    expect(suggestedEditsLineAr(1, 1)).toMatch(/^واقترحنا على خطّتك تعديلًا واحدا \(مطلوب\)/)
    expect(suggestedEditsLineAr(2, 0)).toMatch(/تعديلَين،/)
    expect(suggestedEditsLineAr(7, 2)).toMatch(/7 تعديلات \(منها اثنان مطلوبان\)/)
    expect(suggestedEditsLineAr(12, 12)).toMatch(/12 تعديلًا \(كلُّها مطلوبة\)/)
  })

  it('⚠️ ويقول إنّه يقبل أو يرفض — ولا يأمر', () => {
    const s = suggestedEditsLineAr(3, 1)!
    expect(s).toContain('فتقبله أو ترفضه')
    expect(s).not.toMatch(/عرضك|اقبلها الآن|وقّع/)
  })
})
