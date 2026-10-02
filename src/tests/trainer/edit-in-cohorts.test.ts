/* محتوى الدورة بعد اعتمادها يُعبَّأ في «شعبي» — ويُقال ذلك حيث يُبحث عنه
   (٢ أكتوبر ٢٠٢٦).

   بلاغُ صاحب المنصّة: «المدرّبُ يقول لا يستطيع تعديلَ دوراته من مؤهّلاتي».
   وكان بالتصميم: المحرّرُ لدورةٍ قيد الإعداد وحدَها، ويغيب حين تُعتمَد —
   ولا شيءَ في الشاشة يقول أين صار التعديل. وقرارُه: لا موضعَ ثانٍ للتعبئة،
   «المدرّبُ يعبّئ في شعبي، وهناك يتمّم الأمرَ قبل موافقة الأكاديميّة».

   فيُحرس ثلاثة:
   ① «مؤهّلاتي» تقول ذلك وتدلّ على «شعبي» — في فرع القائمة نفسِه، لا في
      فرع الفراغ الذي لا يراه من له دورات.
   ② ولا محرّرَ لدورةٍ معتمَدة: لوحُ الموادّ يعرض ما قيد الإعداد وحدَه،
      والخادمُ يردّ الكتابةَ لما سواه. فلا يُفتح موضعٌ ثانٍ من الباب الخلفيّ.
   ③ والدليلُ يقولها في قسم «مؤهّلاتي» وفي الأسئلة.

   والفحصُ على البنية بعد نزع التعليقات. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FAQ, GUIDE_SECTIONS } from '../../data/trainer-guide/content'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const QUALS = code('src/pages/trainer/Qualifications.tsx')
const PANEL = code('src/pages/trainer/CourseMaterialsPanel.tsx')
const SERVICE = code('server/services/trainer-materials.service.ts')

describe('① «مؤهّلاتي» تدلّ على «شعبي»', () => {
  it('السطرُ في فرع القائمة، ومعه رابطُ «شعبي»', () => {
    const list = QUALS.slice(QUALS.indexOf('ariaLabel="حالُ مؤهّلاتي"') - 1200, QUALS.indexOf('ariaLabel="حالُ مؤهّلاتي"'))
    expect(list, 'لا يقول أين يُعبَّأ محتوى الدورة').toMatch(/تعبّئه في «شعبي»/)
    expect(list, 'لا رابطَ إلى «شعبي»').toMatch(/<Button as=\{Link\} to="\/trainer\/board"/)
  })
})

describe('② ولا موضعَ ثانٍ للتعبئة', () => {
  it('لوحُ الموادّ لما قيد الإعداد وحدَه', () => {
    expect(PANEL).toMatch(/const pending = rows\.filter\(\(r\) => r\.status === "pending"\)/)
    expect(PANEL).toMatch(/pending\.map\(/)
    expect(PANEL, 'اللوحُ يعرض دوراتٍ معتمَدةً للتحرير').not.toMatch(/rows\.map\(/)
  })

  it('والخادمُ يردّ الكتابةَ لدورةٍ معتمَدة ويدلّ على مساحة الشعبة', () => {
    expect(SERVICE).toMatch(/if \(qual\.status !== 'pending'\) \{\s*throw new AuthError\('bad_state', '[^']*مساحة شعبتك'/)
  })
})

describe('③ والدليلُ يقولها', () => {
  it('في قسم «مؤهّلاتي»', () => {
    const quals = GUIDE_SECTIONS.find((s) => s.id === 'qualifications')!
    const said = quals.blocks.some((b) => b.kind === 'callout' && /تعبّئه في «شعبي»/.test(b.text) && /#workspace/.test(b.text))
    expect(said, 'قسمُ «مؤهّلاتي» في الدليل لا يقول أين يُعبَّأ محتوى الدورة').toBe(true)
  })

  it('وفي الأسئلة', () => {
    expect(FAQ.some((f) => /لا أستطيع تعديلَ دورتي/.test(f.q) && /«شعبي»/.test(f.a))).toBe(true)
  })
})
