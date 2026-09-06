/* عميلُ التطبيق يُمرَّر — ولا يُلتقَط عميلٌ محيطيٌّ في مسار طلب.
 *
 * ── العطبُ الذي وقع، ولماذا لم يُمسَك ──
 *
 * `/api/auth/me` أضافت حالةَ قناة البريد، فقرأتها بعميل `db/client` المحيطيّ.
 * وذاك يقرأ `DATABASE_URL`، وهي غيرُ مضبوطةٍ في جولة الاختبار — فيهبط إلى
 * PostgreSQL المدمجة على قاعدة `wajeez`، **وقاعدةُ الاختبار `wajeez_test`**.
 * والترحيلاتُ (`prisma migrate deploy`) تُنشَر على الثانية وحدَها؛ أمّا
 * `ensureEmbeddedPostgres` فتُنشئ الأولى ولا ترحّل فيها شيئا.
 *
 * فالنتيجةُ تختلف باختلاف الجهاز لا باختلاف الشيفرة: على جهاز مطوّرٍ عمل
 * على القاعدة من قبلُ تكون الجداولُ موجودةً فيمرّ كلُّ شيء؛ وفي CI —
 * حيث `.pgdata/` تُبنى نظيفةً — لا جدولَ واحد، فيُرمى الاستعلامُ ويردّ
 * المسارُ بـ500، ويقرأ الاختبارُ `me.json().user` فيجده `undefined`.
 *
 * ثلاثةُ اختباراتٍ سقطت بهذا في CI **وهي خضراءُ محلّيّا في سبع جولات**،
 * وشُخِّصت ثلاثَ مرّاتٍ خطأً (حسابٌ محذوف · تلوّثٌ بين ملفّات · أرشفةٌ
 * تسرّبت) لأنّ الرسالةَ لا تدلّ على سببها.
 *
 * ── ولماذا الحارسُ نصّيّ ──
 *
 * لأنّ العطبَ **لا يظهر حيث يُكتب**: الشيفرةُ صحيحةُ الأنواع، وتمرّ محلّيّا،
 * ولا تسقط إلّا في بيئةٍ نظيفة. فما يُحرَس هو القاعدةُ نفسُها: مسارُ طلبٍ
 * يأخذ عميلَه ممّن بناه، لا من المحيط. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const HTTP = join(root, 'server', 'http')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('مساراتُ HTTP تأخذ عميلَها ممّن بناها', () => {
  const files = walk(HTTP)

  it('المسحُ يقرأ الشجرةَ فعلا — فلا يخضرّ الحارسُ بصفرٍ كاذب', () => {
    expect(files.length, 'لم يُقرأ أيُّ ملفّ — تعطّل المسحُ نفسُه').toBeGreaterThan(20)
    expect(files.map((f) => relative(root, f))).toContain('server/http/routes/auth.routes.ts')
  })

  it('ولا ملفَّ فيها يستورد العميلَ المحيطيّ من `db/client`', () => {
    const offenders = files
      .filter((f) => /from\s+['"][^'"]*db\/client['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f))
    expect(
      offenders,
      'مسارُ طلبٍ يلتقط عميلا محيطيّا: يقرأ قاعدةً أخرى في الاختبار (wajeez لا wajeez_test)،\n'
      + 'ويفتح بركةَ اتّصالاتٍ ثانيةً في الإنتاج. مرّره من `buildApp` بدلا منه.\n'
      + offenders.join('\n'),
    ).toEqual([])
  })
})
