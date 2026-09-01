/** أيّامُ الأسبوع كما تُخزَّن — مصدرٌ واحد للواجهة والخادم.

    الرموزُ لا الأسماء: القاعدة تحفظ `sun`…`sat`، والتعريبُ يقع عند العرض
    وحدَه (`dayLabelAr`). وكان النموذج يقبل نصّا حرّا فتُخزَّن «الأحد» عربيّةً
    في صفٍّ و`sun` في آخر — تمثيلان ليومٍ واحد لا يجمعهما فرزٌ ولا مقارنة. */
export const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export type DayCode = (typeof DAY_CODES)[number]

/** أهذا رمزُ يومٍ معروف؟ — يحرسه الخادمُ أيضا، فالواجهةُ ليست الحدّ الوحيد */
export function isDayCode(value: string): value is DayCode {
  return (DAY_CODES as readonly string[]).includes(value)
}
