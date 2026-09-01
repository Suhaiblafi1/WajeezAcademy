/* قائمةُ الأحداث واحدةٌ — والمرآةُ التي شاخت لا تعود.

   كان الاتّحادُ في الواجهة ومجموعةٌ بيضاء في الخادم، وتعليقُ الثانية يقول
   إنّها «مرآة» للأولى. وشاخت: أحدَ عشرَ حدثا تُطلقها الواجهةُ ولا يقبلها
   الخادم — `offer_signup_clicked` و`promo_applied` و`course_path_*` وأحداثُ
   مشغّل الدروس كلُّها. فتعود ٤٢٢، ولا تتعطّل صفحة، ولا يُسجَّل شيء.

   وهذا أسوأ ما يقع بالقياس: الصفرُ في اللوحة يُقرأ «لا أحد يفعل هذا» بينما
   الحقيقةُ «لا أحد يسجّله» — وتُتّخذ عليه قرارات.

   فالحارسُ هنا على **البنية** لا على تطابق قائمتين: أن يبقى مصدرٌ واحد. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANALYTICS_EVENTS } from '../../../src/application/analytics/events'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('مصدرٌ واحد لأسماء الأحداث', () => {
  it('الخادمُ يقرأ القائمة المشتركة ولا يكتب نسخةً منها', () => {
    const src = read('server/http/routes/analytics.routes.ts')
    expect(src).toMatch(/new Set<string>\(ANALYTICS_EVENTS\)/)
    expect(src).toMatch(/application\/analytics\/events/)
  })

  it('والواجهةُ تشتقّ اتّحادَها منها لا تُعدّده', () => {
    const src = read('src/services/analytics.ts')
    expect(src).toMatch(/export type \{ AnalyticsEvent \} from "\.\.\/application\/analytics\/events"/)
    expect(src, 'الاتّحادُ عاد يُكتب هنا').not.toMatch(/export type AnalyticsEvent =/)
  })

  it('والأحداثُ التي كانت تُرفض صامتةً مقبولةٌ الآن', () => {
    for (const e of [
      'offer_signup_clicked', 'promo_applied', 'pathway_adopted',
      'course_path_opened', 'course_path_added', 'course_path_deferred', 'course_path_named',
      'module_check_answered', 'module_video_chapter_opened', 'module_step',
      'buy_panel_opened',
    ]) {
      expect(ANALYTICS_EVENTS as readonly string[], `${e} ما زال خارج القائمة`).toContain(e)
    }
  })

  it('ولا اسمَ مكرّرا — اسمان لشيءٍ واحد يُجمعان في رقمٍ واحد', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length)
  })

  /* حُذف عمدا: كان يُطلق بعد مؤقّت نافذة دفعٍ وهمية، فيصير في التحليلات
     «مبيعات» لا وجود لها. والدفعُ الحقيقيّ يُسوّى بـwebhook على الخادم. */
  it('و«اكتمل الدفع» لا يُقبَل من المتصفّح — المبيعاتُ تُسجَّل من التسوية', () => {
    expect(ANALYTICS_EVENTS as readonly string[]).not.toContain('payment_completed')
  })
})
