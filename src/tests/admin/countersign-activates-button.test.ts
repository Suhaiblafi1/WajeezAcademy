/* زرُّ الاعتماد يقول ما يفعل، وجوابُه يُرسَم حيث ضُغط.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «عندما أقوم بتوقيع الاتفاقية منّي
 * كأدمن لا يتمّ التوقيع ولا يتغيّر شيءٌ بالصفحة».
 *
 * وشيئان اجتمعا عليه:
 *
 * ① الخادمُ كان يردّ 409 على كلّ عرضٍ مشروط (أُصلح في الخدمة، ويحرسه
 *   `server/tests/trainer/countersign-activates.test.ts`).
 * ② و**رسالةُ الردّ تُرسَم في رأس الصفحة**. والقائمةُ عشرةُ عقودٍ في كلّ
 *   صفحة، فموضعُ الضغط قد يكون تحت الرأس بشاشتَين — فمن ضغط لم يرَ شيئا.
 *   وهذا وحدَه يعيد البلاغَ بعينه على أيّ ردٍّ آخرَ يأتي من الخادم: بوّابةُ
 *   التجهيز، وحارسُ التضارب، ونقصُ الصلاحيّة.
 *
 * ── وما يُقاس ──
 *
 * أنّ الأزرارَ التي تقرّر في صفٍّ تمرّر معرّفَ صفّها إلى `run`، وأنّ الصفَّ
 * يرسم `rowErr` حين يطابق. ويُقاس على **كتلة الزرّ** لا على الملفّ: الشاشةُ
 * فيها أزرارٌ أخرى جوابُها يخصّ الصفحةَ كلَّها بحقّ (تركيبُ عقدٍ جديد،
 * وتحميلُ القائمة) — فمسحٌ على الملفّ يخضرّ على جار.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = bare('src/pages/admin/TrainerContracts.tsx')

/** كتلةٌ من رأسها إلى الحدّ الذي يليه — فارغةٌ إن لم يوجد الرأس */
function block(src: string, head: string, end: string): string {
  const at = src.indexOf(head)
  if (at < 0) return ''
  const stop = src.indexOf(end, at + head.length)
  return src.slice(at, stop < 0 ? undefined : stop)
}

/** كتلةُ زرٍّ بعينها — من `onClick` السابق لنداء المسار إلى إغلاق النداء.
 *
 *  ولا نافذةٌ بعددٍ من الأحرف: صفُّ الأفعال يحمل أزرارا متجاورةً تنادي
 *  مساراتٍ متشابهة، فنافذةٌ واسعةٌ تقرأ جارا وتخضرّ عليه. */
function callBlock(route: string): string {
  const at = SCREEN.indexOf(route)
  if (at < 0) return ''
  const open = SCREEN.lastIndexOf('onClick', at)
  const close = SCREEN.indexOf('}>', at)
  return open < 0 || close < 0 ? '' : SCREEN.slice(open, close)
}

const SEAL = callBlock('/countersign`')
/* ═══ ورفضُ التوقيع انتقل إلى نافذةٍ (٢٦ سبتمبر ٢٠٢٦) ═══

   كان سببُ الرفض يُكتب في `window.prompt` — والنصُّ يصل المدرّبَ حرفا بحرف،
   والمتصفّحُ يملك كتمَ الحوار فيردّ فراغا بلا أن يقول لماذا. فصار يُكتب في
   `ConfirmAction` كسائر ما لا رجعةَ فيه.

   والخصلةُ المحروسةُ هي هي: **ردُّ الخادم يُرسَم عند الصفّ لا في رأس
   الصفحة.** وموضعُ التمرير انتقل معه: كان `run(..., c.id)` في الزرّ، وصار
   `rowId: c.id` في وصف النافذة و`asking.rowId` في ندائها. فيُقاس الطرفان —
   أنّ الزرَّ يحمل معرّفَ صفّه، وأنّ النافذةَ تمرّره إلى `run`. وبأحدهما
   وحدَه يسقط الوصلُ صامتا. */
const REJECT = callBlock('/reject-signature`')

describe('جوابُ القرار يُرسَم في صفّه', () => {
  it('والكتلتان مقروءتان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(SEAL, 'لم تُقرأ كتلةُ زرّ الاعتماد').not.toBe('')
    expect(REJECT, 'لم تُقرأ كتلةُ زرّ رفض التوقيع').not.toBe('')
    expect(SEAL.length, 'الكتلةُ المقروءةُ أقصرُ من أن تكون هي').toBeGreaterThan(200)
  })

  it('الاعتمادُ يمرّر معرّفَ صفّه، فيُقرأ ردُّ الخادم عند الزرّ لا في الرأس', () => {
    expect(SEAL, 'عاد جوابُ الاعتماد إلى رأس الصفحة').toMatch(/,\s*c\.id\)$/)
  })

  it('ورفضُ التوقيع مثلُه — فالبلاغُ لا يعود من بابٍ آخر', () => {
    expect(REJECT, 'زرُّ رفض التوقيع لا يحمل معرّفَ صفّه إلى النافذة')
      .toMatch(/rowId:\s*c\.id/)
    /* والنافذةُ تمرّره إلى `run` — فبلا هذا يُحمَل المعرّفُ ولا يُقرأ */
    expect(SCREEN, 'نافذةُ السبب لا تمرّر معرّفَ الصفّ، فيعود الجوابُ إلى الرأس')
      .toMatch(/asking\.okAr,\s*asking\.rowId\)/)
  })

  it('والصفُّ يرسم خطأه حين يطابق معرّفُه', () => {
    expect(SCREEN, 'لا موضعَ يرسم خطأَ الصفّ، فالتمريرُ بلا قارئ')
      .toMatch(/rowErr\?\.id === c\.id/)
  })
})

describe('الزرُّ يقول ما سيفعل', () => {
  /* ═══ واعتمادُ التوقيع ليس توقيعَنا (١ أكتوبر ٢٠٢٦) ═══
     كان «اعتمِدْ وفعِّلْ» على العرض المشروط، ويختمه عنّا في النقرة نفسِها —
     فسأل صاحبُ المنصّة: «عندما أصادق على توقيعٍ هل هذا معناه أنّنا وقّعنا؟».
     فصار الزرُّ يقول ما يقع بحكم `signatureApprovalOf` نفسِه الذي يقرؤه الخادم:
     يعتمد التوقيعَ ويفتح البوّابة، أو يوقّع عنّا — ولا يعود الاسمُ الذي أخفى
     أنّ الضغطَ توقيع. */
  it('يفرّق بين اعتمادِ توقيعٍ يفتح البوّابةَ بلا توقيعٍ منّا وخَتمِ عقدٍ غيرِ مشروط', () => {
    expect(SCREEN, 'الزرُّ لا يقول إن كان يوقّع عنّا')
      .toContain('signatureApprovalOf(c) === "seal" ? "اعتمِدْ ووقِّعْ عن الأكاديميّة" : "اعتمِدِ التوقيعَ وافتحْ بوّابتَه"')
    /* والزرُّ الأوّلُ قبل فتح الحقل يُسأل الحكمُ عنه فرعا فرعا (٢ أكتوبر ٢٠٢٦): صار لغير
       المشروط زرّان — «كالعقود الجديدة» و«اعتمِدْ ووقِّعْ الآن» — والعرضُ المشروطُ زرُّه
       يعتمد التوقيعَ وحدَه. فيُقاس أنّ زرَّ الخَتم في فرع `seal` لا في غيره. */
    const at = SCREEN.indexOf('<PlainContractChoices />')
    expect(at, 'لا فرعَ لأزرار العقد غير المشروط').toBeGreaterThan(0)
    const asked = SCREEN.lastIndexOf('signatureApprovalOf(c) === "seal"', at)
    expect(SCREEN.slice(asked, at), 'فرعُ الأزرار لا يُسأل فيه الحكمُ أنّه `seal`')
      .toMatch(/^signatureApprovalOf\(c\) === "seal"\s*\?\s*\(\s*<>\s*$/)
    const sealBranch = SCREEN.slice(at, SCREEN.indexOf('</>', at))
    expect(sealBranch, 'لا زرَّ يوقّع الآن في فرع غير المشروط').toContain('طابقتُ الاسمَ — اعتمِدْ ووقِّعْ الآن')
    const otherwise = SCREEN.slice(SCREEN.indexOf('</>', at), SCREEN.indexOf('</Button>', SCREEN.indexOf('</>', at)))
    expect(otherwise, 'زرُّ العرض المشروط لا يقول إنّه يعتمد التوقيعَ وحدَه').toContain('طابقتُ الاسمَ — اعتمِدِ التوقيع')
    expect(otherwise, 'زرُّ العرض المشروط يقول إنّه يوقّع').not.toMatch(/ووقِّعْ/)
    expect(SCREEN, 'عاد الاسمُ الذي أخفى أنّ الضغطَ توقيعٌ منّا').not.toContain('اعتمِدْ وفعِّلْ')
  })


  /* ═══ والسطرُ فوق الزرّ لا يَعِد بنفاذ (١ أكتوبر ٢٠٢٦) ═══
     ظهر في لقطة الشاشة بعد تغيير الزرّ: «طابِقِ الاسمَ… — فبالاعتماد ينفذ
     العقدُ» على عرضٍ مشروطٍ لا نوقّعه إلّا باعتماد دوراته. فالزرُّ صدق والسطرُ
     فوقه بقي على #308. ويُقاس فرعا الحكم كلٌّ بحرفه، لا ورودُ كلمةٍ في الملفّ:
     الملفُّ يقول «ينفذ» صادقا في فرع الخَتم. */
  /* والسطرُ يُقرأ من سجلٍّ بحكم الخادم (`APPROVAL_LINE_AR`)، مقفلٍ بالنوع: لكلّ
     حكمٍ جملتُه (٢ أكتوبر ٢٠٢٦ صار الحكمُ ثلاثا). فيُقاس أنّ السطرَ يسأله، ثمّ
     كلُّ جملةٍ بحرفها. */
  it('والسطرُ فوق الزرّ يقول ما يقع بحكم الخادم — والعرضُ المشروطُ لا ينفذ باعتماد توقيعه', () => {
    const at = SCREEN.indexOf('طابِقِ الاسمَ')
    expect(at, 'لم يُقرأ سطرُ «طابِقِ الاسمَ» — فالحارسُ يقيس الفراغ').toBeGreaterThan(0)
    const line = SCREEN.slice(at, SCREEN.indexOf('</p>', at))
    expect(line, 'السطرُ لا يسأل حكمَ الخادم — فيقول للأبواب جملةً واحدة')
      .toContain('{APPROVAL_LINE_AR[signatureApprovalOf(c)]}')
    expect(line.slice(0, line.indexOf('{APPROVAL_LINE_AR')), 'وُعد بالنفاذ قبل أن يُسأل الحكم')
      .not.toMatch(/ينفذ|نافذ|نفَذ/)
    const table = /const APPROVAL_LINE_AR: Record<SignatureApproval, string> = \{([\s\S]*?)\};/.exec(SCREEN)
    expect(table, 'لم يُقرأ سجلُّ السطر').not.toBeNull()
    const lines = Object.fromEntries([...table![1].matchAll(/(\w+): "([^"]*)"/g)].map((m) => [m[1], m[2]]))
    expect(Object.keys(lines).sort()).toEqual(['approve_only', 'seal', 'sealed_by_text'])
    expect(lines.approve_only, 'قال السطرُ إنّ العرضَ المشروطَ ينفذ باعتماد توقيعه').not.toMatch(/ينفذ|نافذ|نفَذ|نوقّع عن/)
    expect(lines.approve_only, 'لم يُقل متى نوقّع').toContain('ولا نوقّع العرضَ إلّا يومَ نعتمد دوراتِه')
    expect(lines.seal, 'لم يُقل إنّ اعتمادَ غيرِ المشروط توقيعٌ منّا').toContain('نوقّع عن الأكاديميّة')
    expect(lines.sealed_by_text, 'لم يُعرض الخياران لمن وقّع نصّا سابقا').toMatch(/كما وقّعه[\s\S]*للتوقيع على النصّ الحاضر/)
    expect(lines.sealed_by_text, 'لم يُذكر «كالعقود الجديدة» أوّلَ الخيارات').toMatch(/كالعقود الجديدة[\s\S]*كما وقّعه/)
  })

  /* وشاشةُ خطوات التجهيز تعتمد التوقيعَ من بابٍ ثانٍ — وكانت تقول «نفَذ العقدُ»
     بعد كلّ اعتماد. ورسالتُها ثابتةٌ تُمرَّر إلى `run`، فتُقرأ فرعاها. */
  it('وشاشةُ خطوات التجهيز مثلُها — لا «نفَذ العقدُ» بعد اعتماد توقيع عرضٍ مشروط', () => {
    const PREP = bare('src/pages/admin/PreparationSteps.tsx')
    const at = PREP.indexOf('/countersign`')
    expect(at, 'لم يُقرأ بابُ الاعتماد في خطوات التجهيز').toBeGreaterThan(0)
    const block = PREP.slice(at, PREP.indexOf('</Button>', at))
    const m = /gatesActivation === false\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/.exec(block)
    expect(m, 'رسالةُ النجاح جملةٌ واحدةٌ للبابَين').not.toBeNull()
    expect(m![2], 'قالت الشاشةُ إنّ العرضَ المشروطَ نفَذ باعتماد توقيعه').not.toMatch(/ينفذ|نافذ|نفَذ/)
    expect(m![2], 'لم يُقل متى نوقّع').toContain('ونوقّع العرضَ حين تعتمد دوراتِه')
  })

  it('ورسالةُ النجاح تُقرأ من جواب الخادم لا من ظنّ الشاشة', () => {
    /* `sealed` يردّه الخادمُ عن الصفّ الذي اعتُمد فعلا: خُتم أم اعتُمد توقيعُه
       وحدَه. وشاشةٌ تقول «وُقّع» من عندها تقولها على ردٍّ لم تقرأه. */
    expect(SEAL, 'الشاشةُ تقول ما وقع من عندها').toContain('r.sealed')
    expect(SEAL, 'لا يُقال إنّا لم نوقّع العرض').toContain('ولم نوقّع العرض: نوقّعه حين تعتمد دوراتِه')
  })
})

/* ═══ وقّع نصّا سابقا: الفرقُ والخياراتُ — والقرارُ للمعتمِد (٢ أكتوبر ٢٠٢٦) ═══

   كان الصندوقُ يقول «لا يُعتمَد بنصّه… فأعِدْه للتوقيع»، فلا يبقى إلّا بابٌ
   واحد. فقال صاحبُ المنصّة: «Do not force me to do any action. Do always give
   me options and tell me what are the differences». فيُقاس هنا على البنية:
   أنّ الفرقَ يُحسب من سجلّ التغييرات بإصدار الصفّ، وأنّ الخياراتِ الثلاثةَ تُعرض
   بأثرها، وأنّ «اعتمِدْه كما وقّعه» يصل الخادمَ صريحا ولا يسقط في الطريق. */
describe('وقّع نصّا سابقا: الفرقُ والخياراتُ — والقرارُ للمعتمِد', () => {
  const BOX = block(SCREEN, 'function SignedEarlierText(', '\nfunction ')
  const at = SCREEN.indexOf('signatureApprovalOf(c) === "sealed_by_text"')
  const BRANCH = at < 0 ? '' : SCREEN.slice(at, SCREEN.indexOf('</>', at))

  it('الكتلتان مقروءتان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(BOX, 'لم يُقرأ صندوقُ النصّ السابق').not.toBe('')
    expect(BRANCH, 'لا يُسأل الحكمُ عن الصفّ قبل أن تُعرض الخيارات').not.toBe('')
  })

  it('⚠️ يُعرض الفرقُ بين ما وقّعه والنصّ الحاضر — من سجلّ التغييرات بإصدار صفّه', () => {
    expect(BOX, 'لا يُحسب الفرقُ بإصدار ما وقّعه').toMatch(/changeGroupsBetween\(c\.bodyVersion, CONTRACT_BODY_VERSION/)
    expect(BOX, 'حُسب الفرقُ ولم يُعرض بنودا').toContain('.itemsAr.map(')
    expect(BRANCH, 'الصفُّ لا يعرض الفرقَ مكانَ الزرّ').toContain('<SignedEarlierText c={c} />')
  })

  it('⚠️ والخياراتُ الثلاثةُ تُعرض بأثرها — و«اعتمِدْه كما وقّعه» زرٌّ جنبَ أخويه', () => {
    for (const label of ['«اعتمِدْه كما وقّعه»', '«حُدّث النصُّ — أعِدْه للتوقيع»', '«لم يطابق — ارفضْ»']) {
      expect(BOX, `لم يُعرض خيار ${label}`).toContain(label)
    }
    expect(BOX, 'لم يُقل أثرُ الاعتماد كما وقّعه').toContain('{ACCEPT_AS_SIGNED_AR}')
    const accept = /const ACCEPT_AS_SIGNED_AR = ([\s\S]*?);\n/.exec(SCREEN)?.[1] ?? ''
    expect(accept, 'لم يُقل إنّه يوقّع الآن قبل اعتماد دوراته').toMatch(/فنوقّعه الآن[\s\S]*قبل اعتماد دوراته/)
    expect(BRANCH, 'لا زرَّ يعتمده كما وقّعه').toContain('طابقتُ الاسمَ — اعتمِدْه كما وقّعه')
    expect(BRANCH, 'الزرُّ لا يقول للصندوق إنّه اعتمادٌ كما وقّعه').toContain('asSigned: true')
  })

  it('⚠️ و«كما وقّعه» يصل الخادمَ صريحا — ولا يسقط بكتابة الملحوظة', () => {
    expect(SEAL, 'لا يُرسَل الطلبُ الصريحُ فيردّه الخادم').toContain('asSigned ? { asSigned: true } : {}')
    /* والملحوظةُ تُكتب في الصندوق نفسِه: لو بُني الصفُّ من جديدٍ بلا `asSigned`
       لَسقط الطلبُ بأوّل حرفٍ وردّه الخادمُ بالخيارين بعد أن اختار المعتمِد. */
    expect(SCREEN, 'كتابةُ الملحوظة تُسقط «كما وقّعه»').toContain('setSignOff({ ...signOff, noteAr: e.target.value })')
    expect(SCREEN, 'زرُّ التأكيد لا يقول إنّه يوقّع الآن').toContain('"اعتمِدْه كما وقّعه — ونوقّعه الآن"')
  })
})

/* ═══ و«اعتمِدْه كالعقود الجديدة» — خيارُ صاحب المنصّة (٢ أكتوبر ٢٠٢٦) ═══

   سأل: «لماذا لا يمكن أن أجعل العقودَ الموقَّعة كالعقود الجديدة؟ كودٌ أم لأنّه
   غيرُ مكتوبٍ بالعقد؟». فقيل له: النصّ — نصُّه يجعل الاعتمادَ توقيعا، والزرُّ
   يغيّر ما تقوله المنصّةُ لا ما وقّعه. فاختاره («Option 4»).

   فيُقاس على البنية: أنّه أوّلُ الخيارات في الصندوق وزرُّه الرئيسُ أوّلُ الأزرار،
   وأنّ أثرَه مكتوبٌ بما يبقى (لا نوقّع الآن، ونصُّه الموقَّعُ كما هو)، وأنّه يصل
   الخادمَ صريحا (`likeNew`) لا `asSigned`، وأنّ التأكيدَ والنجاحَ لا يقولان «وقّعنا». */
describe('«اعتمِدْه كالعقود الجديدة»: الخيارُ الأوّلُ — وأثرُه مكتوبٌ بما يبقى', () => {
  const BOX = block(SCREEN, 'function SignedEarlierText(', '\nfunction ')
  const at = SCREEN.indexOf('signatureApprovalOf(c) === "sealed_by_text"')
  const BRANCH = at < 0 ? '' : SCREEN.slice(at, SCREEN.indexOf('</>', at))
  const LIKE_NEW = /const LIKE_NEW_AR = ([\s\S]*?);\n/.exec(SCREEN)?.[1] ?? ''
  /** الزرُّ الذي يحمل هذا الاسم — من `<Button` قبله إلى الاسم */
  const buttonOf = (src: string, label: string) => {
    const end = src.indexOf(label)
    return end < 0 ? '' : src.slice(src.lastIndexOf('<Button', end), end)
  }

  it('الكتلُ مقروءة — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(BOX).not.toBe('')
    expect(BRANCH).not.toBe('')
    expect(LIKE_NEW, 'لم تُقرأ جملةُ «كالعقود الجديدة»').not.toBe('')
  })

  it('⚠️ أوّلُ الخيارات في الصندوق — وأثرُه: لا نوقّع الآن، ونصُّه الموقَّعُ كما هو', () => {
    expect(BOX, 'لم يُعرض خيارُ «كالعقود الجديدة»').toContain('«اعتمِدْه كالعقود الجديدة»')
    expect(BOX.indexOf('«اعتمِدْه كالعقود الجديدة»'), 'ليس أوّلَ الخيارات')
      .toBeLessThan(BOX.indexOf('«اعتمِدْه كما وقّعه»'))
    expect(BOX, 'لم يُقل أثرُه في الصندوق').toContain('{LIKE_NEW_AR}')
    expect(LIKE_NEW, 'لم يُقل إنّا لا نوقّع إلّا يومَ نعتمد دوراتِه').toContain('ولا نوقّعه إلّا يومَ نعتمد دوراتِه')
    expect(LIKE_NEW, 'لم يُقل إنّ نصَّه الموقَّعَ باقٍ يقول غيرَ ذلك')
      .toMatch(/ونصُّه الموقَّعُ باقٍ كما هو[\s\S]*اعتمادَ توقيعه توقيعٌ منّا/)
  })

  it('⚠️ وزرُّه الرئيسُ أوّلُ الأزرار — ويقول للصندوق `likeNew` لا `asSigned`', () => {
    const likeNew = buttonOf(BRANCH, 'طابقتُ الاسمَ — اعتمِدْه كالعقود الجديدة')
    expect(likeNew, 'لا زرَّ يعتمده كالعقود الجديدة').not.toBe('')
    expect(likeNew, 'ليس الزرَّ الرئيس').toContain('tone="confirm"')
    expect(likeNew, 'الزرُّ لا يقول للصندوق إنّه «كالعقود الجديدة»').toContain('likeNew: true')
    expect(likeNew, 'الزرُّ يطلب الخَتمَ وهو يقول «كالعقود الجديدة»').not.toContain('asSigned')
    const asSigned = buttonOf(BRANCH, 'طابقتُ الاسمَ — اعتمِدْه كما وقّعه')
    expect(asSigned, 'سقط خيارُ «كما وقّعه»').toContain('asSigned: true')
    expect(BRANCH.indexOf('likeNew: true'), 'ليس أوّلَ الأزرار').toBeLessThan(BRANCH.indexOf('asSigned: true'))
  })

  it('⚠️ ويصل الخادمَ صريحا — والتأكيدُ والنجاحُ لا يقولان «وقّعنا»', () => {
    expect(SEAL, 'لا يُرسَل اختيارُه فيردّه الخادمُ بالخيارات').toContain('likeNew ? { likeNew: true } : {}')
    /* والأثرُ بحكم الصفّ: `LIKE_NEW_AR` لما نصُّه يقول غيرَه، و`LIKE_NEW_PLAIN_AR` لغير
       المشروط (٢ أكتوبر ٢٠٢٦) — وكلاهما في الفرع الذي يُفتح بـ`signOff.likeNew` */
    expect(SCREEN, 'نافذةُ التأكيد لا تقول أثرَه')
      .toMatch(/signOff\.likeNew && \([\s\S]{0,260}signatureApprovalOf\(c\) === "seal" \? LIKE_NEW_PLAIN_AR : LIKE_NEW_AR\}/)
    expect(SCREEN, 'زرُّ التأكيد لا يقول إنّا لا نوقّع الآن').toContain('"اعتمِدْه كالعقود الجديدة — ولا نوقّع الآن"')
    const ok = /if \(likeNew\) return "([^"]*)"/.exec(SEAL)?.[1] ?? ''
    expect(ok, 'لا رسالةَ نجاحٍ له — فيقع على جملةِ غيره').not.toBe('')
    expect(ok, 'قال النجاحُ إنّا وقّعنا').not.toMatch(/وقّعناه|نفَذ|نافذ/)
    expect(ok, 'لم يُقل متى نوقّع').toContain('ونوقّعه حين تعتمد دوراتِه')
  })
})

/* ═══ وعقدٌ غيرُ مشروط: «كالعقود الجديدة» أو «اعتمِدْ ووقِّعْ الآن» — والقرارُ لك (٢ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة عن مدرّبَين أنهى تعاقدَهما ثمّ ركّب لهما عقدا جديدا: «لم أتمكّن من
   اعتمادهم بالعقد الجديد ليكون تطابقُ الاسم ليس اعتمادا نهائيّا للعقد». وكان صفُّ العقد
   غيرِ المشروط يعرض «اعتمِدْ ووقِّعْ» وحدَه. فيُقاس على البنية: أنّ الخيارين يُعرضان بأثرهما
   والعلّةُ معهما، وأنّ «كالعقود الجديدة» أوّلُ الأزرار ويصل الخادمَ `likeNew`، وأنّ نجاحَه
   لا يقول «وقّعنا»، وأنّ صفَّه بعد الاعتماد يحمل زرَّ «وقِّعْه الآن» إلى `/seal` بتأكيدٍ
   يقول أثرَه — فلا يبقى العقدُ بلا توقيعنا أبدا. */
describe('عقدٌ غيرُ مشروط: «كالعقود الجديدة» أوّلا، ثمّ «وقِّعْه الآن» من صفّه', () => {
  const BOX = block(SCREEN, 'function PlainContractChoices(', '\nfunction ')
  const at = SCREEN.indexOf('<PlainContractChoices />')
  const BRANCH = at < 0 ? '' : SCREEN.slice(at, SCREEN.indexOf('</>', at))
  const LIKE_NEW_PLAIN = /const LIKE_NEW_PLAIN_AR = ([\s\S]*?);\n/.exec(SCREEN)?.[1] ?? ''
  const SEAL_NOW = /const SEAL_NOW_AR = ([\s\S]*?);\n/.exec(SCREEN)?.[1] ?? ''
  /* لوحُ ما بعد الاعتماد: من شرطه إلى نهاية لوحه */
  const headAt = SCREEN.indexOf('c.status === "signature_approved" && !c.gatesActivation')
  const AFTER = headAt < 0 ? '' : SCREEN.slice(headAt, SCREEN.indexOf('</Panel>\n                    )}', headAt))
  const SEAL_LATER = (() => {
    const route = AFTER.indexOf('/seal`')
    if (route < 0) return ''
    return AFTER.slice(AFTER.lastIndexOf('onClick', route), AFTER.indexOf('}>', route))
  })()
  const buttonOf = (src: string, label: string) => {
    const end = src.indexOf(label)
    return end < 0 ? '' : src.slice(src.lastIndexOf('<Button', end), end)
  }

  it('الكتلُ مقروءة — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(BOX, 'لم يُقرأ صندوقُ الخيارين').not.toBe('')
    expect(BRANCH, 'لم يُقرأ فرعُ أزرار غير المشروط').not.toBe('')
    expect(LIKE_NEW_PLAIN, 'لم تُقرأ جملةُ أثر «كالعقود الجديدة» لغير المشروط').not.toBe('')
    expect(SEAL_NOW, 'لم تُقرأ جملةُ أثر التوقيع الآن').not.toBe('')
    expect(AFTER, 'لم يُقرأ لوحُ ما بعد الاعتماد').not.toBe('')
    expect(SEAL_LATER, 'لم تُقرأ كتلةُ «وقِّعْه الآن»').not.toBe('')
  })

  it('⚠️ الصندوقُ يقول علّةَ خروجه غيرَ مشروط، ثمّ الخيارين بأثرهما — «كالعقود الجديدة» أوّلا', () => {
    expect(BOX, 'لم تُقل العلّة: موادُّه اعتُمدت في عقدٍ سابق ولو انتهى').toMatch(/اعتُمدت في عقدٍ سابق[\s\S]*ولو انتهى/)
    expect(BOX).toContain('{LIKE_NEW_PLAIN_AR}')
    expect(BOX).toContain('{SEAL_NOW_AR}')
    expect(BOX.indexOf('«اعتمِدْه كالعقود الجديدة»'), 'ليس أوّلَ الخيارات')
      .toBeLessThan(BOX.indexOf('«اعتمِدْ ووقِّعْ الآن»'))
    expect(BRANCH, 'الصندوقُ لا يُعرض فوق الأزرار').not.toBe('')
  })

  it('⚠️ وأثرُ «كالعقود الجديدة»: لا نوقّع الآن، ونوقّعه من صفّه، ولا ينفذ قبلها — ولا تُمسّ حالتُه', () => {
    expect(LIKE_NEW_PLAIN, 'لم يُقل إنّا لا نوقّعه الآن').toContain('ولا نوقّعه الآن')
    expect(LIKE_NEW_PLAIN, 'لم يُقل أين يُوقَّع بعد').toContain('«وقِّعْه الآن» في صفّه')
    expect(LIKE_NEW_PLAIN, 'لم يُقل إنّه لا ينفذ قبل توقيعنا').toContain('ولا ينفذ حتّى نوقّعه')
    expect(LIKE_NEW_PLAIN, 'لم يُقل إنّ حالتَه لا تُمسّ').toContain('وحالتُه كما هي')
    /* ونصُّه لا يقول غيرَ ذلك — فلا يُنقل إليه تنبيهُ `LIKE_NEW_AR` عن نصٍّ يخالفه */
    expect(LIKE_NEW_PLAIN, 'قيل إنّ نصَّه يجعل الاعتمادَ توقيعا — وليس كذلك').not.toMatch(/توقيعٌ منّا/)
    expect(SEAL_NOW, 'لم يُقل إنّ التوقيعَ الآن يُنفذه').toMatch(/نوقّعه عن الأكاديميّة الآن فينفذ/)
  })

  it('⚠️ «كالعقود الجديدة» أوّلُ الأزرار وزرُّها الرئيس، ويقول للصندوق `likeNew` — والثاني يوقّع كما كان', () => {
    const likeNew = buttonOf(BRANCH, 'طابقتُ الاسمَ — اعتمِدْه كالعقود الجديدة')
    expect(likeNew, 'لا زرَّ يعتمده كالعقود الجديدة').not.toBe('')
    expect(likeNew, 'ليس الزرَّ الرئيس').toContain('tone="confirm"')
    expect(likeNew, 'لا يقول للصندوق «كالعقود الجديدة»').toContain('likeNew: true')
    const sealNow = buttonOf(BRANCH, 'طابقتُ الاسمَ — اعتمِدْ ووقِّعْ الآن')
    expect(sealNow, 'سقط خيارُ التوقيع الآن').not.toBe('')
    expect(sealNow, 'زرُّ التوقيع الآن يقول «كالعقود الجديدة»').not.toContain('likeNew')
    expect(BRANCH.indexOf('likeNew: true'), 'ليس أوّلَ الأزرار')
      .toBeLessThan(BRANCH.indexOf('طابقتُ الاسمَ — اعتمِدْ ووقِّعْ الآن'))
  })

  it('⚠️ ونجاحُه لا يقول «وقّعنا» ولا «فُتحت بوّابتُه» — بل أين يُوقَّع', () => {
    const ok = /if \(likeNew && plain\) return "([^"]*)"/.exec(SEAL)?.[1] ?? ''
    expect(ok, 'لا رسالةَ نجاحٍ لغير المشروط — فيقع على جملةِ العرض المشروط').not.toBe('')
    expect(ok, 'قال النجاحُ إنّا وقّعنا').not.toMatch(/وقّعناه|نفَذ|نافذ/)
    expect(ok, 'قال إنّ بوّابتَه فُتحت — وهي مفتوحةٌ أصلا').not.toContain('بوّابتُه')
    expect(ok, 'لم يُقل أين يُوقَّع').toContain('وقِّعْه من صفّه')
    expect(SEAL, '«plain» لا يُسأل من الحكم').toContain('const plain = signatureApprovalOf(c) === "seal"')
  })

  it('⚠️ وبعد الاعتماد: موادُّه تُقرأ، و«وقِّعْه الآن» يصل `/seal` بتأكيدٍ يقول أثرَه — وجوابُه في صفّه', () => {
    expect(AFTER, 'موادُّ دوراته لا تُفتح فوق الزرّ').toContain('<MaterialsReview profileId={c.profile.id} />')
    expect(AFTER, 'التأكيدُ لا يقول أثرَ التوقيع').toContain('{SEAL_NOW_AR}')
    expect(AFTER, 'لا زرَّ يفتح نافذةَ التوقيع').toContain('setSealing({ id: c.id, noteAr: "" })')
    expect(SEAL_LATER, 'جوابُ التوقيع لا يُرسَم في صفّه').toMatch(/,\s*c\.id\)$/)
    expect(SEAL_LATER, 'لا تُرسَل الملحوظة').toContain('noteAr: sealing.noteAr.trim() || null')
    expect(AFTER, 'خطأُ الصفّ لا يُرسَم في لوحه').toContain('rowErr?.id === c.id')
    /* وسطرُ العرض المشروط («وفُتحت بوّابتُه») لا يقع على غير المشروط */
    expect(SCREEN, 'سطرُ العرض المشروط يقع على غير المشروط')
      .toContain('c.status === "signature_approved" && c.gatesActivation && (')
  })
})
