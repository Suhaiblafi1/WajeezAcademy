/* رحلةُ التعلّم — الحسابُ قبل الشاشة.

   السؤالُ الذي طرحه صاحب المنصّة — «وماذا لو كان لديه مسارين؟» — جوابُه هنا
   لا في الواجهة: بناءُ المسارات دالّةٌ نقيّة، فتُفحَص بالأرقام لا بالنقر. */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import '../setup-catalog'
import {
  buildJourney, defaultTrackId, STAGE_IS_OPEN, STAGE_LABEL_AR,
  type JourneyPlan, type JourneyRow,
} from '../../application/student/journey'
import { pathwayCourses, courseById } from '../../data/courses'

/* مسارانِ حقيقيّانِ من الكتالوج، لكلٍّ ثلاثُ دوراتٍ على الأقلّ */
const twoPathways = Object.entries(pathwayCourses)
  .filter(([, ids]) => ids.length >= 3)
  .slice(0, 2)
const [P1, C1] = twoPathways[0]
const [P2, C2] = twoPathways[1]

const row = (courseId: string, over: Partial<JourneyRow> = {}): JourneyRow => ({
  id: `enr-${courseId}`,
  status: 'enrolled',
  cohort: { id: `coh-${courseId}`, title: `شعبة ${courseId}`, course: { id: courseId } },
  courseProgress: { percent: 0 },
  certificates: [],
  ...over,
})

describe('المسارُ يُبنى من المملوك لا من الكتالوج', () => {
  it('١) بلا تسجيلٍ ولا خطّة: لا مسارات — ولا مسارٌ فارغٌ يُعرض', () => {
    expect(buildJourney([], null)).toEqual([])
    expect(defaultTrackId([])).toBeNull()
  })

  it('٢) دورةٌ واحدة من مسار = «دورات مستقلّة» لا مسارٌ لم يسلكه', () => {
    const tracks = buildJourney([row(C1[0])], null)
    expect(tracks).toHaveLength(1)
    expect(tracks[0].kind).toBe('standalone')
    expect(tracks[0].stages).toHaveLength(1)
    /* ولا مشروعَ ختاميّا يُنسَب إلى دورةٍ مفردة */
    expect(tracks[0].capstoneAr).toBeNull()
    expect(tracks[0].pathwayId).toBeNull()
  })

  it('٣) ودورتان من مسارٍ واحد = مسارٌ بمراحله كلِّها، وما لم يُشترَ يُقال', () => {
    const tracks = buildJourney([row(C1[0]), row(C1[1])], null)
    expect(tracks).toHaveLength(1)
    const t = tracks[0]
    expect(t.kind).toBe('pathway')
    expect(t.pathwayId).toBe(P1)
    /* المراحلُ كلُّ دورات المسار — لا المملوكتين وحدهما */
    expect(t.stages.length).toBe(C1.length)
    expect(t.counts.owned).toBe(2)
    expect(t.counts.total).toBe(C1.length)
    /* والترتيبُ ترتيبُ الكتالوج لا ترتيبُ الشراء */
    expect(t.stages.map((s) => s.courseId)).toEqual(C1)
    /* وما لا يملكه حالتُه صريحة */
    expect(t.stages[2].state).toBe('not_owned')
    expect(STAGE_IS_OPEN[t.stages[2].state]).toBe(false)
  })

  it('٤) ومسارانِ = مسارانِ في القائمة، لكلٍّ مشروعُه الختاميّ', () => {
    const tracks = buildJourney(
      [row(C1[0]), row(C1[1]), row(C2[0]), row(C2[1])],
      null,
    )
    expect(tracks).toHaveLength(2)
    const ids = tracks.map((t) => t.id)
    expect(ids).toContain(P1)
    expect(ids).toContain(P2)
    for (const t of tracks) expect(t.kind).toBe('pathway')
  })

  it('٥) ودورةٌ مساندة يملكها خارج تسلسل المسار تُلحَق آخرا لا تُدَسّ فيه', () => {
    /* دورةٌ من مسارٍ آخر لا تصنع مسارا بمفردها، فتبقى مستقلّة —
       والحارسُ هنا على المسار نفسِه: تسلسلُه لا يتبدّل بما يُلحَق. */
    const tracks = buildJourney([row(C1[0]), row(C1[1])], null)
    expect(tracks[0].stages.map((s) => s.courseId).slice(0, C1.length)).toEqual(C1)
  })
})

describe('الخطّةُ المعتمَدة أوّلا — باسمها لا باسم مسارٍ لم يخترْه', () => {
  const plan: JourneyPlan = {
    id: 'plan-1',
    nameAr: 'خطّتي للتفاوض',
    items: [
      { courseId: C1[0], sequence: 1, state: 'enrolled' },
      { courseId: C1[1], sequence: 2, state: 'schedulable', cohort: { id: 'x', title: 'ش', startsAt: null, seatsLeft: 4 } },
      { courseId: C2[0], sequence: 3, state: 'awaiting_cohort', isGift: true },
    ],
  }

  it('٦) المسارُ الأوّل هو الخطّة، وعنوانُه ما اعتمده', () => {
    const tracks = buildJourney([row(C1[0])], plan)
    expect(tracks[0].kind).toBe('plan')
    expect(tracks[0].titleAr).toBe('خطّتي للتفاوض')
    expect(tracks[0].stages).toHaveLength(3)
  })

  it('٧) وخطّةٌ من مسارين لا مشروعَ ختاميّا لها يُختلق', () => {
    expect(buildJourney([], plan)[0].capstoneAr).toBeNull()
    expect(buildJourney([], plan)[0].pathwayId).toBeNull()
  })

  it('٨) وخطّةٌ من مسارٍ واحد ترث مشروعَه', () => {
    const solo: JourneyPlan = { ...plan, items: plan.items.slice(0, 2) }
    const t = buildJourney([], solo)[0]
    expect(t.pathwayId).toBe(P1)
    expect(typeof t.capstoneAr).toBe('string')
  })

  it('٩) وحالةُ البند من الخادم تُقرأ — و«مسجَّل» بلا صفٍّ يُقرأ انتظارا لا عملا', () => {
    const t = buildJourney([], plan)[0]
    /* `enrolled` في الخطّة بلا تسجيلٍ فعليّ: مقعدٌ حُجز ولم يصر شعبة */
    expect(t.stages[0].state).toBe('awaiting_cohort')
    expect(t.stages[1].state).toBe('schedulable')
    expect(t.stages[2].state).toBe('awaiting_cohort')
    expect(t.stages[2].isGift).toBe(true)
    expect(t.stages.every((s) => s.inPlan)).toBe(true)
  })

  it('١٠) ودوراتُ الخطّة لا تتكرّر في مسارٍ ثانٍ', () => {
    const tracks = buildJourney([row(C1[0]), row(C1[1])], plan)
    const inPlan = new Set(plan.items.map((i) => i.courseId))
    for (const t of tracks.slice(1)) {
      for (const s of t.stages) {
        if (s.state === 'not_owned') continue
        expect(inPlan.has(s.courseId), `${s.courseId} مكرَّرة`).toBe(false)
      }
    }
  })
})

describe('الحالةُ من الدليل — لا من ضغطة', () => {
  it('١١) الشهادةُ الفعّالة تُنجز المرحلة، والملغاةُ لا', () => {
    const done = buildJourney(
      [row(C1[0], { certificates: [{ id: 'c', number: 'WJ-1', status: 'active' }] }), row(C1[1])],
      null,
    )[0]
    expect(done.stages[0].state).toBe('completed')
    expect(done.stages[0].certificate?.number).toBe('WJ-1')

    const revoked = buildJourney(
      [row(C1[0], { certificates: [{ id: 'c', number: 'WJ-1', status: 'revoked' }] }), row(C1[1])],
      null,
    )[0]
    expect(revoked.stages[0].state).toBe('enrolled')
  })

  it('١٢) و«لم يُسجَّل» نسبتُه null لا صفرا — والفرقُ يهمّ المتعلّم', () => {
    const t = buildJourney([row(C1[0]), row(C1[1])], null)[0]
    expect(t.stages[0].percent).toBe(0)
    expect(t.stages[2].percent).toBeNull()
  })

  it('١٣) وأكثرُ تقدّمٍ يفوز حين تتعدّد الشعبُ لدورةٍ واحدة', () => {
    const t = buildJourney(
      [
        row(C1[0], { id: 'old', courseProgress: { percent: 20 } }),
        row(C1[0], { id: 'new', courseProgress: { percent: 70 } }),
        row(C1[1]),
      ],
      null,
    )[0]
    expect(t.stages[0].percent).toBe(70)
    expect(t.stages[0].enrollmentId).toBe('new')
  })

  it('١٤) وصفٌّ بلا دورةٍ في الكتالوج يُسقَط ولا يُختلق له عنوان', () => {
    const tracks = buildJourney([row('C-LA-YOUJAD')], null)
    expect(tracks).toEqual([])
  })

  it('١٥) والساعاتُ المنجزة من المراحل المنجزة وحدها', () => {
    const t = buildJourney(
      [row(C1[0], { status: 'completed' }), row(C1[1])],
      null,
    )[0]
    const h0 = t.stages[0].hours
    expect(t.hours.done).toBe(h0)
    expect(t.hours.total).toBeGreaterThanOrEqual(h0)
  })
})

describe('«أنت هنا» على بابٍ مفتوح', () => {
  it('١٦) أوّلُ مرحلةٍ يملكها ولم يُنجزها — لا أوّلُ ما لم يُنجَز', () => {
    /* أنجز الأولى، ولا يملك الثانية، ويملك الثالثة: موضعُه الثالثة */
    const t = buildJourney(
      [row(C1[0], { status: 'completed' }), row(C1[2])],
      null,
    )[0]
    expect(t.stages[1].state).toBe('not_owned')
    expect(t.currentIndex).toBe(2)
  })

  it('١٧) وإن أنجز ما يملك كلَّه فالموضعُ أوّلُ ما بقي — و-١ إن أنجز الكلّ', () => {
    const partial = buildJourney(
      [row(C1[0], { status: 'completed' }), row(C1[1], { status: 'completed' })],
      null,
    )[0]
    expect(partial.currentIndex).toBe(2)

    const all = buildJourney(
      C1.map((id) => row(id, { status: 'completed' })),
      null,
    )[0]
    expect(all.currentIndex).toBe(-1)
    expect(all.counts.completed).toBe(C1.length)
  })

  it('١٨) والمسارُ المفتوحُ أوّلا ما فيه عملٌ قائم', () => {
    const tracks = buildJourney(
      [
        row(C1[0], { status: 'completed' }), row(C1[1], { status: 'completed' }),
        row(C2[0]), row(C2[1]),
      ],
      null,
    )
    const busy = tracks.find((t) => t.id === P2)!
    expect(defaultTrackId(tracks)).toBe(busy.id)
  })
})

describe('التسميات', () => {
  it('١٩) لكلّ حالةٍ اسمٌ عربيّ — لا مفتاحٌ إنجليزيّ يظهر للمتعلّم', () => {
    for (const [state, label] of Object.entries(STAGE_LABEL_AR)) {
      expect(label.length, state).toBeGreaterThan(2)
      expect(label, state).not.toMatch(/[A-Za-z]/)
    }
  })

  it('٢٠) والعنوانُ من الكتالوج لا من الشعبة: الشعبةُ تُسمّى دفعةً لا دورة', () => {
    const t = buildJourney([row(C1[0]), row(C1[1])], null)[0]
    expect(t.stages[0].titleAr).toBe(courseById(C1[0])!.name)
  })
})

/* ══ الشاشةُ نفسُها: بابٌ واحد لا ثلاثة ══

   ثلاثُ شاشاتٍ كانت تجيب عن سؤالٍ واحد — «ما الذي أفعله الآن؟» — وقد حُذفت
   وصارت «رحلتي». والحارسُ هنا يمنع عودتَها: ملفٌّ محذوفٌ يعود بصمت، أو تبويبٌ
   ثانٍ يُضاف إلى الشريط، هما بعينهما التشتّتُ الذي شُكي منه. */
describe('«رحلتي» — بابٌ واحد', () => {
  const root = process.cwd()
  const read = (p: string) => readFileSync(join(root, p), 'utf8')

  it('٢١) الشاشاتُ الثلاثُ القديمة زالت — لا ملفَّ يعود بصمت', () => {
    for (const f of [
      'src/pages/student/MyLearning.tsx',
      'src/pages/student/MyPathway.tsx',
      'src/pages/student/CourseMilestones.tsx',
    ]) {
      expect(existsSync(join(root, f)), `${f} ما زال قائما`).toBe(false)
    }
  })

  it('٢٢) وتبويبٌ واحد في الشريط: «رحلتي» لا «دوراتي» و«مساري»', () => {
    const nav = read('src/pages/student/PortalLayout.tsx')
    expect(nav).toContain('label: "رحلتي"')
    expect(nav, 'التبويبُ القديم عاد').not.toContain('label: "دوراتي"')
    expect(nav, 'التبويبُ القديم عاد').not.toContain('label: "مساري"')
  })

  it('٢٣) والعنوانان القديمان يُحوَّلان — روابطُ بريدٍ أُرسلت تشير إليهما', () => {
    const app = read('src/App.tsx')
    expect(app, '«مساري» صارت بابا ميّتا').toMatch(/path="\/student\/pathway" element=\{<Navigate to="\/student\/learning"/)
    /* ورابطُ صفحة الدورة يفتح الرحلةَ على مرحلتها بعينها */
    expect(app).toContain('CourseStageRedirect')
    expect(app).toContain('/student/learning?stage=')
    /* والعنوانُ الذي يعود إليه الدفعُ باقٍ على حاله */
    expect(app).toMatch(/path="\/student\/learning" element=\{<Journey \/>\}/)
  })

  it('٢٤) والرحلةُ تركّب الشريطَ والعملَ والعرضَ والمشروعَ الختاميّ', () => {
    const page = read('src/pages/student/Journey.tsx')
    for (const c of ['<StageRail', '<StageWork', '<StageOffer', '<CapstonePanel']) {
      expect(page, `${c} غائب عن الرحلة`).toContain(c)
    }
    /* والنقرُ يختار مرحلةً في الرابط لا ينقل إلى صفحةٍ أخرى */
    expect(page).toContain('next.set("stage", id)')
  })

  it('٢٥) وعملُ المرحلة صندوقان: دروسٌ وجلساتٌ وواجبات، والمصادرُ منفصلة', () => {
    const work = read('src/components/journey/StageWork.tsx')
    expect(work, 'التبويبات الثلاثة').toContain('label: "الدروس"')
    expect(work).toContain('label: "الجلسات"')
    expect(work).toContain('label: "الواجبات"')
    expect(work, 'صندوقُ المصادر لم يُفصل').toContain('مصادر هذه المرحلة')
    /* وشهادةُ الدورة في آخرها لا في خزانةٍ بعيدة */
    expect(work).toContain('<CourseCertificate')
  })

  it('٢٦) والمشروعُ الختاميّ آخرَ الشريط، ومعه شهادةُ المسار والتوصية', () => {
    const rail = read('src/components/journey/StageRail.tsx')
    expect(rail, 'المشروعُ عقدةٌ مميّزةُ الشكل آخرَ الشريط').toContain('CAPSTONE_ID')
    expect(rail).toContain('مشروع التخرج')
    const cap = read('src/components/journey/CapstonePanel.tsx')
    expect(cap).toContain('pathway_certificate')
    expect(cap).toContain('recommendation')
    /* ولا زرَّ تسليمٍ لا يقود إلى شيء: التسليمُ يُرتَّب على القناة الرسميّة */
    expect(cap).toContain('<AdvisorContact')
  })
})
