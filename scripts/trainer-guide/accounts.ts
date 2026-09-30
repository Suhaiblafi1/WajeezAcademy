/* حسابا «دليل المدرّب» ودوراتُهما — ما يتقاسمه البذرُ والتصوير.

   ملفٌّ مستقلٌّ عن `seed.ts` لأنّ التصويرَ يحتاج البريدَ والكلمةَ وحدَهما،
   والبذرُ يستورد خدماتِ الخادم كلَّها: فلا يُحمَّل الخادمُ في متصفّحٍ يصوّر. */

/** كلمةٌ معلومةٌ للعرض المحلّيّ — على نمط `DEMO_PASSWORD` */
export const GUIDE_PASSWORD = process.env.GUIDE_PASSWORD?.trim() || 'Wajeez-Guide-2026'

export const GUIDE_ACCOUNTS = {
  /** ① اعتُمد توقيعُه الآن — طورُ الموادّ */
  fresh: { email: 'guide.new@wajeez.local', ref: 'WJ-TR-GUIDE-0001' },
  /** ② نشطٌ بشعبٍ وطلبةٍ ومستحقّات */
  active: { email: 'guide.trainer@wajeez.local', ref: 'WJ-TR-GUIDE-0002' },
} as const

/** اسمُ دورٍ لا اسمُ إنسان — يُقرأ في رأس البوّابة وفي العقد */
export const GUIDE_TRAINER_NAME = 'مدرّب وجيز'

/** دوراتٌ من الكتالوج المستورد — التواصلُ والتفاوض، يُفهم عنوانُها بلا شرح */
export const GUIDE_COURSES = {
  message: 'C-COMX-101',
  speaking: 'C-COMX-103',
  persuasion: 'C-COMX-104',
  qa: 'C-COMX-105',
  negotiation: 'C-NEG-101',
} as const

/** روابطُ الصور تُخدَم في التصوير من صورٍ تُرسَم محلّيّا (`capture.ts`) — لا تُطلب من الشبكة */
export const GUIDE_ASSET_HOST = 'https://assets.guide.wajeez.local'
