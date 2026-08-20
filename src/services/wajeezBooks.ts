/**
 * تكامل كتب وجيز — Wajeez Books Adapter
 * -------------------------------------------------------
 * الآن: بيانات تجريبية ثابتة (MockAdapter) مرتبطة بكل دورة.
 * عند الربط الفعلي بواجهة وجيز البرمجية:
 *   1) عيّن VITE_WAJEEZ_API_URL وVITE_WAJEEZ_API_KEY في البيئة (انظر .env.example).
 *   2) استبدل MockAdapter بـ HttpAdapter أدناه — الواجهة نفسها لا تتغير،
 *      فلا تتأثر أي صفحة تستهلك getBooksForCourse().
 *   3) حالة القراءة/الاختبار تُزامن لاحقا عبر POST /api/me/book-progress.
 */

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  minutes: number; // مدة الاستماع التقريبية
  quizQuestions: number; // عدد أسئلة اختبار الملخص
}

export interface WajeezBooksAdapter {
  getBooksForCourse(courseId: string): Promise<BookSummary[]>;
}

/* ── مكتبة تجريبية حسب مجال الدورة ── */
const POOL: Record<string, BookSummary[]> = {
  بيانات: [
    { id: "bk-data-1", title: "التفكير بالبيانات", author: "فريق وجيز", minutes: 18, quizQuestions: 5 },
    { id: "bk-data-2", title: "قصة الأرقام: كيف تقنع بالإحصاء", author: "فريق وجيز", minutes: 22, quizQuestions: 5 },
  ],
  قيادة: [
    { id: "bk-lead-1", title: "القائد الذي يصنع قادة", author: "فريق وجيز", minutes: 20, quizQuestions: 5 },
    { id: "bk-lead-2", title: "المحادثات الحاسمة", author: "فريق وجيز", minutes: 24, quizQuestions: 6 },
  ],
  تواصل: [
    { id: "bk-comm-1", title: "فن الإصغاء", author: "فريق وجيز", minutes: 15, quizQuestions: 4 },
    { id: "bk-comm-2", title: "العرض المقنع", author: "فريق وجيز", minutes: 19, quizQuestions: 5 },
  ],
  افتراضي: [
    { id: "bk-gen-1", title: "عادات المتعلمين السريعين", author: "فريق وجيز", minutes: 16, quizQuestions: 4 },
    { id: "bk-gen-2", title: "التركيز العميق", author: "فريق وجيز", minutes: 21, quizQuestions: 5 },
  ],
};

function poolFor(courseId: string): BookSummary[] {
  const id = courseId.toUpperCase();
  if (/DATA|AI|EXCEL|SQL/.test(id)) return POOL["بيانات"];
  if (/LEAD|MGMT/.test(id)) return POOL["قيادة"];
  if (/COMM|GOV|SERV/.test(id)) return POOL["تواصل"];
  return POOL["افتراضي"];
}

const MockAdapter: WajeezBooksAdapter = {
  async getBooksForCourse(courseId) {
    // محاكاة زمن شبكة بسيط ليبقى السلوك قريبا من الربط الحقيقي
    await new Promise((r) => setTimeout(r, 120));
    return poolFor(courseId);
  },
};

/* ── المحوّل الحقيقي — جاهز للتفعيل عند النقل إلى Replit ──
const HttpAdapter: WajeezBooksAdapter = {
  async getBooksForCourse(courseId) {
    const res = await fetch(`${import.meta.env.VITE_WAJEEZ_API_URL}/v1/courses/${courseId}/books`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_WAJEEZ_API_KEY}` },
    });
    if (!res.ok) throw new Error("wajeez books fetch failed");
    return res.json();
  },
};
*/

export const wajeezBooks: WajeezBooksAdapter = MockAdapter;

/* عناوين ملخصات موجودة فعليا في بيانات المنتج — تُستخدم كأمثلة تسويقية
   في صفحة المسار دون نسخ الأسماء يدويا في أكثر من موضع. */
export function exampleSummaryTitles(count = 3): string[] {
  const all = Object.values(POOL).flat();
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const b of all) {
    if (seen.has(b.title)) continue;
    seen.add(b.title);
    titles.push(b.title);
    if (titles.length >= count) break;
  }
  return titles;
}

/* ── اختبار الملخص الصوتي ──
   أسئلة قصيرة مشتقة من عنوان الملخص تتحقق من الاستماع والفهم،
   وتغذي درجة الملخص في ملف الطالب. عند الربط الفعلي تأتي الأسئلة
   من بنك أسئلة وجيز لكل كتاب. */
export interface BookQuizQuestion { q: string; options: string[]; correct: number; explain: string; }

export function bookQuiz(b: BookSummary): BookQuizQuestion[] {
  return [
    {
      q: `ما أول خطوة تطبيقية يدعو إليها ملخص «${b.title}»؟`,
      options: [
        "تطبيق فكرة واحدة صغيرة هذا الأسبوع وقياس أثرها",
        "قراءة الكتاب كاملا قبل أي تطبيق",
        "مشاركة الملخص مع الآخرين فقط",
        "انتظار الوقت المناسب للبدء",
      ],
      correct: 0,
      explain: "منهج وجيز: فكرة واحدة مطبقة اليوم خير من عشر أفكار مؤجلة.",
    },
    {
      q: `أي عبارة تلخص الرسالة المركزية لـ«${b.title}» بدقة؟`,
      options: [
        "النجاح يتطلب تغييرا جذريا وفوريا",
        "الالتزام الصغير المستمر يتفوق على الحماس المؤقت",
        "المعرفة وحدها كافية للتغيير",
        "الظروف هي العامل الحاسم دائما",
      ],
      correct: 1,
      explain: "الاستمرارية الصغيرة هي القاسم المشترك في أدبيات التطور المهني.",
    },
    {
      q: "كيف توظّف فكرة من هذا الملخص في مسارك الحالي بشكل صحيح؟",
      options: [
        "أحفظها لاختبار نهاية المسار",
        "أربطها بواجب الدورة الحالية وأوثق تجربتي",
        "أنتظر إشارة من المدرب",
        "أطبقها بعد التخرج فقط",
      ],
      correct: 1,
      explain: "ربط الفكرة بواجبك الحالي يحول الاستماع إلى دليل إتقان موثق.",
    },
  ];
}
