/* الاسترجاع المتباعد (البند ح-٤) — أقوى ما يسنده الدليل هو الجمع بين شيئين:
   أن تُسترجع المعلومة من الذاكرة لا أن تُعاد قراءتها، وأن يتباعد الاسترجاع في
   الزمن. وجيز مهيّأة له لأن أسئلة الاسترجاع (ح-٣) موجودة على إصدار الوحدة،
   ومهاراتها معرّفة ومصنّفة أصلا.

   خطوط الصدق التي لا تُعبر في هذا الملف:
   ١) الاسترجاع لا يرفع مستوى مهارة ولا يخفضه. المستوى يأتي من القياس (مؤشر
      وجيز والقياس البعديّ ح-٧) لا من بطاقة. من تذكّر جوابا تذكّره — وهذا دليل
      على التذكّر، لا على الإتقان. لهذا لا يكتب هذا الملف في متجه المهارات.
   ٢) لا نقاط ولا سلاسل ولا لوحة صدارة: البحث يجد أثر التلعيب الإجمالي صغيرا
      وبعضه يرفع التسرب. المؤشر الوحيد المسموح هو «ما استُحق اليوم».
   ٣) الجدول معلَن للمتعلم: يرى «تعود بعد ٧ أيام» بدل صندوق أسود.
   ٤) الوقت يُمرَّر لا يُقرأ: كل دالة تأخذ now صراحة فتبقى نقية ومختبرة. */

/** سلّم التباعد بالأيام — أوقات مضاعفة تقريبا، وهي المدى الذي تسنده الدراسات */
export const SPACING_DAYS = [1, 3, 7, 21, 60] as const
export const MAX_STEP = SPACING_DAYS.length - 1
export const DAY_MS = 86_400_000

export interface RetrievalCard {
  /** مفتاح البطاقة: سؤال بعينه في وحدة بعينها */
  moduleId: string
  checkIndex: number
  /** المهارة التي يقيسها السؤال إن رُبط بها — null فيُعرض بعنوان الوحدة */
  skillSlug: string | null
  /** موضعه في سلّم التباعد ٠..٤ */
  step: number
  /** ISO — متى يستحق الاسترجاع */
  dueAt: string
  lastCorrect: boolean | null
  correctCount: number
  wrongCount: number
}

/** الخطوة التالية: الصحيح يتقدم خطوة، والخطأ يعيد إلى أول السلّم بلا عقوبة أخرى */
export function nextStep(step: number, correct: boolean): number {
  if (!correct) return 0
  return Math.min(MAX_STEP, Math.max(0, Math.floor(step)) + 1)
}

/** موعد الاستحقاق التالي من خطوة ووقت — الوقت يُمرَّر فلا مفاجآت في الاختبار */
export function nextDueAt(step: number, from: Date): Date {
  const s = Math.min(MAX_STEP, Math.max(0, Math.floor(step)))
  return new Date(from.getTime() + SPACING_DAYS[s] * DAY_MS)
}

/** نص المدة كما تُقرأ بالعربية — لا «بعد 1 يوم» */
export function spacingLabelAr(step: number): string {
  const s = Math.min(MAX_STEP, Math.max(0, Math.floor(step)))
  const d = SPACING_DAYS[s]
  if (d === 1) return 'يوم'
  if (d === 3) return 'ثلاثة أيام'
  if (d === 7) return 'أسبوع'
  if (d === 21) return 'ثلاثة أسابيع'
  if (d === 60) return 'شهرين'
  return `${d} يوما`
}

/** ما استُحق الآن — ما مضى موعده، بلا تقديم ولا «قرب الاستحقاق» */
export function dueCards<T extends { dueAt: string }>(cards: T[], now: Date): T[] {
  const t = now.getTime()
  return cards
    .filter((c) => {
      const at = Date.parse(c.dueAt)
      return Number.isFinite(at) && at <= t
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}

/** الأقرب موعدا من غير المستحق — لنقول «التالي بعد كذا» بلا اختلاق */
export function nextDueCard<T extends { dueAt: string }>(cards: T[], now: Date): T | null {
  const t = now.getTime()
  const future = cards
    .filter((c) => {
      const at = Date.parse(c.dueAt)
      return Number.isFinite(at) && at > t
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return future[0] ?? null
}

export interface RetrievalSummary {
  /** كل ما للمتعلم من بطاقات */
  total: number
  /** ما استُحق الآن */
  due: number
  /** موعد أقرب بطاقة قادمة — null إن استُحق الكل أو لا بطاقات */
  nextDueAt: string | null
  /** بطاقات في أعلى السلّم (تعود كل شهرين) — «ثابتة الاسترجاع» لا «متقنة» */
  settled: number
  /** بطاقات عادت لأول السلّم بعد خطأ */
  restarted: number
}

export function buildRetrievalSummary(cards: RetrievalCard[], now: Date): RetrievalSummary {
  const due = dueCards(cards, now)
  const next = nextDueCard(cards, now)
  return {
    total: cards.length,
    due: due.length,
    nextDueAt: next?.dueAt ?? null,
    settled: cards.filter((c) => c.step >= MAX_STEP).length,
    restarted: cards.filter((c) => c.step === 0 && c.wrongCount > 0).length,
  }
}

/** سؤال جاهز للعرض: البطاقة ومعها نصّها من إصدار الوحدة */
export interface ReviewItem {
  moduleId: string
  checkIndex: number
  skillSlug: string | null
  skillNameAr: string | null
  moduleTitleAr: string | null
  courseTitleAr: string | null
  step: number
  dueAt: string
  promptAr: string
  options: string[]
  correctIndex: number
  explainAr: string | null
  /** المدة التي سيعود بعدها لو أجاب صحيحا الآن — تُعرض قبل الجواب لا بعده */
  nextIfCorrectAr: string
  /** والمدة لو أخطأ — نعلن الاثنتين فلا يبدو الجدول عقوبة خفية */
  nextIfWrongAr: string
}

/** يبني عناصر المراجعة من بطاقات مستحقة ونصوصها — ترتيب ثابت لا عشوائي */
export function buildReviewQueue(
  due: RetrievalCard[],
  text: Map<string, { promptAr: string; options: string[]; correctIndex: number; explainAr: string | null; moduleTitleAr: string | null; courseTitleAr: string | null }>,
  nameBySlug: Record<string, string> = {},
): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const c of due) {
    const t = text.get(`${c.moduleId}#${c.checkIndex}`)
    /* بطاقة بلا نصّ (حُذف سؤالها من إصدار الوحدة) تُسقط بصمت — ولا تُختلق لها بديلة */
    if (!t) continue
    out.push({
      moduleId: c.moduleId,
      checkIndex: c.checkIndex,
      skillSlug: c.skillSlug,
      skillNameAr: c.skillSlug ? (nameBySlug[c.skillSlug] ?? null) : null,
      moduleTitleAr: t.moduleTitleAr,
      courseTitleAr: t.courseTitleAr,
      step: c.step,
      dueAt: c.dueAt,
      promptAr: t.promptAr,
      options: t.options,
      correctIndex: t.correctIndex,
      explainAr: t.explainAr,
      nextIfCorrectAr: spacingLabelAr(nextStep(c.step, true)),
      nextIfWrongAr: spacingLabelAr(nextStep(c.step, false)),
    })
  }
  return out
}
