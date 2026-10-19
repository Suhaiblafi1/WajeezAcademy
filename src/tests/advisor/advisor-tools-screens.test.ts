/* أدواتُ الإدارة حول الطلبة والمستشارين — ما تقوله الشاشات (١٩ أكتوبر ٢٠٢٦).

   الحسابُ في `server/tests/advisors/advisor-tools.test.ts`. وهنا: سطرُ التشخيص في بطاقة الحالة
   يقول اسمَ المسار وثقةً مئويّةً صحيحة، ومن لم يسجّل يُقال عنه ذلك في قائمة الطلبة، وأداتا تغيير
   المستشار في شاشتهما وتناديان بابَيهما — والتوزيعُ بتأكيدٍ يقول ما سيقع. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { snapshotSummary } from '@/application/advisor/snapshot-summary'
import { pathwayById } from '@/data/pathways'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const CASES = code('src/pages/advisor/Cases.tsx')
const PANEL = code('src/components/LearnersPanel.tsx')
const QUEUE = code('src/pages/admin/Exceptions.tsx')
const TOOLS = code('src/components/admin/AdvisorCaseTools.tsx')
const ROUTES = code('server/http/routes/advisor.routes.ts')

describe('سطرُ التشخيص في بطاقة الحالة', () => {
  it('⚠️ اسمُ المسار لا رمزُه — من اللقطة إن حملته', () => {
    expect(snapshotSummary({ top: { id: 'PW-X', name: 'مسار القيادة' }, confidence: 82 }))
      .toBe('أبرز مسار: مسار القيادة · ثقة 82٪')
  })

  it('⚠️ ومن الكتالوج بمعرّفه في اللقطة القديمة — والثقةُ بين صفرٍ وواحدٍ تُقرأ مئويّة', () => {
    const name = pathwayById('PW-FND-003')?.name
    expect(name, 'المسارُ المرجعيّ غاب عن الكتالوج').toBeTruthy()
    expect(snapshotSummary({ pathwayId: 'PW-FND-003', confidence: 0.82 })).toBe(`أبرز مسار: ${name} · ثقة 82٪`)
  })

  it('⚠️ والثقةُ المئويّةُ لا تُضرب في مئة ثانية', () => {
    expect(snapshotSummary({ top: { id: 'PW-X', name: 'م' }, confidence: 82 })).not.toMatch(/8200/)
  })

  it('ومعرّفٌ لا يعرفه الكتالوج يُعرض كما هو — ولا لقطةَ تُقال', () => {
    expect(snapshotSummary({ top: { id: 'PW-GONE' } })).toBe('أبرز مسار: PW-GONE')
    expect(snapshotSummary(null)).toBe('لا لقطة تشخيص')
  })

  it('والبطاقةُ تقرأ الدالّةَ المشتركة لا نسخةً محلّيّة', () => {
    expect(CASES).toMatch(/import \{ snapshotSummary \} from "@\/application\/advisor\/snapshot-summary"/)
    expect(CASES).not.toMatch(/function snapshotSummary\(/)
  })
})

describe('من أنشأ حسابَه ولم يسجّل', () => {
  it('⚠️ يُقال عنه ذلك في قائمة الطلبة — لا صفٌّ فارغ', () => {
    expect(PANEL).toMatch(/\{l\.enrollments\.length === 0 && \(\s*<p[^>]*>\s*لم يسجل في شعبة بعد/)
  })
})

describe('أداتا تغيير المستشار', () => {
  it('⚠️ في شاشة «حالات بلا مستشار» — وتناديان بابَيهما', () => {
    expect(QUEUE).toMatch(/<AdvisorCaseTools advisors=\{advisors\} onChanged=/)
    expect(TOOLS).toMatch(/apiGet<FoundCase\[\]>\(`\/api\/admin\/advisor-cases\/search\?q=/)
    expect(TOOLS).toMatch(/apiPost<\{ moved: number; stayed: number \}>\("\/api\/admin\/advisor-cases\/redistribute"/)
    for (const r of ['search', 'advisor-loads', 'redistribute']) {
      expect(ROUTES, `لا باب «${r}» في الخادم`).toMatch(new RegExp(`app\\.(get|post)\\('/api/admin/advisor-cases/${r}'`))
    }
  })

  it('⚠️ والتوزيعُ بتأكيدٍ يقول ما سيقع — لا بضغطةٍ واحدة', () => {
    expect(TOOLS).toMatch(/onClick=\{\(\) => setConfirming\(true\)\}/)
    expect(TOOLS).toMatch(/<ConfirmAction[\s\S]*?onConfirm=\{\(\) => void redistribute\(\)\}/)
  })

  it('ونصوصُها بلا تشكيلٍ إعرابيّ', () => {
    for (const t of [
      'غيّر مستشار أي حالة', 'ابحث باسم العميل أو بريده أو رقمه.', 'انقل حالات مستشار',
      'لمستشار غادر أو عنده حالات كثيرة: تنتقل حالاته المفتوحة إلى أقل المستشارين الآخرين حالات.',
    ]) {
      expect(TOOLS).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})
