/* «تمّ» لا تُقال عن بريدٍ لم يخرج — حارسُ صدقِ خبر الإرسال.

   ═══ العطبُ الذي كُتب له ═══

   مسالكُ البريد تردّ حالَ رسالتها (`sent` · `failed` · `not_configured`)،
   وكانت الشاشاتُ ترميه وتعرض نصَّ نجاحٍ مكتوبا سلفا. فلو تعطّلت القناةُ
   يوما لذكّر الموظّفُ عشرةً وقرأ عشرَ رسائلِ نجاح، ثمّ انتظرهم وهم لم
   يعلموا بشيء. وهو عطبٌ **صامت**: لا يسقط فحصٌ ولا تظهر شاشةُ خطأ.

   ═══ وما يُفحص هنا ═══

   ① الدالّةُ نفسُها: ما لم يخرج لا يُقال نجاحا، ويُقال سببُه وما يُفعل.
   ② وأنّ الشاشاتِ **تقرأ الجواب** — لا نصَّ ثابتا بجانب النداء. والفحصُ
      على ورود `mailOutcomeAr` **قربَ كلّ مسارِ بريدٍ بعينه**: لو صيغ خبرُ
      واحدٍ منها من الجواب وتُرك أخواه لمرّ فحصٌ يكتفي بوجود الاسم في الملفّ.
   ③ وأنّ `act` يمرّر الجوابَ إلى صائغ الخبر — وإلّا صاغه من فراغ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mailBatchOutcomeAr, mailOutcomeAr } from '@/application/notifications/delivery'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
/* بلا تعليقاتها: اسمٌ في شرحٍ لا يصوغ خبرا */
const code = (p: string) => readFileSync(join(root, p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const DONE = 'أرسل التذكير — يحجز من صفحة طلبه'

describe('خبر الرسالة الواحدة', () => {
  it('ما خرج يقال كما كتبه المنادي', () => {
    expect(mailOutcomeAr(DONE, 'sent')).toEqual({ ok: true, ar: DONE })
  })

  it('وما لم يخرج لا يقال نجاحا — ويقال سببه وما يفعل', () => {
    for (const status of ['not_configured', 'failed']) {
      const out = mailOutcomeAr(DONE, status)
      expect(out.ok, status).toBe(false)
      expect(out.ar, `${status}: عاد خبر النجاح كما هو`).not.toBe(DONE)
      /* وسبيلُ الإصلاح مقولٌ في الخبر — وإلّا وقف الموظّفُ أمام «تعذّر» */
      expect(out.ar, `${status}: لا يقول ما يفعل`).toContain('التكاملات')
    }
  })

  it('ويفرّق بين قناة غير مفعّلة وإرسال تعذّر — فالعلاج مختلف', () => {
    expect(mailOutcomeAr(DONE, 'not_configured').ar).not.toBe(mailOutcomeAr(DONE, 'failed').ar)
  })

  it('وجواب بلا حال لا يقرأ نجاحا', () => {
    expect(mailOutcomeAr(DONE, undefined).ok).toBe(false)
    expect(mailOutcomeAr(DONE, null).ok).toBe(false)
  })

  it('والفعل وقع وإن لم يخرج البريد — فلا يقال له «لم يحدث شيء»', () => {
    /* الأثرُ كُتب والحالةُ تبدّلت؛ الذي لم يقع خروجُ البريد وحدَه. ولو قيل
       غيرُ ذلك أعاد الموظّفُ الكرّةَ فتضاعف الأثرُ بلا فائدة. */
    expect(mailOutcomeAr(DONE, 'failed').ar).toContain('سجّل الفعل')
  })
})

describe('خبر الدفعة', () => {
  it('كلّها خرجت — فالخبر كما هو', () => {
    expect(mailBatchOutcomeAr('أرسل التذكير على ٣.', ['sent', 'sent', 'sent']))
      .toEqual({ ok: true, ar: 'أرسل التذكير على ٣.' })
  })

  it('وما لم يخرج يعدّ ولا يبتلع في «نفّذ»', () => {
    const out = mailBatchOutcomeAr('أرسل التذكير على ٣.', ['sent', 'failed', 'not_configured'])
    expect(out.ok).toBe(false)
    expect(out.ar).toContain('2')
  })
})

describe('والشاشات تقرأ الجواب لا تفترضه', () => {
  /** نافذةٌ حول نداءِ مسارٍ بعينه — فيُفحص كلُّ فعلٍ على حدة */
  const near = (src: string, path: string, span = 320) => {
    const at = src.indexOf(path)
    expect(at, `المسار ${path} مفقود من الشاشة`).toBeGreaterThan(-1)
    return src.slice(at, at + span)
  }

  it('أفعال البريد الثلاثة في شاشة الطلب تصوغ خبرها من الجواب', () => {
    const ops = code('src/pages/admin/TrainerOps.tsx')
    for (const path of ['/booking-reminder', '/interview-invite', '/interviews']) {
      expect(near(ops, path), `${path}: خبر ثابت لا يقرأ حال البريد`).toContain('mailOutcomeAr(')
    }
  })

  it('والفعل الجماعيّ يجمع حالات بريده', () => {
    const queue = code('src/pages/admin/TrainerApplications.tsx')
    expect(near(queue, '/booking-reminder', 420)).toContain('emailDelivery')
    expect(queue, 'الدفعة تقول «نفّذ» ولا تعدّ ما لم يخرج').toContain('mailBatchOutcomeAr(')
  })

  it('ومنفّذ الأفعال يمرّر الجواب إلى صائغ الخبر', () => {
    const queue = code('src/pages/admin/TrainerApplications.tsx')
    const act = /const act = async \([\s\S]*?\n {2}\};/.exec(queue)?.[0] ?? ''
    expect(act, 'دالّة التنفيذ مفقودة').toBeTruthy()
    expect(act, 'الجواب يرمى قبل أن يقرأ').toMatch(/const result = await fn\(\)/)
    expect(act, 'الخبر لا يصاغ من الجواب').toContain('doneMsg(result)')
    /* ونبرةُ الخبر تتبع `ok` — فما لم يخرج لا يُعرض أخضر */
    expect(act, 'كلّ خبر يعرض نجاحا').toContain('toastError(said.ar)')
  })

  it('والتراجع عن الرفض يقرأ حال بريده — فـ«وصله السبب» لا تقال على ظنّ', () => {
    /* ═══ ولمَ هذا الفعلُ بعينه ═══

       بقيّةُ القرارات تقول «نُفّذ القرار وسُجّل في الأثر» — وهي صادقةٌ ولو
       لم يخرج بريد. وهذا وحدَه يَعِد بأنّ **السببَ وصل صاحبَه**، وهو وعدٌ
       عن بريدٍ قد لا يخرج. ومن نُقض ردُّه ولم يبلغه شيءٌ يبقى على خبره
       الأوّل — فمن قرّر يجب أن يعلم ليُبلغه بنفسه. */
    const queue = code('src/pages/admin/TrainerApplications.tsx')
    expect(near(queue, '{ action: "undo_reject", note: reason }'), 'خبر التراجع ثابت لا يقرأ حال البريد')
      .toContain('mailOutcomeAr(')
    /* وإعادةُ المسحوب تَعِد بالوعد نفسِه (٢٩ سبتمبر ٢٠٢٦) — فتقرأ الحالَ نفسَه */
    expect(near(queue, '{ action: "undo_withdraw", note: reason }'), 'خبر إعادة المسحوب ثابت لا يقرأ حال البريد')
      .toContain('mailOutcomeAr(')
    /* والخادمُ يردّ الحالَ أصلا — وإلّا قرأت الشاشةُ غيابا وسمّته نجاحا */
    const route = code('server/http/routes/admin-trainer.routes.ts')
    expect(near(route, 'review.decide('), 'المسار يبتلع حال بريد القرار').toContain('outcome')
  })
})
