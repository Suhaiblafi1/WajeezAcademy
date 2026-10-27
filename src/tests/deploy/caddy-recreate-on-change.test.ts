/* Caddy يُعاد إنشاؤه حين تغيّر `Caddyfile` وحدَه — لا في كلّ نشر (٢٧ أكتوبر ٢٠٢٦).

   ── العطب ──

   `deploy/deploy.sh` كان يعيد إنشاءَ حاوية Caddy في كلّ نشر (`--force-recreate caddy`)، وCaddy هو الواجهةُ الوحيدةُ
   على 443 — فينطفئ الموقعُ كلُّه ثوانيَ. وقيس بطلبٍ كلَّ ثانيتين في نشرَي ١٨:٣٠ و١٨:٥٠ (UTC) يومَها:

     18:30:27 PUT 000 6.37s · 18:50:28 GET 000 6.27s

   والنشرُ تلقائيٌّ بعد كلّ دمج، فمن ضغط «ادفع» فيها رأى «تعذّر إتمام الشراء» (بلاغُ صاحب المنصّة). و`Caddyfile` لا
   يتغيّر في أكثر النشرات.

   ── ما يُحرس ──

   يُشغَّل المقطعُ نفسُه من السكربت — لا يُقرأ نصُّه — بـ`docker` مزيَّفٍ يكتب ما طُلب منه: يُعاد الإنشاءُ أوّلَ مرّة، وحين
   يتغيّر الملفّ، وحين لا حاويةَ تعمل؛ ولا يُعاد حين لم يتغيّر شيء. والبصمةُ تُكتب بعد الإنشاء: إنشاءٌ سقط يُعاد في التالي. */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..')
const SH = readFileSync(join(root, 'deploy/deploy.sh'), 'utf8')

/** المقطعُ كما في السكربت: من بصمة الملفّ إلى `fi` التي تُغلق شرطَه */
function block(): string {
  const from = SH.indexOf('caddy_sum="$(sha256sum deploy/Caddyfile')
  if (from < 0) throw new Error('لم يوجد مقطع بصمة Caddyfile في deploy.sh')
  const end = SH.indexOf('\nfi\n', from)
  if (end < 0) throw new Error('لم يُغلق شرط Caddy')
  return SH.slice(from, end + 4)
}

let box = ''
const calls = () => (existsSync(join(box, 'calls')) ? readFileSync(join(box, 'calls'), 'utf8') : '')

/* `docker` مزيَّف: يكتب كلَّ ما طُلب منه، و`ps -q caddy` يجيب بمعرّفٍ إن كانت «الحاويةُ تعمل» */
const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$WAJEEZ_TEST_BOX/calls"
case "$*" in
  *"ps -q caddy"*) [ -f "$WAJEEZ_TEST_BOX/running" ] && echo abc123 ;;
esac
exit 0
`

function run(): { status: number | null; out: string } {
  const r = spawnSync('bash', ['-c', `set -euo pipefail\nCOMPOSE="docker compose -f deploy/compose.prod.yml"\n${block()}`], {
    cwd: box, encoding: 'utf8',
    env: { ...process.env, PATH: `${join(box, 'bin')}:${process.env.PATH}`, WAJEEZ_TEST_BOX: box, WAJEEZ_CADDY_STAMP: join(box, 'stamp') },
  })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}
const recreated = () => calls().split('\n').filter((l) => l.includes('up -d --force-recreate caddy')).length

beforeEach(() => {
  box = mkdtempSync(join(tmpdir(), 'wajeez-caddy-'))
  for (const d of ['bin', 'deploy']) mkdirSync(join(box, d), { recursive: true })
  writeFileSync(join(box, 'bin/docker'), FAKE_DOCKER)
  chmodSync(join(box, 'bin/docker'), 0o755)
  writeFileSync(join(box, 'deploy/Caddyfile'), '{$SITE_DOMAIN} {\n\tfile_server\n}\n')
  writeFileSync(join(box, 'running'), '')
})
afterEach(() => { if (box) rmSync(box, { recursive: true, force: true }) })

describe('Caddy يعاد إنشاؤه حين تغير إعداده وحده — فلا ينطفئ الموقع ست ثوان في كل نشر', () => {
  it('⚠️ أول مرة (لا بصمة) يعاد إنشاؤه وتكتب البصمة — ثم نشر بلا تغيير لا يمسه', () => {
    expect(run().status).toBe(0)
    expect(recreated(), 'لم يعد إنشاؤه أول مرة').toBe(1)
    expect(readFileSync(join(box, 'stamp'), 'utf8').trim()).toMatch(/^[0-9a-f]{64}$/)
    const second = run()
    expect(second.status).toBe(0)
    expect(recreated(), 'أعيد إنشاؤه ولم يتغير شيء — الموقع ينطفئ في كل نشر').toBe(1)
    expect(second.out).toMatch(/Caddy يبقى يعمل/)
  })

  it('⚠️ وحين يتغير Caddyfile يعاد إنشاؤه — فلا يبقى على إعداد قديم', () => {
    run()
    writeFileSync(join(box, 'deploy/Caddyfile'), '{$SITE_DOMAIN} {\n\tfile_server\n\theader X-New "1"\n}\n')
    expect(run().status).toBe(0)
    expect(recreated(), 'تغير الإعداد ولم يقرأه Caddy').toBe(2)
  })

  it('⚠️ وحين لا حاوية تعمل يعاد إنشاؤه ولو لم يتغير شيء', () => {
    run()
    rmSync(join(box, 'running'))
    expect(run().status).toBe(0)
    expect(recreated()).toBe(2)
  })

  it('⚠️ والبصمة بعد الإنشاء لا قبله — إنشاء سقط يعاد في النشر التالي', () => {
    const src = block()
    expect(src.indexOf('printf'), 'البصمة تكتب قبل الإنشاء').toBeGreaterThan(src.indexOf('up -d --force-recreate caddy'))
    /* ومع `set -e` يخرج السكربتُ إن سقط الإنشاء — فلا تُكتب بصمةٌ لملفٍّ لم يقرأه Caddy */
    writeFileSync(join(box, 'bin/docker'), FAKE_DOCKER.replace('exit 0', 'case "$*" in *force-recreate*) exit 1 ;; esac\nexit 0'))
    expect(run().status).not.toBe(0)
    expect(existsSync(join(box, 'stamp')), 'كتبت بصمة لإنشاء سقط').toBe(false)
  })
})
