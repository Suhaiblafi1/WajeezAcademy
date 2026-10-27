/* أزرارُ تعيين الأدوار في «المستخدمون» تتبع أدوارَ الخادم (٢٧ أكتوبر ٢٠٢٦).

   كان «مؤثر» دورا في الخادم وغائبا عن الأزرار، والشاشةُ ترسل القائمةَ كاملةً في كلّ حفظ — فحفظُ أدوار مؤثّرٍ
   من هنا كان ينزع دورَه بصمت ويردّه إلى بوّابة المتعلّم. قال صاحبُ المنصّة: «أضف دور مؤثر لكي لا تختلط الأمور
   مع منصة الطالب». فكلُّ دورٍ في الخادم زرٌّ هنا، إلّا أدوارَ الحالة (`LIFECYCLE_ROLES`) التي لا تُسند من هنا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIFECYCLE_ROLES, ROLE_PERMISSIONS } from '../../../server/auth/permissions'

const page = readFileSync(join(process.cwd(), 'src/pages/admin/Users.tsx'), 'utf8')
/** مفاتيحُ `ROLE_NAMES_AR` في الشاشة — من جسم الكائن لا من ورود الكلمة في الملفّ */
function buttonRoles(): string[] {
  const start = page.indexOf('const ROLE_NAMES_AR: Record<string, string> = {')
  const body = page.slice(start, page.indexOf('\n};', start)).replace(/\/\*[\s\S]*?\*\//g, '')
  return [...body.matchAll(/(\w+): "/g)].map((m) => m[1])
}

describe('أزرار الأدوار', () => {
  it('⚠️ كل دور في الخادم زر في «المستخدمون» — إلا أدوار الحالة', () => {
    const lifecycle = LIFECYCLE_ROLES as readonly string[]
    const server = Object.keys(ROLE_PERMISSIONS).filter((r) => !lifecycle.includes(r))
    expect(buttonRoles().sort()).toEqual(server.sort())
  })
  it('⚠️ و«مؤثر» بينها', () => {
    expect(buttonRoles()).toContain('influencer')
    expect(page).toMatch(/influencer: "مؤثر",/)
  })
})
