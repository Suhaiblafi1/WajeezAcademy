/* صندوقٌ واحدٌ للمتعلّم — «الرسائل والتنبيهات» (٢٠ أكتوبر ٢٠٢٦، الخطوة ي).

   كانت بجانبه «إشعاراتي»: صفحةٌ بلا بندٍ في القائمة تعرض الإشعاراتِ نفسَها، وإليها يقود كلُّ إشعارٍ لا
   وجهةَ له — فيدور المتعلّمُ في حلقة — وفي ذيلها تفضيلاتُه. فصارت تحويلا، والتفضيلاتُ في «الملف الشخصي»
   (`notification-preferences-ui.test.ts`)، ورابطُ البريد إليها (`mail-shape.test.ts`).

   والفحصُ على البنية: نصوصُ الشيفرة الحرفيّةُ بمحلّل TypeScript لا ورودُ حرفٍ في تعليق. */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { buildInbox } from '@/application/student/inbox'
import { LEARNER_CATEGORY_KEYS, learnerWhatAr } from '@/application/notifications/learner-categories'
import { NOTIFICATION_CATEGORIES } from '@/application/notifications/categories'

const root = process.cwd()
const parse = (p: string) =>
  ts.createSourceFile(p, readFileSync(join(root, p), 'utf8'), ts.ScriptTarget.Latest, true, p.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node)
  ts.forEachChild(node, (c) => walk(c, visit))
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) { if (rel !== 'src/tests') files(rel, out) }
    else if (/\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

/** نصوصُ الملفّ الحرفيّةُ وقوالبُه — لا تعليقاته */
function literals(p: string): string[] {
  const sf = parse(p)
  const out: string[] = []
  walk(sf, (n) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text)
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) out.push(n.initializer.text)
  })
  return out
}

/** المعرّفاتُ في جسم دالّةٍ مسمّاة (`const name = …`) — بلا تعليقاتها */
function identifiersIn(p: string, name: string): string[] {
  const sf = parse(p)
  const out: string[] = []
  walk(sf, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === name && n.initializer) {
      walk(n.initializer, (m) => { if (ts.isIdentifier(m)) out.push(m.text) })
    }
  })
  return out
}

/** أسماءُ ما يُنادى في الملفّ */
function callees(p: string): string[] {
  const sf = parse(p)
  const out: string[] = []
  walk(sf, (n) => { if (ts.isCallExpression(n)) out.push(n.expression.getText(sf)) })
  return out
}

describe('بابٌ واحد', () => {
  it('⚠️ «إشعاراتي» حُذفت، ومسارُها القديمُ تحويلٌ إلى الصندوق — فلا يُكسر رابطٌ في بريدٍ مرسَل', () => {
    expect(existsSync(join(root, 'src/pages/student/Notifications.tsx')), 'عادت الصفحةُ المكرّرة').toBe(false)
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
    expect(app).toMatch(/<Route path="\/student\/notifications" element=\{<Navigate to="\/student\/inbox" replace \/>\} \/>/)
  })

  it('⚠️ ولا شيءَ في الواجهة يقود إليها — إلّا التحويلُ نفسُه', () => {
    const hits = files('src')
      .filter((f) => f !== 'src/App.tsx')
      .filter((f) => literals(f).some((t) => t.includes('/student/notifications')))
    expect(hits, 'ما زال يقود إلى الصفحة المحذوفة').toEqual([])
  })

  it('⚠️ ورسالةٌ عن شعبته بلا مفتاحٍ تفتح «رحلتي» — لا حلقةَ ولا طريقَ مسدود', () => {
    const [msg] = buildInbox([
      { id: 'm', title: 'رسالة من مدربك', body: 'جهزوا الخريطة', status: 'sent', sentAt: '2026-10-20T09:00:00Z', templateKey: null, data: { cohortId: 'c1', messageId: 'x' } },
    ], [], [], 'u1')
    expect(msg).toMatchObject({ href: '/student/learning', ctaAr: 'افتح رحلتك' })
  })

  it('⚠️ والقراءةُ في الصندوق تُنقص شارةَ الجرس الآن — لا بعد دقيقة', () => {
    /* في البند الواحد وفي «علّم الكل» كليهما — فالأوّلُ أكثرُ ما يقع */
    for (const fn of ['markOne', 'markAll']) {
      expect(identifiersIn('src/pages/student/Inbox.tsx', fn), `${fn} لا يُعلن الجرس`).toContain('announceInboxRead')
    }
    expect(callees('src/pages/student/PortalLayout.tsx'), 'الجرسُ لا يسمع').toContain('onInboxRead')
  })
})

describe('وإعداداتُه بلغته', () => {
  it('⚠️ لا يقرأ المتعلّمُ في أصنافه خبرا لا يصله — «مستحقّات مدرّب» و«كشف عمولة»', () => {
    for (const c of NOTIFICATION_CATEGORIES.filter((x) => LEARNER_CATEGORY_KEYS.has(x.key))) {
      expect(learnerWhatAr(c.key, c.whatAr), c.key).not.toMatch(/مستحق|عمولة/)
    }
  })
})
