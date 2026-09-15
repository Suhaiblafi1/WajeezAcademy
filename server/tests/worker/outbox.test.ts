/* طابورُ البريد الخارج — يُفرَّغ مُمَهَّلا، ويُعيد ما سقط، ولا يطرق أبدا (ي-٦).

   ═══ ما يُحرَس، ولمَ كلٌّ منه ═══

   ① **القناةُ تُسأل قبل الصفّ** — صفٌّ يُحاوَل وقناتُه مغلقةٌ يرفع عدّادَه
      ويقترب من حدّ المحاولات بلا أن يكون أحدٌ حاول إرسالَه. فيُحرَق في
      انتظارٍ ليس ذنبَه. وهو عرفُ `dispatchQueuedNotifications` نفسُه، ووقعتُ
      في نقيضه مرّةً في ي-٥ فكشفه النقض.

   ② **والمهلةُ بين الرسائل** — وهي علّةُ هذا الجدول كلِّه: حدُّ المزوّد
      طلبان في الثانية، ودفعةٌ بلا مهلةٍ تُردّ بـ٤٢٩ فتُبتلع رسائلُ ناسٍ
      حقيقيّين. وتُقاس هنا بالوقت لا بقراءة الثابت: ثابتٌ يُقرأ قد لا يكون
      مستعمَلا.

   ③ **وما سقط يُعاد** — وهو ما لم يكن قبل هذا الجدول: إرسالٌ مباشرٌ يسقط
      مرّةً يسقط إلى الأبد.

   ④ **وما استنفد محاولاتِه يقف** — فلا يُطرَق عنوانٌ يرتدّ كلَّ دقيقةٍ سنةً،
      وهو أقصرُ طريقٍ إلى قوائم المنع.

   ⑤ **والمتنُ يُمحى ساعةَ يخرج** — وعدنا صاحبَه بمحوٍ كامل، فلا يبقى نصُّ
      رسالته في قاعدتنا أسابيعَ بعد أن أدّت غرضَها. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { drainOutbox, enqueueMail, OUTBOX_MAX_ATTEMPTS, type OutboxSender } from '../../services/outbox.service'
import { dispatchOutboxMail } from '../../worker/jobs'

let prisma: PrismaClient
const S = Date.now().toString(36).slice(-5)

/** يوصل قناةَ البريد أو يفصلها — والإرسالُ يسقط على كلّ حالٍ ببوّابة `MAIL_LIVE` */
async function mailChannel(enabled: boolean) {
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled, config: { apiKey: 'test-key', fromEmail: 'no-reply@test.local' } },
  })
}

let seq = 0
async function queueOne(): Promise<string> {
  seq += 1
  const to = `outbox-${S}-${seq}@test.local`
  await enqueueMail(prisma, { to, subject: 'خبر', text: 'متنُ الخبر', purpose: 'اختبار' })
  return to
}

const rowFor = (to: string) => prisma.outboxMail.findFirstOrThrow({ where: { to } })

/* مُرسِلان مُحقَنان — وبهما وحدَهما يُبلَغ فرعُ النجاح: بوّابةُ `MAIL_LIVE`
   تردّ كلَّ إرسالٍ حقيقيٍّ في غير الإنتاج. */
const sends: OutboxSender = async () => ({ status: 'sent' })
const drops: OutboxSender = async () => ({ status: 'failed', error: 'ارتدّ العنوان' })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

beforeEach(async () => {
  /* الساحةُ مشتركةٌ مع بقيّة الملفّات — فلا يُترك صفٌّ معلَّقٌ يلتقطه غيرُنا */
  await prisma.outboxMail.deleteMany({ where: { to: { startsWith: `outbox-${S}-` } } })
})

describe('طابورُ البريد الخارج', () => {
  it('① لا يُمَسّ صفٌّ وقناةُ البريد مغلقة — ولا يُحرَق عدّادُه', async () => {
    const to = await queueOne()
    await mailChannel(false)

    const out = await dispatchOutboxMail(prisma)
    expect(out.done, 'خرجت رسالةٌ بلا قناة').toBe(0)

    const row = await rowFor(to)
    expect(row.attempts, 'رُفع عدّادُ المحاولات بلا أن يحاول أحدٌ إرسالَه').toBe(0)
    expect(row.status, 'أُخرج الصفُّ من الطابور بلا محاولة').toBe('queued')
    expect(out.summaryAr, 'انتظر الصفُّ صامتا — ولم يُقَل عددُه').toContain('غيرُ موصولة')
  })

  it('② ويُمهَل بين رسالةٍ وأخرى — وهي علّةُ هذا الجدول كلِّه', async () => {
    await mailChannel(true)
    for (let i = 0; i < 3; i += 1) await queueOne()

    /* مهلةٌ مصغَّرةٌ تُقاس ولا تُطيل الاختبار — والدعوى على **وجودها** لا على
       مقدارها: ثلاثُ رسائلَ بمهلة ٨٠ms تستغرق ١٦٠ms على الأقلّ (مهلتان). */
    const started = Date.now()
    const run = await drainOutbox(prisma, { limit: 10, gapMs: 80 })
    const took = Date.now() - started

    expect(run.sent + run.failed, 'لم تُعالَج الرسائلُ الثلاث').toBe(3)
    expect(took, 'خرجت الرسائلُ دفعةً بلا مهلة — وهو ما يردّه المزوّد بـ٤٢٩').toBeGreaterThanOrEqual(160)
  })

  it('③ وما سقط يبقى في الطابور ويُعاد — لا يسقط مرّةً فيسقط للأبد', async () => {
    await mailChannel(true)
    const to = await queueOne()

    await drainOutbox(prisma, { limit: 10, gapMs: 0, send: drops })
    const first = await rowFor(to)
    expect(first.attempts, 'لم تُحسب المحاولة').toBe(1)
    expect(first.status, 'أُسقط الصفُّ من أوّل محاولة').toBe('queued')
    expect(first.lastError, 'سقط الإرسالُ ولم يُكتب سببُه').not.toBeNull()

    await drainOutbox(prisma, { limit: 10, gapMs: 0, send: drops })
    expect((await rowFor(to)).attempts, 'لم يُعَد ما سقط').toBe(2)
  })

  it('④ وما استنفد محاولاتِه يقف — فلا يُطرَق عنوانٌ يرتدّ إلى الأبد', async () => {
    await mailChannel(true)
    const to = await queueOne()

    for (let i = 0; i < OUTBOX_MAX_ATTEMPTS + 2; i += 1) {
      await drainOutbox(prisma, { limit: 10, gapMs: 0, send: drops })
    }
    const row = await rowFor(to)
    expect(row.attempts, 'تجاوز عدّادُ المحاولات حدَّه').toBe(OUTBOX_MAX_ATTEMPTS)
    expect(row.status, 'بقي يُحاوَل بعد استنفاد محاولاته').toBe('failed')

    /* ولا يُنسى في صمت: الخبرُ يقول إنّ إنسانا لم يُخبَر */
    const out = await dispatchOutboxMail(prisma)
    expect(out.summaryAr, 'استُنفدت محاولاتُ رسالةٍ ولم يُقَل ذلك لأحد').toContain('استنفدت')
  })

  it('⑤ والمتنُ يُمحى ساعةَ تخرج الرسالة — ولا يبقى في قاعدتنا بعد المحو', async () => {
    /* ═══ وكان هذا الحارسُ أخضرَ لسببٍ خاطئ ═══

       كُتب أوّلَ مرّةٍ يكتب التبديلَ بيده (`update({ text: null })`) ثمّ
       يقرؤه — أي يفحص أنّ القاعدةَ تقبل `null`، لا أنّ الدالّةَ تكتبه. ونُقض
       بنزع محو المتن من `drainOutbox` فبقي أخضر.

       فصار يمرّ بالدالّة نفسِها، والمُرسِلُ مُحقَنٌ لأنّ البوّابةَ تمنع
       بلوغَ فرع النجاح في الاختبار بحال. */
    await mailChannel(true)
    const to = await queueOne()
    expect((await rowFor(to)).text, 'كُتب صفٌّ بلا متن').not.toBeNull()

    const run = await drainOutbox(prisma, { limit: 10, gapMs: 0, send: sends })
    expect(run.sent, 'لم تخرج الرسالة').toBe(1)

    const after = await rowFor(to)
    expect(after.status).toBe('sent')
    expect(after.sentAt, 'لا يُعرف متى خرجت').not.toBeNull()
    expect(after.text, 'بقي متنُ رسالةٍ أُرسلت في قاعدتنا').toBeNull()
    expect(after.html, 'بقي ترميزُ رسالةٍ أُرسلت في قاعدتنا').toBeNull()
    /* والعنوانُ يبقى بقصد: هو ما يُسأل عنه — «أأُخبر فلان؟» */
    expect(after.to, 'مُحي العنوانُ — فلا يبقى من يُسأل عنه').toBe(to)
  })

  it('ولا يُعالَج أكثرُ من حدِّ الدورة — فلا تُمسك دورةٌ عن بقيّة الوظائف', async () => {
    await mailChannel(true)
    for (let i = 0; i < 4; i += 1) await queueOne()

    const run = await drainOutbox(prisma, { limit: 2, gapMs: 0, send: sends })
    expect(run.sent + run.failed, 'تُجووز حدُّ الدورة').toBe(2)
    expect(run.remaining, 'لم يُقَل كم بقي للدورة القادمة').toBeGreaterThanOrEqual(2)
  })
})
