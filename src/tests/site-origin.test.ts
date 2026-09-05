/* الأصل القانوني — مصدر واحد لا يُكتب بالأيدي.

   كان النطاق النهائي مكتوبا حرفا في خمسة مواضع: SeoHead، وindex.html (canonical
   وog:url وog:image وJSON-LD)، وsitemap.xml، وrobots.txt. وثلاثة منها ملفات
   ساكنة لا تمرّ بأي بناء — فتُعلن للعالم نطاقا لا يستجيب طوال الفترة التجريبية:
   canonical إلى عدم، ومعاينةُ رابطٍ يُشارَك في واتساب تفشل (البوتات تقرأ الوسم
   الساكن ولا تشغّل React).

   الحارس هنا يقرأ الملفات نفسها: لا نطاق أكاديمية مكتوب حرفا خارج مصدره. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CANONICAL_ORIGIN, siteOrigin } from '../application/site/origin'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/* الملفات التي كانت تحمل النطاق، وصار الأصل يُحقن فيها وقت البناء */
const TEMPLATED = ['index.html', 'public/sitemap.xml', 'public/robots.txt']

describe('الأصل القانوني للموقع', () => {
  it('النطاق النهائي معلن مرة واحدة في وحدته', () => {
    expect(CANONICAL_ORIGIN).toBe('https://www.wajeezacademy.com')
    /* بلا شرطة مائلة في الذيل: كل استعمال يضيف المسار بنفسه */
    expect(CANONICAL_ORIGIN.endsWith('/')).toBe(false)
  })

  /* والنسخةُ الثانية من الثابت — تلك التي أفلتت.

     `vite.config.ts` يعمل في Node قبل ترجمة شيفرة التطبيق فلا يستورد من
     `src/`، فالقيمة مكتوبةٌ فيه مرّةً ثانية. وكان الحارسُ يغطّي الملفّات
     الساكنة الثلاثة ولا يغطّي ملفّ البناء — فحين انتقل الموقع إلى نطاقه
     الحيّ تغيّر أحدُ المصدرين وبقي الآخر، وظلّ البناءُ يطبع النطاقَ القديم
     في canonical وog:url وخريطة الموقع وrobots، وكلُّ الاختبارات خضراء.

     فالمقيسُ هنا التطابقُ لا القيمة: أيُّ نطاقٍ أرادوه، يكفي أن يكون واحدا. */
  it('ونسخةُ ملفّ البناء تطابق المصدر — فلا يفترقان ثانية', () => {
    const vite = read('vite.config.ts')
    const m = vite.match(/const CANONICAL_ORIGIN = "([^"]+)"/)
    expect(m, 'vite.config.ts يعلن CANONICAL_ORIGIN').not.toBeNull()
    expect(m![1]).toBe(CANONICAL_ORIGIN)
  })

  it('الملفات الساكنة تحمل العلامة لا النطاق', () => {
    for (const f of TEMPLATED) {
      const src = read(f)
      expect(src, `${f} يحمل %VITE_SITE_ORIGIN%`).toContain('%VITE_SITE_ORIGIN%')
      /* التعليقات تشرح، والوسوم تُحقن — فلا نطاق في سطر يُقدَّم للزاحف */
      const live = src
        .split('\n')
        .filter((l) => !/^\s*(<!--|#|\/\/)/.test(l) && !l.includes('لا تكتب نطاقا'))
        .join('\n')
      expect(live, `${f} يكتب النطاق حرفا`).not.toContain('wajeezacademy.com')
      expect(live, `${f} يحمل نطاقا مهجورا`).not.toContain('academy.wajeez.com')
    }
  })

  it('SeoHead لا يكتب نطاقا — يسأل الوحدة', () => {
    const src = read('src/components/SeoHead.tsx')
    expect(src).toContain('siteOrigin()')
    expect(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')).not.toContain('academy.wajeez.com')
  })

  it('خارج المتصفح يسقط على النطاق النهائي لا على localhost', () => {
    expect(siteOrigin()).toBe(CANONICAL_ORIGIN)
    expect(siteOrigin()).not.toContain('localhost')
  })
})
