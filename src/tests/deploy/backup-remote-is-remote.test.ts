/* النسخةُ الاحتياطيّةُ تكون خارجَ الخادم — أو لا تكون.

   ── العطبُ، وقد وقع في الإنتاج ──

   `deploy/backup.sh` كان يسأل عن `BACKUP_REMOTE` سؤالا واحدا: **أفارغٌ هو؟**
   وعلى خادم وجيز كان مضبوطا على `/var/backups/wajeez` — مسارٌ على القرص
   نفسِه الذي يحمل القاعدة. فمرّ الفحصُ، ونسخ `rclone` إليه بلا شكوى، وطبع
   السكربتُ:

     ✓ رُفعت wajeez-nightly-…sql.gz (60M) إلى /var/backups/wajeez
     ✓ النسخ الاحتياطي مُثبَت. أعد هذا الاختبار شهريا.

   ستّون ميغابايتا من قاعدة الإنتاج، منسوخةً إلى القرص الذي جاءت منه،
   معلَنةً نسخةً مُثبَتة. ورأسُ السكربت نفسِه يحذّر من هذا حرفا: «السكربتُ
   الذي يكتب محليا ويقول «تمّ» أخطرُ من غيابه: يمنح طمأنينةً لا يسندها شيء».
   فكان يفعلها، ولا شيءَ يمنعه.

   ── ولمَ هو أخطرُ من ضياع نسخة ──

   `--verify` يكتب **إثباتَ الاسترجاع**، وهو الحارسُ الأوّلُ على «إعادة ضبط
   الحسابات» — محوُ حسابات الناس ومعاملاتِهم، **ولا رجعةَ فيه**
   (`account-reset.service.ts`: «قبل كلّ شيء، فبدونه لا معنى لبقيّة
   الحرّاس»). فنسخةٌ تموت مع الخادم كانت تفتح بابَ محوٍ لا رجعةَ عنه.

   ── ولمَ يُشغَّل السكربتُ هنا ولا يُقرأ نصُّه ──

   `production-deploy-steps.test.ts` يقول في رأسه إنّ قراءةَ النصّ تُثبت أنّ
   الأمرَ **مكتوب** لا أنّه **يعمل** — وضربَ مثلا حارسا اخضرّ على `.htaccess`
   لا يقرؤه الخادمُ أصلا. وهذا الحارسُ يقع قبل أيّ حاجةٍ إلى Docker، فيُشغَّل
   فعلا برمزِ خروجٍ يُقاس: الرفضُ يُرى واقعا لا مكتوبا. */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..')
let box = ''

/** بيئةٌ معزولةٌ فيها السكربتُ و`rclone` مزيَّفٌ — فلا شبكةَ ولا Docker */
beforeAll(() => {
  box = mkdtempSync(join(tmpdir(), 'wajeez-backup-'))
  mkdirSync(join(box, 'deploy'), { recursive: true })
  mkdirSync(join(box, 'bin'), { recursive: true })
  cpSync(join(root, 'deploy/backup.sh'), join(box, 'deploy/backup.sh'))
})
afterAll(() => { if (box) rmSync(box, { recursive: true, force: true }) })

/** `rclone` مزيَّف: `hasConfig=false` يحاكي غيابَ ملفّ الإعداد */
const fakeRclone = (hasConfig: boolean) => {
  const p = join(box, 'bin/rclone')
  writeFileSync(p, hasConfig
    ? '#!/bin/sh\nexit 0\n'
    : '#!/bin/sh\n[ "$1" = "config" ] && [ "$2" = "file" ] && exit 1\nexit 0\n')
  chmodSync(p, 0o755)
}

/** يشغّل السكربتَ ببيئةٍ مُعطاة ويردّ ما خرج */
const run = (env: string, hasConfig = true) => {
  writeFileSync(join(box, 'deploy/.env.production'), env)
  fakeRclone(hasConfig)
  const r = spawnSync('bash', ['deploy/backup.sh'], {
    cwd: box,
    env: { ...process.env, PATH: `${join(box, 'bin')}:${process.env.PATH}` },
    encoding: 'utf8',
  })
  return { code: r.status, err: r.stderr ?? '', out: r.stdout ?? '' }
}

describe('وجهةُ النسخ خارجَ الخادم', () => {
  it('يُرفض المسارُ المحلّيُّ — وهو ما كان مضبوطا في الإنتاج', () => {
    const r = run('BACKUP_REMOTE=/var/backups/wajeez\n')
    expect(
      r.code,
      'مرّ مسارٌ محلّيّ: ستّون ميغابايتا من القاعدة تُنسخ إلى القرص نفسِه، '
      + 'ويُعلَن ذلك «نسخةً مُثبَتة» — ويفتح إثباتُها بابَ محوٍ لا رجعةَ فيه.',
    ).toBe(1)
    expect(r.err).toContain('ليس وجهةً بعيدة')
  })

  it('ويُقال لماذا، وكيف يُصلَح — لا رفضٌ بلا مخرج', () => {
    const r = run('BACKUP_REMOTE=/var/backups/wajeez\n')
    expect(r.err, 'الخطرُ لا يُسمّى').toContain('إعادة ضبط')
    expect(r.err, 'لا وصفةَ للإصلاح').toContain('rclone config create')
  })

  it('ووجهةٌ بصيغةٍ بعيدةٍ بلا إعدادِ rclone تُرفض كذلك', () => {
    /* المصيدةُ العمليّة: يُغيَّر المتغيّرُ ولا تُنشأ الوجهةُ فعلا */
    const r = run('BACKUP_REMOTE=wajeez-backup:wajeez\n', false)
    expect(r.code, 'اسمٌ يبدو بعيدا بلا وجهةٍ خلفَه يمرّ').toBe(1)
    expect(r.err).toContain('لا ملفَّ إعدادٍ لـrclone')
  })

  it('والوجهةُ البعيدةُ الحقيقيّةُ تعبر الحارس', () => {
    const r = run('BACKUP_REMOTE=wajeez-backup:wajeez\n', true)
    /* تتجاوز الحارسَ ثمّ تسقط على ما بعده (لا قاعدةَ ولا Docker هنا) —
       والمقصودُ أنّها **تجاوزته**، فلا يُذكر رفضُه في الخرج. */
    expect(r.err).not.toContain('ليس وجهةً بعيدة')
    expect(r.err).not.toContain('لا ملفَّ إعدادٍ لـrclone')
  })

  it('والمسارُ المحلّيُّ المأذونُ به صراحةً يمرّ بتحذير — للتجهيز الشبكيّ المركوب', () => {
    const r = run('BACKUP_REMOTE=/mnt/storagebox\nBACKUP_REMOTE_ALLOW_LOCAL=yes\n')
    expect(r.err, 'الإذنُ الصريحُ لا يُقبل').not.toContain('ليس وجهةً بعيدة')
    expect(r.err, 'يمرّ صامتا — والإذنُ يُذكَّر به').toContain('أُذن به صراحةً')
  })
})
