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
    const picker = read('src/components/CohortPicker.tsx')
    expect(picker).toContain('useUpcomingTerm')
    expect(picker).toContain('تُفتح في')
    /* وتبقى الجملةُ القديمةُ حين لا فصلَ — لا يُخترع موعد */
    expect(picker).toContain('يُعلن الموعد مع فتح الشعبة')
  })

  it('ونافذةُ التسجيل تُقرأ في مكانٍ واحد — لا ستّةُ مواضعَ تعيد اشتقاقَها', () => {
    const svc = read('server/services/term.service.ts')
    expect(svc).toMatch(/static registrationOpen\(/)
    /* والفارغةُ لا تمنع: «لم تُحدَّد» ليست «مغلقة» */
    expect(svc).toContain('return true')
  })
})
