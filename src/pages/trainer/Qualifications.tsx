/* «أيُّ الدورات أنا مؤهَّلٌ لها؟» — سؤالٌ للمدرّب لم تكن له شاشة (المهمّة ٧١).

   وأغربُ ما فيه: **الخادمُ يجيبه منذ زمن.** `/api/trainer/me/qualifications`
   و`/api/trainer/catalog-scope` موجودان ومحروسان بصلاحيّاتهما، ولم تكن
   تنادِيهما شاشةٌ واحدة — فالمدرّبُ يسأل الإدارةَ عمّا تعرفه المنصّةُ عنه.
   وهذه الشاشةُ تعرضهما لا أكثر.

   ═══ وذهبت الإتاحةُ كلُّها (٢٧ سبتمبر ٢٠٢٦) ═══

   كانت هنا ثلاثةُ أقسامٍ أخرى: «ساعاتي الأسبوعيّة» و«فصولي» و«فترات
   غيابي» — يُعلن فيها المدرّبُ وقتَه لمن يُسنِد إليه الجلسات. وقرارُ صاحب
   المنصّة: «احذف ساعاتي وفصولي وفترات غيابي.. لأنه هو من يتحكم بكل شي..
   واضح له أن اللقاءات بيده ويجب أن تكون ضمن فترة الشعبة نفسها التي وضعها
   بنفسه ابتداءً حتى النهاية».

   فالإعلانُ كان جوابا عن سؤالٍ لم يعد يُسأل: «متى أجدول له؟». المدرّبُ
   اليوم يجدول لقاءاتِه بيده داخلَ مدّةِ شعبته، فلا يحتاج أن يُخبر أحدا
   بوقته كي لا يُجدوَل فيه. وحُذفت معها مساراتُها وجداولُها الثلاثة
   وفحوصُها في الإسناد — لا شاشتُها وحدَها. */

import { useCallback, useEffect, useState } from "react";
import { Award, Loader2, Lock, ServerOff } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/services/api";

import { Card } from "@/components/ui/Surface";
import { fmtDateLong } from "@/application/text/format-ar";
interface Qualification { courseId: string; title: string; currentVersion: number; qualifiedAt: string }
interface ScopeGate { allowed: boolean; basis: "earned" | "granted" | "none"; reasonAr: string }

const fmtDate = fmtDateLong;

export default function TrainerQualifications() {
  const [quals, setQuals] = useState<Qualification[] | null>(null);
  const [scope, setScope] = useState<ScopeGate | null>(null);
  const [down, setDown] = useState(false);

  /* والكتابةُ في ردّ النداء لا في جسم الأثر (`react-hooks/set-state-in-effect`):
     ما يصل من الخادم يُكتب حين يصل. */
  const load = useCallback(() =>
    Promise.all([
      apiGet<Qualification[]>("/api/trainer/me/qualifications"),
      apiGet<ScopeGate>("/api/trainer/catalog-scope"),
    ])
      .then(([q, s]) => { setQuals(q); setScope(s); setDown(false); })
      .catch(() => setDown(true)), []);

  useEffect(() => { void load(); }, [load]);

  if (down) {
    return (
      <TrainerLayout title="مؤهّلاتي">
        <EmptyState
          icon={ServerOff}
          titleAr="تعذّر الوصول إلى الخادم"
          reasonAr="لم يُجب الخادمُ على طلب مؤهّلاتك. تحقّق من اتصالك ثمّ أعد التحميل."
          actions={[{ labelAr: "أعد المحاولة", onClick: () => void load() }]}
        />
      </TrainerLayout>
    );
  }

  if (!quals) {
    return (
      <TrainerLayout title="مؤهّلاتي">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title="مؤهّلاتي">
      <div className="space-y-8">
        {/* ── ما أنا مؤهَّلٌ له ── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Award className="h-5 w-5 text-teal" aria-hidden="true" />
            الدورات التي أنا مؤهَّلٌ لها
            <span className="text-xs font-bold text-muted-foreground">({quals.length})</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            من طلبك مباشرةً: ما قلتَ إنّك تستطيع تدريسَه صرتَ مؤهَّلا له حين اعتُمدت. والتأهيلُ للدورة لا للشعبة — فمن أُهِّل لدورةٍ يجوز إسنادُه لأيّ شعبةٍ منها.
          </p>

          {quals.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={Award}
              titleAr="لا تأهيلَ بعد"
              reasonAr="تُؤهَّل تلقائيّا لكلّ دورةٍ ذكرتَ في طلبك أنّك تستطيع تدريسَها، وتضيف الإدارةُ فوقَها ما تراه. فإن كان طلبُك بلا دورةٍ من الكتالوج، فأخبرنا بما تُتقنه."
              actions={[{ to: "/trainer/board", labelAr: "شعبي", hintAr: "ما أُسند إليك فعلا" }]}
            />
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {quals.map((q) => (
                /* ═══ ولماذا سقط رمزُ الدورة من البطاقة ═══

                   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أسماءُ الدورات بدل
                   رموزها». وكانت البطاقةُ تحمل الاثنين — الاسمَ عنوانا
                   و`C-AUT-101` تحته بخطٍّ أحاديّ — فيقرأ المدرّبُ رمزا لا
                   يعنيه شيئا في شاشةٍ كلُّها له.

                   والرمزُ لم يُستبدل بل **حُذف**: الاسمُ كان فوقه أصلا، فلم
                   يكن الرمزُ يقول شيئا جديدا. وبقي ما يفيده: أيُّ نسخةٍ
                   أُهِّل لها، ومتى.

                   وحين لا اسمَ في الكتالوج لا يُطبع الرمزُ بديلا — يُقال إنّ
                   الاسمَ غائب. فرمزٌ في موضع الاسم هو العطبُ نفسُه من بابٍ
                   آخر. */
                <Card as="li" key={q.courseId}>
                  <p className="font-bold">{q.title || "دورةٌ بلا اسمٍ في الكتالوج"}</p>
                  <p className="mt-1 text-read leading-5 text-muted-foreground">
                    النسخة {q.currentVersion} · أُهِّلت {fmtDate(q.qualifiedAt)}
                  </p>
                </Card>
              ))}
            </ul>
          )}
        </section>

        {/* ── نطاقي في الكتالوج ── */}
        {scope && (
          <Card as="section">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              نطاقُ اقتراحاتي
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{scope.reasonAr}</p>
          </Card>
        )}
      </div>
    </TrainerLayout>
  );
}
