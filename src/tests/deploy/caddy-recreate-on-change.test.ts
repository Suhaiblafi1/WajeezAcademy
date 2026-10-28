/* Caddy يُعاد إنشاؤه حين تغيّر `Caddyfile` وحدَه — لا في كلّ نشر (٢٧ و٢٨ أكتوبر ٢٠٢٦).

   ── العطب ──

   `deploy/deploy.sh` كان يعيد إنشاءَ حاوية Caddy في كلّ نشر (`--force-recreate caddy`)، وCaddy هو الواجهةُ الوحيدةُ
   على 443 — فينطفئ الموقعُ كلُّه ثوانيَ. وقيس بطلبٍ كلَّ ثانيتين في نشرَي ١٨:٣٠ و١٨:٥٠ (UTC) يومَها:

     18:30:27 PUT 000 6.37s · 18:50:28 GET 000 6.27s

   والنشرُ تلقائيٌّ بعد كلّ دمج، فمن ضغط «ادفع» فيها رأى «تعذّر إتمام الشراء» (بلاغُ صاحب المنصّة). و`Caddyfile` لا
   يتغيّر في أكثر النشرات. وبعد الإصلاح قيس نشرُ ٢٠:١١: طلبٌ واحدٌ أُمسك ١١ ثانيةً ووصل، ولا «000».

   ── ولماذا وسمٌ على الحاوية (٢٨ أكتوبر ٢٠٢٦) ──

   كانت البصمةُ ملفّا على القرص يكتبه السكربت — أي ما كتبه آخرَ مرّة لا ما أقلع به Caddy. فرجوعٌ بسكربتٍ قديمٍ يعيد
   إنشاءَ Caddy على ملفٍّ قديم ولا يمسّ البصمة، ثمّ نشرُ الجديد يجدها مطابقةً فلا يُنشئه: إعدادٌ قديمٌ بلا إنذار. فصارت
   البصمةُ وسما على الحاوية نفسِها (`wajeez.caddyfile-sha256`) يُقرأ منها.

   ── ما يُحرس ──

   يُشغَّل المقطعُ نفسُه من السكربت — لا يُقرأ نصُّه — بـ`docker` مزيَّفٍ يكتب ما طُلب منه ويجيب بوسم الحاوية: يُعاد
   الإنشاءُ حين يخالف الوسمُ بصمةَ الملفّ أو يغيب أو لا حاويةَ تعمل، ولا يُعاد حين يطابقها. والوسمُ في `compose.prod.yml`
   ببصمةٍ يصدّرها السكربتُ قبل `up -d`. */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

const root = join(__dirname, '..', '..', '..')
const SH = readFileSync(join(root, 'deploy/deploy.sh'), 'utf8')
/** بلا التعليقات — فذِكرُ الأمر في شرحٍ ليس تنفيذا له */
const code = (s: string) => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

/** المقطعُ كما في السكربت: من حاوية Caddy إلى `fi` التي تُغلق شرطَه */
function block(): string {
  const from = SH.indexOf('caddy_id="$($COMPOSE ps -q caddy')
  if (from < 0) throw new Error('لم يوجد مقطع حاوية Caddy في deploy.sh')
  const end = SH.indexOf('\nfi\n', from)
  if (end < 0) throw new Error('لم يُغلق شرط Caddy')
  return SH.slice(from, end + 4)
}

let box = ''
const calls = () => (existsSync(join(box, 'calls')) ? readFileSync(join(box, 'calls'), 'utf8') : '')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const CADDYFILE = '{$SITE_DOMAIN} {\n\tfile_server\n}\n'

/* `docker` مزيَّف: يكتب كلَّ ما طُلب منه، و`ps -q caddy` يجيب بمعرّفٍ إن كانت «الحاويةُ تعمل»، و`inspect` بوسمها */
const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$WAJEEZ_TEST_BOX/calls"
case "$*" in
  *"ps -q caddy"*) [ -f "$WAJEEZ_TEST_BOX/running" ] && echo abc123 ;;
  inspect*) [ -f "$WAJEEZ_TEST_BOX/label" ] && cat "$WAJEEZ_TEST_BOX/label" ;;
esac
exit 0
`

function run(): { status: number | null; out: string } {
  const r = spawnSync('bash', ['-c', `set -euo pipefail\nCOMPOSE="docker compose -f deploy/compose.prod.yml"\nexport CADDYFILE_SHA256="$(sha256sum deploy/Caddyfile | cut -d' ' -f1)"\n${block()}`], {
    cwd: box, encoding: 'utf8',
    env: { ...process.env, PATH: `${join(box, 'bin')}:${process.env.PATH}`, WAJEEZ_TEST_BOX: box },
  })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}
const recreated = () => calls().split('\n').filter((l) => l.includes('up -d --force-recreate caddy')).length

beforeEach(() => {
  box = mkdtempSync(join(tmpdir(), 'wajeez-caddy-'))
  for (const d of ['bin', 'deploy']) mkdirSync(join(box, d), { recursive: true })
  writeFileSync(join(box, 'bin/docker'), FAKE_DOCKER)
  chmodSync(join(box, 'bin/docker'), 0o755)
  writeFileSync(join(box, 'deploy/Caddyfile'), CADDYFILE)
  writeFileSync(join(box, 'running'), '')
})
afterEach(() => { if (box) rmSync(box, { recursive: true, force: true }) })

describe('Caddy يعاد إنشاؤه حين تغير إعداده وحده — فلا ينطفئ الموقع ست ثوان في كل نشر', () => {
  it('⚠️ وسم الحاوية بصمة الملف اليوم: لا يمس — يبقى يعمل', () => {
    writeFileSync(join(box, 'label'), `${sha(CADDYFILE)}\n`)
    const r = run()
    expect(r.status, r.out).toBe(0)
    expect(recreated(), 'أعيد إنشاؤه ولم يتغير شيء — الموقع ينطفئ في كل نشر').toBe(0)
    expect(r.out).toMatch(/Caddy يبقى يعمل/)
  })

  it('⚠️ وسمها بصمة ملف قديم (رجوع بسكربت قديم، أو تغير الملف): يعاد إنشاؤه', () => {
    writeFileSync(join(box, 'label'), `${sha('{$SITE_DOMAIN} {\n}\n')}\n`)
    expect(run().status).toBe(0)
    expect(recreated(), 'Caddy على إعداد قديم بلا إنذار').toBe(1)
  })

  it('⚠️ بلا وسم (أنشئ قبل الوسم أو بيد) أو بلا حاوية تعمل: يعاد إنشاؤه', () => {
    expect(run().status).toBe(0)
    expect(recreated(), 'حاوية بلا وسم بقيت').toBe(1)
    writeFileSync(join(box, 'label'), `${sha(CADDYFILE)}\n`)
    rmSync(join(box, 'running'))
    expect(run().status).toBe(0)
    expect(recreated(), 'لا حاوية تعمل ولم يُنشأ').toBe(2)
  })

  it('⚠️ والوسم في compose ببصمة يصدرها السكربت قبل up -d — ولا ملف بصمة على القرص', () => {
    const compose = parse(readFileSync(join(root, 'deploy/compose.prod.yml'), 'utf8')) as { services: Record<string, { labels?: Record<string, string> }> }
    expect(compose.services.caddy.labels?.['wajeez.caddyfile-sha256']).toBe('${CADDYFILE_SHA256:-unset}')
    const c = code(SH)
    const exp = c.indexOf(`export CADDYFILE_SHA256="$(sha256sum deploy/Caddyfile | cut -d' ' -f1)"`)
    expect(exp, 'البصمة لا تصدر').toBeGreaterThan(-1)
    expect(exp, 'البصمة بعد up -d — لا يراها compose').toBeLessThan(c.indexOf('$COMPOSE up -d --remove-orphans'))
    expect(c, 'عاد ملف البصمة على القرص').not.toMatch(/CADDY_STAMP|wajeez-caddyfile\.sha256/)
  })
})
