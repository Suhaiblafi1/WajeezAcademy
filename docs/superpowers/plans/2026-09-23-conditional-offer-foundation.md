# العرضُ المشروط — الأساس: المستندُ وبياناتُه (خطّةُ تنفيذ)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** أن يصير العقدُ المُرسَلُ **عرضا مشروطا** بمتنه وبنده وبياناته وأعمدةِ
مهلته، وأن تُعاد صياغةُ العقود القائمة عليه — بلا أن يتغيّر سلوكُ الطور بعد.

**Architecture:** ثلاثُ طبقاتٍ لا تختلط. (١) **المخطَّط**: ستّةُ أعمدةِ مهلةٍ
وعمودا عنوانٍ وهاتفٍ على `TrainerContract` — تُكتب ولا يقرؤها منطقٌ بعد، فالطورُ
خطّةٌ ثانية. (٢) **المستند**: `contract-body.ts` وحدةٌ خالصةٌ تعمل في المتصفّح،
فيها بندُ الشرط والمثالُ الحسابيُّ الجديد وسطرُ الجلسة — ترتفع `v4`. (٣)
**المسلك**: `trainer-review.service.ts` يمرّر الحقولَ الجديدة، ويقرأ الملحق (أ)
من `pending` بدل `qualified`، وتقبل صفحةُ التوقيع ثلاثَ نهاياتٍ لا واحدة.

**Tech Stack:** TypeScript · Prisma/PostgreSQL · Fastify · React + Vite ·
Vitest. والاختباراتُ نوعان: `src/tests/**` بلا قاعدةِ بيانات (المسارُ السريع)،
و`server/tests/**` بقاعدةٍ مدمجة — **ولا تعمل المدمجةُ في بيئة التطوير هذه**،
فتُكتب ويُعوَّل على CI.

**Spec:** `docs/superpowers/specs/2026-09-23-conditional-offer-design.md`

**وهي الأولى من اثنتَين.** الثانيةُ («الطور») تبني: توسعةَ البوّابتَين، وفصلَ
`pending`/`qualified` في زرّ التفعيل، والأجوبةَ الثلاثةَ على المحتوى، والعاملَ
وتذكيرَه، والبريدَين، وتوقيعَنا في آخر الطور، وملحقَ الاعتماد. ولا تُكتب قبل أن
تُدمج هذه — فأعمدتُها كلُّها من هنا.

## Global Constraints

- **العربيّةُ لغةُ المستودَع**: التوثيقُ ورسائلُ الالتزام والتعليقاتُ وأسماءُ
  الاختبارات كلُّها عربيّة. (الردُّ في المحادثة إنجليزيّ — أمرٌ آخر.)
- **الحارسُ يُثبَت سقوطُه**: كلُّ اختبارٍ جديدٍ يُنقض ما يحرسه مرّةً ويُرى وهو
  يسقط، وإلّا فهو زينة. والفحصُ على **البنية** لا على ورودِ حرفٍ في ملفّ.
- **البوّابةُ آليّةٌ لا بشريّة**: `npm run verify` ثمّ خضرةُ CI. ولا يُحدَّث
  خطُّ أساسٍ ليمرّ حاجز.
- `CONTRACT_BODY_VERSION` الحاليّ `'v3-2026-09-21'` ← يصير `'v4-2026-09-23'`.
- `CONTRACT_CONSENT_VERSION` الحاليّ `'v2-2026-09-22'` ← يصير `'v3-2026-09-23'`.
- **المهلةُ سبعةُ أيّامٍ** من `orientationAt`، وتُمدَّد **يومين مرّةً واحدة**.
- **أسعارُ المثال**: العامّ `30` · الإحالة `45` · الحدّ الأدنى `8` · العملة
  `USD`. والنتائجُ `600` و`750` و`900`، ثمّ `5 × 750 = 3750`.
- **لا رموزَ لاتينيّةٌ في متن العقد** — أسماءُ دوراتٍ كما يراها في بوّابته.
- **المتنُ يُركَّب مرّةً ويُجمَّد**: `bodyAr` و`bodyHash` لا يُعاد حسابُهما على
  صفٍّ موقَّع، أبدا.
- **ولا يُمَسُّ عقدٌ عليه توقيع**: كلُّ سكربتٍ يكتب في `TrainerContract` يفحص
  `signedAt` و`countersignedAt` والحالةَ قبل أن يكتب.

---

### Task 1: أعمدةُ المهلة وبياناتُ الموقّع في المخطَّط

**Files:**
- Create: `prisma/migrations/20260923120000_conditional_offer_columns/migration.sql`
- Modify: `prisma/schema.prisma` — نموذج `TrainerContract`
- Test: `src/tests/trainer/conditional-offer-schema.test.ts`

**Interfaces:**
- Consumes: لا شيء — هذه أوّلُ المهامّ.
- Produces: ثمانيةُ أعمدةٍ على `TrainerContract`: `orientationAt`,
  `orientationLinkUrl`, `conditionDeadlineAt`, `conditionPausedAt`,
  `conditionExtendedAt`, `conditionRemindedAt`, `conditionMetAt` (كلُّها
  `DateTime?` عدا الرابطَ `String?`)، و`signerAddressAr` و`signerPhone`
  (`String?`). تقرؤها المهامُّ ٥ و٧ و٩ وخطّةُ «الطور» كلُّها.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`src/tests/trainer/conditional-offer-schema.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** يُقرأ المخطَّطُ نصّا لأنّ القاعدةَ المدمجةَ لا تعمل في المسار السريع.
    والفحصُ على **بنية النموذج** لا على ورودِ الكلمة في الملفّ: تُقتطع كتلةُ
    `model TrainerContract` وحدَها، فعمودٌ بالاسم نفسِه في نموذجٍ آخر لا يُمرّر. */
function trainerContractBlock(): string {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const m = schema.match(/^model TrainerContract \{$([\s\S]*?)^\}$/m)
  expect(m, 'لا نموذجَ باسم TrainerContract في المخطَّط').toBeTruthy()
  return m![1]
}

const DATE_COLUMNS = [
  'orientationAt',
  'conditionDeadlineAt',
  'conditionPausedAt',
  'conditionExtendedAt',
  'conditionRemindedAt',
  'conditionMetAt',
] as const

describe('أعمدةُ العرض المشروط', () => {
  it('١) الأعمدةُ الستّةُ للمهلة موجودةٌ وكلُّها DateTime اختياريّة', () => {
    const block = trainerContractBlock()
    const missing = DATE_COLUMNS.filter(
      (c) => !new RegExp(`^\\s*${c}\\s+DateTime\\?`, 'm').test(block),
    )
    expect(missing, 'عمودُ مهلةٍ ناقصٌ أو ليس DateTime? — والمهلةُ تُقرأ تاريخا لا تُحسب').toEqual([])
  })

  it('٢) ولا عمودَ مهلةٍ إلزاميّ — فالعقودُ القائمةُ بلا مهلة', () => {
    const block = trainerContractBlock()
    const required = DATE_COLUMNS.filter(
      (c) => new RegExp(`^\\s*${c}\\s+DateTime\\s`, 'm').test(block),
    )
    expect(required, 'عمودٌ إلزاميٌّ يمنع الترحيل: من وقّع قبل النشر لا مهلةَ له').toEqual([])
  })

  it('٣) ورابطُ الجلسة وبياناتُ الموقّع الثلاثةُ نصوصٌ اختياريّة', () => {
    const block = trainerContractBlock()
    for (const c of ['orientationLinkUrl', 'signerAddressAr', 'signerPhone'] as const) {
      expect(new RegExp(`^\\s*${c}\\s+String\\?`, 'm').test(block), `${c} ناقصٌ أو ليس String?`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run src/tests/trainer/conditional-offer-schema.test.ts`
Expected: FAIL — ثلاثُ حالاتٍ تسقط، والأولى تسمّي الأعمدةَ الستّةَ ناقصةً.

- [ ] **Step 3: أضف الأعمدةَ إلى المخطَّط**

في `prisma/schema.prisma` داخل `model TrainerContract`، بعد كتلة
«لقطةُ الدورات المؤهَّل لها» ومباشرةً قبل `signerEmail`:

```prisma
  /// ─────────── العرضُ المشروط: جلستُه ومهلتُه ───────────
  ///
  /// والمهلةُ تسكن هنا لا في الطلب، لأنّ الشرطَ **بندُ عقدٍ** لا خاصّيّةُ
  /// طلب: هو مكتوبٌ في المتن الذي وقّعه، فمرجعُه الصفُّ الذي يحمل المتن.

  /// تاريخُ جلسة التهيئة الجماعيّة **كما أُعلن له** — لا كما حضرها.
  /// ولو تعلّقت المهلةُ بالحضور لَاحتاجت نقرةَ إنسانٍ يسجّله، ومن نُسي بقي
  /// في الطور أبدا. وبالتاريخ المعلَن يسير العاملُ وحدَه.
  orientationAt        DateTime?
  /// رابطُ الحضور — يُطبَع في بريده. والجلسةُ تُعقد خارج المنصّة، فلا يُبنى
  /// لها حجزٌ ولا تسجيلُ حضورٍ ولا تكرارٌ يُولَّد: تاريخٌ ورابطٌ لا غير.
  orientationLinkUrl   String?
  /// `orientationAt + ٧ أيّام` — يُحسب مرّةً ويُخزَّن، فلا تتبدّل مهلةُ عرضٍ
  /// وُقّع بتبدّلِ ثابتٍ في الشيفرة. و`NULL` تعني **لا مهلةَ عليه**: إمّا
  /// عقدٌ سبق النشر، أو عرضٌ أُرسل ولمّا يُعرَف تاريخُ جلسته.
  conditionDeadlineAt  DateTime?
  /// يُكتب حين يُعلن الاكتمال؛ وعند الردّ بملاحظاتٍ تُضاف مدّةُ التجميد إلى
  /// المهلة ويُمحى. فوقتُ مراجعتنا لا يُحسب عليه.
  conditionPausedAt    DateTime?
  /// تمديدُ اليومين — مرّةً واحدةً لا غير، والثانيةُ تُردّ
  conditionExtendedAt  DateTime?
  /// آخرُ تذكيرٍ بالمهلة — فلا يُطرَق بابٌ مرّتين بتذكير «يومان»
  conditionRemindedAt  DateTime?
  /// اعتُمدت موادُّه — انتهت المهلةُ ولا يُنظَر إليها بعد
  conditionMetAt       DateTime?
```

وبعد `signerLegalName` مباشرةً:

```prisma
  /// عنوانُه وهاتفُه **بخطّه هو** لحظةَ التوقيع — لا تُنقل من نموذج التقديم.
  /// فنموذجُ التقديم بياناتُ ترشُّحٍ تُملأ على عجل، وهذه بياناتُ طرفٍ في عقد.
  signerAddressAr String?
  signerPhone     String?
```

- [ ] **Step 4: اكتب الترحيل**

`prisma/migrations/20260923120000_conditional_offer_columns/migration.sql`:

```sql
-- أعمدةُ العرض المشروط: جلستُه ومهلتُه، وبيانا الموقّع بخطّه.
-- وكلُّها اختياريّةٌ بقصد: العقودُ القائمةُ تبقى بلا مهلة.
ALTER TABLE "TrainerContract"
  ADD COLUMN "orientationAt"       TIMESTAMP(3),
  ADD COLUMN "orientationLinkUrl"  TEXT,
  ADD COLUMN "conditionDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "conditionPausedAt"   TIMESTAMP(3),
  ADD COLUMN "conditionExtendedAt" TIMESTAMP(3),
  ADD COLUMN "conditionRemindedAt" TIMESTAMP(3),
  ADD COLUMN "conditionMetAt"      TIMESTAMP(3),
  ADD COLUMN "signerAddressAr"     TEXT,
  ADD COLUMN "signerPhone"         TEXT;

-- يقرؤه العاملُ كلَّ ساعةٍ ليجد من قاربت مهلتُه أو انقضت، فلا يمسح الجدول.
CREATE INDEX "TrainerContract_conditionDeadlineAt_idx"
  ON "TrainerContract" ("conditionDeadlineAt");
```

وأضف الفهرسَ إلى المخطَّط كي لا يفترق عن الترحيل، في آخر كتلة الفهارس:

```prisma
  @@index([conditionDeadlineAt])
```

- [ ] **Step 5: شغّل الحارسَ وتأكّد أنّه يمرّ**

Run: `npx vitest run src/tests/trainer/conditional-offer-schema.test.ts`
Expected: PASS — ثلاثُ حالات.

- [ ] **Step 6: تأكّد أنّ حارسَ الترحيلات يقبله**

Run: `npm run ci:migrations`
Expected: PASS. فإن ردَّ بأنّ المخطَّطَ يفترق عن الترحيلات، فالسببُ سطرٌ في
أحدهما دون الآخر — يُقابَل العمودان عمودا عمودا.

- [ ] **Step 7: التزم**

```bash
git add prisma/schema.prisma prisma/migrations src/tests/trainer/conditional-offer-schema.test.ts
git commit -m "العرضُ المشروط: أعمدةُ الجلسة والمهلة، وبيانا الموقّع بخطّه

ثمانيةُ أعمدةٍ على TrainerContract، كلُّها اختياريّةٌ بقصد — فالعقودُ
القائمةُ تبقى بلا مهلة، ولا تُبدأ ساعةٌ صامتةٌ على من لم يوقّع عليها.
ولا يقرؤها منطقٌ بعد: الطورُ خطّةٌ ثانية، وهذه أرضُه.

والحارسُ يقرأ كتلةَ النموذج وحدَها لا الملفَّ كلَّه، فعمودٌ بالاسم نفسِه
في نموذجٍ آخر لا يُمرّره. وسقط ثلاثَ حالاتٍ قبل الأعمدة ومرّ بعدها."
```

---

### Task 2: المثالُ الحسابيُّ — دورةٌ واحدةٌ وثلاثةُ مصادر

**Files:**
- Modify: `src/application/trainer/fee-example.ts:47-52` (ثابت `SCENARIO`)
- Test: `src/tests/trainer/fee-example.test.ts`

**Interfaces:**
- Consumes: `perSeatBreakdown` من `./seat-fee` — قائمةٌ بلا تغيير.
- Produces: `buildFeeExampleAr(c)` بالتوقيع نفسِه، وتصير `rows` ثلاثةَ صفوفٍ
  لدورةٍ واحدةٍ بعشرين مقعدا: `600` و`750` و`900`. يقرؤها `feeExampleContractAr`
  (المهمّة ٣) و`feeExampleFactsAr` (يفقد قارئَه في المهمّة ٦).

- [ ] **Step 1: اكتب الحارسَ الساقط**

أضف إلى `src/tests/trainer/fee-example.test.ts`:

```ts
describe('مثالُ الدورة الواحدة بثلاثة مصادر', () => {
  const c = { type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: '45' }

  it('١) ثلاثةُ صفوفٍ لدورةٍ واحدةٍ بعشرين مقعدا: ٦٠٠ · ٧٥٠ · ٩٠٠', () => {
    const ex = buildFeeExampleAr(c)!
    expect(ex.rows.map((r) => r.amount)).toEqual([600, 750, 900])
    expect(ex.rows.map((r) => r.seats), 'العشرون ثابتةٌ في الصفوف الثلاثة — المتغيّرُ مصدرُهم لا عددُهم')
      .toEqual([20, 20, 20])
    expect(ex.rows.map((r) => r.referred)).toEqual([0, 10, 20])
  })

  it('٢) والحدُّ الأدنى لا يُطبَّق في أيّ صفّ — العشرون تفوق الثمانية', () => {
    const ex = buildFeeExampleAr(c)!
    expect(ex.rows.some((r) => r.floorApplied), 'الحدُّ الأدنى على مجموع المقاعد المحتسَبة لا على العامّة وحدَها').toBe(false)
  })

  it('٣) وسعرُ الإحالة الأعلى يعطي الصفَّ الأعلى — وإلّا انقلب الحافز', () => {
    const ex = buildFeeExampleAr(c)!
    const [general, mixed, referred] = ex.rows.map((r) => r.amount)
    expect(general).toBeLessThan(mixed)
    expect(mixed).toBeLessThan(referred)
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run src/tests/trainer/fee-example.test.ts`
Expected: FAIL — `[600, 750, 900]` مقابلَ ما تنتجه الشعبُ الثلاثُ القائمة.

- [ ] **Step 3: بدّل الافتراض**

في `src/application/trainer/fee-example.ts` استبدل `SCENARIO` بهذا، وبدّل
تعليقَه فوقَه:

```ts
/* ═══ دورةٌ واحدةٌ بعشرين مسجّلا، وثلاثةُ مصادر ═══

   وكانت ثلاثَ شعبٍ بأعدادٍ مختلفة، فكان القارئُ يقارن رقمين يختلفان في
   شيئين معا (العددِ والمصدر) ولا يعزل أثرَ أيّهما. فثُبّت العددُ وتغيّر
   المصدرُ وحدَه: ما يراه هو **ثمنُ رابطه** صافيا، وهو الدرسُ المقصود. */
const SCENARIO = [
  { seats: 20, referred: 0 },
  { seats: 20, referred: 10 },
  { seats: 20, referred: 20 },
] as const
```

ثمّ صحّح تسميةَ الصفوف في `buildFeeExampleAr` حيث تُبنى `labelAr` — فهي اليومَ
«الشعبة الأولى/الثانية/الثالثة» ولم تعد شعبا:

```ts
const SCENARIO_LABELS_AR = [
  'عشرون مسجّلا، كلُّهم من الأكاديميّة',
  'عشرون مسجّلا، عشرةٌ منهم عبر رابطك',
  'عشرون مسجّلا، كلُّهم عبر رابطك',
] as const
```

واستعملها مكانَ التسمية القائمة بفهرس الصفّ.

- [ ] **Step 4: شغّل وتأكّد أنّه يمرّ**

Run: `npx vitest run src/tests/trainer/fee-example.test.ts`
Expected: PASS — الحالاتُ الثلاثُ الجديدةُ والقائمةُ معها.

- [ ] **Step 5: انقض الحارسَ مرّةً لتراه يسقط**

بدّل `referralRate` في الاختبار من `'45'` إلى `'20'` (أقلَّ من العامّ) وشغّل:
يجب أن تسقط الحالةُ ٣ بأنّ الترتيبَ انقلب. أعده إلى `'45'` بعدها.

- [ ] **Step 6: التزم**

```bash
git add src/application/trainer/fee-example.ts src/tests/trainer/fee-example.test.ts
git commit -m "المثالُ الحسابيّ: دورةٌ واحدةٌ بعشرين مسجّلا وثلاثةُ مصادر

كان ثلاثَ شعبٍ بأعدادٍ مختلفة، فيقارن القارئُ رقمين يختلفان في شيئين معا
ولا يعزل أثرَ أيّهما. فثُبّت العددُ وتغيّر المصدرُ وحدَه: ٦٠٠ إن كانوا
كلُّهم منّا · ٧٥٠ بالنصف · ٩٠٠ إن كانوا كلُّهم عبر رابطه.

ولا معادلةَ تغيّرت: الأرقامُ من perSeatBreakdown نفسِه. وقِيس أنّ الحدَّ
الأدنى لا يفسد الصفَّ الثالث — فهو على مجموع المقاعد المحتسَبة لا على
العامّة وحدَها."
```

---

### Task 3: بندُ الشرط وسطرُ الجلسة في المتن

**Files:**
- Modify: `src/application/trainer/contract-body.ts` — `CONTRACT_BODY_VERSION`,
  `ContractBodyInput`, `renderContractBodyAr`
- Test: `src/tests/trainer/contract-conditional-clause.test.ts`

**Interfaces:**
- Consumes: `ContractCompensation` و`RequiredDocument` كما هما.
- Produces: `ContractBodyInput` يكتسب ثلاثةَ حقول:
  `isConditionalOffer: boolean`، `orientationAtAr: string | null`،
  `conditionDeadlineAtAr: string | null`. ويصير
  `CONTRACT_BODY_VERSION = 'v4-2026-09-23'`. يمرّرها المسلكُ في المهمّة ٦.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`src/tests/trainer/contract-conditional-clause.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CONTRACT_BODY_VERSION, renderContractBodyAr } from '@/application/trainer/contract-body'

function render(over: Partial<Parameters<typeof renderContractBodyAr>[0]> = {}) {
  return renderContractBodyAr({
    academyPartyLineAr: 'أكاديمية وجيز',
    academyLegalNameAr: 'شركة وجيز',
    academyTradingNameAr: 'وجيز',
    governingLawAr: 'القانون الأردني',
    disputeVenueAr: 'محاكم عمّان',
    trainerFullName: 'عبد الرحمن',
    trainerEmail: 'a@b.co',
    applicationReference: 'WJ-TR-2026-00041',
    issuedOnAr: '٢٣ سبتمبر ٢٠٢٦',
    courses: [{ courseId: 'C-FAM-101', titleAr: 'دورة الحوار الأسري' }],
    compensation: { type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: '45' },
    rateWaivedReasonAr: null,
    hoursNoteAr: null,
    requiredDocuments: [],
    isConditionalOffer: true,
    orientationAtAr: '١ أكتوبر ٢٠٢٦',
    conditionDeadlineAtAr: '٨ أكتوبر ٢٠٢٦',
    ...over,
  })
}

describe('بندُ الشرط في متن العرض', () => {
  it('١) الإصدارُ ارتفع إلى v4', () => {
    expect(CONTRACT_BODY_VERSION).toBe('v4-2026-09-23')
    expect(render()).toContain('v4-2026-09-23')
  })

  it('٢) وستُّ فقراتٍ للشرط، كلٌّ منها يحمل معناه لا لفظَه وحدَه', () => {
    const body = render()
    // لكلّ فقرةٍ شاهدان لا يجتمعان صدفةً — فالفحصُ على المعنى لا على كلمةٍ واحدة
    expect(body, 'الشرطُ نفسُه').toMatch(/مشروط[\s\S]{0,120}قبول[\s\S]{0,80}موادّ/)
    expect(body, 'لكلّ دورةٍ على حدة').toMatch(/لكل دورة على حدة/)
    expect(body, 'سبعةُ أيّامٍ من الجلسة').toMatch(/سبعة أيام[\s\S]{0,120}جلسة التهيئة/)
    expect(body, 'التمديدُ مرّةً يومين').toMatch(/يومين[\s\S]{0,60}مرة واحدة/)
    expect(body, 'التجميدُ وقتَ المراجعة').toMatch(/تتجمد[\s\S]{0,120}للتقييم/)
    expect(body, 'ولا إخلالَ من أحد').toMatch(/لا إخلال من أحد الطرفين/)
  })

  it('٣) وتاريخا الجلسة والمهلة مطبوعان في المتن — لا في البريد وحدَه', () => {
    const body = render()
    expect(body).toContain('١ أكتوبر ٢٠٢٦')
    expect(body).toContain('٨ أكتوبر ٢٠٢٦')
  })

  it('٤) وبلا تاريخِ جلسةٍ يُطبَع المتنُ ولا يكذب — ولا سطرَ فارغٌ فيه', () => {
    const body = render({ orientationAtAr: null, conditionDeadlineAtAr: null })
    expect(body).toMatch(/موعد جلسة التهيئة يبلغك في رسالة مستقلة/)
    expect(body, 'لا يُطبَع تاريخٌ لا نعرفه').not.toMatch(/من تاريخ\s*\./)
  })

  it('٥) وعقدٌ غيرُ مشروطٍ لا بندَ شرطَ فيه ولا ذكرَ لجلسة', () => {
    const body = render({ isConditionalOffer: false, orientationAtAr: null, conditionDeadlineAtAr: null })
    expect(body).not.toMatch(/جلسة التهيئة/)
    expect(body).not.toMatch(/لا إخلال من أحد الطرفين/)
  })

  it('٦) والعنوانُ يقول عرضا مشروطا حين يكون كذلك، وعقدا حين لا يكون', () => {
    expect(render()).toMatch(/عرض مشروط/)
    expect(render({ isConditionalOffer: false })).not.toMatch(/عرض مشروط/)
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run src/tests/trainer/contract-conditional-clause.test.ts`
Expected: FAIL — الستُّ كلُّها؛ أوّلُها على الإصدار.

- [ ] **Step 3: ارفع الإصدارَ ووسّع المُدخَل**

في `src/application/trainer/contract-body.ts`:

```ts
export const CONTRACT_BODY_VERSION = 'v4-2026-09-23'
```

وأضف إلى `ContractBodyInput` بعد `requiredDocuments`:

```ts
  /** أعرضٌ مشروطٌ هذا أم عقدٌ مطلق؟ يغيّر العنوانَ ويضيف بندَ الشرط. */
  isConditionalOffer: boolean
  /** تاريخُ جلسة التهيئة مكتوبا — أو `null` إن لم يُعرَف بعد، فلا يُطبَع
      تاريخٌ لا نعرفه ولا سطرٌ فارغٌ مكانَه. */
  orientationAtAr: string | null
  /** نهايةُ المهلة مكتوبةً — `null` تتبع `orientationAtAr` ولا تفارقها */
  conditionDeadlineAtAr: string | null
```

- [ ] **Step 4: اكتب بندَ الشرط**

أضف هذه الدالّةَ قبل `renderContractBodyAr`:

```ts
/** بندُ الشرط — ستُّ فقراتٍ لا خامسةَ لها ولا سابعة.

    والخامسةُ («لا إخلالَ من أحد») هي ما يشتري الحمايةَ فعلا: بها يكفّ «لم
    نقبل موادَّك» عن كونه سببَ فسخٍ ويصير شرطا لم يكتمل. وهي امتدادٌ للبند ٢
    القائم («محلّ الاتفاقية: التأهيل لا الإسناد») لا نقضٌ له — فالعقدُ أصلا
    لا يَعِد بإسناد. */
function conditionClauseAr(orientationAtAr: string | null, deadlineAtAr: string | null): string {
  const timing = orientationAtAr && deadlineAtAr
    ? `مهلته سبعة أيام تبدأ من تاريخ جلسة التهيئة المعلن في هذا العرض (${orientationAtAr}) وتنتهي في ${deadlineAtAr}`
    : 'مهلته سبعة أيام تبدأ من تاريخ جلسة التهيئة، وموعد جلسة التهيئة يبلغك في رسالة مستقلة ومنه تبدأ المهلة'
  return [
    '21- الشرط الموقوف عليه هذا العرض',
    '',
    '21-1 هذا العرض مشروط بقبول الأكاديمية دورات المدرب ومحاورها وموادها وتكاليفها.',
    '21-2 والاعتماد لكل دورة على حدة، ولا يدرس المدرب إلا ما اعتمد منها. ولا يلزم قبول كل ما يقدم.',
    `21-3 و${timing}، وتمدد يومين مرة واحدة بطلب المدرب.`,
    '21-4 وتتجمد المهلة ما دامت المواد عند الأكاديمية للتقييم، فوقت المراجعة لا يحسب على المدرب.',
    '21-5 وإن لم يتحقق هذا الشرط فلا إخلال من أحد الطرفين، وللمدرب أن يؤجل إلى الموسم القادم أو يطلب حذف حسابه.',
    '21-6 وقبل تحقق الشرط: لا إسناد شعبة، ولا استحقاق أتعاب، ولا ظهور عام.',
  ].join('\n')
}
```

- [ ] **Step 5: صِله بالمتن والعنوان**

داخل `renderContractBodyAr`، بدّل سطرَ العنوان ليقرأ العلمَ الجديد، وأدرج
البندَ بعد البند ٢٠ وقبل الملاحق:

```ts
  const titleAr = input.isConditionalOffer
    ? 'عرض مشروط لتقديم خدمات تدريبية'
    : 'اتفاقية تقديم خدمات تدريبية'
```

```ts
  const conditionBlock = input.isConditionalOffer
    ? '\n\n' + conditionClauseAr(input.orientationAtAr, input.conditionDeadlineAtAr)
    : ''
```

وضع `${conditionBlock}` في القالب بين آخر بندٍ وأوّل ملحق.

- [ ] **Step 6: شغّل وتأكّد أنّه يمرّ**

Run: `npx vitest run src/tests/trainer/contract-conditional-clause.test.ts`
Expected: PASS — ستُّ حالات.

- [ ] **Step 7: انقض الحارسَ مرّتين لتراه يسقط**

(أ) احذف الفقرة `21-5` من `conditionClauseAr` وشغّل: تسقط الحالةُ ٢ باسم
«ولا إخلالَ من أحد». (ب) اجعل `titleAr` ثابتا على «عرض مشروط» وشغّل: تسقط
الحالةُ ٦. أعِد الاثنين.

- [ ] **Step 8: التزم**

```bash
git add src/application/trainer/contract-body.ts src/tests/trainer/contract-conditional-clause.test.ts
git commit -m "متنُ العرض المشروط: بندُ الشرط وتاريخا الجلسة والمهلة — v4

ستُّ فقراتٍ في البند ٢١، وخامستُها هي التي تشتري الحمايةَ: «لا إخلالَ من
أحد الطرفين» تجعل «لم نقبل موادَّك» شرطا لم يكتمل لا سببَ فسخ. وهي امتدادٌ
للبند ٢ القائم لا نقضٌ له.

والعنوانُ يقول عرضا مشروطا حين يكون كذلك. ومن أُرسل إليه عرضٌ ولمّا يُعرَف
تاريخُ جلسته يُطبَع متنُه ولا يكذب: سطرٌ يقول إنّ الموعد يبلغه لاحقا ومنه
تبدأ — لا تاريخٌ نخترعه ولا فراغٌ مكانه.

وسقط الحارسُ عند نقض فقرتين (حذفِ ٢١-٥، وتثبيتِ العنوان)."
```

---

### Task 4: الإقرارُ السابع — يقرّ بأنّ العرضَ مشروط

**Files:**
- Modify: `src/application/trainer/contract-body.ts` — `CONTRACT_CONSENT_VERSION`, `CONTRACT_ACKS`
- Test: `src/tests/trainer/contract-conditional-clause.test.ts` (يُضاف إليه)

**Interfaces:**
- Consumes: `ContractAck` القائم.
- Produces: `CONTRACT_ACKS` يصير ثمانيةَ إقرارات (كان سبعة)، والجديدُ مفتاحُه
  `conditional_offer`. و`CONTRACT_CONSENT_VERSION = 'v3-2026-09-23'`.
  يقرؤهما مسلكُ التوقيع في `trainer-review.service.ts:1988` و`:2124` بلا تغيير.

- [ ] **Step 1: اكتب الحارسَ الساقط**

أضف إلى `src/tests/trainer/contract-conditional-clause.test.ts`:

```ts
import { CONTRACT_ACKS, CONTRACT_CONSENT_VERSION } from '@/application/trainer/contract-body'

describe('الإقرارُ بأنّ العرضَ مشروط', () => {
  it('١) إصدارُ الإقرارات ارتفع إلى v3', () => {
    expect(CONTRACT_CONSENT_VERSION).toBe('v3-2026-09-23')
  })

  it('٢) وإقرارٌ مفتاحُه conditional_offer يقول الشرطَ ومصيرَه', () => {
    const ack = CONTRACT_ACKS.find((a) => a.key === 'conditional_offer')
    expect(ack, 'لا إقرارَ بالشرط — فيوقّع على عرضٍ مشروطٍ ولا يقرّ أنّه مشروط').toBeTruthy()
    expect(ack!.textAr).toMatch(/مشروط/)
    expect(ack!.textAr, 'ويقول ما يصير إليه إن تحقّق').toMatch(/اعتمد/)
  })

  it('٣) ولا مفتاحَ مكرّرٌ — فالإقراراتُ تُحفَظ مصفوفةً وتُقرأ بمفاتيحها', () => {
    const keys = CONTRACT_ACKS.map((a) => a.key)
    expect(keys.length, 'مفتاحٌ مكرّر').toBe(new Set(keys).size)
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run src/tests/trainer/contract-conditional-clause.test.ts`
Expected: FAIL — الحالتان ١ و٢.

- [ ] **Step 3: أضف الإقرارَ وارفع الإصدار**

```ts
export const CONTRACT_CONSENT_VERSION = 'v3-2026-09-23'
```

وأضف إلى `CONTRACT_ACKS` **قبل** `identity_true` (فيبقى الأخيرُ أخيرا، وهو
المتّصلُ بحقول الهويّة تحته مباشرةً في الصفحة):

```ts
  /* ═══ يقرّ بأنّ ما يوقّعه عرضٌ مشروط — لا عقدٌ نافذ ═══

     وهو الإقرارُ الوحيدُ الذي يقول للموقّع إنّ **ما بين يديه ليس نهائيّا**.
     وبدونه يوقّع رجلٌ وثيقةً عنوانُها «عرض مشروط» ثمّ يقول بحقٍّ إنّه لم
     يُنبَّه: العنوانُ يُقرأ مرّةً ويُنسى، والإقرارُ يُضغَط عليه. */
  {
    key: 'conditional_offer',
    textAr: 'أفهم أن هذا عرض مشروط لا عقد نهائي، وأن الشرط الوحيد الباقي هو أن تعتمد الأكاديمية موادي ومحاور دوراتي، وأن الاعتماد لكل دورة على حدة. وأفهم أنه إذا اعتمدت موادي صار هذا العرض عقدا نهائيا موقعا من الطرفين، وأنه إن لم يتحقق الشرط فلا إخلال من أحد الطرفين.',
  },
```

- [ ] **Step 4: شغّل وتأكّد أنّه يمرّ**

Run: `npx vitest run src/tests/trainer/contract-conditional-clause.test.ts`
Expected: PASS.

- [ ] **Step 5: تأكّد ألّا اختبارا قائما يعدّ الإقرارات**

Run: `npx vitest run src/tests/trainer`
Expected: PASS. فإن سقط اختبارٌ يقول «سبعة إقرارات» فهو يعدُّ عددا ثابتا —
يُصحَّح إلى ثمانية، **ولا يُحذف الإقرارُ ليمرّ**.

- [ ] **Step 6: التزم**

```bash
git add src/application/trainer/contract-body.ts src/tests/trainer/contract-conditional-clause.test.ts
git commit -m "إقرارٌ ثامن: يقرّ بأنّ ما يوقّعه عرضٌ مشروط — v3

وهو الإقرارُ الوحيدُ الذي يقول للموقّع إنّ ما بين يديه ليس نهائيّا.
والعنوانُ يُقرأ مرّةً ويُنسى، والإقرارُ يُضغَط عليه."
```

---

### Task 5: بياناتُ الموقّع بخطّه — العنوانُ والهاتف

**Files:**
- Modify: `src/pages/ContractSign.tsx` — حقول التوقيع
- Modify: `server/services/trainer-review.service.ts:2093` — كتابةُ الصفّ
- Test: `server/tests/trainer/contract-signer-details.test.ts`

**Interfaces:**
- Consumes: عمودا `signerAddressAr` و`signerPhone` من المهمّة ١.
- Produces: مُدخَلُ التوقيع يكتسب `addressAr: string` و`phone: string`
  إلزاميَّين. ويكتبهما مسلكُ التوقيع في الصفّ مع `signerLegalName`.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`server/tests/trainer/contract-signer-details.test.ts`.

> **من أين تأتي `sentContract` و`signContract`:** لا تُخترعان. اقرأ
> `server/tests/trainer/contract-signing.test.ts` أوّلا وانسخ منه تهيئتَه
> حرفا بحرف — بناءَ الطلب والملفّ والعقد، وسكَّ الرمز، ونداءَ التوقيع. وهي
> الملفُّ المرجعُ لكلّ اختبارِ عقدٍ في `server/tests`.

```ts
import { describe, expect, it } from 'vitest'

describe('بياناتُ الموقّع بخطّه', () => {
  it('١) تُحفَظ كما كتبها — لا كما في نموذج التقديم', async () => {
    const { token, contractId } = await sentContract({ applicantAddress: 'عنوانُ الطلب القديم' })
    await signContract(token, {
      legalName: 'عبد الرحمن محمد علي',
      addressAr: 'عمّان — الدوّار السابع، بناية ١٢',
      phone: '+962790000000',
    })
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(c.signerAddressAr).toBe('عمّان — الدوّار السابع، بناية ١٢')
    expect(c.signerPhone).toBe('+962790000000')
    expect(c.signerAddressAr, 'لا يُنقل عنوانُ نموذج التقديم').not.toBe('عنوانُ الطلب القديم')
  })

  it('٢) ولا يُقبل توقيعٌ بلا عنوانٍ أو هاتف', async () => {
    const { token } = await sentContract()
    await expect(signContract(token, { legalName: 'عبد الرحمن', addressAr: '  ', phone: '+962790000000' }))
      .rejects.toThrow(/العنوان/)
    await expect(signContract(token, { legalName: 'عبد الرحمن', addressAr: 'عمّان', phone: '' }))
      .rejects.toThrow(/الهاتف/)
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run server/tests/trainer/contract-signer-details.test.ts`
Expected: FAIL — والقاعدةُ المدمجةُ لا تعمل في هذه البيئة، فيسقط بعجزِ
التهيئة. **وهذا متوقَّع**: يُكتب الحارسُ ويُقرأ في CI، ولا يُحكَم عليه محلّيّا.

- [ ] **Step 3: أضف الحقلين إلى صفحة التوقيع**

في `src/pages/ContractSign.tsx` بجانب حقل الاسم القانونيّ:

```tsx
<label className="field">
  <span>العنوان الكامل</span>
  <input
    value={addressAr}
    onChange={(e) => setAddressAr(e.target.value)}
    required
    placeholder="المدينة، الشارع، رقم البناية"
  />
  <small>كما تريده مثبتا في العقد — لا ينقل من نموذج تقديمك.</small>
</label>
<label className="field">
  <span>رقم الهاتف</span>
  <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" />
</label>
```

- [ ] **Step 4: اقبلهما في الخادم**

في `server/services/trainer-review.service.ts` عند مسلك التوقيع (السطر ~2093)
أضف الفحصَ قبل الكتابة، ثمّ الحقلين إلى `data`:

```ts
    const addressAr = (input.addressAr ?? '').trim()
    const phone = (input.phone ?? '').trim()
    if (!addressAr) throw new AuthError('no_address', 'العنوان مطلوب — وهو بيانُ طرفٍ في عقد', 422)
    if (!phone) throw new AuthError('no_phone', 'رقم الهاتف مطلوب', 422)
```

```ts
          signerLegalName: legalName,
          signerAddressAr: addressAr,
          signerPhone: phone,
```

- [ ] **Step 5: شغّل المسارَ السريعَ كلَّه**

Run: `npx vitest run src/tests`
Expected: PASS — فإن سقط اختبارُ صفحةٍ يبني نموذجَ التوقيع، فهو ينقص حقلين.

- [ ] **Step 6: التزم**

```bash
git add src/pages/ContractSign.tsx server/services/trainer-review.service.ts server/tests/trainer/contract-signer-details.test.ts
git commit -m "الموقّعُ يكتب عنوانَه وهاتفَه بخطّه — لا تُنقل من نموذج التقديم

فنموذجُ التقديم بياناتُ ترشُّحٍ تُملأ على عجل، وهذه بياناتُ طرفٍ في عقد.
ويُردّ التوقيعُ بلا أحدهما.

والحارسُ في server/tests — والقاعدةُ المدمجةُ لا تعمل في بيئة التطوير،
فيُقرأ في CI."
```

---

### Task 6: الملحق (أ) يقرأ ما اخترناه له — `pending` لا `qualified`

**Files:**
- Modify: `server/services/trainer-review.service.ts:1594-1600` (`contractPrefill`)
- Modify: `server/services/trainer-review.service.ts:1640-1656` (`contractBodyInput`)
- Modify: `server/services/trainer-review.service.ts:1815` (حذفُ المثال من البريد)
- Test: `server/tests/trainer/contract-prefill-pending.test.ts`

**Interfaces:**
- Consumes: حقولُ `ContractBodyInput` الثلاثةُ من المهمّة ٣.
- Produces: `contractPrefill` يعيد `courses` من `pending` **و**`qualified` معا،
  ويعيد `isConditionalOffer: boolean`. تقرؤه شاشةُ التركيب في المهمّة ٧.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`server/tests/trainer/contract-prefill-pending.test.ts`.

> **ومن أين تأتي `conditionallyApproved` و`qualify` و`activeTrainer` و`service`:**
> من `server/tests/trainer/application-contract.test.ts` — اقرأه وانسخ منه بناءَ
> الطلب حتّى `conditionally_approved`، وإنشاءَ `TrainerReviewService`. و`qualify`
> سطرٌ واحد: `prisma.trainerCourseQualification.create({ data: { profileId, courseId, status } })`.

```ts
describe('ملحقُ العرض المشروط يقرأ ما اخترناه له', () => {
  it('١) دورةٌ pending تدخل الملحقَ — وإلّا طُبع فارغا', async () => {
    const { applicationId } = await conditionallyApproved()
    await qualify(applicationId, 'C-FAM-101', 'pending')
    const pre = await service.contractPrefill(applicationId)
    expect(pre.courses.map((c) => c.courseId)).toContain('C-FAM-101')
  })

  it('٢) ودورةٌ rejected أو retired لا تدخله', async () => {
    const { applicationId } = await conditionallyApproved()
    await qualify(applicationId, 'C-FAM-102', 'rejected')
    await qualify(applicationId, 'C-FAM-103', 'retired')
    const pre = await service.contractPrefill(applicationId)
    expect(pre.courses.map((c) => c.courseId)).toEqual([])
  })

  it('٣) والعرضُ مشروطٌ لمن لم يبلغ active، ومطلقٌ لمن بلغه', async () => {
    const cond = await conditionallyApproved()
    expect((await service.contractPrefill(cond.applicationId)).isConditionalOffer).toBe(true)
    const live = await activeTrainer()
    expect((await service.contractPrefill(live.applicationId)).isConditionalOffer).toBe(false)
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run server/tests/trainer/contract-prefill-pending.test.ts`
Expected: FAIL (أو عجزُ تهيئةٍ محلّيّا — يُقرأ في CI كما في المهمّة ٥).

- [ ] **Step 3: وسّع الاستعلامَ وأضف العلم**

في `contractPrefill` بدّل الاستعلامَ:

```ts
    /* ═══ pending وqualified معا — ولكلٍّ معناه ═══

       `pending` ما اخترناه له في الاعتماد الداخليّ، و`qualified` ما قُبلت
       موادُّه فيه. والعرضُ المشروطُ يُرسَل قبل أن تُقبل مادّةٌ واحدة، فلو
       قرأ `qualified` وحدَها لَطُبع الملحقُ فارغا في مستندٍ يُوقَّع.

       ولا يُدرَّس بـ`pending` شيء: زرُّ التفعيل يعدّ `qualified` وحدَها
       (خطّةُ «الطور»)، وهذا ملحقٌ يُقرأ لا صلاحيّةٌ تُمنَح. */
    const quals = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId: app.profile.id, status: { in: ['pending', 'qualified'] } },
      select: { courseId: true },
    })
```

وأضف إلى ما يُعاد، بجانب `gatesActivation`:

```ts
      /* والشرطُ يلحق من لم يصر مدرّبا بعد. أمّا النشطُ فبندٌ يُوثَّق على ملفٍّ
         حيّ — ولا شرطَ يُلحَق به، وهو نفسُ تفريق `gatesActivation`. */
      isConditionalOffer: app.status !== 'active',
```

- [ ] **Step 4: مرّر الحقولَ الثلاثةَ إلى المتن**

في `contractBodyInput` أضف إلى الكائن المُعاد:

```ts
      isConditionalOffer: args.isConditionalOffer,
      orientationAtAr: args.orientationAt
        ? fmtDateWith(args.orientationAt, { year: 'numeric', month: 'long', day: 'numeric' })
        : null,
      conditionDeadlineAtAr: args.conditionDeadlineAt
        ? fmtDateWith(args.conditionDeadlineAt, { year: 'numeric', month: 'long', day: 'numeric' })
        : null,
```

ووسّع `args` في `previewContract` و`composeContract` بالثلاثة، آخذا
`orientationAt` من `input` (المهمّة ٧). وحسابُ المهلة **لا يُكتب هنا**: هو في
الوحدة الخالصة التي تنشئها الخطوةُ التالية، ويُستورَد منها.

```ts
import { conditionDeadlineFrom } from '../../src/application/trainer/condition-window'
```

- [ ] **Step 5: أنشئ وحدةَ المهلة الخالصة**

`src/application/trainer/condition-window.ts` — وهي هنا لا في الخدمة لأنّ
حسابَ المهلة منطقٌ يُختبَر في المسار السريع، ولا يُدفَن في خدمةٍ بألفَي سطرٍ
تحتاج قاعدةً لتُشغَّل:

```ts
/* مهلةُ العرض المشروط — حسابٌ خالصٌ لا قاعدةَ تحته.

   وتُحسب مرّةً وتُخزَّن في `conditionDeadlineAt`، فلا تتبدّل مهلةُ عرضٍ
   وُقّع بتبدّلِ هذا الثابت. ومن قرأها من الصفّ قرأ تاريخا حقيقيّا لا حسابا
   يُعاد عند كلّ قراءة. */

/** قرارُ صاحب المنصّة (٢٣ سبتمبر ٢٠٢٦): سبعةُ أيّامٍ من جلسة التهيئة */
export const CONDITION_WINDOW_DAYS = 7

/** وتمديدُها مرّةً واحدةً لا غير */
export const CONDITION_EXTENSION_DAYS = 2

const DAY_MS = 24 * 60 * 60 * 1000

/** `null` تعني **لا مهلةَ عليه** — عرضٌ أُرسل ولمّا يُعرَف تاريخُ جلسته،
    أو عقدٌ سبق النشر. ولا تُبدأ ساعةٌ صامتةٌ على أحد. */
export function conditionDeadlineFrom(orientationAt: Date | null): Date | null {
  if (!orientationAt) return null
  return new Date(orientationAt.getTime() + CONDITION_WINDOW_DAYS * DAY_MS)
}
```

- [ ] **Step 6: احذف المثالَ الحسابيَّ من البريد**

في `server/services/trainer-review.service.ts:1815` احذف السطرَ:

```ts
        { kind: 'facts' as const, rows: feeExampleFactsAr(args.feeExample) },
```

واحذف `feeExampleFactsAr` من سطر الاستيراد في `:34`. والدالّةُ تبقى في
`fee-example.ts` باختبارها — فهي قد تُقرأ ثانيةً، ولا يُحذف مُصدَّرٌ مختبَرٌ
لأنّ قارئَه الوحيدَ ذهب.

- [ ] **Step 7: شغّل المسارَ السريع**

Run: `npx vitest run src/tests`
Expected: PASS.

- [ ] **Step 8: التزم**

```bash
git add server/services/trainer-review.service.ts src/application/trainer/condition-window.ts server/tests/trainer/contract-prefill-pending.test.ts
git commit -m "ملحقُ العرض المشروط يقرأ ما اخترناه له، والمثالُ يخرج من البريد

كان contractPrefill يقرأ qualified وحدَها، والعرضُ المشروطُ يُرسَل قبل أن
تُقبل مادّةٌ واحدة — فكان الملحقُ يُطبَع فارغا في مستندٍ يُوقَّع. فصار
يقرأ pending معها: ما اخترناه له في الاعتماد الداخليّ.

ولا يُدرَّس بـpending شيء — زرُّ التفعيل يعدّ qualified وحدَها.

والمثالُ الحسابيُّ في متن العقد وحدَه بقرار صاحب المنصّة، فحُذف من البريد.
وfeeExampleFactsAr تبقى باختبارها: لا يُحذف مُصدَّرٌ مختبَرٌ لأنّ قارئَه ذهب."
```

---

### Task 7: شاشةُ التركيب — الأتعابُ وتاريخُ الجلسة في مكانهما

**Files:**
- Modify: `src/pages/admin/TrainerContracts.tsx`
- Modify: `server/services/trainer-review.service.ts` — `ContractComposeInput`, `composeContract`
- Test: `src/tests/trainer/contract-composer.test.ts`

**Interfaces:**
- Consumes: `contractPrefill` الموسَّعُ من المهمّة ٦، و`conditionDeadlineFrom`.
- Produces: `ContractComposeInput` يكتسب `orientationAt: string | null`،
  `orientationLinkUrl: string | null`، و`compensation?: { rate, referralRate,
  minSeats }` — وإن حضرت مُرّرت إلى `setRule` **قبل** التركيب في المعاملة نفسِها.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`src/tests/trainer/contract-composer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { conditionDeadlineFrom, CONDITION_WINDOW_DAYS } from '@/application/trainer/condition-window'

describe('مهلةُ العرض تُحسب من الجلسة', () => {
  it('١) سبعةُ أيّامٍ بالضبط', () => {
    expect(CONDITION_WINDOW_DAYS).toBe(7)
    const d = conditionDeadlineFrom(new Date('2026-10-01T19:00:00Z'))!
    expect(d.toISOString()).toBe('2026-10-08T19:00:00.000Z')
  })

  it('٢) وبلا جلسةٍ لا مهلة — لا تُبدأ ساعةٌ صامتة', () => {
    expect(conditionDeadlineFrom(null)).toBeNull()
  })

  it('٣) وعرضان بجلسةٍ واحدةٍ تنتهي مهلتُهما معا، ولو وُقّعا في يومَين', () => {
    const session = new Date('2026-10-01T19:00:00Z')
    expect(conditionDeadlineFrom(session)!.getTime()).toBe(conditionDeadlineFrom(new Date(session))!.getTime())
  })
})
```

> **ملحوظة:** الوحدةُ `src/application/trainer/condition-window.ts` أُنشئت في
> المهمّة ٦ (الخطوة ٥). وهذا الحارسُ يقيس حسابَها، والمهمّةُ تصله بالشاشة.

- [ ] **Step 2: شغّله**

Run: `npx vitest run src/tests/trainer/contract-composer.test.ts`
Expected: PASS إن أُنجزت المهمّةُ ٦ — وإلّا «Cannot find module». فإن سقط
بغير ذلك فالحسابُ خاطئٌ ويُصحَّح في الوحدة قبل المضيّ.

- [ ] **Step 3: انقض الحارسَ لتراه يسقط**

بدّل `CONDITION_WINDOW_DAYS` إلى `10` وشغّل: تسقط الحالتان ١ و٢. أعِده إلى `7`.

- [ ] **Step 4: تأكّد من خضرة المسار السريع**

Run: `npx vitest run src/tests/trainer/contract-composer.test.ts`
Expected: PASS — ثلاثُ حالات.

- [ ] **Step 5: أضف الحقولَ إلى الشاشة**

في `src/pages/admin/TrainerContracts.tsx` أضف قسمين قبل زرّ التركيب:

```tsx
<fieldset>
  <legend>الأتعاب</legend>
  <p className="hint">تضبط هنا ثم يركب العقد — فلا شاشة ثانية. والكتابة تمر
    بمسلك قاعدة الأتعاب نفسه، فيبقى كاتب القاعدة واحدا.</p>
  <label>سعر المقعد عبر رابطه <input type="number" value={referralRate} onChange={(e) => setReferralRate(e.target.value)} /></label>
  <label>سعر المقعد العام <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
  <label>الحد الأدنى للمقاعد <input type="number" value={minSeats} onChange={(e) => setMinSeats(e.target.value)} /></label>
</fieldset>

<fieldset>
  <legend>جلسة التهيئة</legend>
  <p className="hint">ومن تاريخها تبدأ مهلته: سبعة أيام. واتركه فارغا إن لم
    يعرف بعد — فيرسل العرض بلا مهلة، ويكتب التاريخ لاحقا فيصله خبره وتبدأ.</p>
  <label>تاريخها ووقتها <input type="datetime-local" value={orientationAt} onChange={(e) => setOrientationAt(e.target.value)} /></label>
  <label>رابط الحضور <input type="url" value={orientationLinkUrl} onChange={(e) => setOrientationLinkUrl(e.target.value)} /></label>
</fieldset>
```

- [ ] **Step 6: اقبلها في `composeContract`**

وسّع `ContractComposeInput`، واكتب الأعمدةَ في `tx.trainerContract.create`:

```ts
          orientationAt: orientationAt,
          orientationLinkUrl: input.orientationLinkUrl?.trim() || null,
          conditionDeadlineAt: pre.isConditionalOffer ? conditionDeadlineFrom(orientationAt) : null,
```

وقبل إنشاء الصفّ، داخل المعاملة نفسِها، إن حضرت الأتعابُ في المُدخَل:

```ts
      /* في المعاملة نفسِها: فإن ردَّ التركيبُ بعدها لم تبقَ قاعدةُ أتعابٍ
         جديدةٌ على مدرّبٍ بلا عقد. */
      if (input.compensation) {
        await new EarningsService(tx as unknown as PrismaClient).setRule(pre.profileId, actorId, input.compensation)
      }
```

- [ ] **Step 7: شغّل المسارَ السريع**

Run: `npx vitest run src/tests`
Expected: PASS.

- [ ] **Step 8: التزم**

```bash
git add src/application/trainer/condition-window.ts src/pages/admin/TrainerContracts.tsx server/services/trainer-review.service.ts src/tests/trainer/contract-composer.test.ts
git commit -m "شاشةُ التركيب: الأتعابُ وتاريخُ الجلسة في مكانهما

تُضبَط قاعدةُ الأتعاب في شاشة التركيب نفسِها ثمّ يُركَّب العقد — بدل
الانتقال إلى شاشةٍ أخرى. والكتابةُ بمسلك setRule نفسِه لا بنسخةٍ عنه،
وفي معاملة التركيب: فإن ردَّ التركيبُ لم تبقَ قاعدةٌ جديدةٌ على مدرّبٍ
بلا عقد.

وحسابُ المهلة خرج إلى وحدةٍ خالصة condition-window.ts — فهو منطقٌ يُختبَر
في المسار السريع، ولا يُدفَن في خدمةٍ بألفَي سطرٍ تحتاج قاعدةً لتُشغَّل.

ومن تُرك تاريخُ جلسته فارغا أُرسل إليه بلا مهلة."
```

---

### Task 8: النهاياتُ الثلاث في صفحة التوقيع

**Files:**
- Modify: `prisma/schema.prisma` — تعليقُ `status` على `TrainerContract`
- Create: `prisma/migrations/20260923140000_contract_amendment_requested/migration.sql`
- Modify: `src/pages/ContractSign.tsx`
- Modify: `server/services/trainer-review.service.ts`
- Test: `src/tests/trainer/contract-endings.test.ts`

**Interfaces:**
- Consumes: مسلكا التوقيع والاعتذار القائمان.
- Produces: حالةٌ جديدةٌ `amendment_requested` و عمودان
  `amendmentRequestAr String?` و`amendmentRequestedAt DateTime?`،
  ودالّةٌ خالصةٌ `canSign(status): boolean` في `condition-window.ts`.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`src/tests/trainer/contract-endings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canSign, CONTRACT_SIGNABLE_STATUSES } from '@/application/trainer/condition-window'

describe('النهاياتُ الثلاث', () => {
  it('١) يُوقَّع المُرسَلُ وحدَه', () => {
    expect(canSign('sent')).toBe(true)
  })

  it('٢) وطلبُ التعديل يوقف التوقيع — وهو لبُّ النهاية الثانية', () => {
    expect(canSign('amendment_requested'), 'لو جاز التوقيعُ بعد طلب التعديل لَما أوقفه شيء').toBe(false)
  })

  it('٣) ولا يُوقَّع موقَّعٌ ولا ملغًى ولا معتذَرٌ عنه', () => {
    for (const s of ['signed', 'countersigned', 'declined', 'revoked', 'expired', 'terminated', 'draft']) {
      expect(canSign(s), `حالة ${s} تقبل توقيعا وهي لا تقبله`).toBe(false)
    }
  })

  it('٤) والقائمةُ مصدرُ الحقيقة — لا شرطٌ مكرّرٌ في مكانين', () => {
    expect([...CONTRACT_SIGNABLE_STATUSES]).toEqual(['sent'])
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run src/tests/trainer/contract-endings.test.ts`
Expected: FAIL — لا `canSign` مُصدَّرة.

- [ ] **Step 3: اكتب الدالّةَ الخالصة**

أضف إلى `src/application/trainer/condition-window.ts`:

```ts
/** الحالاتُ التي يُقبل فيها توقيع — واحدةٌ لا غير، والقائمةُ مصدرُ الحقيقة
    فلا يُكرَّر الشرطُ في الخادم والشاشة فيفترقان يوما. */
export const CONTRACT_SIGNABLE_STATUSES = ['sent'] as const

export function canSign(status: string): boolean {
  return (CONTRACT_SIGNABLE_STATUSES as readonly string[]).includes(status)
}
```

- [ ] **Step 4: أضف الحالةَ والعمودين**

في `prisma/schema.prisma` بدّل تعليقَ `status` ليذكر الحالةَ الجديدة، وأضف
بعد `declineReasonAr`:

```prisma
  /// ═══ النهايةُ الثالثة: يطلب تعديلا ولا يوقّع ولا يعتذر ═══
  ///
  /// وكانت النهايتان اثنتين — يوقّع أو يعتذر — فمن أراد تغييرَ بندٍ واحدٍ
  /// لم يجد إلّا الاعتذارَ أو التوقيعَ على ما لا يرضاه. والعقدُ عرضٌ يُفاوَض.
  ///
  /// ويقف التوقيعُ ما دامت الحالةُ كذلك: `canSign` تقبل `sent` وحدَها.
  amendmentRequestAr   String?
  amendmentRequestedAt DateTime?
```

`prisma/migrations/20260923140000_contract_amendment_requested/migration.sql`:

```sql
ALTER TABLE "TrainerContract"
  ADD COLUMN "amendmentRequestAr"   TEXT,
  ADD COLUMN "amendmentRequestedAt" TIMESTAMP(3);
```

- [ ] **Step 5: صِلها بالشاشة والخادم**

في `ContractSign.tsx` أضف زرّا ثالثا يفتح حقلَ نصٍّ ويرسل إلى مسلكٍ جديد
`requestAmendment(token, textAr)`. وفي الخدمة:

```ts
  async requestAmendment(token: string, textAr: string) {
    const body = textAr.trim()
    if (!body) throw new AuthError('no_text', 'اكتب ما تريد تعديله', 422)
    const c = await this.contractByToken(token)
    if (!canSign(c.status)) throw new AuthError('not_signable', 'هذا العرض لم يعد قابلا للرد عليه', 409)
    return this.prisma.trainerContract.update({
      where: { id: c.id },
      data: { status: 'amendment_requested', amendmentRequestAr: body.slice(0, 4000), amendmentRequestedAt: new Date() },
    })
  }
```

واستبدل شرطَ التوقيع القائمَ في مسلك التوقيع بـ`canSign(c.status)`.

- [ ] **Step 6: شغّل الحارسَ وحارسَ الحالات**

Run: `npx vitest run src/tests/trainer/contract-endings.test.ts && npm run ci:migrations`
Expected: PASS. وإن كانت قيودُ الحالات مولَّدةً بـ`scripts/status-checks.ts`
فشغّله ليُعاد توليدُها — **ولا تُكتب باليد**.

- [ ] **Step 7: انقض الحارسَ لتراه يسقط**

أضف `'amendment_requested'` إلى `CONTRACT_SIGNABLE_STATUSES` وشغّل: تسقط
الحالتان ٢ و٤. أعِده.

- [ ] **Step 8: التزم**

```bash
git add prisma src/application/trainer/condition-window.ts src/pages/ContractSign.tsx server/services/trainer-review.service.ts src/tests/trainer/contract-endings.test.ts
git commit -m "نهايةٌ ثالثةٌ لصفحة التوقيع: أطلب تعديلا

كانت النهايتان اثنتين — يوقّع أو يعتذر — فمن أراد تغييرَ بندٍ واحدٍ لم يجد
إلّا الاعتذارَ أو التوقيعَ على ما لا يرضاه. والعقدُ عرضٌ يُفاوَض.

ويقف التوقيعُ ما دامت الحالةُ كذلك، وقائمةُ الحالات القابلةِ للتوقيع مصدرُ
الحقيقة — فلا يُكرَّر الشرطُ في الخادم والشاشة فيفترقان يوما.

وسقط الحارسُ حين أُضيفت amendment_requested إلى القائمة."
```

---

### Task 9: ترحيلُ العقود القائمة — وأرضيّةٌ تحته

**Files:**
- Create: `scripts/migrate-contract-bodies.ts`
- Test: `src/tests/trainer/contract-migration-floor.test.ts`

**Interfaces:**
- Consumes: `renderContractBodyAr` و`CONTRACT_BODY_VERSION` من المهمّة ٣.
- Produces: سكربتٌ يُشغَّل مرّةً بيد إنسان، ودالّةٌ خالصةٌ
  `isUntouchableContract(c): boolean` تحرسه.

- [ ] **Step 1: اكتب الحارسَ الساقط**

`src/tests/trainer/contract-migration-floor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isUntouchableContract } from '@/application/trainer/contract-migration-floor'

describe('أرضيّةُ الترحيل: لا يُمَسُّ عقدٌ عليه توقيع', () => {
  const draft = { status: 'draft', signedAt: null, countersignedAt: null }

  it('١) المسودّةُ والمُرسَلُ يُعادُ تركيبُهما', () => {
    expect(isUntouchableContract(draft)).toBe(false)
    expect(isUntouchableContract({ ...draft, status: 'sent' })).toBe(false)
  })

  it('٢) وأيُّ توقيعٍ يمنع — ولو كانت الحالةُ تقول غيرَ ذلك', () => {
    expect(isUntouchableContract({ ...draft, signedAt: new Date() }), 'صفٌّ عليه توقيعٌ وحالتُه draft: التاريخُ يغلب الحالة').toBe(true)
    expect(isUntouchableContract({ ...draft, countersignedAt: new Date() })).toBe(true)
  })

  it('٣) وأيُّ حالةٍ موقَّعةٍ تمنع — ولو كان العمودُ فارغا', () => {
    for (const status of ['signed', 'countersigned', 'terminated', 'superseded']) {
      expect(isUntouchableContract({ ...draft, status }), `حالة ${status} تُمَسّ وهي لا تُمَسّ`).toBe(true)
    }
  })

  it('٤) والشرطان يعملان معا لا أحدُهما — فالمعلومةُ قد تنقص من أيّهما', () => {
    expect(isUntouchableContract({ status: 'signed', signedAt: null, countersignedAt: null })).toBe(true)
    expect(isUntouchableContract({ status: 'draft', signedAt: new Date(), countersignedAt: null })).toBe(true)
  })
})
```

- [ ] **Step 2: شغّله وتأكّد أنّه يسقط**

Run: `npx vitest run src/tests/trainer/contract-migration-floor.test.ts`
Expected: FAIL — لا وحدةَ بهذا الاسم.

- [ ] **Step 3: اكتب الأرضيّة**

`src/application/trainer/contract-migration-floor.ts`:

```ts
/* أرضيّةُ الترحيل — الشرطُ الذي لا يُتجاوَز.

   قيل إنّه «لم يوقّع أحدٌ بعد»، وعلى ذلك تُعاد صياغةُ العقود كلِّها. ولو
   كانت تلك المعلومةُ ناقصةً لَأُتلفت قرينةُ توقيعٍ لا تُستعاد: `bodyAr` هو
   ما رآه ووقّع عليه، و`bodyHash` هو ما يُقابَل به. فإعادةُ تركيبهما على صفٍّ
   موقَّعٍ تمحو الدليلَ وتبقي التوقيع.

   فالسكربتُ يفحص قبل أن يكتب، ويقف عند أوّل صفٍّ موقَّعٍ ويبلّغ. */

export interface ContractSignatureFacts {
  status: string
  signedAt: Date | null
  countersignedAt: Date | null
}

/** الحالاتُ التي تعني أنّ توقيعا وقع، ولو كان العمودُ فارغا لعطبٍ قديم */
const SIGNED_STATUSES = ['signed', 'countersigned', 'terminated', 'superseded'] as const

/** والشرطان يعملان معا لا أحدُهما: المعلومةُ قد تنقص من أيّهما، فالمنعُ
    يقع بأيّهما دلّ. */
export function isUntouchableContract(c: ContractSignatureFacts): boolean {
  if (c.signedAt !== null || c.countersignedAt !== null) return true
  return (SIGNED_STATUSES as readonly string[]).includes(c.status)
}
```

- [ ] **Step 4: شغّل وتأكّد أنّه يمرّ**

Run: `npx vitest run src/tests/trainer/contract-migration-floor.test.ts`
Expected: PASS — أربعُ حالات.

- [ ] **Step 5: اكتب السكربت**

`scripts/migrate-contract-bodies.ts`:

```ts
/* يُعاد تركيبُ متونِ العقود غيرِ الموقَّعة على الإصدار v4.

   ويُشغَّل بيد إنسان مرّةً: `npx tsx scripts/migrate-contract-bodies.ts`
   ثمّ `--write` بعد قراءة التقرير. فالجولةُ الأولى تقرأ ولا تكتب. */
import { PrismaClient } from '@prisma/client'
import { CONTRACT_BODY_VERSION } from '../src/application/trainer/contract-body'
import { isUntouchableContract } from '../src/application/trainer/contract-migration-floor'
import { createHash } from 'node:crypto'
import { TrainerReviewService } from '../server/services/trainer-review.service'

/* و`sha256` ثابتٌ محلّيٌّ في الخدمة (السطر ٧٤) غيرُ مُصدَّر — فيُعاد تعريفُه
   هنا بالسطر نفسِه. وهو سطرٌ واحدٌ لا منطقَ فيه يفترق. */
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

const WRITE = process.argv.includes('--write')

async function main() {
  const prisma = new PrismaClient()
  const all = await prisma.trainerContract.findMany()

  const blocked = all.filter(isUntouchableContract)
  const todo = all.filter((c) => !isUntouchableContract(c))

  console.log(`عقودٌ كلُّها: ${all.length} · تُعاد صياغتُها: ${todo.length} · موقَّعةٌ لا تُمَسّ: ${blocked.length}`)

  /* ═══ ويقف عند أوّل موقَّع ═══
     قيل «لم يوقّع أحدٌ بعد». فإن ظهر موقَّعٌ فالمعلومةُ ناقصة، ولا يُكمَل
     على معلومةٍ ثبت نقصُها. */
  if (blocked.length > 0) {
    console.error('وقف: ظهر عقدٌ عليه توقيع، والمفترَضُ ألّا يكون. لا شيءَ كُتب.')
    for (const c of blocked) console.error(`  · ${c.id} — ${c.status} — ${c.signedAt?.toISOString() ?? 'بلا تاريخ'}`)
    process.exitCode = 1
    return prisma.$disconnect()
  }

  if (!WRITE) {
    console.log('جولةُ قراءةٍ فقط. أعد التشغيل بـ--write بعد قراءة ما سبق.')
    return prisma.$disconnect()
  }

  /* ويُعاد التركيبُ بالمُدخَل نفسِه الذي يبنيه `contractBodyInput` — لا
     بنسخةٍ عنه هنا، فنسختان لمتنٍ واحدٍ تفترقان يوما. فتُستدعى الخدمةُ
     نفسُها، ويُكتب ما تعيده. */
  const service = new TrainerReviewService(prisma)
  let written = 0
  for (const c of todo) {
    const app = await prisma.trainerApplication.findFirst({ where: { profile: { id: c.profileId } } })
    if (!app) {
      console.error(`  · ${c.id} — لا طلبَ لملفّه، يُترَك ولا يُخمَّن`)
      continue
    }
    const bodyAr = await service.renderBodyForContract(app.id, c)
    await prisma.trainerContract.update({
      where: { id: c.id },
      data: { bodyAr, bodyHash: sha256(bodyAr), bodyVersion: CONTRACT_BODY_VERSION },
    })
    written += 1
  }
  console.log(`كُتب: ${written} من ${todo.length}`)
  return prisma.$disconnect()
}

void main()
```

- [ ] **Step 6: شغّل الجولةَ القارئة**

Run: `npx tsx scripts/migrate-contract-bodies.ts`
Expected: تقريرٌ بالأعداد، وبلا كتابة. **ولا تُشغَّل `--write` إلّا بعد قراءة
التقرير** — فإن قال إنّ ثَمَّ موقَّعا، فالمعلومةُ التي بُني عليها القرارُ
ناقصة، ويُسأل صاحبُ المنصّة قبل أيّ كتابة.

- [ ] **Step 7: التزم**

```bash
git add scripts/migrate-contract-bodies.ts src/application/trainer/contract-migration-floor.ts src/tests/trainer/contract-migration-floor.test.ts
git commit -m "ترحيلُ متون العقود إلى v4 — وأرضيّةٌ تحته تقف عند أوّل موقَّع

قيل إنّه لم يوقّع أحدٌ بعد، وعلى ذلك تُعاد صياغةُ العقود كلِّها. ولو كانت
تلك المعلومةُ ناقصةً لَأُتلفت قرينةُ توقيعٍ لا تُستعاد: bodyAr هو ما رآه
ووقّع عليه، وbodyHash ما يُقابَل به.

فالسكربتُ يفحص قبل أن يكتب ويقف عند أوّل صفٍّ موقَّع، وجولتُه الأولى تقرأ
ولا تكتب. وشرطا المنع يعملان معا — الحالةُ والتاريخ — فالمعلومةُ قد تنقص
من أيّهما."
```

---

## البوّابةُ الأخيرة

- [ ] `npm run verify` أخضرَ كاملا
- [ ] ثمّ الدمجُ إلى `main` بخضرة CI — وهي الإذن، لا خضرةُ الجهاز

## ما لا تفعله هذه الخطّة

**وبندان من المواصفة ليسا فيها، وهما مؤجَّلان لا منسيّان:**

· **§٨-١ المتنُ المهيكَل** (Markdown والهاشُ فوقه) · **و§٨-٢ الشكل**
  (الأقسامُ الملوّنةُ والجداولُ الحقيقيّةُ و«الخلاصة في سطور»).

وأُخّرا بقصد: هذه الخطّةُ تغيّر **ما يقوله المستند**، وتلك تغيّر **كيف
يُعرَض**. والفصلُ يشتري شيئا: متنُ `v4` يُركَّب ويُوقَّع عليه اليومَ بالشكل
القائم، فإذا جاءت خطّةُ الشكل لم تكن تغيّر معنى ولا رقما — تغيّر عرضا،
ومراجعتُها بالعين لا بالحجّة. ولو ضُمّا لَصار تغييرُ نصٍّ ملزِمٍ وتغييرُ
تنسيقٍ في مراجعةٍ واحدةٍ لا يُفرَّق فيها بين خطإٍ في بندٍ وخطإٍ في لون.

وقد أُثبت أنّ المتنَ القائمَ يُحلَّل بلا خسارة (٢٠ بندا · ١١٠ فقرةً · ٤
ملاحق)، فالتهيكلُ مُدرَك الكلفة ولا مفاجأةَ فيه.

**ولا يُبنى فيها شيءٌ من الطور نفسِه**، فذاك خطّةٌ ثانية: لا تُوسَّع بوّابةٌ، ولا
يُعاد وسمُ `onboarding`، ولا يُغيَّر زرُّ التفعيل، ولا يُكتب عاملٌ ولا تذكير،
ولا يُرسَل بريدٌ جديد، ولا يُصدَر ملحقُ اعتماد. **والأعمدةُ تُكتب ولا تُقرأ**
حتّى تأتي الثانية — وهو مقصود: هذه تُدمج وحدَها فلا يتغيّر سلوكٌ لأحد.
