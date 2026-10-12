/* ═══ أيّامُ الشعبة وساعتُها من لقاءاتها (١٢ أكتوبر ٢٠٢٦) ═══

   اعتمادُ خطّة المدرّب كان يكتب حدودَ الشعبة (`startsAt` و`endsAt`) ويعتمد لقاءاتِها، ولا يكتب
   أيّامَها وساعتَها — فيبقى لسانُ «الجدول واللقاءات» بلا أيّامٍ وبساعةٍ مفترَضة (18:00)، ولا يرى
   الزائرُ في صفحة التسجيل أيّامَ الشعبة. وقال صاحبُ المنصّة: «sessions or any other details could be
   filled here». فالأيّامُ والساعةُ خلاصةُ اللقاءات المعتمَدة نفسِها، لا حقلٌ يُكتب ثانيةً بيد:

   ① الأيّامُ كلُّ يومٍ وقع فيه لقاء، بترتيب الأسبوع.
   ② والساعةُ أكثرُ ساعات البدء ورودا — وعند التساوي أبكرُها.
   ③ وكلاهما بتوقيت الشعبة: لقاءٌ في الحادية عشرة والنصف ليلا بغرينتش يومُه في عمّان اليومُ التالي. */

import { DAY_CODES, type DayCode } from './days'

export interface SessionPattern {
  daysOfWeek: DayCode[]
  startTime: string
}

export function sessionPattern(starts: readonly Date[], zone: string): SessionPattern | null {
  if (starts.length === 0) return null
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const days = new Set<string>()
  const times = new Map<string, number>()
  for (const at of starts) {
    const part = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]))
    days.add(part.weekday.slice(0, 3).toLowerCase())
    const time = `${part.hour}:${part.minute}`
    times.set(time, (times.get(time) ?? 0) + 1)
  }
  const [startTime] = [...times.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return { daysOfWeek: DAY_CODES.filter((d) => days.has(d)), startTime }
}
