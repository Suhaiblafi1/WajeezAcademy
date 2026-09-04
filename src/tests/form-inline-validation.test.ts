/* الخطأُ يُقال عند الحقل الذي رُفض — لا في ذيل النموذج ولا بزرٍّ مطفأ صامت.

   العطبُ الذي وُلد منه هذا الملفّ واحدٌ في ثلاثة نماذج:

   • **حسابُ الطالب** كان يقيس حقلا واحدا (`displayName`) ويطفئ «احفظ» على
     البقيّة أصلا لا يقيسها؛ فمن كتب رابط صورةٍ أطولَ من حدّ الخادم يضغط
     «احفظ» فيذهب نداءٌ يعرف الخادمُ أنّه مردود، ويرجع بخطأٍ عامّ في ذيل
     الصفحة. والزرُّ المطفأ أسوأ: ضغطةٌ لا جواب لها، وسببٌ قد يكون في حقلٍ
     خارج الشاشة.
   • **طلبُ انضمام المدرّب** كان يقول ما بقي في قائمةٍ أسفلَ النموذج، ولا
     يقول **أين** هو: من أخطأ في بريده يقرأ «بريد إلكتروني صحيح» ثمّ يمسح
     الحقولَ بعينه.
   • **معالجُ الشعبة** كان يطفئ «التالي» على تعبيرٍ فيه خمسةُ شروط، وخطوتاه
     الأولى والثالثة لا تقولان شيئا.

   والشرطان اللذان يجعلان الرسالةَ مفيدةً حقّا — وهما ما يُحرَس هنا:
   ١) تظهر **عند الحقل**، موصولةً به لقارئ الشاشة (`aria-invalid` تقول إنّ
      فيه خطأً، و`aria-describedby` تقول ما هو).
   ٢) ولا تظهر **قبل أن يُلمس** الحقل — فاللومُ على حقلٍ لم يُفتح بعد ليس
      إرشادا؛ ولذلك `onBlur` هو ما يفتحها.

   والاختبارُ يقرأ المصدر لأنّ ما يُحرَس هيئةُ وصلٍ لا سلوكُ زمنِ تشغيل:
   حذفُ `aria-describedby` من حقلٍ لا يُسقط أيَّ اختبارٍ سلوكيّ، ويُسقط
   الرسالةَ من أذن من لا يرى الشاشة. */

import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const JOIN = 'src/pages/JoinTrainer.tsx'
const ACCOUNT = 'src/pages/student/Account.tsx'
const WIZARD = 'src/pages/admin/CohortWizard.tsx'
const KIT = 'src/components/FormKit.tsx'

describe('التحقّق الفوريّ في النماذج', () => {
  it('لبِنةُ الحقل تحمل رسالةَ خطئها وتصلها بالحقل', () => {
    const kit = read(KIT)
    /* `Field` و`FieldSet` كلاهما يأخذ `error` ويعرضه بـ`FieldError` */
    expect(kit).toContain('error?: string | null')
    expect(kit).toMatch(/export function FieldError\(/)
    expect(kit).toContain("role=\"alert\"")
    /* والوصلُ لقارئ الشاشة: السمتان معا لا إحداهما */
    const invalid = kit.slice(kit.indexOf('export function invalidProps'))
    expect(invalid).toContain("'aria-invalid': true")
    expect(invalid).toContain("'aria-describedby': errorId")
  })

  it('طلبُ الانضمام: كلُّ حقلٍ له رسالةٌ موصولةٌ به، تُفتح عند الخروج منه', () => {
    const src = read(JOIN)
    /* الحقولُ التي يردّها الخادمُ أو تردّها القاعدة — لكلٍّ رسالةٌ ووصلٌ ولمس */
    for (const id of ['jt-name', 'jt-email', 'jt-password', 'jt-password2', 'jt-alt-email']) {
      expect(src, `${id}: لا وصلَ لرسالته`).toContain(`invalidProps("${id}-error"`)
    }
    for (const key of ['name', 'email', 'password', 'password2', 'altEmail', 'accredBody', 'accredOther']) {
      expect(src, `${key}: لا رسالةَ عند حقله`).toContain(`errOf("${key}")`)
      expect(src, `${key}: رسالتُه تظهر قبل أن يُلمس`).toContain(`touch("${key}")`)
    }
    /* ومكتومةٌ حتى اللمس — لا شرطَ آخر */
    expect(src).toMatch(/const errOf = \(k: string\) => \(touched\[k\] \? fieldErrors\[k\] \?\? null : null\)/)
  })

  it('حسابُ الطالب: حدودُ الخادم تُقاس هنا، والزرُّ يُضغط ليقول لا ليصمت', () => {
    const src = read(ACCOUNT)
    /* حدودُ `patchSchema` كلُّها مقيسةٌ قبل النداء — لا الاسمُ وحدَه */
    for (const key of ['displayName', 'avatarUrl', 'phone', 'birthDate', 'careerGoal', 'goalAr']) {
      expect(src, `${key}: لا يُقاس قبل الإرسال`).toContain(`${key}:`)
      expect(src, `${key}: لا رسالةَ عند حقله`).toContain(`errOf("${key}")`)
      expect(src, `${key}: لا وصلَ لرسالته`).toContain(`bad("${key}"`)
    }
    /* «احفظ» لا يُطفأ على حقلٍ مرفوض: يُضغط، ويكشف الرفضَ عند حقله */
    expect(src).toContain('onClick={save} disabled={busy}')
    expect(src).not.toContain('disabled={!canSave || busy}')
    /* والضغطةُ المرفوضةُ لا تُرسل نداءً يُعرف أنّه مردود */
    const save = src.slice(src.indexOf('const save = async'))
    expect(save.slice(0, 400)).toContain('if (!canSave)')
    expect(save.slice(0, 400)).toContain('setTouched(')
    /* والاهتمامُ المرفوضُ يقول سببَه — كان يُرفض بصمتٍ في ثلاث حالات */
    expect(src).toContain('مضافٌ عندك بالفعل')
    expect(src).toContain('اثنا عشر اهتماما هي الحدّ')
  })

  it('معالجُ الشعبة: كلُّ شرطٍ يُطفئ «التالي» له اسمٌ يُقرأ بجانبه', () => {
    const src = read(WIZARD)
    /* لا تعبيرَ منطقيّا يطفئ الزرَّ بلا اسم: الشرطُ يدخل قائمةَ نقصٍ */
    expect(src).toContain('const canNext = stepMissing.length === 0')
    const memo = src.slice(src.indexOf('const stepMissing'), src.indexOf('const canNext'))
    /* كلُّ خطوةٍ لها شروط — والثلاثُ الأولى مذكورةٌ بالاسم */
    for (const step of ['step === 0', 'step === 1', 'step === 2']) {
      expect(memo, `${step}: بلا شروطٍ مسمّاة`).toContain(step)
    }
    /* وعددُ الرسائل بعددِ الشروط — لا شرطَ صامت */
    const pushes = memo.match(/m\.push\(/g) ?? []
    const ifs = memo.match(/\n {6}if \(/g) ?? []
    expect(pushes.length).toBe(ifs.length)
    expect(pushes.length).toBeGreaterThanOrEqual(8)
    /* والقائمةُ تُعرض بجانب الزرّ لا في ذيل الصفحة */
    expect(src).toContain('قبل «التالي»: {stepMissing.join(" · ")}')
  })
})
