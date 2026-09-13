/* «من أنت؟» — نداءٌ واحدٌ تتقاسمه الشاشةُ كلُّها، لا نداءٌ لكلّ مكوّن.

   ═══ العطبُ الذي كُتب له ═══

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من بطء الدخول. والسببُ معدودٌ لا
   مظنون: فتحُ `/admin` كان يسأل الخادمَ «من أنت؟» **خمس مرّات** في نَفَسٍ
   واحد — حارسُ المسار، وإطارُ البوّابة، ولوحُ البحث، وجرسُ الإشعارات،
   واللوحةُ نفسُها. كلٌّ منها ينادي `useRealSession` وهو خطّافٌ يجلب لنفسه.

   وليست خمسةَ نداءاتٍ رخيصة: كلُّ واحدٍ منها يحلّ الجلسةَ بضمِّ
   (جلسة ← مستخدم ← أدوار ← صلاحيّات ← استثناءات) **ويقرأ إعدادَ البريد**
   من قاعدة البيانات. فخمسةُ أضعافٍ من العمل على الخادم قبل أن يُرسَم شيء،
   ومثلُها عند كلّ انتقالٍ بين شاشات البوّابة.

   ═══ والعلاجُ لا يمسّ الحراسة ═══

   الكوكي يبقى دليلَ الدخول الوحيد، والخادمُ يبقى الحَكَم: كلُّ مسارٍ محميٍّ
   يفحص الصلاحيّةَ عند كلّ نداء. وما يُختصر هنا **سؤالُ الواجهة عن هويّتها**
   لا فحصُ الخادم — نداءٌ واحدٌ يتقاسمه الجميع، وجوابٌ يُعاد استعمالُه ثوانيَ
   معدودةً ثمّ يسقط.

   والمدّةُ قصيرةٌ بقصد: من سُحب دورُه يراه مسحوبا بعد ثوانٍ في الواجهة —
   وممنوعا عند الخادم في اللحظة نفسِها على كلّ حال. */

import { apiGet } from './api'

export interface SessionUser {
  userId: string
  email: string
  displayName: string
  roles: string[]
  permissions: string[]
  /* توثيق البريد (١هـ) — يحجب الشراء والشهادة فقط، لا الدخول ولا التصفّح */
  emailVerified: boolean
}

export interface MeAnswer {
  user: SessionUser | null
  /** حالةُ قناة البريد — حاجزُ التوثيق لا يُفرَض حين تكون مغلقة */
  emailChannelEnabled: boolean | null
}

/** كم يبقى الجوابُ صالحا لإعادة الاستعمال — ثوانٍ لا دقائق */
export const ME_FRESH_MS = 30_000

let cached: { at: number; answer: MeAnswer } | null = null
let inflight: Promise<MeAnswer> | null = null

/** الآنَ — مفصولةً كي يُزوَّر الزمنُ في الاختبار */
let now = () => Date.now()

/** للاختبار وحدَه: يُثبّت الساعةَ ليُقاس انتهاءُ الصلاحية بلا انتظارٍ حقيقيّ */
export function __setClock(fn: () => number): void { now = fn }

/** الجوابُ المحفوظُ إن كان طازجا — يُقرأ بلا انتظار، فلا ترتعش الشاشةُ بلوحِ تحميل */
export function freshMe(): MeAnswer | null {
  if (!cached) return null
  return now() - cached.at < ME_FRESH_MS ? cached.answer : null
}

/** «من أنت؟» — نداءٌ واحدٌ في الطيران، وجوابٌ يُعاد استعمالُه ما دام طازجا */
export function fetchMe(force = false): Promise<MeAnswer> {
  if (!force) {
    const hit = freshMe()
    if (hit) return Promise.resolve(hit)
    /* نداءٌ طائرٌ بالفعل: ينضمّ إليه القادمُ ولا يفتح ثانيا. وهذا هو الذي
       يطوي الخمسةَ إلى واحدة — فالخمسةُ تنطلق في اللحظة نفسِها، قبل أن
       يعود جوابٌ يُحفظ. */
    if (inflight) return inflight
  }
  const run = apiGet<{ user: SessionUser | null; emailChannelEnabled?: boolean }>('/api/auth/me')
    .then((r) => {
      const answer: MeAnswer = { user: r.user ?? null, emailChannelEnabled: r.emailChannelEnabled ?? null }
      cached = { at: now(), answer }
      return answer
    })
    .finally(() => { if (inflight === run) inflight = null })
  /* والسقوطُ لا يُحفظ: انقطاعُ شبكةٍ ليس جوابا عن «من أنت؟»، والحارسُ يميّز
     ٤٠١ (لا جلسة) من تعذُّر الوصول — فلو حُفظ السقوطُ لضاع الفرق. */
  inflight = run
  return run
}

/** يُنسى المحفوظُ — بعد الخروج، وبعد إبطال الجلسات كلِّها */
export function forgetMe(): void {
  cached = null
  inflight = null
}
