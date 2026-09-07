/* الفصلُ يبلغ الأسطح — والموسمُ لا يسقط صامتا (البنود ٤٦ · ٤٧ · ٥١ · ٥٢ · ٥٣). */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const schema = read('prisma/schema.prisma')
const migration = read('prisma/migrations/20260906120000_term_system/migration.sql')

describe('٤٦ · الفصلُ كيانٌ مستقلٌّ لا حقلٌ على الشعبة', () => {
  it('لأنّ «المدرّبون المتاحون لهذا الفصل» يجب أن توجد قبل الشعب', () => {
    expect(schema).toMatch(/model Term \{/)
    expect(schema).toMatch(/model TrainerTermAvailability \{/)
  })

  it('وللفصل حالتُه ونافذتُه ونشرُ تقويمه — لا تُكرَّر على كلّ شعبة', () => {
    for (const field of ['registrationOpensAt', 'registrationClosesAt', 'calendarPublishedAt', 'openedAt']) {
      expect(schema, `${field} ليست على الفصل`).toContain(field)
    }
  })

  it('وفصلُ الشعبة قابلٌ للإفراغ — المسوّداتُ تُنشأ قبل أن يُقرَّر فصلُها', () => {
    expect(schema).toMatch(/termId\s+String\?/)
  })

  it('ومفتاحُ الفصل فريدٌ بسنته وموسمه — لا فصلان بالاسم نفسِه', () => {
    expect(schema).toMatch(/@@unique\(\[year, season\]\)/)
  })
})

describe('٤٧ · مجالُ الدورة يصير بيانا — وبدونه لا يعمل المخطِّط', () => {
  it('العمودُ في القاعدة لا في المتصفّح وحدَه', () => {
    expect(schema).toMatch(/domainAr\s+String\?/)
    expect(schema).toMatch(/collisionGroup\s+String\?/)
  })

  it('ويُملأ في الترحيل من العائلة نفسِها — لا يُترك فارغا فيُملأ يدويّا', () => {
    expect(migration).toContain('UPDATE "Course" SET "domainAr"')
    /* أمثلةٌ من الجدول نفسِه — لو تغيّر مصدرُ العائلات لسقط هذا */
    expect(migration).toContain('الأمن السيبراني')
    expect(migration).toContain('التسويق')
  })
})

describe('والترحيلُ لا يُفقد بيانا', () => {
  it('مواسمُ المدرّبين تُنقل من JSON إلى صفوفٍ تُستعلَم', () => {
    expect(migration).toContain('INSERT INTO "TrainerTermAvailability"')
    expect(migration).toContain("jsonb_array_elements_text")
    expect(migration).toContain("'seasons'")
  })

  it('والفصولُ تُنشأ أوّلا فيوجد ما يُربط به', () => {
    expect(migration).toContain('INSERT INTO "Term"')
    expect(migration.indexOf('INSERT INTO "Term"'))
      .toBeLessThan(migration.indexOf('INSERT INTO "TrainerTermAvailability"'))
  })

  it('وقيودُ الحالات مولَّدةٌ لا مكتوبةٌ باليد — عُرفُ المستودَع', () => {
    expect(migration).toContain('"Term_status_allowed"')
    expect(migration).toContain('"TrainerTermAvailability_status_allowed"')
  })
})

describe('٥٣ · الموسمُ لا يسقط صامتا', () => {
  it('النموذجُ القديمُ يجمع المواسمَ ويُرسلها — وكان يُسقطها', () => {
    const form = read('src/pages/JoinTrainerComplete.tsx')
    expect(form, 'النموذجُ القديمُ ما زال بلا مواسم').toContain('TRAINING_SEASONS')
    expect(form).toMatch(/availability: \{\s*\n?\s*days, seasons, periods/)
  })

  it('والخادمُ يشترطها — فلا يمرّ مسارٌ آخرُ بلا موسم', () => {
    const routes = read('server/http/routes/trainer-applications.routes.ts')
    expect(routes, 'الموسمُ ما زال اختياريّا في الخادم')
      .toMatch(/seasons: z\.array\(z\.enum\(TRAINING_SEASON_VALUES\)\)\.min\(1/)
  })
})

describe('٥١ · ٥٢ · النافذةُ والفصلُ القادم يبلغان الزائر', () => {
  it('مسارٌ عامٌّ بلا مصادقة — الزائرُ هو المقصود', () => {
    const routes = read('server/http/routes/term.routes.ts')
    expect(routes).toContain('/api/public/upcoming-term')
    /* لا حارسَ عليه: من يسأل «متى تبدأ؟» ليس مسجَّلا بعد */
    const publicBlock = routes.slice(routes.indexOf('/api/public/upcoming-term') - 300, routes.indexOf('/api/public/upcoming-term') + 200)
    expect(publicBlock).not.toContain('requirePermission')
  })

  it('و«يُعلن الموعد مع فتح الشعبة» صار لها تتمّةٌ حين يوجد فصل', () => {
    /* كان هذا يفحص أنّ `CohortPicker` ينادي `useUpcomingTerm` ويكتب «تُفتح في»
       بنفسه — وهي آليّةٌ لا ثابت. ولمّا بلغت الجملةُ خمسةَ أسطحٍ صار كتبُها في
       كلٍّ منها هو العطبَ بعينه، فانتقلت إلى مكوّنٍ واحد. والثابتُ الذي كان
       يُقصد باقٍ: المنتقي يقول التتمّةَ حين يوجد فصل، والجملةَ القديمةَ حين
       لا فصل. وتفصيلُ الأسطح الخمسة في `upcoming-term-surfaces.test.ts`. */
    const picker = read('src/components/CohortPicker.tsx')
    expect(picker).toMatch(/from ["']@\/components\/UpcomingTermNote["']/)
    expect(picker).toContain('يُعلن الموعد مع فتح الشعبة')
    const note = read('src/components/UpcomingTermNote.tsx')
    expect(note).toContain('تُفتح في')
  })

  it('ونافذةُ التسجيل تُقرأ في مكانٍ واحد — لا ستّةُ مواضعَ تعيد اشتقاقَها', () => {
    /* وكان هذا يفحص `return true` في `term.service` — أي أنّ الحسابَ هناك.
       ثمّ وُصلت المواضعُ الستّة بـ`registration-window` (البند ٥١) فصار ما في
       الخدمة نسخةً ثانيةً منه بحرفه، وهو عينُ العيب. فذهب الحسابُ وبقي الاسم،
       وهذا ما يُفحص: أنّها **تفوّض** ولا تعيد الاشتقاق. */
    const svc = read('server/services/term.service.ts')
    expect(svc).toMatch(/static registrationOpen\(/)
    expect(svc, 'الخدمةُ تعيد اشتقاقَ النافذة بنفسها').toContain('termWindowVerdict')
    expect(svc).not.toMatch(/now < term\.registrationOpensAt/)
    /* والفارغةُ لا تمنع — والحكمُ في موضعه الواحد */
    const win = read('server/services/registration-window.ts')
    expect(win).toMatch(/if \(!term\) return \{ open: true \}/)
  })
})

describe('٤٩ · «افتح الفصل» — بمعاينةٍ قبل التطبيق وبالبوّابة نفسِها', () => {
  const svc = read('server/services/term-planning.service.ts')
  const routes = read('server/http/routes/term.routes.ts')

  it('المعاينةُ هي الافتراضيّ — لا زرَّ ينفّذ قبل أن تُعرض النتيجة', () => {
    expect(routes).toMatch(/apply: z\.boolean\(\)\.optional\(\)\.default\(false\)/)
    expect(svc, 'يُطبَّق بلا طلبٍ صريح').toContain('if (!opts.apply) return result')
  })

  it('والفتحُ يمرّ بشروط الفتح الستّة — لا بابَ خلفيّ', () => {
    expect(svc).toContain('openChecklist')
    expect(svc, 'يُفتح بلا فحص').toMatch(/if \(check\.ready\)/)
  })

  it('وما نقصه شيءٌ يبقى مسوّدةً ونقصُه مكتوبٌ في صفّه', () => {
    expect(svc).toMatch(/row\.blocked = check\.missing/)
  })

  it('ولا تُفتح دورةٌ بسعرٍ مُختلَق', () => {
    expect(svc).toContain('بلا سعر قائمة')
  })

  it('وحدثُ أثرٍ واحدٌ بالخطّة كاملة — لا ثمانون حدثا يُقرأ منها لا شيء', () => {
    expect(svc).toContain("action: 'term.plan_open'")
    expect(svc).toMatch(/plan: rows\.map/)
  })
})

describe('٥٠ · التقويمُ — ما يُعرض وما لا يُعرض', () => {
  const svc = read('server/services/term-calendar.service.ts')
  const page = read('src/pages/Calendar.tsx')

  it('لا تقويمَ قبل نشره — الفصلُ المخطَّطُ ليس وعدا', () => {
    expect(svc).toMatch(/if \(!term\.calendarPublishedAt\) return null/)
  })

  it('ولا اسمَ مدرّبٍ قبل اعتماد نشره — قاعدةُ المنصّة لا استثناء', () => {
    expect(svc).toMatch(/publicVisibility && lead\.publishApprovedAt !== null/)
    expect(svc, 'الاسمُ يُعرض بلا شرط').toMatch(/named \? lead\.application\.fullName : null/)
  })

  it('ولا جلساتٍ للزائر — مواعيدُها تفصيلُ من اشترى', () => {
    expect(svc, 'الجلساتُ تُقرأ في التقويم العامّ').not.toMatch(/sessions:\s*(true|\{)/)
  })

  it('وشعبةٌ بلا شهرٍ تُلحق ولا تُحذف — الغيابُ أسوأُ من موضعٍ تقريبيّ', () => {
    expect(svc).toMatch(/monthWithinTerm === null/)
    expect(svc).toContain('months[0].entries.push')
  })

  it('والصفحةُ ثلاثةُ أعمدةٍ للأشهر لا قائمةٌ من ثمانين', () => {
    expect(page).toMatch(/lg:grid-cols-3/)
    expect(page).toContain('MONTH_LABEL')
  })

  it('والزائرُ يبلغها من القائمة — صفحةٌ لا رابطَ إليها ليست صفحة', () => {
    const shell = read('src/components/SiteShell.tsx')
    expect(shell).toMatch(/href: '\/calendar'/)
    const app = read('src/App.tsx')
    expect(app).toMatch(/path="\/calendar"/)
  })

  it('وللمسجَّل النسخةُ نفسُها موسومةً بما سُجِّل فيه', () => {
    const routes = read('server/http/routes/term.routes.ts')
    expect(routes).toContain('/api/learner/term-calendar')
    expect(svc).toMatch(/enrolled/)
  })
})
