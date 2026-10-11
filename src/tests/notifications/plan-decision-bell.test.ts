/* جرسُ قرار الخطّة: سطرٌ واضحٌ يفتح الصفحةَ المسؤولة (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة بلقطة جرسٍ يحمل ملاحظاتِ الخطوات بنصوصها وسطرَ التعديلات وسطرَ التقرير:
   «الإشعاراتُ فيها كلامٌ كثيرٌ وغيرُ احترافيّة! اجعلها أكثرَ احترافيّةً وواضحةً، وتقود للصفحة المسؤولة».

   ① جرسُ الردّ سطرٌ بعدد ما ينتظره في «المراجعة» — لا نصوص.
   ② وجرسُ الاعتماد والتأجيل يُذيَّل بجملةٍ قصيرةٍ لكلّ ما صحبه — لا فقرة.
   ③ والبندُ يفتح صفحةَ الشعبة نفسَها، وعلى «المراجعة» حين يكون الردّ — باسم بابٍ يقول ذلك.
   ④ والجرسُ ثلاثةُ أسطرٍ على الأكثر — والخبرُ كلُّه في صفحته. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decisionBellTailAr, editsCountAr, returnBellAr } from '@/application/trainer/plan-decision'
import { allDestinationPaths, notificationCtaAr, notificationHref } from '@/application/notifications/destinations'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① جرس الردّ سطر بالعدد', () => {
  it('⚠️ ما ينتظره في «المراجعة» بعدده — ملاحظات وتعديلات وتقرير — ثمّ ما يفعل', () => {
    expect(returnBellAr({ notes: 3, edits: 56, required: 2, reports: 2 }))
      .toBe('تنتظرك في «المراجعة» 3 ملاحظات و56 تعديلا مقترحا (منها اثنان مطلوبان) وتقرير المراجعة — قرّر فيها ثمّ أرسل مراجعتك.')
    expect(returnBellAr({ notes: 1, edits: 0, required: 0, reports: 0, resumedAr: ' وعادت مهلتك تعدّ.' }))
      .toBe('تنتظرك في «المراجعة» ملاحظة واحدة — قرّر فيها ثمّ أرسل مراجعتك. وعادت مهلتك تعدّ.')
    expect(returnBellAr({ notes: 2, edits: 0, required: 0, reports: 0 })).toContain('ملاحظتان')
  })

  it('⚠️ والعدد بلغته: الواحد والاثنان والقليل والكثير — وما يطلب منها', () => {
    expect(editsCountAr(1, 0)).toBe('تعديل مقترح')
    expect(editsCountAr(1, 1)).toBe('تعديل مقترح (مطلوب)')
    expect(editsCountAr(2, 2)).toBe('تعديلان مقترحان (كلاهما مطلوب)')
    expect(editsCountAr(4, 2)).toBe('4 تعديلات مقترحة (منها اثنان مطلوبان)')
    expect(editsCountAr(26, 26)).toBe('26 تعديلا مقترحا (كلّها مطلوبة)')
    expect(editsCountAr(56, 5)).toBe('56 تعديلا مقترحا (منها 5 مطلوبة)')
  })

  it('⚠️ والخدمة تبنيه منه ولا تذيّله — ولا تضع الملاحظات بنصوصها', () => {
    const svc = code('server/services/cohort-plan.service.ts')
    expect(svc).toMatch(/const bell = returnBellAr\(\{\s*notes: noteItemsFrom\(asked\)\.length, edits: edits\.count, required: edits\.required, reports: reports\.length, resumedAr: resumed,\s*\}\)/)
    expect(svc).toMatch(/body: bell,[\s\S]{0,120}step: 'review',\s*\}, \{ bell \}\)/)
    expect(svc).toMatch(/title: msg\.title, body: opts\.bell \?\? \(tail \? `\$\{msg\.body\} \$\{tail\}` : msg\.body\),/)
  })
})

describe('② وذيل الاعتماد والتأجيل جمل قصيرة', () => {
  it('⚠️ جملة للتعديلات وجملة للتقرير — ولا شيء إن لم يصحبه شيء', () => {
    expect(decisionBellTailAr({ edits: { count: 4, required: 0 }, reports: 2 }))
      .toBe('وتنتظرك في «المراجعة» 4 تعديلات مقترحة. وتقرير المراجعة في «المراجعة» للقراءة.')
    expect(decisionBellTailAr({ reports: 0 })).toBe('')
  })
})

describe('③ ويفتح الصفحة المسؤولة', () => {
  it('⚠️ قرار الخطّة يفتح صفحة شعبته — والردّ «المراجعة» منها، باسم باب يقول ذلك', () => {
    expect(notificationHref('cohort.plan.decision', 'trainer', { cohortId: 'c-1', step: 'review' })).toBe('/trainer/cohort/c-1?step=review')
    expect(notificationCtaAr('cohort.plan.decision', 'trainer', { cohortId: 'c-1', step: 'review' })).toBe('افتح «المراجعة»')
    expect(notificationHref('cohort.plan.decision', 'trainer', { cohortId: 'c-1' })).toBe('/trainer/cohort/c-1')
    expect(notificationCtaAr('cohort.plan.decision', 'trainer', { cohortId: 'c-1' })).toBe('افتح شعبتك')
  })

  it('وما لا معرّف فيه يبقى على وجهته — وخطوة غريبة لا تلصق بالرابط', () => {
    expect(notificationHref('cohort.plan.decision', 'trainer', {})).toBe('/trainer/board')
    expect(notificationHref('cohort.plan.decision', 'trainer', { cohortId: 'c-1', step: 'x&y=1' })).toBe('/trainer/cohort/c-1')
  })

  it('⚠️ ومسار الشعبة قائم في `App.tsx` — يقابله حارس «لا وجهة مخترعة»', () => {
    expect(allDestinationPaths()).toContain('/trainer/cohort/:id')
    expect(code('src/App.tsx')).toMatch(/<Route path="\/trainer\/cohort\/:id"/)
  })

  it('⚠️ والجرس يحمل الخطوة في بياناته', () => {
    expect(code('server/services/cohort-plan.service.ts'))
      .toMatch(/templateKey: 'cohort\.plan\.decision', data: \{ cohortId: cohort\.id, \.\.\.\(msg\.step \? \{ step: msg\.step \} : \{\}\) \}/)
  })
})

describe('④ ثلاثة أسطر على الأكثر', () => {
  it('⚠️ نصّ البند مقصوص بثلاثة أسطر — واسم بابه من بياناته', () => {
    const bell = code('src/components/NotificationBell.tsx')
    expect(bell).toMatch(/<p className="mt-1 line-clamp-3 [^"]*">\{n\.body\}<\/p>/)
    expect(bell).toMatch(/notificationCtaAr\(n\.templateKey, audience, n\.data\)/)
  })
})
