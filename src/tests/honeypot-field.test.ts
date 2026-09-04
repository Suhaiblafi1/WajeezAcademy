/* حقلُ الفخّ — ما يُحرَس هنا هيئةُ الوصل لا سلوكُ زمنِ التشغيل.

   الفخُّ يعمل بشرطَين معا: أن **يوجد في الصفحة** كي يعبّئه الآليّ، وأن
   **لا يبلغه إنسان** — لا بعينه (خارجَ الشاشة)، ولا بقارئ شاشته
   (`aria-hidden`)، ولا بمفتاح التنقّل (`tabIndex={-1}`). وسقوطُ أيٍّ من
   هذه لا يُسقط اختبارا سلوكيّا: الأوّلُ يجعل الفخَّ زينةً لا تُمسك أحدا،
   والثلاثةُ الأخرى تُوقع **الإنسان** فيه — ومن عبّأه رُدَّ طلبُه.

   وحدُّ الفخّ مكتوبٌ في `server/http/honeypot.ts`: لا يُمسك من يُرسل JSON
   مباشرةً، فالحارسُ الحقيقيُّ سقوفُ المسارات. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const hook = read('src/components/HoneypotField.tsx')
const css = read('src/index.css')

/** النماذجُ العامّةُ التي يعبّئها إنسانٌ بحقولٍ حرّة */
const FORMS: Array<{ file: string; whatAr: string }> = [
  { file: 'src/components/AuthGate.tsx', whatAr: 'الحساب الجديد واستعادة كلمة المرور' },
  { file: 'src/pages/JoinTrainer.tsx', whatAr: 'طلب انضمام المدرّب' },
]

describe('حقلُ الفخّ في النماذج العامّة', () => {
  it('يخرج من الشاشة بموضعه لا بـdisplay:none — كي يراه الآليُّ في الشيفرة', () => {
    const rule = /\.hp-trap\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(rule, 'قاعدةُ .hp-trap مفقودةٌ من index.css').not.toBe('')
    expect(rule).toMatch(/left:\s*-9999px/)
    expect(rule, 'display:none يجعل الآليَّ الذي يقود متصفّحا يتخطّاه').not.toMatch(/display:\s*none/)
    /* `absolute` عند `-9999px` يوسّع مساحةَ التمرير فيظهر تمريرٌ أفقيّ — أمسكه
       حاجزُ الإتاحة بستّ وقائع في صفحة انضمام المدرّبين. والثابتُ خارجُ التدفّق. */
    expect(rule, 'absolute عند -9999px يُنشئ تمريرا أفقيّا — لتكن fixed').toMatch(/position:\s*fixed/)
  })

  it('ولا يبلغه إنسانٌ: خارجَ شجرة الإتاحة وخارجَ ترتيب التنقّل', () => {
    expect(hook).toMatch(/aria-hidden="true"/)
    expect(hook).toMatch(/tabIndex=\{-1\}/)
    expect(hook).toMatch(/autoComplete="off"/)
  })

  it('واسمُه لا يُعبّئه المتصفّحُ تلقائيّا', () => {
    const name = /HONEYPOT_FIELD = "([^"]+)"/.exec(hook)?.[1]
    expect(name).toBeTruthy()
    expect(['email', 'name', 'tel', 'organization', 'address'], 'اسمٌ يُعبّئه المتصفّحُ يُوقع الإنسانَ في الفخّ')
      .not.toContain(name)
  })

  it('ومعرّفُه من useId — فنموذجان في صفحةٍ لا يتقاسمان معرّفا', () => {
    expect(hook).toMatch(/useId\(\)/)
  })

  for (const { file, whatAr } of FORMS) {
    it(`و${whatAr} يعرضه ويُرسل قيمتَه`, () => {
      const src = read(file)
      expect(src, `${file}: لا خطّافَ فخّ`).toMatch(/useHoneypot\(\)/)
      expect(src, `${file}: الحقلُ غيرُ معروضٍ في النموذج`).toMatch(/\{hp\.field\}/)
      expect(src, `${file}: القيمةُ لا تُرسَل مع الحمولة`).toMatch(/hp\.value/)
    })
  }
})
