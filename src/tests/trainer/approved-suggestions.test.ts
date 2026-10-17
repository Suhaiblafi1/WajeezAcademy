/* «اعتمدها» يُبقي ما اعتمدته الإدارةُ للمدرّب — اقتراحا يقبله أو يرفضه (١٧ أكتوبر ٢٠٢٦).

   «when I press اعتمدها, the changes still appear for the trainer… They should see it as a recommendation…
   no need for a new button» (صاحب المنصّة). والخادمُ في `server/tests/plan/approved-suggestions.test.ts`؛
   وهنا وجوهُه الثلاثة:

   ① خبرُ الاعتماد يقول كم بقي له وأنّه اختياريّ.
   ② وزرُّ «اعتمدها» يقول قبل النقر ما يقع بالبطاقات — والمسوّداتِ التي لا تصله — وتُقرأ البطاقةُ بعد الاعتماد.
   ③ وصفحةُ المدرّب تقرّر فيها على خطّته المعتمدة، وتفتح عليها، ولا تطلب منه أن يرسل شيئا.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planApprovedTrainerMsg } from '@/application/trainer/plan-decision'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① خبرُ الاعتماد', () => {
  const base = { cohortTitle: 'شعبة', registrationOpen: false, qualifiedCourseAr: null, meetingsApproved: 0, meetingsFailed: 0, tasksApplied: 0 }

  it('⚠️ يقول كم بقي له في «المراجعة» وأنّه اختياريّ — مفردا وجمعا', () => {
    expect(planApprovedTrainerMsg({ ...base, suggestions: 1 }).body).toContain('وبقي لك في «المراجعة» اقتراح واحد من الإدارة، اختياري: إن قبلته دخل خطتك المعتمدة مباشرة.')
    expect(planApprovedTrainerMsg({ ...base, suggestions: 6 }).body).toContain('وبقيت لك في «المراجعة» اقتراحات من الإدارة (6)، اختيارية: ما تقبله يدخل خطتك المعتمدة مباشرة.')
  })

  it('ولا سطرَ بلا اقتراح', () => {
    expect(planApprovedTrainerMsg({ ...base, suggestions: 0 }).body).not.toContain('المراجعة')
    expect(planApprovedTrainerMsg(base).body).not.toContain('المراجعة')
  })
})

describe('② زرُّ «اعتمدها» وبطاقةُ الخطّة', () => {
  const card = code('src/components/admin/TrainerPlanReview.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ يقول قبل النقر إنّ ما اعتمدته يبقى عنده اختياريّا — وإنّ المسوّدات لا تصله', () => {
    /* ويُقال على كلّ خطّةٍ تُعتمد — المنتظِرةِ والمردودةِ إليه (١٧ أكتوبر ٢٠٢٦، `approvable`) */
    expect(card).toMatch(/\{approvable && editsPending > 0 && \(\s*<p[^>]*>\s*«اعتمدها» يبقي البطاقات التي اعتمدتها له \(\{editsPending\}\) عنده اقتراحات اختيارية/)
    expect(card).toMatch(/\{editsDrafts > 0 && <> والمسودات التي لم تعتمدها له \(\{editsDrafts\}\) لا تصله/)
    expect(card).toMatch(/onDrafts=\{setEditsDrafts\}/)
    expect(panel).toMatch(/useEffect\(\(\) => \{ onDrafts\?\.\(drafts\.length\); \}/)
  })

  it('⚠️ وتُقرأ البطاقاتُ بعد الاعتماد — بلا رفعٍ ولا مراجعة', () => {
    expect(card).toMatch(/\{trainerPlan && \(\s*<PlanEditsUploader/)
    expect(card).toMatch(/closed=\{trainerPlan\.status === "approved" \|\| trainerPlan\.status === "published"\}/)
    expect(panel).toMatch(/const canUpload = mayUpload && !closed;\s*const canReview = mayReview && !closed;/)
  })
})

describe('③ صفحةُ المدرّب', () => {
  const page = code('src/pages/trainer/CohortWorkspace.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ يقرّر فيها على خطّته المعتمدة — ويقال له أنّها اختياريّة', () => {
    expect(page).toMatch(/<PlanEditsPanel[\s\S]{0,200}approved=\{approved\}/)
    expect(panel).toMatch(/const blocked = !inHand && !approved \? "تقبل التعديلات حين تعود الخطّة إليك\."/)
    expect(panel).toMatch(/approved\s*\?\s*"خطتك معتمدة، وهذه اقتراحات اختيارية/)
  })

  it('⚠️ وتفتح عليها ما بقي فيها شيء — ولا يطلب منه إرسال', () => {
    expect(page).toMatch(/const reviewWaits = \(editable \|\| status === "approved" \|\| status === "published"\) && revItems\.some/)
    expect(page).toMatch(/revision\.pending === 0 && approved && \(\s*<Inset[^>]*>\s*<b[^>]*>قررت فيها كلها<\/b> — خطتك معتمدة، ولا شيء ترسله\./)
    expect(page).toMatch(/revision\.pending > 0 && \(inHand \|\| approved\) \?/)
  })
})
