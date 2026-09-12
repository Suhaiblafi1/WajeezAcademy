/* حارسُ سكربت النشر الحقيقيّ — `deploy/deploy.sh`.

   خلَف `deploy-pipeline.test.ts` الذي حُرس به سكربتا Cloudways. وقد حُذفا
   لأنّه لم يوجد خادمُ Cloudways قطّ: `SSH_HOST` لم يُضبط في المستودَع مرّةً
   واحدة، وتسعُ نشراتٍ آليّةٍ لم تنجح منها واحدة. أمّا الخطواتُ التي كان
   يحرسها فليست خاصّةً بمضيف — **نسيانُ أيٍّ منها يكسر شيئا صامتا على أيّ
   خادم**، فانتقل الحارسُ إلى السكربت الذي يُشغَّل فعلا.

   ولماذا يُقرأ نصُّ السكربت لا يُشغَّل: تشغيلُه يلزمه Docker وخادمٌ وقاعدة.
   والمقصودُ هنا أضيقُ وأرخص: ألّا تسقط خطوةٌ من الملفّ بتحريرٍ لاحق. وهذا
   ما يُقاس بالقراءة.

   ⚠️ وحدودُ هذا الحارس صريحةٌ لئلّا يُطمأنّ إليه أكثرَ ممّا يستحقّ: يُثبت
   أنّ الأمرَ مكتوبٌ في الملفّ، ولا يُثبت أنّه نجح على الخادم. وهذا بعينه
   عطبُ `htaccess-spa-rewrite.test.ts`: كان يقرأ نصَّ `.htaccess` ويَخضَرّ،
   والخادمُ يقدّم بـCaddy الذي لا يقرؤه أصلا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..')
const sh = readFileSync(join(root, 'deploy/deploy.sh'), 'utf8')

/** بلا التعليقات — فذِكرُ الأمر في شرحٍ ليس تنفيذا له */
const code = (s: string) => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

/* ولا الرسائلُ كذلك: `echo "جرّب: restart caddy"` نصيحةٌ للمشغّل لا أمرٌ
   يُنفَّذ. وقد مرّ حارسُ إعادةِ التحميل خضراءَ على نصيحةٍ كهذه قبل أن
   يُشدَّ — فيُقصَر الفحصُ على ما يُنفَّذ فعلا. */
const commands = (s: string) =>
  code(s).split('\n').filter((l) => !/^\s*(echo|printf)\b/.test(l)).join('\n')

describe('سكربتُ النشر الحقيقيّ — deploy/deploy.sh', () => {
  it('يتوقّف عند أوّل فشل — لا يمضي على خطوةٍ سقطت', () => {
    expect(sh).toMatch(/set -euo pipefail/)
  })

  /* ── الخطواتُ التي يكسر نسيانُها شيئا صامتا ── */

  it('ينشر ترحيلاتِ القاعدة — وبدونها تسقط مساراتُ الخادم بـ٥٠٠ على أعمدةٍ غيرِ موجودة', () => {
    expect(code(sh)).toMatch(/prisma migrate deploy/)
  })

  it('⚠️ يستورد الكتالوج — وبدونه يصل كودٌ جديدٌ فوق محتوًى قديمٍ لا يتغيّر', () => {
    /* `‎/api/public/core-catalog` يقرأ الجداولَ الحيّة لا ملفّات المستودَع.
       وهذا أحدُ وجهَي شكوى «الموقعُ القديمُ يتصدّر». */
    expect(code(sh)).toMatch(/catalog:import/)
  })

  it('⚠️ ينشر لقطةَ التشخيص — وبدونها يتجمّد المحرّك على لقطته القديمة', () => {
    expect(code(sh)).toMatch(/catalog:publish/)
  })

  it('يبني الصورةَ قبل لمس ما يعمل — ففشلُ البناء لا يُسقط الموقعَ القائم', () => {
    const build = code(sh).indexOf('build app')
    const up = code(sh).indexOf('up -d --remove-orphans')
    expect(build, 'أمرُ البناء غائب').toBeGreaterThan(-1)
    expect(up, 'أمرُ التبديل غائب').toBeGreaterThan(-1)
    expect(build, 'البناءُ يجب أن يسبق تبديلَ الحاويات').toBeLessThan(up)
  })

  it('يبدّل الحاويات فعلا — فالصورةُ المبنيّةُ بلا تبديلٍ لا تخدم أحدا', () => {
    expect(code(sh)).toMatch(/up -d --remove-orphans/)
  })

  it('يتحقّق بعد النشر من ‎/api/version لا من رجوع الأوامر بصفر', () => {
    expect(code(sh)).toMatch(/api\/version/)
  })

  it('يقرأ إعدادَه من deploy/ لا من مسارٍ خارج المستودَع', () => {
    expect(code(sh)).toMatch(/deploy\/compose\.prod\.yml/)
    expect(code(sh)).toMatch(/deploy\/\.env\.production/)
  })

  /* ═══ العطبُ الذي كُتب له الحارسان التاليان ═══

     `Caddyfile` مربوطٌ لا مبنيّ، و`up -d` لا يُبدّل حاويةً إلا إن تغيّر
     **وصفُها** — وتحريرُ ملفٍّ مربوطٍ ليس تغييرا في الوصف. وCaddy يقرأ
     إعدادَه عند الإقلاع ولا يراقب الملفّ.

     فبقي `frame-src https://calendly.com` أربعةَ أيّامٍ في المستودَع لا في
     الترويسة، وبقي إطارُ الحجز مستطيلا أبيضَ للمتقدّمين. ولم يكشفه حارسٌ:
     الحارسُ القائم يقرأ `deploy/Caddyfile` — أي النيّةَ لا ما أُرسل. */

  it('⚠️ يعيد تحميلَ Caddy بعد التبديل — فالملفُّ المربوطُ لا يُقرأ بنفسه', () => {
    /* على ما يُنفَّذ لا على ما يُطبَع: النصيحةُ في رسالة خطأٍ ليست إعادةَ تحميل */
    const c = commands(sh)
    expect(c, 'لا إعادةَ تحميلٍ ولا إعادةَ تشغيل — تعديلُ السياسة يبقى على القرص بلا أثر')
      .toMatch(/caddy reload|restart caddy/)
    /* وبعد التبديل لا قبلَه: إعادةُ تحميلٍ ثمّ `up -d` تُلغيها الحاويةُ الجديدة */
    const up = c.indexOf('up -d --remove-orphans')
    const reload = Math.max(c.indexOf('caddy reload'), c.indexOf('restart caddy'))
    expect(up, 'أمرُ التبديل غائب').toBeGreaterThan(-1)
    expect(reload, 'إعادةُ التحميل يجب أن تلي تبديلَ الحاويات').toBeGreaterThan(up)
  })

  it('⚠️ يفحص الترويسةَ كما أُرسلت لا كما كُتبت — وإلّا اختبأ الفرقُ بينهما', () => {
    const c = code(sh)
    /* الفحصُ على الخادم الحيّ: `-I` يقرأ الترويسةَ وحدَها، والبحثُ فيها عن
       `frame-src` لـCalendly. وهذا ما كان غائبا فمرّ العطبُ صامتا. */
    expect(c, 'لا يُقرأ ترويسةَ الخادم الحيّ').toMatch(/curl[^\n]*-[a-zA-Z]*I[^\n]*SITE_DOMAIN/)
    expect(c, 'لا يفحص frame-src في المُرسَل').toMatch(/frame-src\*calendly\.com|frame-src[^\n]*calendly\.com/)
  })
})
