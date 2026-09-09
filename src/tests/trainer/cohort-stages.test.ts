/* صفحةُ الشعبة الواحدة — مراحلُ على خطّ، ومرحلتان: تجهيزٌ وتشغيل.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): صفحةٌ واحدةٌ للشعبة بدل شاشتين،
   وفيها «مراحلُ ينجزها لكلّ شعبة» — الاسمُ والمواعيدُ، والمحاورُ، والمصادرُ،
   واللقاءاتُ، والتكاليفُ، والاعتمادُ — ثمّ التشغيل. و«شعبي» بطاقاتٌ بحلقة
   تقدّمٍ من الخادم.

   والفحصُ على البنية:
   · المراحلُ تُقرأ من قائمة الخادم (`ws.checklist`) لا تُخمَّن في الواجهة،
     والمرحلةُ المفتوحةُ معلَنةٌ بـ`aria-current="step"`.
   · المرحلتان من `TabBar` لا شريطٌ مكتوبٌ بيده.
   · التشغيلُ مكوّنٌ واحد (`CohortOps`) يقرأ الشعبةَ بعينها لا القائمةَ كلَّها.
   · «شعبي» يقرأ الموجزَ ولا يحمل أدواتِ التشغيل.
   · والخادمُ يحسب القائمةَ بدالّةٍ واحدةٍ للورشة والموجز معا. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = 'src/pages/trainer/CohortWorkspace.tsx'
const OPS = 'src/pages/trainer/CohortOps.tsx'
const BOARD = 'src/pages/trainer/CohortBoard.tsx'
const SVC = 'server/services/cohort-plan.service.ts'
const ROUTES = 'server/http/routes/learning-portal.routes.ts'

describe('صفحةُ الشعبة — مراحلُ على خطّ', () => {
  const ws = code(WS)

  it('المراحلُ الستُّ بمفاتيح قائمة الخادم، والتكاليفُ بينها', () => {
    for (const key of ['identity', 'modules', 'resources', 'sessions', 'assignments', 'approval']) {
      expect(ws, `مرحلةٌ مفقودة: ${key}`).toMatch(new RegExp(`key: "${key}"`))
    }
    expect(ws, 'الحالةُ لا تُقرأ من قائمة الخادم').toMatch(/new Map\(ws\.checklist\.map\(/)
  })

  it('والمرحلةُ المفتوحةُ معلَنة، والحلقةُ من `ui/ProgressRing`', () => {
    expect(ws).toMatch(/aria-current=\{selected \? "step" : undefined\}/)
    expect(ws).toMatch(/<ProgressRing\b/)
  })

  it('والمرحلتان من `TabBar`، والتشغيلُ مكوّنٌ للشعبة بعينها', () => {
    expect(ws).toMatch(/<TabBar[\s\S]*?id: "prepare"[\s\S]*?id: "run"/)
    expect(ws).toMatch(/<CohortOps cohortId=\{ws\.cohort\.id\}/)
    expect(code(OPS)).toContain('/api/trainer/cohorts/${cohortId}/ops')
    expect(code(OPS), 'التشغيلُ يقرأ القائمةَ كلَّها لشعبةٍ واحدة').not.toContain('/api/trainer/my-cohorts')
  })

  it('و«شعبي» بطاقاتٌ من الموجز — بلا أدواتِ تشغيل', () => {
    const board = code(BOARD)
    expect(board).toContain('/api/trainer/cohorts/summary')
    expect(board).toContain('/trainer/cohort/${c.id}')
    expect(board, 'الحضورُ ما زال في «شعبي»').not.toContain('ATTENDANCE_OPTIONS')
    expect(board, 'الرسائلُ ما زالت في «شعبي»').not.toContain('/messages')
  })
})

describe('الخادم — قائمةٌ واحدةٌ للورشة والموجز', () => {
  const svc = code(SVC)

  it('دالّةُ القائمة واحدةٌ تُنادى مرّتين — لا نسختان تفترقان', () => {
    expect(svc).toMatch(/export function buildChecklist\(/)
    expect((svc.match(/buildChecklist\(\{/g) ?? []).length, 'الورشةُ والموجزُ لا يقرآن الدالّةَ نفسَها').toBe(2)
    expect(svc).toMatch(/key: 'assignments'[^}]*optional: true/)
  })

  it('ومحاورُ الكتالوج الثابت تسند الورشةَ حين تخلو القاعدة', () => {
    expect(svc).toMatch(/dbModules\.length > 0 \? dbModules : await staticModulesFor\(/)
  })

  it('والمساران مسجَّلان بصلاحيّة التشغيل', () => {
    const routes = code(ROUTES)
    for (const path of ['/api/trainer/cohorts/summary', '/api/trainer/cohorts/:id/ops']) {
      const at = routes.indexOf(`app.get('${path}'`)
      expect(at, `المسارُ مفقود: ${path}`).toBeGreaterThan(0)
      expect(routes.slice(at, at + 200)).toContain("requirePermission('trainer.cohort.operate')")
    }
  })
})
