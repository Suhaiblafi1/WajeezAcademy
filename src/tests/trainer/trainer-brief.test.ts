/* «التدريبُ معنا» — صفحةُ الدعوة: عامّةٌ لمن معه الرابط، مخفيّةٌ عن غيره (٥ أكتوبر ٢٠٢٦).

   القرارُ في `application/trainer/trainer-brief.ts`: «صفحةٌ أو صفحتان… برابطٍ في
   الموقع لكن مخفيّ». فأربعةٌ تُحرَس، والفحصُ على البنية بعد نزع التعليقات —
   فالتعليقُ الذي يشرح القرارَ يذكر المسارَ ولا يُحسب رابطا إليه:

   ① **تُفتح بلا دخول** — المدعوُّ لا حسابَ له: المسارُ في جدول المسارات قبل
      حارس الأدوار.
   ② **ولا يقود إليها شيء** — لا ملفَّ في `src` يذكر مسارَها غيرُها ومُعرِّفُها
      وجدولُ المسارات، ولا هي في `PUBLIC_PAGES` (خريطةُ الموقع)، وتعلن `noindex`.
      وحجبُ الزاحف في `src/tests/seo/robots.test.ts` بمطابقِه الحقيقيّ.
   ③ **وكلُّ رابطٍ فيها يُفتح** — مرساةُ الدليل قسمٌ موجود، والمسارُ مسارٌ يُخدَم.
   ④ **وما تقوله يطابق مصدرَه** — صيغُ الأتعاب صيغُ `TrainerCompensationRule`
      لا أقلّ ولا أكثر، وحجمُ الكتالوج حجمُه. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRAINER_BRIEF_PATH } from '../../application/trainer/trainer-brief'
import { TRAINER_GUIDE_PATH } from '../../application/trainer/trainer-guide'
import { PUBLIC_PAGES } from '../../application/site/public-pages'
import { GUIDE_SECTIONS } from '../../data/trainer-guide/content'
import * as BRIEF from '../../data/trainer-brief/content'

const root = process.cwd()
const strip = (s: string) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (p: string) => strip(readFileSync(join(root, p), 'utf8'))
const APP = code('src/App.tsx')
const PAGE = code('src/pages/trainer/TrainerBrief.tsx')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('① تُفتح بلا دخول', () => {
  /* في الكتلة العامّة نفسِها التي فيها الدليل — بعده وقبل الحارس الذي يليه.
     وعموميّةُ الدليل يحرسها `guide-link.test.ts` (③). */
  it('المسارُ في جدول المسارات، بجانب الدليل وقبل حارس الأدوار', () => {
    const guide = APP.indexOf(`path="${TRAINER_GUIDE_PATH}"`)
    const route = APP.indexOf(`path="${TRAINER_BRIEF_PATH}"`)
    const guard = APP.indexOf('<Route element={<RequireRole', guide)
    expect(route, 'لا مسارَ للصفحة في App.tsx').toBeGreaterThan(-1)
    expect(guide).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(-1)
    expect(route, 'الصفحةُ قبل الدليل — خارجَ كتلته العامّة').toBeGreaterThan(guide)
    expect(route, 'الصفحةُ داخلَ حارس الأدوار — والمدعوُّ لا حسابَ له').toBeLessThan(guard)
    expect(APP.indexOf('<Route element={<RequireRole allow={TRAINER_ROLES} />}>'), 'وقبل حارس البوّابة بعينه').toBeGreaterThan(route)
  })

  it('وتحت `/trainer/` — فيحجبها سطرُ robots.txt الذي يحجب البوّابة', () => {
    expect(TRAINER_BRIEF_PATH.startsWith('/trainer/')).toBe(true)
  })
})

describe('② ولا يقود إليها شيء', () => {
  it('لا ملفَّ يذكر مسارَها غيرُها ومُعرِّفُها وجدولُ المسارات', () => {
    const allowed = new Set([
      'src/App.tsx',
      'src/application/trainer/trainer-brief.ts',
      'src/pages/trainer/TrainerBrief.tsx',
    ])
    const leaks = walk(join(root, 'src'))
      .map((f) => relative(root, f))
      .filter((f) => !f.startsWith('src/tests/') && !allowed.has(f))
      .filter((f) => {
        const src = code(f)
        return src.includes(TRAINER_BRIEF_PATH) || /\bTRAINER_BRIEF_PATH\b/.test(src)
      })
    expect(leaks, `يقود إلى الصفحة المخفيّة: ${leaks.join('، ')}`).toEqual([])
  })

  it('وليست في خريطة الموقع', () => {
    expect(PUBLIC_PAGES.map((p) => p.path)).not.toContain(TRAINER_BRIEF_PATH)
  })

  it('وتعلن noindex', () => {
    const seo = PAGE.slice(PAGE.indexOf('<SeoHead'), PAGE.indexOf('/>', PAGE.indexOf('<SeoHead')))
    expect(seo, 'لا SeoHead في الصفحة').toContain('path={TRAINER_BRIEF_PATH}')
    expect(seo, 'الصفحةُ المخفيّةُ لا تقول للزاحف ألّا يفهرسها').toMatch(/\bnoindex\b/)
  })
})

describe('③ وكلُّ رابطٍ فيها يُفتح', () => {
  const text = JSON.stringify(Object.values(BRIEF))
  const links = [...text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1])
  const routes = new Set([...APP.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))
  const guideIds = new Set(['first-week', 'faq', 'help', 'journey', ...GUIDE_SECTIONS.map((s) => s.id)])

  it('تُقرأ الروابطُ فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(links.length).toBeGreaterThan(6)
  })

  it('ومرساةُ الدليل قسمٌ فيه', () => {
    const broken = links
      .filter((h) => h.startsWith(`${TRAINER_GUIDE_PATH}#`))
      .filter((h) => !guideIds.has(h.split('#')[1]))
    expect(broken, `مراسٍ لا قسمَ لها في الدليل: ${broken.join('، ')}`).toEqual([])
  })

  it('والمسارُ مسارٌ يُخدَم', () => {
    const broken = links.filter((h) => h.startsWith('/')).map((h) => h.split('#')[0]).filter((p) => !routes.has(p))
    expect(broken, `روابطُ إلى مساراتٍ لا تُخدَم: ${broken.join('، ')}`).toEqual([])
  })
})

describe('④ وما تقوله يطابق مصدرَه', () => {
  it('صيغُ الأتعاب صيغُ قاعدة التعويض — لا أقلّ ولا أكثر', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
    const model = schema.slice(schema.indexOf('model TrainerCompensationRule'))
    const line = /type\s+String\s*\/\/\s*([\w |]+)/.exec(model)
    expect(line, 'تغيّر سطرُ النوع في TrainerCompensationRule — راجع هذا الحارس').toBeTruthy()
    const types = line![1].split('|').map((t) => t.trim()).filter(Boolean).sort()
    expect(BRIEF.PAY_MODELS.map((m) => m.id).sort()).toEqual(types)
  })

  it('والموصى بها واحدةٌ، وهي «لكلّ متعلّم» — صاحبةُ الحدّ الأدنى وأجرِ الرابط', () => {
    expect(BRIEF.PAY_MODELS.filter((m) => m.recommended).map((m) => m.id)).toEqual(['per_seat'])
  })

  it('وحجمُ الكتالوج حجمُه', () => {
    const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
      courses: unknown[]; launch_pathways: unknown[]
    }
    expect(Math.abs(catalog.courses.length - BRIEF.CATALOG_COURSES_ABOUT), '«نحو» تبعد عن العدد أكثرَ من عشر').toBeLessThanOrEqual(10)
    expect(catalog.launch_pathways.length).toBe(BRIEF.CATALOG_PATHWAYS)
  })
})
