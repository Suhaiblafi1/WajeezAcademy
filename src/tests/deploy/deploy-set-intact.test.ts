/* مجموعةُ `deploy/` لا يسقط منها ملفٌّ صامتا.

   ── العطبُ الذي وقع فعلا، ورُجع عنه ──

   حُذف `deploy/` كاملا مرّةً بمقدّمةٍ مكتوبةٍ في رسالة الالتزام: «تصميمُ
   الخادم الذاتيّ لم يُستعمل قطّ في الإنتاج». **وكان ذلك ادّعاءً لا قياسا** —
   وهو خادمُ الإنتاج الحيُّ نفسُه. ورُجع عن الحذف، وكُتب التصويبُ في صدر
   `docs/DEPLOYMENT.md`.

   والمقدّمةُ نفسُها ما زالت مكتوبةً في فرعٍ مفتوحٍ على المستودَع اليوم
   (`claude/remove-legacy-hosting-artifacts`). فالخطرُ ليس نظريّا: عنوانُ
   ذلك الالتزام «إزالةُ أدوات استضافةٍ ميّتة» — يُقرأ تنظيفا فيُدمج بحسن نيّة.

   ── ولماذا حارسٌ في `main` لا حذفُ الفرع ──

   حذفُ الفرع يعالج طريقا واحدا. وهذا يعالج **كلَّ الطرق**: أيّا كان من
   يُسقط ملفّا من `deploy/` — فرعٌ قديم، جلسةٌ أخرى، أنا في جلسةٍ قادمة —
   تحمرّ البوّابةُ قبل أن يصل `main`.

   ── وأخطرُ ما يحرسه صامتٌ تماما ──

   ثلاثةُ ملفّاتٍ لم يكن يقرؤها حارس: `docker-entrypoint.sh` (نقطةُ دخول
   الحاوية)، و`wajeez-backup.service` و`.timer` (مؤقّتُ النسخ الاحتياطيّ).

   وسقوطُ المؤقّت **لا يكسر شيئا يُرى**: الموقعُ يعمل، والبناءُ ينجح،
   والاختباراتُ خضراء — وتتوقّف النسخُ. ولا يُكتشف ذلك حتّى تُطلب نسخةٌ
   ولا توجد. وعليها يقوم البند ٦٦: «إعادةُ ضبط الحسابات» تمتنع بلا إثبات
   استعادةٍ حديث.

   ── والفحصُ مشتقٌّ لا مكتوبٌ باليد ──

   كلُّ مسارٍ يُفحص هنا **يُنتزع من ملفٍّ يشير إليه فعلا**: `ENTRYPOINT` في
   `Dockerfile`، و`ExecStart` في وحدة systemd، والمسارات في `deploy.sh`.
   فمن نقل ملفّا وحدّث مرجعَه يمرّ، ومن حذفه يسقط.

   وهذا مقصود: كتبتُ في هذه الجلسة نقدا لحارسٍ قائمته **مكتوبةٌ بيدها**
   (`verify-mirrors-ci`) فكان يفحص أربعا من اثنتَي عشرةَ ويُقرأ كأنّه يفحصها
   كلَّها. فلا يُكرَّر العطبُ هنا. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const here = (p: string) => existsSync(join(root, p))

describe('مجموعةُ deploy/ — كلُّ مُشارٍ إليه موجود', () => {
  it('نقطةُ دخول الحاوية التي يسمّيها Dockerfile موجودة', () => {
    /* `ENTRYPOINT ["/sbin/tini", "--", "/app/deploy/docker-entrypoint.sh"]`
       — المسارُ داخل الصورة، و`/app` هو `WORKDIR` أي جذرُ المستودَع. */
    const m = read('Dockerfile').match(/ENTRYPOINT\s*\[([^\]]+)\]/)
    expect(m, 'لا ENTRYPOINT في Dockerfile').toBeTruthy()
    const scripts = [...m![1].matchAll(/"\/app\/([^"]+)"/g)].map((x) => x[1])
    expect(scripts.length, 'ENTRYPOINT لا يسمّي سكربتا من المستودَع').toBeGreaterThan(0)
    for (const s of scripts) {
      expect(here(s), `${s} يسمّيه ENTRYPOINT ولا وجودَ له — الحاويةُ لا تُقلع`).toBe(true)
    }
  })

  it('ولكلّ مؤقّتٍ خدمتُه، ولكلّ خدمةٍ سكربتُها', () => {
    const units = readdirSync(join(root, 'deploy')).filter((f) => f.endsWith('.timer'))
    expect(units.length, 'لا مؤقّتَ نسخٍ احتياطيّ البتّة').toBeGreaterThan(0)
    for (const timer of units) {
      /* systemd يقرن المؤقّتَ بخدمةٍ باسمه الأساسيّ — فغيابُها يجعل المؤقّتَ
         يعمل ولا يشغّل شيئا: أهدأُ عطبٍ ممكن. */
      const service = timer.replace(/\.timer$/, '.service')
      expect(here(`deploy/${service}`), `${timer} بلا ${service} — يعمل ولا ينفّذ شيئا`).toBe(true)

      const exec = read(`deploy/${service}`).match(/^ExecStart=.*?\s(\S*deploy\/\S+)/m)
      expect(exec, `${service} بلا ExecStart يسمّي سكربتا في deploy/`).toBeTruthy()
      expect(
        here(exec![1]),
        `${service} ينفّذ ${exec![1]} ولا وجودَ له — تتوقّف النسخُ بلا أن يحمرّ شيء`,
      ).toBe(true)
    }
  })

  it('وكلُّ مسارٍ يسمّيه سكربتُ النشر موجود', () => {
    /* `.env.production` مستثنًى: أسرارٌ لا تُلتزَم في Git أبدا (CLAUDE.md)،
       ومثالُه `‎.env.production.example` هو ما يُلتزَم. */
    const named = [...read('deploy/deploy.sh').matchAll(/\bdeploy\/[A-Za-z0-9._-]+/g)]
      .map((m) => m[0])
      .filter((p) => !p.endsWith('.env.production'))
    expect(named.length, 'السكربتُ لا يسمّي شيئا — تغيّرت بنيتُه').toBeGreaterThan(1)
    for (const p of [...new Set(named)]) {
      expect(here(p), `deploy.sh يسمّي ${p} ولا وجودَ له`).toBe(true)
    }
  })

  it('وملفُّ Caddy الذي يركّبه compose موجود', () => {
    /* `- ./Caddyfile:/etc/caddy/Caddyfile:ro` — النسبيُّ إلى مجلّد compose */
    const mounts = [...read('deploy/compose.prod.yml').matchAll(/^\s*-\s*\.\/([A-Za-z0-9._-]+):/gm)]
      .map((m) => m[1])
    expect(mounts.length, 'compose لا يركّب ملفّا من deploy/').toBeGreaterThan(0)
    for (const f of [...new Set(mounts)]) {
      expect(here(`deploy/${f}`), `compose يركّب deploy/${f} ولا وجودَ له`).toBe(true)
    }
  })
})
