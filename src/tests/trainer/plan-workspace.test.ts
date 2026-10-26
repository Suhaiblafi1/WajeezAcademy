/* مراجعةُ الخطّة في مساحةٍ واحدة — المرحلة الخامسة (خطّة لوحة الإدارة، ٣د؛ ٢٦ أكتوبر ٢٠٢٦).

   «الجولةُ ووقتُ الانتظار في الأعلى، فتظهر المراجعةُ البطيئةُ في «اليوم»… وأزرارُ القرار في الأسفل». فيُحرس هنا:
   ① كم تنتظر بالأيّام — المفردُ والمثنّى بلا رقمهما، والمستقبلُ «اليوم»؛
   ② وفي الطابور على كلّ خطّةٍ لم يُقضَ فيها، والبطيئةُ تُعلَّم (وفي «اليوم» يحرسه `server/tests/staff/inbox.test.ts`)؛
   ③ والقرارُ تحت اللسانين لا في لسان «الإدارة» وحدَه — وسطرُ ما وقع واحدٌ لهما.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SLOW_REVIEW_DAYS, waitingAr, waitingDays } from '@/application/trainer/plan-timeline'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① كم تنتظر', () => {
  const now = new Date('2026-10-26T12:00:00Z')
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)

  it('بالأيّام — اليوم وأمس، والمثنّى بلا رقمه، والعدد بصيغته', () => {
    expect(waitingAr(ago(0, 5), now)).toBe('أرسلت اليوم')
    expect(waitingAr(ago(1, 2), now)).toBe('أرسلت أمس')
    expect(waitingAr(ago(2), now)).toBe('تنتظر منذ يومين')
    expect(waitingAr(ago(4), now)).toBe('تنتظر منذ 4 أيام')
    expect(waitingAr(ago(11), now)).toBe('تنتظر منذ 11 يوما')
  })

  it('⚠️ والمستقبل «اليوم» لا «منذ -1» — ساعة متقدّمة فرق لا خبر', () => {
    expect(waitingDays(new Date(now.getTime() + 600_000), now)).toBe(0)
    expect(waitingAr(new Date(now.getTime() + 600_000), now)).toBe('أرسلت اليوم')
  })

  it('والبطيئة ثلاثة أيّام فأكثر', () => {
    expect(SLOW_REVIEW_DAYS).toBe(3)
  })

  it('بلا تشكيل إعرابيّ', () => {
    expect([0, 1, 2, 5, 12].map((d) => waitingAr(ago(d), now)).join(' ')).not.toMatch(/[ً-ِْ]/)
  })
})

describe('② وفي الطابور', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')

  it('⚠️ على كلّ خطّة لم يُقضَ فيها — والبطيئة تُعلَّم', () => {
    expect(page).toMatch(/\{r\.submittedAt && !done && \(\s*<Chip tone=\{waitingDays\(r\.submittedAt\) >= SLOW_REVIEW_DAYS \? "warn" : "neutral"\}[^>]*>\s*\{waitingAr\(r\.submittedAt\)\}/)
  })
})

describe('③ والقرار تحت اللسانين', () => {
  const card = code('src/components/admin/TrainerPlanReview.tsx')
  const at = card.indexOf('{(!trainerPlan || tab === "admin") && (')
  /* لسانُ «الإدارة»: من رأسه إلى أوّل إغلاقٍ لشرطه في أوّل السطر */
  const adminPanel = card.slice(at, card.indexOf('\n      )}\n', at))
  const after = card.slice(card.indexOf('\n      )}\n', at))

  it('⚠️ لسان «الإدارة» بلا أزرار القرار — والبطاقات فيه', () => {
    expect(at, 'لم يعثر على اللسان — تعطّل الفحص نفسه').toBeGreaterThan(-1)
    expect(adminPanel).toContain('<PlanEditsUploader')
    expect(adminPanel, 'القرار ما زال في لسان «الإدارة» وحده').not.toMatch(/\/decide`|اعتمد وافتح للتسجيل|اطلب تعديلات|\/postpone`/)
  })

  it('⚠️ والقرار بعده، خارج اللسانين — بأزراره كلّها', () => {
    for (const s of ['/decide`', 'اعتمد وافتح للتسجيل', 'اطلب تعديلات', '/postpone`', 'ذكّر المدرّب بإكمال التجهيز']) {
      expect(after, `لا «${s}» تحت اللسانين`).toContain(s)
    }
    expect(after.indexOf('/decide`')).toBeLessThan(after.indexOf('export function PlanCurriculum'))
  })

  it('⚠️ وسطر ما وقع واحد للّسانين — لا سطر ثان في «المنهاج»', () => {
    const planPanel = card.slice(card.indexOf('{trainerPlan && tab === "plan" && ('), at)
    expect(planPanel).toContain('نزّل الخطّة للمراجعة')
    expect(planPanel, 'سطر ثان في «المنهاج»').not.toContain('{msg &&')
    expect(after).toMatch(/\{msg && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">\{msg\}<\/p>\}/)
  })
})
