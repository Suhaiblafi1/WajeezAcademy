import { useEffect, useState } from "react";
import { Loader2, ServerOff } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet } from "@/services/api";
import BookAdminMeeting from "@/components/BookAdminMeeting";
import TrainerWorkQueue from "@/components/TrainerWorkQueue";
import AtRiskList from "@/components/AtRiskList";
import { buildWorkQueue, type TQOffer } from "@/application/trainer/work-queue";
import { findAtRisk } from "@/application/trainer/at-risk";
import { useRealSession } from "@/services/session";
import { countAr } from "@/application/text/count-ar";

import { Card } from "@/components/ui/Surface";
/* صيغةُ العدد لا تُرتجل في السطر: «و1 طالباً» نصبٌ في غير موضعه يقرؤه
   المدرّب في كلّ دخول. */
const COHORT_FORMS = { one: "شعبة", two: "شعبتان", few: "شعب", many: "شعبة" } as const;
const STUDENT_FORMS = { one: "طالب", two: "طالبان", few: "طلاب", many: "طالبا" } as const;

/* ── الصفحة الحقيقية للمدرب المسجّل — من الخادم مباشرة، بلا بيانات استعراض ── */

/* النوع يطابق ما يعيده /api/trainer/my-cohorts فعلا — كان ناقصا الحضور
   والتقدم والتقييمات وروابط الجلسة، وهي ما يبنى عليه ف-١ وف-٢. */
interface RealCohort {
  role: string;
  cohort: {
    id: string; title: string; status: string;
    course: { versions: { titleAr: string }[] };
    sessions: {
      id: string; title: string; startsAt: string; endsAt: string | null; status: string;
      /* موقفُ الإدارة ونصُّ ردّها — يصلان في الرد منذ اليوم الأوّل ولم يكونا
         مُعلَنَين هنا، فلم يكن للطابور سبيلٌ إلى «لقاءٌ رُدَّ عليك». */
      approvalState: string | null;
      reviewNote: string | null;
      zoom: { joinUrl: string; learnerUrl: string | null } | null;
      recordings: { id: string }[];
      /* لا حضور على الجلسة: الخادم يعيده داخل كل تسجيل */
    }[];
    enrollments: {
      id: string; status: string;
      user: { displayName: string; email: string };
      courseProgress: { percent: number } | null;
      attendance: { sessionId: string; status: string }[];
    }[];
    assessments: {
      id: string; title: string; type: string; dueAt: string | null; status: string;
      submissions: { enrollmentId: string; status: string }[];
    }[];
  };
}
interface RealQueueItem { id: string; status: string }

/** موجزُ الشعبة كما يعطيه `/api/trainer/cohorts/summary` — الدالّةُ نفسُها التي تحسب قائمةَ صفحة الشعبة */
interface CohortSummary {
  id: string; title: string; courseTitle: string; planStatus: string; done: number; total: number;
  next: { key: string; labelAr: string } | null;
}

function RealTrainerHome({ name, email }: { name: string; email: string }) {
  const [cohorts, setCohorts] = useState<RealCohort[] | null>(null);
  const [queue, setQueue] = useState<RealQueueItem[] | null>(null);
  const [summary, setSummary] = useState<CohortSummary[]>([]);
  const [failed, setFailed] = useState(false);
  /* عروضُ الإسناد — تُجلَب هنا وتُبنى بنودا في الطابور، فلا قسمَ ثانيَ
     في اللوحة ولا وجهةَ مكتوبةٌ بيد. */
  const [offers, setOffers] = useState<TQOffer[]>([]);
  /* طلبُ اجتماعٍ مع الإدارة — يُطوى حتّى يُطلب، فالإطارُ ثقيلٌ على لوحةٍ تُفتح كلَّ يوم */
  /* نبضة كل دقيقة: «جلستك الآن» تتغيّر مع الوقت بلا إعادة تحميل.
     القيمة في حالة لا في الرسم — Date.now() في الرسم غير نقي. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      apiGet<RealCohort[]>("/api/trainer/my-cohorts"),
      apiGet<RealQueueItem[]>("/api/trainer/grading-queue"),
      /* الموجزُ رفاهيةٌ فوق الأساس: غيابُه لا يُسقط اللوحة */
      apiGet<CohortSummary[]>("/api/trainer/cohorts/summary").catch(() => [] as CohortSummary[]),
      /* والعروضُ رفاهيةٌ مثلُه: غيابُها لا يُسقط اللوحة */
      apiGet<TQOffer[]>("/api/trainer/offers").catch(() => [] as TQOffer[]),
    ])
      .then(([c, q, s, o]) => {
        setCohorts(c); setQueue(q); setSummary(s); setOffers(o);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed)
    return (
      <Card className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <ServerOff className="h-5 w-5" /> تعذر جلب شعبك — تأكد أن الخادم يعمل ثم حدّث الصفحة.
      </Card>
    );
  if (!cohorts || !queue)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> أحضر شعبك…
      </div>
    );

  /* ف-١ وف-٢: كلاهما من نفس الردود — بلا نقطة نهاية جديدة */
  const work = buildWorkQueue(
    cohorts,
    queue.filter((q) => q.status === "submitted" || q.status === "under_review").length,
    now,
    summary,
    /* والعروضُ بندا في الطابور لا بطاقةً في اللوحة: القاعدةُ ألّا تُكتب في
       هذه الصفحة وجهةٌ بيد — فوجهةُ البند تُحسَب مع إجرائه وسياقه في
       `work-queue.ts`، ويحرسها `cohort-proposals.test.ts`. */
    offers,
  );
  const atRisk = findAtRisk(cohorts, now);

  const students = cohorts.reduce((n, c) => n + c.cohort.enrollments.length, 0);

  /* ═══ ما ينتظر الإدارةَ لا ينتظره — جملةٌ لا بند ═══

     شعبةٌ أرسلها وتنتظر القرار، أو تمَّ فيها كلُّ ما يملكه وبقي مانعٌ بيد
     الإدارة (تسميةُ الفصل) — كلتاهما ليست عملا له. وقاعدةُ الطابور صريحة:
     «بند بلا إجراء ليس عملا بل خبرا». فلا تُحشر فيه بزرٍّ لا يفعل شيئا،
     ولا تُكتم: تُقال هنا في نصف سطر. */
  const waitingOnAdmin = summary.filter((c) =>
    c.planStatus === "submitted"
    || (c.planStatus === "draft" && c.total > 0 && c.done >= c.total && Boolean(c.next)),
  ).length;

  return (
    <div>
      {/* ═══ الرأس: سطرٌ واحدٌ نثرا — والعملُ كلُّه في طابورٍ واحدٍ تحته ═══

          كانت أربعَ بطاقاتٍ تشير إلى المقاصد نفسِها التي في شريط التبويبات
          فوقها، فحُذفت (١٣ سبتمبر ٢٠٢٦). ثمّ بقيت بعدها ثلاثةُ أقسامٍ تعيد
          ما في التبويبات أو ما في الطابور:

          · حبّةُ «شعبتان تنتظران إرسالَك» — عددٌ لا يقول أيَّ شعبةٍ ولا ما
            ينقصها؛ صارت بنودا في الطابور، لكلٍّ اسمُها وخطوتُها ووجهتُها.
          · شبكةُ «شعبي» — هي تبويبُ «شعبي» نفسُه مرسوما مرّةً ثانية.
          · «جلساتي القادمة» — هي تبويبُ «جدولي» نفسُه مقصوصا عند ثلاثين يوما.

          فبقي سطرُ تحيّةٍ وطابورٌ وقائمةُ المتعثّرين وبابُ الإدارة. ومن أراد
          الجردَ كلَّه فتبويباتُه فوقه.

          ⚠ ولم تُوضع لوحةُ «أرقامُك» (حضورٌ ٪ وتقييمٌ ٤٫٦): رقمان منها لا
          مصدرَ لهما في هذه الردود، والقاعدةُ ألّا يُختلق هنا رقمٌ لا مصدرَ
          له. والعددان اللذان لهما مصدرٌ يقولهما السطرُ نثرا. */}
      <p className="mb-6 text-sm leading-7 text-muted-foreground">
        أهلاً {name} — {cohorts.length > 0
          ? `لديك ${countAr(cohorts.length, COHORT_FORMS)} و${countAr(students, STUDENT_FORMS)}.`
          : "لم تُسند إليك شعب بعد."}
        {waitingOnAdmin > 0 && ` و${countAr(waitingOnAdmin, COHORT_FORMS)} تنتظر الإدارةَ لا تنتظرك.`}
      </p>

      {/* ═══ ولماذا سقطت بطاقاتُ «بوّابتك جاهزة» ═══

          كانت ثلاثَ بطاقاتٍ تشرح ما يحدث تاليا (الإسنادُ · التجهيزُ على مراحل
          · التشغيل) لمن لم تُسند إليه شعبةٌ بعد. وقرارُ صاحب المنصّة (١٣
          سبتمبر ٢٠٢٦): تُحذف وتبقى الصفحة. فالشرحُ يسبق العمل، ومن لا شعبةَ
          له لا ينفعه شرحُ مراحلِ شعبةٍ لا يراها — ومن أُسندت إليه يجدها في
          تبويب «شعبي» فيتعلّمها منها. وسطرُ «لم تُسند إليك شعب بعد» أعلاه
          يقول حالَه بلا ثلاث بطاقات. */}

      {/* ═══ ولماذا لم يعد الرابطُ هنا ═══

          كان بطاقةً في هذه الصفحة بين طابور العمل وجلساتِه القادمة، فيراه
          مرّةً يومَ أُسندت إليه شعبتُه ثمّ لا يعود إليه. وقرارُ صاحب المنصّة
          (١٣ سبتمبر ٢٠٢٦): تبويبٌ خاصٌّ به بعد «ما قيل عنّي» — وهو
          `pages/trainer/Referral.tsx`. فنُقل ولم يُكرَّر: نسختان منه تفترقان
          يوما، ويُقرأ الرقمُ فيهما مختلفا. */}

      {/* ف-١ · طابورُ العمل — وصار يحمل التجهيزَ والردَّ كذلك، فلا عملَ خارجَه */}
      {(cohorts.length > 0 || summary.length > 0) && <TrainerWorkQueue items={work} className="mb-6" />}

      {/* ف-٢ · من يحتاج تدخلك — أهم معلومة عند المدرب ولم تكن معروضة */}
      {cohorts.length > 0 && <AtRiskList learners={atRisk} className="mb-6" />}

      {/* ═══ اجتماعٌ مع الإدارة — بنقرة، داخل الصفحة، وفي الذيل لا الصدر ═══

          قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): لا مهامَّ تهيئةٍ هنا — ما يلزم
          المدرّبَ يُقال له في كلّ شعبةٍ في موضعها. وبدلَها بابٌ يسأل منه.

          وصار مكوّنا (ع-١): السطرُ نفسُه في «مركز التواصل»، ونسختان تفترقان. */}
      <BookAdminMeeting name={name} email={email} />

      <p className="mt-6 text-center text-read text-muted-foreground">
        كل بند أعلاه يقودك إلى مكان تنفيذه — وصفحةُ كلّ شعبةٍ تحمل تجهيزَها وتشغيلَها معا.
      </p>
    </div>
  );
}


/* حُذفت لوحة المحاكاة (كانت من `export default` إلى آخر الملف): شعبٌ وطلابٌ
   وتسليماتٌ وقائمةُ تهيئةٍ تُولَّد في المتصفّح لهويّة مدرّبٍ مختلَقة، وتُعرض
   متى وُجدت تلك الهوية في localStorage — أي دائما بعد أول اختيار. */
/* الإطار على الصفحة الأولى أيضا — وكان غائبا عنها وحدها.

   هي أوّل ما يهبط عليه المدرب بعد الدخول، وكانت تُصيَّر عارية: بلا تبويبات
   ولا جرس إشعارات ولا بحث ولا خروج. فمن دخل بوابته وقف في غرفةٍ بلا أبواب،
   ولا يبلغ «طابور التقييم» ولا «مستحقّاتي» إلا بكتابة المسار بيده. والشاشات
   الخمس الأخرى كانت تحمل الإطار كاملا — فالعطب في هذه وحدها. */
export default function TrainerDashboard() {
  const { user, checked } = useRealSession();
  return (
    <TrainerLayout title="الرئيسية">
      {checked
        ? <RealTrainerHome name={user?.displayName ?? ""} email={user?.email ?? ""} />
        : <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>}
    </TrainerLayout>
  );
}
