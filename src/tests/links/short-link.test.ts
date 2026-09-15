/* الرابطُ القصير — قصيرٌ ولا يُخرِج الزائرَ من الدار (ط-٣).

   ═══ ما يُحرَس، ولمَ الأوّلُ أهمُّها ═══

   ① **لا تحويلَ مفتوح.** جدولٌ يحفظ عنوانا يكتبه أحدٌ ويُحوِّل إليه الزائرَ
      بلا شرطٍ هو ثغرةٌ تُستغَلّ لا ميزة: يُرسَل الضحيّةُ رابطا على نطاق
      الأكاديمية — فيثق به لأنّه اسمُها — ثمّ يجد نفسَه في موقعٍ آخرَ يطلب
      كلمةَ مرورها. والشرطُ يُفحَص في ثلاثة مواضعَ (الكتابةُ والقراءةُ
      والتحويل)، وهذا يحرس أضيقَها وأخطرَها: الذي يسبق `Navigate`.

   ② **والعنوانُ مسجَّل** وإلى الصفحة التي تحوّل، لا إلى أخرى.

   ③ **ولأبجديّة الرمز مالكٌ واحد.** رمزُ الدعوة والرابطُ القصير يشتركان
      فيها؛ ونسختان تفترقان بحذفِ حرفٍ من إحداهما، فيصير رمزٌ يُملى في الهاتف
      مقروءا وآخرُ ملتبسا ولا شيءَ يقول إنّهما كانا واحدا.

   ④ **والتحويلُ يستبدل ولا يكدّس** — وإلّا حبس زرُّ الرجوع الزائرَ. */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isSafeTarget, newShortCode, shortLinkPath,
  SHORT_CODE_LENGTH, SHORT_LINK_PREFIX,
} from '@/application/links/short-link'
import { UNAMBIGUOUS_ALPHABET } from '@/application/text/unambiguous-code'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const APP = read('src/App.tsx')

function pageBehind(routePath: string): string | null {
  const route = new RegExp(`path="${routePath.replace(/[/:]/g, (c) => `\\${c}`)}"\\s+element=\\{<(\\w+)\\s*/>\\}`)
  const hit = APP.match(route)
  if (!hit) return null
  return APP.match(new RegExp(`const ${hit[1]} = lazy\\(\\(\\) => import\\('([^']+)'\\)\\)`))?.[1] ?? null
}

describe('الرابطُ القصير', () => {
  it('لا يُحوَّل إلّا إلى مسارٍ داخليّ — وكلُّ صيغةِ خروجٍ تُردّ', () => {
    for (const ok of ['/', '/student/learning', '/auth/verify?token=abc', '/t/mudarrib#path-x']) {
      expect(isSafeTarget(ok), `مسارٌ داخليٌّ صحيحٌ رُدّ: ${ok}`).toBe(true)
    }
    const attacks = [
      'https://evil.example/login',
      'http://evil.example',
      '//evil.example',            /* مطلقٌ يرث مخطَّطَ الصفحة */
      '/\\evil.example',           /* الشرطةُ العكسيّةُ تُقرأ مائلةً عند بعضهم */
      '\\\\evil.example',
      'javascript:alert(1)',
      'student/learning',          /* بلا شرطةٍ أولى — نسبيٌّ يلتصق بما قبله */
      '',
      '/ /evil',                   /* فراغٌ يموّه ما بعده */
      '/x\nLocation: https://evil.example',
    ]
    for (const bad of attacks) {
      expect(isSafeTarget(bad), `وجهةٌ خارجيّةٌ قُبلت: ${JSON.stringify(bad)}`).toBe(false)
    }
  })

  it('والشرطُ يُفحَص في الشاشة قبل التحويل — لا في الخادم وحدَه', () => {
    const page = read('src/pages/ShortLink.tsx')
    expect(page, 'الشاشةُ تحوّل بلا أن تفحص الوجهة').toMatch(/isSafeTarget\(/)
    /* والفحصُ يسبق التحويلَ في النصّ، فلا يكون زينةً بعده */
    expect(page.indexOf('isSafeTarget(')).toBeLessThan(page.search(/<Navigate\s+replace/))
  })

  it('‏/s/:code مسجَّلٌ ويقف خلفه المحوِّل', () => {
    expect(pageBehind('/s/:code')).toBe('./pages/ShortLink')
    expect(shortLinkPath('K7M2QA')).toBe('/s/K7M2QA')
    expect(SHORT_LINK_PREFIX).toBe('/s/')
  })

  it('و‎/r/ يبقى لسجلّ المتقدّم — فلا يتنازع البابان', () => {
    /* `‎/r/:token` قرارُ ١٣ سبتمبر: سجلُّ المتقدّم برابطٍ باسمِ قارئه. */
    expect(APP, 'طريقُ سجلّ المتقدّم زال').toMatch(/path="\/r\/:token"/)
    expect(pageBehind('/s/:code')).not.toBe(pageBehind('/r/:token'))
  })

  it('ولأبجديّة الرمز مالكٌ واحد', () => {
    const code = newShortCode()
    expect(code).toHaveLength(SHORT_CODE_LENGTH)
    for (const ch of code) expect(UNAMBIGUOUS_ALPHABET, `حرفٌ خارجَ الأبجديّة: ${ch}`).toContain(ch)
    /* ولا 0/O ولا 1/I — وهي علّةُ وجودها. و**L باقية**: هذه أبجديّةُ رمزِ
       الدعوة كما كانت، ونقلُ مالكٍ ليس تغييرَ قاعدة. */
    for (const banned of ['0', 'O', '1', 'I']) {
      expect(UNAMBIGUOUS_ALPHABET, `حرفٌ ملتبسٌ عاد إلى الأبجديّة: ${banned}`).not.toContain(banned)
    }
    /* ومن يسكّ رمزا ينادي المالكَ ولا يكتب أبجديّةً بيده */
    for (const f of ['server/services/referral.service.ts', 'src/application/links/short-link.ts']) {
      expect(read(f), `${f} يكتب أبجديّةً بيده بدل أن ينادي المالك`).not.toMatch(/'ABCDEFGH/)
      expect(read(f), `${f} لا ينادي مالكَ الأبجديّة`).toMatch(/randomUnambiguousCode\(/)
    }
  })

  it('والتحويلُ يستبدل العنوانَ ولا يكدّسه', () => {
    expect(read('src/pages/ShortLink.tsx')).toMatch(/<Navigate\s+replace\s+to=/)
  })
})
