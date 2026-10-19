/* «له شعبة مفتوحة واسمه لا يظهر» — وسمٌ في «تشغيل المدرّبين» يضع صاحبَه أوّلَ القائمة.

   ═══ لماذا ═══

   ستُّ شعبٍ مفتوحةٌ للتسجيل في الإنتاج (١٩ أكتوبر ٢٠٢٦) لا يرى المشتري من يدرّسها، واختار صاحبُ المنصّة
   أن يعتمد ظهورَ مدرّبيها — ولم يكن ما يدلّه عليهم إلّا قراءةُ البطاقات كلِّها.

   ═══ وما يُحرَس ═══

   ١) الشرطُ شرطُ الخادم في اسم الشعبة: ظهورٌ معتمَدٌ وتوثيقٌ ولا إيقاف — وشعبةٌ يختارها المشتري (مفتوحةٌ أو
      ممتلئة)، لا مسودّةٌ ولا جاريةٌ ولا منتهية.
   ٢) والشاشةُ تعرض الوسمَ وترتّب به أوّلا.

   ═══ وكيف رُئي ساقطا ═══

   أُسقط شرطُ التوثيق من الدالّة فسقط حارسُه، وأُعيد الترتيبُ إلى «ما ينتظرك» وحدَه فسقط حارسُ الشاشة. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hiddenOnSale } from '@/application/trainer/trainer-card'

const SHOWN = { publiclyVisible: true, isVerified: true, suspended: false }
const open = [{ status: 'open' }]

describe('له شعبة مفتوحة واسمه لا يظهر', () => {
  it('لم يعتمد ظهوره وله شعبة مفتوحة أو ممتلئة — يوسم', () => {
    expect(hiddenOnSale({ ...SHOWN, publiclyVisible: false, cohorts: open })).toBe(true)
    expect(hiddenOnSale({ ...SHOWN, publiclyVisible: false, cohorts: [{ status: 'full' }] })).toBe(true)
  })

  it('⚠️ معتمد الظهور بلا توثيق لا يظهر اسمه — يوسم', () => {
    expect(hiddenOnSale({ ...SHOWN, isVerified: false, cohorts: open }), 'الخادم يخفيه والوسم يقول ظاهر').toBe(true)
  })

  it('والموقوف لا يظهر اسمه — يوسم', () => {
    expect(hiddenOnSale({ ...SHOWN, suspended: true, cohorts: open })).toBe(true)
  })

  it('واسمه ظاهر — لا وسم', () => {
    expect(hiddenOnSale({ ...SHOWN, cohorts: open })).toBe(false)
  })

  it('وشعبة لا يختارها المشتري — لا وسم', () => {
    for (const status of ['draft', 'active', 'completed', 'cancelled']) {
      expect(hiddenOnSale({ ...SHOWN, publiclyVisible: false, cohorts: [{ status }] }), status).toBe(false)
    }
    expect(hiddenOnSale({ ...SHOWN, publiclyVisible: false, cohorts: [] })).toBe(false)
  })
})

describe('الشاشة تعرض الوسم وترتب به أولا', () => {
  const screen = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')

  it('⚠️ الوسم على البطاقة', () => {
    expect(screen).toMatch(/\{hiddenOnSale\(t\) && \(\s*<Chip[^>]*>له شعبة مفتوحة واسمه لا يظهر<\/Chip>/)
  })

  it('⚠️ والموسوم أول القائمة — قبل ما ينتظرك', () => {
    expect(screen).toMatch(/const opsRank = \(t: OpsTrainer\) => \(hiddenOnSale\(t\) \? 2 : t\.pendingText \|\| t\.pendingPhotoUrl \? 1 : 0\)/)
    expect(screen).toMatch(/\.sort\(\(a, b\) => opsRank\(b\) - opsRank\(a\)\)/)
  })
})
