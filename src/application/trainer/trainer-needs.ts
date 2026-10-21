/* ═══ ما ينتظر قرارَك من المدرّبين — فلاترُ «تشغيل المدرّبين» (٢١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أعطني فلاترَ على ما ينتظرني، فلا أقرأ الكلَّ حين أنظر فيمن أعتمد صورتَه أو نصَّه،
   أو أرسل لمن لم أرسل له». وفلاترُ الحال (`trainer-status.ts`) حالٌ واحدةٌ لكلّ مدرّب، و«ينتظرك» فيها
   يجمع كلَّ خطوةٍ منك — فلا تفرز صورةً من نصٍّ من اقتراح. فهذه ثلاثةٌ بجانبها، وكلٌّ يُحسب ممّا تعرضه
   البطاقةُ نفسُها:

   · **صورةٌ** رفعها من حسابه وتنتظر اعتمادَنا (`pendingPhotoUrl`)؛
   · **ونصٌّ** ينتظر اعتمادَنا: عنوانٌ أو نبذةٌ أو اسمٌ كتبه (`pendingText`)، أو «لماذا نفتخر» عدّله وعاد
     إلينا (`edited`)؛
   · **واقتراحٌ** كتبناه ولم يُرسَل (`pitchDraft` أو `bioDraft`).

   والمدرّبُ في أكثرَ من واحدٍ إن اجتمعت له — فليست أقساما يُجمع عددُها. والدوالُّ نقيّةٌ تقرؤها الشاشة. */

import { countAr } from '../text/count-ar'

export type TrainerNeed = 'photo' | 'text' | 'unsent'

export interface NeedInput {
  pendingPhotoUrl: string | null
  pendingText: object | null
  pitchLatest: { status: string } | null
  pitchDraft: readonly string[] | null
  bioDraft: string | null
}

export const TRAINER_NEEDS: readonly { id: TrainerNeed; ar: string }[] = [
  { id: 'photo', ar: 'صور تنتظرك' },
  { id: 'text', ar: 'نصوص تنتظرك' },
  { id: 'unsent', ar: 'لم ترسل لهم' },
]

export function hasNeed(t: NeedInput, need: TrainerNeed): boolean {
  if (need === 'photo') return Boolean(t.pendingPhotoUrl)
  if (need === 'text') return Boolean(t.pendingText) || t.pitchLatest?.status === 'edited'
  return Boolean(t.pitchDraft || t.bioDraft)
}

/** عددُ المدرّبين بصيغته — «12 مدربا» لا «12 مدرب» */
export const trainersAr = (n: number): string =>
  countAr(n, { one: 'مدرب', two: 'مدربين', few: 'مدربين', many: 'مدربا' })

/** ما يصل المدرّبَ من مسوّداتنا — في تأكيد «أرسل» */
export function draftKindsAr(kinds: readonly ('pitch' | 'bio')[]): string {
  return kinds.map((k) => (k === 'pitch' ? '«لماذا نفتخر»' : 'النبذة')).join(' و')
}
