/* نسخُ ما قبل النشر تُقلَّم — ويبقى أحدثُها، ولا تُمَسّ الليليّة.

   ── العطبُ، وقد أسقط المنصّةَ عشرَ ساعات (٢٤ سبتمبر ٢٠٢٦) ──

   `deploy/backup.sh` كان يقلّم الليليّةَ وحدَها، ونسخُ ما قبل النشر لا يُحذف
   منها شيءٌ قطّ — وكلُّ نشرةٍ تأخذ واحدة، والنشرُ آليٌّ على كلّ دمجة. فبلغت
   ٤١٩ ملفّا بستّةٍ وخمسين غيغابايتا من قرصٍ سعتُه خمسةٌ وسبعون. ثمّ لم تجد
   القاعدةُ ما تكتب فيه ملفَّ قفلها، فسقطت عند كلّ إعادة تشغيل:

     FATAL:  could not write lock file "postmaster.pid": No space left on device

   وكلُّ دخولٍ إلى المنصّة ردّ «خطأ داخلي غير متوقع» — ومنه دخولُ صاحبها
   بحسابه الأعلى، وهو ما جاء يسأل عنه.

   ── ولمَ يُشغَّل السكربتُ هنا ولا يُقرأ نصُّه ──

   الخطرُ في هذا التقليم خطرُ **حذف**: نمطٌ أوسعُ ممّا ينبغي يمحو الليليّة،
   وترتيبٌ مقلوبٌ يُبقي أقدمَ النسخ ويحذف أحدثَها، وصفرٌ في الإعداد يحذف
   النسخةَ التي أُخذت للتوّ قبل الهجرة. وكلُّها تمرّ على قراءة النصّ. فيُشغَّل
   `--prune` فعلا على مجلّدٍ حقيقيّ، و`rclone` مزيَّفٌ يُترجم أوامرَه إلى
   الملفّات نفسِها — ثمّ يُعَدُّ ما بقي على القرص. */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, cpSync,
  readdirSync, readFileSync, utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..')
let box = ''
const store = () => join(box, 'backups')

/* `rclone` مزيَّفٌ يعمل على مجلّدٍ محلّيّ: `lsf` يسرد الملفّاتِ وحدَها،
   و`deletefile` يحذف فعلا — فما يُعَدُّ بعده هو ما فعله السكربت. و`delete`
   (تقليمُ الليليّة بالعمر) لا يُحاكى: لم يتغيّر، وليس موضوعَ هذا الحارس. */
const FAKE_RCLONE = `#!/bin/sh
case "$1" in
  config) exit 0 ;;
  lsf) ls -1p "$2" | grep -v '/$'; exit 0 ;;
  deletefile) rm -f "$2" ;;
  *) exit 0 ;;
esac
`

beforeAll(() => {
  box = mkdtempSync(join(tmpdir(), 'wajeez-prune-'))
  mkdirSync(join(box, 'deploy'), { recursive: true })
  mkdirSync(join(box, 'bin'), { recursive: true })
  cpSync(join(root, 'deploy/backup.sh'), join(box, 'deploy/backup.sh'))
  writeFileSync(join(box, 'bin/rclone'), FAKE_RCLONE)
  chmodSync(join(box, 'bin/rclone'), 0o755)
})
afterAll(() => { if (box) rmSync(box, { recursive: true, force: true }) })

/* ستُّ نشراتٍ بأختامٍ متصاعدة — **وتواريخُ ملفّاتها معكوسة**: الأقدمُ ختما
   أحدثُها تاريخا. فتقليمٌ يرتّب بالتاريخ لا بالاسم يُبقي الأقدمَ ويُحذَف
   الأحدثُ، ويُرى ذلك هنا لا على الخادم. */
const STAMPS = [
  '20260918T100000Z', '20260919T100000Z', '20260920T100000Z',
  '20260921T100000Z', '20260922T100000Z', '20260923T220603Z',
]
const NIGHTLY = ['20260901T020000Z', '20260902T020000Z', '20260923T020000Z']
/* ما وُضع في المجلّد بيدٍ أو بقي من رفعٍ انقطع — يشبه الاسمَ ولا يطابقه */
const STRAYS = [
  'NOTES.txt',
  'wajeez-predeploy-latest.sql.gz',
  'wajeez-predeploy-20260924T010000Z.sql.gz.partial',
]

const seed = () => {
  rmSync(store(), { recursive: true, force: true })
  mkdirSync(store(), { recursive: true })
  STAMPS.forEach((s, i) => {
    const when = new Date(Date.UTC(2026, 8, 30 - i)) // الأقدمُ ختما أحدثُ تاريخا
    for (const f of [`wajeez-predeploy-${s}.sql.gz`, `wajeez-predeploy-${s}-storage.tar.gz`]) {
      writeFileSync(join(store(), f), 'x')
      utimesSync(join(store(), f), when, when)
    }
  })
  for (const s of NIGHTLY) {
    writeFileSync(join(store(), `wajeez-nightly-${s}.sql.gz`), 'x')
    writeFileSync(join(store(), `wajeez-nightly-${s}-storage.tar.gz`), 'x')
  }
  for (const f of STRAYS) writeFileSync(join(store(), f), 'x')
}

const prune = (extraEnv = '') => {
  writeFileSync(
    join(box, 'deploy/.env.production'),
    `BACKUP_REMOTE=${store()}\nBACKUP_REMOTE_ALLOW_LOCAL=yes\n${extraEnv}`,
  )
  const r = spawnSync('bash', ['deploy/backup.sh', '--prune'], {
    cwd: box,
    env: { ...process.env, PATH: `${join(box, 'bin')}:${process.env.PATH}` },
    encoding: 'utf8',
  })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}

const left = () => readdirSync(store())
const stampsOf = (suffix: string) =>
  left()
    .filter((f) => f.startsWith('wajeez-predeploy-') && f.endsWith(suffix))
    .map((f) => f.slice('wajeez-predeploy-'.length, 'wajeez-predeploy-'.length + 16))
    .filter((s) => /^\d{8}T\d{6}Z$/.test(s))
    .sort()

describe('تقليمُ نسخ ما قبل النشر — `backup.sh --prune`', () => {
  it('يبقى أحدثُ ثلاث — بالختم لا بتاريخ الملفّ', () => {
    seed()
    const r = prune()
    expect(r.code, r.err).toBe(0)
    const newest3 = STAMPS.slice(-3)
    expect(stampsOf('Z.sql.gz'), 'بقي غيرُ الأحدث — أو حُذف الأحدث').toEqual(newest3)
    expect(stampsOf('Z-storage.tar.gz'), 'أرشيفُ التخزين يُقلَّم مع قاعدته').toEqual(newest3)
  })

  it('ولا تُمَسّ الليليّة — لها مدّتُها هي', () => {
    seed()
    prune()
    for (const s of NIGHTLY) {
      expect(left(), 'نمطٌ أوسعُ ممّا ينبغي محا نسخةً ليليّة').toContain(`wajeez-nightly-${s}.sql.gz`)
      expect(left()).toContain(`wajeez-nightly-${s}-storage.tar.gz`)
    }
  })

  it('ولا ما يشبه الاسمَ ولا يطابقه — ملفٌّ بيدٍ أو رفعٌ انقطع', () => {
    seed()
    prune()
    for (const f of STRAYS) expect(left(), `حُذف ما ليس نسخةً: ${f}`).toContain(f)
  })

  it('والصفرُ لا يحذف النسخةَ التي أُخذت للتوّ — يبقى الأحدثُ على الأقلّ', () => {
    seed()
    const r = prune('BACKUP_KEEP_PREDEPLOY=0\n')
    expect(r.code, r.err).toBe(0)
    expect(stampsOf('Z.sql.gz'), 'حُذفت نسخةُ ما قبل الهجرة الأخيرة').toEqual(STAMPS.slice(-1))
  })

  it('والعددُ يُضبط — وما ليس رقما يعود إلى الثلاث', () => {
    seed()
    prune('BACKUP_KEEP_PREDEPLOY=5\n')
    expect(stampsOf('Z.sql.gz')).toEqual(STAMPS.slice(-5))
    seed()
    prune('BACKUP_KEEP_PREDEPLOY=abc\n')
    expect(stampsOf('Z.sql.gz')).toEqual(STAMPS.slice(-3))
  })

  it('ووجهةٌ بلا نسخةٍ قبل نشرٍ بعدُ ليست عطبا', () => {
    rmSync(store(), { recursive: true, force: true })
    mkdirSync(store(), { recursive: true })
    const r = prune()
    expect(r.code, r.err).toBe(0)
  })

  it('ويُقال ما حُذف — لا تقليمٌ صامت', () => {
    seed()
    const r = prune()
    expect(r.out).toContain(`حُذف: wajeez-predeploy-${STAMPS[0]}.sql.gz`)
    expect(r.out).toContain('بقي من نسخ ما قبل النشر أحدثُ 3')
  })
})

/* والتقليمُ يقع في كلّ أخذٍ لا في `--prune` وحدَه — وإلّا بقي العطبُ كما هو
   على الخادم: النشرُ يأخذ، ولا أحدَ يشغّل `--prune` بيده. ويقع **بعد** رفع
   النسخة الجديدة: لا يُحذف قديمٌ قبل أن يُكتب جديدٌ سليم. وهذا ترتيبٌ لا
   يُشغَّل هنا (يلزمه Docker وقاعدة) فيُقرأ من الشيفرة بلا تعليقاتها. */
describe('وفي كلّ نسخةٍ تُؤخذ', () => {
  const code = readFileSync(join(root, 'deploy/backup.sh'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('#'))

  it('يُقلَّم بعد رفع النسختين — لا قبلهما', () => {
    const upload = code.findIndex((l) => l.includes('rclone copy "$WORK/$STORE_FILE"'))
    const call = code.map((l, i) => (/^\s*prune_all\s*$/.test(l) ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    expect(upload, 'رفعُ أرشيف التخزين غائب').toBeGreaterThan(-1)
    expect(call, 'لا تقليمَ بعد الأخذ — النسخُ تتراكم كما تراكمت').toBeGreaterThan(upload)
  })
})
