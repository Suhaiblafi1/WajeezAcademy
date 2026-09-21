/* أربعُ مرشِّحاتِ الحالة التي تخرج من القائمة إلى الشاشة.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   «أريد أن تُخرج ٤ ليبلاتٍ للفرز خارجا، وهم الأكثرُ استخداما، تضعهم
   بوضوحٍ لسهولة الوصول: نشط ← مرفوض ← قيد المراجعة ← قبول داخلي».

   ═══ وما يُحرَس ═══

   ① **الأربعُ هي الأربعُ بترتيبها** — لا ثلاثٌ ولا خمس، ولا مرتَّبةٌ
      بدورة الحياة: ترتيبُها بكثرة الاستعمال وهو ما قاله صاحبُها.
   ② **وكلُّ مفتاحٍ منها حالةٌ قائمة** — مفتاحٌ لا وجودَ له في المعجم
      يُنتج زرّا يُرشِّح الطابورَ إلى الفراغ ولا يُحمِّر شيئا. وهذا أقربُ
      ممّا يبدو: `conditionally_approved` كان اسمُها «قبولٌ مشروط» يوما.
   ③ **والقائمةُ تبقى تحتها** — اثنتا عشرةَ حالةً أخرى لا بابَ لها غيرُها،
      واستبدالُ الأزرار بها يقايض شكوى بشكوى.
   ④ **وموضعُ الحقيقة واحد** — الزرُّ والقائمةُ يكتبان في `filter` نفسِها،
      فما اختير في إحداهما يُقرأ في الأخرى. ولو كتب الزرُّ في حالةٍ ثانيةٍ
      لَأمكن أن يُضيء زرٌّ والقائمةُ تقول «كلُّ الحالات». */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { QUICK_STATUSES, STATUS_LABELS } from '@/application/trainer/application-status'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SCREEN = 'src/pages/admin/TrainerApplications.tsx'
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

describe('① الأربعُ هي الأربعُ بترتيبها', () => {
  it('نشط ← مرفوض ← قيد المراجعة ← قبول داخليّ', () => {
    expect(QUICK_STATUSES.map((q) => q.status)).toEqual([
      'active', 'rejected', 'under_review', 'conditionally_approved',
    ])
  })

  it('ولكلٍّ عنوانٌ قصيرٌ يسع زرّا — لا عنوانُ الصفّ الطويل', () => {
    for (const q of QUICK_STATUSES) {
      expect(q.shortAr.trim(), `«${q.status}» بلا عنوانٍ قصير`).not.toBe('')
      expect(q.shortAr.length, `«${q.shortAr}» أطولُ من أن يكون زرّا`).toBeLessThanOrEqual(14)
    }
  })
})

describe('② وكلُّ مفتاحٍ منها حالةٌ قائمة', () => {
  it('لا مفتاحَ يُرشِّح إلى الفراغ', () => {
    for (const q of QUICK_STATUSES) {
      expect(STATUS_LABELS[q.status], `«${q.status}» ليست حالةً في المعجم`).toBeDefined()
    }
  })
})

describe('③ والقائمةُ تبقى تحتها', () => {
  const screen = code(SCREEN)

  it('الأزرارُ تُبنى من `QUICK_STATUSES` لا من قائمةٍ ثانيةٍ في الشاشة', () => {
    expect(screen, 'أزرارٌ مكتوبةٌ بيدها — تفترق عن المعجم أوّلَ تبديل')
      .toMatch(/QUICK_STATUSES\.map\(/)
  })

  it('وقائمةُ الحالات كلِّها باقيةٌ — ولها «كلُّ الحالات»', () => {
    expect(screen, 'ذهبت القائمةُ فذهبت اثنتا عشرةَ حالةً معها')
      .toMatch(/Object\.entries\(STATUS_LABELS\)\.map\(/)
    expect(screen, 'لا مخرجَ من الترشيح في القائمة').toContain('كل الحالات')
  })
})

describe('④ وموضعُ الحقيقة واحد', () => {
  const screen = code(SCREEN)

  it('الزرُّ يكتب في `filter` نفسِها ويقرأها — ويُنقَر ثانيةً فيُفرَج', () => {
    expect(screen, 'الزرُّ لا يقرأ الحالةَ التي تقرؤها القائمة')
      .toContain('tone={filter === qs.status ? "confirm" : "secondary"}')
    expect(screen, 'الزرُّ المختارُ لا يُفرَج عنه بنقرةٍ ثانية')
      .toContain('setFilter(filter === qs.status ? "" : qs.status)')
  })

  it('ويُعلَن انضغاطُه لقارئ الشاشة — لونٌ وحدَه لا يُقرأ بالأذن', () => {
    expect(screen, 'زرُّ الترشيح بلا `aria-pressed`').toContain('aria-pressed={filter === qs.status}')
  })
})
