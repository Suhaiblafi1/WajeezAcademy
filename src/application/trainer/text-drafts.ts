/* ═══ مسوّداتُ ما نقترحه على بطاقة المدرّب — تعود ملفّا يُرفع من الشاشة (٢٦ أكتوبر ٢٠٢٦) ═══

   كانت تُكتب في الشيفرة (`server/services/trainer-suggestion-drafts.ts`)، فكلُّ جولةٍ نشرُ شيفرة. فصارت ملفّا بهذه
   الصيغة يُرفع من «ارفع المسوّدات» بجانب تنزيل ملفّات المدرّبين، ويحفظه الخادمُ كلَّه أو يردّه كلَّه
   (`server/services/trainer-drafts.service.ts`). وهنا ما تتقاسمه الشاشةُ والخادم: اسمُ الصيغة، وما يعود به الرفع، وسطرُه. */

import { trainersAr } from './trainer-needs'

/** صيغةُ ملفّ المسوّدات — يقولها ملفُّ المدرّبين لمن يكتبها (`draftsFormatMd`) */
export const DRAFTS_FORMAT = 'wajeez.trainer-drafts/1'

/** ما وقع بالرفع: لكم مدرّبٍ كُتبت مسوّدةُ كلّ نوع، وكم كانت هي نفسَها فلم تُكتب */
export interface DraftsUploaded { pitch: number; bio: number; repeated: number }

/** «رفع «لماذا نفتخر به» لـ12 مدربا · والنبذة لـ10 مدربين · ومرفوع من قبل: 1» — ثمّ أين تُرسَل */
export function draftsUploadedAr(c: DraftsUploaded): string {
  if (c.pitch === 0 && c.bio === 0) return 'كل ما في الملف مرفوع من قبل، فلم يتغير شيء.'
  return [
    c.pitch > 0 ? `رفع «لماذا نفتخر به» لـ${trainersAr(c.pitch)}` : '',
    c.bio > 0 ? `والنبذة لـ${trainersAr(c.bio)}` : '',
    c.repeated > 0 ? `ومرفوع من قبل لم يتغير: ${c.repeated}` : '',
  ].filter(Boolean).join(' · ') + '. تجدها في بطاقة كل مدرب، وترسلها من «أرسل للنشطين ومن نشرت دوراتهم».'
}
