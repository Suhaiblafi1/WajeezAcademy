/* آخرُ نشاط المدرّب — من فعّالٌ ومن اختفى (٢٤ أكتوبر ٢٠٢٦).

   «أعطني مؤشّرا لمتى آخرُ دخولٍ لكلّ مدرّبٍ لمنصّته» (صاحب المنصّة). والحكمُ في `last-seen.ts`، والشاشةُ
   تعرضه في كلّ بطاقةٍ وتصفّي به. والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ACTIVE_DAYS, GONE_DAYS, activityOf, lastSeenAr } from '@/application/trainer/last-seen'

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
    expect(page).toMatch(/<Chip tone=\{SEEN_TONE\[seen\]\} srPrefixAr="نشاطه">\{lastSeenAr\(t\.lastSeenAt, new Date\(\)\)\}<\/Chip>/)
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
