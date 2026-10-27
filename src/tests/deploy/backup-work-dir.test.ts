/* مجلّدُ عمل النسخة على القرص لا في `/tmp` — ونسخةُ القاعدة تُحذف منه حين تُرفع (٢٧ أكتوبر ٢٠٢٦).

   ── العطبُ، وقد أوقف كلَّ نشرٍ يوما ──

   `deploy/backup.sh` كان يعمل في `mktemp -d` — أي `/tmp`، وهو في Ubuntu الحديث tmpfs في الذاكرة
   (١٫٩ غيغابايتا على خادم الإنتاج). ونسخةُ القاعدة (١٫٣) تبقى فيه حتّى الخروج، ثمّ يُكتب أرشيفُ
   التخزين (٠٫٦) بجانبها فيمتلئ:

     write /dev/stdout: no space left on device
     ✗ تعذّرت أرشفةُ حجم التخزين

   والقرصُ فيه سبعةَ عشرَ غيغابايتا. فوقف كلُّ نشرٍ منذ صباحه، ولم تُؤخذ نسخةُ تلك الليلة.

   ── ولمَ يُشغَّل السكربتُ هنا ولا يُقرأ نصُّه ──

   «حُذفت نسخةُ القاعدة قبل الأرشيف» ترتيبٌ لا يُرى في سطرٍ واحد. فيُشغَّل الأخذُ فعلا بـ`docker`
   و`rclone` مزيَّفَين، وأرشفةُ التخزين **تسقط كما سقطت على الخادم** إن وجدت نسخةَ القاعدة باقيةً
   في مجلّد العمل. */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, cpSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..')
let box = ''
const store = () => join(box, 'backups')
const work = () => join(box, 'work')

/* `docker` مزيَّف: `pg_dump` يُخرج بايتاتٍ عشوائيّة (لا تنضغط فتتجاوز حدَّ «النسخة الفارغة»)، و`tar`
   يسقط إن بقي في مجلّد العمل ملفُّ ‎.sql.gz — وهو ما فعله tmpfs الممتلئ على الخادم */
const FAKE_DOCKER = `#!/bin/sh
case "$*" in
  *pg_dump*) head -c 20000 /dev/urandom ;;
  *tar*)
    if find "$WAJEEZ_TEST_WORK" -name '*.sql.gz' | grep -q .; then
      echo "write /dev/stdout: no space left on device" >&2; exit 1
    fi
    head -c 3000 /dev/urandom ;;
  *) exit 0 ;;
esac
`
/* و`rclone` مزيَّفٌ على مجلّدٍ محلّيّ — `copy` ينسخ فعلا، فيُعَدّ ما وصل الوجهة */
const FAKE_RCLONE = `#!/bin/sh
case "$1" in
  copy) cp "$2" "$3/" ;;
  lsf) ls -1p "$2" | grep -v '/$'; exit 0 ;;
  deletefile) rm -f "$2" ;;
  *) exit 0 ;;
esac
`

beforeAll(() => {
  box = mkdtempSync(join(tmpdir(), 'wajeez-work-'))
  for (const d of ['deploy', 'bin', 'backups', 'work']) mkdirSync(join(box, d), { recursive: true })
  cpSync(join(root, 'deploy/backup.sh'), join(box, 'deploy/backup.sh'))
  writeFileSync(join(box, 'bin/docker'), FAKE_DOCKER)
  writeFileSync(join(box, 'bin/rclone'), FAKE_RCLONE)
  chmodSync(join(box, 'bin/docker'), 0o755)
  chmodSync(join(box, 'bin/rclone'), 0o755)
  writeFileSync(join(box, 'deploy/.env.production'), [
    `BACKUP_REMOTE=${store()}`, 'BACKUP_REMOTE_ALLOW_LOCAL=yes', `BACKUP_WORK_DIR=${work()}`,
    'POSTGRES_USER=wajeez', 'POSTGRES_DB=wajeez', '',
  ].join('\n'))
})
afterAll(() => { if (box) rmSync(box, { recursive: true, force: true }) })

describe('نسخةُ ما قبل النشر تُؤخذ كاملة ولو ضاق مجلّدُ العمل', () => {
  it('⚠️ القاعدةُ والتخزينُ يصلان الوجهة — ونسخةُ القاعدة خرجت من مجلّد العمل قبل الأرشيف', () => {
    const r = spawnSync('bash', ['deploy/backup.sh', '--pre-deploy'], {
      cwd: box, encoding: 'utf8',
      env: { ...process.env, PATH: `${join(box, 'bin')}:${process.env.PATH}`, WAJEEZ_TEST_WORK: work() },
    })
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0)
    const got = readdirSync(store())
    expect(got.filter((f) => /^wajeez-predeploy-\d{8}T\d{6}Z\.sql\.gz$/.test(f)), 'لم تصل نسخة القاعدة').toHaveLength(1)
    expect(got.filter((f) => /^wajeez-predeploy-\d{8}T\d{6}Z-storage\.tar\.gz$/.test(f)), 'لم يصل أرشيف التخزين').toHaveLength(1)
    /* وفي مجلّد العمل المعطى — لا في /tmp — ويُكنَس بعد الخروج */
    expect(readdirSync(work()), 'بقي مجلد العمل بعد الخروج').toEqual([])
  })

  it('⚠️ ومجلّدُ العمل على القرص افتراضا (`/var/tmp`) — لا `mktemp -d` في /tmp', () => {
    const src = readFileSync(join(root, 'deploy/backup.sh'), 'utf8')
    expect(src).toMatch(/^WORK="\$\(mktemp -d -p "\$\{BACKUP_WORK_DIR:-\/var\/tmp\}"\)"$/m)
    expect(src, 'عاد مجلد العمل إلى /tmp').not.toMatch(/^WORK="\$\(mktemp -d\)"$/m)
  })

  /* «Keep 7 nights» — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): الليلةُ نحوُ ١٫٩ غيغابايتا، وثلاثون تملأ القرص */
  it('⚠️ والليلية سبع ليال افتراضا — في السكربت ومثال الإعداد', () => {
    const src = readFileSync(join(root, 'deploy/backup.sh'), 'utf8')
    expect(src).toMatch(/local keep="\$\{BACKUP_KEEP_DAYS:-7\}"/)
    expect(readFileSync(join(root, 'deploy/.env.production.example'), 'utf8')).toMatch(/^BACKUP_KEEP_DAYS=7$/m)
  })
})
