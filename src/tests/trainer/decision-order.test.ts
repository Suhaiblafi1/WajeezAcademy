/* ترتيبُ أزرار القرار في ملفّ الطلب — ورحلةُ الطلب هي ترتيبُها.

   ═══ ما شُكي منه (٢١ سبتمبر ٢٠٢٦) ═══

   «رتّب هذه الأوامرَ لتكون أسهلَ وأفضلَ من هذا الترتيب العشوائيّ والتقسيم
   الذي لا داعيَ له».

   وكانت البطاقةُ تُخرج لطلبٍ مقدَّم: «اعتمِدْه مدرّبا» ثمّ «اقبَلْه
   داخليّا» ثمّ «رفض»، ثمّ مطويّةً اسمُها «خطواتٌ تفصيليّة (٢) — اختياريّة»
   فيها «بدء المراجعة» و«قائمة الانتظار». أي: آخرُ الطريق أوّلا، وأوّلُه
   مطويٌّ تحت كلمة «اختياريّة».

   ═══ وما يُحرَس ═══

   ① **الترتيبُ ترتيبُ الرحلة** — ما يُقدّم الطلبَ بترتيب تقدّمه، ثمّ ما
      يُعلّقه، ثمّ ما يُنهيه. ولا يُقاس بحفظ قائمةٍ عن ظهر قلب: يُقاس بأنّ
      كلَّ قرارٍ يسبق ما يأتي بعده في المسار فعلا.
   ② **ولا تقسيمَ ولا مطويّة** — ما يصلح للحالة يُعرض كلُّه.
   ③ **وواحدٌ ذهبيٌّ لا ثلاثة** — «الذهبيُّ فعلُ الصفحة الأوّل، واحدٌ في
      الشاشة لا اثنان» (سلّم الأزرار).
   ④ **ولكلّ حالةٍ يُعرض فيها زرٌّ موصًى به** — شاشةٌ فيها أزرارٌ ولا واحدَ
      منها مميَّز تعيد الشكوى نفسَها بشكلٍ آخر.
   ⑤ **وأثرُ الفعل تحت زرّه** — لا سطرٌ عامٌّ تحت ثلاثة أزرارٍ لا يُعرف
      أيَّها يصف. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BAR_ACTIONS, DECISIONS, recommendedFor } from '@/application/trainer/decisions'
import { STATUS_LABELS } from '@/application/trainer/application-status'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const SCREEN = 'src/pages/admin/TrainerApplications.tsx'

/** موضعُ القرار في المصفوفة — وهو موضعُ زرّه في العمود */
const at = (action: string) => DECISIONS.findIndex((d) => d.action === action)

describe('① الترتيبُ ترتيبُ رحلة الطلب', () => {
  it('كلُّ قرارٍ يسبق ما يليه في المسار — لا ترتيبَ كتابةٍ ولا صدفة', () => {
    /* أزواجٌ من الرحلة نفسِها: الأوّلُ يقع قبل الثاني في حياة الطلب */
    const before: [string, string][] = [
      ['move_to_review', 'shortlist'],
      ['shortlist', 'request_demo'],
      ['request_demo', 'academic_review'],
      ['academic_review', 'conditionally_approve'],
      ['conditionally_approve', 'start_onboarding'],
      ['start_onboarding', 'activate'],
      /* والاعتمادُ بنقرةٍ آخرُ الطريق — يختصر ما فوقه، فلا يتقدّمه */
      ['activate', 'approve'],
      ['move_to_review', 'approve'],
    ]
    for (const [first, second] of before) {
      expect(at(first), `«${first}» غاب عن القرارات`).toBeGreaterThanOrEqual(0)
      expect(at(first), `«${first}» بعد «${second}» — وهو قبله في المسار`)
        .toBeLessThan(at(second))
    }
  })

  it('وما يُعلّق الطلبَ ثمّ ما يُنهيه — بعد ما يُقدّمه كلِّه', () => {
    const advancing = ['move_to_review', 'shortlist', 'academic_review', 'conditionally_approve', 'approve']
    for (const act of advancing) {
      expect(at(act), `«قائمة الانتظار» قبل «${act}»`).toBeLessThan(at('waitlist'))
      expect(at(act), `«الرفض» قبل «${act}»`).toBeLessThan(at('reject'))
    }
    expect(at('waitlist'), 'الرفضُ قبل التعليق — والتعليقُ أهونُ منه').toBeLessThan(at('reject'))
    expect(at('reject'), 'التراجعُ عن الرفض قبل الرفض').toBeLessThan(at('undo_reject'))
  })

  it('والشاشةُ ترث الترتيبَ ولا تعيد فرزَه', () => {
    const screen = code(SCREEN)
    expect(screen, 'الشاشةُ لا ترشّح من المصفوفة نفسِها')
      .toContain('DECISIONS.filter((d) => d.from.includes(a.status))')
    expect(screen, 'فرزٌ ثانٍ في الشاشة — فموضعُ الزرّ يُبدَّل في موضعَين')
      .not.toMatch(/available\s*\.?\s*sort\(/)
  })
})

describe('② ولا تقسيمَ ولا مطويّة', () => {
  const screen = code(SCREEN)

  it('بطاقةُ القرار تعرض المتاحَ كلَّه في عمودٍ واحد', () => {
    expect(screen, 'عادت البطاقةُ تعرض بعضَ المتاح').toContain('available.map((d) =>')
  })

  it('ولا «خطواتٌ تفصيليّة» ولا «اختياريّة» ولا قسمةُ رئيسٍ وتفصيل', () => {
    for (const gone of ['خطواتٌ تفصيليّة', 'اختياريّة', 'PRIMARY_ACTIONS', 'detailed']) {
      expect(screen, `«${gone}»: عاد التقسيمُ الذي لا داعيَ له`).not.toContain(gone)
    }
  })

  it('وحدُّ الشريط اللاصق باقٍ — هو عرضُ صفٍّ لا حكمٌ على الأهمّيّة', () => {
    expect(screen, 'الشريطُ يعرض المتاحَ كلَّه فيلتفّ على سطرَين')
      .toContain('available.filter((d) => BAR_ACTIONS.includes(d.action))')
    expect(BAR_ACTIONS.length, 'قائمةُ الشريط اتّسعت حتّى صارت عمودا').toBeLessThanOrEqual(4)
    for (const act of BAR_ACTIONS) {
      expect(at(act), `«${act}» في الشريط وليس في القرارات`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('③④ وواحدٌ ذهبيٌّ لكلّ حالة', () => {
  /** الحالاتُ التي يُعرض فيها زرٌّ أصلا */
  const actionable = Object.keys(STATUS_LABELS)
    .filter((st) => DECISIONS.some((d) => d.from.includes(st)))

  it('لكلّ حالةٍ فيها أزرارٌ موصًى به — ولا واحدةَ بلا دليل', () => {
    expect(actionable.length, 'لا حالةَ فيها أزرارٌ أصلا — تعطّل الفحصُ نفسُه')
      .toBeGreaterThan(5)
    for (const st of actionable) {
      expect(recommendedFor(st), `«${st}»: أزرارٌ بلا واحدٍ يُوصى به`).not.toBeNull()
    }
  })

  it('والموصى به متاحٌ في حالته — لا يُضاء زرٌّ لا يُعرض', () => {
    for (const st of actionable) {
      const rec = recommendedFor(st)!
      expect(DECISIONS.some((d) => d.action === rec && d.from.includes(st)),
        `«${st}»: يُوصى بـ«${rec}» وهو غيرُ متاحٍ فيها`).toBe(true)
    }
  })

  it('وحالةٌ لا فعلَ فيها لا يُخترع لها موصًى به', () => {
    expect(recommendedFor('withdrawn'), 'اختُرع فعلٌ لطلبٍ سحبه صاحبُه').toBeNull()
  })

  it('والشاشةُ تُذهّب الموصى به وحدَه — والأحمرُ يبقى أحمر', () => {
    const screen = code(SCREEN)
    expect(screen, 'النبرةُ تُقرأ من `tone` فتُذهّب كلَّ `main` — وهي ثلاثةٌ في حالةٍ واحدة')
      .not.toContain('d.tone === "main" ? "primary"')
    expect(screen, 'لا يُميَّز الموصى به بالذهبيّ')
      .toContain('d.action === recommended ? "primary" : "secondary"')
    expect(screen, 'ما لا يُتراجَع عنه سُوّي ببديلٍ عاديّ')
      .toContain('d.tone === "danger" ? "danger"')
  })
})

describe('⑤ وأثرُ الفعل تحت زرّه', () => {
  it('الاعتمادُ يقول ما يفعله — ومن لم يقرأه ظنّه قرارا داخليّا', () => {
    const approve = DECISIONS.find((d) => d.action === 'approve')!
    expect(approve.noteAr, 'الاعتمادُ بلا أثرٍ مكتوب').toBeTruthy()
    expect(approve.noteAr, 'لا يُقال إنّه يُعلم المتقدّم').toContain('بالبريد')
  })

  it('و«اقبَلْه داخليّا» يقول إنّه لا يصل المتقدّم — وهو ما يُخطئ فيه القارئ', () => {
    const internal = DECISIONS.find((d) => d.action === 'conditionally_approve')!
    expect(internal.noteAr, 'القبولُ الداخليُّ بلا أثرٍ مكتوب').toBeTruthy()
    expect(internal.noteAr, 'لا يُقال إنّه لا يصل صاحبَه').toMatch(/لا يصل/)
  })

  it('والشاشةُ تعرضه تحت زرّه لا تحت المجموعة', () => {
    expect(code(SCREEN), 'الأثرُ لا يُعرض أصلا').toContain('{d.noteAr}')
  })
})
