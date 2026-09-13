/* ثلاثُ شكاوى من صاحب المنصّة (١٣ سبتمبر ٢٠٢٦)، وهذه حرّاسُها:

   ١ · «أعدّل حسابي في منصّة المدير الأعلى فأتحوّل لمنصّة طالب، علما أنّ
       دوري سوبر أدمن فقط».
   ٢ · «الدخول بطيء جدّا».
   ٣ · «أحتاج أن ينسدل من اسمي في الصفحة الرئيسيّة خيارُ الخروج، بدل أن
       أدخل للداخل وبعدها أخرج».

   وثلاثتُها أعطابٌ لا تُسقط شيئا: الصفحةُ تُعرض، والحسابُ يُحفظ، والخروجُ
   ممكنٌ بعد ثلاث خطوات. فالحارسُ على المنطق الذي يُنتج السلوك. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { accountPathForPortal, portalPrefixFor } from '@/application/site/portal-paths'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** الشيفرةُ بلا تعليقاتها — فلا يمرّ حارسٌ لأنّ تعليقا ذكر ما يحرسه */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('إطارُ «حسابي» يتبع البوّابةَ التي فُتح منها', () => {
  it('⚠️ فالمديرُ يبقى في إطار الإدارة، والمدرّبُ في إطاره — ولا ينقلب أحدٌ طالبا', () => {
    expect(accountPathForPortal('/admin')).toBe('/admin/account')
    expect(accountPathForPortal('/admin/cohorts')).toBe('/admin/account')
    expect(accountPathForPortal('/trainer/schedule')).toBe('/trainer/account')
    expect(accountPathForPortal('/advisor')).toBe('/advisor/account')
  })

  it('وبوّابةُ المتعلّم هي الأصل لمن ليس في بوّابةِ عاملين', () => {
    expect(accountPathForPortal('/student/learning')).toBe('/student/account')
    expect(accountPathForPortal('/')).toBe('/student/account')
  })

  it('⚠️ ولا تُخدع بمسارٍ يبدأ بحروف البادئة ولا يقع فيها', () => {
    /* `/administration` ليست `/admin`، و`/trainers` صفحةٌ عامّةٌ للزوّار
       لا بوّابةُ المدرّب — ومطابقةُ الحروف وحدَها تخلطهما، فتُصيَّر صفحةُ
       زوّارٍ بإطار بوّابة. والاختيارُ كلُّه يمرّ بـ`portalPrefixFor`. */
    expect(portalPrefixFor('/administration')).toBeNull()
    expect(portalPrefixFor('/trainers')).toBeNull()
    expect(portalPrefixFor('/admin')).toBe('/admin')
    expect(portalPrefixFor('/trainer/schedule')).toBe('/trainer')
    expect(accountPathForPortal('/administration')).toBe('/student/account')
    expect(accountPathForPortal('/trainers')).toBe('/student/account')
  })

  it('والإطارُ والمسارُ يُشتقّان من البادئة نفسِها — فلا يفترق ما يُرى عمّا يُفتح', () => {
    const frame = code('src/pages/PortalFrame.tsx')
    const paths = code('src/application/site/portal-paths.ts')
    expect(frame, 'الإطارُ يطابق المسارَ بنفسه').toContain('portalPrefixFor')
    for (const layout of ['AdminLayout', 'TrainerLayout', 'AdvisorLayout', 'PortalLayout']) {
      expect(frame, `إطارٌ لا يعرف ${layout}`).toContain(`<${layout} title=`)
    }
    expect(frame, 'مطابقةٌ ثانيةٌ في الإطار تفترق عن الأولى').not.toMatch(/startsWith/)
    expect(paths.match(/startsWith/g) ?? [], 'المطابقةُ في موضعٍ واحدٍ لا مواضع').toHaveLength(1)
  })

  it('⚠️ ولكلّ بوّابةٍ مسارُ حسابٍ مسجَّلٌ خلفَ حارسها — وإلّا فالرابطُ إلى لا شيء', () => {
    const app = code('src/App.tsx')
    for (const path of ['/admin/account', '/trainer/account', '/advisor/account', '/student/account']) {
      expect(app, `مسارٌ غيرُ مسجَّل: ${path}`).toContain(`path="${path}"`)
    }
  })

  it('وقائمةُ العاملين تقرأ المسارَ ولا تكتب وجهتَها بيدها', () => {
    const menu = code('src/components/StaffAccountMenu.tsx')
    expect(menu, 'عاد الرابطُ مكتوبا إلى بوّابة المتعلّم').not.toContain('"/student/account"')
    expect(menu).toContain('accountPathForPortal')
  })

  it('وصفحةُ الحساب تُصيَّر بالإطار المتغيّر لا بإطار المتعلّم', () => {
    const page = code('src/pages/student/Account.tsx')
    expect(page).toContain('PortalFrame')
    expect(page, 'عاد إطارُ بوّابة المتعلّم مفروضا').not.toMatch(/<PortalLayout\b/)
  })
})

describe('«من أنت؟» — نداءٌ واحدٌ لا خمسة', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  /** يبني وحدةَ الجلسة بجوابٍ مزيَّف، ويعدّ النداءات */
  const load = async () => {
    const calls = { n: 0 }
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.n += 1
      return {
        ok: true,
        json: async () => ({ user: { userId: 'u1', email: 'a@b.c', displayName: 'سهيب', roles: ['super_admin'], permissions: [], emailVerified: true }, emailChannelEnabled: true }),
      } as unknown as Response
    }))
    const me = await import('@/services/me')
    me.forgetMe()
    return { me, calls }
  }

  it('⚠️ خمسةُ نداءاتٍ في لحظةٍ واحدةٍ تصير طلبا واحدا على الخادم', () => {
    /* هذا هو العطبُ بعينه: حارسُ المسار وإطارُ البوّابة ولوحُ البحث وجرسُ
       الإشعارات واللوحةُ ينطلق كلٌّ منها في اللحظة نفسِها — قبل أن يعود
       جوابٌ يُحفظ. فالحفظُ وحدَه لا يكفي: لا بدّ من ضمّ الطائر. */
    return load().then(async ({ me, calls }) => {
      const five = await Promise.all([me.fetchMe(), me.fetchMe(), me.fetchMe(), me.fetchMe(), me.fetchMe()])
      expect(calls.n, 'كلُّ مكوّنٍ ينادي الخادمَ لنفسه').toBe(1)
      for (const r of five) expect(r.user?.displayName).toBe('سهيب')
    })
  })

  it('⚠️ والجوابُ يُعاد استعمالُه ثوانيَ ثمّ يسقط — فلا يبقى دورٌ مسحوبٌ معروضا', async () => {
    const { me, calls } = await load()
    let clock = 1_000_000
    me.__setClock(() => clock)
    await me.fetchMe()
    expect(calls.n).toBe(1)
    clock += me.ME_FRESH_MS - 1
    await me.fetchMe()
    expect(calls.n, 'نُودي الخادمُ والجوابُ ما زال طازجا').toBe(1)
    clock += 2
    await me.fetchMe()
    expect(calls.n, 'بقي الجوابُ مستعمَلا بعد انتهاء صلاحيته').toBe(2)
    me.__setClock(() => Date.now())
  })

  it('⚠️ والخروجُ يُنسي المحفوظَ — وإلّا رُئي الخارجُ داخلا', async () => {
    const { me, calls } = await load()
    await me.fetchMe()
    me.forgetMe()
    await me.fetchMe()
    expect(calls.n, 'بقي الجوابُ بعد الخروج').toBe(2)
    expect(me.freshMe()).not.toBeNull()
    me.forgetMe()
    expect(me.freshMe(), 'لم يُنسَ شيء').toBeNull()
  })

  it('والسقوطُ لا يُحفظ: انقطاعُ شبكةٍ ليس جوابا عن «من أنت؟»', async () => {
    vi.resetModules()
    let fail = true
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (fail) throw new Error('offline')
      return { ok: true, json: async () => ({ user: null }) } as unknown as Response
    }))
    const me = await import('@/services/me')
    me.forgetMe()
    await expect(me.fetchMe()).rejects.toThrow()
    expect(me.freshMe(), 'حُفظ السقوطُ جوابا').toBeNull()
    fail = false
    await expect(me.fetchMe()).resolves.toMatchObject({ user: null })
  })

  it('⚠️ والدخولُ يُنسي المحفوظَ — وإلّا ردَّ الحارسُ الداخلَ إلى شاشة الدخول', () => {
    /* الزائرُ يفتح الصفحةَ العامّةَ فيُحفظ «لا جلسة»، ثمّ يدخل في الثانية
       نفسِها: لولا النسيانُ هنا لقرأ حارسُ المسار المحفوظَ القديم. */
    const auth = code('src/services/auth.ts')
    const signInBody = auth.slice(auth.indexOf('export async function signIn'))
      .slice(0, auth.slice(auth.indexOf('export async function signIn')).indexOf('export async function signOut'))
    expect(signInBody, 'الدخولُ لا يُنسي جوابَ «من أنت؟» المحفوظ').toContain('forgetMe()')
  })

  it('وحارسُ المسار وخطّافُ الجلسة كلاهما يمرّ بالنداء المشترك', () => {
    const auth = code('src/services/auth.ts')
    const session = code('src/services/session.ts')
    expect(auth, 'الحارسُ عاد ينادي الخادمَ لنفسه').not.toContain('"/api/auth/me"')
    expect(session, 'الخطّافُ عاد ينادي الخادمَ لنفسه').not.toContain('"/api/auth/me"')
    expect(auth).toContain('fetchMe')
    expect(session).toContain('fetchMe')
    expect(auth, 'الخروجُ لا يُنسي المحفوظ').toContain('forgetMe')
  })
})

describe('الخروجُ من ترويسة الموقع العامّ', () => {
  it('⚠️ فلا يلزم دخولُ البوّابة أوّلا ثمّ الخروجُ منها', () => {
    const shell = code('src/components/SiteShell.tsx')
    expect(shell, 'لا تُستورَد قائمةُ الحساب').toMatch(/import SiteAccountMenu from/)
    expect(shell, 'اسمُ الداخل ما زال رابطا وحدَه').toMatch(/<SiteAccountMenu[\s/>]/)
    expect(shell, 'الخروجُ غائبٌ عن قائمة الجوّال').toContain('signOut')
  })

  it('والقائمةُ تنادي الخادمَ ثمّ تُبدّل الترويسة — لا العكس', () => {
    const menu = code('src/components/SiteAccountMenu.tsx')
    expect(menu).toMatch(/await signOut\(\)/)
    /* الترتيبُ شرط: لو بُدّلت الترويسةُ أوّلا قيل له «خرجت» والكوكي حيّ */
    expect(menu.indexOf('await signOut()')).toBeLessThan(menu.indexOf('onSignedOut()'))
    expect(menu, 'لا بابَ إلى البوّابة من القائمة').toContain('portalHome')
  })
})
