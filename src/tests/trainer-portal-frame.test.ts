/* بوابة المدرب: إطارٌ واحد، وتقويمٌ واحد، ولا شاشةَ خارج التبويبات.

   مشيتُ البوابة بحساب مدرّب حقيقيّ فوجدت الشاشات مبنيّةً تقرأ من الخادم فعلا
   — والعطب في الطريق إليها لا في منطقها:

   ١) `/trainer` — أوّل ما يهبط عليه بعد الدخول — كانت تُصيَّر بلا إطار
      البوابة: لا تبويبات ولا جرس ولا بحث ولا خروج. فمن دخل وقف في غرفةٍ بلا
      أبواب، ولا يبلغ «طابور التقييم» إلا بكتابة مساره بيده.
   ٢) المواعيد بالهجريّ: «٢٦ ربيع الأول» — والمدرب يجدول عمله بالميلاديّ.
      وفي البوابة الواحدة أربع لغات تنسيق. (فُحصت الأربع في متصفّح حقيقيّ:
      ar-SA وحدها هجريّة، و`ar-JO` تكتب «أيلول» لا «سبتمبر».)
   ٣) `/trainer/board` — ورشةُ عمله الفعليّة: الحضور والمواد والتكليفات
      والدرجات — لم تكن في التبويبات أصلا، وكانت تبني إطارا ثالثا لنفسها.

   ولا يمسك شيءٌ من هذا اختبارُ منطق: كلّها في الطريق، فالحارس على الطريق. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const LAYOUT = 'src/pages/trainer/TrainerLayout.tsx'
/* كلّ شاشات البوابة — لا قائمة تسامح: أيّ شاشةٍ تُضاف تلزمها القاعدة نفسها */
const SCREENS = [
  'src/pages/trainer/TrainerDashboard.tsx',
  'src/pages/trainer/CohortBoard.tsx',
  'src/pages/trainer/GradingQueue.tsx',
  'src/pages/trainer/Proposals.tsx',
  'src/pages/trainer/Earnings.tsx',
  'src/pages/trainer/MyRatings.tsx',
]

describe('إطار بوابة المدرب', () => {
  it('كلّ شاشةٍ في البوابة تلبس إطارها — بلا استثناء', () => {
    for (const f of SCREENS) {
      const src = read(f)
      expect(src, `${f} لا يستورد إطار البوابة`).toContain('TrainerLayout')
      /* والاستيراد لا يكفي: الجذر المُعاد هو الإطار لا <div> عارية */
      expect(src, `${f} يبني إطارا لنفسه بدل إطار البوابة`).toMatch(/return \(\s*\n?\s*<TrainerLayout/)
    }
  })

  it('لا رأسَ ثانيا: العلامة والشعار في الإطار وحده', () => {
    /* رأسٌ ثانٍ داخل شاشة يعني إطارا ثالثا للبوابة — وهو ما كان */
    for (const f of SCREENS) {
      const src = read(f).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
      expect(src, `${f} يبني <header> خاصّا به`).not.toMatch(/<header[\s>]/)
    }
    expect(read(LAYOUT), 'الإطار بلا رأس').toMatch(/<header[\s>]/)
  })

  it('كلّ شاشةٍ لها تبويب يبلغها — ولا شاشة تُكتب بالمسار وحده', () => {
    const layout = read(LAYOUT)
    const tabs = [...layout.matchAll(/\{ to: "(\/trainer[^"]*)"/g)].map((m) => m[1])
    expect(tabs, 'التبويبات مفقودة').not.toHaveLength(0)
    /* ورشةُ عمله الفعليّة كانت خارجها */
    for (const path of ['/trainer', '/trainer/board', '/trainer/grading', '/trainer/proposals', '/trainer/earnings', '/trainer/ratings']) {
      expect(tabs, `${path} خارج التبويبات — لا يبلغها إلا بكتابة مسارها`).toContain(path)
    }
  })
})

describe('تقويم بوابة المدرب', () => {
  const FILES = [...SCREENS, 'src/components/TrainerWorkQueue.tsx', 'src/components/AtRiskList.tsx']

  it('ميلاديٌّ واحد — لا هجريّ ولا لغةُ تنسيقٍ لكل شاشة', () => {
    for (const f of FILES) {
      let src: string
      try { src = read(f) } catch { continue }
      const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
      /* ar-SA هجريّة في المتصفّح، وar-JO تكتب «أيلول»، و«ar» و«ar-EG» بأرقام
         مختلفة — والتنسيق يمرّ بوحدةٍ واحدة لا بلغةٍ تُكتب في كلّ موضع */
      /* التواريخ وحدها: `toLocaleString("en-US")` على رقمٍ تنسيقُ مالٍ مقصود */
      const locales = [
        ...[...code.matchAll(/new Date\([^)]*\)\s*\.toLocaleString\(\s*["']([^"']+)["']/g)].map((m) => m[1]),
        ...[...code.matchAll(/\.toLocale(?:Date|Time)String\(\s*["']([^"']+)["']/g)].map((m) => m[1]),
      ]
      expect(locales, `${f} ينسّق التاريخ بنفسه: ${locales.join(' · ')}`).toEqual([])
    }
  })

  it('الوحدة تُثبّت التقويم صراحةً — لا تتركه للغة المتصفّح', () => {
    const fmt = read('src/utils/format.ts')
    for (const fn of ['fmtDateAr', 'fmtDateTimeAr', 'fmtShortDateTimeAr']) {
      const body = new RegExp(`export function ${fn}\\([\\s\\S]*?\\n\\}`).exec(fmt)?.[0] ?? ''
      expect(body, `${fn} مفقودة`).toBeTruthy()
      expect(body, `${fn} لا تُثبّت التقويم — فتصير هجريّة عند من لغته ar-SA`).toContain("'ar-u-ca-gregory'")
    }
  })
})
