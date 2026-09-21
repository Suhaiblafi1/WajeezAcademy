/* روابطُ المتقدّم — تُقبل كما تُكتب، وتُردّ إن كانت فخّا.

   ═══ ما يُحرس ═══

   ① **ما كان يُردّ صار يُقبل** — `linkedin.com/in/x` و`www.google.com`،
      وهو نصُّ ما طُلب: «اسمح له أن يضعه بدون https، وضعها أنت».
   ② **وما كان يُقبل صار يُردّ** — `javascript:` و`data:`. وهذا هو الأهمّ:
      الرابطُ يُكتب في `href` في ملفّ المتقدّم عند المراجع، والنموذجُ يقول
      له إنّ روابطَه «أوّلُ ما يقرؤه المراجع». فما فيها يُنقَر بحكم التصميم.
   ③ **والردُّ يقول ما الخطأ** — «غير صالح» وحدَها تترك كاتبَها يحزر. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeApplicantLink } from '@/application/trainer/applicant-link'

const ok = (s: string) => {
  const r = normalizeApplicantLink(s)
  expect(r.ok, `رُدّ «${s}» وهو صالح: ${r.ok ? '' : r.messageAr}`).toBe(true)
  return r.ok ? r.url : ''
}
const bad = (s: string) => {
  const r = normalizeApplicantLink(s)
  expect(r.ok, `قُبل «${s}» وهو لا يصحّ`).toBe(false)
  return r.ok ? '' : r.messageAr
}

describe('① ما كان يُردّ صار يُقبل — والمخطَّطُ يُضاف', () => {
  it('وبلا مخطَّطٍ يُضاف https', () => {
    expect(ok('linkedin.com/in/suhaib')).toBe('https://linkedin.com/in/suhaib')
    expect(ok('www.google.com')).toBe('https://www.google.com/')
  })

  it('وبمخطَّطٍ مكتوبٍ يبقى كما هو', () => {
    expect(ok('https://instagram.com/wajeez')).toBe('https://instagram.com/wajeez')
  })

  /* وقع فعلا في نموذجٍ مُرسَل: «Https://www.google.com» بحرفٍ كبير */
  it('و«Https» بحرفٍ كبيرٍ تُطبَّع ولا تُردّ', () => {
    expect(ok('Https://www.google.com')).toBe('https://www.google.com/')
  })

  it('و`http` يُقبل — فبعضُ المواقع لا تزال عليه', () => {
    expect(ok('http://example.com/x')).toBe('http://example.com/x')
  })

  it('والفارغُ يمرّ فارغا — فالحقلُ اختياريٌّ في نفسه', () => {
    expect(ok('')).toBe('')
    expect(ok('   ')).toBe('')
  })

  it('والفراغُ حولَه يُقصّ', () => {
    expect(ok('  linkedin.com/in/x  ')).toBe('https://linkedin.com/in/x')
  })
})

/* ═══ ② وهذا هو الحارسُ الذي من أجله كُتب الملفّ ═══

   `z.string().url()` كان يقبل هذين، ويُكتبان في `href` عند المراجع. */
describe('② وما كان يُقبل صار يُردّ — ولا يُنفَّذ في جلسة من يقرؤه', () => {
  it('و`javascript:` يُردّ', () => {
    const msg = bad('javascript:alert(1)')
    expect(msg, 'لا يقول ما الذي رُفض').toContain('javascript:')
  })

  it('و`data:` يُردّ', () => {
    bad('data:text/html,<script>alert(1)</script>')
  })

  it('وكلُّ مخطَّطٍ سوى http/https يُردّ', () => {
    for (const s of ['file:///etc/passwd', 'vbscript:msgbox(1)', 'ftp://x.com', 'mailto:a@b.com']) {
      bad(s)
    }
  })

  /* صورتُه تُقرأ «linkedin.com» والوجهةُ `evil.com` — حيلةُ تصيّدٍ معروفة */
  it('واسمُ مستخدمٍ قبل الموقع يُردّ', () => {
    const msg = bad('https://linkedin.com@evil.com')
    expect(msg).toContain('اسمَ مستخدم')
  })

  it('ومضيفٌ بلا نقطةٍ ليس عنوانا يُفتح', () => {
    bad('https://linkedin')
    bad('linkedin')
  })

  it('وفراغٌ داخلَ الرابط يُردّ — نسخٌ ناقص', () => {
    bad('linkedin.com/in/ اسمي')
  })
})

describe('③ والردُّ يقول ما الخطأ', () => {
  it('ولكلّ ردٍّ جملةٌ عربيّةٌ تُقرأ', () => {
    for (const s of ['javascript:alert(1)', 'https://linkedin', 'https://a@evil.com', 'a b']) {
      const msg = bad(s)
      expect(msg, `«${s}» رُدّ بلا جملة`).toMatch(/[؀-ۿ]/)
      expect(msg.length, `«${s}» جملتُه قصيرةٌ لا تشرح`).toBeGreaterThan(15)
    }
  })
})

/* ═══ والحكمُ واحدٌ في الخادم والنموذج ═══

   لو قرأ أحدُهما حكما والآخرُ غيرَه لَعاد العطبُ من الباب الآخر: نموذجٌ
   يقبل ما يردّه الخادمُ فيُحبَط المتقدّم، أو خادمٌ يقبل ما يردّه النموذج
   فيصل `javascript:` إلى `href` عند المراجع. */
describe('والخادمُ والنموذجُ يقرآن الحكمَ نفسَه', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

  it('والخادمُ لا يحكم بـ`z.string().url()` على روابط المتقدّم', () => {
    const route = read('server/http/routes/trainer-applications.routes.ts')
    expect(route, 'لا يستورد الحكمَ المشترك').toContain('normalizeApplicantLink')
    for (const f of ['linkedinUrl', 'youtubeUrl', 'instagramUrl', 'facebookUrl']) {
      expect(route, `«${f}» ما زال على \`z.string().url()\` — فيقبل \`javascript:\``)
        .not.toMatch(new RegExp(`${f}: z\\.string\\(\\)\\.url\\(\\)`))
    }
  })

  it('والنموذجُ يُطبّع عند المغادرة ويُظهر السبب', () => {
    const form = read('src/pages/JoinTrainer.tsx')
    expect(form, 'النموذجُ لا يستورد الحكمَ المشترك').toContain('normalizeApplicantLink')
    expect(form, 'لا يُطبّع عند مغادرة الحقل').toMatch(/onBlur=\{normalizeLink\(/)
    expect(form, 'لا يُظهر سببَ الردّ تحت الحقل').toContain('linkErrors.linkedinUrl')
  })

  it('ولا يقول النائبُ إنّ «https» شرط', () => {
    const form = read('src/pages/JoinTrainer.tsx')
    expect(form, 'النائبُ يبدأ بـhttps فيُفهَم شرطا')
      .not.toMatch(/placeholder="https:\/\/(linkedin|youtube|instagram|facebook)/)
  })
})
