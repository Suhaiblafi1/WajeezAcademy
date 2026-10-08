/* فحصُ المهارة في المجال — اختبارٌ قصيرٌ يقيس المستوى بدل وصفه (٨ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة سؤالا سؤالا:
     · «فحوصُ مهارةٍ قصيرة» بعد اختبار الإنجليزيّة: يُقاس المستوى في المجال بدل أن
       يصفه المتعلّمُ وحدَه.
     · اختياريٌّ من صفحة النتيجة — كاختبار الإنجليزيّة، لا داخلَ التشخيص.
     · أربعةُ مجالاتٍ أوّلا: تحليلُ البيانات، والتسويق، والأمنُ السيبرانيّ، والذكاءُ
       الاصطناعيّ.
     · **يُفتح فورا ويُراجَع بعدُ**: أسئلتي تُعرض حين تُستورَد، ومن يملك المراجعةَ يعدّل
       أو يُسقط متى شاء. (والإنجليزيّةُ باقيةٌ على «يُراجَع أوّلا».)

   ── المستوياتُ ثلاثة، وهي سلّمُ سؤال «مستواك في المجال» نفسُه ──

   أساسيّ · متوسّط · متقدّم — أربعةُ أسئلةٍ لكلّ منها. ومن لم يجتز الأساسيَّ فهو
   «مبتدئ» (`none`): الخيارُ الأوّلُ في السؤال نفسِه. فالنتيجةُ تُقرأ خيارا من خيارات
   السؤال، وتُطبَّق ببابِ «غيّر مستواي» كما هي.

   والقاعدةُ قاعدةُ الإنجليزيّة (`climbLadder`): يُجتاز المستوى بثلثي أسئلته، والمستوى
   أعلى ما اجتيز وكلُّ ما دونه مجتاز. */

import { climbLadder, type LadderScore } from './ladder'
import { MIN_APPROVED_PER_LEVEL } from './english-placement'

export const FIELD_CHECKS = [
  { subject: 'data', need: 'need_data', title_ar: 'تحليل البيانات' },
  { subject: 'marketing', need: 'need_marketing', title_ar: 'التسويق والنمو' },
  { subject: 'cyber', need: 'need_cyber', title_ar: 'الأمن السيبراني' },
  { subject: 'ai', need: 'need_ai', title_ar: 'الذكاء الاصطناعي في العمل' },
] as const

export type FieldSubject = (typeof FIELD_CHECKS)[number]['subject']
export const FIELD_SUBJECTS: readonly FieldSubject[] = FIELD_CHECKS.map((c) => c.subject)

/** سلّمُ الفحص — خياراتُ سؤال المستوى بعد «لم أمارسه بعد» */
export const CHECK_LEVELS = ['basics', 'independent', 'lead'] as const
export type CheckLevel = (typeof CHECK_LEVELS)[number]
/** ما دون السلّم: من لم يجتز الأساسيّ */
export const CHECK_FLOOR = 'none'

export interface FieldItem {
  id: string
  subject: FieldSubject
  level: CheckLevel
  stem: string
  options: string[]
  answer_index: number
}

export type FieldCheckResult = LadderScore<CheckLevel | typeof CHECK_FLOOR, CheckLevel>

export function isFieldSubject(s: string): s is FieldSubject {
  return (FIELD_SUBJECTS as readonly string[]).includes(s)
}

/** الفحصُ الذي يقيس احتياجا بعينه — أو null إن لم يكن له فحص */
export function fieldCheckOfNeed(need: string | null | undefined) {
  return FIELD_CHECKS.find((c) => c.need === need) ?? null
}

export function fieldBankIsOpen(items: readonly Pick<FieldItem, 'level'>[]): boolean {
  return CHECK_LEVELS.every((l) => items.filter((i) => i.level === l).length >= MIN_APPROVED_PER_LEVEL)
}

export function scoreFieldCheck(items: readonly FieldItem[], answers: Readonly<Record<string, number>>): FieldCheckResult {
  return climbLadder(CHECK_LEVELS, CHECK_FLOOR, items, answers)
}
