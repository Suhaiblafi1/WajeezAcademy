/* «تذكيرٌ أخير — ثلاثةَ أيّام» في شاشة العقود (١ أكتوبر ٢٠٢٦).
 *
 * طلبُ صاحب المنصّة: زرٌّ للعرض المرسَل غير الموقَّع «يذكّر المدرّبَ آخرَ مرّةٍ
 * بتوقيع الاتفاقيّة، والعقدُ صالحٌ ثلاثةَ أيّام». وما يقع في الخادم مقيسٌ في
 * `server/tests/trainer/contract-final-reminder.test.ts`. وهنا ما تقوله الشاشة:
 *
 * ① الزرُّ للمرسَل وحدَه، ويغيب بعد أن يُرسَل التذكير — «أخيرٌ» لا يُعرَض مرّتين.
 * ② ولا يُرسِل بنقرة: يفتح نافذةً تقول ما سيقع، وهي تنادي `/final-reminder`
 *    وتمرّر معرّفَ الصفّ إلى `run` فيُرسَم ردُّ الخادم عنده.
 * ③ وبعد الإرسال سطرٌ يقول متى أُرسل وإلى متى العرضُ صالح.
 * ④ والمدّةُ في الزرّ والنافذة من `FINAL_REMINDER_DAYS` لا رقمٌ يُكتب بيد.
 *
 * ويُقاس على البنية بعد نزع التعليقات — لا على ورودِ حرفٍ في الملفّ.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { daysWindowAr, FINAL_REMINDER_DAYS } from '@/application/trainer/notice-periods'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = bare('src/pages/admin/TrainerContracts.tsx')

/** كتلةُ النافذة — من `{reminding && (` إلى `</ConfirmAction>` الذي يليه */
function dialog(): string {
  const at = SCREEN.indexOf('{reminding && (')
  if (at < 0) return ''
  return SCREEN.slice(at, SCREEN.indexOf('</ConfirmAction>', at))
}

describe('① الزرُّ للمرسَل وحدَه — ويغيب بعد الإرسال', () => {
  it('⚠️ شرطُه: مرسَلٌ لم يُذكَّر تذكيرَه الأخير', () => {
    expect(SCREEN, 'الزرُّ بلا شرطه — فيُعرَض لموقَّعٍ أو يُعرَض ثانية')
      .toMatch(/\{c\.status === "sent" && !c\.finalReminderAt && \(\s*<Button[^>]*onClick=\{\(\) => setReminding\(c\)\}/)
  })
})

describe('② نافذةٌ تقول ما سيقع — ثمّ تنادي الخادم', () => {
  it('⚠️ تنادي `/final-reminder` وتمرّر معرّفَ الصفّ', () => {
    const d = dialog()
    expect(d, 'لا نافذةَ للتذكير').not.toBe('')
    expect(d, 'لا تنادي مسارَ التذكير').toContain('`/api/admin/trainer-contracts/${reminding.id}/final-reminder`')
    expect(d, 'ردُّ الخادم لا يُرسَم عند الصفّ').toMatch(/, reminding\.id\)\}/)
    expect(d, 'لا تقول إنّ الرابطَ القديمَ يتوقّف').toContain('ويتوقّف رابطُه السابق')
  })

  /* وليست حمراء: تذكيرٌ لا يُتلف شيئا، والأحمرُ يُقرأ «احذر» */
  it('ولونُها لونُ الإجراء لا الخطر', () => {
    expect(dialog()).toContain('tone="default"')
  })
})

describe('③ وبعد الإرسال سطرٌ يقول متى وإلى متى', () => {
  it('⚠️ يُكتب وقتُ التذكير وأجلُ العرض — أو أنّه انقضى', () => {
    const at = SCREEN.indexOf('{c.status === "sent" && c.finalReminderAt && (')
    expect(at, 'لا سطرَ بعد الإرسال — فلا يُعرف أأُرسل أم لا').toBeGreaterThan(-1)
    const line = SCREEN.slice(at, SCREEN.indexOf('</p>', at))
    expect(line).toContain('fmtDateTime(c.finalReminderAt)')
    expect(line).toContain('fmtDateTime(c.tokenExpiresAt)')
    expect(line, 'لا يقول إنّ العرضَ سقط بعد أجله').toContain('فسقط العرض')
  })
})

describe('④ المدّةُ من الثابت — لا رقمٌ بيد', () => {
  it('⚠️ الزرُّ والنافذةُ يقولان المدّةَ بـ`daysWindowAr(FINAL_REMINDER_DAYS)`', () => {
    expect(SCREEN).toMatch(/تذكيرٌ أخير — \{daysWindowAr\(FINAL_REMINDER_DAYS\)\}/)
    expect(dialog()).toContain('{daysWindowAr(FINAL_REMINDER_DAYS)}')
    expect(SCREEN, 'كُتبت المدّةُ بيدٍ في الشاشة').not.toMatch(/تذكيرٌ أخير — (٣|3|ثلاثة)/)
  })

  it('واللفظُ يتبع العدد — «يومين» و«ثلاثةَ أيّام» و«14 يوما»', () => {
    expect(daysWindowAr(FINAL_REMINDER_DAYS)).toBe('ثلاثةَ أيّام')
    expect(daysWindowAr(2)).toBe('يومين')
    expect(daysWindowAr(10)).toBe('عشرةَ أيّام')
    expect(daysWindowAr(14)).toBe('14 يوما')
  })
})
