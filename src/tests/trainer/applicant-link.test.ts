/* روابطُ المتقدّم — يُقبل ما يكتبه الناسُ كيفما كتبوه.

   ═══ ما يُحرس ═══

   ① **أيُّ رابطٍ يُقبل** — بمخطَّطٍ كُتب أو بلا مخطَّط، وبنقطةٍ في المضيف أو
      بلا نقطة، وفيه فراغٌ أو ليس فيه. وهذا نصُّ ما طُلب (٢٢ سبتمبر ٢٠٢٦):
      «مازلت تعقّد أمرَ الأدلّة في طلب المدرّبين — أصلح الأمرَ ليقبل أيَّ نوع
      رابطٍ مهما كان».
   ② **ولا يُردُّ إلّا ما ليس رابطَ صفحةٍ أصلا** — `javascript:` و`data:`
      و`file:`. وهذه وحدَها تبقى مردودة، وليست تضييقا على أحد: الرابطُ
      يُكتب في `href` في ملفّ المتقدّم عند المراجع، والنموذجُ يقول لكاتبه
      إنّ روابطَه «أوّلُ ما يقرؤه المراجع» — فما فيها يُنقَر بحكم التصميم،
      فيُنفَّذ في جلسة من يقرؤه.
   ③ **وحكمُ الأدلّة واحدٌ يُشغَّل** — لا تعبيرٌ نمطيٌّ في النموذج وآخرُ في
      الخادم. فهذا هو العطبُ الذي رآه صاحبُ المنصّة: نموذجٌ مملوءٌ بأربعة
      روابطَ تامّة، وتحته «رابطٌ في أدلتك بلا https:// — أكمله أو احذفه». */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeApplicantLink } from '@/application/trainer/applicant-link'
import { checkEvidenceLinks, EVIDENCE_FIELDS } from '@/application/trainer/evidence-links'

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

describe('① أيُّ رابطٍ يُقبل — والمخطَّطُ يُضاف إن نقص', () => {
  it('وبلا مخطَّطٍ يُضاف https ولا يُبدَّل سائرُ ما كُتب', () => {
    expect(ok('linkedin.com/in/suhaib')).toBe('https://linkedin.com/in/suhaib')
    expect(ok('www.google.com')).toBe('https://www.google.com')
  })

  /* هذه أربعةُ الحقولِ كما جاءت في النموذج الذي رُدّ — وهي صحيحةٌ كلُّها */
  it('والنموذجُ الذي رُدّ تمرّ حقولُه الأربعةُ كما كُتبت', () => {
    expect(ok('www.linkedin.com/in/nancyafram2026')).toBe('https://www.linkedin.com/in/nancyafram2026')
    expect(ok('https://youtu.be/kwmkvK4tgbY?si=G_a')).toBe('https://youtu.be/kwmkvK4tgbY?si=G_a')
    expect(ok('www.instagram.com/nancy.afram')).toBe('https://www.instagram.com/nancy.afram')
    expect(ok('www.facebook.com/nancy.n.afram')).toBe('https://www.facebook.com/nancy.n.afram')
  })

  it('و«Https» بحرفٍ كبيرٍ تُطبَّع ولا تُردّ', () => {
    expect(ok('Https://www.google.com')).toBe('https://www.google.com')
  })

  it('و`http` يُقبل — فبعضُ المواقع لا تزال عليه', () => {
    expect(ok('http://example.com/x')).toBe('http://example.com/x')
  })

  /* كان يُردّ بحجّة «اسمُ الموقع ناقص» — ومن كتبه أدرى بموقعه */
  it('ومضيفٌ بلا نقطةٍ يُقبل', () => {
    expect(ok('https://linkedin')).toBe('https://linkedin')
    expect(ok('linkedin')).toBe('https://linkedin')
  })

  /* كان يُردّ بحجّة «نسخٌ ناقص» — والفراغُ يُرمَّز ولا يُردُّ صاحبُه */
  it('وفراغٌ داخلَ الرابط يُرمَّز ولا يُردّ', () => {
    const url = ok('linkedin.com/in/my name')
    expect(url).toContain('%20')
    expect(url.startsWith('https://linkedin.com/in/')).toBe(true)
  })

  /* العربيّةُ تبقى عربيّةً في الحقل: من رأى `%D9%88…` مكانَ ما كتب ظنّ أنّه فسد */
  it('ورابطٌ عربيٌّ يبقى كما كُتب', () => {
    expect(ok('ar.wikipedia.org/wiki/تدريب')).toBe('https://ar.wikipedia.org/wiki/تدريب')
  })

  it('ومنفذٌ ومعاملاتٌ ومرساةٌ — كلُّها تمرّ', () => {
    expect(ok('http://example.com:8080/a?b=1&c=2#d')).toBe('http://example.com:8080/a?b=1&c=2#d')
  })

  it('وبريدٌ أو هاتفٌ رابطٌ أيضا', () => {
    expect(ok('mailto:nancy@example.com')).toBe('mailto:nancy@example.com')
    expect(ok('tel:+966500000000')).toBe('tel:+966500000000')
  })

  it('والفارغُ يمرّ فارغا — فالحقلُ اختياريٌّ في نفسه', () => {
    expect(ok('')).toBe('')
    expect(ok('   ')).toBe('')
  })

  it('والفراغُ حولَه يُقصّ', () => {
    expect(ok('  linkedin.com/in/x  ')).toBe('https://linkedin.com/in/x')
  })

  /* صورتُه تُقرأ «linkedin.com» والوجهةُ `evil.com`. وكان يُردّ، فصار
     يُقبل بوجهته مكشوفةً: الردُّ كان يمنع من لا حيلةَ له، والحذفُ يُظهر
     للمراجع إلى أين يذهب فعلا. */
  it('واسمُ المستخدمِ قبل الموقع يُحذف ولا يُردُّ صاحبُه', () => {
    const url = ok('https://linkedin.com@evil.com')
    expect(url).not.toContain('linkedin.com@')
    expect(url).toContain('evil.com')
  })
})

/* ═══ ② وهذا وحدَه يبقى مردودا ═══

   `z.string().url()` كان يقبل هذين، ويُكتبان في `href` عند المراجع. */
describe('② وما ليس رابطَ صفحةٍ يُردّ — ولا يُنفَّذ في جلسة من يقرؤه', () => {
  it('و`javascript:` يُردّ', () => {
    const msg = bad('javascript:alert(1)')
    expect(msg, 'لا يقول ما الذي رُفض').toContain('javascript:')
  })

  it('و`data:` يُردّ', () => {
    bad('data:text/html,<script>alert(1)</script>')
  })

  it('و`file:` و`vbscript:` يُردّان', () => {
    bad('file:///etc/passwd')
    bad('vbscript:msgbox(1)')
  })

  it('وما لا يُقرأ عنوانا أصلا يُردّ', () => {
    bad('https://')
    bad('أنا مدرّبٌ معتمد')
  })
})

describe('③ والردُّ يقول ما الخطأ', () => {
  it('ولكلّ ردٍّ جملةٌ عربيّةٌ تُقرأ', () => {
    for (const s of ['javascript:alert(1)', 'file:///etc/passwd', 'https://', 'أنا مدرّبٌ معتمد']) {
      const msg = bad(s)
      expect(msg, `«${s}» رُدّ بلا جملة`).toMatch(/[؀-ۿ]/)
      expect(msg.length, `«${s}» جملتُه قصيرةٌ لا تشرح`).toBeGreaterThan(15)
    }
  })
})

/* ═══ ④ وحكمُ الأدلّة واحدٌ يُشغَّل — لا نسخةٌ ثانيةٌ في النموذج ═══

   هذا هو موضعُ العطب: النموذجُ كان يعدّ الروابطَ الصالحةَ بتعبيرٍ نمطيٍّ
   `^https?://…` من عنده، فيقول «بلا https://» لما يقبله الخادمُ ويُطبّعه.
   وحكمُ الأدلّة اليومَ دالّةٌ تُستدعى، فيُقاس بها لا بقراءة ملفّ. */
describe('④ وحكمُ الأدلّة دالّةٌ واحدةٌ تُشغَّل', () => {
  const form = (v: Partial<Record<(typeof EVIDENCE_FIELDS)[number], string>>) => ({
    linkedinUrl: '', youtubeUrl: '', instagramUrl: '', facebookUrl: '', ...v,
  })

  /* النموذجُ الذي رُدّ بعينه — أربعةُ حقولٍ صالحة، وقيل لصاحبته «بقي ١ بند» */
  it('والنموذجُ الذي رُدّ يمرّ بأربعةِ أدلّةٍ لا نقصَ فيها', () => {
    const r = checkEvidenceLinks(form({
      linkedinUrl: 'www.linkedin.com/in/nancyafram2026',
      youtubeUrl: 'https://youtu.be/kwmkvK4tgbY?si=G_a',
      instagramUrl: 'www.instagram.com/nancy.afram',
      facebookUrl: 'www.facebook.com/nancy.n.afram',
    }))
    expect(r.count, 'عُدّت الروابطُ الصالحةُ أقلَّ من أربعة').toBe(4)
    expect(r.rejected, 'رُدّ رابطٌ من الأربعة').toEqual([])
  })

  /* ولا يُشترط أن يكون الحقلُ قد غادره المؤشّرُ ليُطبَّع: استعادةُ مسوّدةٍ
     أو ملءٌ آليٌّ من المتصفّح لا يُطلقان `onBlur`، وبهما يصل الحقلُ إلى
     الإرسال كما كُتب. فالتطبيعُ عند الإرسال لا عند المغادرة وحدَها. */
  it('وما يُرسَل مطبَّعٌ ولو لم يغادر الحقلَ مؤشّر', () => {
    const r = checkEvidenceLinks(form({ linkedinUrl: 'www.linkedin.com/in/nancyafram2026' }))
    expect(r.normalized.linkedinUrl).toBe('https://www.linkedin.com/in/nancyafram2026')
    expect(r.normalized.youtubeUrl).toBe('')
  })

  it('والفارغُ لا يُعدّ دليلا', () => {
    expect(checkEvidenceLinks(form({})).count).toBe(0)
    expect(checkEvidenceLinks(form({ instagramUrl: '   ' })).count).toBe(0)
  })

  it('ويُسمّى الحقلُ الذي لا يصحّ ليُقال أين هو', () => {
    const r = checkEvidenceLinks(form({
      linkedinUrl: 'linkedin.com/in/x', facebookUrl: 'javascript:alert(1)',
    }))
    expect(r.count).toBe(1)
    expect(r.rejected).toEqual(['facebookUrl'])
  })

  it('والحقولُ أربعةٌ بأسمائها كما يعرفها الخادم', () => {
    expect([...EVIDENCE_FIELDS]).toEqual(['linkedinUrl', 'youtubeUrl', 'instagramUrl', 'facebookUrl'])
  })
})

/* ═══ والخادمُ والنموذجُ يقرآن الحكمَ نفسَه ═══

   لو قرأ أحدُهما حكما والآخرُ غيرَه لَعاد العطبُ من الباب الآخر: نموذجٌ
   يردُّ ما يقبله الخادمُ فيُحبَط المتقدّم — وهو الذي وقع — أو خادمٌ يقبل ما
   يردُّه النموذج فيصل `javascript:` إلى `href` عند المراجع. */
describe('والخادمُ والنموذجُ يقرآن الحكمَ نفسَه', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

  it('والخادمُ لا يحكم بـ`z.string().url()` على روابط المتقدّم', () => {
    const route = read('server/http/routes/trainer-applications.routes.ts')
    expect(route, 'لا يستورد الحكمَ المشترك').toContain('normalizeApplicantLink')
    for (const f of EVIDENCE_FIELDS) {
      expect(route, `«${f}» ما زال على \`z.string().url()\` — فيقبل \`javascript:\``)
        .not.toMatch(new RegExp(`${f}: z\\.string\\(\\)\\.url\\(\\)`))
    }
  })

  it('والنموذجُ يَعُدّ أدلّتَه بالدالّة المشتركة لا بتعبيرٍ نمطيٍّ من عنده', () => {
    const form = read('src/pages/JoinTrainer.tsx')
    expect(form, 'النموذجُ لا يستورد حكمَ الأدلّة').toContain('checkEvidenceLinks')
    expect(form, 'ما زال فيه تعبيرٌ نمطيٌّ يشترط «https» مكتوبةً')
      .not.toMatch(/\/\^https\?:/)
  })

  it('ويُطبّع عند المغادرة ويُظهر السبب', () => {
    const form = read('src/pages/JoinTrainer.tsx')
    expect(form, 'لا يُطبّع عند مغادرة الحقل').toMatch(/onBlur=\{normalizeLink\(/)
    expect(form, 'لا يُظهر سببَ الردّ تحت الحقل').toContain('linkErrors.linkedinUrl')
  })

  it('ولا يقول النائبُ إنّ «https» شرط', () => {
    const form = read('src/pages/JoinTrainer.tsx')
    expect(form, 'النائبُ يبدأ بـhttps فيُفهَم شرطا')
      .not.toMatch(/placeholder="https:\/\/(linkedin|youtube|instagram|facebook)/)
  })
})
