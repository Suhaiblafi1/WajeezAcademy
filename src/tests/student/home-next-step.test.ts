/* الرئيسيّةُ تفتح على «خطوتك التالية» عبر الدورات (٢٧ أكتوبر ٢٠٢٦، «C both»).

     ① أيُّ دورةٍ تُقدَّم: الأشدُّ إلحاحا، وفي النوع الواحد الأقربُ موعدا
     ② والخطوةُ من حساب صفحة الدورة نفسِه — لا تحسبها الرئيسيّةُ لنفسها
     ③ وما تقوله البطاقةُ لا يُعاد في «ما عليك الآن» تحتها
     ④ وزرُّها في الرئيسيّة يقود إلى صفحة الدورة — لا زرَّ ميّتا ينتظر محطّاتٍ ليست هنا */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { pickNextStep } from '@/application/student/enrollment-step'
import type { NextStep } from '@/application/student/stage-path'
import NextStepCard from '@/components/journey/NextStepCard'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

const c = (name: string, step: NextStep | null) => ({ name, step })

describe('① أيّ دورة تقدّم خطوتها', () => {
  it('⚠️ الأشدّ إلحاحا: جلسة الآن قبل تسليم، وتسليم قبل قراءة', () => {
    const read = c('قراءة', { kind: 'read', moduleId: 'M', title: 't', stopKey: null })
    const submit = c('تسليم', { kind: 'submit', assessmentId: 'A', title: 't', dueAt: null, stopKey: null })
    const live = c('الآن', { kind: 'live', sessionId: 'S', title: 't' })
    expect(pickNextStep([read, submit])?.name).toBe('تسليم')
    expect(pickNextStep([read, submit, live])?.name).toBe('الآن')
  })

  it('⚠️ وفي النوع الواحد الأقرب موعدا — وما لا موعد له بعد ما له موعد', () => {
    const late = c('بعيد', { kind: 'submit', assessmentId: 'A', title: 't', dueAt: '2026-11-20T00:00:00Z', stopKey: null })
    const soon = c('قريب', { kind: 'submit', assessmentId: 'B', title: 't', dueAt: '2026-11-02T00:00:00Z', stopKey: null })
    const none = c('بلا موعد', { kind: 'submit', assessmentId: 'C', title: 't', dueAt: null, stopKey: null })
    expect(pickNextStep([none, late, soon])?.name).toBe('قريب')
  })

  it('ودورة بلا خطوة لا تختار — وبلا خطوات: لا شيء', () => {
    const wait = c('تفتح', { kind: 'wait', title: 't', opensAt: null, stopKey: 'slot-1' })
    expect(pickNextStep([c('لا شيء', null), wait])?.name).toBe('تفتح')
    expect(pickNextStep([c('لا شيء', null)])).toBeNull()
  })
})

describe('② ③ الرئيسيّة تقرأ الحساب نفسه ولا تكرّر', () => {
  const home = code('src/pages/student/Dashboard.tsx')
  it('⚠️ الخطوة من `enrollmentStep` — حساب صفحة الدورة نفسه', () => {
    expect(home).toMatch(/enrollmentStep\(full, cohortModules\(/)
    expect(home).toMatch(/pickNextStep\(steps\)/)
    expect(home).toContain('<NextStepCard')
  })
  it('⚠️ وما تقوله البطاقة لا يعاد تحتها — مهمّتها ولقاؤها الجاري', () => {
    expect(home).toMatch(/hideAssessmentIds=\{heroTaskIds\}/)
    expect(home).toMatch(/todaySessions\.filter\(\(s\) => s\.id !== heroSessionId\)/)
    const list = code('src/components/MyDeadlines.tsx')
    expect(list, 'القائمة لا تسقط ما أُخفي').toMatch(/filter\(\(d\) => !hideAssessmentIds\.includes\(d\.assessmentId\)\)/)
  })
})

describe('④ زرّ البطاقة في الرئيسيّة', () => {
  const render = (onReveal?: () => void) =>
    renderToStaticMarkup(createElement(MemoryRouter, null, createElement(NextStepCard, {
      step: { kind: 'submit', assessmentId: 'A', title: 'بطاقة الفكرة', dueAt: null, stopKey: 'slot-0' },
      sessions: [], courseId: 'C-1', enrollmentId: 'e-1', courseTitleAr: 'دورة الخطابة', onReveal,
    })))

  it('⚠️ بلا محطّات تحته: رابط إلى صفحة الدورة على مرحلتها، ومعه اسم الدورة', () => {
    const html = render()
    expect(html).toContain('href="/student/learning?stage=C-1"')
    expect(html).toContain('دورة الخطابة')
    expect(html).not.toContain('<button')
  })
  it('وفي صفحة الدورة: زرّ يفتح المحطّة في مكانه', () => {
    const html = render(() => undefined)
    expect(html).toContain('<button')
    expect(html).not.toContain('/student/learning?stage=')
  })
})
