/* لا يُنشَر على قرصٍ ممتلئ — وحارسُ ذلك يُشغَّل لا يُقرأ.

   ── العطبُ الذي يحرسه، وقد وقع ──

   `deploy.sh` يبني صورةً جديدةً في كلّ نشرة ولا يُسقط قديما. فتتراكم الصورُ
   المعلَّقةُ وذاكرةُ البناء بلا حدّ، وخمسُ نشراتٍ في مساءٍ واحدٍ تملأ قرصا
   صغيرا.

   وحين يمتلئ يقع أمران معا فيُقرآن عطبَين منفصلَين:

   · **القاعدةُ لا تُقلع**، واسمُ `db` لا يُحَلُّ ما دامت حاويتُه واقفة —
     فيردّ الخادمُ `EAI_AGAIN` على كلّ مسارٍ يمسّها. ويُقرأ خطأَ شبكة.
   · **والبناءُ يفشل**، فتقف كلُّ نشرةٍ عند الخطوة ٣ بتصميمها، والحاوياتُ
     القديمةُ تبقى تخدم الصفحاتِ الساكنة. فالموقعُ يبدو حيّا وواجهتُه ميّتة،
     **ويُدمج أخضرُ بعد أخضرَ ولا يبلغ الخادمَ منها شيء**.

   وقع في الإنتاج ليلةَ ٢٣ سبتمبر ٢٠٢٦: عشرُ ساعاتٍ والواجهةُ ترد 500، وثلاثُ
   دمجاتٍ خضراءَ لم تصل.

   ── ولمَ يُشغَّل الفحصُ ولا يُطابَق نصُّه ──

   كما في `app-url-required`: تُشغَّل البوّابةُ فعلا على مسارٍ حقيقيٍّ بحدَّين
   مختلفَين، ويُقرأ رقمُ خروجها. فإن حُذفت أو عُطّلت أو كُتبت بحيث لا تسقط —
   حمرّ هذا. ومطابقةُ نصٍّ في ملفٍّ تمرّ على تعليقٍ يذكر الاسم ولا تشغّل شيئا. */

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PREFLIGHT = join(root, 'deploy/preflight-disk.sh')

/** يُشغّل البوّابةَ على مسارٍ بحدٍّ أدنى — يعيد رقمَ الخروج وما قالته */
function runPreflight(target: string, minMb: string): { code: number; out: string } {
  try {
    const out = execFileSync('bash', [PREFLIGHT, target, minMb], { encoding: 'utf8', stdio: 'pipe' })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stderr?: string; stdout?: string }
    return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

/** أسطرُ ملفٍّ العاملةُ وحدَها — بلا تعليقاتٍ ولا فراغ.

    وهذا شرطُ صحّةِ ما بعده: رأسُ `preflight-disk.sh` وتعليقاتُ `deploy.sh`
    تذكر `--volumes` صراحةً لتحذّر منه. فحارسٌ يقرأ الملفّ كما هو يمرّ على
    تحذيرٍ ويحسبه أمرا، أو يحمرّ على تعليقٍ سليم. */
const runnable = (rel: string) =>
  readFileSync(join(root, rel), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))

describe('البوّابةُ تقيس المساحةَ وتحكم', () => {
  it('تمرّ حين تكفي المساحة', () => {
    expect(runPreflight(root, '1').code, 'سقطت على قرصٍ فيه متّسع').toBe(0)
  })

  /* والنقضُ هنا حدٌّ لا يبلغه قرص: لو كُتبت البوّابةُ بحيث تمرّ دائما —
     بـ`exit 0` مبكّر أو بمقارنةٍ مقلوبة — لَمرّت هذه وحمرّ الحارس. */
  it('وتسقط حين لا تكفي، وتقول كم بقي وكم يلزم', () => {
    const r = runPreflight(root, '999999999')
    expect(r.code, 'مرّ نشرٌ على قرصٍ لا يتّسع للبناء').not.toBe(0)
    expect(r.out, 'سقطت بلا أن تقول الحدَّ المطلوب').toContain('999999999')
    /* وتدلّ على النسخ قبل Docker: يومَ امتلأ القرصُ كانت نسخُ ما قبل النشر
       ٥٦ غيغابايتا من ٧٢ وDocker كلُّه ١٦ — ورسالةٌ لا تُرسل إلّا إلى Docker
       تُرسل قارئَها إلى غير موضع العلّة. */
    expect(r.out, 'السقوطُ لا يدلّ على النسخ — وهي التي ملأت القرص').toContain('backup.sh --prune')
  })

  /* ═══ والمقيسُ هنا الرسالةُ لا رقمُ الخروج ═══

     «تسقط على مسارٍ لا وجودَ له» دعوى لا تُنقَض: مقارنةُ `-ge` على قيمةٍ
     فارغةٍ تفشل من تلقائها، فيخرج السكربتُ بواحدٍ ولو حُذف كلُّ فحصٍ فيه —
     وحارسٌ لا يُنقَض زينة. (قيس: نُقض الحاجزان معا فمرّ.)

     والمعنى الحقيقيُّ أن يقول **لِمَ** سقط. فمسارٌ خاطئٌ يُجاب عنه بخطأ
     قياسٍ لا بـ«لا مساحةَ تكفي» — تلك رسالةٌ تُرسل الباحثَ إلى قرصٍ سليمٍ
     يمسحه بحثا عن فراغٍ لا ينقصه. */
  it('وتقول لِمَ سقطت على مسارٍ لا وجودَ له — لا تدّعي امتلاءَ قرص', () => {
    const r = runPreflight(join(tmpdir(), 'wajeez-no-such-dir-for-disk'), '1')
    expect(r.code, 'مرّ مسارٌ لا وجودَ له').not.toBe(0)
    expect(r.out, 'سقطت على مسارٍ خاطئٍ بلا بيان').toMatch(/لا يوجد المسار|تعذّر قياسُ المساحة/)
    expect(r.out, 'قيل «لا مساحة» عن مسارٍ لا وجودَ له أصلا').not.toMatch(/لا مساحةَ تكفي/)
  })

  it('وتقيس المسارَ المُعطى لا مسارَها هي', () => {
    expect(runPreflight(mkdtempSync(join(tmpdir(), 'wajeez-disk-')), '1').code).toBe(0)
  })
})

describe('والبوّابةُ موصولةٌ بما يُنشَر فعلا', () => {
  /* بوّابةٌ لا يناديها النشرُ زينةٌ مهما صحّ منطقُها. */
  it('deploy.sh يناديها قبل أن يلمس شيئا', () => {
    const lines = runnable('deploy/deploy.sh')
    const callIndex = lines.findIndex((l) => /(^|\s|\|\||&&)bash\s+deploy\/preflight-disk\.sh\b/.test(l))
    expect(callIndex, 'لا نداءَ منفَّذا لـpreflight-disk.sh في deploy.sh').toBeGreaterThanOrEqual(0)

    /* وقبلَ أوّلِ خطوة: النسخةُ الاحتياطيّةُ (الخطوة ٢) تكتب على القرص،
       فتسقط بسبب الامتلاء برسالةٍ تدلّ على غير موضع العلّة. */
    const firstStep = lines.findIndex((l) => l.startsWith('step '))
    expect(firstStep, 'لا خطواتِ نشرٍ في deploy.sh').toBeGreaterThanOrEqual(0)
    expect(callIndex, 'فحصُ المساحة بعد أوّل خطوة — فالنشرُ مضى قبل أن يُسأل').toBeLessThan(firstStep)
  })
})

describe('وما تراكم يُسقَط بعد كلّ نشرةٍ ناجحة', () => {
  const lines = runnable('deploy/deploy.sh')
  const pruneAt = lines.findIndex((l) => /^docker\s+image\s+prune\b/.test(l))

  it('deploy.sh يُسقط المعلَّقَ — وإلّا عاد الامتلاءُ نشرةً بعد نشرة', () => {
    expect(pruneAt, 'لا إسقاطَ للصور المعلَّقة في deploy.sh').toBeGreaterThanOrEqual(0)
    expect(
      lines.some((l) => /^docker\s+builder\s+prune\b/.test(l)),
      'ذاكرةُ البناء تنمو بلا إسقاط',
    ).toBe(true)
  })

  /* وبعد التبديل لا قبلَه: قبله تكون الصورةُ القديمةُ هي التي تخدم. */
  it('والإسقاطُ بعد تبديل الحاويات', () => {
    const swapAt = lines.findIndex((l) => /^\$COMPOSE\s+up\s+-d\s+--remove-orphans/.test(l))
    expect(swapAt, 'لا تبديلَ حاوياتٍ في deploy.sh').toBeGreaterThanOrEqual(0)
    expect(pruneAt, 'يُسقَط القديمُ قبل أن تعمل الجديدة').toBeGreaterThan(swapAt)
  })

  /* ═══ وهذا أخطرُ ما يُقاس في هذا الملفّ ═══

     `--volumes` يحذف المُجلَّداتِ غيرَ المستعمَلة، و`pgdata` يصير غيرَ مستعمَلٍ
     **في اللحظة التي تقف فيها حاويةُ القاعدة** — أي في الحالة التي يُشغَّل
     فيها هذا الإسقاطُ بالضبط. فسطرٌ واحدٌ يُضاف يوما بحسن نيّةٍ «ليُفرِغ أكثر»
     يمحو قاعدةَ البيانات. */
  it('ولا يُمرَّر --volumes إلى مسحٍ في مسار النشر البتّة', () => {
    for (const rel of ['deploy/deploy.sh', 'deploy/preflight-disk.sh']) {
      for (const line of runnable(rel)) {
        if (!/\bprune\b/.test(line)) continue
        expect(line, `مسحٌ بـ--volumes في ${rel} — يمحو pgdata متى وقفت القاعدة`)
          .not.toMatch(/--volumes/)
      }
    }
  })

  /* و`image prune -a` يحذف كلَّ صورةٍ لا تستعملها حاويةٌ قائمة — ومنها صورُ
     القاعدةِ وCaddy المسحوبةُ من المستودَع، فتُجلَب من جديد في كلّ نشرة. */
  it('ولا يُمسح إلّا المعلَّق — لا كلُّ ما لا حاويةَ له', () => {
    const bad = runnable('deploy/deploy.sh')
      .filter((l) => /^docker\s+image\s+prune\b/.test(l) && /\s-a\b|\s-[a-z]*a[a-z]*\b/.test(l))
    expect(bad, 'image prune -a في مسار النشر — يُعيد جلبَ صورِ القاعدةِ وCaddy كلَّ مرّة').toEqual([])
  })
})
