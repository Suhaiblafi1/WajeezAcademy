/* إتاحةُ المدرّب ذهبت كلُّها — ولا تعود من بابٍ جانبيّ.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «احذف ساعاتي وفصولي وفترات غيابي..
   لأنه هو من يتحكم بكل شي.. واضح له أن اللقاءات بيده ويجب أن تكون ضمن فترة
   الشعبة نفسها التي وضعها بنفسه ابتداءً حتى النهاية».

   وكان مكانَ هذا الملفّ حارسٌ يقول العكس (`trainer-availability-ui.test.ts`):
   أنّ الشاشةَ تنادي `/api/trainer/me/availability` وتقول «مانعٌ لا تنبيه».
   فانقلب ولم يُحذف — كما انقلب قبله حارسُ التأهيل: ما كان يُحرَس وجودُه
   صار يُحرَس غيابُه، وما بقي من الشاشة يُحرَس كما كان.

   والفحصُ على **البنية** لا على ورود حرف: أسماءُ النماذج تُقرأ من رؤوسها في
   المخطّط، والمساراتُ من تسجيلها في `app.get(...)`، وحقولُ المدرّب المرشَّح
   من نوعه — لا من نصٍّ قد يسكن تعليقا يشرح لماذا ذهبت. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** الشيفرةُ بلا تعليقاتها — فالشرحُ الذي يذكر ما ذهب لا يُحسب عودةً له */
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const GONE_MODELS = ['TrainerAvailability', 'TrainerBlackout', 'TrainerTermAvailability']

describe('الجداولُ الثلاثة', () => {
  const models = new Set([...read('prisma/schema.prisma').matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]))

  it('المسحُ يقرأ فعلا — وإلّا خضرّ الحارسُ على مخطّطٍ لم يُقرأ', () => {
    expect(models.size).toBeGreaterThan(100)
    expect(models.has('TrainerProfile')).toBe(true)
  })

  it.each(GONE_MODELS)('لا نموذجَ «%s» في المخطّط', (name) => {
    expect(models.has(name), `عاد النموذج ${name}`).toBe(false)
  })

  it('وترحيلٌ يحذف جداولَها — فالقاعدةُ المرحَّلةُ لا تحمل ما خرج من المخطّط', () => {
    const dir = join(root, 'prisma/migrations')
    const sql = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        try { return readFileSync(join(dir, d.name, 'migration.sql'), 'utf8') } catch { return '' }
      })
      .join('\n')
      .replace(/^\s*--.*$/gm, '')
    for (const name of GONE_MODELS) {
      expect(sql, `لا ترحيلَ يحذف ${name}`).toMatch(new RegExp(`DROP TABLE (IF EXISTS )?"${name}"`))
    }
  })
})

describe('المسارات', () => {
  const routeDir = join(root, 'server/http/routes')
  const registered = readdirSync(routeDir)
    .filter((f) => f.endsWith('.ts'))
    .flatMap((f) => [...readFileSync(join(routeDir, f), 'utf8')
      .matchAll(/app\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g)].map((m) => m[1]))

  it('المسحُ يقرأ المساراتِ فعلا', () => {
    expect(registered.length).toBeGreaterThan(200)
    expect(registered).toContain('/api/trainer/me/qualifications')
  })

  it.each([
    '/api/trainer/me/availability',
    '/api/trainer/me/blackouts',
    '/api/trainer/me/terms',
    '/api/admin/terms/:id/available-trainers',
    '/api/admin/terms/:id/trainers/:profileId',
  ])('لا مسارَ يبدأ بـ«%s»', (prefix) => {
    expect(registered.filter((r) => r.startsWith(prefix))).toEqual([])
  })

  it('والخدمةُ نفسُها ذهبت — لا ملفَّ يبقى فيُنادى يوما', () => {
    expect(readdirSync(join(root, 'server/services'))).not.toContain('trainer-availability.service.ts')
  })
})

describe('شاشةُ المؤهّلات — ما بقي منها', () => {
  const screen = code('src/pages/trainer/Qualifications.tsx')

  /* وصارت تنادي عروضَه واقتراحاتِه معها (٢٩ سبتمبر ٢٠٢٦): «عروضي» دخلتها،
     وحالُ كلّ مؤهَّلٍ يُقرأ من الثلاثة. ولا إتاحةَ ولا نطاقَ فيها — القائمةُ
     مغلقةٌ كما كانت، فمن زاد نداءً عاد إلى هنا. */
  it('تنادي مؤهّلاتِه وعروضَه واقتراحاتِه وأفعالَ العرض — ولا تنادي غيرَها', () => {
    const calls = [...screen.matchAll(/api(?:Get|Post|Put|Patch|Delete)<?[^(]*\(\s*["'`]([^"'`]+)/g)].map((m) => m[1])
    expect([...new Set(calls)].sort()).toEqual([
      '/api/trainer/course-proposals',
      '/api/trainer/materials',
      '/api/trainer/me/qualifications',
      '/api/trainer/offers',
      '/api/trainer/offers/${lead.id}/prep-confirm',
      '/api/trainer/offers/${open.id}/accept',
      '/api/trainer/offers/${open.id}/decline',
    ])
  })

  it('ولها مسارٌ في التطبيق وبندٌ في قائمة المدرّب — باسمٍ لا يَعِد بما ذهب', () => {
    expect(code('src/App.tsx')).toMatch(/path="\/trainer\/qualifications"/)
    const tab = code('src/pages/trainer/TrainerLayout.tsx').split('\n').find((l) => l.includes('"/trainer/qualifications"'))
    expect(tab, 'لا بندَ للشاشة في قائمة المدرّب').toBeTruthy()
    expect(tab).toMatch(/label: "مؤهّلاتي"/)
  })

  /* باقٍ من الحارس الذي انقلب (٨ سبتمبر ٢٠٢٦)، وتبدّل نصُّه (٣٠ سبتمبر
     ٢٠٢٦): دوراتُ طلبه تبدأ «قيد الإعداد» ولا تُؤهَّل تلقائيّا — تُؤهَّل حين
     تُعتمد موادُّها. فحالةُ الفراغ تدلّه على «موادُّ دوراتك» ولا تَعِد بتأهيلٍ
     تلقائيٍّ لا يراه، ولا تعود إلى «الإدارةُ وحدَها تؤهّل». */
  it('وحالةُ الفراغ في التأهيل تقول الحقيقة: دوراتُ طلبك في «موادُّ دوراتك»', () => {
    expect(screen).toMatch(/فهي في «موادُّ دوراتك» أعلاه/)
    expect(screen, 'عاد الوعدُ بتأهيلٍ تلقائيٍّ لا يراه').not.toMatch(/reasonAr="تُؤهَّل تلقائيّا/)
    expect(screen, 'عادت الصيغةُ القديمة: التأهيلُ بيد الإدارة وحدَها').not.toMatch(/لا تستطيع أن تؤهّل نفسك/)
  })
})

describe('شاشةُ الإسناد لا تقرأ إتاحةً لا وجودَ لها', () => {
  /** حقولُ نوعٍ بعينه — من جسمه بين قوسيه، لا من الملفّ كلِّه */
  const fieldsOf = (src: string, iface: string) => {
    const at = src.indexOf(`interface ${iface} {`)
    expect(at, `لا نوعَ ${iface}`).toBeGreaterThanOrEqual(0)
    const body = src.slice(at, src.indexOf('\n}', at))
    return [...body.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1])
  }

  it('المدرّبُ المرشَّحُ عند الإدارة بلا «غائب» ولا «خارج ساعاته»', () => {
    const fields = fieldsOf(code('src/pages/admin/CohortOps.tsx'), 'EligibleTrainer')
    expect(fields).toContain('qualification')
    expect(fields).not.toContain('onLeave')
    expect(fields).not.toContain('outsideDeclaredHours')
  })

  it('والخادمُ لا يحسبهما — فلا حقلَ يُرسَل ولا يقرؤه أحد', () => {
    const svc = code('server/services/cohort.service.ts')
    const at = svc.indexOf('async eligibleTrainers(')
    expect(at).toBeGreaterThan(0)
    const body = svc.slice(at, svc.indexOf('\n  }\n', at))
    expect(body).toMatch(/qualification:/)
    expect(body).not.toMatch(/\bonLeave\b|\boutsideDeclaredHours\b|trainerBlackout|trainerAvailability/)
  })
})
