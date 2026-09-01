/* لوحة الإدارة: هويّةٌ من الجلسة، وقائمةٌ من الصلاحيات، واستثناءٌ لمدير النظام.

   دخلتُ اللوحة بحسابين حقيقيّين فوجدت ثلاثة أشياء:

   ١) حسابُ الماليّة يُسأل «من أنت؟» وتُعرض عليه ثلاثةُ أسماء إداريّين لا وجود
      لها، تُختار وتُحفظ في متصفّحه، ومعها «نسخة تجريبية». وهي القاعدة نفسها
      التي حُذفت من بوابة المدرب — ولم تكن قد حُذفت من هذه.
   ٢) القائمة الجانبيّة تُعرض كاملةً لكلّ إداريّ: ثلاثة عشر بابا يفتح من لا
      يملكها فيُردّ عند الخادم — فيكتشف حدّه بالاصطدام لا بالقراءة.
   ٣) ولا سبيل إلى منح شخصٍ صلاحيةً واحدة: القرار بالدور كلّه أو لا شيء.

   وهذه حراسةُ الثلاثة. أمّا قاعدةُ الحساب نفسها — (الأدوار + منح) − منع —
   فلها اختبارها على قاعدة حقيقية. */

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const LAYOUT = 'src/pages/admin/AdminLayout.tsx'
const USERS = 'src/pages/admin/Users.tsx'
const ROUTES = 'server/http/routes/admin-users.routes.ts'

describe('هويّة الإداريّ', () => {
  it('لا هويّةَ مختلَقة ولا تبديلَ هويّة من المتصفّح', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    expect(tracked, 'ملفّ الهويّات المختلَقة ما زال في المستودع').not.toContain('admin-identity')

    const src = read(LAYOUT)
    /* التعليق يشرح ما حُذف فيسمّيه — والفحص على ما يُعرض لا على شرحه */
    const shown = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    for (const ghost of ['عبدالله الرشيد', 'سارة العمري', 'محمد الحربي', 'من أنت؟', 'نسخة تجريبية']) {
      expect(shown, `«${ghost}» ما زالت تُعرض في لوحة الإدارة`).not.toContain(ghost)
    }
    /* والهويّة من الجلسة لا من تخزينٍ يُكتب فيه ما شئت */
    expect(shown, 'الهويّة تُقرأ من التخزين المحلّي').not.toContain('localStorage')
    expect(src).toContain('useRealSession()')
  })
})

describe('قائمة الإدارة تُبنى من الصلاحيات', () => {
  const src = read(LAYOUT)

  it('لكلّ تبويبٍ صلاحيتُه — ولا تبويب بلا واحدة', () => {
    const block = /const allSections[\s\S]*?\n {2}\];/.exec(src)?.[0] ?? ''
    expect(block, 'كتلة التبويبات مفقودة').toBeTruthy()
    const items = [...block.matchAll(/\{ to: "(\/admin[^"]*)"[^}]*\}/g)].map((m) => m[0])
    expect(items.length, 'لا تبويبات').toBeGreaterThan(5)
    /* المفتوحُ صراحةً لا الساقطُ سهوا: كلُّ تبويبٍ يعلن `need` أو `open: true`،
       والمفتوحةُ محصورةٌ في هاتين — إضافةُ ثالثةٍ تُسقط هذا الاختبار فتُراجَع. */
    const OPEN = ['/admin', '/admin/tasks']
    const declaredOpen: string[] = []
    for (const item of items) {
      const to = /to: "([^"]+)"/.exec(item)![1]
      if (/open: true/.test(item)) {
        declaredOpen.push(to)
        continue
      }
      expect(item, `${to} بلا صلاحية معلَنة ولا إعلانِ فتح — يراه من لا يملكه`).toMatch(/need: "[a-z.]+"/)
    }
    expect(declaredOpen.sort(), 'تبويبٌ مفتوحٌ خارج المأذون به').toEqual([...OPEN].sort())
  })

  it('الصلاحيات المعلَنة موجودةٌ في سجلّ الخادم — لا مفتاحَ يُخترع', () => {
    const perms = read('server/auth/permissions.ts')
    const known = new Set([...perms.matchAll(/\{ key: '([^']+)'/g)].map((m) => m[1]))
    expect(known.size, 'سجلّ الصلاحيات لم يُقرأ').toBeGreaterThan(30)
    for (const m of src.matchAll(/need: "([^"]+)"/g)) {
      expect(known.has(m[1]), `التبويب يشترط صلاحيةً لا وجود لها: ${m[1]}`).toBe(true)
    }
  })

  it('الترشيح يقع فعلا — ومن لا تبويبَ له يُقال له', () => {
    expect(src, 'التبويبات لا تُرشَّح بالصلاحيات').toMatch(/\.filter\(\(it\) => !it\.need \|\| can\(it\.need\)\)/)
    expect(src, 'من لا صلاحية له يُترك في لوحةٍ فارغة').toContain('لا صلاحيات مفعّلة لحسابك')
  })
})

describe('استثناء الصلاحية لشخص', () => {
  it('بصلاحيةٍ لا بدور — وثلاثُ حبّاتٍ لا حبّةٌ واحدة', () => {
    /* الرؤية · تعيين الأدوار والإيقاف · التفويض. من يفوّض لمرؤوسيه يحتاج أن
       يراهم ولا يلزم أن يملك تعيين الأدوار — وهو أوسعُ أثرا منه. */
    const perms = read('server/auth/permissions.ts')
    for (const key of ['admin.users.view', 'admin.users.manage', 'admin.permissions.delegate']) {
      expect(perms, `${key} مفقودة من السجلّ`).toContain(`key: '${key}'`)
    }
    const routes = read(ROUTES)
    expect(routes, 'القائمة بحارس الإدارة لا بحارس الرؤية').toContain("requirePermission('admin.users.view')")
    expect(routes, 'التفويض بلا حارسه').toContain("requirePermission('admin.permissions.delegate')")
    /* والشاشة تُخفي بالصلاحية لا بالدور */
    const users = read(USERS)
    expect(users).toContain('can("admin.permissions.delegate")')
    expect(users).toContain('can("admin.users.manage")')
    expect(users, 'الشاشة تحكم بالدور لا بالصلاحية').not.toContain('roles.includes("super_admin")')
  })

  it('التفويض محكومٌ بالرتبة والمهامّ — من وحدةٍ واحدة لا شروطٍ مبعثرة', () => {
    const routes = read(ROUTES)
    expect(routes, 'القواعد لا تُطبَّق في مسار التفويض').toContain('refuseDelegation(')
    /* والقرار يُردّ برسالته لا برسالةٍ عامّة */
    expect(routes).toMatch(/if \(refusal\) return reply\.status\(403\)\.send\(\{ error: refusal \}\)/)
  })

  it('لا استثناء بلا سبب، ولا بابٌ يُغلق على صاحبه', () => {
    const routes = read(ROUTES)
    expect(routes, 'يُقبل استثناءٌ بلا سبب').toContain("code: 'reason_required'")
    expect(routes, 'يستطيع منع إدارة المستخدمين عن نفسه').toContain("code: 'self_lockout'")
    /* والشاشة تمنع الضغط قبل السبب — لا تنتظر ردّ الخادم */
    expect(read(USERS)).toMatch(/permReason\.trim\(\)\.length < 5/)
  })

  it('كلّ تغييرٍ يُقيَّد وتُبطَل جلساتُ صاحبه', () => {
    const routes = read(ROUTES)
    const block = /app\.post\('\/api\/admin\/users\/:id\/permissions'[\s\S]*?\n {2}\}\)/.exec(routes)?.[0] ?? ''
    expect(block, 'مسار الاستثناء مفقود').toBeTruthy()
    expect(block, 'لا يُقيَّد في سجلّ التدقيق').toContain('recordAudit')
    /* الجلسة تحمل الصلاحيات وقت حلّها: بلا إبطالها يعمل بصلاحيةٍ نُزعت */
    expect(block, 'الجلسات لا تُبطَل — فيعمل بصلاحيةٍ نُزعت').toContain('revokeAllSessions')
  })
})

/* إنشاءُ الحساب من اللوحة (المرحلة ٣ · البند ٩).

   الواجهةُ كانت تقول «أُنشئ الحساب — ووصلته دعوةٌ تشرح دوره» نصّا ثابتا،
   والخادمُ يعيد `inviteNote` يعرف فيه أأُرسلت الرسالةُ أم لا. فمن أنشأ حسابا
   على منصّةٍ بلا SMTP قيل له إنّ الدعوة وصلت — فينتظر صاحبُ الحساب رسالةً
   لن تأتي، ولا يعلم المنشئُ أنّ عليه أن يدلّه على «نسيت كلمة المرور». */
describe('إنشاءُ حسابٍ إداريّ: لا يُبشَّر بما لم يقع', () => {
  it('الواجهةُ تنقل جوابَ الخادم عن الدعوة ولا تجزم من عندها', () => {
    const ui = read(USERS)
    /* التعليقُ يقتبس الصيغةَ المعطوبة، فيُجرَّد قبل الفحص */
    const shown = ui.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    expect(shown, 'الواجهة تجزم بوصول الدعوة بلا دليلٍ من الخادم').not.toMatch(/["'`][^"'`]*وصلته دعوة/)
    expect(shown, 'جوابُ الخادم عن الدعوة لا يُقرأ').toContain('inviteNote')
  })

  it('والخادمُ يشتقّ «أُرسلت» من حال الإرسال لا يعلنها', () => {
    const routes = read(ROUTES)
    expect(routes, 'مسارُ الإنشاء لا يُعيد حالَ الدعوة').toContain('inviteNote')
    expect(routes, 'حالُ الإرسال معلَنٌ لا مشتقّ').not.toMatch(/inviteSent:\s*true/)
  })
})
