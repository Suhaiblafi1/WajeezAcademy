/* رسالةُ «مستشار قبل الدفع» تحمل المسارَ ودوراتِه — لا تنتظر ورقةً تُرفق باليد (٢٤ أكتوبر ٢٠٢٦).
   وطلبُ السيرة صندوقٌ مضاءٌ في الورقة لا سطرٌ باهت. والعلّةُ في رأس `application/advisor/brief-message.ts`. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { advisorBriefTextAr } from '@/application/advisor/brief-message'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const BRIEF = code('src/components/AdvisorBrief.tsx')
const PATHWAY = code('src/pages/Pathway.tsx')

describe('رسالة ملخص المستشار', () => {
  it('⚠️ تحمل المسار ورابطه ودوراته وطلب السيرة — فتصل ولو لم يرفق PDF', () => {
    expect(
      advisorBriefTextAr({ message: 'مرحبا', pathwayUrl: 'https://x.test/pathways/P-1', courseNames: ['أ', 'ب'], attachNote: 'أرفق سيرتك' }),
    ).toBe('مرحبا\n\nرابط المسار: https://x.test/pathways/P-1\n\nالدورات في خطتي:\n- أ\n- ب\n\nأرفق سيرتك')
    /* ومن لا دورات في خطّته لا يُكتب له عنوانٌ فارغ */
    expect(advisorBriefTextAr({ message: 'مرحبا', pathwayUrl: 'u', courseNames: [], attachNote: 'ن' })).toBe('مرحبا\n\nرابط المسار: u\n\nن')
  })

  it('⚠️ زر واتساب يبني رسالته من المسار ودوراته، والصفحة تمرّر رابط المسار', () => {
    expect(BRIEF).toContain('const text = advisorBriefTextAr({ message, pathwayUrl, courseNames, attachNote: BRIEF_ATTACH_NOTE_AR });')
    expect(BRIEF).toContain('buildWaHref(numbers, "advisor_brief", CONTACT.whatsapp, text)')
    expect(PATHWAY).toMatch(/<AdvisorBrief[\s\S]*?pathwayUrl=\{`\$\{siteOrigin\(\)\}\/pathways\/\$\{pathway\.id\}`\}/)
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
    for (const t of ['رابط المسار:', 'الدورات في خطتي:', 'رسالة واتساب تحمل مسارك ودوراتك. ويمكنك إرفاق هذا الملخص PDF أيضا.']) {
      expect(t).toBe(plainAr(t))
    }
    expect(BRIEF).toContain('رسالة واتساب تحمل مسارك ودوراتك.')
  })
})
