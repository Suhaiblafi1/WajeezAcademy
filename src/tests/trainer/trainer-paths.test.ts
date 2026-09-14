/* مسارٌ يبنيه مدرّبٌ ويُعرض على الرفّ العامّ — ما يُحرَس (ن-١ … ن-٨).

   ═══ والأربعةُ الأخطرُ بنيويّةٌ لا نصّيّة ═══

   ① **ن-٢ · لا نشرَ لمن لم يُعتمد ظهورُه** — قاعدةُ `CLAUDE.md` نفسُها: «لا
      اسمَ مدرّبٍ يُعرض حقيقةً قبل توثيقه واعتمادِ نشره». ويُفحَص أنّ
      الاعتمادَ **والرفَّ** كليهما يمرّان بـ`trainerPubliclyVisible` — لا أن
      الكلمةَ واردةٌ في الملفّ.
   ② **ن-٥ · لا يزاحم في التشخيص** — والحارسُ على ما يكتبه فعلا: لا كتابةَ
      في `Pathway` ولا في مطالب مهاراتها من هذه الخدمة. فالوعدُ بالبنية لا
      براية.
   ③ **ن-٦ · لا سعرَ** — لا عمودَ في المخطّط أصلا. وحقلٌ غيرُ موجودٍ أصدقُ
      من حقلٍ تحرسه شاشة.
   ④ **ن-٤ · الإيقافُ يُغلق الرفَّ لا العقد** — ولا شيءَ في الخدمة يمسّ
      تسجيلا أو شعبةً أو موسما. «الرفُّ آليٌّ والعقدُ ليس». */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  canTrainerEdit, pathBlockersAr, PATH_LOCKED, PATH_OPEN, MIN_PATH_COURSES,
} from '../../application/trainer/path-rules'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const SVC = 'server/services/trainer-path.service.ts'
const schema = read('prisma/schema.prisma')
const model = (name: string) => schema.slice(schema.indexOf(`model ${name} {`), schema.indexOf('\n}', schema.indexOf(`model ${name} {`)))

/** مسوّدةٌ سليمةٌ — يُنقَض منها بندٌ في كلّ فحص */
const OK = {
  titleAr: 'من الفكرة إلى أوّل عمليّة مؤتمتة',
  courseIds: ['C-AUT-101', 'C-AI-105'],
  termId: 'term-1',
  qualifiedCourseIds: ['C-AUT-101', 'C-AI-105', 'C-DAT-101'],
  trainerPubliclyVisible: true,
}

describe('ن · مسارُ المدرّب', () => {
  const svc = code(SVC)

  it('الحالتان قسمةٌ لا تتداخل — وما خرج من يده لا يعود إليها بالتعديل', () => {
    const open = new Set<string>(PATH_OPEN)
    for (const s of PATH_LOCKED) expect(open.has(s), `${s} في الحالتَين معا`).toBe(false)
    expect(canTrainerEdit('draft')).toBe(true)
    expect(canTrainerEdit('rejected'), 'المردودُ لا يُعدَّل — فكيف يُصلَح؟').toBe(true)
    expect(canTrainerEdit('published'), 'المنشورُ يُعدَّل من تحت المراجعة').toBe(false)
    expect(canTrainerEdit('submitted')).toBe(false)
  })

  it('ن-٢ · لا يُرسَل مسارٌ لمن لم يُعتمد ظهورُه — ويُقال له لا يُخمَّن', () => {
    const blocked = pathBlockersAr({ ...OK, trainerPubliclyVisible: false })
    expect(blocked.length, 'مرّ مسارٌ لمن لم يُعتمد ظهورُه').toBeGreaterThan(0)
    expect(blocked.join(' '), 'مُنع بلا أن يُقال له لماذا').toMatch(/ظهورُ اسمك/)
    expect(pathBlockersAr(OK), 'مُنع مسارٌ مكتمل').toEqual([])
  })

  it('ون-٢ يُفرَض في الخادم لا في الشاشة — الاعتمادُ والرفُّ كلاهما', () => {
    /* الفحصُ على **موضع النداء** لا على ورودِ الاسم: بوّابةٌ مستوردةٌ ولا
       تُنادى في الاعتماد تترك الشاشةَ وحدَها تحرس. */
    const approve = svc.slice(svc.indexOf('async approve('), svc.indexOf('async reject('))
    expect(approve, 'الاعتمادُ لا يسأل عن اعتماد الظهور').toContain('trainerPubliclyVisible(')
    expect(approve).toMatch(/if\s*\(!trainerPubliclyVisible/)

    const shelf = svc.slice(svc.indexOf('async shelf('))
    expect(shelf, 'الرفُّ لا يُرشّح بحال الظهور — فيبقى الموقوفُ معروضا').toContain('trainerPubliclyVisible(')
  })

  it('ن-٤ · الإيقافُ يُغلق الرفَّ ولا يمسّ عقدا — ولا كتابةَ في تسجيلٍ أو شعبة', () => {
    /* «الرفُّ آليٌّ والعقدُ ليس»: الترشيحُ وقتَ القراءة يُخفي المسارَ، ولا
       شيءَ يتتالى. فأيُّ كتابةٍ في تسجيلٍ أو شعبةٍ من هذه الخدمة نقضٌ له. */
    for (const m of ['enrollment', 'cohort', 'order', 'payment']) {
      const w = new RegExp(`(?:prisma|tx)\\s*\\.\\s*${m}\\s*\\.\\s*(create|update|updateMany|delete|deleteMany|upsert)`)
      expect(w.test(svc), `خدمةُ المسار تكتب في \`${m}\` — والسحبُ ليس إلغاءً`).toBe(false)
    }
  })

  it('ن-٥ · لا يزاحم في التشخيص — ولا كتابةَ في المسارات المنسَّقة', () => {
    for (const m of ['pathway', 'pathwayCourse', 'pathwaySkillRequirement', 'pathwayDomain', 'pathwayVersion']) {
      const w = new RegExp(`(?:prisma|tx)\\s*\\.\\s*${m}\\s*\\.\\s*(create|createMany|update|updateMany|upsert)`)
      expect(w.test(svc), `خدمةُ المسار تكتب في \`${m}\` — فيدخل محرّكَ التوصية`).toBe(false)
    }
    /* والجدولُ نفسُه بلا علاقةٍ بالمهارات أو المجالات — فلا بابَ إلى المحرّك */
    const m = model('TrainerPath')
    expect(m, 'لمسار المدرّب مطالبُ مهارات — وهي مدخلُ التشخيص').not.toMatch(/SkillRequirement|PathwayDomain/)
  })

  it('ن-٦ · لا عمودَ سعرٍ في المخطّط — فليس ثمّة ما يُكتب', () => {
    const m = model('TrainerPath')
    expect(m, 'أُضيف سعرٌ إلى مسار المدرّب — والسعرُ بيد الإدارة').not.toMatch(
      /^\s*(price|priceUsd|listPrice|discount|currency)\s/mi,
    )
  })

  it('ون-١ · لا يُبنى إلّا من دوراته — وما خرج عنها يُقال قبل الإرسال', () => {
    const stray = pathBlockersAr({ ...OK, courseIds: ['C-AUT-101', 'C-XXX-999'] })
    expect(stray.join(' '), 'مرّت دورةٌ لم يُؤهَّل لها').toMatch(/لستَ مؤهَّلا/)
    expect(stray.join(' '), 'لم يُسمَّ الرمزُ الذي منعه').toContain('C-XXX-999')
  })

  it('ون-٣ · الموسمُ يلزم — فالبطاقةُ تقول متى يُفتح التسجيلُ من التقويم', () => {
    expect(pathBlockersAr({ ...OK, termId: null }).join(' ')).toMatch(/الموسم/)
    /* والعلاقةُ إلى `Term` لا نصٌّ حرّ */
    expect(model('TrainerPath')).toMatch(/term\s+Term\?/)
  })

  it('ودورةٌ واحدةٌ ليست مسارا', () => {
    expect(pathBlockersAr({ ...OK, courseIds: ['C-AUT-101'] }).join(' ')).toContain(String(MIN_PATH_COURSES))
  })

  it('وأبوابُه محروسةٌ بصلاحيّاتها — والنشرُ ليس بيد صاحبه', () => {
    const trainer = code('server/http/routes/trainer-portal.routes.ts')
    const at = trainer.indexOf("'/api/trainer/paths'")
    expect(at, 'لا مسارَ في بوّابة المدرّب').toBeGreaterThan(0)
    expect(trainer.slice(at, at + 300)).toContain("requirePermission('trainer.portal')")
    /* ولا بابَ نشرٍ في بوّابته: من يُدرج نفسَه على رفٍّ عامٍّ لا مراجعةَ عليه */
    expect(trainer, 'بابُ نشرٍ في بوّابة المدرّب').not.toContain('/paths/:id/approve')

    const admin = code('server/http/routes/admin-trainer.routes.ts')
    for (const door of ['approve', 'reject', 'retire']) {
      const i = admin.indexOf(`/api/admin/trainer-paths/:id/${door}`)
      expect(i, `لا بابَ لـ${door}`).toBeGreaterThan(0)
      expect(admin.slice(i, i + 300), `بابُ ${door} بلا حارس`).toContain("requirePermission('trainer.publish')")
    }
  })

  it('وبابُه في القائمتَين — ومسارُه في التطبيق', () => {
    expect(code('src/pages/admin/AdminLayout.tsx'))
      .toMatch(/to: "\/admin\/trainer-paths"[^}]*need: "trainer\.publish"/)
    expect(code('src/App.tsx')).toContain('/admin/trainer-paths')
    expect(code('src/App.tsx')).toContain('/trainer/paths')
  })

  it('والرفُّ العامُّ في صفحة المسارات وحدَها — لا في صفحة الدورات', () => {
    const cat = code('src/pages/Catalog.tsx')
    expect(cat, 'الرفُّ غيرُ مركَّب').toContain('<TrainerPathsShelf />')
    expect(cat, 'الرفُّ يظهر في صفحة الدورات أيضا').toMatch(/isPathways \? <TrainerPathsShelf \/> : null/)
  })

  it('ويقول للزائر إنّه ليس من مسارات التشخيص — فلا يُظنّ توصيةً قِيست', () => {
    expect(read('src/components/TrainerPathsShelf.tsx')).toContain('مسارات أعدّها مدرّبونا المعتمدون')
    expect(read('src/components/TrainerPathsShelf.tsx')).toMatch(/غيرُ مسارات/)
  })
})
