/* النطاقُ بلا `www` يصل إلى خادمنا — فإمّا أن نجيبه، وإمّا أن نقطعه.

   ─────────── كيف وقع العطب ───────────

   `deploy/Caddyfile` كان يعلن كتلةً واحدةً عنوانُها `{$SITE_DOMAIN}` — أي
   `www.wajeezacademy.com` وحدَه. وسجلُّ DNS للنطاق المجرّد يشير إلى الخادم
   نفسِه منذ أوّل يوم. فمن كتب `wajeezacademy.com` بلا `www` وصل إلى Caddy،
   وطلب اسما لا كتلةَ له، فلم تُقدَّم شهادة: يُقطع التصافحُ بـ
   `tlsv1 alert internal error` قبل أن تُرسَل بايتةٌ واحدة.

   ولا شيءَ في المنصّة كان يراه: البناءُ أخضر، والاختباراتُ خضراء، والفحصُ
   الصحّيُّ بعد النشر يسأل `SITE_DOMAIN` وحدَه فيجيب ٢٠٠. والزائرُ وحدَه
   يرى موقعا ميّتا — ويكتب الاسمَ هكذا لأنّه هكذا يُقال ويُكتب على البطاقات.

   ─────────── فما يُحرَس هنا ───────────

   أنّ لهذا الاسم كتلتَه، وأنّها **تحوّل ولا تخدم**: خدمتُه محتوًى تُنتج
   عنوانَين لمحتوًى واحدٍ يتنازعان الفهرسةَ، و`CANONICAL_ORIGIN` واحدٌ لا
   اثنان. وأنّ اشتقاقَه في `deploy.sh` لا يُنتج اسمَ الكتلة الأولى نفسَه —
   فكتلتان بعنوانٍ واحدٍ تُسقطان إعدادَ Caddy **كلَّه**، أي الموقعَ كلَّه
   ثمنا لتحويلٍ لا يلزم.

   والقياسُ على البنية لا على ورودِ نصّ: كتلُ Caddy تُحلَّل، وcompose يُقرأ
   من YAML مُحلَّلا، **وأسطرُ الاشتقاق تُشغَّل بـbash كما هي في الملفّ**
   فيُقاس ما تفعله لا ما تقوله. */

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { CANONICAL_ORIGIN } from '../../application/site/origin'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const CADDY = read('deploy/Caddyfile')
const DEPLOY = read('deploy/deploy.sh')
const EXAMPLE = read('deploy/.env.production.example')

/** أسطرٌ تُنفَّذ وحدَها — لا تعليقٌ يشرح ولا فراغ */
const executable = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'))

/** كتلُ المواقع في Caddyfile: عنوانُها ← متنُها. */
function siteBlocks(text: string): Map<string, string> {
  const out = new Map<string, string>()
  let depth = 0
  let address: string | null = null
  let body: string[] = []
  for (const line of executable(text)) {
    if (line.endsWith('{')) {
      if (depth === 0) { address = line.slice(0, -1).trim(); body = [] }
      else body.push(line)
      depth++
    } else if (line === '}') {
      depth--
      if (depth === 0) {
        if (address) out.set(address, body.join('\n'))
        address = null; body = []
      } else body.push(line)
    } else if (depth >= 1) body.push(line)
  }
  return out
}

const BLOCKS = siteBlocks(CADDY)
const MAIN = '{$SITE_DOMAIN}'
const ALT = '{$SITE_ALT_DOMAIN}'

describe('الكتلتان في Caddyfile — واحدةٌ تخدم وأخرى تحوّل', () => {
  /* حارسٌ للحارس: لو انكسر التحليلُ لعادت خريطةٌ فارغةٌ فمرّ كلُّ ما بعده
     وهو لا يفحص شيئا. وقد مرّ في هذه المنصّة ثلاثةُ حرّاسٍ خضراءَ هكذا. */
  it('التحليلُ يقرأ الكتلةَ الخادمة — وإلّا فما بعده يفحص فراغا', () => {
    const main = BLOCKS.get(MAIN)
    expect(main, `لم تُقرأ كتلةُ ${MAIN} — تحليلُ Caddyfile انكسر`).toBeDefined()
    expect(main, 'الكتلةُ الخادمةُ بلا تمريرٍ إلى التطبيق').toContain('reverse_proxy app:7101')
    expect(main, 'الكتلةُ الخادمةُ بلا خادمِ ملفّات').toContain('file_server')
  })

  it('وللنطاق بلا www كتلتُه — وبدونها لا شهادةَ له فيُقطع التصافح', () => {
    expect(
      BLOCKS.has(ALT),
      `لا كتلةَ عنوانُها ${ALT}: النطاقُ المجرّدُ يصل إلى Caddy ولا يجد اسمَه، `
      + 'فيُردّ بـtlsv1 alert internal error قبل أيّ بايتة',
    ).toBe(true)
  })

  it('وهي تحوّل تحويلا دائما إلى الحيّ بالمسار والاستعلام معا', () => {
    const body = BLOCKS.get(ALT) ?? ''
    expect(
      body,
      'التحويلُ إمّا غائبٌ وإمّا لا يحمل {uri} — فرابطٌ عميقٌ في رسالةٍ يهبط على الرئيسة',
    ).toMatch(/^redir\s+https:\/\/\{\$SITE_DOMAIN\}\{uri\}\s+permanent$/m)
  })

  it('ولا تخدم محتوًى — فعنوانان لمحتوًى واحدٍ يتنازعان الفهرسة', () => {
    const body = BLOCKS.get(ALT) ?? ''
    for (const serving of ['file_server', 'reverse_proxy', 'root *']) {
      expect(body, `كتلةُ التحويل تخدم (${serving}) — و${CANONICAL_ORIGIN} واحدٌ لا اثنان`)
        .not.toContain(serving)
    }
  })

  it('وعنوانُها غيرُ عنوان الخادمة — واسمان متطابقان يُسقطان الإعدادَ كلَّه', () => {
    expect(ALT).not.toBe(MAIN)
    expect([...BLOCKS.keys()].length, 'كتلتان لا أكثر ولا أقلّ').toBeGreaterThanOrEqual(2)
  })
})

describe('والمتغيّرُ يبلغ الحاويةَ بلا أن يُلزم خادما لم يُحدَّث ملفُّه', () => {
  /* قيمةٌ في Caddyfile لا تصل إن لم تُمرَّر: يُقرأ التركيبُ من YAML مُحلَّلا. */
  it('compose يمرّر SITE_ALT_DOMAIN إلى Caddy', () => {
    const compose = parse(read('deploy/compose.prod.yml')) as {
      services?: Record<string, { image?: string; environment?: Record<string, string> }>
    }
    const caddy = Object.values(compose.services ?? {}).find((s) => /^caddy:/.test(s.image ?? ''))
    expect(caddy, 'لا خدمةَ Caddy في compose.prod.yml').toBeDefined()
    const value = caddy!.environment?.SITE_ALT_DOMAIN
    expect(value, 'المتغيّرُ مكتوبٌ في Caddyfile ولا يبلغ الحاوية — فيتمدّد فراغا').toBeDefined()

    /* ولا `:?` بقصد: متغيّرٌ جديدٌ يُلزِم لا يُصلح عطبا بل يمنع النشرَ كلَّه
       على خادمٍ لم يُفتح ملفُّ بيئته بعد — وهو حالُ الخادم اليوم. */
    expect(value, 'قيمةٌ ساقطةٌ لازمة — وإلّا سقط النشرُ على بيئةٍ لم تُحدَّث').toMatch(/\$\{SITE_ALT_DOMAIN:-/)
    expect(value, 'إلزامٌ يمنع النشرَ بدل أن يصلحه').not.toContain(':?')
  })
})

describe('واشتقاقُه في deploy.sh — تُشغَّل أسطرُه كما هي', () => {
  /* لا مطابقةَ نصّ: يُنتزع ما بين بدءِ الاشتقاق و`export`، ويُشغَّل بـbash
     على ثلاثة نطاقاتٍ مختلفةِ الشكل. فما يُقاس هو ما يقع على الخادم. */
  const snippet = /(if \[ -z "\$SITE_ALT_DOMAIN" \]; then[\s\S]*?)\nexport SITE_ALT_DOMAIN\b/.exec(DEPLOY)

  const derive = (siteDomain: string, preset = '') =>
    execFileSync('bash', ['-c',
      `set -euo pipefail\nSITE_DOMAIN=${JSON.stringify(siteDomain)}\n`
      + `SITE_ALT_DOMAIN=${JSON.stringify(preset)}\n${snippet?.[1] ?? 'exit 9'}\n`
      + 'printf %s "$SITE_ALT_DOMAIN"',
    ], { encoding: 'utf8' })

  it('الأسطرُ موجودةٌ ومُصدَّرة — وقيمةٌ لا تُصدَّر لا تبلغ compose', () => {
    expect(snippet, 'لا اشتقاقَ في deploy.sh بين `if [ -z "$SITE_ALT_DOMAIN" ]` و`export`').not.toBeNull()
    expect(executable(DEPLOY)).toContain('export SITE_ALT_DOMAIN')
  })

  it('يحذف www. من النطاق الحيّ — فالنشرةُ تصلح العطبَ بلا يدٍ على الخادم', () => {
    expect(derive('www.wajeezacademy.com')).toBe('wajeezacademy.com')
  })

  it('ولا يُنتج اسمَ الكتلة الأولى نفسَه حين يكون الحيُّ مجرّدا أصلا', () => {
    /* لو ردّ `wajeezacademy.com` هنا لكانت كتلتان بعنوانٍ واحد، ولسقط
       إعدادُ Caddy كلُّه — أي الموقعُ كلُّه ثمنا لتحويلٍ لا يلزم. */
    const derived = derive('wajeezacademy.com')
    expect(derived, 'الاشتقاقُ يساوي النطاقَ الخادم — كتلتان بعنوانٍ واحد').not.toBe('wajeezacademy.com')
    expect(derived, 'قيمةٌ خاملةٌ لا تطلب شهادةً ولا تخدم أحدا').toBe('localhost')
  })

  it('وما كُتب في ملفّ البيئة يغلب المشتقّ — فللمشغّل أن يسمّي اسما آخر', () => {
    expect(derive('www.wajeezacademy.com', 'staging.wajeezacademy.com')).toBe('staging.wajeezacademy.com')
  })

  /* ═══ وهذا الاحتمالُ وحدَه يبرّر حارسَ التطابق ═══

     الاشتقاقُ لا يُنتج اسمَ الكتلة الأولى أبدا — يحذف `www.` أو يسقط إلى
     `localhost`. فالطريقُ الوحيدُ إلى اسمَين متطابقَين هو **يدٌ تكتبهما
     كذلك** في `.env.production`: مشغّلٌ يقرأ «النطاق» فيعيد كتابةَ ما فوقه.
     وثمنُه أنّ Caddy يرفض الإعدادَ كلَّه — لا الكتلةَ الزائدةَ وحدَها —
     فيسقط الموقعُ كلُّه في نشرةٍ قُصد بها إصلاحُ تحويل.

     وقد كُتب هذا الاختبارُ بعد أن حُذف الحارسُ فلم يحمرّ شيء: كانت
     المدخلاتُ الثلاثةُ كلُّها تمرّ على `case` فلا تبلغه. */
  it('ولا يقبل من الملفّ اسما يساوي النطاقَ الخادم — وهو ما يُسقط Caddy كلَّه', () => {
    expect(
      derive('www.wajeezacademy.com', 'www.wajeezacademy.com'),
      'كتلتان بعنوانٍ واحد: Caddy يرفض الإعدادَ كلَّه، فيسقط الموقعُ لا التحويلُ وحدَه',
    ).toBe('localhost')
  })
})

describe('والتحويلُ يُقاس كما يُجيب لا كما كُتب', () => {
  /* درسُ ترويسة السياسة بعينه (١٢ سبتمبر): حارسٌ يقرأ `Caddyfile` يفحص
     النيّةَ، وCaddy كان يرسل غيرَها أربعةَ أيّام. فالنشرُ يسأل الخادمَ الحيَّ
     عمّا أجاب به فعلا على الاسم المجرّد. */
  it('deploy.sh يسأل النطاقَ المجرّدَ بعد النشر', () => {
    const lines = executable(DEPLOY)
    const asked = lines.some((l) => /curl[^\n]*https:\/\/\$\{SITE_ALT_DOMAIN\}/.test(l))
    expect(asked, 'لا أحدَ يسأل النطاقَ المجرّدَ بعد النشر — فسقوطُه يبقى صامتا كما كان').toBe(true)
  })

  it('ويقارن الجوابَ بتحويلٍ دائمٍ إلى النطاق الخادم', () => {
    expect(
      DEPLOY,
      'يُسأل ولا يُقارَن جوابُه — وجوابٌ لا يُقاس عليه لا يكشف شيئا',
    ).toContain('"301 https://${SITE_DOMAIN}/"')
  })
})

describe('ومثالُ البيئة يقول الاسمَ المجرّدَ للنطاق الحيّ نفسِه', () => {
  it('SITE_ALT_DOMAIN في المثال هو CANONICAL_ORIGIN بلا www', () => {
    const bare = new URL(CANONICAL_ORIGIN).host.replace(/^www\./, '')
    const m = /^SITE_ALT_DOMAIN=(\S+)/m.exec(
      EXAMPLE.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n'),
    )
    expect(m, 'SITE_ALT_DOMAIN غائبٌ عن المثال — ومن نسخه لا يعلم أنّه موجود').not.toBeNull()
    expect(m![1], `المثالُ يفترق عن ${CANONICAL_ORIGIN}`).toBe(bare)
  })
})
