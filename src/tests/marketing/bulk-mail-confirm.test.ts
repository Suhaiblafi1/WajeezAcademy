/* تأكيدُ إرسال الحملة — العددُ بعينه، ومن لا تصله ولماذا، وكم يأخذ، وكتابةُ العدد فوق ألف (٢٢ نوفمبر ٢٠٢٦).
   والعلّةُ في رأس `src/application/marketing/bulk-mail.ts`.

   والفحصُ على أمرين: أنّ النصَّ يقول الأرقامَ كما هي، وأنّ الشاشةَ تقرؤه هو — وزرُّ الإرسال يحمل العددَ نفسَه الذي رآه
   المرسل (`confirmCount: check.recipients`)، فلا يُرسَل عددٌ غيرُ المعروض. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BULK_TYPE_COUNT_OVER, DEFAULT_STAGE_CAPS, campaignDeleteNoteAr, STAGED_DEFAULT_OVER, confirmLinesAr, etaAr, etaMinutes, firstNameOf, greetingAr,
  needsTypedCount, parseAudience, stageLinesAr, stagePlan, stagedByDefault, typedCountMatches,
} from '@/application/marketing/bulk-mail'
import { allSections } from '@/pages/admin/nav-map'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const page = readFileSync(join(root, 'src/pages/admin/BulkMail.tsx'), 'utf8')

describe('نص التأكيد يقول الأرقام كما هي', () => {
  it('⚠️ من تصله، ومن لا تصله بأسبابه، وكم يأخذ', () => {
    const lines = confirmLinesAr({ recipients: 19_820, audienceAr: 'أعضاء التطبيق', optedOut: 120, invalid: 45, duplicate: 15 })
    expect(lines).toEqual([
      'تصل 19820 شخصا في «أعضاء التطبيق»',
      'ولا تصل 180: 120 ألغوا الاشتراك · 45 بريد غير صالح · 15 مكرر',
      'يأخذ الإرسال نحو 42 دقيقة',
    ])
  })

  it('⚠️ وبلا ما يسقط لا يقال سطر السقوط', () => {
    expect(confirmLinesAr({ recipients: 2, audienceAr: 'تجربة', optedOut: 0, invalid: 0, duplicate: 0 }))
      .toEqual(['تصل 2 شخصان في «تجربة»', 'يأخذ الإرسال أقل من دقيقة'])
  })

  it('⚠️ والوقت بثمان في الثانية: عشرون ألفا نحو 42 دقيقة، وخمسون ألفا ساعة و45 دقيقة', () => {
    expect(etaMinutes(20_000)).toBe(42)
    expect(etaAr(20_000)).toBe('نحو 42 دقيقة')
    expect(etaAr(50_000)).toBe('نحو ساعة و45 دقيقة')
    expect(etaAr(400)).toBe('أقل من دقيقة')
  })

  it('⚠️ وفوق ألف يكتب العدد — بأرقام عربية أو هندية وبفواصل', () => {
    expect(needsTypedCount(BULK_TYPE_COUNT_OVER)).toBe(false)
    expect(needsTypedCount(BULK_TYPE_COUNT_OVER + 1)).toBe(true)
    expect(typedCountMatches('19820', 19_820)).toBe(true)
    expect(typedCountMatches('١٩٬٨٢٠', 19_820)).toBe(true)
    expect(typedCountMatches('19,820', 19_820)).toBe(true)
    expect(typedCountMatches('19821', 19_820)).toBe(false)
    expect(typedCountMatches('', 19_820)).toBe(false)
    expect(typedCountMatches('19820 شخصا', 19_820)).toBe(false)
  })
})

describe('التحية بالاسم الأول', () => {
  it('⚠️ الاسم الأول، والمركب كلمتان، ومن لا اسم له «مرحبا،»', () => {
    expect(greetingAr('سارة أحمد')).toBe('مرحبا سارة،')
    expect(firstNameOf('عبد الله خالد')).toBe('عبد الله')
    expect(greetingAr(null)).toBe('مرحبا،')
    expect(greetingAr('sara@x.com')).toBe('مرحبا،')
    expect(greetingAr('  ')).toBe('مرحبا،')
  })

  it('ومفتاح الجمهور يقرأ ولا يقبل غير شكله', () => {
    expect(parseAudience('leads:all')).toEqual({ kind: 'leads', scope: 'all' })
    expect(parseAudience('leads:campaign:wajeez-members')).toEqual({ kind: 'leads', scope: 'campaign', value: 'wajeez-members' })
    expect(parseAudience('list:not-a-uuid')).toBeNull()
    expect(parseAudience('users:all')).toBeNull()
  })
})

describe('الشاشة تقرأ التأكيد ولا تكتب غيره', () => {
  it('⚠️ أسطر التأكيد من `confirmLinesAr`، وكتابة العدد من `needsTypedCount`', () => {
    expect(page).toMatch(/confirmLinesAr\(check\)\.map/)
    expect(page).toMatch(/const mustType = needsTypedCount\(check\.recipients\)/)
    expect(page).toMatch(/typedCountMatches\(typed, check\.recipients\)/)
    expect(page, 'يقال لماذا يكتب العدد').toMatch(/\{TYPE_COUNT_WHY_AR\}/)
  })

  it('⚠️ والإرسال بالعدد المعروض نفسه، وزره مغلق حتى يطابق ما كتب', () => {
    expect(page).toMatch(/confirmCount: check\.recipients/)
    expect(page).toMatch(/disabled=\{recounting \|\| !typedOk \|\| \(staged && !capsOk\)\} onClick=\{\(\) => void send\(\)\}>\s*أرسل إلى \{check\.recipients\}/)
  })

  it('⚠️ ومع الإرسال خياران آخران بأثر كل: تجربة لي، وليس الآن', () => {
    const confirm = page.slice(page.indexOf('function SendConfirm'), page.indexOf('/* ─────────── القوائم'))
    expect(confirm).toContain('أرسل تجربة لي أولا')
    expect(confirm).toContain('ليس الآن')
    expect(confirm).toContain('تبقى مسودة')
  })

  it('والشاشة في «المال» بصلاحية الكوبونات', () => {
    const money = allSections.find((s) => s.title === 'المال')!
    expect(money.items.find((i) => i.to === '/admin/bulk-mail')).toMatchObject({ need: 'commerce.manage', label: 'البريد الجماعي' })
  })
})

describe('الإرسال على مراحل', () => {
  it('⚠️ ألفان ثم خمسة آلاف ثم الباقي — ولا يوم فارغ', () => {
    expect(stagePlan(19_820, DEFAULT_STAGE_CAPS)).toEqual([2_000, 5_000, 12_820])
    expect(stagePlan(3_000, DEFAULT_STAGE_CAPS)).toEqual([2_000, 1_000])
    expect(stagePlan(1_500, DEFAULT_STAGE_CAPS)).toEqual([1_500])
    expect(stagePlan(19_820, null)).toEqual([19_820])
    expect(stageLinesAr([2_000, 5_000, 12_820])).toEqual(['اليوم 1 (الآن): 2000 شخصا', 'اليوم 2: 5000 شخصا', 'اليوم 3: 12820 شخصا'])
  })

  it('⚠️ ومفتوح افتراضا فوق ألفين فقط', () => {
    expect(stagedByDefault(STAGED_DEFAULT_OVER)).toBe(false)
    expect(stagedByDefault(STAGED_DEFAULT_OVER + 1)).toBe(true)
  })

  it('⚠️ والشاشة تبدأ بالافتراض، وترسل الحدود التي يراها، وتعرض الجدول من `stageLinesAr`', () => {
    expect(page).toMatch(/useState\(stagedByDefault\(check\.recipients\)\)/)
    expect(page).toMatch(/stages: staged \? caps : null/)
    expect(page).toMatch(/const plan = stagePlan\(check\.recipients, staged \? caps : null\)/)
    expect(page).toMatch(/stageLinesAr\(plan\)\.map/)
  })
})

/* ═══ تخطّي من وصلته حملةٌ قريبا — في التأكيد ويُرسَل مع العدد (٢٣ نوفمبر ٢٠٢٦) ═══ */
describe('تخطي من وصلته حملة قريبا', () => {
  it('⚠️ يقال في أسطر التأكيد، والخيارات 0 و3 و7 و14 والافتراض 7، والصفحة ترسل الأيام مع العدد', async () => {
    const { confirmLinesAr: lines, SKIP_RECENT_DAYS, SKIP_RECENT_DEFAULT, skipRecentAr } = await import('@/application/marketing/bulk-mail')
    expect(lines({ recipients: 90, audienceAr: 'كاسيت', optedOut: 0, invalid: 0, duplicate: 0, recent: 80 }).join(' | ')).toContain('80 وصلتهم حملة قريبا')
    expect([...SKIP_RECENT_DAYS]).toEqual([0, 3, 7, 14])
    expect(SKIP_RECENT_DEFAULT).toBe(7)
    expect(SKIP_RECENT_DAYS.map(skipRecentAr)).toEqual(['لا تتخط أحدا', 'آخر 3 أيام', 'آخر 7 أيام', 'آخر 14 يوما'])
    expect(page).toMatch(/confirmCount: check\.recipients, stages: staged \? caps : null, skipRecentDays: days,/)
    expect(page).toMatch(/data-testid="skip-recent"/)
    expect(page, 'يرسل والعدد يعاد حسابه').toMatch(/disabled=\{recounting \|\| !typedOk/)
  })
})

/* لا يتكرّر الشخص (٢٣ نوفمبر ٢٠٢٦): «تخطَّ من هو موجودٌ بالمنصّة أو موجودٌ بقائمةٍ أخرى». للقائمة المرفوعة وحدَها، مفتوحان
   افتراضا، ويُعاد العدُّ بتغييرهما، ويُرسَلان مع العدد — فلا يُرسَل إلى غير من عُدّ. */
describe('تخطي من في المنصة ومن في قائمة أخرى', () => {
  it('⚠️ يقالان في أسطر التأكيد، وهما خياران مفتوحان افتراضا للقائمة المرفوعة، والصفحة ترسلهما مع العدد', () => {
    const lines = confirmLinesAr({ recipients: 10, audienceAr: 'قائمة', optedOut: 0, invalid: 0, duplicate: 0, onPlatform: 4, inOtherLists: 3 })
    expect(lines[1]).toBe('ولا تصل 7: 4 موجودون في المنصة · 3 في قائمة أخرى')
    expect(page).toMatch(/useState\(true\);\s*const \[skipOtherLists, setSkipOtherLists\] = useState\(true\)/)
    expect(page).toMatch(/\{check\.uploadedList && \(/)
    expect(page).toMatch(/skipPlatform: check\.uploadedList \? skipPlatform : false, skipOtherLists: check\.uploadedList \? skipOtherLists : false/)
    expect(page).toMatch(/checkUrl\(id, \{ d: SKIP_RECENT_DEFAULT, p: true, l: true \}\)/)
    expect(page).toMatch(/&skipPlatform=\$\{o\.p \? 1 : 0\}&skipOtherLists=\$\{o\.l \? 1 : 0\}/)
  })
})

/* حذفُ الحملة — أيِّ حملة (٢٤ نوفمبر ٢٠٢٦): «ألغِ كلَّ حملات الإيميلات لأنّي لا أستطيع أن أحذفها من جهتي». */
describe('حذف أي حملة', () => {
  it('⚠️ زر الحذف على كل حملة — ويقال قبله كم وصل وكم يلغى مما بقي', () => {
    /* الزرُّ في سطره بلا شرطٍ قبله — لا «{c.status === "draft" && …» */
    expect(page).toMatch(/\n\s+<Button tone="ghost" icon=\{Trash2\} disabled=\{busy\} onClick=\{onDelete\}>احذف<\/Button>/)
    expect(page, 'عاد الحذف مشروطا').not.toMatch(/\{campaignDeletable\(/)
    expect(page).toMatch(/if \(c\.status !== "draft"\) \{ setDeleting\(c\); return; \}/)
    expect(page).toContain('{campaignDeleteNoteAr({ status: c.status, sent: c.progress.sent, waiting: c.progress.waiting })}')
    expect(campaignDeleteNoteAr({ status: 'sending', sent: 0, waiting: 2000 })).toBe('لم تصل لأحد. ويلغى ما بقي منها (2000). وتختفي من القائمة.')
    expect(campaignDeleteNoteAr({ status: 'sent', sent: 80, waiting: 0 })).toBe('وصلت إلى 80 شخصا، وما وصل لا يرجع. وتختفي من القائمة.')
  })
})
