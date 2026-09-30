/* لا يُنشَر إلّا ما اجتاز CI على main — وحارسُ ذلك يُشغَّل لا يُقرأ (٣٠ سبتمبر ٢٠٢٦).

   ── العطبُ الذي يحرسه ──

   كان المراقبُ على الخادم (`scripts/deploy-watch.sh`) يسأل «هل تحرّكت main؟»
   فينشر الدمجَ في دقيقته — قبل أن تفحصه CI على main نفسِها، ولو احمرّ بعدها.
   وقيس يومَ كُتب هذا: وصل #361 الإنتاجَ قبل أن يفرغ فحصُه على main، مخلوطا بـ#360
   الذي دُمج قبله بثمانِ دقائق — خليطٌ لم يفحصه أحدٌ مجتمعا. و`deploy.yml` يقول في
   رأسه «ودفعةٌ تصل قبل أن تُفحَص لا تنشر شيئا»، والناشرُ تحته يسحب رأسَ main.

   ── والعلاج: CI تقول ما اجتازها، والخادمُ لا ينشر غيرَه ──

   · `green` في ci.yml — بعد نجاح الوظيفتين على main — يُقدِّم فرعَ `ci-green`
     إلى الالتزام، تقدّما لا رجوعا (`scripts/mark-ci-green.sh`).
   · `deploy/target.sh` يقرأ الفرعَ ويطبع ما يُنشَر؛ والمراقبُ والناشرُ يسألانه.

   ── وكيف يُقاس ──

   يُشغَّل كلُّ جزءٍ فعلا: عالمٌ صغيرٌ من git — origin عارٍ وخادمٌ مستنسَخ — تُدفع
   فيه دمجاتٌ ويُقدَّم فيه الفرع، ثمّ يُسأل المراقبُ بـ`--check` عمّا سينشره، ويُسلَّم
   ناشرا مزيّفا يكتب ما سُلِّمه. والعلامةُ تُشغَّل على `gh` مصطنعٍ يحكم كما يحكم
   GitHub: لا كتابةَ فوق الفرع إلّا تقدّما. ولا يُطابَق نصٌّ في ملفّ — إلّا شكلُ
   وظيفة CI، ويُقرأ بمحلّل YAML لا بتعبيرٍ نمطيّ. */

import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/* git بلا إعداد المستخدم: لا توقيعَ ولا خطّافَ ولا فرعَ افتراضيٌّ يتسلّل من الجهاز */
const HOME = mkdtempSync(join(tmpdir(), 'wajeez-gate-home-'))
const ENV = {
  ...process.env, HOME, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** عالمٌ صغير: origin عارٍ، ومطوّرٌ يدمج فيه، وخادمٌ مستنسَخٌ عليه السكربتان كما في المستودَع */
function world() {
  const dir = mkdtempSync(join(tmpdir(), 'wajeez-gate-'))
  const origin = join(dir, 'origin.git')
  const dev = join(dir, 'dev')
  const server = join(dir, 'server')
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin)
  git(dir, 'clone', '-q', origin, dev)
  let n = 0
  /** دمجةٌ على main — تعيد التزامَها */
  const merge = () => {
    n += 1
    writeFileSync(join(dev, 'f.txt'), `c${n}`)
    git(dev, 'add', '.')
    git(dev, 'commit', '-qm', `c${n}`)
    git(dev, 'push', '-q', 'origin', 'HEAD:main')
    return git(dev, 'rev-parse', 'HEAD')
  }
  const first = merge()
  git(dir, 'clone', '-q', origin, server)
  mkdirSync(join(server, 'deploy'))
  mkdirSync(join(server, 'scripts'))
  copyFileSync(join(root, 'deploy/target.sh'), join(server, 'deploy/target.sh'))
  copyFileSync(join(root, 'scripts/deploy-watch.sh'), join(server, 'scripts/deploy-watch.sh'))
  /** CI نجحت على هذا الالتزام — فيتقدّم إليه الفرع */
  const green = (sha: string) => git(dev, 'push', '-q', '-f', 'origin', `${sha}:refs/heads/ci-green`)
  /** التزامٌ على فرعٍ آخرَ في origin — لم يُدمج في main */
  const offMain = () => {
    git(dev, 'checkout', '-q', '-b', 'side')
    writeFileSync(join(dev, 'side.txt'), 'side')
    git(dev, 'add', '.')
    git(dev, 'commit', '-qm', 'side')
    git(dev, 'push', '-q', 'origin', 'side')
    const sha = git(dev, 'rev-parse', 'HEAD')
    git(dev, 'checkout', '-q', 'main')
    return sha
  }
  return { dir, server, merge, green, offMain, first }
}

function target(w: ReturnType<typeof world>, env: Record<string, string> = {}) {
  const r = spawnSync('bash', [join(w.server, 'deploy/target.sh')], { env: { ...ENV, ...env }, encoding: 'utf8' })
  return { code: r.status, out: r.stdout.trim() }
}

/** المراقبُ كما يشغّله cron — وناشرٌ مزيّفٌ يكتب ما سُلِّمه ويتقدّم إليه كما يتقدّم الحقيقيّ */
function watch(w: ReturnType<typeof world>, ...args: string[]) {
  const r = spawnSync('bash', [join(w.server, 'scripts/deploy-watch.sh'), ...args], {
    env: {
      ...ENV, WAJEEZ_DEPLOY_LOG: join(w.dir, 'deploy.log'), WAJEEZ_DEPLOY_LOCK: join(w.dir, 'deploy.lock'),
      WAJEEZ_PING_URL: '',
    },
    encoding: 'utf8',
  })
  return { code: r.status, out: r.stdout }
}
function fakeDeployer(w: ReturnType<typeof world>) {
  const handed = join(w.dir, 'handed.txt')
  writeFileSync(join(w.server, 'deploy/deploy.sh'),
    `#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "$0")/.."\nprintf '%s' "\${DEPLOY_TARGET:-}" > '${handed}'\ngit merge --ff-only --quiet "$DEPLOY_TARGET"\n`)
  return () => readFileSync(handed, 'utf8')
}
const short = (sha: string) => sha.slice(0, 7)

describe('deploy/target.sh — ما يُنشَر', () => {
  it('⚠️ آخرُ ما اجتاز CI — لا رأسُ main وقد سبقه دمجٌ لم يُفحَص', () => {
    const w = world()
    w.green(w.first)
    w.merge()
    expect(target(w)).toEqual({ code: 0, out: `${w.first} ci-green` })
  })

  it('وقبل أوّل أخضر: رأسُ main كما كان — ويُقال المصدر', () => {
    const w = world()
    const head = w.merge()
    expect(target(w)).toEqual({ code: 0, out: `${head} main` })
  })

  it('والتجاوزُ البشريُّ الصريحُ يُقبل — ما دام على main', () => {
    const w = world()
    w.green(w.first)
    const head = w.merge()
    expect(target(w, { DEPLOY_TARGET: 'origin/main' })).toEqual({ code: 0, out: `${head} override` })
    expect(target(w, { DEPLOY_TARGET: 'no-such-ref' }).code).toBe(3)
  })

  it('⚠️ ولا يُنشَر ما ليس على main — ولو سُمّي في الفرع أو في التجاوز', () => {
    const w = world()
    const side = w.offMain()
    git(w.server, 'fetch', '-q', 'origin', 'side')
    expect(target(w, { DEPLOY_TARGET: side }).code).toBe(4)
    w.green(side)
    expect(target(w).code).toBe(4)
  })

  it('وتعذّرُ الوصول إلى origin عابرٌ برقمه — لا يُقرأ فشلا', () => {
    const w = world()
    git(w.server, 'remote', 'set-url', 'origin', join(w.dir, 'gone.git'))
    expect(target(w).code).toBe(2)
  })
})

describe('المراقب — متى يُنشَر', () => {
  it('⚠️ دمجٌ لم تفحصه CI على main لا يُنشَر', () => {
    const w = world()
    w.green(w.first)
    w.merge()
    const r = watch(w, '--check')
    expect(r.code).toBe(0)
    expect(r.out, 'نُشر دمجٌ قبل أن تفرغ منه CI').toContain('لا جديد')
  })

  it('وما اجتازها يُنشَر — ويُسمّى مصدرُه', () => {
    const w = world()
    w.green(w.first)
    const next = w.merge()
    w.green(next)
    const r = watch(w, '--check')
    expect(r.out).toContain(`← ${short(next)} (ci-green)`)
  })

  it('⚠️ ويُسلِّم الناشرَ الالتزامَ الذي قرّره بعينه — لا رأسَ main', () => {
    const w = world()
    const passed = w.merge()
    w.green(passed)
    w.merge()                         // دمجةٌ أحدث لم تفرغ منها CI
    const handed = fakeDeployer(w)
    expect(watch(w).code).toBe(0)
    expect(handed(), 'سُلِّم الناشرُ غيرَ ما اجتاز CI').toBe(passed)
    expect(watch(w, '--check').out, 'نشرةٌ ثانيةٌ لما نُشر').toContain('لا جديد')
  })

  it('والمنشورُ إن سبق ci-green لا يُرجَع عنه', () => {
    const w = world()
    w.green(w.first)
    w.merge()
    git(w.server, 'pull', '-q', '--ff-only', 'origin', 'main')   // نشرةٌ يدويّةٌ لرأس main
    expect(watch(w, '--check').out).toContain('لا جديد')
  })

  it('وقبل أوّل أخضر يُتبَع main كما كان — ويُقال', () => {
    const w = world()
    const head = w.merge()
    expect(watch(w, '--check').out).toContain(`← ${short(head)} (main)`)
  })

  it('وتعذّرُ الوصول لا يُنشَر فيه ولا يُنذَر — يُعاد في الدورة التالية', () => {
    const w = world()
    git(w.server, 'remote', 'set-url', 'origin', join(w.dir, 'gone.git'))
    const r = watch(w, '--check')
    expect(r.code).toBe(0)
    expect(r.out).toContain('تعذّر الوصولُ إلى origin')
  })
})

/* ── العلامة: `gh` مصطنعٌ يحكم كما يحكم GitHub ──

   تاريخٌ خطّيٌّ c1..c5 على main، و`side` التزاماتٌ معروفةٌ خارجَه. والمقارنةُ
   بترتيبه، والكتابةُ بلا `force` تُردّ إن لم تكن تقدّما (٤٢٢ عند GitHub). و`raceTo`
   تشغيلٌ آخرُ يسبق إلى الفرع بين المقارنة والكتابة.

   ⚠️ والخطأُ يُطبع كما يطبعه `gh` الحقيقيّ: **جسمُ الردّ على stdout** ثمّ خروجٌ بواحد
   — و`--jq` لا يُطبَّق عليه. كان المصطنعُ الأوّلُ يخرج صامتا، فمرّت العلامةُ خضراءَ هنا
   واحمرّت على main في أوّل تشغيلٍ لها (٣٠ سبتمبر ٢٠٢٦): قرأت
   `{"message":"Not Found",…}` التزاما، فسألت GitHub المقارنةَ به. */
const GH_STUB = `#!/usr/bin/env node
const fs = require('fs')
const file = process.env.GH_STUB_STATE
const st = JSON.parse(fs.readFileSync(file, 'utf8'))
const a = process.argv.slice(2)
const save = () => fs.writeFileSync(file, JSON.stringify(st))
const done = (out) => { save(); if (out !== undefined) process.stdout.write(out + '\\n'); process.exit(0) }
const refuse = (status, message) => {
  save()
  process.stdout.write(JSON.stringify({ message, documentation_url: 'https://docs.github.com/rest', status: String(status) }) + '\\n')
  process.exit(1)
}
const method = a.includes('-X') ? a[a.indexOf('-X') + 1] : 'GET'
const path = a.find((x, i) => i > 0 && !x.startsWith('-') && !['-X', '-f', '-F', '--jq'].includes(a[i - 1]))
const field = (k) => { for (let i = 0; i < a.length - 1; i++) if (['-f', '-F'].includes(a[i]) && a[i + 1].startsWith(k + '=')) return a[i + 1].slice(k.length + 1) }
const at = (s) => st.order.indexOf(s)
const known = (s) => at(s) >= 0 || (st.side || []).includes(s)
if (method === 'GET' && /\\/git\\/ref\\/heads\\/ci-green$/.test(path)) { if (!st.green) refuse(404, 'Not Found'); done(st.green) }
if (method === 'GET' && /\\/compare\\//.test(path)) {
  const [base, head] = path.split('/compare/')[1].split('...')
  if (!known(base) || !known(head)) refuse(404, 'Not Found')
  done(at(base) < 0 || at(head) < 0 ? 'diverged' : at(base) === at(head) ? 'identical' : at(head) > at(base) ? 'ahead' : 'behind')
}
if (method === 'POST' && /\\/git\\/refs$/.test(path)) { if (st.green) refuse(422, 'Reference already exists'); st.green = field('sha'); done() }
if (method === 'PATCH' && /\\/git\\/refs\\/heads\\/ci-green$/.test(path)) {
  if (st.raceTo) { st.green = st.raceTo; delete st.raceTo }
  const sha = field('sha')
  if (field('force') !== 'true' && at(sha) < at(st.green)) refuse(422, 'Update is not a fast forward')
  st.green = sha; done()
}
process.exit(2)
`

function mark(state: { green?: string; raceTo?: string; side?: string[] }, sha: string) {
  const dir = mkdtempSync(join(tmpdir(), 'wajeez-mark-'))
  mkdirSync(join(dir, 'bin'))
  writeFileSync(join(dir, 'bin/gh'), GH_STUB)
  chmodSync(join(dir, 'bin/gh'), 0o755)
  const file = join(dir, 'state.json')
  writeFileSync(file, JSON.stringify({ order: ['c1', 'c2', 'c3', 'c4', 'c5'], green: null, ...state }))
  const r = spawnSync('bash', [join(root, 'scripts/mark-ci-green.sh'), 'owner/repo', sha], {
    env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, GH_STUB_STATE: file },
    encoding: 'utf8',
  })
  return { code: r.status, green: (JSON.parse(readFileSync(file, 'utf8')) as { green: string | null }).green }
}

describe('scripts/mark-ci-green.sh — العلامة تتقدّم ولا ترجع', () => {
  it('⚠️ أوّلُ أخضرَ يُنشئ الفرع — وجسمُ خطإ GitHub على stdout لا يُقرأ التزاما', () => {
    /* هذا ما أسقط أوّلَ تشغيلٍ على main: الفرعُ غائبٌ، و`gh` يطبع
       `{"message":"Not Found",…}` ويخرج بواحد */
    expect(mark({}, 'c2')).toEqual({ code: 0, green: 'c2' })
  })

  it('والأحدثُ يُقدِّمه', () => {
    expect(mark({ green: 'c2' }, 'c4')).toEqual({ code: 0, green: 'c4' })
  })

  it('⚠️ والأقدمُ لا يُرجعه — تشغيلٌ أبطأُ انتهى بعد أحدثَ منه، وليس فشلا', () => {
    expect(mark({ green: 'c4' }, 'c2')).toEqual({ code: 0, green: 'c4' })
    expect(mark({ green: 'c3' }, 'c3')).toEqual({ code: 0, green: 'c3' })
  })

  it('⚠️ وإن سبقه تشغيلٌ آخرُ بين المقارنة والكتابة لم يُرجعه — يُعيد السؤال', () => {
    expect(mark({ green: 'c2', raceTo: 'c5' }, 'c4')).toEqual({ code: 0, green: 'c5' })
  })

  it('والمتفرّقُ يُقال ولا يُكتب فوقه', () => {
    expect(mark({ green: 'c3', side: ['x9'] }, 'x9')).toEqual({ code: 1, green: 'c3' })
  })

  it('ومقارنةٌ تعذّرت تُقال ولا يُكتب فوقها', () => {
    expect(mark({ green: 'c3' }, 'zz')).toEqual({ code: 1, green: 'c3' })
  })
})

describe('وظيفةُ `green` في CI — تُعلِّم ما اجتاز لا غيرَه', () => {
  type Job = { needs?: string[]; if?: string; permissions?: Record<string, string>; steps?: { run?: string; uses?: string }[] }
  const ci = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')) as { jobs: Record<string, Job> }
  const green = ci.jobs.green
  const runs = (green?.steps ?? []).map((s) => s.run ?? '').join('\n')

  it('⚠️ لا تُعلِّم إلّا بعد نجاح الوظيفتين معا', () => {
    expect(green, 'لا وظيفةَ تُعلِّم ما اجتاز — فلا يتقدّم ما يُنشَر').toBeDefined()
    expect([...(green.needs ?? [])].sort()).toEqual(['fast', 'server'])
    /* ودالّةُ حالٍ في الشرط تُشغّلها ولو سقطت إحداهما */
    expect(green.if ?? '', 'تُعلَّم ولو احمرّت الوظيفتان').not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/)
  })

  it('وعلى main وحدَها — الطلبُ يُفحص ولا يُنشَر منه', () => {
    expect(green.if ?? '').toMatch(/github\.ref == 'refs\/heads\/main'/)
  })

  it('وتُعلِّم الالتزامَ الذي فُحص بعينه', () => {
    expect(runs).toMatch(/scripts\/mark-ci-green\.sh "\$GITHUB_REPOSITORY" "\$GITHUB_SHA"/)
  })

  it('ولا تُعيد فحصا — والكتابةُ لها وحدَها', () => {
    expect(runs, 'الوظيفتان تبقيان اثنتين — لا حزمةٌ ثالثة').not.toMatch(/npm ci|vitest|test:e2e/)
    expect(green.permissions).toEqual({ contents: 'write' })
    for (const name of ['fast', 'server']) {
      expect(JSON.stringify(ci.jobs[name].permissions ?? {}), `${name} لا تكتب`).not.toMatch(/write/)
    }
  })
})
