/* لكلّ بوّابةٍ بابُ خروج.

   العطب الذي وُلد منه هذا الحارس: بوّابات العاملين الثلاث — الإدارة
   والتدريب والاستشارة — كانت تعرض اسمَ الداخل نصّا في الترويسة، بلا قائمة
   حسابٍ ولا زرِّ خروج. فمن دخل بحسابٍ إداريّ لم يجد سبيلا للخروج منه:
   ولا حتى نداءً بالعنوان، لأنّ `/api/auth/logout` من نوع POST لا GET.
   فبقي الحلُّ الوحيد مسحَ ملفّات الارتباط من إعدادات المتصفّح.

   وهذا خطرٌ لا نقصُ راحة: الحساب الذي يفتح الشعب ويرى الفواتير ويحذف
   الطلبات يبقى مفتوحا على جهازٍ مشترك. والمتعلّم — وهو أقلُّ الحسابات
   خطرا — كان وحده من له قائمةُ حسابٍ فيها خروج.

   والحارسُ بنيويّ: كلُّ إطارِ بوّابةٍ يجب أن يركّب `StaffAccountMenu`،
   والقائمةُ يجب أن تُنادي `signOut` وتنتظره قبل التنقّل. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const MENU = 'src/components/StaffAccountMenu.tsx'
const LAYOUTS = [
  ['لوحة الإدارة', 'src/pages/admin/AdminLayout.tsx'],
  ['بوّابة المدرّب', 'src/pages/trainer/TrainerLayout.tsx'],
  ['بوّابة المستشار', 'src/pages/advisor/AdvisorLayout.tsx'],
  ['بوّابة المتعلّم', 'src/pages/student/PortalLayout.tsx'],
] as const

describe('لا بوّابةَ بلا باب خروج', () => {
  it('١) كلّ بوّابةٍ فيها خروجٌ يُنقَر', () => {
    for (const [name, path] of LAYOUTS) {
      const src = read(path)
      const hasMenu = src.includes('<StaffAccountMenu')
      const hasOwnSignOut = src.includes('signOut(')
      expect(hasMenu || hasOwnSignOut, `${name} بلا زرّ خروج — الداخل لا يستطيع الخروج`).toBe(true)
    }
  })

  it('٢) القائمة تُنادي الخادم فعلا — لا تمسح نسخةً محلّية وتدّعي', () => {
    const src = read(MENU)
    expect(src, 'القائمة لا تنادي signOut').toContain("import { signOut } from '@/services/auth'")
    /* الانتظار قبل التنقّل: بلا `await` يسبق التنقّلُ المسحَ فيعود الداخل
       داخلا وهو يظنّ أنّه خرج — وهو عطبٌ وقع في بوّابة المتعلّم من قبل. */
    expect(src, 'التنقّل يسبق مسحَ الجلسة').toMatch(/await signOut\(\)\s*\n\s*navigate\(/)
  })

  it('٣) والقائمة تقول من أنت وبأيّ أدوار — لا اسما وحده', () => {
    const src = read(MENU)
    expect(src, 'البريد لا يُعرض').toContain('user?.email')
    expect(src, 'الأدوار لا تُعرض — فالإداريّ يصطدم بالمنع ولا يعرف لماذا').toContain('user?.roles')
    expect(src, 'رابط صفحة الحساب مفقود').toContain('to="/student/account"')
  })

  it('٤) و`signOut` نفسُها تنادي مسلك الخادم', () => {
    const auth = read('src/services/auth.ts')
    expect(auth).toMatch(/export async function signOut[\s\S]{0,200}apiPost\(["']\/api\/auth\/logout["']\)/)
  })
})
