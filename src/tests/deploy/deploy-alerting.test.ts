/* تنبيهُ فشلِ النشر — حارسُ ما يبدو مضبوطا وهو لا يعمل.

   ═══ العطبُ الذي كُتب له ═══

   في ٢٠ سبتمبر ٢٠٢٦ فشلت نشرةُ الإنتاج **اثنتي عشرة ساعةً**: يحاول المراقبُ
   كلَّ دقيقةٍ فيردّه حارسُ ما قبل النشر (`BANK_ENC_KEY` غيرُ مضبوط)، ويكتب
   `✖` في `~/wajeez-deploy.log`. ولا أحدَ يقرأ سجلّا على خادم. فبقي الموقعُ
   يخدم بناءً قديما، ووصلت رسالةُ وقفِ حجز المقابلات إلى `main` ولم تبلغ
   متقدّما واحدا نصفَ يوم — ولم يُعلَم إلّا بالسؤال.

   ═══ ولماذا لم تُنقذه المراقبةُ الموجودة ═══

   `ping_monitor` كانت مكتوبةً ومركَّبةً في أربعة مواضعَ صحيحة — ومنها
   `/fail` فورَ الفشل. لكنّها تقرأ `WAJEEZ_PING_URL` من **بيئة الصدفة**،
   وسطرُ الجدولة `* * * * * /bin/bash …` لا يحمل بيئةً أصلا. فمن ضبط العنوانَ
   حيث يُضبط كلُّ شيءٍ آخر (`deploy/.env.production`) لم يصل إلى المراقب منه
   شيء: تخرج الدالّةُ صفرا في كلّ دورة.

   فالمراقبةُ كانت «مفعَّلةً» في ملفّ الإعداد وصامتةً في الواقع — وهو أسوأُ
   من غيابها: من يظنّ عنده إنذارا لا يفتح السجلّ.

   ═══ وما يُقاس هنا ═══

   ① **أنّ العنوان يُقرأ من ملفّ الإنتاج** لا من بيئة الصدفة وحدَها.
   ② **وأنّ الملفَّ لا يُصدَّر كلُّه** — فيه كلمةُ القاعدة ومفتاحُ تعميةِ
      الحسابات البنكيّة، ولا حاجةَ للمراقب بهما.
   ③ **وأنّ سطرا معلَّقا لا يُقرأ قيمةً** — والمثالُ يشحنه معلَّقا، فلولا
      هذا لَظنّ المراقبُ نفسَه مضبوطا بـ`https://hc-ping.com/<المعرّف>`.
   ④ **وأنّ الفشلَ يُنادي `/fail`** — لا ينتظر انقطاعَ الخبر. */

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const watcher = read('scripts/deploy-watch.sh')
/** بلا تعليقاتٍ — فشرحٌ يذكر الملفَّ ليس قراءةً له */
const code = watcher.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

describe('عنوانُ النبضة يصل المراقبَ فعلا', () => {
  it('⚠️ يُقرأ من deploy/.env.production — لا من بيئة الصدفة وحدَها', () => {
    /* لأنّ cron لا يورّث بيئةً: سطرُ الجدولة `/bin/bash <السكربت>` عاريا */
    expect(code, 'المراقبُ لا يقرأ العنوانَ من ملفّ الإنتاج — فالجدولةُ تُفقده')
      .toMatch(/WAJEEZ_PING_URL=' .*deploy\/\.env\.production|deploy\/\.env\.production/)
    expect(code, 'لا يُنتزع المفتاحُ من الملفّ').toMatch(/WAJEEZ_PING_URL=/)
  })

  it('⚠️ ولا يُصدَّر الملفُّ كلُّه — فيه أسرارٌ لا حاجةَ للمراقب بها', () => {
    /* `set -a; source deploy/.env.production` يضع كلمةَ القاعدة ومفتاحَ
       تعميةِ الحسابات البنكيّة في بيئة كلِّ ما يُشغَّل بعدها. */
    expect(code, 'صُدِّر ملفُّ الأسرار كلُّه إلى بيئة المراقب').not.toMatch(/set -a/)
    expect(code, 'مُصدِّرَ الملفُّ بـsource').not.toMatch(/(^|\n)\s*(source|\.)\s+[^\n]*env\.production/)
  })

  it('⚠️ والفشلُ يُنادي /fail فورا — لا ينتظر انقطاعَ الخبر', () => {
    expect(code, 'ذهب نداءُ الفشل — فلا يُعلَم بالفشل إلّا بعد مهلة')
      .toMatch(/ping_monitor \/fail/)
  })
})

describe('ودلالةُ الانتزاع نفسِها — تُجرَّب لا تُفترَض', () => {
  /** ينتزع بالتعبير نفسِه الذي في السكربت، على ملفٍّ مصطنَع */
  const extract = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'wajeez-ping-'))
    mkdirSync(join(dir, 'deploy'), { recursive: true })
    writeFileSync(join(dir, 'deploy/.env.production'), body, 'utf8')
    const cmd = `grep -E '^[[:space:]]*WAJEEZ_PING_URL=' "${dir}/deploy/.env.production" `
      + `2>/dev/null | tail -1 | cut -d= -f2- | tr -d '[:space:]' || true`
    return execFileSync('bash', ['-c', cmd], { encoding: 'utf8' }).trim()
  }

  it('يُنتزع العنوانُ المضبوط', () => {
    expect(extract('SITE_DOMAIN=x\nWAJEEZ_PING_URL=https://hc-ping.com/abc\nBANK_ENC_KEY=y\n'))
      .toBe('https://hc-ping.com/abc')
  })

  it('⚠️ وسطرٌ معلَّقٌ لا يُقرأ قيمةً — والمثالُ يشحنه معلَّقا', () => {
    /* لولا هذا لَظنّ المراقبُ نفسَه مضبوطا على `<المعرّف>` الحرفيّ،
       فيبثّ إلى عنوانٍ لا وجودَ له ويحسب نفسَه مُنذِرا. */
    expect(extract('# WAJEEZ_PING_URL=https://hc-ping.com/<id>\n')).toBe('')
    expect(extract('   # WAJEEZ_PING_URL=https://hc-ping.com/<id>\n')).toBe('')
  })

  it('وغيابُ السطر فراغٌ لا خطأ — فلا تسقط الدورةُ لأنّ المراقبةَ غيرُ مضبوطة', () => {
    /* «مراقبةٌ تُسقط نشرةً ناجحةً أسوأُ من لا مراقبة» — من رأس السكربت */
    expect(extract('SITE_DOMAIN=x\n')).toBe('')
    expect(extract('')).toBe('')
  })

  it('وتُجرَّد المسافاتُ، ويغلب آخرُ سطرٍ عند التكرار', () => {
    expect(extract('WAJEEZ_PING_URL=  https://a/1  \n')).toBe('https://a/1')
    expect(extract('WAJEEZ_PING_URL=https://a/1\nWAJEEZ_PING_URL=https://a/2\n')).toBe('https://a/2')
  })
})

describe('والتركيبُ يقول حالَ التنبيه بدل أن يُترك ليُكتشف بعد فشل', () => {
  const installer = read('scripts/install-auto-deploy.sh')

  it('⚠️ يقيس الضبطَ ولا يقول «لا تنبيهَ بعد» على كلّ حال', () => {
    /* كان سطرا ثابتا. وصار التنبيهُ ممكنا — فيُقاس ويُقال في الحالين. */
    expect(installer, 'المثبّتُ لا يقرأ حالَ التنبيه').toContain('WAJEEZ_PING_URL=')
    expect(installer, 'لا يُقال للمشغّل كيف يُفعّله').toContain('healthchecks.io')
  })

  it('ويُسمّي الملفَّ الذي يُضبط فيه — فلا يُبحث عنه', () => {
    expect(installer).toContain('deploy/.env.production')
  })
})

describe('والمثالُ يوثّق المفتاحَ — فما لا يُذكر فيه لا يُضبط', () => {
  const example = read('deploy/.env.production.example')

  it('⚠️ يذكر WAJEEZ_PING_URL وسببَه', () => {
    expect(example, 'المفتاحُ غيرُ موثَّقٍ — فلا يعرف المشغّلُ أنّه موجود')
      .toContain('WAJEEZ_PING_URL')
    expect(example, 'لا يُقال ماذا يقع بلا ضبطِه').toMatch(/صامتا|صامت/)
  })

  it('ويُشحن معلَّقا لا مضبوطا على عنوانٍ وهميّ', () => {
    const line = example.split('\n').find((l) => l.includes('WAJEEZ_PING_URL='))
    expect(line, 'السطرُ مفقود').toBeTruthy()
    expect(line!.trim().startsWith('#'), 'يُشحن مضبوطا على عنوانٍ لا وجودَ له').toBe(true)
  })
})

describe('وحالُ الجرس يُقال حيث يُنظَر — لا في سجلٍّ على خادم', () => {
  /* السجلُّ لا يُفتح إلّا بعد أن يُشَكّ، وشاشةُ «صحّة النظام» تُفتح. ولهذا
     صار السطرُ فيها. وسلوكُه محروسٌ بقاعدةٍ حقيقيّة في
     `server/tests/audit/deployment-health.test.ts`؛ وهذا يحرس وجودَه. */
  const health = read('server/services/system-health.service.ts')

  it('⚠️ سطرُ التنبيه موجودٌ في صحّة النظام', () => {
    expect(health, 'لا سطرَ يقول إنّ الجرسَ مطفأ').toContain("key: 'deploy_alerting'")
    expect(health, 'لا يقرأ العنوانَ من بيئة الحاوية').toContain('WAJEEZ_PING_URL')
  })

  it('⚠️ والفراغُ كالغياب — فلا يُطفأ الجرسُ بسطرٍ فارغ', () => {
    /* `WAJEEZ_PING_URL=` يُقرأ سلسلةً فارغة، و`Boolean('')` كاذب — لكنّ
       مسافاتٍ تُقرأ صدقا لولا `trim()`. */
    expect(health, 'لا تُجرَّد المسافاتُ — فسطرٌ من فراغٍ يُقرأ ضبطا')
      .toMatch(/WAJEEZ_PING_URL\?\.trim\(\)/)
  })

  it('ولا يحمرّ حمرةَ المعطَّل — الموقعُ يعمل، والمطفأُ هو الجرس', () => {
    const row = health.slice(health.indexOf("key: 'deploy_alerting'"), health.indexOf("key: 'built_site_origin'"))
    expect(row, 'أُعطي حمرةَ المعطَّل — وحاجزٌ أحمرُ على ما لا يمنع أحدا يُعلّم تجاهلَ الأحمر')
      .not.toMatch(/level:[^\n]*'broken'/)
    expect(row, 'لا يُسمّى الملفُّ الذي يُضبط فيه').toContain('deploy/.env.production')
  })
})
