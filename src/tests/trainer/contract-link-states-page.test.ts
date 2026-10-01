/* ═══ صفحةُ التوقيع تسمّي كلَّ حالٍ — ورقمُ العقد على كلّ شاشة (١ أكتوبر ٢٠٢٦) ═══
 *
 * طلبُ صاحب المنصّة: «when someone has expired link, they know the exact reason
 * whether expired or signed… for the signed ones, they should still see the
 * contract locked for reading. make a number for contract instead of version».
 *
 * وما يقع في الخادم مقيسٌ في `server/tests/trainer/contract-link-states.test.ts`
 * و`contract-number.test.ts`. وهنا ما تقوله الشاشات:
 *
 * ① لكلّ حالٍ من `CONTRACT_CLOSED_STATES` رأسٌ وجملةٌ في الصفحة — فحالٌ يضيفها
 *   الخادمُ بلا جملةٍ تُسقط هذا.
 * ② ورقمُ العقد على كلّ لوح: المغلقِ والمفتوح، وفي «عقدي» وقائمةِ الإدارة وبحثها.
 * ③ والنسخةُ المقفلةُ لما وُقّع وحدَه، بلا خانةٍ ولا زرّ توقيع.
 * ④ والبابُ الذي يجيب الواقفَ: رابطٌ جديدٌ لعرضٍ قائم — لا لما سقط بعد التذكير
 *   الأخير — و«عقدي» لما نفذ.
 * ⑤ والقواعدُ المشتركةُ نفسُها: أيُّ حالٍ لأيّ صفّ، وأيُّ بريدَين صندوقٌ واحد.
 *
 * ويُقاس على البنية بعد نزع التعليقات — لا على ورودِ حرفٍ في الملفّ.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CONTRACT_CLOSED_STATES, SIGNED_COPY_STATES, closedStateOf, sameMailbox,
} from '@/application/trainer/contract-link-state'
import { parseContractDoc, shownMeta } from '@/application/trainer/contract-sections'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGE = bare('src/pages/ContractSign.tsx')
const MINE = bare('src/pages/trainer/MyContract.tsx')
const ADMIN = bare('src/pages/admin/TrainerContracts.tsx')

/** جسمٌ من الصفحة: من `head` إلى أوّل `end` بعده — و`''` إن لم يُوجَد */
function block(src: string, head: string, end: string): string {
  const at = src.indexOf(head)
  if (at < 0) return ''
  const stop = src.indexOf(end, at + head.length)
  return src.slice(at, stop < 0 ? src.length : stop)
}

const HEADS = block(PAGE, 'const CLOSED_HEAD: Record<ContractClosedState, string> = {', '\n}')
const LINES = block(PAGE, 'function closedLinesAr(', '\nfunction ')
const DOOR = block(PAGE, 'function ClosedDoor(', '\nfunction ')

describe('① لكلّ حالٍ رأسٌ وجملة', () => {
  it('الكتلُ مقروءة — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(HEADS, 'لم تُقرأ رؤوسُ الحالات').not.toBe('')
    expect(LINES, 'لم تُقرأ جملُ الحالات').not.toBe('')
    expect(DOOR, 'لم يُقرأ لوحُ الباب المغلق').not.toBe('')
  })

  for (const s of CONTRACT_CLOSED_STATES) {
    it(`⚠️ «${s}»: رأسٌ وجملة`, () => {
      expect(HEADS, `لا رأسَ لـ«${s}» — فيُقرأ لوحٌ بلا عنوان`).toMatch(new RegExp(`^\\s+${s}: '`, 'm'))
      expect(LINES, `لا جملةَ لـ«${s}» — فيقف الواقفُ أمام بابٍ لا يُسمّي نفسَه`).toContain(`case '${s}':`)
    })
  }

  it('والبابُ المغلقُ يُرسَم من الصفحة لكلّ ما ليس مفتوحا', () => {
    expect(PAGE).toMatch(/if \(view\.state !== 'open'\) return <Shell><ClosedDoor view=\{view\} doc=\{doc\} \/><\/Shell>/)
  })
})

describe('② ورقمُ العقد على كلّ شاشة', () => {
  it('⚠️ على اللوح المغلق، وعلى المفتوح فوق النصّ', () => {
    expect(DOOR, 'البابُ المغلقُ بلا رقم عقده').toContain('رقم العقد: <span dir="ltr">{view.number}</span>')
    expect(PAGE, 'المفتوحُ بلا رقم عقده').toContain('رقم العقد: <span dir="ltr">{v.number}</span>')
  })

  it('⚠️ وفي «عقدي»', () => {
    expect(MINE, '«عقدي» بلا رقم العقد').toContain('رقم العقد: <span dir="ltr">{data.number}</span>')
  })

  it('⚠️ وفي قائمة الإدارة — ويُبحث به', () => {
    expect(ADMIN, 'صفُّ العقد بلا رقمه').toMatch(/<b>\{docNameOf\(c\)\}<\/b>\s*\{" "\}<span dir="ltr"[^>]*>\{c\.number\}<\/span>/)
    const hit = block(ADMIN, 'const hit = (c: ContractRow) => matchesQuery(contractQ, [', ']);')
    expect(hit, 'لم يُقرأ البحث').not.toBe('')
    expect(hit, 'لا يُبحث برقم العقد — والمدرّبُ يسأل به').toContain('c.number')
  })

  it('والترويسةُ تقرأ سطرَ الرقم وتعرضه', () => {
    const doc = parseContractDoc('اتفاقية\n\nرقم العقد: WJ-CT-2026-00042\nالمرجع: WJ-TR-2026-00001\nتاريخ الإصدار: 1 أكتوبر 2026\n\nالبند 1 — التعريفات\n\n1-1 نصّ.')
    expect(shownMeta(doc.meta).map((m) => m.labelAr), 'سطرُ الرقم سقط في جسم الوثيقة أو لم يُرسَم')
      .toEqual(['رقم العقد', 'المرجع', 'تاريخ الإصدار'])
  })
})

describe('③ والنسخةُ المقفلةُ لما وُقّع وحدَه', () => {
  it('⚠️ تُرسَم بشرط القائمة — ولا خانةَ ولا زرَّ توقيعٍ على الباب المغلق', () => {
    expect(DOOR).toContain('const copy = SIGNED_COPY_STATES.includes(view.state) && doc')
    expect(DOOR, 'زرُّ توقيعٍ على بابٍ مغلق').not.toMatch(/onClick=\{\(\) => void sign|onClick=\{sign\}/)
    expect(DOOR, 'خانةُ إدخالٍ على بابٍ مغلق').not.toMatch(/<input|<textarea/)
  })

  it('والقائمةُ عقودٌ وُقّعت — لا عرضٌ لم يُوقَّع', () => {
    for (const s of ['expired', 'replaced', 'declined', 'amendment_requested'] as const) {
      expect(SIGNED_COPY_STATES, `«${s}» لم يُوقَّع فلا نسخةَ له`).not.toContain(s)
    }
  })
})

describe('④ والبابُ الذي يجيب الواقف', () => {
  it('⚠️ رابطٌ جديدٌ لعرضٍ قائم — لا لما سقط بعد التذكير الأخير', () => {
    expect(DOOR).toContain("const askLink = view.state === 'replaced' || (view.state === 'expired' && !view.afterFinalReminder)")
    expect(DOOR, 'لا بابَ لطلب رابطٍ جديد').toMatch(/askLink && <Button as=\{Link\} to="\/contract-link"/)
  })

  /* ومن اعتُمد توقيعُه بوّابتُه مفتوحةٌ و«عقدي» فيها (١ أكتوبر ٢٠٢٦) */
  it('⚠️ و«عقدي» لما اعتُمد توقيعُه أو نفذ أو حلّ محلَّه غيرُه', () => {
    expect(DOOR).toContain("const portal = view.state === 'signature_approved' || view.state === 'countersigned' || view.state === 'superseded'")
    expect(DOOR).toMatch(/portal && <Button as=\{Link\} to="\/trainer\/contract"/)
  })
})

describe('⑤ والقواعدُ المشتركة', () => {
  const now = new Date('2026-10-01T12:00:00Z')
  const past = new Date('2026-09-30T12:00:00Z')
  const future = new Date('2026-10-03T12:00:00Z')

  it('حالُ الصفّ — والمفتوحُ الحيُّ لا حالَ مغلقةً له', () => {
    expect(closedStateOf({ status: 'sent', tokenExpiresAt: future }, { old: false, now })).toBeNull()
    expect(closedStateOf({ status: 'sent', tokenExpiresAt: future }, { old: true, now })).toBe('replaced')
    expect(closedStateOf({ status: 'sent', tokenExpiresAt: past }, { old: false, now })).toBe('expired')
    expect(closedStateOf({ status: 'sent', tokenExpiresAt: past }, { old: true, now })).toBe('expired')
    for (const s of ['signed', 'signature_approved', 'countersigned', 'superseded', 'terminated', 'declined', 'revoked', 'amendment_requested']) {
      expect(closedStateOf({ status: s, tokenExpiresAt: past }, { old: false, now }), s).toBe(s)
    }
    expect(closedStateOf({ status: 'draft', tokenExpiresAt: null }, { old: false, now })).toBeNull()
  })

  it('وبريدان لصندوقٍ واحد — بلا نظرٍ إلى حالة الحرف، ولا يُطابَق الفراغ', () => {
    expect(sameMailbox('Trainer@Example.com ', 'trainer@example.com')).toBe(true)
    expect(sameMailbox('a@example.com', 'b@example.com')).toBe(false)
    expect(sameMailbox(null, null)).toBe(false)
    expect(sameMailbox('', '')).toBe(false)
  })
})
