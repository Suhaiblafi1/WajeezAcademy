/* `APP_URL` لا يُنشَر بدونه — وحارسُ ذلك يُشغَّل لا يُقرأ.

   ── العطبُ الذي يحرسه ──

   `publicSiteUrl()` يسقط إلى `http://localhost:7100` حين يغيب `APP_URL`. وهو
   الصوابُ في التطوير، وفي الإنتاج يعني شيئَين لا أثرَ لهما في سجلٍّ ولا
   اختبار: روابطُ الرسائل كلُّها (التوثيق · الدعوة · استعادةُ الكلمة) تصل
   بعنوانٍ لا يفتح عند أحد، وبوّابةُ الدفع تأخذ `success_url` وقتَ إنشاء
   الجلسة فيعود المشتري بعد دفعٍ **ناجحٍ** إلى `localhost` — والمالُ يُقبض
   والتسجيلُ يُسوّى لأنّ الـwebhook مستقلٌّ عن المتصفّح. صامتٌ عندنا صاخبٌ
   عند المشتري.

   وكان في `deploy.sh` فحصٌ لـ`SITE_DOMAIN` وحدَه، و`APP_URL` يمرّ بلا سؤال.

   ── ولمَ لا تُفحَص القيمةُ نفسُها هنا ──

   لأنّها تسكن `deploy/.env.production` على الخادم ولا تدخل Git أبدا («لا
   أسرارَ في Git مطلقا»). فـCI لا تراها ولا ينبغي أن تراها: نسخةٌ منها في
   أسرار GitHub تُضبط مرّةً ثمّ تتقادم بصمت، فتصير بوّابةً تقيس نسخةً لا
   الأصل — وهو أسوأُ من لا بوّابة.

   فالقياسُ هنا على **البوّابة** لا على القيمة: تُشغَّل `preflight-env.sh`
   فعلا على ملفّاتِ بيئةٍ مصطنعةٍ، ويُقرأ رقمُ خروجها. فإن حُذفت البوّابةُ أو
   عُطّلت أو كُتبت بحيث لا تسقط — حمرّ هذا. ولا يُطابَق نصٌّ في ملفّ: مرّ في
   هذه المنصّة ثلاثةُ حرّاسٍ خضراءَ لأنّهم طابقوا نصّا في تعليق. */

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PREFLIGHT = join(root, 'deploy/preflight-env.sh')

/** يكتب ملفَّ بيئةٍ مؤقّتا ويُشغّل البوّابةَ عليه — يعيد رقمَ الخروج ورسالتَه */
function runPreflight(contents: string): { code: number; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'wajeez-preflight-'))
  const file = join(dir, '.env.production')
  writeFileSync(file, contents)
  try {
    execFileSync('bash', [PREFLIGHT, file], { encoding: 'utf8', stdio: 'pipe' })
    return { code: 0, stderr: '' }
  } catch (e) {
    const err = e as { status?: number; stderr?: string }
    return { code: err.status ?? -1, stderr: err.stderr ?? '' }
  }
}

/* ملفٌّ سليمٌ يُشتقّ منه كلُّ حالةٍ بتغييرِ سطرٍ واحد — فما يُقاس هو المتغيّرُ
   وحدَه لا فرقٌ آخرُ تسلّل مع نصٍّ كُتب مرّتين */
/* و`BANK_ENC_KEY` دخل الإلزاميّاتِ مع المرحلة الرابعة: بلا مفتاحٍ لا
   يُحفَظ حسابٌ بنكيٌّ ولا يُصرَف مستحقّ (`bank-crypto.ts`). وقيمتُه هنا
   ٦٤ خانةً ستّ عشريّةً صالحةً — وإلّا لَسقط «ملفٌّ سليم» على صيغةٍ. */
const BANK_KEY = 'BANK_ENC_KEY=' + '0123456789abcdef'.repeat(4)
const COMPLETE = `SITE_DOMAIN=wajeezacademy.com\nAPP_URL=https://www.wajeezacademy.com\n${BANK_KEY}\n`

describe('لا نشرَ بلا APP_URL', () => {
  it('البوّابةُ تمرّ حين يكون مضبوطا — وإلّا فكلُّ ما بعدَه لا معنى له', () => {
    expect(runPreflight(COMPLETE).code, 'سقطت على ملفٍّ سليم').toBe(0)
  })

  it('وتسقط حين يغيب السطرُ رأسا، وتسمّيه', () => {
    const r = runPreflight(COMPLETE.replace(/^APP_URL=.*\n/m, ''))
    expect(r.code, 'مرّ نشرٌ بلا APP_URL').not.toBe(0)
    expect(r.stderr, 'سقطت بلا أن تقول ما الناقص').toContain('APP_URL')
  })

  /* والفراغُ كالغياب: `publicSiteUrl()` يقيس بـ`?.trim()`، فسطرٌ فارغٌ أو
     مسافاتٌ يسقط إلى localhost تماما كغيابِ السطر. ولو قاست البوّابةُ وجودَ
     السطر لمرّ منها ما يسقط في التشغيل. */
  it('وتسقط على قيمةٍ فارغة', () => {
    expect(runPreflight(COMPLETE.replace(/^APP_URL=.*$/m, 'APP_URL=')).code).not.toBe(0)
  })

  it('وتسقط على قيمةٍ من مسافاتٍ وحدَها', () => {
    expect(runPreflight(COMPLETE.replace(/^APP_URL=.*$/m, 'APP_URL=   ')).code).not.toBe(0)
  })

  /* ولا يذهب `SITE_DOMAIN` مع إضافة `APP_URL`: كان محروسا قبلها ويبقى. */
  it('وحارسُ SITE_DOMAIN باقٍ معه لا بدلا منه', () => {
    const r = runPreflight(COMPLETE.replace(/^SITE_DOMAIN=.*\n/m, ''))
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('SITE_DOMAIN')
  })

  it('وملفُّ بيئةٍ لا وجودَ له يسقط ولا يمرّ صامتا', () => {
    let code = 0
    try {
      execFileSync('bash', [PREFLIGHT, join(tmpdir(), 'wajeez-no-such-env-file')], { stdio: 'pipe' })
    } catch (e) {
      code = (e as { status?: number }).status ?? -1
    }
    expect(code).not.toBe(0)
  })
})

describe('والبوّابةُ موصولةٌ بما يُنشَر فعلا', () => {
  /* بوّابةٌ لا يناديها النشرُ زينةٌ مهما صحّ منطقُها. والفحصُ على أمرٍ
     مُنفَّذٍ لا على ورودِ الاسم: سطرٌ يذكرها في تعليقٍ يُطابق نصّا ولا يشغّل
     شيئا — فتُجرَّد التعليقاتُ أوّلا ثمّ يُبحث في الأسطر العاملة وحدَها. */
  it('deploy.sh يناديها قبل أن يلمس شيئا', () => {
    const lines = readFileSync(join(root, 'deploy/deploy.sh'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'))

    const callIndex = lines.findIndex((l) => /(^|\s|\|\||&&)bash\s+deploy\/preflight-env\.sh\b/.test(l))
    expect(callIndex, 'لا نداءَ منفَّذا لـpreflight-env.sh في deploy.sh').toBeGreaterThanOrEqual(0)

    /* وقبلَ أوّلِ خطوةٍ تُغيّر شيئا — فبوّابةٌ بعد الهجرة أو بعد بناء الصورة
       تكون قد تركت النشرَ يمضي على بيئةٍ ناقصة */
    const firstStep = lines.findIndex((l) => l.startsWith('step '))
    expect(firstStep, 'لا خطواتِ نشرٍ في deploy.sh').toBeGreaterThanOrEqual(0)
    expect(callIndex, 'البوّابةُ بعد أوّل خطوةِ نشر — فالنشرُ مضى قبل أن تُسأل').toBeLessThan(firstStep)
  })

  /* وقيمةٌ مضبوطةٌ لا تبلغ الحاويةَ إن لم يُمرَّر ملفُّها إليها: يُقرأ التركيبُ
     من YAML مُحلَّلا لا مطابَقةَ نصّ. */
  it('وcompose يمرّر .env.production إلى حاوية التطبيق', () => {
    const compose = parse(readFileSync(join(root, 'deploy/compose.prod.yml'), 'utf8')) as {
      services?: Record<string, { image?: string; env_file?: string | string[] }>
    }
    const app = Object.values(compose.services ?? {}).find((s) => /wajeez-app/.test(s.image ?? ''))
    expect(app, 'لا خدمةَ تطبيقٍ في compose.prod.yml').toBeDefined()
    const envFiles = [app!.env_file ?? []].flat()
    expect(envFiles.some((f) => f.includes('.env.production')), 'APP_URL مضبوطٌ ولا يبلغ الحاوية').toBe(true)
  })

  /* والقالبُ الذي يُنسخ عنه يُعلن المتغيّرَ بقيمةٍ حقيقيّةٍ لا سطرا فارغا:
     من ينسخه ويملأ ما يراه فارغا يترك ما لم يره. */
  it('والقالبُ يُعلن APP_URL بقيمةٍ لا فارغا', () => {
    const example = readFileSync(join(root, 'deploy/.env.production.example'), 'utf8')
    const assigned = new Map<string, string>()
    for (const line of example.split('\n')) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line)
      if (m) assigned.set(m[1], m[2].trim())
    }
    expect(assigned.has('APP_URL'), 'القالبُ لا يذكر APP_URL أصلا').toBe(true)
    expect(assigned.get('APP_URL'), 'القالبُ يُعلنه فارغا فيُنسخ فارغا').not.toBe('')
  })
})
