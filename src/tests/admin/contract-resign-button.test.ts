/* «حُدّث النصُّ — أعِدْه للتوقيع» في شاشة العقود.
 *
 * ── ما يحرسه ──
 *
 * ① الزرُّ مثبِتٌ لا خطِر (`confirm` لا `danger`): هو عرضٌ يُجدَّد لا عيبٌ
 *   يُرفَض. والأحمرُ بجوار «لم يطابق — ارفضْ» يجعلهما فعلا واحدا في العين.
 * ② نافذتُه تنادي `/resign-request` بالعنوان والنصّ، وتمرّر معرّفَ الصفّ
 *   إلى `run` — فردُّ الخادم يُرسَم عند الصفّ (رأسُ
 *   `countersign-activates-button.test.ts`).
 * ③ وقائمةُ التغييرات تُعرَض من `changesBetween` ولا تُرسَل من الشاشة: لو
 *   حُملت في جسم الطلب لَصار للمرسِل أن يقصّها، وهو ما بُني الخادمُ لمنعه.
 *
 * ويُقاس على **كتلة النافذة** بعد نزع التعليقات — لا على ورودِ حرفٍ في الملفّ.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = bare('src/pages/admin/TrainerContracts.tsx')

/** الزرُّ الذي يفتح النافذة — من `<Button` السابق لـ`openResign(c)` إلى نصّه */
function opener(): string {
  const at = SCREEN.indexOf('openResign(c)')
  if (at < 0) return ''
  const open = SCREEN.lastIndexOf('<Button', at)
  const close = SCREEN.indexOf('</Button>', at)
  return open < 0 || close < 0 ? '' : SCREEN.slice(open, close)
}

/** النافذةُ نفسُها — من `{resign && (` إلى إغلاق `Modal` */
function dialog(): string {
  const at = SCREEN.indexOf('{resign && (')
  if (at < 0) return ''
  const close = SCREEN.indexOf('</Modal>', at)
  return close < 0 ? '' : SCREEN.slice(at, close)
}

describe('«أعِدْه للتوقيع» — زرُّه ونافذتُه', () => {
  const btn = opener()
  const dlg = dialog()

  it('الكتلتان مقروءتان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(btn, 'لم يُقرأ زرُّ فتح النافذة').toContain('حُدّث النصُّ — أعِدْه للتوقيع')
    expect(dlg, 'لم تُقرأ النافذة').toContain('أعِدْه للتوقيع وأبلغْه')
  })

  it('الزرُّ مثبِتٌ لا خطِر — فلا يُقرأ رفضا بجوار زرّ الرفض', () => {
    expect(btn).toMatch(/tone="confirm"/)
    expect(btn).not.toMatch(/tone="danger"/)
  })

  it('والنافذةُ تنادي مسارَها وتمرّر معرّفَ الصفّ', () => {
    expect(dlg).toMatch(/\/resign-request`/)
    expect(dlg, 'عاد جوابُ الإعادة إلى رأس الصفحة').toMatch(/,\s*r\.row\.id\)/)
  })

  it('والقائمةُ تُقرأ من الجدول وتُعرَض — ولا تُرسَل من الشاشة', () => {
    expect(dlg).toMatch(/changesBetween\(r\.row\.bodyVersion,\s*CONTRACT_BODY_VERSION\)/)
    /* وما تغيّر في شروطه هو بالدالّة التي يحسب بها الخادم (١ أكتوبر ٢٠٢٦) —
       فما يُعايَن هو ما يُرسَل، لا نسختان تفترقان */
    /* والقائمةُ المعروضةُ نفسُها لا أيُّ نداءٍ للدالّة: نداءٌ آخرُ في النافذة
       (مقارنةُ الأجر) كان يُخضِر فحصا أوسعَ من هذا وهي تُحسب بيدٍ أخرى. */
    expect(dlg, 'شروطُه تُحسب في الشاشة بغير دالّة الخادم').toMatch(/const personal = personalChangesAr\(/)
    expect(dlg, 'القائمةُ المعروضةُ لا تبدأ بشروطه').toMatch(/const changes = \[\.\.\.personal, \.\.\.changesBetween\(/)
    const call = dlg.slice(dlg.indexOf('/resign-request`'), dlg.indexOf('setResign(null)', dlg.indexOf('/resign-request`')))
    expect(call, 'لم تُقرأ كتلةُ النداء').toContain('subjectAr')
    expect(call, 'حُملت القائمةُ في الطلب — فصار للمرسِل أن يقصّها').not.toMatch(/\bchanges\b|changesAr|personal\b/)
  })
})
