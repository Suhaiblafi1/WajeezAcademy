/* ورشةُ الشعبة — ملكُ مدرّبها، والسعرُ ليس منها.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): يعدّل كلَّ شيءٍ عدا السعر، ويقول
   «أوافق» ويرسلها، والإدارةُ تعتمد. و«اقتراحاتي» تُحذف: «ليس اقتراحا بل واجبٌ
   عليه». والفحصُ على البنية: الشيفرةُ بلا تعليقاتها. */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const WS = 'src/pages/trainer/CohortWorkspace.tsx'

describe('ورشةُ الشعبة', () => {
  it('لها مسارٌ يبلغها من «شعبي» — لا تحويلَ إلى الرئيسيّة', () => {
    const app = code('src/App.tsx')
    expect(app).toMatch(/path="\/trainer\/cohort\/:id" element=\{<CohortWorkspace \/>\}/)
    expect(code('src/pages/trainer/CohortBoard.tsx')).toContain('/trainer/cohort/${c.id}')
  })

  it('تقول ما بقي عليه، وتُرسَل بتأكيدٍ لا بضغطة', () => {
    const ws = code(WS)
    expect(ws, 'لا قائمةَ «ماذا أفعل»').toContain('ws.checklist.map')
    expect(ws, 'الإرسالُ بلا إقرار').toMatch(/checked=\{confirm\}/)
    expect(ws).toContain('/plan/submit')
  })

  /* ═══ والسعرُ لا يُكتب — ولم يعد يُعرَض في الخطوة الأولى (٢٧ سبتمبر ٢٠٢٦) ═══

     كان يُقرأ في لوحة الهُويّة بسطرٍ يقول «السعرُ والسعةُ بيد الإدارة». وقال
     صاحبُ المنصّة عن الخطوة الأولى: «ولا داعيَ لوجود السعر هناك، وأهمُّها
     موعدُ الشعبة كاملا من — إلى». فالمحروسُ الأصليُّ باقٍ بنصّه — **لا يكتبه
     المدرّب**: لا حقلَ ولا مفتاحَ في حمولة التعديل، والخادمُ يردّه باسمه —
     وزاد عليه: لا يُعرَض في درجة المعلومات الأساسيّة. */
  it('والسعرُ لا يُكتب ولا يُعرَض في الخطوة الأولى — والخادمُ يردّه باسمه', () => {
    const ws = code(WS)
    expect(ws, 'حقلُ إدخالٍ للسعر في ورشة المدرّب').not.toMatch(/<(input|select)[^>]*\bprice\b/i)
    const patch = /apiPatch\(`\/api\/trainer\/cohorts\/\$\{ws\.cohort\.id\}`, \{[\s\S]*?\}\)/.exec(ws)?.[0] ?? ''
    expect(patch, 'حمولةُ التعديل مفقودة').toBeTruthy()
    expect(patch, 'السعرُ يُرسَل في تعديل المدرّب').not.toMatch(/\bprice\b|\bcurrency\b|\bcapacity\b/)
    const step = ws.slice(ws.indexOf('stage === "identity" &&'), ws.indexOf('stage === "modules" &&'))
    expect(step, 'لا درجةَ للمعلومات الأساسيّة').toBeTruthy()
    expect(step, 'عاد السعرُ إلى الخطوة الأولى').not.toMatch(/readOnly\.price|السعرُ والسعةُ/)
    const svc = code('server/services/cohort-plan.service.ts')
    expect(svc, 'الخدمةُ لا تردّ الحقلَ الماليَّ باسمه').toContain("'price', 'currency', 'capacity', 'registrationOpen', 'financialReady'")
  })

  it('و«اقتراحاتي» حُذفت من الصفحات والقائمة — والمسارُ القديم يحوّل إلى «شعبي»', () => {
    expect(existsSync(join(root, 'src/pages/trainer/Proposals.tsx'))).toBe(false)
    expect(code('src/pages/trainer/TrainerLayout.tsx')).not.toContain('/trainer/proposals')
    expect(code('src/App.tsx')).toMatch(/path="\/trainer\/proposals" element=\{<Navigate to="\/trainer\/board"/)
  })

  it('والإدارةُ تعتمد من بطاقة الشعبة — لمن يملك الاعتماد', () => {
    /* والاعتمادُ في مراجعة الخطّة — مكوّنٌ تعرضه البطاقةُ و«خططٌ تنتظر اعتمادك» معا */
    const ops = code('src/components/admin/TrainerPlanReview.tsx')
    expect(ops).toContain('cohort.plan.approve')
    expect(ops).toContain('/decide')
    expect(ops).toContain('/remind-trainer')
  })
})
