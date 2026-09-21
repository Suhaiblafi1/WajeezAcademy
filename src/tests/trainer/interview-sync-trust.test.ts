/* أيُثقُ الطابورُ بما يعرفه عن الحجز؟ — الحكمُ وحدَه.

   ═══ وما يُحرس هنا ═══

   ① **كلُّ طريقٍ إلى الصمت يُقال** — لا رمزَ، أو مطفأ، أو لم تجرِ دورة،
      أو سقطت، أو انقطع النبض. وخمستُها تُنتج «المقابلات (0)» نفسَها،
      ومن قرأ عددَ «لم يحجز موعدا» في أيٍّ منها قرأ عددا لا يعني شيئا.
   ② **والسببُ يُقال بنصّه** — «لا يُوثَق» وحدَها تترك قارئَها يبحث، وقد
      بحث صاحبُ المنصّة مرّةً حتّى وجدها في شاشةٍ لا يملكها.
   ③ **وحدُّ القِدَم هو حدُّ «صحّة النظام» نفسُه** — ولو افترقا لَقالت
      البطاقةُ «معطَّل» وقال الطابورُ «يعمل» في اللحظة نفسِها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SYNC_STALE_MS, interviewSyncTrust, type SyncFacts,
} from '@/application/trainer/interview-sync-trust'

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

const NOW = new Date('2026-09-20T12:00:00.000Z')

/** حالٌ سليمةٌ تامّة — يُنقص منها في كلّ فحص */
const healthy = (): SyncFacts => ({
  hasToken: true,
  enabled: true,
  at: new Date(NOW.getTime() - 60_000).toISOString(),
  errorAr: null,
  now: NOW,
})

describe('ثقةُ الطابور بما يعرفه عن الحجز', () => {
  it('والسليمةُ يُوثَق بها بلا سبب', () => {
    const t = interviewSyncTrust(healthy())
    expect(t.trusted).toBe(true)
    expect(t.reasonAr).toBeNull()
  })

  /* ═══ ① خمسةُ طرقٍ إلى الصمت نفسِه ═══ */

  it('ولا يُوثَق بلا رمزٍ محفوظ', () => {
    const t = interviewSyncTrust({ ...healthy(), hasToken: false })
    expect(t.trusted).toBe(false)
    expect(t.reasonAr, 'لا يقول أنّ الرمزَ غائب').toContain('رمز')
  })

  it('ولا يُوثَق والتكاملُ مطفأ — والرمزُ محفوظٌ لا يعمل وحدَه', () => {
    const t = interviewSyncTrust({ ...healthy(), enabled: false })
    expect(t.trusted).toBe(false)
    expect(t.reasonAr, 'لا يقول أنّه مطفأ').toContain('مطفأ')
  })

  it('ولا يُوثَق قبل أن تجريَ دورةٌ واحدة', () => {
    const t = interviewSyncTrust({ ...healthy(), at: null })
    expect(t.trusted).toBe(false)
  })

  /* ═══ وهذا هو ما وقع فعلا: ردّ 401 ═══ */
  it('② ولا يُوثَق والدورةُ ساقطة — والسببُ بنصّه لا «لا يُوثَق» وسكوت', () => {
    const t = interviewSyncTrust({ ...healthy(), errorAr: 'ردّ 401' })
    expect(t.trusted).toBe(false)
    expect(t.reasonAr, 'ابتلع نصَّ الخطأ — فيبحث قارئُه عنه في شاشةٍ لا يملكها')
      .toContain('ردّ 401')
    expect(t.reasonAr, 'لا يقول أنّ العدّادَ لا يُعتمد عليه').toContain('لم يحجز موعدا')
  })

  it('ولا يُوثَق وقد انقطع النبضُ أكثرَ من الحدّ', () => {
    const stale = {
      ...healthy(),
      at: new Date(NOW.getTime() - SYNC_STALE_MS - 1_000).toISOString(),
    }
    expect(interviewSyncTrust(stale).trusted).toBe(false)
  })

  it('ويُوثَق عند الحدّ نفسِه — فدورةٌ متأخّرةٌ ثانيةً ليست انقطاعا', () => {
    const edge = {
      ...healthy(),
      at: new Date(NOW.getTime() - SYNC_STALE_MS).toISOString(),
    }
    expect(interviewSyncTrust(edge).trusted).toBe(true)
  })

  it('والرمزُ الغائبُ يُقال قبل الإطفاء — فهما عملان مختلفان', () => {
    /* من لا رمزَ عنده يذهب إلى Calendly ليولّده، ومن رمزُه محفوظٌ ينقر
       مربّعا. وجمعُهما في جملةٍ واحدةٍ يُرسل أحدَهما إلى عملِ الآخر. */
    const t = interviewSyncTrust({ ...healthy(), hasToken: false, enabled: false })
    expect(t.reasonAr).toContain('رمز')
    expect(t.reasonAr).not.toContain('مطفأ')
  })

  /* ═══ ③ وحدُّ القِدَم واحدٌ في الموضعين ═══ */
  it('③ و«صحّة النظام» تقرأ الحدَّ نفسَه — لا رقما منسوخا بجانبه', () => {
    const health = read('server/services/system-health.service.ts')
    expect(health, 'بطاقةُ الصحّة لا تستورد حدَّ القِدَم')
      .toContain('SYNC_STALE_MS')
    expect(health, 'الرقمُ منسوخٌ بيده — فيفترق الحكمان عند أوّل تعديل')
      .not.toMatch(/staleMs > 16 \* 60_000/)
  })
})

/* ═══ وحيث يقع العملُ الذي يتعطّل ═══

   العطبُ كان مكتوبا في «صحّة النظام» ولم يصل صاحبَ الشكوى: تلك الشاشةُ
   خلف `settings.manage`، ومن يقرأ الطابورَ لا يملكها. فبحث عن العلّة في
   سبع شكاوى قبل أن تُوجد. فيُحرَس أن يبقى الخبرُ حيث يُحتاج، وأن يُقرأ
   بصلاحيّة الطابور نفسِها، وألّا يحمل سرّا. */
describe('وخبرُ العطب حيث يقع العمل', () => {
  const screen = read('src/pages/admin/TrainerApplications.tsx')
  const route = read('server/http/routes/admin-trainer.routes.ts')

  it('والطابورُ يقرأ الحكمَ ويعرضه حين لا يُوثَق', () => {
    expect(screen, 'الطابورُ لا يسأل عن حال المزامنة')
      .toContain('/api/admin/trainer-applications/interview-sync')
    expect(screen, 'يسأل ولا يعرض — فالخبرُ يبقى حيث لا يُقرأ')
      .toMatch(/syncTrust && !syncTrust\.trusted/)
    expect(screen, 'لا يعرض السببَ بنصّه').toContain('syncTrust.reasonAr')
  })

  it('ويُقرأ بصلاحيّة الطابور — لا بصلاحيّةِ الإعدادات التي لا يملكها', () => {
    const handler = /interview-sync'[\s\S]*?\n {2}\}\)/.exec(route)?.[0] ?? ''
    expect(handler, 'لم يُعثر على المسار').toBeTruthy()
    expect(handler, 'حُرس بغير صلاحيّة الطابور — فيعود الخبرُ إلى حيث لا يُقرأ')
      .toContain("requirePermission('trainer.applications.view')")
  })

  /* ═══ ولا سرَّ يغادر في خبرٍ عن صحّة ═══

     والفحصُ على **المردود** لا على جسم المعالج: قراءةُ الرمز مشروعةٌ
     ولازمة — بها يُعرف أمحفوظٌ هو أم لا. والممنوعُ أن يخرج، لا أن
     يُقرأ. ومنعُ قراءته يمنع الحكمَ نفسَه. */
  it('ولا يردّ الرمزَ ولا جزءا منه — الخبرُ أيعمل أم لا، لا بمَ يعمل', () => {
    const handler = /interview-sync'[\s\S]*?\n {2}\}\)/.exec(route)?.[0] ?? ''
    expect(handler, 'لم يُعثر على المسار').toBeTruthy()
    /* المردودُ مقيَّدٌ بنصّه: الحكمُ ووقتُ آخر دورةٍ لا غير */
    expect(handler, 'المردودُ غيرُ محصور — فحقلٌ يُضاف يوما قد يحمل سرّا')
      .toContain('return { ...trust, at: sync?.at ?? null }')

    /* وما يحمله `trust` معلومٌ بحصره: حقلان لا ثالثَ لهما */
    const shape = interviewSyncTrust({ ...healthy(), errorAr: 'ردّ 401' })
    expect(Object.keys(shape).sort(), 'الحكمُ حمل حقلا ثالثا — يُقرأ قبل أن يُردّ')
      .toEqual(['reasonAr', 'trusted'])
  })

  it('والعدّادُ لا يدّعي رقما لا يُعرف حين تسقط المزامنة', () => {
    expect(screen, '«لم يحجز موعدا» يعرض رقما واثقا ولو سقطت المزامنة')
      .toMatch(/syncTrust && !syncTrust\.trusted \? "؟" :/)
  })
})
