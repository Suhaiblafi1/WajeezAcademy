/* رابطُ ملفّ صاحب المنحة في رسالته إلى المستشار — قصيرٌ، ويفتح صفَّه في قائمة المنحة (٢٦ أكتوبر ٢٠٢٦).
   والعلّةُ في رأس `src/pages/GrantRecordLink.tsx`. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRANT_RECORD_KEY_RE, GRANT_RECORD_PATH, grantRecordLink } from '@/application/commerce/grant-landing'
import { BARE_HOST, CANONICAL_ORIGIN, EMAIL_DOMAIN } from '@/application/site/origin'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const APP = code('src/App.tsx')
const REDIRECT = code('src/pages/GrantRecordLink.tsx')
const LIST = code('src/pages/admin/GrantRegistrants.tsx')
const PAGE = code('src/pages/MemberGrantPage.tsx')

describe('رابط ملف صاحب المنحة', () => {
  it('⚠️ قصير: النطاق بلا https ولا www، ثم /g/ والكود', () => {
    expect(BARE_HOST).toBe('wajeezacademy.com')
    expect(CANONICAL_ORIGIN.endsWith(BARE_HOST)).toBe(true)
    expect(EMAIL_DOMAIN).toBe(BARE_HOST)
    expect(grantRecordLink(BARE_HOST, 'WG-ABCD2345')).toBe('wajeezacademy.com/g/WG-ABCD2345')
    expect(GRANT_RECORD_PATH).toBe('/g')
  })

  it('يقبل الكود أو رقم الطلب وحدهما', () => {
    expect(GRANT_RECORD_KEY_RE.test('WG-ABCD2345')).toBe(true)
    expect(GRANT_RECORD_KEY_RE.test('11111111-1111-4111-8111-111111111111')).toBe(true)
    for (const bad of ['', 'WG-1', 'javascript:1', '../admin', 'WG-ABCD2345/x']) expect(GRANT_RECORD_KEY_RE.test(bad), bad).toBe(false)
  })

  it('⚠️ الطريق /g/:key يحوّل إلى قائمة المنحة في الإدارة مبحوثا فيها بالكود', () => {
    expect(APP).toMatch(/<Route path="\/g\/:key" element=\{<GrantRecordLinkPage \/>\} \/>/)
    expect(APP).toMatch(/const GrantRecordLinkPage = lazy\(\(\) => import\('\.\/pages\/GrantRecordLink'\)\)/)
    expect(REDIRECT).toMatch(/if \(!GRANT_RECORD_KEY_RE\.test\(key\)\) return <Navigate replace to="\/grant" \/>;/)
    expect(REDIRECT).toContain('<Navigate replace to={`/admin/member-grant?q=${encodeURIComponent(key)}#grant-registrants`} />')
  })

  it('⚠️ القائمة تبدأ بالبحث من الرابط، وتطابق الكود ورقم الطلب، وتنزل إلى قسمها', () => {
    expect(LIST).toMatch(/const fromLink = params\.get\("q"\) \?\? "";\s*const \[q, setQ\] = useState\(fromLink\);/)
    expect(LIST).toMatch(/matchesQuery\(q, \[[^\]]*r\.code, r\.id\]\)/)
    expect(LIST).toMatch(/<h2 id="grant-registrants"/)
    expect(LIST).toMatch(/if \(rows && fromLink\) document\.getElementById\("grant-registrants"\)\?\.scrollIntoView/)
  })

  /* وما اختاره يُحفظ في ملفّه فيراه المستشار (٢٧ أكتوبر ٢٠٢٦) — والخادمُ في `server/tests/commerce/grant-landing.test.ts` ⑩ */
  it('⚠️ الصفحة تحفظ ما اختاره بعد أن يغيره هو لا عند فتحها — والقائمة تعرضه بأسمائه', () => {
    expect(PAGE).toMatch(/const toggle = \(id: string\) => \{ setTouched\(true\); setPicked\(/)
    expect(PAGE).toMatch(/if \(!touched \|\| !ref\) return;\s*const t = setTimeout\(\(\) => \{ void apiPut\(GRANT_PICKS_PATH, \{ ref, courseIds: picked \}\)/)
    expect(PAGE).toContain('const GRANT_PICKS_PATH = "/api/public/grant/picks";')
    /* ولا يُضبط «غيّره» إلّا في نقرته: لو ضُبط عند فتح الصفحة لمحا فتحُها في جهازٍ آخر ما اختاره قبله */
    expect(PAGE.match(/setTouched\(true\)/g)?.length).toBe(1)
    /* سطرٌ لكلّ دورةٍ مرقّمٌ بعنوانها القصير — لا قائمةٌ بفواصل */
    expect(LIST).toMatch(/r\.picks\.length > 0 && \([\s\S]*?<ol className="[^"]*list-decimal[^"]*">\s*\{r\.picks\.map\(\(p\) => <li key=\{p\}>\{shortCourseTitleAr\(p\)\}<\/li>\)\}/)
    expect(LIST).not.toMatch(/r\.picks\.join/)
    expect(LIST).toMatch(/matchesQuery\(q, \[[^\]]*\.\.\.r\.picks/)
  })
})
