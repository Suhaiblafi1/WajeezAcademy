/* رسالةُ «مستشار قبل الدفع» تحمل المسارَ ودوراتِه — لا تنتظر ورقةً تُرفق باليد (٢٤ أكتوبر ٢٠٢٦).
   وطلبُ السيرة صندوقٌ مضاءٌ في الورقة لا سطرٌ باهت. والعلّةُ في رأس `application/advisor/brief-message.ts`. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRIEF_ATTACH_MSG_AR, REFERRAL_MSG_AR, advisorBriefTextAr, referralTextAr } from '@/application/advisor/brief-message'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const BRIEF = code('src/components/AdvisorBrief.tsx')
const PATHWAY = code('src/pages/Pathway.tsx')
const DIAG = code('src/pages/Diagnostic.tsx')

describe('رسالة ملخص المستشار', () => {
  it('⚠️ تحمل المسار ورابطه ودوراته وطلب السيرة — فتصل ولو لم يرفق PDF', () => {
    expect(
      advisorBriefTextAr({ message: 'مرحبا', pathwayUrl: 'https://x.test/pathways/P-1', courseNames: ['أ', 'ب'], attachNote: 'أرفق سيرتك' }),
    ).toBe('مرحبا\n\nرابط المسار: https://x.test/pathways/P-1\n\nالدورات في خطتي:\n1. أ\n2. ب\n\nأرفق سيرتك')
    /* ومن لا دورات في خطّته لا يُكتب له عنوانٌ فارغ */
    expect(advisorBriefTextAr({ message: 'مرحبا', pathwayUrl: 'u', courseNames: [], attachNote: 'ن' })).toBe('مرحبا\n\nرابط المسار: u\n\nن')
  })

  it('⚠️ زر واتساب يبني رسالته من المسار ودوراته، والصفحة تمرّر رابط المسار', () => {
    /* وآخرُ الرسالة بلسان مرسلها لا سطرُ الورقة — وإلّا قرأه المستشارُ طلبا منه هو */
    expect(BRIEF).toContain('const text = advisorBriefTextAr({ message, pathwayUrl, courseNames, attachNote: BRIEF_ATTACH_MSG_AR });')
    expect(BRIEF).toContain('buildWaHref(numbers, "advisor_brief", CONTACT.whatsapp, text)')
    expect(PATHWAY).toMatch(/<AdvisorBrief[\s\S]*?pathwayUrl=\{pathwayUrlOf\(pathway\.id\)\}/)
  })

  it('⚠️ طلب السيرة صندوق مضاء بنغمة التنبيه وخط عريض — لا سطر باهت', () => {
    const note = BRIEF.match(/<Inset\s+as="p"\s+tone="warn"\s+data-testid="brief-attach-note"\s+className="([^"]+)"[\s\S]*?<\/Inset>/)
    expect(note, 'غاب صندوق طلب السيرة').not.toBeNull()
    const cls = note![1].split(/\s+/)
    expect(cls).toContain('font-bold')
    expect(cls, 'عاد باهتا').not.toContain('text-muted-foreground')
    expect(note![0]).toContain('{BRIEF_ATTACH_NOTE_AR}')
  })

  it('النصوص بلا تشكيل', () => {
    expect(BRIEF_ATTACH_MSG_AR).toBe(plainAr(BRIEF_ATTACH_MSG_AR))
    expect(BRIEF_ATTACH_MSG_AR).toMatch(/^سأرسل سيرتي/)
    for (const t of ['رابط المسار:', 'الدورات في خطتي:', 'رسالة واتساب تحمل مسارك ودوراتك. ويمكنك إرفاق هذا الملخص PDF أيضا.']) {
      expect(t).toBe(plainAr(t))
    }
    expect(BRIEF).toContain('رسالة واتساب تحمل مسارك ودوراتك.')
  })

  /* رسالةُ الإحالة («حالتك تستحق جلسة مع مستشار بشري») تحمل ما تحمله رسالةُ «قبل الدفع» (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ رسالة الإحالة تحمل المسار ورابطه ودوراته وسطر السيرة بلسان مرسلها', () => {
    const t = referralTextAr('PP-BIZ', ['دورة استراتيجية التسعير: بناء النطاق'])
    expect(t.startsWith(REFERRAL_MSG_AR + '\n\nرابط المسار: ')).toBe(true)
    expect(t).toMatch(/\/pathways\/PP-BIZ\n\nالدورات في خطتي:\n1\. استراتيجية التسعير\n\n/)
    expect(t.endsWith(BRIEF_ATTACH_MSG_AR)).toBe(true)
  })

  it('⚠️ زرا الإحالة في صفحة المسار وصفحة التشخيص يبنيان رسالتهما بها — لا سطرا ثابتا', () => {
    expect(PATHWAY).toMatch(/<AdvisorContact\s+text=\{referralTextAr\(pathway\.id, pathwayCoursesList\.map\(\(c\) => c\.name\)\)\}/)
    expect(DIAG).toMatch(/<AdvisorContact\s+text=\{referralTextAr\(topPathway\.id, planCourseIds\.map\(/)
    for (const [name, src] of [['Pathway', PATHWAY], ['Diagnostic', DIAG]] as const) {
      expect(src.includes('أخبرني أن حالتي تستحق جلسة مع مستشار بشري'), `${name}: عاد السطر الثابت`).toBe(false)
    }
  })

  it('⚠️ «راسل مستشار وجيز قبل الدفع» إن فتح في لسان جديد يرسل الرسالة كاملة', () => {
    expect(PATHWAY).toMatch(/text=\{advisorBriefTextAr\(\{ message: advisorMsg, pathwayUrl: pathwayUrlOf\(pathway\.id\), courseNames: pathwayCoursesList\.map\(\(c\) => c\.name\), attachNote: BRIEF_ATTACH_MSG_AR \}\)\}/)
    expect(PATHWAY, 'عادت الرسالة القصيرة').not.toMatch(/text=\{advisorMsg\}/)
  })
})
