# مقارنة منظومتي التشخيص V1 ↔ V2 — بالأرقام

> وُلّدت آليًا بـ `npx tsx scripts/report-v2-docs.ts` على نفس 75 شخصية حتمية (الصيغة الأساسية لكل شخصية).
> V1 = محرك الدرجات القائم. V2 = نظام القرار (شخصية ← هدف ← مجال ← أدلة ← مهارات ← مسارات أهلية).

## المقاييس الكلية

| المقياس | V1 | V2 |
|---|---|---|
| متوسط الأسئلة لكل جلسة | 12.77 | 9.92 |
| أسئلة غير مناسبة للمرحلة (طالب مدرسة يُسأل عن عمل/قيادة) | 0 | 0 |
| مهارات غير مقيسة عوملت كفجوات (قاعدة 2.5) | 1290 | 0 |
| مسارات متميزة ظهرت في المرتبة الأولى | 9 | 9 |
| إحالات مستشار (صادقة عند غياب تغطية) | 0 | 18 |
| توصيات بثقة «قوية» | 44 | 0 |

## تفصيل مهم

- **أسئلة العمل لطلبة المدرسة في V1:** 0 سؤالًا غير مناسبًا عبر 5 شخصيات مدرسية — في V2 = 0 (استبعاد صارم + فلترة خيارات الهدف).
- **قاعدة «المجهول = 2.5»:** في V1 كانت كل مهارة غير مقيسة تُحسب فجوة بمستوى 2.5 افتراضيًا (1290 فجوة افتراضية في هذه العينة)؛ في V2 المهارة غير المقيسة «مجهولة» صراحة: لا فجوة ولا تفسير، وتظهر في خانة «ما لم نعرفه».
- **الثقة في V2 صادقة:** لا «تطابق قوي» يُمنح إلا بتغطية مهارات مقيسة ≥ 50٪ وفارق مريح ولا تناقض — لذلك يفضّل V2 مخرجات «أفضل تطابق حالي» و«اتجاه استكشافي» على التضخيم.

## جدول كل شخصية

| الشخصية | أسئلة V1 | مسار V1 | ثقة V1 | أسئلة V2 | مسار V2 | مخرج V2 |
|---|---|---|---|---|---|---|
| طالب مدرسة — هدف career_direction | 10 | PW-STU-003 | strong | 8 | PW-STU-003 | best_current_match |
| طالب مدرسة — هدف personal_growth | 10 | PW-FND-003 | strong | 10 | PW-FND-003 | best_current_match |
| طالب مدرسة — هدف explore | 10 | PW-STU-003 | strong | 8 | PW-STU-003 | best_current_match |
| طالب مدرسة — هدف business_launch | 14 | PW-MKT-001 | good | 14 | advisor_referral | best_current_match |
| طالب مدرسة — هدف career_direction | 10 | PW-STU-003 | strong | 8 | PW-STU-003 | best_current_match |
| طالب جامعة — هدف employment_advancement | 10 | PW-STU-002 | strong | 10 | PW-STU-002 | best_current_match |
| طالب جامعة — هدف business_launch | 14 | PW-MKT-001 | good | 14 | advisor_referral | exploratory_direction |
| طالب جامعة — هدف career_direction | 14 | PW-STU-003 | strong | 9 | PW-STU-003 | best_current_match |
| طالب جامعة — هدف lead_team | 14 | PW-EMP-005 | good | 12 | PW-STU-003 | exploratory_direction |
| طالب جامعة — هدف explore | 10 | PW-STU-003 | strong | 8 | PW-STU-003 | best_current_match |
| خريج — هدف employment_advancement | 10 | PW-STU-002 | strong | 10 | PW-STU-002 | best_current_match |
| خريج — هدف employment_advancement | 14 | PW-COM-001 | good | 12 | PW-STU-003 | exploratory_direction |
| خريج — هدف career_direction | 10 | PW-STU-003 | strong | 8 | PW-STU-003 | best_current_match |
| خريج — هدف business_launch | 14 | PW-MKT-001 | good | 9 | PW-BIZ-001 | best_current_match |
| خريج — هدف personal_growth | 10 | PW-FND-003 | strong | 10 | PW-FND-003 | best_current_match |
| موظف مبتدئ — employment_advancement | 14 | PW-COM-001 | good | 9 | advisor_referral | best_current_match |
| موظف مبتدئ — personal_growth | 10 | PW-FND-003 | strong | 12 | PW-FND-003 | best_current_match |
| موظف مبتدئ — lead_team | 14 | PW-NEG-001 | strong | 12 | PW-HR-001 | exploratory_direction |
| موظف مبتدئ — career_direction | 14 | PW-STU-003 | strong | 9 | advisor_referral | best_current_match |
| موظف مبتدئ — employment_advancement | 14 | PW-COM-001 | good | 10 | advisor_referral | best_current_match |
| موظف خبرة — employment_advancement | 14 | PW-COM-001 | good | 10 | advisor_referral | best_current_match |
| موظف خبرة — lead_team | 14 | PW-NEG-001 | strong | 12 | PW-HR-001 | exploratory_direction |
| موظف خبرة — business_launch | 14 | PW-MKT-001 | strong | 14 | advisor_referral | best_current_match |
| موظف خبرة — personal_growth | 10 | PW-FND-003 | strong | 12 | PW-FND-003 | best_current_match |
| موظف خبرة — career_direction | 14 | PW-STU-003 | strong | 12 | advisor_referral | exploratory_direction |
| مدير جديد — lead_team | 14 | PW-EMP-005 | strong | 12 | PW-EMP-005 | best_current_match |
| مدير جديد — employment_advancement | 14 | PW-EMP-005 | strong | 10 | advisor_referral | best_current_match |
| مدير جديد — lead_team | 14 | PW-NEG-001 | good | 12 | PW-EMP-005 | exploratory_direction |
| مدير جديد — personal_growth | 10 | PW-FND-003 | strong | 11 | PW-FND-003 | best_current_match |
| مدير جديد — lead_team | 14 | PW-NEG-001 | good | 12 | PW-EMP-005 | exploratory_direction |
| موظف حكومي — employment_advancement | 14 | PW-COM-001 | good | 9 | PW-GOV-002 | best_current_match |
| موظف حكومي — lead_team | 14 | PW-NEG-001 | strong | 12 | PW-HR-001 | best_current_match |
| موظف حكومي — personal_growth | 10 | PW-FND-003 | strong | 12 | PW-FND-003 | best_current_match |
| موظف حكومي — employment_advancement | 14 | PW-EMP-005 | strong | 10 | advisor_referral | best_current_match |
| موظف حكومي — career_direction | 14 | PW-STU-003 | strong | 10 | advisor_referral | exploratory_direction |
| رائد فكرة — idea | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| رائد فكرة — validation | 14 | PW-FIN-001 | good | 13 | PW-FIN-001 | best_current_match |
| رائد فكرة — pre_revenue | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| رائد فكرة — validation | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| رائد فكرة — idea | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| مشروع قائم — early_revenue | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| مشروع قائم — growing | 14 | PW-FIN-001 | good | 13 | PW-FIN-001 | exploratory_direction |
| مشروع قائم — established | 14 | PW-FIN-001 | good | 13 | PW-FIN-001 | best_current_match |
| مشروع قائم — early_revenue | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| مشروع قائم — growing | 14 | PW-FIN-001 | good | 13 | PW-FIN-001 | exploratory_direction |
| مستقل — business_launch | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| مستقل — personal_growth | 14 | PW-FND-003 | strong | 9 | PW-FND-003 | best_current_match |
| مستقل — business_launch | 14 | PW-BIZ-001 | good | 8 | PW-BIZ-001 | best_current_match |
| مستقل — career_direction | 14 | PW-STU-003 | strong | 8 | advisor_referral | best_current_match |
| مستقل — personal_growth | 10 | PW-FND-003 | strong | 9 | PW-FND-003 | best_current_match |
| رائد/مستقل — lead_team | 14 | PW-COM-001 | good | 12 | PW-HR-001 | best_current_match |
| رائد/مستقل — employment_advancement | 14 | PW-COM-001 | good | 9 | PW-FND-003 | best_current_match |
| رائد/مستقل — personal_growth | 10 | PW-FND-003 | strong | 10 | PW-FND-003 | best_current_match |
| رائد/مستقل — business_launch | 14 | PW-FIN-001 | good | 13 | PW-FIN-001 | best_current_match |
| رائد/مستقل — explore | 14 | PW-STU-003 | strong | 10 | advisor_referral | exploratory_direction |
| ولي أمر — 0 | 14 | PW-FND-003 | good | 8 | advisor_referral | best_current_match |
| ولي أمر — 1 | 14 | PW-FND-003 | good | 10 | advisor_referral | best_current_match |
| ولي أمر — 2 | 14 | PW-FND-003 | good | 10 | advisor_referral | exploratory_direction |
| ولي أمر — 3 | 14 | PW-FND-003 | good | 8 | advisor_referral | best_current_match |
| ولي أمر — 4 | 14 | PW-FND-003 | good | 10 | advisor_referral | best_current_match |
| غير متأكد — 0 | 14 | PW-STU-003 | strong | 10 | PW-STU-003 | best_current_match |
| غير متأكد — 1 | 14 | PW-STU-003 | strong | 10 | PW-STU-003 | best_current_match |
| غير متأكد — 2 | 14 | PW-STU-003 | strong | 10 | PW-STU-003 | best_current_match |
| غير متأكد — 3 | 14 | PW-STU-003 | strong | 10 | PW-STU-003 | best_current_match |
| غير متأكد — 4 | 14 | PW-STU-003 | strong | 10 | PW-STU-003 | best_current_match |
| جهة خاصة — 0 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة خاصة — 1 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة خاصة — 2 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة خاصة — 3 | 14 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة خاصة — 4 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة حكومية — 0 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة حكومية — 1 | 14 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة حكومية — 2 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة حكومية — 3 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |
| جهة حكومية — 4 | 10 | PW-FND-003 | strong | 8 | PW-FND-003 | best_current_match |

## الخلاصة

V2 ليس «أسئلة أقل» فقط — بل قرارات قابلة للتدقيق: لا سؤال خارج مرحلة المتعلم، لا مهارة مفترضة، لا مسار خارج الأهلية، ولا ثقة مختلقة. ما يظهر كـ«تحفظ» في أرقام V2 (ثقة أقل إفراطًا، إحالات مستشار أكثر) هو في الحقيقة صدق منهجي: المنظومة تعترف بما لا تعرفه.
