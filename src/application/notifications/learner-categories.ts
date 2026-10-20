/* ═══ ما يصل المتعلّمَ من أصناف الإشعار — لا ما يصل المدرّبَ والفريق (١٩ أكتوبر ٢٠٢٦) ═══

   كانت «إشعاراتي» في بوّابة المتعلّم تعرض الأصنافَ كلَّها: «عملي في الأكاديمية» (مهمّةٌ كُلِّفت بها، طلبُ
   انضمام مدرّب) و«تجهيز شعبتي» (إرسالُ خطّة الشعبة للاعتماد) — وهي لا تصل متعلّما أبدا. فيقرأ قائمةً
   نصفُها عن غيره.

   والصنفُ يُعرض للمتعلّم إن كان فيه مفتاحٌ له بابٌ في بوّابته (`destinationFor(…, 'learner')`) —
   المصدرُ نفسُه الذي يفتح منه بندُ الجرس، لا قائمةٌ ثانيةٌ تُكتب بيد. و«حسابي ووصولي» يصل كلَّ صاحب
   حساب، ولا بابَ لخبره عمدا (`mail-shape.test.ts`)، فيُعرض كذلك. والمخفيُّ كلُّه مقفلٌ لا يُكتم —
   فلا يُسلب أحدٌ مفتاحا بإخفائه. */
import { NOTIFICATION_CATEGORIES } from './categories'
import { destinationFor } from './destinations'

/** صنفٌ يصل كلَّ صاحب حسابٍ أيّا كانت بوّابتُه */
const EVERY_ACCOUNT = new Set(['account'])

export const LEARNER_CATEGORY_KEYS: ReadonlySet<string> = new Set(
  NOTIFICATION_CATEGORIES
    .filter((c) => EVERY_ACCOUNT.has(c.key) || c.templateKeys.some((k) => destinationFor(k, 'learner')))
    .map((c) => c.key),
)

/* ═══ وما يقع في الصنف بلغة المتعلّم (٢٠ أكتوبر ٢٠٢٦) ═══

   الوصفُ واحدٌ للحسابات كلِّها، فكان المتعلّمُ يقرأ في «المال» من إعداداته «مستحقّات مدرّب · كشف عمولة
   مستشار» — خبران لا يصلانه أبدا. فللصنف وصفٌ للمتعلّم إن كان في وصفه العامّ ما ليس له. */
const LEARNER_WHAT_AR: ReadonlyMap<string, string> = new Map(
  NOTIFICATION_CATEGORIES.flatMap((c) => (c.learnerWhatAr ? [[c.key, c.learnerWhatAr] as const] : [])),
)

/** وصفُ الصنف كما يقرؤه المتعلّم */
export function learnerWhatAr(key: string, whatAr: string): string {
  return LEARNER_WHAT_AR.get(key) ?? whatAr
}
