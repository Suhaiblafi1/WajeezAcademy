/* أرقامُ واتساب من الإدارة لا من الشيفرة.

   ═══ العطبُ الذي كُتب له الحارس ═══

   `CONTACT.whatsapp = '962771052222'` كان حرفا في `data/stories.ts` تقرؤه
   خمسةُ مواضع. فتغييرُ رقمِ مستشارٍ — وهو أكثرُ ما يتغيّر في منصّةٍ فتيّة —
   كان يقتضي تعديلَ شيفرةٍ ونشرةً كاملة.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «ابنِ لي صفحةً تسهّل عليّ إدخالَ
   رقم واتساب لكلّ مكانٍ فيه تواصلٌ مع واتساب».

   ═══ وما يحرسه هذا الملفّ ═══

   ١) التطبيعُ والتحقّق: رقمٌ يُلصق بصيغته الدوليّةِ يُحفظ صالحا، وإلّا
      أنتج رابطا لا يفتح ولا يقول أحدٌ لماذا.
   ٢) الرجوعُ لا ينكسر: موضعٌ بلا رقمٍ يرجع إلى «مراسلة مستشار»، ثمّ إلى
      الرقم المدمج — فمن ضبط رقما واحدا لا يُعاقَب بأزرارٍ معطَّلة.
   ٣) **البنية**: لا موضعَ في الشاشات يبني `wa.me` بيده. الحارسُ على شكلِ
      الشيفرة لا على ورودِ كلمةٍ في تعليق — فتعليقٌ يذكر `CONTACT.whatsapp`
      لا يُسقطه، ورابطٌ مبنيٌّ بيدٍ في صفحةٍ جديدةٍ يُسقطه. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WHATSAPP_SPOTS, normalizeWhatsApp, isValidWhatsApp, whatsAppFor, waHref,
} from '../../application/site/whatsapp'

const root = process.cwd()
/* التعليقاتُ تُنزع قبل الفحص: الحارسُ على الشيفرة، ونصٌّ يشرح العطبَ
   القديمَ ليس عطبا. */
const stripComments = (src: string) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== 'tests') walk(p, out) }
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe('تطبيعُ رقم واتساب', () => {
  it('يجرّد ما لا يقبله wa.me: الزائدَ والصفرَين الدوليّين والفواصل', () => {
    expect(normalizeWhatsApp('+962 77 105 2222')).toBe('962771052222')
    expect(normalizeWhatsApp('00962771052222')).toBe('962771052222')
    expect(normalizeWhatsApp('962-77-105-2222')).toBe('962771052222')
    expect(normalizeWhatsApp('')).toBe('')
  })

  it('ويردّ ما لا يصلح رقما دوليّا', () => {
    expect(isValidWhatsApp('+962 77 105 2222')).toBe(true)
    expect(isValidWhatsApp('12345')).toBe(false)          // أقصرُ من ثمانٍ
    expect(isValidWhatsApp('1234567890123456')).toBe(false) // أطولُ من خمس عشرة
    expect(isValidWhatsApp('واتساب')).toBe(false)
    expect(isValidWhatsApp('')).toBe(false)
  })
})

describe('الرجوعُ حين يخلو موضع', () => {
  const FALLBACK = '962771052222'

  it('موضعٌ مضبوطٌ يُقرأ رقمُه هو', () => {
    expect(whatsAppFor({ discount_proof: '962700000000' }, 'discount_proof', FALLBACK)).toBe('962700000000')
  })

  it('وموضعٌ خالٍ يرجع إلى «مراسلة مستشار» قبل الرقم المدمج', () => {
    expect(whatsAppFor({ advisor: '962711111111' }, 'discount_proof', FALLBACK)).toBe('962711111111')
  })

  it('ولا رقمَ أصلا يعني رابطا لا يُبنى — لا رابطا فارغا يُعرض', () => {
    expect(whatsAppFor({}, 'advisor', '')).toBe('')
    expect(waHref({}, 'advisor', '', 'مرحبا')).toBeNull()
    expect(waHref({}, 'advisor', FALLBACK, 'مرحبا')).toBe(`https://wa.me/${FALLBACK}?text=${encodeURIComponent('مرحبا')}`)
  })
})

describe('بنيةُ الشاشات — لا رقمَ محبوسٌ في الشيفرة', () => {
  const files = walk(join(root, 'src'))
    .filter((p) => !p.endsWith('application/site/whatsapp.ts'))

  it('لا ملفَّ يبني رابطَ wa.me بيده — كلُّها تمرّ بـwaHref', () => {
    const offenders = files.filter((p) => /https:\/\/wa\.me\//.test(stripComments(readFileSync(p, 'utf8'))))
    expect(offenders.map((p) => p.slice(root.length + 1)), 'رابطٌ مبنيٌّ بيدٍ يتجاوز أرقامَ الإدارة').toEqual([])
  })

  it('ولا ملفَّ يقرأ CONTACT.whatsapp إلّا رجوعا يُمرَّر لـwaHref/whatsAppFor', () => {
    const offenders: string[] = []
    for (const p of files) {
      const src = stripComments(readFileSync(p, 'utf8'))
      for (const line of src.split('\n')) {
        if (!line.includes('CONTACT.whatsapp')) continue
        if (/\b(waHref|buildWaHref|whatsAppFor)\s*\(/.test(line)) continue
        offenders.push(`${p.slice(root.length + 1)}: ${line.trim()}`)
      }
    }
    expect(offenders, 'الرقمُ المدمج يُقرأ خارج سلسلة الرجوع').toEqual([])
  })
})

describe('شاشةُ الإدارة والخادم', () => {
  const screen = stripComments(readFileSync(join(root, 'src/pages/admin/Integrations.tsx'), 'utf8'))
  const routes = stripComments(readFileSync(join(root, 'server/http/routes/integrations.routes.ts'), 'utf8'))

  it('تُولَّد خانةٌ لكلّ موضعٍ من السجلّ — فموضعٌ جديدٌ سطرٌ واحدٌ لا شاشةٌ تُعدَّل', () => {
    expect(screen, 'الخاناتُ مكتوبةٌ يدا لا مولَّدة').toMatch(/WHATSAPP_SPOTS\.map\(/)
    expect(screen).toContain('/api/admin/integrations/whatsapp')
  })

  it('والمساراتُ الثلاثةُ مسجَّلةٌ: قراءةٌ عامّةٌ وقراءةُ إدارةٍ وحفظٌ محروس', () => {
    expect(routes).toContain("app.get('/api/site/whatsapp'")
    expect(routes).toContain("app.get('/api/admin/integrations/whatsapp'")
    expect(routes).toContain("app.put('/api/admin/integrations/whatsapp'")
  })

  it('والحفظُ خلف settings.manage — لا يُبدَّل رقمٌ عامٌّ بلا صلاحيّة', () => {
    const put = routes.slice(routes.indexOf("app.put('/api/admin/integrations/whatsapp'"))
    expect(put.slice(0, 400)).toContain("requirePermission('settings.manage')")
  })

  it('ولكلّ موضعٍ اسمٌ وأينَ يظهر — فمن يملأ الخانةَ يعرف ما يغيّر', () => {
    expect(WHATSAPP_SPOTS.length).toBeGreaterThan(0)
    for (const sp of WHATSAPP_SPOTS) {
      expect(sp.key, 'مفتاحٌ لاتينيٌّ قصيرٌ يُحفظ في JSON').toMatch(/^[a-z][a-z0-9_]*$/)
      expect(sp.labelAr.trim().length, `«${sp.key}» بلا اسم`).toBeGreaterThan(3)
      expect(sp.whereAr.trim().length, `«${sp.key}» لا يقول أين يظهر`).toBeGreaterThan(3)
    }
    expect(new Set(WHATSAPP_SPOTS.map((s) => s.key)).size).toBe(WHATSAPP_SPOTS.length)
  })
})
