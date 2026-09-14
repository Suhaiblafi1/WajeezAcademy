/* روبركان في المخطّط، وواحدٌ حيّ — والحارسُ يمنع الكتابةَ في الميّت (ك-١٥).

   ═══ ما وُجد ═══

   · `Rubric` — معاييرُ في عمود `Json`، معلّقٌ بـ`Assessment` (تقييمٌ في إصدار
     الدورة بالكتالوج). **لا سطرَ في الشيفرة يكتب فيه**: لا خدمةٌ ولا مستوردٌ
     ولا بذرة.
   · `GradingRubric` — معاييرُ صفوفا، معلّقٌ بـ`CohortAssessment` (تكليفٌ في
     شعبةٍ حقيقيّة). وهو الحيُّ: تكتبه `assessment.service`.

   ═══ ولماذا حارسٌ لا حذف ═══

   الخطرُ ليس بقاءَه بل **تشابهُهما**: من يبني ميزةَ روبركٍ غدا يقع على
   `Rubric` أوّلا — الاسمُ أقصرُ والعلاقةُ أوضح — فيكتب فيه ولا يظهر شيءٌ في
   شاشة. والحذفُ يمحو صفوفَه إن وُجدت في الإنتاج، وذلك يُتحقَّق منه على
   القاعدة الحيّة لا من ملفّ اختبار. فالحارسُ يحفظ الفائدةَ بلا خطرِ الحذف.

   ═══ والفحصُ بنيويٌّ لا نصّيّ ═══

   يُفتَّش عن **نداءِ عميلِ Prisma** على النموذج (`prisma.rubric.create` وما
   يجري مجراه) في الخادم كلِّه — لا عن ورودِ كلمة «rubric»، فهي في أسماءٍ
   كثيرةٍ لا علاقةَ لها (مدقّقُ صيغةِ الروبرك النصّيّة، ومحاورُ المقابلة).
   ولا يُخلَط بـ`gradingRubric`: الفحصُ يشترط ألّا يسبق الاسمَ حرفُ اسمٍ آخر. */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) {
      if (name === 'node_modules' || name === 'tests') continue
      out.push(...walk(rel))
    } else if (name.endsWith('.ts')) out.push(rel)
  }
  return out
}

/* نداءُ عميلِ Prisma وحدَه: `prisma.rubric.x` أو `tx.rubric.x`.

   والعميلُ شرطٌ لا زينة — أوّلُ صياغةٍ طابقت `rubric\s*\.` مجرّدةً فسقطت على
   `action: 'rubric.create'`، وهو **نصُّ فعلٍ في سجلّ الأثر** لا استعلام. فكادت
   تُدين ملفًّا يكتب في الروبرك الحيّ. و`gradingRubric` لا يطابق: بعد `prisma.`
   يأتي اسمُه كاملا لا `rubric`. */
const WRITE = /\b(?:prisma|tx)\s*\.\s*rubric\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/

describe('روبركٌ واحدٌ حيّ — والآخرُ لا يُكتب فيه', () => {
  const files = [...walk('server'), ...walk('scripts')]

  it('المسحُ يجد ملفّاتِ الخادم فعلا — فلا يمرّ بصفرٍ كاذب', () => {
    expect(files.length, 'تعطّل المسحُ نفسُه').toBeGreaterThan(50)
    expect(files).toContain('server/services/assessment.service.ts')
  })

  it('ولا سطرَ يكتب في `Rubric` الميّت', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(join(root, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      return WRITE.test(src)
    })
    expect(
      offenders,
      'كُتب في `Rubric` وهو الجدولُ الميّت. الحيُّ `GradingRubric` — معاييرُ صفوفا '
      + `على تكليفِ الشعبة، تكتبه assessment.service:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('و`GradingRubric` الحيُّ ما زال مكتوبا فيه — وإلّا فالميّتُ هو الآخر', () => {
    const svc = readFileSync(join(root, 'server/services/assessment.service.ts'), 'utf8')
    expect(svc, 'الروبرك الحيُّ لم يعد يُكتب — فأيُّهما الحيّ؟').toMatch(/gradingRubric\s*\.\s*create/)
  })

  /* والعلّةُ مكتوبةٌ حيث يقع عليها من يفتح المخطّط — لا في اختبارٍ وحدَه */
  it('والمخطّطُ يقول أيُّهما الحيُّ عند النموذج نفسِه', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
    const block = schema.slice(schema.indexOf('model Rubric {') - 1400, schema.indexOf('model Rubric {'))
    expect(block, 'النموذجُ الميّتُ بلا تحذيرٍ فوقه').toContain('GradingRubric')
  })
})
