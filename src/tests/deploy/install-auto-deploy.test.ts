/* مركِّبُ النشر التلقائيّ — أمرٌ واحدٌ يُنفَّذ مرّةً على الخادم.

   ولماذا يُحرَس: هو الجسرُ الوحيدُ بين «دُمج في main» و«ظهر على الموقع».
   وقبله كان الجسرُ إنسانا يتذكّر — فبقي الموقعُ يعرض شيفرةَ أسابيعَ مضت
   وكلُّ الاختبارات خضراء.

   وحدُّه صريحٌ كحدِّ المراقب: يُثبت أنّ المركِّبَ مكتوبٌ كما يجب، **لا أنّ
   أحدا شغّله على الخادم**. وذاك لا يُقاس من المستودَع. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const p = join(root, 'scripts/install-auto-deploy.sh')
const src = existsSync(p) ? readFileSync(p, 'utf8') : ''

/** بلا التعليقات — فذِكرُ أمرٍ في شرحٍ ليس تنفيذا له */
const code = src.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

describe('مركِّبُ النشر التلقائيّ', () => {
  it('موجود', () => {
    expect(existsSync(p)).toBe(true)
  })

  it('يفحص قبل أن يركّب — ولا يترك النقصَ يظهر بعد أسبوع', () => {
    expect(code, 'ملفُّ البيئة: الناشرُ يقف عند أوّل سطرٍ بدونه').toMatch(/deploy\/\.env\.production/)
    expect(code, 'SITE_DOMAIN: منه يطلب Caddy الشهادة').toMatch(/SITE_DOMAIN/)
    expect(code, 'الفرع: خادمٌ على فرعٍ آخرَ لا يُسحَب إليه main').toMatch(/rev-parse --abbrev-ref HEAD/)
  })

  it('ويجرّب ببيئةٍ فقيرةٍ كبيئة cron لا ببيئة من يشغّله', () => {
    /* أكثرُ ما يُسقط مهمّةً مجدولة: لا وكيلَ SSH ولا PATH كامل. وفحصٌ بالبيئة
       الغنيّة يمرّ ثمّ تفشل الجدولةُ صامتةً كلَّ خمس دقائق. */
    expect(code).toMatch(/env -i/)
    expect(code, 'مسارٌ مقصوصٌ كمسار cron').toMatch(/PATH=\/usr\/bin:\/bin/)
    expect(code, 'وأنّ docker compose في ذلك المسار').toMatch(/docker compose version/)
  })

  it('وينشر مرّةً بعينِ من يركّب قبل أن يترك الأمرَ للجدولة', () => {
    expect(code).toMatch(/bash deploy\/deploy\.sh/)
  })

  it('ويركّب سطرَ الجدولة على المراقب لا على الناشر مباشرةً', () => {
    /* الناشرُ مباشرةً في cron يعيد النشرَ كلَّ خمس دقائق بلا داعٍ — والمراقبُ
       يسأل أوّلا فلا يفعل شيئا حين لا جديد. */
    expect(code).toMatch(/scripts\/deploy-watch\.sh/)
    expect(code).toMatch(/crontab -/)
    expect(code, 'لا سطرَ جدولةٍ في المركِّب').toMatch(/\*\/5 \* \* \* \*/)
  })

  it('وآمنُ الإعادة — تشغيلُه مرّتين لا يضع سطرَين', () => {
    expect(code, 'بلا فحصِ وجودٍ تتراكم الأسطرُ وتتزاحم النشرات').toMatch(/grep -qF/)
  })

  it('ويقف عند أوّل خطأٍ بدل أن يكمل على عطب', () => {
    expect(src).toMatch(/set -euo pipefail/)
  })
})
