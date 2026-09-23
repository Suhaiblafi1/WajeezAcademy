/* شريطُ العرض المشروط — المهلةُ التي تسير عليه، يراها.

   ═══ العطبُ الذي وُلد منه ═══

   صار للعرض المشروط حسابُه (`application/trainer/conditional-offer.ts`)،
   وصار له خادمٌ يقبل «أعلنتُ اكتمالها» و«امنحني يومين»، وعاملٌ يذكّر قبل
   يومين ويوسم المنقضية. ولم يكن في بوّابة المدرّب حرفٌ يقول له إنّ عليه
   مهلةً أصلا: سبعةُ أيّامٍ تجري على إنسانٍ لا يراها، ومخرجان مفتوحان له
   لا يبلغهما إلّا بـ`curl`.

   ═══ ولمَ في الإطار لا في «الرئيسية» ═══

   المهلةُ حالُه لا حالُ شاشة: من فتح «مساراتي» أو «مؤهّلاتي» وهو في يومه
   السادس يجب أن يرى الرقمَ حيث هو. وشريطٌ في صفحةٍ واحدةٍ يُرى لمن قصدها.

   ═══ وثلاثةُ قيودٍ تسكن البنية ═══

   ① **الظهورُ على `hasOpenCondition` لا على الطور.** `conditionPhase`
      يردّ `none` لمن لا أعمدةَ شرطٍ في عقده — وهم مدرّبو المنصّة كلُّهم
      قبل هذا الطور. فشريطٌ يقرأ الطورَ وحدَه يُعلن على مدرّبٍ نشطٍ منذ
      سنةٍ أنّ عرضَه مشروطٌ وأنّ موعدَ جلسته سيصله.
   ② **والسطرُ من `conditionLineAr` لا مكتوبٌ هنا.** نسختان لسطرٍ واحدٍ
      تفترقان: تُصلَح الأيّامُ في الوحدة ويبقى الشريطُ يقول «سبعة» لمن
      أمامه يومان.
   ③ **وكلُّ زرٍّ معلَّقٌ على الشرط الذي يقبله الخادم بعينه.** زرٌّ يُعرض
      ويُردّ بـ«لا مهلةَ قائمةً على حسابك» أسوأُ من زرٍّ لا يُعرض.

   والإعلانُ لا رجعةَ فيه: يجمّد المهلةَ ويوقظ الطابور، والثانيةُ تُردّ
   بـ«موادُّك عندنا للتقييم أصلا». فله تأكيدٌ يقول ماذا سيحدث بالضبط.

   ═══ ولمَ زرُّه مُثبِتٌ لا ذهبيّ ═══

   الذهبيُّ **فعلُ الصفحة**، وهذا الشريطُ في الإطار لا في صفحة: فلو
   كان ذهبيّا لَنازع فعلَ كلِّ شاشةٍ يفتحها المدرّب — ومتى كان للشاشة
   ذهبيّان فليس لها ذهبيّ. وهي عينُ علّةِ `ThemeToggle` التي أصابت ستّ
   عشرةَ شاشةٍ من سبع عشرة (`src/tests/one-primary-per-screen.test.ts`). */

import { useState } from "react";
import { AlarmClock, CircleCheck, Hourglass, TriangleAlert } from "lucide-react";
import ConfirmAction from "@/components/ConfirmAction";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { toast, toastError } from "@/components/Toast";
import { apiPost, permissionMessage } from "@/services/api";
import {
  EXTENSION_DAYS,
  canAskExtension, canDeclareMaterials, conditionLineAr, conditionPhase,
  hasOpenCondition, type ConditionPhase,
} from "@/application/trainer/conditional-offer";

/** ما يخرج من `/api/trainer/me` من صفّ العقد — لا الصفُّ كلُّه */
export interface ConditionContract {
  conditionDeadlineAt?: string | null;
  conditionPausedAt?: string | null;
  conditionExtendedAt?: string | null;
  conditionMetAt?: string | null;
}

export interface OnboardingTask {
  key: string;
  title: string;
  doneAt?: string | null;
}

/* نبرةُ الشريط تتبع الطور: المنقضيةُ تحذيرٌ يُرى، والمجمَّدةُ انتظارٌ
   هادئ، والسائرةُ تذكيرٌ لا إنذار. */
const TONE: Record<ConditionPhase, "warn" | "accent" | "default"> = {
  none: "default",
  running: "accent",
  under_review: "default",
  met: "default",
  lapsed: "warn",
};

const ICON: Record<ConditionPhase, typeof AlarmClock> = {
  none: Hourglass,
  running: AlarmClock,
  under_review: Hourglass,
  met: CircleCheck,
  lapsed: TriangleAlert,
};

export default function ConditionStrip({
  contract, tasks = [], onDone,
}: {
  contract: ConditionContract | null | undefined;
  tasks?: OnboardingTask[];
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"declare" | "extend" | null>(null);

  /* ولا شريطَ لمن لا شرطَ قائما عليه — وهي القاعدةُ ①، وموضعُها قبل كلّ
     شيء: عقدٌ بلا أعمدةِ شرطٍ يخرج من هنا بلا أن يُقرأ منه طور. */
  if (!contract || !hasOpenCondition(contract)) return null;

  const phase = conditionPhase(contract);
  const Icon = ICON[phase];
  const missing = tasks.filter((t) => !t.doneAt);

  const declare = async () => {
    setBusy("declare");
    try {
      await apiPost("/api/trainer/condition/declare-complete");
      toast("وصلَنا إعلانُك — والمهلةُ متجمّدةٌ حتّى يصلك جوابُنا");
      setAsking(false);
      onDone();
    } catch (e) {
      toastError(permissionMessage(e, "تعذّر إرسالُ إعلانك — أعِد المحاولة"));
    } finally {
      setBusy(null);
    }
  };

  const extend = async () => {
    setBusy("extend");
    try {
      await apiPost("/api/trainer/condition/extend");
      toast("مُنحتَ التمديد — والمهلةُ الجديدةُ في الشريط");
      onDone();
    } catch (e) {
      /* و«مُنح التمديدَ مرّةً ولا يُمنح ثانية» نصٌّ كُتب ليُقرأ لا ليُبتلع */
      toastError(permissionMessage(e, "تعذّر طلبُ التمديد — أعِد المحاولة"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Inset tone={TONE[phase]} className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <Icon className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black leading-6 text-foreground">{conditionLineAr(contract)}</p>
        {/* وما ينقصه يُقرأ من مهامّه لا من ظنٍّ — والمنجَزةُ لا تُعاد عليه */}
        {missing.length > 0 && (
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            وبقي من مهامّ تهيئتك: {missing.map((t) => t.title).join(" · ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {canAskExtension(contract) && (
          <Button
            tone="ghost"
            size="sm"
            loading={busy === "extend"}
            onClick={() => void extend()}
          >
            امنحني {EXTENSION_DAYS === 2 ? "يومين" : `${EXTENSION_DAYS} أيّام`}
          </Button>
        )}
        {canDeclareMaterials(contract) && (
          <Button tone="confirm" size="sm" onClick={() => setAsking(true)}>
            أعلنتُ اكتمالها
          </Button>
        )}
      </div>

      {asking && (
        <ConfirmAction
          titleAr="أعلنتُ اكتمالَ موادّي"
          tone="default"
          confirmLabelAr="أعلِنْ"
          busy={busy === "declare"}
          onCancel={() => setAsking(false)}
          onConfirm={() => void declare()}
        >
          <p className="leading-7">
            ستتجمّد مهلتُك من هذه اللحظة، وتصل موادُّك إلى طابور التقييم. ووقتُ
            مراجعتنا لا يُحسب عليك: ما جُمِّد يُعاد إلى مهلتك بمقداره إن رُدَّت
            إليك بملاحظات.
          </p>
          <p className="mt-2 leading-7">
            ولا يُعلَن مرّتين — فراجِعْ موادَّك قبل أن تُعلن.
          </p>
        </ConfirmAction>
      )}
    </Inset>
  );
}
