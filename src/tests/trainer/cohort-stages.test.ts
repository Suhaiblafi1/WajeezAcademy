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

  it('دالّةُ القائمة واحدةٌ يقرؤها كلُّ من يحكم — لا نسخٌ تفترق', () => {
    expect(svc).toMatch(/export function buildChecklist\(/)
    /* ثلاثةُ قرّاءٍ منذ ١٥ سبتمبر ٢٠٢٦: الورشةُ، والموجزُ، و**الإرسالُ
       نفسُه**. وكان `submit` يقبل بلا أن يسأل القائمةَ — فالحاجزُ زرٌّ
       مطفأٌ في الشاشة وحدَها، لا يمنع طلبا يُرسَل بيدٍ أخرى.

       والمحروسُ عددُ النسخ لا عددُ النداءات: دالّةٌ واحدةٌ مصدَّرة، ومن
       أرادها ناداها. فلو نُسخت قاعدةٌ ثانيةٌ في `submit` لافترقت عمّا
       تعرضه الشاشة. */
    expect((svc.match(/buildChecklist\(\{/g) ?? []).length, 'الورشةُ والموجزُ والإرسالُ لا يقرؤون الدالّةَ نفسَها').toBe(3)
    expect((svc.match(/function buildChecklist\(/g) ?? []).length, 'نسخةٌ ثانيةٌ من الدالّة').toBe(1)
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

/* الطورُ يسبق خطواتِه — وإلّا قُرئ «التشغيل» خانةً تتكرّر عند كلّ خطوة.

   كان خطُّ الخطوات الستّ يُصيَّر أوّلا واللسانُ تحته، ويبقى الخطُّ ظاهرا في
   التشغيل. فيراه المدرّبُ فوق «التشغيل» في كلّ خطوةٍ يفتحها ولا يدري
   أيُّهما يحوي الآخر. */
describe('الطورُ قبل خطواته', () => {
  const ws = code(WS)

  it('لسانُ «التجهيز/التشغيل» يسبق خطَّ الخطوات في الشيفرة', () => {
    const tab = ws.indexOf('<TabBar')
    const steps = ws.indexOf('STAGES.map')
    expect(tab, 'لا لسانَ للطورين').toBeGreaterThan(-1)
    expect(steps, 'لا خطَّ للخطوات').toBeGreaterThan(-1)
    expect(tab, 'الخطواتُ تُصيَّر قبل اللسان — فيُقرأ الطورُ تابعا لها').toBeLessThan(steps)
  })

  it('وخطُّ الخطوات لا يظهر إلّا في التجهيز', () => {
    /* الشرطُ يسبق الخطَّ مباشرةً — ولا يكفي وجودُه في الملفّ */
    const steps = ws.indexOf('STAGES.map')
    const before = ws.slice(Math.max(0, steps - 400), steps)
    expect(before, 'الخطواتُ تظهر في التشغيل أيضا').toContain('phase === "prepare" &&')
  })

  /* ═══ حدُّ المحور المفتوح ═══

     شكوى ١٣ سبتمبر ٢٠٢٦: «لا أميّز متى تنتهي الشاشةُ المنسدلة». وثمانيةُ
     محاورَ بأرضيّةٍ واحدةٍ وحافّةٍ واحدةٍ خافتة، فإذا فُتح أحدُها امتدّ خمسةَ
     حقولٍ لا يُرى طرفاه.

     والحارسُ على **الاختلاف** لا على لونٍ بعينه: من أراد نبرةً أخرى فله
     ذلك ما دام المفتوحُ يختلف عن المطويّ. ولو ثُبّت اللونُ هنا لصار الحارسُ
     يمنع تحسينَ التصميم بدل أن يمنع عودةَ العطب. */
  it('⚠️ والمحورُ المفتوح بنبرةٍ غيرِ المطويّ — وإلّا لم يُعرف أين ينتهي', () => {
    const m = ws.match(/<Card as="li"[^>]*tone=\{open \? "(\w+)" : "(\w+)"\}/)
    expect(m, 'نبرةُ بطاقة المحور لا تتبع كونَه مفتوحا').toBeTruthy()
    expect(m![1], `المفتوحُ والمطويُّ على نبرةٍ واحدة (${m![1]})`).not.toBe(m![2])
  })
})
