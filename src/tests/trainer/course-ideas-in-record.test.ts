/* اقتراحُ المدرّب يُقرَّر في ملفّه — قرارُ صاحب المنصّة «A» (٢٦ أكتوبر ٢٠٢٦).

   سُئل: أين تُقرَّر دوراتٌ يقترحها المدرّب؟ فقال «A»: في ملفّه بجانب أجره ودوراته — نسخةٌ من رمزٍ قائم، أو دورةٌ
   جديدة، أو اسأله، أو ليس الآن. و«دوراتٌ مقترحة» قائمةٌ عبرَ المدرّبين وكرّاسةُ Claude، وكلُّ سطرٍ يفتح ملفَّ صاحبه.

   ① في الملفّ الأبوابُ الأربعة — كلٌّ بمساره في الخادم، و«دورة جديدة» لمن يُنشئ في الكتالوج وحدَه.
   ② ومعها ما يُقرَّر به: أجوبةُ الفورم، والسؤالُ وجوابُه، وأقربُ الرموز — من الطابور نفسِه لمدرّبٍ واحد.
   ③ والقائمةُ لا تقرّر: لا بابَ قرارٍ فيها، وكلُّ سطرٍ يفتح ملفَّ صاحبه على الاقتراح نفسِه — لمن يملك فتحَه.
   ④ و«دورة جديدة» تعود: الكتالوجُ يربط ثمّ يرجع إلى الاقتراح في الملفّ — ولا يرجع إلى خارج الإدارة.
   ⑤ والملفُّ يُفتح على الاقتراح المطلوب — ولو كان مطويّا فيما بُتّ فيه.

   والخادمُ يحرسه `server/tests/trainer/course-proposals.test.ts` («ومدرّبٌ واحد — لملفّه»). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ideaRecordHref, newCourseHref, safeAdminBack } from '@/application/trainer/idea-links'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PREP = code('src/pages/admin/PreparationSteps.tsx')
const LIST = code('src/pages/admin/CourseProposals.tsx')
const CATALOG = code('src/pages/admin/CatalogAdmin.tsx')
const ROUTES = code('server/http/routes/admin-trainer.routes.ts')
const STEP = /function CoursesStep\(\{[\s\S]*?\n\}\n/.exec(PREP)?.[0] ?? ''

describe('① في الملفّ الأبواب الأربعة', () => {
  it('⚠️ نسخة من رمز قائم · دورة جديدة · اسأله · ليس الآن — كلّ بمساره', () => {
    expect(STEP, 'CoursesStep مفقودة').toContain('const renderProposal')
    expect(STEP).toContain('apiPost(`/api/admin/course-proposals/${p.id}/link`, { courseId: linkCourse })')
    expect(STEP).toMatch(/<Button as=\{Link\} to=\{newCourseHref\(p, here\)\}[^>]*>\s*دورة جديدة\s*<\/Button>/)
    expect(STEP).toContain('apiPost(`/api/admin/course-proposals/${p.id}/ask`, { questionAr: askText.trim() })')
    expect(STEP).toContain('apiPost(`/api/admin/course-proposals/${p.id}/reject`, { noteAr: rejectNote.trim() })')
    expect(STEP).toMatch(/onClick=\{\(\) => \{ close\(\); setAskFor\(p\.id\); \}\}\s*>\s*اسأل المدرب\s*</)
    expect(STEP).toMatch(/onClick=\{\(\) => \{ close\(\); setRejectFor\(p\.id\); \}\}\s*>\s*ليس الآن\s*</)
  })

  it('⚠️ و«دورة جديدة» لمن ينشئ في الكتالوج وحده — ولا تعرض على المربوط', () => {
    expect(STEP).toMatch(/\{p\.status !== "linked" && canCreateCourse && \(\s*<Button as=\{Link\} to=\{newCourseHref/)
    expect(PREP).toContain('canCreateCourse={can("catalog.course.create")}')
  })

  it('⚠️ والسؤال على ما لم يبتّ فيه وحده — والخادم يردّه على غيره', () => {
    expect(STEP).toMatch(/\{p\.status !== "linked" && \(\s*<Button[^>]*icon=\{MessageCircleQuestion\}/)
    expect(STEP).toMatch(/\{canClassify && p\.status !== "became_course" && p\.status !== "rejected" && \(/)
  })
})

describe('② وما يقرَّر به معه', () => {
  it('⚠️ من الطابور نفسه لمدرّب واحد — لا حساب ثان في المتصفّح', () => {
    expect(STEP).toContain('apiGet<IdeaFacts[]>(`/api/admin/course-proposals?scope=all&profileId=${profileId}`)')
    expect(ROUTES).toMatch(/profileId: z\.string\(\)\.uuid\(\)\.optional\(\)/)
    expect(ROUTES).toContain("return proposals.queue(scope ?? 'open', profileId)")
  })

  it('⚠️ أجوبة الفورم · السؤال وجوابه · أقرب الرموز بسببها', () => {
    expect(STEP).toContain('const details = proposalDetailRows(idea?.details ?? null);')
    expect(STEP).toMatch(/\{details\.map\(\(d\) => \(/)
    expect(STEP).toMatch(/\{idea\?\.questionAr && \(\s*<Inset/)
    expect(STEP).toMatch(/\{idea\.answerAr\s*\?/)
    const sugg = /\{linkFor === p\.id && idea && idea\.suggestedCourses\.length > 0 && \([\s\S]*?\n {8}\)\}/.exec(STEP)?.[0] ?? ''
    expect(sugg, 'لا ترشيح في الربط').toContain('{idea.suggestedCourses.map((sug) => (')
    expect(sugg).toContain('onClick={() => setLinkCourse(sug.courseId)}')
    expect(sugg).toContain('{sug.sharedAr.join("، ")}')
  })
})

describe('③ والقائمة لا تقرّر', () => {
  it('⚠️ لا باب قرار فيها ولا مختار رمز', () => {
    for (const door of ['link', 'became-course', 'unlink', 'ask', 'reject']) {
      expect(LIST, `بقي باب ${door} في القائمة`).not.toContain(`/${door}\``)
    }
    expect(LIST, 'بقي فيها ما يكتب').not.toMatch(/\bapi(Post|Patch|Put|Delete)\b/)
    expect(LIST, 'بقي فيها مختار الرمز').not.toContain('CoursePicker')
    expect(LIST, 'بقيت فيها «دورة جديدة»').not.toContain('/admin/catalog?proposalId=')
  })

  it('⚠️ وكلّ سطر يفتح ملفّ صاحبه على الاقتراح نفسه — لمن يملك فتحه', () => {
    expect(LIST).toMatch(/\{canOpenRecord \? \(\s*<Button\s+as=\{Link\} to=\{ideaRecordHref\(r\.applicationId, r\.id\)\}/)
    expect(LIST).toContain('const canOpenRecord = user?.permissions.includes("trainer.applications.view") ?? false;')
    expect(ideaRecordHref('app-1', 'idea-1')).toBe('/admin/trainers/app-1?tab=agreement&idea=idea-1')
  })

  it('وتبقى فيها القائمة عبر المدرّبين وتقرير التجميع والكرّاسة', () => {
    expect(LIST).toContain('<ClusterPanel key={showDecided ? "all" : "open"} scope={showDecided ? "all" : "open"} />')
    expect(LIST).toContain('<CourseDecisionsUpload onApplied={load} />')
  })
})

describe('④ و«دورة جديدة» تعود إلى الاقتراح', () => {
  it('⚠️ نموذج الكتالوج بعنوانه — والعودة إلى الاقتراح نفسه في ملفّه', () => {
    const href = newCourseHref(
      { id: 'idea-1', titleAr: 'تحليل البيانات & التقارير' },
      { pathname: '/admin/trainers/app-1', search: '?tab=agreement&stop=contract' },
    )
    const u = new URL(href, 'https://x.test')
    expect(u.pathname).toBe('/admin/catalog')
    expect(u.hash).toBe('#course')
    expect(u.searchParams.get('proposalId')).toBe('idea-1')
    expect(u.searchParams.get('titleAr')).toBe('تحليل البيانات & التقارير')
    const raw = u.searchParams.get('back')
    const back = new URL(raw ?? '', 'https://x.test')
    expect(back.pathname).toBe('/admin/trainers/app-1')
    expect(back.searchParams.get('tab')).toBe('agreement')
    expect(back.searchParams.get('idea')).toBe('idea-1')
    expect(back.searchParams.get('stop'), 'ضاع ما كان في العنوان').toBe('contract')
    expect(safeAdminBack(raw), 'العودة لا تمرّ بحارسها').toBe(raw)
  })

  it('⚠️ والكتالوج يربط ثمّ يرجع — ويقول من أين جاء', () => {
    expect(CATALOG).toContain('const backTo = safeAdminBack(params.get("back"));')
    const done = /if \(fromProposal && courseId\) \{[\s\S]*?\n {14}\}/.exec(CATALOG)?.[0] ?? ''
    expect(done, 'لا ربط عند التمام').toContain('/became-course`, { courseId })')
    expect(done, 'لا يرجع بعد الربط').toMatch(/\.finally\(\(\) => \{\s*if \(backTo\) \{ navigate\(backTo\); return; \}/)
    expect(CATALOG).toMatch(/\{backTo && \(\s*<Button as=\{Link\} to=\{backTo\}[^>]*>ارجع دون إنشاء<\/Button>/)
  })

  it('⚠️ ولا يرجع إلى خارج الإدارة', () => {
    for (const bad of [
      'https://evil.test/admin/x', '//evil.test/admin/x', '/\\evil.test/admin', '/admin/\\evil.test',
      '/admin/x y', '/learner/home', '', null, undefined,
    ]) {
      expect(safeAdminBack(bad), String(bad)).toBeNull()
    }
    expect(safeAdminBack('/admin/trainers/a?tab=agreement&idea=b')).toBe('/admin/trainers/a?tab=agreement&idea=b')
  })
})

describe('⑤ والملفّ يفتح على الاقتراح المطلوب', () => {
  it('⚠️ يبلغه ويركّز عليه — ولو كان مطويا فيما بتّ فيه', () => {
    expect(STEP).toContain('const focusIdea = params.get(IDEA_PARAM);')
    expect(STEP).toMatch(/if \(focusIdea\) revealRow\(`idea-\$\{focusIdea\}`\);/)
    expect(STEP).toMatch(/<li key=\{p\.id\} id=\{`idea-\$\{p\.id\}`\} tabIndex=\{-1\}/)
    expect(STEP).toMatch(/useState\(\s*\(\) => !!focusIdea && foldProposals\(proposals\)\.decided\.some\(\(p\) => p\.id === focusIdea\),?\s*\)/)
  })
})
