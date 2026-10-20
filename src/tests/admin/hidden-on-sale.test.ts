/* «له دورات منشورة واسمه لا يظهر» (كان «له شعبة مفتوحة…» حتّى ٢٠ أكتوبر) — وسمٌ في «تشغيل المدرّبين» يضع صاحبَه أوّلَ القائمة.

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

/* ⚠️ والشرطُ شرطُ صفحة المدرّبين (٢٠ أكتوبر ٢٠٢٦): «لماذا حفصة لا تظهر بقائمة المدرّبين؟ لها شعب.. راجع كلَّ
   المدرّبين بنفس الوضع» (صاحب المنصّة). كان الوسمُ على «مفتوحةٍ أو ممتلئة»، فمن صارت شعبتُه جاريةً غائبٌ عن
   الصفحة ولا يوسَم. فصار «له دوراتٌ منشورة» (`hasLiveCourse` = `liveTrainerWhere` على الخادم). رُئي ساقطا
   على الشرط القديم: الجاريةُ وحدَها لم تُوسَم. */
describe('له دورات منشورة واسمه لا يظهر', () => {
  it('لم يعتمد ظهوره وله دورات منشورة — يوسم', () => {
    expect(hiddenOnSale({ ...SHOWN, publiclyVisible: false, hasLiveCourse: true })).toBe(true)
  })

  it('⚠️ معتمد الظهور بلا توثيق لا يظهر اسمه — يوسم', () => {
    expect(hiddenOnSale({ ...SHOWN, isVerified: false, hasLiveCourse: true }), 'الخادم يخفيه والوسم يقول ظاهر').toBe(true)
  })

  it('والموقوف لا يظهر اسمه — يوسم', () => {
    expect(hiddenOnSale({ ...SHOWN, suspended: true, hasLiveCourse: true })).toBe(true)
  })

  it('واسمه ظاهر — لا وسم', () => {
    expect(hiddenOnSale({ ...SHOWN, hasLiveCourse: true })).toBe(false)
  })

  it('ولا دورة منشورة له — لا وسم: الصفحة لا تعرضه ولو اعتمد', () => {
    expect(hiddenOnSale({ ...SHOWN, publiclyVisible: false, hasLiveCourse: false })).toBe(false)
  })

  it('⚠️ والوسم يقرأ `hasLiveCourse` الخادم — لا حالات الشعب في الواجهة', () => {
    const fn = readFileSync(join(process.cwd(), 'src/application/trainer/trainer-card.ts'), 'utf8')
    const body = fn.slice(fn.indexOf('export function hiddenOnSale'), fn.indexOf('/* ─────────── أثرُ الملفّ العامّ'))
    expect(body, 'عاد الشرط إلى حالات الشعب').not.toMatch(/cohorts|status/)
    expect(body).toMatch(/t\.hasLiveCourse/)
  })
})

describe('الشاشة تعرض الوسم وترتب به أولا', () => {
  const screen = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')

  it('⚠️ الوسم على البطاقة', () => {
    expect(screen).toMatch(/\{hiddenOnSale\(t\) && \(\s*<Chip[^>]*>له دورات منشورة واسمه لا يظهر<\/Chip>/)
  })

  it('⚠️ والموسوم أول القائمة — قبل ما ينتظرك', () => {
    expect(screen).toMatch(/const opsRank = \(t: OpsTrainer\) => \(hiddenOnSale\(t\) \? 2 : t\.pendingText \|\| t\.pendingPhotoUrl \? 1 : 0\)/)
    expect(screen).toMatch(/\.sort\(\(a, b\) => opsRank\(b\) - opsRank\(a\)\)/)
  })
})
