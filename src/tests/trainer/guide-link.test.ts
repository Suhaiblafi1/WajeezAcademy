/* دليلُ المدرّب — رابطُه في رسالة اعتماد التوقيع، وبابُه في البوّابة، وتغطيتُه.

   قرارُ صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦): رسالةُ اعتماد التوقيع تحمل رابطا إلى
   دليلٍ «يرشدهم لما يجب أن يفعله المدرّب داخل منصّته من الألف إلى الياء».

   ═══ وما يُحرَس، والفحصُ على المصيَّر لا على الشيفرة ═══

   ① **الرابطُ وسمٌ يُنقر في الرسالة** — `richHtml` لا يُلقِّم الروابطَ
      العارية، فعنوانٌ يُكتب في فقرةٍ نصّا يصل حرفا ميّتا. فتُصيَّر الرسالةُ
      ويُسأل: أفي HTML وسمٌ يحمله؟ وأفي النصّ الخالص عنوانُه؟
   ② **ويسبق زرَّ البوّابة** في رسالة من يبدأ طورَ الموادّ — من يفتح بوّابتَه
      أوّلَ مرّةٍ يحتاج أن يعرف أين يضع موادَّه قبل أن يبحث عنها.
   ③ **والمسارُ الذي تحمله الرسالةُ مسارٌ يُخدَم** — عامٌّ خارجَ حارس الأدوار،
      فلا يُطلب دخولٌ لقراءة ما يشرح الدخول.
   ④ **وكلُّ تبويبٍ في البوّابة له قسمٌ في الدليل** — تبويبٌ يُضاف ولا يُشرَح
      يترك المدرّبَ يكتشفه بالتجربة، وهو ما كُتب الدليلُ لمنعه. */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contractApprovedMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'
import { TRAINER_GUIDE_PATH } from '../../application/trainer/trainer-guide'
import { GUIDE_SECTIONS, CHECKLIST, FAQ, JOURNEY } from '../../data/trainer-guide/content'
import { GUIDE_SHOTS } from '../../data/trainer-guide/shots'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const GUIDE_URL = `https://www.wajeezacademy.com${TRAINER_GUIDE_PATH}`
const BASE = {
  legalName: 'مدرّبٌ للاختبار',
  title: 'عقدُ تدريب',
  approvedOnAr: '29 سبتمبر 2026',
  portalUrl: 'https://www.wajeezacademy.com/trainer',
  guideUrl: GUIDE_URL,
}
const escaped = (u: string) => u.replace(/[/.]/g, '\\$&')

describe('① رابطُ الدليل في رسالة اعتماد التوقيع', () => {
  for (const gatesActivation of [true, false]) {
    it(`وسمٌ يُنقر، وعنوانٌ في النصّ الخالص — ${gatesActivation ? 'طورُ الموادّ' : 'بندٌ على مدرّبٍ نشط'}`, () => {
      const { html, text } = renderMail(contractApprovedMail({ ...BASE, gatesActivation }).doc)
      expect(html, 'رابطُ الدليل حرفٌ ميّتٌ لا يُنقر').toMatch(new RegExp(`<a[^>]+href="${escaped(GUIDE_URL)}"`))
      expect(text, 'لا عنوانَ للدليل في النسخة النصّيّة').toContain(GUIDE_URL)
    })
  }

  it('② ويسبق زرَّ البوّابة لمن يبدأ طورَ الموادّ', () => {
    const { html } = renderMail(contractApprovedMail({ ...BASE, gatesActivation: true }).doc)
    const guide = html.search(new RegExp(`href="${escaped(GUIDE_URL)}"`))
    const portal = html.search(new RegExp(`href="${escaped(BASE.portalUrl)}"`))
    expect(guide).toBeGreaterThan(-1)
    expect(portal).toBeGreaterThan(-1)
    expect(guide, 'الدليلُ بعد الزرّ — يفتح بوّابتَه قبل أن يعرف ما يفعل').toBeLessThan(portal)
  })

  it('والخادمُ يمرّر المسارَ نفسَه — لا عنوانا مكتوبا بيده', () => {
    const svc = code('server/services/trainer-review.service.ts')
    expect(svc).toMatch(/guideUrl:\s*`\$\{publicSiteUrl\(\)\}\$\{TRAINER_GUIDE_PATH\}`/)
  })
})

describe('③ المسارُ يُخدَم — عامّا بلا حارس', () => {
  const app = code('src/App.tsx')

  it('المسارُ في جدول المسارات بعينه', () => {
    expect(app).toContain(`path="${TRAINER_GUIDE_PATH}"`)
  })

  it('وخارجَ حارس بوّابة المدرّب — يُفتح من البريد قبل أيّ جلسة', () => {
    const guard = app.indexOf('<Route element={<RequireRole allow={TRAINER_ROLES} />}>')
    const route = app.indexOf(`path="${TRAINER_GUIDE_PATH}"`)
    expect(guard).toBeGreaterThan(-1)
    expect(route, 'الدليلُ داخلَ حارس الأدوار — يطلب دخولا ليشرح الدخول').toBeLessThan(guard)
  })

  it('وله بابٌ في شريط البوّابة نفسِه — لا في البريد وحدَه', () => {
    expect(code('src/pages/trainer/TrainerLayout.tsx')).toContain('TRAINER_GUIDE_PATH')
  })
})

describe('④ الدليلُ يغطّي البوّابةَ كلَّها', () => {
  /** تبويباتُ البوّابة من مصدرها — لا قائمةٌ مكتوبةٌ هنا تشيخ */
  const tabs = [...code('src/pages/trainer/TrainerLayout.tsx').matchAll(/\{ to: "(\/trainer[^"]*)", label: "([^"]+)"/g)]
    .map((m) => ({ to: m[1], label: m[2] }))

  it('تُقرأ التبويباتُ فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(tabs.length).toBeGreaterThan(10)
  })

  it('لكلّ تبويبٍ قسمٌ يفتحه باسمه ومساره', () => {
    const covered = new Set(GUIDE_SECTIONS.filter((s) => s.path).map((s) => s.path))
    const missing = tabs.filter((t) => !covered.has(t.to)).map((t) => `${t.label} (${t.to})`)
    expect(missing, `تبويباتٌ بلا قسمٍ في الدليل: ${missing.join('، ')}`).toEqual([])
  })

  it('واسمُ التبويب في القسم كما يُكتب في الشريط حرفا', () => {
    for (const t of tabs) {
      const s = GUIDE_SECTIONS.find((x) => x.path === t.to)
      if (s) expect(s.tab, `قسمُ ${t.to} يسمّي التبويبَ بغير اسمه`).toBe(t.label)
    }
  })

  it('وكلُّ صورةٍ يُشار إليها لها ملفٌّ وأبعاد — لا صورةَ مكسورةً في دليل', () => {
    const shots = GUIDE_SECTIONS.flatMap((s) => s.blocks).filter((b) => b.kind === 'figure').map((b) => (b as { shot: string }).shot)
    expect(shots.length, 'دليلٌ بلا صورةٍ واحدة — والطلبُ «اترك صورا من المنصّة»').toBeGreaterThan(8)
    for (const s of shots) {
      expect(GUIDE_SHOTS[s], `لا أبعادَ للصورة ${s}`).toBeTruthy()
      expect(existsSync(join(root, 'public/guides/trainer', `${s}.webp`)), `لا ملفَّ للصورة ${s}`).toBe(true)
    }
  })

  it('وكلُّ مرساةٍ في القائمة والرحلة تقود إلى قسمٍ موجود', () => {
    const ids = new Set(['first-week', 'faq', 'help', ...GUIDE_SECTIONS.map((s) => s.id)])
    for (const a of [...CHECKLIST.map((c) => c.anchor), ...JOURNEY.map((j) => j.anchor)]) {
      expect(ids.has(a), `مرساةٌ بلا قسم: #${a}`).toBe(true)
    }
  })

  /* ═══ وروابطُ النصّ كذلك (٤ أكتوبر ٢٠٢٦) ═══
     كانت المرساةُ تُحرَس في القائمة والرحلة وحدَهما، و[نصّ](#قسم) داخلَ الأقسام
     والأسئلة يُصيَّر رابطا لا يُسأل عنه — فقسمٌ يُعاد اسمُه يترك روابطَه تقفز إلى
     لا شيء بلا أن يحمرّ شيء. والقراءةُ بصيغة الرابط نفسِها التي يصيّرها
     `Guide.tsx` (`TOKEN`)، على المحتوى كلِّه لا على قسمٍ بعينه. */
  it('وكلُّ رابطٍ داخليٍّ في نصّ الدليل يقود إلى قسمٍ موجود', () => {
    const ids = new Set(['first-week', 'faq', 'help', ...GUIDE_SECTIONS.map((s) => s.id)])
    const text = JSON.stringify([GUIDE_SECTIONS, FAQ, CHECKLIST])
    const anchors = [...text.matchAll(/\[[^\]]+\]\(#([^)\s]+)\)/g)].map((m) => m[1])
    expect(anchors.length, 'لا رابطَ داخليّا يُقرأ — والدليلُ مليءٌ بها').toBeGreaterThan(10)
    const broken = anchors.filter((a) => !ids.has(a))
    expect(broken, `روابطُ إلى أقسامٍ لا وجودَ لها: ${broken.map((a) => `#${a}`).join('، ')}`).toEqual([])
  })
})
