/* «شعب نشطة الآن» تعدّ الحيَّ فعلا — ومفردةُ الحالة واحدةٌ في الواجهة والخادم.

   كانت لوحةُ الإدارة تعدّ `open || running || full`، و«running» لا وجودَ لها
   في هذه المنصّة: ليست في المخطَّط ولا في خدمةٍ ولا في بذر الديمو، ووردت
   مرّةً واحدةً في المستودع كلِّه وهي ذلك السطر. فكانت البطاقةُ تقرأ صفرا
   وفي القاعدة شعبةٌ `active` بمتعلّمٍ مسجَّلٍ وجلساتٍ قادمة.

   والحارسُ على المفردة لا على العدّ: عدٌّ صحيحٌ بمفردةٍ كاذبةٍ لا يُمسك
   باختبار سلوك. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIVE_COHORT_STATUSES, isLiveCohort } from '@/application/schedule/cohort-status'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('حالاتُ الشعبة الحيّة', () => {
  it('الثلاثةُ المعروفة، ولا رابعَ مخترَع', () => {
    expect([...LIVE_COHORT_STATUSES]).toEqual(['open', 'full', 'active'])
    expect(isLiveCohort('active')).toBe(true)
    expect(isLiveCohort('open')).toBe(true)
    expect(isLiveCohort('full')).toBe(true)
    expect(isLiveCohort('completed')).toBe(false)
    expect(isLiveCohort('draft')).toBe(false)
    expect(isLiveCohort('running')).toBe(false)
  })

  it('توافق ما يعدّه الخادمُ حيّا', () => {
    for (const f of [
      'server/services/catalog-readiness.service.ts',
      'server/services/catalog-impact.service.ts',
    ]) {
      expect(read(f), `${f} يخالف مفردةَ الواجهة`).toContain("['open', 'full', 'active']")
    }
  })

  it('«running» لا تُذكر في شيفرة الواجهة — فليست حالةً في هذه المنصّة', () => {
    for (const f of ['src/pages/admin/AdminDashboard.tsx', 'src/pages/admin/AdminCohorts.tsx']) {
      expect(read(f), `${f} يذكر حالةً لا وجودَ لها`).not.toMatch(/["']running["']/)
    }
  })

  it('الشاشتانِ تقرآن الثابتَ ولا تُعيدان كتابةَ القائمة', () => {
    for (const f of ['src/pages/admin/AdminDashboard.tsx', 'src/pages/admin/AdminCohorts.tsx']) {
      expect(read(f), `${f} لا يستعمل isLiveCohort`).toContain('isLiveCohort')
    }
  })
})

/* والنسبةُ لا تُعرض قبل أن يبدأ أحد: «٠٪» تُقرأ نتيجةً وهي غيابُ بيانات. */
describe('قمعُ التشخيص', () => {
  it('نسبةُ التحويل مشروطةٌ ببدء أحدٍ فعلا', () => {
    const src = read('src/components/DiagnosticFunnel.tsx')
    expect(src).toContain('conversion && started > 0')
  })
})
