/* شاشاتُ الفريق — ما يُطلب من الإنسان أن يعرفه عن ظهر قلب.

   هذا حارسُ **خطِّ أساسٍ ينزل**، لا حارسُ صفرٍ يُشترط اليوم: في الشاشات
   حقولٌ باقيةٌ تطلب معرّفاتٍ، وإحلالُها يحتاج مساراتِ قراءةٍ لم تُكتب بعد.
   فالمشروطُ ألّا يزيد عددُها، وأن ينقص مع كلّ إحلال — كما تفعل بقيّةُ
   خطوط الأساس في هذا المستودَع.

   ── العطبُ الذي وُلد منه ──

   «الصق معرّف التسجيل (UUID)» فوق زرٍّ أحمرَ اسمُه «إسقاط». والمعرّفُ ستّةٌ
   وثلاثون حرفا **لا تظهر على أيّ شاشةٍ في المنصّة** — فلا سبيلَ إلى تعبئته
   إلّا بفتح قاعدة البيانات. وخطأُ لصقٍ واحدٌ يُخرج الطالبَ الخطأ من شعبته،
   ولا اسمَ في الشاشة يُراجَع قبل الضغط.

   وصفه صاحبُ المنصّة في جولة ٨ سبتمبر ٢٠٢٦ بأنّه «غير عمليّ وليس مبنيّا على
   أفضل الممارسات» — وهو وصفٌ دقيق. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx$/.test(name)) out.push(rel)
  }
  return out
}

const SCREENS = [...walk('src/pages'), ...walk('src/components')]

/* الفحصُ على **النصِّ النائب** لا على ورود الحرف: تعليقٌ يشرح ما أُزيل يذكر
   «UUID» ولا يطلب من أحدٍ شيئا. وهي الثغرةُ التي مرّ منها ثلاثةُ حرّاسٍ
   خضراءَ في هذه المنصّة — «طابقوا نصّا في تعليق».

   والمقصودُ **المعرّفُ المُعتِم** وحدَه: قيمةٌ لا يعرفها إنسانٌ ولا تعرضها
   شاشة. أمّا الرمزُ الذي يقرأه صاحبُه ويكتبه من ورقته — `CRS-XXX-000`،
   ورقمُ اجتماع Zoom — فليس منه، ولو سُمّي «معرّفا». فالحدُّ على «UUID»
   صراحةً لا على كلمة «معرّف». */
function uuidPrompts(): string[] {
  const found: string[] = []
  for (const f of SCREENS) {
    const src = readFileSync(join(root, f), 'utf8')
    for (const m of src.matchAll(/placeholder\s*=\s*"([^"]*)"/g)) {
      if (/UUID/i.test(m[1])) found.push(`${f}: ${m[1]}`)
    }
  }
  return found.sort()
}

/* ما بقي، مسمًّى واحدا واحدا. وتسميتُها لا عدُّها: رقمٌ مجرَّدٌ يمرّ ولو
   استُبدل حقلٌ بآخر، والقائمةُ تكشف الاستبدال. */
const REMAINING = [
  'src/pages/admin/Exceptions.tsx: معرف المستشار (UUID)',
  'src/pages/admin/Support.tsx: معرف الوكيل (UUID)',
  'src/pages/admin/TrainerOps.tsx: معرف العقد (UUID)',
  'src/pages/admin/TrainerOps.tsx: معرف مرجع للتوثيق (UUID)',
]

describe('شاشاتُ الفريق · لا يُطلب معرّفٌ لا تعرضه شاشة', () => {
  it('المسحُ يقرأ الشاشاتِ فعلا — فلا يمرّ بصفرٍ كاذب', () => {
    expect(SCREENS.length, 'تعطّل المسحُ نفسُه').toBeGreaterThan(80)
    /* حارسُ الحارس: لو انكسرت قراءةُ النصِّ النائب لخضرّ كلُّ ما بعدها */
    const anyPlaceholder = SCREENS.some((f) =>
      /placeholder\s*=\s*"/.test(readFileSync(join(root, f), 'utf8')))
    expect(anyPlaceholder, 'لم يُقرأ أيُّ نصٍّ نائب').toBe(true)
  })

  it('بطاقةُ الشعبة لا تطلب معرّفا يُلصق — أُحيلت إلى منتقياتٍ بالاسم', () => {
    const src = readFileSync(join(root, 'src/pages/admin/CohortOps.tsx'), 'utf8')
    const prompts = [...src.matchAll(/placeholder\s*=\s*"([^"]*)"/g)].map((m) => m[1])
    expect(prompts.filter((p) => /UUID/i.test(p))).toEqual([])
  })

  it('والباقي لا يزيد — يُسمّى واحدا واحدا وينقص مع كلّ إحلال', () => {
    expect(uuidPrompts()).toEqual(REMAINING)
  })
})
