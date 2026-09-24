/* القرصُ الممتلئ لا يُسقط الموقعَ بعد اليوم — يُسأل قبل النشر، ويُكنَس بعده.

   ── ما وقع (٢٤ سبتمبر ٢٠٢٦) ──

   امتلأ قرصُ الخادم في منتصف نشرة: ٧٢ من ٧٥ غيغابايتا، والمتاحُ صفر.
   ستّةٌ وخمسون منها نسخُ ما قبل النشر (يحرس تقليمَها `backup-prune.test.ts`)،
   وأحدَ عشرَ ذاكرةُ بناءٍ لم يكنسها شيء. فلم تجد القاعدةُ ما تكتب فيه ملفَّ
   قفلها، وبقيت تسقط عشرَ ساعات، وكلُّ دخولٍ ردّ «خطأ داخلي غير متوقع».

   **والنشرةُ هي التي أسقطت الموقعَ الذي جاءت لتحدّثه** — فالحارسُ هنا أن
   تُرفض قبل أن تبدأ، لا أن تكتشف في منتصفها أنّها لا تسع.

   ── ولمَ يُشغَّل الفحصُ ويُقرأ النشر ──

   `deploy/preflight-disk.sh` مستقلٌّ ليُشغَّل وحدَه — كأخيه `preflight-env.sh`
   — فيُقاس رقمُ خروجه على `df` مزيَّفٍ بالأرقام التي وقعت. أمّا موضعُه من
   النشر وكنسُ ما بعده فيلزم تشغيلَهما Docker وخادم، فيُقرآن من الشيفرة بلا
   تعليقاتها ولا رسائلها، كما يُقرأ سائرُ `deploy.sh` في
   `production-deploy-steps.test.ts`. */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, cpSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..')
const GB = 1024 * 1024 // بالكيلوبايت، كما يقرؤها `df -Pk`
let box = ''

/* `df` مزيَّفٌ يقول ما نريد، و`docker` مزيَّفٌ يسقط — فلا يُسأل Docker الحقيقيّ
   عن جذره، ويُقاس الرجوعُ إلى `/` معه */
beforeAll(() => {
  box = mkdtempSync(join(tmpdir(), 'wajeez-disk-'))
  mkdirSync(join(box, 'deploy'), { recursive: true })
  mkdirSync(join(box, 'bin'), { recursive: true })
  cpSync(join(root, 'deploy/preflight-disk.sh'), join(box, 'deploy/preflight-disk.sh'))
  writeFileSync(join(box, 'bin/df'), `#!/bin/sh
if [ -n "$FAKE_DF_RAW" ]; then printf '%s\\n' "$FAKE_DF_RAW"; exit 0; fi
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/sda1 78643200 1 $FAKE_AVAIL_KB 1% /"
`)
  writeFileSync(join(box, 'bin/docker'), '#!/bin/sh\nexit 1\n')
  chmodSync(join(box, 'bin/df'), 0o755)
  chmodSync(join(box, 'bin/docker'), 0o755)
})
afterAll(() => { if (box) rmSync(box, { recursive: true, force: true }) })

const check = (availKb: number | null, opts: { env?: Record<string, string>; file?: string; raw?: string } = {}) => {
  rmSync(join(box, 'deploy/.env.production'), { force: true })
  if (opts.file !== undefined) writeFileSync(join(box, 'deploy/.env.production'), opts.file)
  const env: Record<string, string | undefined> = {
    ...process.env,
    PATH: `${join(box, 'bin')}:${process.env.PATH}`,
    FAKE_AVAIL_KB: String(availKb ?? 0),
    FAKE_DF_RAW: opts.raw ?? '',
    ...opts.env,
  }
  if (!opts.env?.DEPLOY_MIN_FREE_GB) delete env.DEPLOY_MIN_FREE_GB
  const r = spawnSync('bash', ['deploy/preflight-disk.sh'], { cwd: box, env, encoding: 'utf8' })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}

describe('الفحصُ قبل النشر — `deploy/preflight-disk.sh`', () => {
  it('يُرفض النشرُ على قرصٍ لا متّسعَ فيه — وهي أرقامُ يوم السقوط', () => {
    const r = check(0)
    expect(r.code, 'مرّت نشرةٌ على قرصٍ متاحُه صفر — وهي التي أسقطت القاعدة').toBe(1)
    expect(r.err).toContain('القرصُ يكاد يمتلئ')
    expect(r.err, 'الرفضُ لا يطمئن إلى أنّ الموقعَ باقٍ').toContain('لم يُلمَس شيء')
    expect(r.err, 'رفضٌ بلا مخرج — ولا يُسمّى ما ملأه').toContain('backup.sh --prune')
  })

  it('ويمرّ على قرصٍ فيه متّسع — وهو حالُه بعد التنظيف', () => {
    const r = check(59 * GB)
    expect(r.code, r.err).toBe(0)
    expect(r.out).toContain('59GB')
  })

  it('والحدُّ خمسةٌ: خمسةٌ بالضبط تمرّ، وما دونها بكيلوبايتٍ لا', () => {
    expect(check(5 * GB).code).toBe(0)
    expect(check(5 * GB - 1).code, 'ما دون الحدّ مرّ').toBe(1)
  })

  it('والحدُّ يُضبط — من البيئة، ومن ملفّ بيئة الإنتاج', () => {
    expect(check(20 * GB, { env: { DEPLOY_MIN_FREE_GB: '30' } }).code, 'متغيّرُ البيئة لم يُقرأ').toBe(1)
    expect(check(20 * GB, { file: 'DEPLOY_MIN_FREE_GB=30\n' }).code, 'ملفُّ البيئة لم يُقرأ').toBe(1)
    expect(check(20 * GB, { file: 'DEPLOY_MIN_FREE_GB=كثير\n' }).code, 'ما ليس رقما لا يعود إلى الخمسة').toBe(0)
  })

  it('وتعذُّرُ القياس لا يوقف النشر — حارسٌ معطوبٌ يوقف كلَّ نشرةٍ أسوأُ من غيابه', () => {
    const r = check(null, { raw: 'df: cannot read table of mounted file systems' })
    expect(r.code).toBe(0)
    expect(r.err, 'مُضي بلا فحصٍ ولم يُقَل').toContain('تعذّر قياسُ')
  })
})

/* ── النشرُ نفسُه: متى يُسأل، ومتى يُكنَس ── */

const read = (f: string) => readFileSync(join(root, f), 'utf8')
/** بلا التعليقات ولا الرسائل — فذِكرُ الأمر في شرحٍ أو نصيحةٍ ليس تنفيذا له */
const commands = (s: string) =>
  s.split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .filter((l) => !/^\s*(echo|printf)\b/.test(l))
    .join('\n')

describe('وموضعُه من النشر — `deploy/deploy.sh`', () => {
  const sh = commands(read('deploy/deploy.sh'))
  const at = (s: string) => sh.indexOf(s)

  it('يُسأل القرصُ قبل أن يُلمَس شيء — قبل السحب والنسخ والبناء والقاعدة', () => {
    const disk = at('bash deploy/preflight-disk.sh')
    expect(disk, 'لا فحصَ للقرص في النشر').toBeGreaterThan(-1)
    for (const step of ['git pull --ff-only', 'backup.sh --pre-deploy', 'build app', 'up -d db']) {
      expect(at(step), `الخطوةُ «${step}» غائبة`).toBeGreaterThan(-1)
      expect(disk, `القرصُ يُسأل بعد «${step}» — وقد لُمس شيء`).toBeLessThan(at(step))
    }
  })

  it('ورفضُه يوقف النشر — لا يُقال ثمّ يُمضى', () => {
    expect(sh).toMatch(/bash deploy\/preflight-disk\.sh\s*\|\|\s*exit 1/)
  })

  it('ويُكنَس ما تتركه النشرةُ بعد أن يجيب الخادمُ الجديد — لا قبل', () => {
    const answered = at('if [ "$internal" != 1 ]')
    expect(answered, 'الفحصُ الداخليّ غائب').toBeGreaterThan(-1)
    for (const sweep of ['docker image prune', 'docker builder prune']) {
      expect(at(sweep), `لا «${sweep}» — وبلغت ذاكرةُ البناء ١١ غيغابايتا بلا كنس`).toBeGreaterThan(-1)
      expect(at(sweep), `«${sweep}» قبل أن يجيب الخادمُ الجديد`).toBeGreaterThan(answered)
      expect(at(sweep)).toBeGreaterThan(at('up -d --remove-orphans'))
    }
  })

  it('وتعذُّرُ الكنس لا يُسقط نشرةً نجحت — `set -e` كان سيجعله فشلا', () => {
    expect(sh, 'حذفُ الصور بلا مخرجٍ من فشله').toMatch(/docker image prune[^\n]*\\\n\s*\|\|/)
    expect(sh, 'كنسُ ذاكرة البناء بلا مخرجٍ من فشله').toMatch(/docker builder prune[^\n]*\\\n\s*\|\|/)
  })
})

/* وأخطرُ ما قد يُكتب في ساعةِ قرصٍ ممتلئ: أمرُ تنظيفٍ يمسّ الأحجام. فيها
   القاعدةُ والملفّاتُ المرفوعة — ولا نسخةَ خارجَ الخادم إلّا لقطةُ Hetzner.
   فلا يدخل أحدَ هذه السكربتات أمرٌ منها، ولا نصيحةٌ به في رسائلها. */
describe('ولا تنظيفَ يمسّ الأحجام', () => {
  const DESTROYS_VOLUMES = /volume\s+(prune|rm)\b|--volumes\b|\bdown\s+(-v|--volumes)\b|system\s+prune/
  for (const f of ['deploy/deploy.sh', 'deploy/backup.sh', 'deploy/preflight-disk.sh']) {
    it(`${f} لا يحمل أمرا يمحو حجما`, () => {
      const lines = read(f).split('\n').filter((l) => !l.trim().startsWith('#'))
      const hit = lines.find((l) => DESTROYS_VOLUMES.test(l))
      expect(hit, `أمرٌ يمحو الأحجام — ومعها القاعدة: ${hit}`).toBeUndefined()
    })
  }
})
