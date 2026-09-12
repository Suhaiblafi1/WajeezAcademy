/* الأسطحُ الطافية: أرضيّةٌ تحجب، وإغلاقٌ يقع حين يُنقَر خارجها.

   ── العطبان اللذان وُلد منهما هذا الحارس (قِيسا على الهاتف والنهاريّ) ──

   **الأوّل — أرضيّةٌ تُكتب في `className` فلا تثبت.** `Inset` نغمتُه
   الأصليّة `bg-black/20`: سوادٌ شفّافٌ يصلح لتفصيلٍ غاطسٍ داخل بطاقة،
   ولا يصلح لشيءٍ **يطفو فوق** صفحةٍ مكتوبة. وكان المتداولُ أن تُضاف
   `bg-surface` في `className` لتغطّيه — وهي حيلةٌ لا تثبت، وقد شرح
   `Surface.tsx` لماذا: الصنفان من فصيلةٍ واحدةٍ وأسبقيّةٍ واحدة، فالفائزُ
   يقرّره ترتيبُهما في ورقة الأنماط المولَّدة لا ترتيبُهما في الوسم.
   فسقطت القرعةُ للشفّاف، وصارت قائمةُ الحساب في المظهر النهاريّ تُقرأ
   وتحتها نصُّ الصفحة من خلالها — سطران متراكبان لا يُفكّ أحدُهما عن الآخر.
   و`tone="solid"` يحسمها مرّةً واحدة.

   **والثاني — ستارةُ إغلاقٍ لا تُغلق.** كانت المنسدلاتُ تُغلَق بزرِّ
   ستارةٍ `fixed inset-0 z-40`. وترويسةُ البوّابات الأربع تحمل
   `backdrop-blur`، و`backdrop-filter` يجعل حاملَه **كتلةً حاضنةً** لكلّ
   `position: fixed` في ذرّيّته. فلم تكن الستارةُ تمتدّ على الشاشة بل على
   الترويسة وحدَها (`h-16`)، ومن نقر في متن الصفحة لم يصب شيئا وبقيت
   القائمةُ مفتوحةً فوق ما يقرؤه. والمستمعُ على `document` لا تحبسه كتلةٌ
   حاضنة — وهو ما كان يعمل في `NotificationBell` وحدَه.

   ── والفحصُ على البنية لا على ورودِ حرف ──

   التعليقاتُ تُنزع قبل كلّ فحص: هذا الملفُّ نفسُه يذكر `bg-surface` و
   `fixed inset-0 z-40` شرحا للعطب، ولو فُحص النصُّ خاما لأسقط نفسَه —
   أو، وهو أسوأ، لمرّ حارسٌ لأنّ اللفظَ ورد في تعليق. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** النصُّ بلا تعليقات — تعليقُ الكتلة وتعليقُ السطر — كي يُفحص ما يُصيَّر فعلا */
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')

/* كلُّ سطحٍ يطفو فوق الصفحة: نافذةٌ أو منسدلةٌ أو لوحُ أوامر. */
const FLOATING = [
  'src/components/StaffAccountMenu.tsx',
  'src/components/NotificationBell.tsx',
  'src/components/SearchPalette.tsx',
  'src/components/PortalSearchPalette.tsx',
  'src/components/ConfirmAction.tsx',
  'src/components/BuyPanel.tsx',
  'src/components/LearnersPanel.tsx',
  'src/pages/Stories.tsx',
  'src/pages/Home.tsx',
  'src/pages/Pathway.tsx',
  'src/pages/CoursePath.tsx',
  'src/pages/student/MyCv.tsx',
  'src/pages/student/PortalLayout.tsx',
] as const

/* المنسدلاتُ الساكنةُ في ترويسةٍ ضبابيّة — إغلاقُها لا يجوز أن يتّكل على
   ستارةٍ `fixed`، لأنّ الضبابَ يحبسها في الترويسة. */
const HEADER_MENUS = [
  ['قائمة حساب العاملين', 'src/components/StaffAccountMenu.tsx'],
  ['جرس الإشعارات', 'src/components/NotificationBell.tsx'],
  ['بوّابة المتعلّم — الجرس وقائمة الحساب', 'src/pages/student/PortalLayout.tsx'],
] as const

describe('الأسطحُ الطافية', () => {
  it('١) أرضيّتُها من النغمة لا من `className` — وإلّا قُرئ ما تحتها من خلالها', () => {
    /* وسمُ فتحٍ لـ`Inset` أو `Panel` تحمل `className` فيها أرضيّةٌ صلبة:
       تلك هي الحيلةُ التي لا تثبت. */
    const offenders: string[] = []
    for (const path of FLOATING) {
      const src = code(path)
      for (const m of src.matchAll(/<(Inset|Panel)\b[^>]*?className="([^"]*)"/g)) {
        if (/\bbg-(surface|card)\b/.test(m[2])) offenders.push(`${path} → <${m[1]} … ${m[2]}>`)
      }
    }
    expect(
      offenders,
      'سطحٌ طافٍ يكتب أرضيّتَه في `className` — استعمل `tone="solid"`، '
      + 'فالصنفان أسبقيّتُهما واحدةٌ والفائزُ يقرّره ترتيبُ ورقة الأنماط:\n'
      + offenders.join('\n'),
    ).toEqual([])
  })

  it('٢) والطافي يحمل `tone="solid"` فعلا — لا أرضيّةَ شفّافةً بلا بديل', () => {
    for (const [name, path] of HEADER_MENUS) {
      const src = code(path)
      expect(src, `${name}: لا نغمةَ صلبةً على سطحها الطافي`).toMatch(/tone="solid"/)
    }
  })

  it('٣) وتُغلَق بمستمعٍ على المستند — لا بستارةٍ يحبسها ضبابُ الترويسة', () => {
    for (const [name, path] of HEADER_MENUS) {
      const src = code(path)
      expect(
        src,
        `${name}: يُغلَق بستارة \`fixed inset-0 z-40\` — و\`backdrop-filter\` `
        + 'في الترويسة يجعلها كتلةً حاضنة، فلا تمتدّ الستارةُ إلّا على الترويسة',
      ).not.toMatch(/fixed inset-0 z-40/)
      expect(
        src,
        `${name}: لا مستمعَ إغلاقٍ على المستند`,
      ).toMatch(/document\.addEventListener\(\s*["']mousedown["']/)
    }
  })
})
