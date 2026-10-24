/* روابطُ الإدارة التي يكتبها الخادم — في بريدٍ أو جرسٍ أو بحثٍ أو «ما ينتظرك» — تفتح شاشةً قائمة (٢٤ أكتوبر ٢٠٢٦).

   ═══ ما وُجد ═══

   زرُّ رسالة «حجز فلانٌ مقابلته» — تصل المُقابِلين مع ملفّ المتقدّم — كان يفتح `/admin/trainer-applications`،
   وسطرُ الملفّ المطبوع يقوله كذلك. ولا شاشةَ بهذا العنوان منذ صارت «طلبات المدربين» `/admin/trainers`: فكان
   المُقابِلُ يضغط الزرَّ إلى لوحةٍ لا خبرَ فيها. ولم يحمرّ شيء — حارسُ الوجهات (`destinations.ts`) يقابل جدولَ
   الإشعارات وحدَه بمسارات `App.tsx`، وهذا الرابطُ مكتوبٌ في خدمةٍ بنصّه.

   ═══ وما يُحرس ═══

   كلُّ مسارِ إدارةٍ مكتوبٍ في شيفرة الخادم نصّا — بعد علامة اقتباسٍ أو بعد `}` (عنوانُ الموقع قبله) — له
   شاشةٌ في `App.tsx`، هو أو ما تحته. والتعليقاتُ لا تُقرأ: ذِكرُ عنوانٍ قديمٍ في شرحٍ يقول ما كان ليس رابطا. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const APP = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const ROUTES = [...APP.matchAll(/<Route path="(\/admin[^"]*)"/g)].map((m) => m[1])

const serverFiles = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'tests' && name !== 'node_modules') serverFiles(full, out)
    } else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

const code = (f: string) => readFileSync(f, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

/** كلُّ مسار إدارةٍ مكتوبٍ رابطا — وأين كُتب */
function adminLinks(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const f of serverFiles(join(root, 'server'))) {
    for (const m of code(f).matchAll(/(?<=[`'"}])(\/admin\/[a-z][a-z0-9-]*)/g)) {
      out.set(m[1], [...(out.get(m[1]) ?? []), relative(root, f)])
    }
  }
  return out
}

describe('روابط الإدارة من الخادم', () => {
  const links = adminLinks()

  it('المسح يقرأ فعلا — وإلّا مرّ كلّ شيء بصفر', () => {
    expect(ROUTES.length, 'لم تقرأ مسارات الإدارة من App.tsx').toBeGreaterThan(20)
    expect(links.size, 'لم يعثر على رابط إدارة في الخادم').toBeGreaterThan(10)
    /* وشرطُ صحّة القراءة: رابطُ ملفّ المقابلة — المكتوبُ بعد عنوان الموقع — يُقرأ */
    expect(links.get('/admin/trainers'), 'لم يقرأ الرابط المكتوب بعد عنوان الموقع')
      .toContain('server/services/trainer-dossier.service.ts')
  })

  it('⚠️ ولا رابط إلى شاشة لا وجود لها', () => {
    const dead = [...links.entries()]
      .filter(([path]) => !ROUTES.some((r) => r === path || r.startsWith(`${path}/`)))
      .map(([path, files]) => `${path} ← ${[...new Set(files)].join(' · ')}`)
    expect(dead, `روابط إلى شاشة لا وجود لها:\n${dead.join('\n')}`).toEqual([])
  })
})
