/* «انضم كمستشار» وطابورُه (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السابعة).

   قراراتُ صاحب المنصّة: لا اتّفاقيّة («b») — يُقبَل بنسبته فيُفعَّل؛ والنموذجُ يسأل عن الوصول الرقميّ («A» مع
   المتابعين)؛ والنسبةُ تُقترح ٥٪. والخادمُ يحرسه `server/tests/advisors/advisor-applications.test.ts`؛ وهنا:

   ① البابُ في التذييل وخريطةِ الموقع، والصفحةُ في الموجّه.
   ② والنموذجُ يسأل عن الحسابات بمتابعيها والمجموعات بأعضائها وعن الترويج من قبل، ولا يُرسل بلا الشروط.
   ③ والوصولُ يُجمع كما يُجمع في الخادم، والنسبةُ المقترحة ٥٪.
   ④ والطابورُ في «المستشارون» لحبّة `advisor.manage`، ونسبةُ القبول من الصفّ وتبدأ بالمقترحة، والقرارُ من نافذته وحدَها.
   ⑤ ونصوصُها بلا تشكيل. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ADVISOR_DEFAULT_COMMISSION_PCT, biggestAccount, pctAr, reachLineAr, reachTotal, sortApplications, type AdvisorAccount,
} from '@/application/advisor/application'
import type { ApplicationRow } from '@/pages/admin/AdvisorApplications'
import { PUBLIC_PAGES } from '@/application/site/public-pages'
import { sectionsFor } from '@/pages/admin/nav-map'
import { markedTexts } from '../helpers/marked-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق نصٌّ في شرح */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const FORM = code('src/pages/JoinAdvisor.tsx')
const QUEUE = code('src/pages/admin/AdvisorApplications.tsx')

describe('① الباب', () => {
  it('⚠️ «انضم كمستشار» في التذييل وخريطة الموقع، والصفحة في الموجه', () => {
    expect(code('src/components/SiteFooter.tsx')).toMatch(/\{ label: 'انضم كمستشار', to: '\/join-advisor' \}/)
    expect(PUBLIC_PAGES.some((p) => p.path === '/join-advisor')).toBe(true)
    expect(code('src/App.tsx')).toMatch(/<Route path="\/join-advisor" element=\{<JoinAdvisor \/>\} \/>/)
  })
})

describe('② النموذج', () => {
  it('⚠️ يسأل عن الحسابات بمتابعيها والمجموعات بأعضائها وعن الترويج من قبل', () => {
    expect(FORM).toMatch(/accounts: filledAccounts\.map\(\(a\) => \(\{ platform: a\.platform, url: a\.url\.trim\(\), followers: Number\(digitsOnly\(a\.followers\)\) \}\)\)/)
    expect(FORM).toMatch(/communities: filledCommunities\.map\(\(c\) => \(\{ kind: c\.kind, name: c\.name\.trim\(\), members: Number\(digitsOnly\(c\.members\)\) \}\)\)/)
    expect(FORM).toMatch(/promotedBefore: form\.promoted === "yes"/)
    for (const label of ['حساباتك على وسائل التواصل', 'مجموعات تديرها', 'من تصل إليهم', 'هل روجت لدورات أو منتجات على الإنترنت من قبل؟']) {
      expect(FORM).toContain(label)
    }
  })

  it('⚠️ ولا يرسل بلا الشروط — والفخ في الحمولة', () => {
    expect(FORM).toMatch(/if \(!terms\) e\.terms = /)
    expect(FORM).toMatch(/if \(Object\.keys\(found\)\.length > 0\) \{[\s\S]*?return;\s*\}/)
    expect(FORM).toMatch(/termsAccepted: true,\s*\[HONEYPOT_FIELD\]: hp\.value,/)
    expect(FORM).toContain('{hp.field}')
    expect(FORM).toMatch(/\{ADVISOR_TERMS_AR\.map\(\(t\) => <li key=\{t\}>\{t\}<\/li>\)\}/)
  })
})

describe('③ الوصول والنسبة', () => {
  const accounts: AdvisorAccount[] = [
    { platform: 'instagram', url: 'https://instagram.com/a', followers: 30000 },
    { platform: 'tiktok', url: 'https://tiktok.com/@a', followers: 12000 },
  ]

  it('⚠️ المتابعون والأعضاء مجموعا — ولا يحسب سالب ولا ما ليس رقما', () => {
    expect(reachTotal(accounts, [{ members: 900 }])).toBe(42900)
    expect(reachTotal([{ followers: -5 }, { followers: Number.NaN }], [{ members: 10.7 }])).toBe(10)
    expect(biggestAccount(accounts)?.platform).toBe('instagram')
  })

  it('وسطر الوصول يقول المجموع وأكبر الحسابات', () => {
    expect(reachLineAr(accounts, [{ kind: 'whatsapp', name: 'ج', members: 900 }])).toBe('42,900 متابع وعضو · أكبرها إنستغرام 30,000')
    expect(reachLineAr([], [])).toBe('لم يكتب حسابا ولا مجموعة')
  })

  it('⚠️ والنسبة المقترحة ٥٪ — قرار صاحب المنصة، بأرقام العرض الواحدة', () => {
    expect(ADVISOR_DEFAULT_COMMISSION_PCT).toBe(5)
    expect(pctAr(ADVISOR_DEFAULT_COMMISSION_PCT)).toBe('5٪')
    expect(pctAr(7.5)).toBe('7.5٪')
  })
})

describe('④ الطابور', () => {
  it('⚠️ في «المستشارون» لحبة advisor.manage', () => {
    const section = sectionsFor(['advisor.manage']).find((s) => s.title === 'المستشارون')
    expect(section?.items.map((i) => i.to)).toContain('/admin/advisor-applications')
    const none = sectionsFor(['advisor.request.review']).flatMap((s) => s.items.map((i) => i.to))
    expect(none).not.toContain('/admin/advisor-applications')
    expect(code('src/App.tsx')).toMatch(/<Route path="\/admin\/advisor-applications" element=\{<AdminAdvisorApplications \/>\} \/>/)
  })

  it('⚠️ ونسبة القبول من الصف وتبدأ بالمقترحة — والقرار من نافذته وحدها', () => {
    expect(QUEUE).toMatch(/const rateOf = \(id: string\) => rate\[id\] \?\? String\(ADVISOR_DEFAULT_COMMISSION_PCT\);/)
    const approvePosts = QUEUE.match(/\/approve`/g) ?? []
    const rejectPosts = QUEUE.match(/\/reject`/g) ?? []
    expect(approvePosts).toHaveLength(1)
    expect(rejectPosts).toHaveLength(1)
    const approveBox = /\{pending\?\.kind === "approve" && \([\s\S]*?<\/ConfirmAction>/.exec(QUEUE)?.[0] ?? ''
    expect(approveBox, 'القبول يقع خارج نافذته').toMatch(/apiPost\(`\/api\/admin\/advisor-applications\/\$\{row\.id\}\/approve`, \{ commissionPct: pct \}\)/)
    expect(approveBox).toContain('ولا اتفاقية يوقعها')
    const rejectBox = /\{pending\?\.kind === "reject" && \([\s\S]*?<\/ConfirmAction>/.exec(QUEUE)?.[0] ?? ''
    expect(rejectBox, 'الاعتذار يقع خارج نافذته').toContain('/reject`')
  })

  it('والأوسع وصولا أولا حين يطلب', () => {
    const row = (id: string, reachTotal: number, createdAt: string) => ({ id, reachTotal, createdAt }) as ApplicationRow
    const rows = [row('a', 100, '2026-10-01'), row('b', 5000, '2026-09-01'), row('c', 100, '2026-10-05')]
    expect(sortApplications(rows, 'reach').map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortApplications(rows, 'recent').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('⑤ بلا تشكيل', () => {
  for (const f of [
    'src/application/advisor/application.ts', 'src/pages/JoinAdvisor.tsx', 'src/pages/admin/AdvisorApplications.tsx',
    'server/services/advisor-application.service.ts',
  ]) {
    it(f, () => expect(markedTexts(f, read(f))).toEqual([]))
  }
})
