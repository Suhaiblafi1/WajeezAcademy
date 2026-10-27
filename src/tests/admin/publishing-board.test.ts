/* لوحةُ النشر صغرت (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة — ج).

   ① نتيجةُ «انشر الآن» وسطرُ كلّ إصدارٍ يُقرآن بكلمات (`publishing-text.ts`).
   ② ذهب ما يكرّره النشرُ نفسُه: الخطواتُ الأربع، و«التحقق البنيوي» و«تحليل الأثر» و«نشر إصدار» بوسمٍ يُكتب باليد،
      و«اختبار الارتداد» (تفصيلُه في «جودة التشخيص»). وبقي «انشر الآن» والإصداراتُ والرجوع.
   ③ والأزرارُ لمن يملك فعلَها، والرجوعُ يُقال قبله إنّه يبقى حتى النشر التالي.
   ④ ونصوصُها بلا تشكيل.

   وما يفعله «انشر الآن» في الخادم في `server/tests/publishing/publish-now.test.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishNowAr, versionLineAr } from '@/application/catalog/publishing-text'
import { fmtDateTime } from '@/application/text/format-ar'
import { markedTexts } from '../helpers/marked-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق نصٌّ في شرح */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/admin/PublishingBoard.tsx')

describe('① يقرأ بكلمات', () => {
  it('⚠️ نتيجة «انشر الآن»: ما نشر وما تغير — أو لا جديد', () => {
    expect(publishNowAr({ published: true, label: 'auto-abc1234-9f8e7d', changedCount: 2, totalPersonas: 12 }))
      .toBe('نشر «\u2068auto-abc1234-9f8e7d\u2069». تغيرت توصية 2 من 12 شخصية.')
    expect(publishNowAr({ published: false })).toBe('لا جديد لينشر: ما في الجداول هو المنشور الآن.')
  })

  it('وسطر الإصدار: متى نشر، أو إلى أي إصدار رجع، أو نشر لم يكتمل', () => {
    const at = '2026-10-27T08:00:00Z'
    expect(versionLineAr({ status: 'published', createdAt: at, publishedAt: at, snapshots: [{}], events: [{ action: 'publish', createdAt: at }] }))
      .toBe(`نشر ${fmtDateTime(new Date(at))}`)
    expect(versionLineAr({
      status: 'published', createdAt: at, publishedAt: at, snapshots: [{}],
      events: [{ action: 'rollback', createdAt: at, details: { restoredFrom: 'auto-1111111-aaaaaa' } }],
    })).toBe(`رجوع إلى «\u2068auto-1111111-aaaaaa\u2069» · ${fmtDateTime(new Date(at))}`)
    expect(versionLineAr({ status: 'draft', createdAt: at, publishedAt: null, snapshots: [], events: [] }))
      .toBe(`بدأ ${fmtDateTime(new Date(at))} ولم يكتمل`)
  })
})

describe('② ذهب ما يكرره النشر نفسه', () => {
  it('⚠️ لا خطوات ولا تحقق ولا تحليل ولا وسم يكتب باليد ولا اختبار ارتداد', () => {
    expect(PAGE).not.toContain('FlowSteps')
    expect(PAGE).not.toContain('/api/admin/publishing/validate')
    expect(PAGE).not.toContain('/api/admin/publishing/impact')
    expect(PAGE, 'بقي «أنشئ وانشر» بوسم يكتب باليد').not.toMatch(/apiPost<[^>]*>\("\/api\/admin\/publishing\/versions"/)
    expect(PAGE).not.toMatch(/\/versions\/\$\{[^}]+\}\/publish/)
    expect(PAGE).not.toContain('2026.08.16')
    expect(PAGE).not.toContain('/api/admin/quality/')
  })

  it('⚠️ و«انشر الآن» زر واحد يقول نتيجته', () => {
    expect(PAGE).toMatch(/setPublished\(publishNowAr\(await apiPost<PublishNowResult>\("\/api\/admin\/publishing\/publish-now"\)\)\)/)
    expect(PAGE).toMatch(/\{published && <p role="status"/)
    expect(PAGE).toContain('<AdminLayout title="النشر والإصدارات">')
  })
})

describe('③ لمن يملك فعله — والرجوع يقال قبله', () => {
  it('⚠️ «انشر الآن» وحذف المسودة لحبة النشر، والرجوع لحبته', () => {
    expect(PAGE).toContain('const canPublish = me?.permissions.includes("catalog.pathway.publish") ?? false;')
    expect(PAGE).toContain('const canRollback = me?.permissions.includes("catalog.rollback") ?? false;')
    expect(PAGE).toMatch(/\{canPublish && \(\s*<div[^>]*>\s*<Button tone="confirm"[^>]*onClick=\{\(\) => void publishNow\(\)\}>/)
    expect(PAGE).toMatch(/\{canRollback && v\.status !== "published" && v\.snapshots\.length > 0 && \(/)
    expect(PAGE).toMatch(/\{canPublish && v\.status === "draft" && v\.snapshots\.length === 0 && \(/)
  })

  it('⚠️ والرجوع لا يقع بنقرة: نافذة تقول أثره ومدته أولا', () => {
    const rollbackPosts = PAGE.match(/apiPost\("\/api\/admin\/publishing\/rollback"/g) ?? []
    expect(rollbackPosts).toHaveLength(1)
    const confirm = /\{pendingRollback && \(\s*<ConfirmAction[\s\S]*?<\/ConfirmAction>/.exec(PAGE)?.[0] ?? ''
    expect(confirm, 'الرجوع يقع خارج نافذته').toContain('apiPost("/api/admin/publishing/rollback"')
    expect(confirm).toContain('ويبقى حتى النشر التالي')
    expect(PAGE).toMatch(/onClick=\{\(\) => setPendingRollback\(\{ id: v\.id, label: v\.label \}\)\}/)
  })
})

describe('④ بلا تشكيل', () => {
  for (const f of ['src/application/catalog/publishing-text.ts', 'src/pages/admin/PublishingBoard.tsx']) {
    it(f, () => expect(markedTexts(f, read(f))).toEqual([]))
  }
})
