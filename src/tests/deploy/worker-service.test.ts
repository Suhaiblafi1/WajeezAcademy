/* العاملُ الخلفيُّ في منظومة الإنتاج — حارسُ وجودٍ لا حارسُ سلوك.

   سلوكُ الوظائف محروسٌ في `server/tests/worker/jobs.test.ts` بقاعدةٍ حقيقيّة.
   وما يُحرَس هنا شيءٌ آخر: **أن يوجد من يشغّلها أصلا**. فقد كُتب العاملُ
   كاملا ومُختبَرا وبقي سنةً لا يعمل — لأنّ أحدا لم يضع له خدمةً في منظومة
   الإنتاج. وعطبٌ كهذا لا يُحمّر شيئا: الاختباراتُ خضراء، والموقعُ يعمل،
   والطابورُ وحدَه يمتلئ في صمت.

   ولو حُذفت الخدمةُ غدا لعاد العطبُ كما كان بلا إشارة. فهذا حارسُ الغياب. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const compose = readFileSync(join(root, 'deploy/compose.prod.yml'), 'utf8')

/** بلا التعليقات — فذِكرُ خدمةٍ في شرحٍ ليس تعريفا لها */
const code = compose.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

describe('خدمةُ العامل في منظومة الإنتاج', () => {
  it('معرَّفةٌ — وبدونها كلُّ «سنُعلمك» في الواجهة وعدٌ لا يُنفَّذ', () => {
    expect(code).toMatch(/^ {2}worker:/m)
  })

  it('وتُشغّل مُشغِّلَ العامل نفسَه', () => {
    expect(code).toMatch(/server\/worker\/index\.ts/)
  })

  it('وبالعلم الصريح — وبدونه تُقلع الحاويةُ وتخرج بنجاحٍ بلا أن تعمل شيئا', () => {
    expect(code, 'حاويةٌ تعمل ولا تعمل: أسوأُ من غيابها لأنّها تبدو قائمة')
      .toMatch(/WORKER_ENABLED:\s*"?on"?/)
  })

  it('وتتقاسم صورةَ الخادم بلا بناءٍ ثانٍ — فلا تفترق الشيفرتان', () => {
    /* `deploy.sh` يبني `app` وحدَه. فلو بَنت خدمةُ العامل صورتَها لبقيت على
       شيفرةِ أمسِ بلا أن يلاحظ أحد. */
    const images = [...code.matchAll(/image:\s*(\S+)/g)].map((m) => m[1])
    expect(images.filter((i) => i === 'wajeez-app:latest').length,
      'الخادمُ والعاملُ لا يشتركان في اسم صورةٍ واحد').toBe(2)
  })

  it('ولها سياقُ بناءٍ لا اسمُ صورةٍ وحدَه — وإلّا انكسر النشرُ على من لا يبني `app` أوّلا', () => {
    /* عطبٌ وقع فعلا: كُتبت الخدمةُ بـ`image:` بلا `build:`، على افتراض أنّ
       الناشرَ يبني `app` قبلها فتوجد الصورة. وذلك يصحّ مع `deploy/deploy.sh`
       وحدَه. أمّا ناشرٌ يفعل `docker compose pull` أو `up -d` بلا بناءٍ سابق
       فيبحث عن `wajeez-app:latest` في سجلٍّ لا وجودَ لها فيه — **فيسقط النشرُ
       كلُّه**، ويتوقّف الموقعُ عن استقبال أيّ تحديث. */
    const block = code.slice(code.indexOf('\n  worker:'))
    const mine = block.slice(0, block.indexOf('\n  caddy:'))
    expect(mine, 'اسمُ صورةٍ بلا سياقِ بناءٍ يعتمد على ترتيبٍ في ناشرٍ بعينه')
      .toMatch(/^\s+build:/m)
  })

  it('ولا تنشر منفذا ولا تواجه الإنترنت', () => {
    const block = code.slice(code.indexOf('\n  worker:'))
    const mine = block.slice(0, block.indexOf('\n  caddy:'))
    expect(mine, 'العاملُ لا يستقبل طلبا — منفذٌ منشورٌ سطحُ هجومٍ بلا مقابل')
      .not.toMatch(/^\s+ports:/m)
  })

  it('وفحصُ الصحّة مُطفأ — لا خادمَ ويبٍ فيها يُسأل', () => {
    const block = code.slice(code.indexOf('\n  worker:'))
    const mine = block.slice(0, block.indexOf('\n  caddy:'))
    expect(mine, 'حاويةٌ سليمةٌ تُعلَّم «غيرَ صحّيّة» تُرسل من يقرأ إلى عطلٍ لا وجودَ له')
      .toMatch(/disable:\s*true/)
  })

  it('ولا تُقلع قبل جاهزيّة القاعدة', () => {
    const block = code.slice(code.indexOf('\n  worker:'))
    const mine = block.slice(0, block.indexOf('\n  caddy:'))
    expect(mine).toMatch(/condition:\s*service_healthy/)
  })
})
