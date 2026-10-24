/* ملفُّ المدرّب — صفحةٌ لكلّ مدرّبٍ عنوانُها `/admin/trainers/:id` (٢٤ أكتوبر ٢٠٢٦).

   المرحلةُ الثالثةُ من مقترح لوحة الإدارة (3b): «أين هو، وما التالي، وكلُّ شيءٍ عنه». وكان ملفُّ الطلب `?app=` على
   عنوان الطابور، لا تفتحه بطاقةُ «المدربون» ولا الجرسُ ولا البحث — يُبحث عنه بالاسم في كلّ مرّة.

   ① **عنوانُه** — مسارٌ في `App.tsx`، وتفتحه بطاقتُه في «المدربون» والجرسُ ونتيجةُ البحث.
   ② **ورأسُه** — خطُّه بتواريخه وخطوتُه التالية من حقائق صفّه نفسِها (`a.joining`)، وزرُّها بأفعال الطابور نفسِها.
   ③ **وألسنتُه** — «الطلب والمقابلة · الاتفاقية · الدورات · السجل» في العنوان، و«السجل» سجلُّ الحالة وأثرُ الطلب. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allDestinationPaths, notificationCtaAr, notificationHref } from '@/application/notifications/destinations'

const root = process.cwd()
/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const SCREEN = code('src/pages/admin/TrainerApplications.tsx')

describe('① عنوانه', () => {
  it('⚠️ مسار في App.tsx — والصفحة نفسها التي فيها الطابور', () => {
    expect(code('src/App.tsx')).toContain('<Route path="/admin/trainers/:id" element={<AdminTrainerApps />} />')
  })

  it('⚠️ وتفتحه بطاقته في «المدربون» — لمن يملك قراءة الطلبات', () => {
    const ops = code('src/pages/admin/TrainerRunOps.tsx')
    expect(ops, 'البطاقة لا تفتح ملف صاحبها').toMatch(/\{canOpenRecord && \(\s*<Link to=\{`\/admin\/trainers\/\$\{t\.applicationId\}`\}/)
    expect(ops, 'الباب بغير صلاحية قراءة الطلبات — فيرده الخادم')
      .toContain('const canDownloadFiles = sessionUser?.permissions.includes("trainer.applications.view") ?? false;')
    expect(ops).toContain('const canOpenRecord = canDownloadFiles;')
  })

  it('⚠️ والجرس يفتح ملف صاحب الطلب — وبلا معرّف يفتح الطابور', () => {
    const id = '7d1f0a52-4b3e-4c1a-9c55-0b6c8b7f2e11'
    for (const key of ['admin.trainer_application', 'admin.trainer_deferral']) {
      expect(notificationHref(key, 'staff', { applicationId: id }), key).toBe(`/admin/trainers/${id}`)
      expect(notificationCtaAr(key, 'staff', { applicationId: id }), key).toBe('افتح ملفه')
      expect(notificationHref(key, 'staff', {}), key).toBe('/admin/trainers')
    }
    expect(allDestinationPaths()).toContain('/admin/trainers/:id')
  })

  it('⚠️ وطلب التأهيل يفتح «المدربون» حيث يبت فيه — لا «الطلبات»', () => {
    expect(notificationHref('trainer.qualify.request', 'staff', {})).toBe('/admin/trainer-run')
  })

  it('⚠️ ونتيجة البحث تفتح ملفه بحالته بالعربية', () => {
    const search = code('server/http/routes/search.routes.ts')
    expect(search).toContain('to: `/admin/trainers/${a.id}`')
    expect(search, 'الحالة بمفتاحها').toContain('plainAr(STATUS_LABELS[a.status] ?? a.status)')
  })
})

describe('② رأسه', () => {
  it('⚠️ الحقائق حقائق صفه — من الخادم لا حكم ثان في الشاشة', () => {
    expect(SCREEN).toMatch(/const facts: JoiningFacts = \{\s*status: a\.status, deferredFollowUpAt: a\.deferredFollowUpAt,\s*deferredInterestAskedAt: a\.deferredInterestAskedAt, \.\.\.a\.joining,\s*\};/)
  })

  it('⚠️ وخطه بتواريخه: يبدأ من إتمام طلبه، ويقرأ سجل حالاته', () => {
    expect(SCREEN).toContain('<RecordLine line={joiningLineOf({ ...facts, submittedAt: a.phase2CompletedAt ?? a.createdAt, history: a.statusHistory })} />')
  })

  it('⚠️ وخطوته التالية من الدالة نفسها التي يقرؤها صفه', () => {
    expect(SCREEN).toContain('const next = joiningNextOf(facts);')
    expect(SCREEN).toContain('{!(stopNow === "closed" && next?.turn === "none") && recordNext(next)}')
  })

  it('⚠️ وزرها بأفعال الطابور نفسها — لا نسخة ترسل بنفسها', () => {
    const box = /const recordNext = [\s\S]*?\n {4}\};/.exec(SCREEN)?.[0] ?? ''
    expect(box, 'صندوق الخطوة مفقود').toBeTruthy()
    expect(box).toContain('remindBooking(a.id)')
    expect(box).toContain('remindDraft(a.id)')
    expect(box).toContain('navigate(contractsHref(a,')
    expect(box, 'الصندوق يرسل بنفسه — فيفترق عن بند القائمة').not.toContain('apiPost')
    /* والتذكيران في قائمة الصفّ هما الدالّتان أنفسُهما */
    expect(SCREEN).toContain('run: () => void remindBooking(a.id),')
    expect(SCREEN).toContain('run: () => void remindDraft(a.id),')
  })

  it('واسمه عنوان الصفحة، ودربه يعيد إلى الطابور وإلى محطته', () => {
    expect(SCREEN).toContain('<AdminLayout title={a.fullName}>')
    expect(SCREEN).toContain('onClick={() => navigate(`/admin/trainers?stop=${stopNow}`)}')
  })
})

describe('③ ألسنته', () => {
  it('⚠️ أربعة بأسماء المقترح وترتيبه — وفي العنوان', () => {
    expect(SCREEN).toContain('const DETAIL_TABS: DetailTab[] = ["dossier", "agreement", "courses", "log"];')
    expect(SCREEN).toContain('const [tab, setTab] = useTabParam<DetailTab>(DETAIL_TABS, "dossier");')
    const bar = /<TabBar\s+ariaLabel="أقسام الملفّ"[\s\S]*?\/>/.exec(SCREEN)?.[0] ?? ''
    expect([...bar.matchAll(/label: "([^"]+)"/g)].map((m) => m[1])).toEqual(['الطلب والمقابلة', 'الاتفاقية', 'الدورات', 'السجل'])
  })

  it('⚠️ و«السجل» سجل الحالة وأثر الطلب — وسجل الحالة ليس في «الطلب والمقابلة» ثانية', () => {
    const log = /tab === "log" \? \([\s\S]*?\) : \(/.exec(SCREEN)?.[0] ?? ''
    expect(log, 'لسان السجل مفقود').toContain('id="sec-history"')
    expect(log).toContain('<EntityAuditTimeline entityType="trainer_application" entityId={a.id}')
    expect(SCREEN.match(/id="sec-history"/g), 'سجل الحالة في موضعين').toHaveLength(1)
  })
})
