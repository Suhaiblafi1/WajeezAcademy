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
import { TRAINER_STATES, trainerStateOf } from '@/application/trainer/trainer-status'

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

/* ═══ وصار الوسمُ حالَ السطر المطويّ (٢٠ أكتوبر ٢٠٢٦، `trainer-status.ts`) ═══
   «كلُّ مدرّبٍ مضمومٌ مكتوبٌ حالُه». فالوسمُ شارةُ حاله «اسمه لا يظهر» في سطره، والترتيبُ ترتيبُ الحالات —
   وهي أولاها، قبل «ينتظرك». والقصدُ نفسُه: الغائبُ يُرى بلا قراءة البطاقات، وأوّلَ القائمة. */
describe('الشاشة تعرض الوسم وترتب به أولا', () => {
  const screen = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
  const hidden = { ...SHOWN, publiclyVisible: false, hasLiveCourse: true }

  it('⚠️ الوسم على البطاقة', () => {
    expect(trainerStateOf({
      ...hidden, hasAccount: true, applicationStatus: 'active', photoUrl: '/p.jpg', pendingPhotoUrl: null, pendingText: null,
      pitchDraft: null, bioDraft: null, pitchLatest: null, bioLatest: null, cohorts: [], contract: null, queue: { requests: 0, toAccept: 0 },
    })).toBe('hidden')
    expect(TRAINER_STATES.find((x) => x.id === 'hidden')?.ar).toBe('اسمه لا يظهر')
    /* وفي السطر المطويّ شارةُ حاله — من `TRAINER_STATES` */
    expect(screen).toMatch(/const meta = TRAINER_STATES\.find\(\(x\) => x\.id === state\)!;/)
    expect(screen).toMatch(/aria-expanded=\{isOpen\}[\s\S]{0,600}<Chip tone=\{meta\.tone\}[^>]*>\{meta\.ar\}<\/Chip>/)
  })

  it('⚠️ والموسوم أول القائمة — قبل ما ينتظرك', () => {
    const order = TRAINER_STATES.map((x) => x.id)
    expect(order.indexOf('hidden')).toBe(0)
    expect(order.indexOf('hidden')).toBeLessThan(order.indexOf('you'))
    expect(screen).toMatch(/const STATE_ORDER = Object\.fromEntries\(TRAINER_STATES\.map\(\(x, i\) => \[x\.id, i\]\)\)/)
    expect(screen).toMatch(/\.sort\(\(a, b\) => STATE_ORDER\[a\.state\] - STATE_ORDER\[b\.state\]/)
  })
})
