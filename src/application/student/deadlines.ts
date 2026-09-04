/* المواعيدُ النهائيّة — وما يستحقّ أن يُسمّى موعدا (المهمّة ٧٢).

   في المنصّة نوعان من «مستحقّ»، وخلطُهما هو العطبُ:

   ١) **موعدُ تسليمٍ** (`CohortAssessment.dueAt`) — له أثرٌ: من فاته لم يسلّم،
      وقد لا تُصحَّح ورقتُه، وقد تتعذّر شهادتُه. وهذا موعدٌ بالمعنى الكامل.
   ٢) **بطاقةُ استرجاعٍ استُحقّت** (`RetrievalCard.dueAt`) — لا أثرَ لفواتها
      إلّا أنّ التباعدَ يفوت. وهي **ليست موعدا نهائيّا**، وشاشةُ «مراجعتي»
      موضعُها.

   فلو عُرض النوعان في لوحٍ واحدٍ بالشكل نفسِه لَحدث أحدُ أمرَين: يعتاد
   المتعلّمُ أنّ ما في اللوح لا أثرَ له فيتركه كلَّه (ومنه التسليم)، أو يفزع
   من خمسين بطاقةٍ كأنّها خمسون واجبا. ولذلك اللوحُ يعرض **مواعيدَ التسليم
   وحدَها**، ويذكر البطاقاتَ في سطرٍ واحدٍ يشير إلى شاشتها.

   والوقتُ يُمرَّر لا يُقرأ: كلُّ دالّةٍ تأخذ `now` صراحةً فتبقى نقيّةً
   ومختبَرة — ولا يصير الاختبارُ رهنَ ساعةِ الجهاز الذي يُشغّله. */

export const DAY_MS = 86_400_000

/** أفقُ اللوح: ما بعده ليس «قادما» بل بعيد — وعرضُه يُغرق ما يقرب */
export const HORIZON_DAYS = 30

export type Urgency = 'overdue' | 'today' | 'soon' | 'later'

/** بدايةُ يومِ التاريخ بالتوقيت المحلّيّ — الفرقُ بالأيّام التقويميّة لا بالساعات:
    موعدٌ في العاشرة مساءَ اليوم و«بعد ثلاث ساعات» ليسا خبرَين مختلفَين. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** أيّامٌ تقويميّةٌ حتّى الموعد: صفرٌ اليوم، سالبٌ لِما فات */
export function daysUntil(dueAt: string | Date, now: Date): number {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS)
}

export function urgencyOf(dueAt: string | Date, now: Date): Urgency {
  const d = daysUntil(dueAt, now)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 3) return 'soon'
  return 'later'
}

/** عددٌ عربيٌّ صحيحُ الصيغة — لا «٢ تسليما» ولا «٣ بطاقةَ».

    والقاعدةُ في العربيّة أربعُ صيغٍ لا اثنتان: مفردٌ للواحد، ومثنّى للاثنين،
    وجمعٌ من ثلاثةٍ إلى عشرة، ومفردٌ منصوبٌ لأحدَ عشرَ وما بعدها. وشاشةٌ
    تكتب «٢ جلسة» تُقرأ ترجمةً آليّةً فيُقرأ ما فيها كذلك — والنصُّ جزءٌ من
    الميزة لا زينةٌ عليها. والصفرُ يأخذ صيغةَ الجمع («لا جلسات»). */
export interface ArCounts { one: string; two: string; few: string; many: string }

export function countAr(n: number, f: ArCounts): string {
  if (n === 1) return f.one
  if (n === 2) return f.two
  if (n >= 3 && n <= 10) return `${n} ${f.few}`
  if (n === 0) return f.few
  return `${n} ${f.many}`
}

/** نصٌّ عربيٌّ للموعد — والفائتُ يُقال فائتا لا «قبل ٣ أيّام» فحسب */
export function dueLabelAr(dueAt: string | Date, now: Date): string {
  const d = daysUntil(dueAt, now)
  if (d === -1) return 'فات أمس'
  if (d === -2) return 'فات قبل يومين'
  if (d < -2) return `فات قبل ${countAr(-d, { one: 'يوم', two: 'يومين', few: 'أيّام', many: 'يوما' })}`
  if (d === 0) return 'اليوم'
  if (d === 1) return 'غدا'
  if (d === 2) return 'بعد يومين'
  return `بعد ${countAr(d, { one: 'يوم', two: 'يومين', few: 'أيّام', many: 'يوما' })}`
}

/** صيغُ ما يُعَدّ في هذين اللوحَين — في موضعٍ واحدٍ فلا تفترق بين شاشتَين */
export const AR_SUBMISSIONS: ArCounts = { one: 'تسليمٌ واحدٌ', two: 'تسليمان', few: 'تسليمات', many: 'تسليما' }
export const AR_CARDS: ArCounts = { one: 'بطاقةُ استرجاعٍ واحدةٌ', two: 'بطاقتا استرجاعٍ', few: 'بطاقاتِ استرجاعٍ', many: 'بطاقةَ استرجاعٍ' }
export const AR_SESSIONS: ArCounts = { one: 'جلسةٌ واحدةٌ', two: 'جلستان', few: 'جلسات', many: 'جلسةً' }
export const AR_COHORTS: ArCounts = { one: 'شعبةٍ واحدة', two: 'شعبتين', few: 'شعب', many: 'شعبةً' }

/** ترتيبُ العرض: الأقربُ أوّلا، والفائتُ قبل كلّ شيء (وهو الأقربُ حسابا) */
export function byDueAt<T extends { dueAt: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
}
