/* آخرُ نشاط المدرّب — من فعّالٌ ومن اختفى (٢٤ أكتوبر ٢٠٢٦).

   «أعطني مؤشّرا لمتى آخرُ دخولٍ لكلّ مدرّبٍ لمنصّته» (صاحب المنصّة). والحكمُ في `last-seen.ts`، والشاشةُ
   تعرضه في كلّ بطاقةٍ وتصفّي به. والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ACTIVE_DAYS, GONE_DAYS, NOT_SIGNED_AR, activityOf, lastSeenAr, tracksActivity } from '@/application/trainer/last-seen'

const now = new Date('2026-10-24T12:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)

describe('الحكم', () => {
  it('⚠️ نشط حتى أسبوع، وقل نشاطه حتى شهر، واختفى بعده — ومن لم يدخل قط اختفى', () => {
    expect(activityOf(ago(0), now)).toBe('active')
    expect(activityOf(ago(ACTIVE_DAYS), now)).toBe('active')
    expect(activityOf(ago(ACTIVE_DAYS + 1), now)).toBe('quiet')
    expect(activityOf(ago(GONE_DAYS), now)).toBe('quiet')
    expect(activityOf(ago(GONE_DAYS + 1), now)).toBe('gone')
    expect(activityOf(null, now)).toBe('gone')
  })

  it('والنص بعد العربية لا «يوم(ا)»', () => {
    expect(lastSeenAr(ago(0), now)).toBe('آخر نشاط: اليوم')
    expect(lastSeenAr(ago(1), now)).toBe('آخر نشاط: أمس')
    expect(lastSeenAr(ago(2), now)).toBe('آخر نشاط: قبل يومين')
    expect(lastSeenAr(ago(5), now)).toBe('آخر نشاط: قبل 5 أيام')
    expect(lastSeenAr(ago(40), now)).toBe('آخر نشاط: قبل 40 يوما')
    expect(lastSeenAr(null, now)).toBe('لم يدخل منصته قط')
  })
})

describe('الشاشة', () => {
  const page = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  it('⚠️ في كل بطاقة — ومنه فلتر بعدده', () => {
    expect(page).toMatch(/\? <Chip tone=\{SEEN_TONE\[seen\]\} srPrefixAr="نشاطه">\{lastSeenAr\(t\.lastSeenAt, new Date\(\)\)\}<\/Chip>/)
    expect(page).toMatch(/&& \(activity === "any" \|\| r\.seen === activity\)/)
    expect(page).toMatch(/ACTIVITY_LABELS\.map\(\(a\) => \(\{ id: a\.id, label: `\$\{a\.ar\} \(\$\{activityCounts\[a\.id\]\}\)` \}\)\)/)
  })
})

describe('وسبب الإلغاء يحرر قبل أن يرسل — «هل أستطيع تحرير السبب؟»', () => {
  const box = readFileSync(join(process.cwd(), 'src/components/admin/CancelCohortBox.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  it('⚠️ الصندوق ظاهر لكل خيار، وما فيه هو ما يرسل', () => {
    expect(box).toMatch(/const reasonAr = text\.trim\(\);/)
    expect(box).toMatch(/<textarea value=\{text\} onChange=\{\(e\) => setText\(e\.target\.value\)\}/)
    expect(box, 'عاد الصندوق لـ«سبب آخر» وحده').not.toMatch(/reason === "other" && \(\s*<(input|textarea)/)
    expect(box).toContain('{ to: "cancelled", note: "إلغاء من لوحة الإدارة", reasonAr }')
  })
})

/* ═══ ولا مؤشر لمن لم يوقع عقده — «فهو لم يدخل أصلا للمنصة» (صاحب المنصّة، ٢٤ أكتوبر ٢٠٢٦) ═══ */
describe('من يقاس نشاطه', () => {
  const base = { hasAccount: true, applicationStatus: 'contract_pending' }
  it('⚠️ من وقع — لا من أرسل له عقد ولم يوقعه', () => {
    for (const status of ['signed', 'signature_approved', 'countersigned', 'terminated']) {
      expect(tracksActivity({ ...base, contract: { status } }), status).toBe(true)
    }
    for (const status of ['draft', 'sent', 'amendment_requested', 'declined', 'revoked', 'expired']) {
      expect(tracksActivity({ ...base, contract: { status } }), status).toBe(false)
    }
  })
  it('⚠️ والنشط دائما ولو أعيد له عقد — ومن عين مباشرة بحساب بلا عقد', () => {
    expect(tracksActivity({ hasAccount: true, applicationStatus: 'active', contract: { status: 'sent' } })).toBe(true)
    expect(tracksActivity({ hasAccount: true, applicationStatus: 'onboarding', contract: null })).toBe(true)
    expect(tracksActivity({ hasAccount: false, applicationStatus: 'conditionally_approved', contract: null })).toBe(false)
  })
  it('⚠️ والشاشة تقول حاله بدل المؤشر ولا تعده في الفلتر', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerRunOps.tsx'), 'utf8')
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(page).toMatch(/seen: tracksActivity\(t\) \? activityOf\(t\.lastSeenAt, new Date\(\)\) : null/)
    expect(page).toMatch(/for \(const r of rows\) if \(r\.seen\) m\[r\.seen\] \+= 1;/)
    expect(page).toContain('{NOT_SIGNED_AR}')
    expect(NOT_SIGNED_AR).toBe('لم يوقع العقد بعد')
  })
})
