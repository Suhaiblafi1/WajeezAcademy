/* قسمُ العقود — يُركَّب العقدُ هنا ويُعايَن قبل أن يراه أحد.

   ── ولمَ شاشةٌ لا لسانٌ في ملفّ المتقدّم ──

   كان العقدُ طيّةً مطويّةً داخل لوح المتقدّم: تُفتح، فيُكتب فيها عنوانٌ،
   فيُنشأ صفّ. وثمنُ ذلك أنّ **من ينتظر عقدا لا يظهر في أيّ موضع**: من قُبل
   قبولا مشروطا منذ أسبوعين ولم يُرسَل له شيءٌ لا يعرف به أحدٌ حتّى يسأل هو.
   فالشاشةُ هنا تُري ما صُنع **ومن ينتظر**، وهما نصفان لا نصفٌ واحد.

   ── والمعاينةُ قبل التركيب، لا بعده ──

   المتنُ يُجمَّد عند التركيب ولا يُعدَّل بعده. فلو لم تُعايَن الوثيقةُ قبلَه
   لكان أوّلُ قارئٍ لها هو المدرّب. والمعاينةُ تعمل ولو نقصت هويّةُ الأكاديميّة
   — فيرى الموظّفُ مواضعَ النقص في سياقها قبل أن يُطلب منه سدُّها.

   ── والأجرُ يُقرأ ولا يُكتب ──

   `trainer.contract.manage` يركّب ويرسل، و`trainer.compensation.manage` تضبط
   الرقم. فما يظهر هنا من أتعابٍ مقروءٌ لا محرَّر: من يتعاقد يرى ما سيُوقَّع
   عليه، ولا يملك تغييرَه من شاشته. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Ban, BellRing, Download, FilePlus2, FileSignature, FileText, Handshake, IdCard, MessageSquareReply, Printer, RefreshCw, Send, Trash2, Undo2, UserMinus, X } from "lucide-react";
import ConfirmAction from "@/components/ConfirmAction";
import Modal from "@/components/Modal";
import {
  CONTRACT_BODY_VERSION, SPECIAL_TERMS_MAX_CHARS, specialTermsItemsAr, type ContractCompensation,
} from "@/application/trainer/contract-body";
import { FINAL_REMINDER_DAYS, daysWindowAr } from "@/application/trainer/notice-periods";
import { changeGroupsBetween } from "@/application/trainer/contract-changelog";
import {
  DEFAULT_RESIGN_SUBJECT_AR, RESIGN_BODY_MAX, RESIGN_BODY_MIN, RESIGN_CHANGES_HEADING_AR,
  RESIGN_SUBJECT_MAX, RESIGN_SUBJECT_MIN, defaultResignBodyAr, personalChangesAr, reissueChangesView, noChangesLineAr,
  DEFAULT_AMENDMENT_ACCEPT_SUBJECT_AR, defaultAmendmentAcceptBodyAr, hasAmendmentPlaceholder, versionReadByRequester,
} from "@/application/trainer/contract-resign";
import { apiDelete, apiGet, apiPost, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
/* وطورُ الشرط من موضعه الواحد لا مشتقًّا هنا — ورأسُ `conditional-offer.ts`
   يقول إنّ هذه التسمياتَ لـ«صفّ الطابور» كذلك، ولم تكن تصله. */
import {
  conditionPhase, materialsGateProblemAr, CONDITION_PHASE_LABELS_AR,
  signatureApprovalOf, type SignatureApproval,
} from "@/application/trainer/conditional-offer";
import type { Readiness } from "@/application/trainer/readiness";
import {
  CONTRACT_DOCUMENT_KINDS, DEFAULT_REQUIRED_DOCUMENTS, type RequiredDocument,
} from "@/application/trainer/contract-documents";
import { isContractClosed, recontractFor } from "@/application/trainer/contract-endings";
import {
  ASSIGNMENT_OFFER_RESPONSE_DAYS, COURSE_PREP_DEFAULT_DAYS, COURSE_PREP_MIN_DAYS,
} from "@/application/trainer/notice-periods";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls as inputCls, staffAreaCls as areaCls } from "@/components/FormKit";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import TabBar from "@/components/ui/TabBar";
import {
  CONTRACT_TABS, defaultTab, inTab, type ContractTabId,
} from "@/application/trainer/contract-tabs";
import MaterialsReview from "./TrainerMaterialsReview";
import AdminLayout from "./AdminLayout";
import { parseContractDoc } from '@/application/trainer/contract-sections'
import ContractDocument from '@/components/ContractDocument'
import { nameMatch } from '@/application/trainer/contract-names'
import { groupContracts, readLineage } from '@/application/trainer/contract-lineage'
import { isUntouchableContract } from '@/application/trainer/contract-untouchable'
import { countAr } from '@/application/text/count-ar'

/* حقلا رسالة «أعِدْه للتوقيع» — العنوانُ والنصُّ يُكتبان لكلّ مدرّبٍ كما يشاء
   صاحبُ المنصّة، فحقلٌ يُقرأ فيه نصٌّ طويلٌ لا سطرُ متصفّح. */
const FIELD =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/75 outline-none transition focus:border-teal";
const LABEL = "mb-1.5 block text-xs font-bold text-muted-foreground";

/* عددُ الملحق (أ) بتمييزه: كان «10 دورةً» لكلّ عدد، وهو لحنٌ من الواحد إلى
   العشرة. والضميرُ في الصيغة نفسِها لأنّه يتبع العدد: «دورتان مؤهّلا لهما». */
const ANNEX_A_FORMS = {
  one: "دورة مؤهّلا لها", two: "دورتان مؤهّلا لهما", few: "دورات مؤهّلا لها", many: "دورةً مؤهّلا لها",
} as const;

const STATUS_AR: Record<string, string> = {
  draft: "مسودّة مجمَّدة", sent: "أُرسل — بانتظار التوقيع", revoked: "ملغًى",
  signed: "وقّعه صاحبُه — ينتظر اعتمادك", expired: "منتهٍ", terminated: "مفسوخ",
  /* أزاحه عقدٌ أحدثُ خُتم للمدرّب نفسِه (١ أكتوبر ٢٠٢٦) — `supersedePriorLive` */
  superseded: "أزاحه عقدٌ أحدث",
  /* ═══ اعتمادُ التوقيع ليس توقيعَنا (١ أكتوبر ٢٠٢٦) ═══
     سأل صاحبُ المنصّة: «عندما أصادق على توقيعٍ هل هذا معناه أنّنا وقّعنا؟».
     فالحالان اسمان: اعتمدتَ توقيعَه وفُتحت بوّابتُه، ثمّ وقّعنا حين اعتُمدت دوراتُه. */
  signature_approved: "اعتمدتَ توقيعَه — نوقّعه حين تُعتمَد دوراتُه",
  /* وكان غائبا عن هذا المعجم وحدَه، والشاشةُ تعالجه في ثلاثة مواضع — فيُقرأ
     صفُّه «amendment_requested» بالإنجليزيّة خاما إلى جنب اسم المدرّب. */
  amendment_requested: "طلب تعديلا — ينتظر جوابَك",
  declined: "اعتُذر عنه", countersigned: "نافذٌ — وقّعته الأكاديميّة",
};

const OFFER_STATUS_AR: Record<string, string> = {
  offered: "ينتظر جوابَه", accepted: "قبِله", declined: "اعتذر عنه",
  lapsed: "انقضت مهلتُه", withdrawn: "سُحب",
};

interface CandidateRow { id: string; reference: string; fullName: string; email: string; status: string }

interface ContractRow {
  id: string; title: string; status: string; kind: string; revision: number;
  /** رقمُ العقد — `WJ-CT-…`، يُبحث به ويُقال للمدرّب (١ أكتوبر ٢٠٢٦) */
  number: string;
  bodyVersion: string | null; bodyHash: string | null; signerEmail: string | null;
  /** تحديثُ النصّ في مكانه — به يُعرف أيَّ إصدارٍ قرأ من طلب تعديلا (`versionReadByRequester`) */
  bodyPrevVersion?: string | null; bodyUpdatedAt?: string | null;
  compensationType: string | null; compensationRate: string | null; currency: string;
  compensationMinSeats: number | null; compensationReferralRate: string | null;
  /** البند 21 — بنودُه الخاصّة كما طُبعت */
  specialTermsAr: string | null;
  gatesActivation: boolean; sentAt: string | null; signedAt: string | null;
  revokedAt: string | null; revokeReasonAr: string | null; createdAt: string;
  /** التذكيرُ الأخيرُ بالتوقيع وأجلُ الرابط — مرّةً واحدةً لكلّ عرض */
  finalReminderAt: string | null; tokenExpiresAt: string | null;
  signerLegalName: string | null; declinedAt: string | null; declineReasonAr: string | null;
  countersignedAt: string | null; academySignatoryName: string | null;
  academySignatoryTitle: string | null; countersignNoteAr: string | null;
  /** اعتمادُ التوقيع بلا خَتم — العرضُ المشروطُ في طور موادّه (١ أكتوبر ٢٠٢٦) */
  signatureApprovedAt?: string | null; signatureApprovalNoteAr?: string | null;
  nameCorrectionAr: string | null; nameCorrectionAt: string | null;
  replacesContractId: string | null;
  amendmentRequestAr: string | null; amendmentRequestedAt: string | null;
  amendmentReplyAr: string | null; amendmentRepliedAt: string | null;
  conditionDeadlineAt: string | null; conditionPausedAt: string | null;
  conditionExtendedAt: string | null; conditionExtensionsUsed?: number | null;
  conditionMetAt: string | null;
  orientationAt: string | null;
  documents: { id: string; kind: string; originalName: string; mime: string; uploadedAt: string }[];
  qualifiedSnapshot: { courseId: string; titleAr: string }[] | null;
  profile: { id: string; legalNameAr: string | null; suspendedAt?: string | null; application: { id: string; reference: string; fullName: string; email: string; status: string } | null } | null;
}

/* ═══ الاسمان في صفٍّ واحد (٢٦ سبتمبر ٢٠٢٦) ═══

   بلاغُ صاحب المنصّة: «اسم الطرف الثاني يجب أن يكون مطابقا للهوية». وأوّلُ
   ما يلزم لذلك أن يكون الاسمان **منظورَين معا**: الشاشةُ كانت تعرض اسمَ
   الحساب وحدَه، فلا يُرى فرقٌ ولو كان قائما.

   و`documentNameAr` هو المطبوعُ في الوثيقة: `legalNameAr` إن كان قد صُحّح،
   وإلّا فاسمُ الحساب — وهو ترتيبُ `contractPrefill` و`composeContract`
   نفسُه، فما تعرضه الشاشةُ هو ما طُبع لا تقديرٌ لما طُبع. */
const namesOf = (c: ContractRow) => ({
  documentNameAr: c.profile?.legalNameAr ?? c.profile?.application?.fullName ?? null,
  signedNameAr: c.signerLegalName,
});
const docNameOf = (c: ContractRow) => namesOf(c).documentNameAr ?? "—";

/* ═══ أمغلَقٌ هذا العقد؟ (٢٦ سبتمبر ٢٠٢٦) ═══

   عطبٌ شُحن صباحَ اليوم: لوحةُ مقابلة الاسمَين تُرسَم على كلِّ عقدٍ موقَّعٍ
   — **بما فيه المغلَق** — ونصيحتُها ثابتة: «فاردُدِ التوقيعَ، ويُركَّب
   بديلٌ باسمه». وفي عقدٍ ملغًى أو مفسوخٍ لا توقيعَ يُردّ. فالمقابلةُ نفسُها
   نافعةٌ سجلّا يُقرأ بعد سنة، والأمرُ الذي معها خطأ.

   والقائمةُ في `contract-endings.ts` لا هنا: هو «مصدرُ الحقيقة الوحيد»
   لقوائم حالات العقد، والخادمُ يقرأ منه. وقائمةٌ تُكتب باليد في شاشةٍ
   تفترق يوما عن أختها. */
const isClosed = (c: ContractRow) => isContractClosed(c.status);

/** ما يمسّه الإغلاقُ — كما يقرؤه الخادمُ من المواضع التي يمسّها الرحيلُ فعلا */
interface Impact {
  isLive: boolean; liveCohorts: number; enrolledLearners: number;
  openOffers: number; unpaidPayouts: number; owedByCurrency: Record<string, number>;
}

/** أفي هذا الأثرِ ما يُوقِف القارئَ؟ — فنافذةٌ تقول «لا شيءَ سيُمَسّ» أنفعُ من
 *  نافذةٍ تعدّد أربعةَ أصفار. */
const impactBites = (i: Impact) =>
  i.liveCohorts > 0 || i.enrolledLearners > 0 || i.openOffers > 0 || i.unpaidPayouts > 0;

/* ═══ ما يقع باعتماد التوقيع — سطرٌ لكلّ حكمٍ من `signatureApprovalOf` ═══

   والسجلُّ مقفلٌ بالنوع: حكمٌ جديدٌ بلا سطرٍ لا يُبنى، فلا يقع صفٌّ على جملةِ
   حكمٍ غيرِه. وكان سطرا واحدا للبابَين: «فبالاعتماد ينفذ العقدُ» (١ أكتوبر ٢٠٢٦).
   وسطرُ `seal` كان «فبالاعتماد نوقّع عن الأكاديميّة وينفذ العقدُ» — بابا واحدا؛
   فصار يقول الخيارين (٢ أكتوبر ٢٠٢٦، `PlainContractChoices`). */
const APPROVAL_LINE_AR: Record<SignatureApproval, string> = {
  seal: " ثمّ اختر أدناه: أن تعتمده كالعقود الجديدة فلا نوقّعه إلّا يومَ تعتمد دوراتِه، أو أن تعتمده ونوقّع عن الأكاديميّة الآن فينفذ — ولا تُمسّ حالتُه في الحالَين، فهو نشطٌ أصلا",
  approve_only: " فبالاعتماد تُفتح بوّابتُه ويبدأ طورُ موادّه ومهلتُه، ولا نوقّع العرضَ إلّا يومَ نعتمد دوراتِه",
  sealed_by_text: " ثمّ اختر أدناه: أن تعتمده كالعقود الجديدة، أو كما وقّعه، أو تعيده للتوقيع على النصّ الحاضر",
};

/** ما يقع بـ«اعتمِدْه كما وقّعه» — يُقال في الصندوق وفي نافذة التأكيد بحرفٍ واحد */
const ACCEPT_AS_SIGNED_AR = "نصُّه يجعل اعتمادَ التوقيع توقيعا منّا: فنوقّعه الآن عن الأكاديميّة ويصير نافذا"
  + " قبل اعتماد دوراته — وتُفتح بوّابتُه وتبدأ مهلةُ موادّه كسائر العروض.";

/** وما يقع بـ«اعتمِدْه كالعقود الجديدة» — بحرفٍ واحدٍ في الصندوق والتأكيد (٢ أكتوبر ٢٠٢٦).
    خيارُ صاحب المنصّة بعد أن سأل «كودٌ أم لأنّه غيرُ مكتوبٍ بالعقد؟» وقيل له: النصّ.
    فالجملةُ الثانيةُ وصفٌ لما يبقى لا تحذيرٌ يُثني: الزرُّ يغيّر ما تقوله المنصّة،
    ونصُّه الموقَّعُ كما هو. */
const LIKE_NEW_AR = "يُعامَل كالعقود الجديدة: تُفتح بوّابتُه وتبدأ مهلةُ موادّه، ولا نوقّعه إلّا يومَ نعتمد دوراتِه."
  + " ونصُّه الموقَّعُ باقٍ كما هو — يقول إنّ اعتمادَ توقيعه توقيعٌ منّا.";

/** وما يقع بـ«اعتمِدْه كالعقود الجديدة» على عقدٍ غيرِ مشروط (٢ أكتوبر ٢٠٢٦) — بحرفٍ
    واحدٍ في الصندوق والتأكيد. ولا جملةَ فيه عن نصٍّ يقول غيرَه كما في `LIKE_NEW_AR`:
    متنُه يسري «من تاريخ توقيع الطرفين» (البند 17-1)، فتأخيرُ توقيعنا على نصّه. ولا
    طورَ موادَّ ولا مهلة: ذاك شرطٌ ليس في متنه، وبوّابتُه مفتوحةٌ أصلا. */
const LIKE_NEW_PLAIN_AR = "نعتمد توقيعَه ولا نوقّعه الآن: نوقّعه يومَ تعتمد دوراتِه، بزرّ «وقِّعْه الآن» في صفّه."
  + " ولا ينفذ حتّى نوقّعه، وما كان نافذا له قبله يبقى إلى يومئذ. وحالتُه كما هي — فهو نشطٌ أصلا.";

/** وما يقع بتوقيعنا الآن على عقدٍ غيرِ مشروط — في الصندوق، وفي التأكيد قبل الاعتماد،
    وفي نافذة «وقِّعْه الآن» بعده: الأثرُ واحدٌ أيّانَ وقع */
const SEAL_NOW_AR = "نوقّعه عن الأكاديميّة الآن فينفذ بين الطرفين من اليوم، ويحلّ محلَّ ما كان نافذا له قبله."
  + " وتصله رسالةٌ بذلك، وحالتُه كما هي.";

/* ═══ عقدٌ غيرُ مشروط: الخياران وأثرُ كلٍّ — والقرارُ لك (٢ أكتوبر ٢٠٢٦) ═══

   كان صفُّه يعرض «طابقتُ الاسمَ — اعتمِدْ ووقِّعْ» وحدَه: الاعتمادُ خَتمٌ لا محالة.
   فقال صاحبُ المنصّة عن مدرّبَين أنهى تعاقدَهما ثمّ ركّب لهما عقدا جديدا: «لم
   أتمكّن من اعتمادهم بالعقد الجديد ليكون تطابقُ الاسم ليس اعتمادا نهائيّا للعقد».
   وعلّةُ خروجه غيرَ مشروطٍ أنّ موادَّهما اعتُمدت في عقدٍ سابق (`offerGatesActivation`)
   — والإنهاءُ لا يمحو ذلك. فتُقال العلّةُ هنا، ثمّ الخياران وأثرُ كلٍّ: «كالعقود
   الجديدة» أوّلا وهو ما طلبه، و«اعتمِدْ ووقِّعْ الآن» كما كان. */
function PlainContractChoices() {
  return (
    <Panel tone="warn" className="w-full p-3 text-read leading-7">
      <b>عقدٌ غيرُ مشروط — والقرارُ لك.</b>
      <span className="block">
        خرج غيرَ مشروطٍ لأنّ موادَّ هذا المدرّب اعتُمدت في عقدٍ سابق — ولو انتهى ذلك العقد.
        ونصُّه يقول إنّه يسري من تاريخ توقيع الطرفين، فالخياران كلاهما على نصّه.
      </span>
      <span className="mt-2 block font-bold">ولك أن تختار:</span>
      <ul className="list-disc ps-5">
        <li><b>«اعتمِدْه كالعقود الجديدة»</b> — {LIKE_NEW_PLAIN_AR}</li>
        <li><b>«اعتمِدْ ووقِّعْ الآن»</b> — {SEAL_NOW_AR}</li>
        <li>
          <b>«حُدّث النصُّ — أعِدْه للتوقيع»</b> — يصله النصُّ الحاضرُ ليوقّعه ثانيةً، ثمّ تختار
          بين هذين.
        </li>
        <li><b>«لم يطابق — ارفضْ»</b> — إن لم يطابق اسمُه وثيقةَ هويّته.</li>
      </ul>
    </Panel>
  );
}

/* ═══ وقّع نصّا سابقا: ما تغيّر، والخياراتُ وأثرُ كلٍّ — والقرارُ لك (٢ أكتوبر ٢٠٢٦) ═══

   كان الصندوقُ يقول «لا يُعتمَد بنصّه… فأعِدْه للتوقيع»، فلا يبقى إلّا بابٌ واحد.
   فقال صاحبُ المنصّة: «Instead of you force me to send this contract back for
   re-signing, you should have given me what is the difference between this
   contract that he has signed and the current one… Do not force me to do any
   action. Do always give me options and tell me what are the differences».

   فيُعرض هنا ما تغيّر بين ما وقّعه والنصّ الحاضر — من سجلّ التغييرات نفسِه الذي
   تقرؤه رسائلُ التحديث، بالصيغة التي تصل المدرّب، وبلا رقم إصدار — ثمّ الخياراتُ
   وما يقع بكلٍّ منها، وزرُّ «اعتمِدْه كما وقّعه» جنبَ أخويه.

   وأوّلُها «اعتمِدْه كالعقود الجديدة»: اختاره صاحبُ المنصّة (٢ أكتوبر ٢٠٢٦،
   «Option 4») بعد أن قيل له إنّ نصَّه يجعل الاعتمادَ توقيعا — فهو الأوّلُ والزرُّ
   الرئيس، وأثرُه مكتوبٌ معه بما يبقى (`LIKE_NEW_AR`). */
function SignedEarlierText({ c }: { c: Pick<ContractRow, "bodyVersion" | "gatesActivation"> }) {
  const changes = changeGroupsBetween(c.bodyVersion, CONTRACT_BODY_VERSION, { conditional: c.gatesActivation });
  return (
    <Panel tone="warn" className="w-full p-3 text-read leading-7">
      <b>وقّع نصّا سابقا — والقرارُ لك.</b>
      {changes.length === 0 ? (
        <span className="block">لا يذكر سجلُّ التغييرات فرقا بين ما وقّعه والنصّ الحاضر.</span>
      ) : (
        <>
          <span className="block">ما تغيّر في النصّ الحاضر عمّا وقّعه — بالصيغة التي تصل المدرّب:</span>
          <ul className="list-disc ps-5">
            {changes.flatMap((g) => g.itemsAr.map((item, i) => (
              <li key={`${g.titleAr}-${i}`}>
                <span className="opacity-70">{g.titleAr}: </span>{item}
              </li>
            )))}
          </ul>
        </>
      )}
      <span className="mt-2 block font-bold">ولك أن تختار:</span>
      <ul className="list-disc ps-5">
        <li><b>«اعتمِدْه كالعقود الجديدة»</b> — {LIKE_NEW_AR}</li>
        <li><b>«اعتمِدْه كما وقّعه»</b> — {ACCEPT_AS_SIGNED_AR}</li>
        <li>
          <b>«حُدّث النصُّ — أعِدْه للتوقيع»</b> — يصله النصُّ الحاضرُ ليوقّعه، ثمّ تعتمد توقيعَه،
          ولا نوقّعه إلّا يومَ تعتمد دوراتِه.
        </li>
        <li><b>«لم يطابق — ارفضْ»</b> — إن لم يطابق اسمُه وثيقةَ هويّته.</li>
      </ul>
    </Panel>
  );
}

/** تنزيلُ المتن كما بُصم — نصّا لا صورةً له.
 *
 *  والاسمُ يُنقّى ممّا لا يقبله نظامُ ملفّات: عنوانُ العقد يحمل نقطتَين
 *  وشرطاتٍ، وويندوز يرفض بعضَها فيسقط التنزيلُ صامتا. */
function downloadBodyAr(doc: { title: string; body: string }) {
  const url = URL.createObjectURL(new Blob([doc.body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** وقائعُ الشرط كما يقرؤها `conditional-offer.ts` — تُشتقّ من الصفّ مرّةً
    واحدةً، فلا يُعاد تركيبُ الكائن في كلّ موضعٍ يُسأل فيه عن الطور. */
const conditionFactsOf = (c: ContractRow) => ({
  orientationAt: c.orientationAt,
  conditionDeadlineAt: c.conditionDeadlineAt,
  conditionPausedAt: c.conditionPausedAt,
  conditionExtendedAt: c.conditionExtendedAt,
  conditionExtensionsUsed: c.conditionExtensionsUsed,
  conditionMetAt: c.conditionMetAt,
});

interface Prefill {
  applicationId: string; reference: string; fullName: string; email: string;
  legalNameAr: string; legalNameSource: "verified" | "account";
  applicationStatus: string; gatesActivation: boolean;
  courses: { courseId: string; titleAr: string }[];
  compensation: { ruleId: string; type: string; rate: string; currency: string; minSeats: number | null; referralRate: string | null } | null;
  feeNotes: { reviewerName: string | null; expectation: string | null; proposal: string | null }[];
  missingLegal: string[];
  /** ما يمنع التركيبَ والإرسال — موقوفٌ أو مردودٌ أو مسحوب — بمخرجه (`contractBlockedAr`) */
  blockedAr: string | null;
  /** بنودُه الخاصّةُ في أحدث عقوده — تُملأ بها الخانة */
  lastSpecialTermsAr: string | null;
}

interface OfferRow {
  id: string; status: string; courseId: string; courseTitleAr: string;
  cohortId: string | null; cohort: { id: string; title: string; startsAt: string | null } | null;
  sessionsCount: number | null; startsAt: string | null; feeNoteAr: string | null; noteAr: string | null;
  expiresAt: string; offeredAt: string; respondedAt: string | null;
  declineReasonAr: string | null; withdrawReasonAr: string | null;
  prepDays: number; prepDueAt: string | null; prepConfirmedAt: string | null; prepLapsedAt: string | null;
  profile: { id: string; application: { id: string; fullName: string; email: string } | null } | null;
}

interface OfferOptionCohort {
  id: string; title: string; startsAt: string | null; status: string; hasLead: boolean; mine: boolean;
}
interface OfferOptionCourse {
  courseId: string; titleAr: string; alreadyOpen: boolean; alreadyAccepted: boolean;
  cohorts: OfferOptionCohort[];
}
interface OfferOption {
  profileId: string; fullName: string; email: string; reference: string;
  contract: { id: string; title: string; countersignedAt: string | null } | null;
  courses: OfferOptionCourse[];
}

/** مرشَّحٌ لشعبة تعبئة — علّتُه عند `TrainerOfferService.prepCandidates` */
interface PrepCandidate {
  profileId: string; fullName: string; email: string; reference: string;
  courses: { courseId: string; titleAr: string; acceptedWithoutCohort: boolean }[];
}
interface PrepResult {
  done: number; failed: number;
  results: { profileId: string; courseId: string; ok: boolean; errorAr?: string }[];
}
const PREP_FORMS = { one: "دورة", two: "دورتان", few: "دورات", many: "دورة" };
const COHORT_FORMS = { one: "شعبة", two: "شعبتان", few: "شعب", many: "شعبة" };
const prepKey = (profileId: string, courseId: string) => `${profileId}|${courseId}`;

/** وجهةُ خطإ المركِّب — ليست معرّفَ صفٍّ، فلا يلتبس بعقدٍ في القائمة */
const COMPOSE_ERR = "__compose__";

export default function TrainerContracts() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [missingLegal, setMissingLegal] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [openFor, setOpenFor] = useState<CandidateRow | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [title, setTitle] = useState("");
  /* ═══ اسمُ الطرف الثاني يُحرَّر قبل أن يُجمَّد المتن (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «الطرف الثاني كاسم يجب أن يكون مطابقا للهويّة…
     لأنّ الاسم الموجود هنا هو ما أُخذ من حسابه وغالبا ليس اسما ثلاثيّا».
     وهذا الحقلُ هو الموضعُ الوحيدُ الذي يُصحَّح فيه بلا ثمن: بعد التجميد
     يصير التصحيحُ عقدا بديلا. */
  const [legalNameAr, setLegalNameAr] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [docs, setDocs] = useState<RequiredDocument[]>(DEFAULT_REQUIRED_DOCUMENTS);
  const [hoursNoteAr, setHoursNoteAr] = useState("");
  /* البند 21 — بنودٌ مُلزِمةٌ لهذا المدرّب وحده (١ أكتوبر ٢٠٢٦) */
  const [specialTermsAr, setSpecialTermsAr] = useState("");
  /* الأتعابُ وجلسةُ التهيئة في هذه الشاشة — لا شاشةَ ثانية */
  const [feeRate, setFeeRate] = useState("");
  const [feeReferralRate, setFeeReferralRate] = useState("");
  const [feeMinSeats, setFeeMinSeats] = useState("");
  const [orientationAt, setOrientationAt] = useState("");
  const [orientationUrl, setOrientationUrl] = useState("");
  const [waivedAr, setWaivedAr] = useState("");
  const [preview, setPreview] = useState("");
  const [shownBody, setShownBody] = useState<{ title: string; body: string } | null>(null);
  /* الرابطُ يُعرض للموظّف بعد الإرسال — كما في الدعوة الآمنة: قناةُ البريد
     قد تتعثّر، ومن يملك الصلاحيّةَ يحتاج نسخةً يسلّمها بيده. ولا يُخزَّن
     الرمزُ في القاعدة، فهذه فرصتُه الوحيدة. */
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  /* العرضُ الذي يُسأل عن تذكيره الأخير — النافذةُ تقول ما سيقع قبل أن يقع */
  const [reminding, setReminding] = useState<ContractRow | null>(null);
  /* ═══ الاعتمادُ ملحوظتُه معه ═══

     الاعتمادُ مطابقةُ اسمٍ بوثيقة، والملحوظةُ محلُّ ما طابقه المعتمِد — أو
     تفويضِه الخطّيِّ إن لم يكن هو المفوَّضَ في السجلّ. فحقلٌ إلى جانب الزرّ
     لا `window.prompt`: نصٌّ يُقرأ بعد سنةٍ لا يُكتب في صندوقٍ بسطر. */
  /* و`asSigned`: فُتح الصندوقُ من «اعتمِدْه كما وقّعه» — فزرُّه يقول إنّه يوقّع الآن */
  const [signOff, setSignOff] = useState<{ id: string; noteAr: string; asSigned?: boolean; likeNew?: boolean } | null>(null);
  /* ونافذةُ «أعِدْها بملاحظات» مستقلّةٌ عن نافذة الاعتماد: قرارانِ متضادّان،
     وحقلٌ واحدٌ لهما يجعل ملاحظةَ الإعادة تُرسَل في خانة مطابقةِ الهويّة. */
  const [sendBack, setSendBack] = useState<{ id: string; notesAr: string } | null>(null);
  /* ونافذةُ «وقِّعْه الآن» لعقدٍ غيرِ مشروطٍ اعتُمد كالعقود الجديدة (٢ أكتوبر ٢٠٢٦):
     مستقلّةٌ عن نافذة الاعتماد — تلك على `signed` وهذه على `signature_approved`،
     وملحوظةُ هذه تُضَمّ إلى خَتمٍ لا إلى مطابقة هويّة. */
  const [sealing, setSealing] = useState<{ id: string; noteAr: string } | null>(null);
  /* والحذفُ لا رجعةَ فيه، فلا يقع بنقرةٍ واحدة — ولا بـ`window.confirm`
     الذي يملك المتصفّحُ كتمَه فيردّ `false` صامتا (رأسُ `ConfirmAction`). */
  const [deleting, setDeleting] = useState<ContractRow | null>(null);
  /* واسمُ التصحيح بعد رفض التوقيع: المدرّبُ لم يقترح شيئا هنا — الموظّفُ
     يقرؤه من وثيقة هويّته التي بين يديه، فيكتبه. */
  const [fixName, setFixName] = useState<{ id: string; nameAr: string } | null>(null);
  const [replying, setReplying] = useState<{ id: string; replyAr: string } | null>(null);
  /* ═══ الإغلاقُ يقول أثرَه قبل أن يقع (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «والنظام يجب أن يحذّرني إذا كان للإلغاء أثر». وكان
     السببُ يُطلَب بـ`window.prompt` بلا رقمٍ ولا سياق: سطرٌ واحدٌ يسأل «لماذا»
     ولا يقول «وهذا ما سيمسّه».

     و`impact === null` ليس صفرا: هو «لم تُقرأ الأرقامُ بعد». فالنافذةُ لا
     تُفتح إلّا بها (`closeWith` تقرأ ثمّ تفتح)، ولو تعثّرت القراءةُ لم
     تُفتَح — فلا يقع إغلاقٌ على أرقامٍ مجهولةٍ تُقرأ صفرا. */
  const [closing, setClosing] = useState<
    { row: ContractRow; mode: "revoke" | "depart"; impact: Impact } | null
  >(null);
  /* ═══ وبقيّةُ `window.prompt` في هذه الشاشة ═══

     بقي منه بابان بعد نافذة الإغلاق، ونصُّهما **يصل المدرّبَ حرفا بحرف**:
     «ما الذي لم يطابق؟» في رفض التوقيع، و«سببُ السحب» في سحب العرض. وحوارُ
     المتصفّح أسوأُ ما يُكتب فيه ما يُقرأ بعد سنة: سطرٌ واحدٌ لا يُنسَّق ولا
     يُراجَع، **ويملك المتصفّحُ كتمَه** — فمن ضغط «امنع هذا الموقع من إظهار
     الحوارات» صار الزرُّ عنده لا يفعل شيئا ولا يقول لماذا (رأسُ
     `ConfirmAction`).

     وحالةٌ واحدةٌ للبابَين لا نافذتان: السؤالُ واحدٌ — سببٌ مكتوبٌ يُشترَط
     ثمّ يُرسَل. والفرقُ في المسار وحدَه، فيُحمَل معه. */
  /* ═══ «حُدّث النصُّ — أعِدْه للتوقيع» (١ أكتوبر ٢٠٢٦) ═══

     بابٌ غيرُ رفض التوقيع: ذاك لعيبٍ في التوقيع، وهذا لتوقيعٍ صحيحٍ تحتَه
     نصٌّ قديم. والعنوانُ والنصُّ يُملآن بمقترَحٍ ثمّ يُحرَّران لكلّ مدرّب. */
  const [resign, setResign] = useState<{
    row: ContractRow; subjectAr: string; bodyAr: string
    /* ═══ وبابان بنافذةٍ واحدة (١ أكتوبر ٢٠٢٦) ═══
       `resign`: موقَّعٌ على نصٍّ قديم يُعاد. و`amendment`: طلبُ تعديلٍ يُقبَل
       فيصل صاحبَه جوابُك وعقدُه المصحَّحُ في رسالةٍ واحدة — أمرُ صاحب المنصّة. */
    mode: "resign" | "amendment"
    /* ═══ وشروطُه إن أُريد تغييرُها (١ أكتوبر ٢٠٢٦) ═══
       تُملأ بما في عقده الموقَّع، فما لم يُمَسّ لا يُرسَل ويُنسَخ كما هو.
       و`available` دوراتُه المؤهَّلُ لها اليوم — تُقرأ من التعبئة عند الفتح. */
    editTerms: boolean
    rate: string; minSeats: string; referralRate: string
    picked: Set<string>
    available: { courseId: string; titleAr: string }[] | null
    specialTermsAr: string
  } | null>(null);
  /* وتحديثُ العروض المفتوحة صامتٌ ما لم يُطلَب البريد — أمرُ صاحب المنصّة
     (١ أكتوبر ٢٠٢٦). ولا قائمةَ تغييرٍ على صفحة المدرّب في الحالَين: البريدُ
     وحدَه يحملها إن طُلب (علّتُه عند `contractByToken`). */
  const [refreshNotify, setRefreshNotify] = useState(false);
  const [asking, setAsking] = useState<{
    titleAr: string; confirmLabelAr: string; labelAr: string;
    whatAr: string; okAr: string; rowId?: string;
    post: (reasonAr: string) => Promise<void>;
  } | null>(null);

  /* ═══ العروضُ في هذه الشاشة لا في شاشةٍ ثالثة ═══

     العرضُ فرعٌ عن عقدٍ نافذ: من يتابع العقودَ يتابع ما بُني عليها، ومن
     فصلهما شاشتين فتح إحداهما ونسي الأخرى. */
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offerOptions, setOfferOptions] = useState<OfferOption[]>([]);
  const [offerFor, setOfferFor] = useState<OfferOption | null>(null);
  const [offerCourseId, setOfferCourseId] = useState("");
  const [offerCohortId, setOfferCohortId] = useState("");
  const [offerFeeAr, setOfferFeeAr] = useState("");
  const [offerNoteAr, setOfferNoteAr] = useState("");
  const [offerSessions, setOfferSessions] = useState("");
  const [offerPrepDays, setOfferPrepDays] = useState(String(COURSE_PREP_DEFAULT_DAYS));
  const [offerResponseDays, setOfferResponseDays] = useState(String(ASSIGNMENT_OFFER_RESPONSE_DAYS));

  /* ═══ شعبُ التعبئة (٢ أكتوبر ٢٠٢٦) ═══
     لا يُختار أحدٌ سلفا: صاحبُ المنصّة يختار واحدا واحدا — أمرُه. */
  const [prep, setPrep] = useState<PrepCandidate[]>([]);
  const [prepPicked, setPrepPicked] = useState<Set<string>>(new Set());
  const [prepTitle, setPrepTitle] = useState("الدفعة الأولى");
  const [prepStartsAt, setPrepStartsAt] = useState("");
  const [prepResult, setPrepResult] = useState<PrepResult | null>(null);

  /* ═══ والقائمتان تُبحثان وتُرقَّمان ═══

     كلتاهما تجمع الناسَ كلَّهم لا واحدا بعينه، فتنمو بنموّ العمل: من أراد
     عقدَ فلانٍ بعد عامٍ مرّره بعينه. والبحثُ بـ`matchesQuery` لا بمطابقةٍ
     حرفيّة — فهي تطبّع الهمزةَ والتاءَ المربوطة، والاسمُ يُكتب بوجهين. */
  const [contractQ, setContractQ] = useState("");
  const [contractPage, setContractPage] = useState(1);
  /* `null` = لم يُختَرْ تبويبٌ بعد، فيُفتَح على أوّل ما فيه عمل. ولا يُحسَب
     الافتراضيُّ في كلّ تصيير: لو حُسب لَقفزت الشاشةُ من تبويبٍ إلى آخرَ
     كلّما اعتُمد عقدٌ تحت يد صاحبها. */
  const [contractTab, setContractTab] = useState<ContractTabId | null>(null);
  const [offerQ, setOfferQ] = useState("");
  const [offerPage, setOfferPage] = useState(1);

  /* ═══ وسمُ الطباعة ═══

     القاعدةُ في `@media print` معلَّقةٌ عليه، فلا تُعدَّل طباعةُ شاشةٍ أخرى
     بشيءٍ منها. ويُرفَع بإغلاق النافذة لا بعد الطباعة: `window.print` تحبس
     الخيطَ في متصفّحاتٍ وتعود فورا في أخرى، فمن رفعه بعدها رفعه قبل أن
     تُرسَم الورقةُ في بعضها. */
  useEffect(() => {
    if (!shownBody) return;
    document.body.setAttribute("data-printing", "contract-body");
    return () => document.body.removeAttribute("data-printing");
  }, [shownBody]);

  /* ═══ السلسلةُ صفٌّ واحدٌ لا ثلاثة (٢٦ سبتمبر ٢٠٢٦) ═══

     «لم أفهم لماذا هذا التكرار؟» — ولم يكن تكرارا: ثلاثةُ أجيالٍ لعقدٍ
     واحد. فيُعرَض **رأسُ السلسلة** صفّا، وتُطوى أجيالُه تحته: القصّةُ
     الواحدةُ تُقرأ واحدةً، وما مضى يبقى مفتوحا لمن أراده.

     والترقيمُ على الرؤوس لا على الصفوف: عشرةُ عقودٍ في الصفحة تعني عشرةَ
     **عقود**، لا عشرةَ أوراقٍ منها ثمانٍ أجيالٌ لعقدَين. */
  const lineage = useMemo(() => readLineage(contracts), [contracts]);

  /* ═══ التبويبُ يقع على رأس السلسلة لا على أجيالها ═══

     الصفُّ في هذه الشاشة **سلسلةٌ** لا عقد: رأسٌ وأجيالٌ مطويّةٌ تحته. فلو
     بُوّب بأيِّ عقدٍ في السلسلة لَظهرت السلسلةُ الواحدةُ في تبويبَين، ولَعُدَّ
     المدرّبُ مرّتين. والرأسُ هو حالُ أمره اليومَ، فهو المقيس. */
  const groups = useMemo(
    () => groupContracts(contracts, (c) => c.profile?.id ?? null),
    [contracts],
  );

  const tabCounts = useMemo(() => {
    const n = {} as Record<ContractTabId, number>;
    for (const t of CONTRACT_TABS) n[t.id] = 0;
    for (const g of groups) {
      n.all += 1;
      for (const t of CONTRACT_TABS) {
        if (t.id !== "all" && inTab(t.id, g.head.status)) n[t.id] += 1;
      }
    }
    return n;
  }, [groups]);

  const activeTab: ContractTabId = contractTab ?? defaultTab((t) => tabCounts[t] ?? 0);

  const contractView = useMemo(() => {
    const hit = (c: ContractRow) => matchesQuery(contractQ, [
      c.number, c.title, c.profile?.application?.fullName, c.profile?.application?.email,
      c.profile?.application?.reference, c.signerLegalName, STATUS_AR[c.status] ?? c.status,
    ]);
    /* والمجموعةُ تُطابق بأيِّ عقدٍ فيها: من بحث باسمٍ وُقّع به في عقدٍ مضى
       يريد ما آل إليه أمرُه، لا «لا نتائج». */
    return paginate(
      groups
        .filter((g) => inTab(activeTab, g.head.status))
        .filter((g) => hit(g.head) || g.past.some(hit)),
      contractPage, 10,
    );
  }, [groups, activeTab, contractQ, contractPage]);

  const offerView = useMemo(() => paginate(
    offers.filter((o) => matchesQuery(offerQ, [
      o.courseTitleAr, o.cohort?.title, o.profile?.application?.fullName,
      o.profile?.application?.email, OFFER_STATUS_AR[o.status] ?? o.status,
    ])),
    offerPage, 10,
  ), [offers, offerQ, offerPage]);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ contracts: ContractRow[]; candidates: CandidateRow[]; missingLegal: string[] }>(
        "/api/admin/trainer-contracts",
      );
      setContracts(d.contracts); setCandidates(d.candidates); setMissingLegal(d.missingLegal);
    } catch (e) { setErr(permissionMessage(e, "تعذّر تحميل العقود")); }
    /* والعروضُ خلف صلاحيّةٍ أخرى (`trainer.assign`): من يملك العقودَ ولا
       يملكها يرى شاشتَه كاملةً بلا قسمِ العروض، لا نصفَ شاشةٍ بخطإٍ أحمر. */
    try {
      const [o, opts] = await Promise.all([
        apiGet<OfferRow[]>("/api/admin/trainer-offers"),
        apiGet<OfferOption[]>("/api/admin/trainer-offers/options"),
      ]);
      setOffers(o); setOfferOptions(opts);
    } catch { setOffers([]); setOfferOptions([]); }
    /* وشعبُ التعبئة خلف صلاحيّتين (الإسنادُ وإدارةُ الشعب) — فمن نقصته
       إحداهما لا يرى البطاقةَ، ولا يرى خطأً مكانَها. */
    try { setPrep(await apiGet<PrepCandidate[]>("/api/admin/trainer-offers/prep")); }
    catch { setPrep([]); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openComposer = async (c: CandidateRow) => {
    setErr(""); setNote(""); setPreview(""); setComposeErr("");
    try {
      const p = await apiGet<Prefill>(`/api/admin/trainer-applications/${c.id}/contract-prefill`);
      setPrefill(p); setOpenFor(c);
      setLegalNameAr(p.legalNameAr);
      setTitle(`اتفاقية تقديم خدمات تدريبية — ${p.legalNameAr}`);
      setPicked(new Set(p.courses.map((x) => x.courseId)));
      setDocs(DEFAULT_REQUIRED_DOCUMENTS);
      setHoursNoteAr(""); setWaivedAr("");
      setSpecialTermsAr(p.lastSpecialTermsAr ?? "");
      /* وتُملأ خاناتُ الأتعاب بالقاعدة القائمة إن كانت — فالموظّفُ يعدّل
         رقما قائما لا يكتبه من فراغٍ فينسى أحدَها. */
      setFeeRate(p.compensation?.rate ?? "");
      setFeeReferralRate(p.compensation?.referralRate ?? "");
      setFeeMinSeats(p.compensation?.minSeats != null ? String(p.compensation.minSeats) : "");
      setOrientationAt(""); setOrientationUrl("");
    } catch (e) { setErr(permissionMessage(e, "تعذّر تجهيز الشاشة")); }
  };

  const composeBody = useMemo(() => {
    const rate = Number(feeRate);
    const referral = feeReferralRate.trim() === "" ? null : Number(feeReferralRate);
    /* ولا تُرسَل قاعدةٌ إلّا إن كُتب سعرٌ صالح: الخانةُ الفارغةُ تعني «اتركِ
       القاعدةَ القائمةَ كما هي»، لا «اجعلها صفرا». */
    const compensation = feeRate.trim() !== "" && Number.isFinite(rate) && rate > 0
      ? {
          type: "per_seat" as const,
          rate,
          minSeats: feeMinSeats.trim() === "" ? undefined : Number(feeMinSeats),
          referralRate: referral !== null && Number.isFinite(referral) && referral > 0 ? referral : null,
        }
      : null;
    return {
      title,
      trainerLegalNameAr: legalNameAr.trim() || null,
      courseIds: [...picked],
      requiredDocuments: docs,
      hoursNoteAr: hoursNoteAr.trim() || null,
      rateWaivedReasonAr: waivedAr.trim() || null,
      compensation,
      orientationAt: orientationAt.trim() === "" ? null : new Date(orientationAt).toISOString(),
      orientationUrl: orientationUrl.trim() || null,
      specialTermsAr: specialTermsAr.trim() || null,
    };
  }, [title, legalNameAr, picked, docs, hoursNoteAr, waivedAr, feeRate, feeReferralRate, feeMinSeats,
      orientationAt, orientationUrl, specialTermsAr]);

  /* ═══ وخطأُ الصفّ يُرسَم في الصفّ (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «عندما أقوم بتوقيع الاتفاقية منّي كأدمن لا يتمّ
     التوقيع ولا يتغيّر شيءٌ بالصفحة». وقد كان الخادمُ يردّ برسالةٍ مفصَّلةٍ
     تقول لماذا — لكنّها تُرسَم في رأس الصفحة، والقائمةُ عشرةُ عقودٍ في كلّ
     صفحة، وموضعُ الضغط قد يكون تحت الرأس بشاشتَين. فمن ضغط لم يرَ شيئا.

     فمن ضغط زرّا في صفٍّ يقرأ جوابَه في ذلك الصفّ. والرأسُ يبقى لما يخصّ
     الصفحةَ كلَّها — تعذُّرُ التحميل، وتركيبُ عقدٍ جديد. */
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);

  /* ═══ وخطأُ المركِّب يُرسَم عند زرّه (٢٧ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «why can't i ركب عقد؟».

     والخادمُ كان يجيبه فعلا — «لهذا المدرّبِ عقدٌ مفتوح»، أو «لا قاعدةَ
     أتعاب»، أو «وثيقةُ هويّةٍ إلزاميّة» — لكنّ الجوابَ يُرسَم في **رأس
     الصفحة**، وزرُّ التركيب في آخر نموذجٍ طويل: عنوانٌ واسمٌ قانونيٌّ ودوراتٌ
     ووثائقُ وأتعابٌ وجلسةٌ وحجمُ عمل. فمن ضغطه لم يرَ شيئا يتغيّر.

     وهو العطبُ نفسُه الذي أُصلح لصفوف العقود في ٢٦ سبتمبر بعد بلاغه «لا يتمّ
     التوقيع ولا يتغيّر شيءٌ بالصفحة» — أُصلح هناك وتُرك هنا. */
  const [composeErr, setComposeErr] = useState("");

  /* و`fn` لها أن تردّ نصَّ نجاحها: فعلٌ واحدٌ يقع أثرُه على وجهَين — يُختَم
     عرضٌ فيُفتح حسابٌ، أو يُوثَّق بندٌ على نشطٍ فلا تُمسّ حالتُه — لا يُقال
     عنه نصٌّ واحدٌ يصدق في إحداهما. وما لم تردّ شيئا فنصُّ `ok`. */
  /* تُفتح النافذةُ بشروطه كما في عقده، ثمّ تُقرأ دوراتُه المؤهَّلُ لها اليوم —
     فإن تعثّرت القراءةُ بقيت دوراتُ عقده وحدَها تُختار منها، ولا تُغلق النافذة. */
  const openResign = async (c: ContractRow, mode: "resign" | "amendment" = "resign", replyAr?: string) => {
    setResign({
      row: c, mode,
      subjectAr: mode === "amendment" ? DEFAULT_AMENDMENT_ACCEPT_SUBJECT_AR : DEFAULT_RESIGN_SUBJECT_AR,
      bodyAr: mode === "amendment"
        ? defaultAmendmentAcceptBodyAr(c.title, replyAr)
        : defaultResignBodyAr(c.title, changeGroupsBetween(c.bodyVersion, CONTRACT_BODY_VERSION, { conditional: c.gatesActivation }).length > 0),
      /* ومن قبِل تعديلا فأغلبُ ظنّه أنّه سيغيّر شرطا — فتُفتح الشروطُ له */
      editTerms: mode === "amendment",
      rate: c.compensationRate ?? "", minSeats: c.compensationMinSeats != null ? String(c.compensationMinSeats) : "",
      referralRate: c.compensationReferralRate ?? "",
      picked: new Set((c.qualifiedSnapshot ?? []).map((q) => q.courseId)),
      available: null,
      specialTermsAr: c.specialTermsAr ?? "",
    });
    const appId = c.profile?.application?.id;
    if (!appId) return;
    try {
      const p = await apiGet<Prefill>(`/api/admin/trainer-applications/${appId}/contract-prefill`);
      setResign((r) => (r && r.row.id === c.id ? { ...r, available: p.courses } : r));
    } catch { /* تبقى دوراتُ عقده وحدَها — والخادمُ يحكم على ما يُختار */ }
  };

  const run = async (fn: () => Promise<void | string>, ok: string, rowId?: string) => {
    setBusy(true); setErr(""); setNote(""); setRowErr(null); setComposeErr("");
    try {
      const said = await fn();
      setNote(typeof said === "string" ? said : ok);
    } catch (e) {
      const text = permissionMessage(e, "تعذّر الإجراء");
      /* وثلاثةُ مواضعَ للرسم لا اثنان: الصفُّ لمن ضغط في صفّ، والمركِّبُ لمن
         ضغط في نموذجه، والرأسُ لما يعمّ الصفحةَ (تعذُّرُ التحميل). */
      if (rowId === COMPOSE_ERR) setComposeErr(text);
      else if (rowId) setRowErr({ id: rowId, text });
      else setErr(text);
    }
    finally { setBusy(false); }
  };

  /** يقرأ أثرَ الإغلاق ثمّ يفتح النافذة — ولا يفتحها إن لم يُقرأ.
   *
   *  ولا `run` هنا: هذه قراءةٌ لا إجراء، و«تمّ» فوق نافذةٍ تسأل «أمتأكّد؟»
   *  تقول إنّ شيئا وقع ولم يقع شيء. */
  const closeWith = async (row: ContractRow, mode: "revoke" | "depart") => {
    setBusy(true); setErr(""); setNote(""); setRowErr(null);
    try {
      setClosing({ row, mode, impact: await apiGet<Impact>(`/api/admin/trainer-contracts/${row.id}/impact`) });
    } catch (e) {
      setRowErr({ id: row.id, text: permissionMessage(e, "تعذّرت قراءةُ أثر الإغلاق — ولا يُغلَق على غير علم") });
    }
    finally { setBusy(false); }
  };

  const toggleDoc = (kind: string, labelAr: string) => {
    setDocs((cur) => cur.some((d) => d.kind === kind)
      ? cur.filter((d) => d.kind !== kind)
      : [...cur, { kind, labelAr, required: true }]);
  };

  /* ═══ طورُ الموادّ على العقد — يُعرض موقَّعا ومعتمَدا معا (٣٠ سبتمبر ٢٠٢٦) ═══

     كان هذا اللوحُ داخلَ كتلة «وقّعه صاحبُه» وحدَها، والمهلةُ في المسار
     الجديد لا تُكتب إلّا **عند الاعتماد** — أي حين يصير العقدُ `countersigned`
     ويخرج من تلك الكتلة. فلم يكن زرُّ «أعِدِ الموادَّ بملاحظات» يُرى قطّ لمن
     يحتاجه، وبقي من أعلن اكتمالَ موادّه معلَّقا. فصار دالّةً تُنادى في الحالين. */
  const conditionBlock = (c: ContractRow) => (
c.gatesActivation
                          && conditionPhase(conditionFactsOf(c)) !== "none"
                          && conditionPhase(conditionFactsOf(c)) !== "met" ? (
                          <Inset className="mt-3 px-4 py-3">
                            <p className="text-read font-black text-foreground">
                              {CONDITION_PHASE_LABELS_AR[conditionPhase(conditionFactsOf(c))]}
                            </p>
                            {c.profile?.id && <MaterialsReview profileId={c.profile.id} />}
                            {c.conditionPausedAt ? (
                              <>
                                <p className="mt-1 text-read leading-6 text-muted-foreground">
                                  أعلن اكتمالَ موادّه في {fmtDateTime(c.conditionPausedAt)}، ومهلتُه
                                  مجمّدةٌ حتّى يصله جوابُك. وبالإعادةِ تُستأنف مضافا إليها مدّةُ
                                  التجميد بالضبط — فوقتُ مراجعتك لا يُحسب عليه.
                                </p>
                                {sendBack?.id === c.id ? (
                                  <div className="mt-3 grid gap-2">
                                    {/* ولا نصٌّ مقترَحٌ يُملأ سلفا: هذا السطرُ يصل المدرّبَ
                                        بحرفه، وعبارةٌ عامّةٌ تُرسَل كما هي توقف حلقةَ
                                        «يعدّل ويقدّم ثانيةً» عند أوّل دورة. فيُعرَض شكلُ
                                        الملاحظة النافعة مثالا لا قيمة. */}
                                    <textarea
                                      className={areaCls} rows={3} maxLength={4000}
                                      placeholder="ما ينقص بعينه — مثال: «ينقص محورُ التقويم في الوحدة الثالثة، ومدّةُ الجلسة الثانية غيرُ مبيّنة»"
                                      value={sendBack.notesAr}
                                      onChange={(e) => setSendBack({ id: c.id, notesAr: e.target.value })}
                                    />
                                    <p className="text-read text-muted-foreground">
                                      يصله هذا النصُّ بحرفه — فاكتبْه له لا لنا.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button tone="confirm" icon={Undo2} loading={busy}
                                        disabled={sendBack.notesAr.trim().length < 5}
                                        onClick={() => void run(async () => {
                                          await apiPost(
                                            `/api/admin/trainer-contracts/${c.id}/return-materials`,
                                            { notesAr: sendBack.notesAr.trim() });
                                          setSendBack(null);
                                          await load();
                                        }, "أُعيدت موادُّه بملاحظاتك — واستأنفت مهلتُه", c.id)}>
                                        أعِدْها وأبلِغْه
                                      </Button>
                                      <Button tone="ghost" onClick={() => setSendBack(null)}>تراجعْ</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button className="mt-3" icon={Undo2}
                                    onClick={() => setSendBack({ id: c.id, notesAr: "" })}>
                                    أعِدِ الموادَّ بملاحظات
                                  </Button>
                                )}
                              </>
                            ) : (
                              /* ولا زرَّ يُعرَض معطَّلا بلا سبب: الموادُّ ليست عندك بعد،
                                 فيُقال ذلك بدل زرٍّ يُنقَر فيُردّ من الخادم. */
                              <p className="mt-1 text-read leading-6 text-muted-foreground">
                                ولم يُعلن اكتمالَ موادّه بعد، فلا شيءَ يُعاد إليه اليوم. وحين
                                يُعلنه تتجمّد مهلتُه ويظهر هنا زرُّ الإعادة بملاحظاتك.
                              </p>
                            )}
                          </Inset>
                        ) : null
  );

  return (
    <AdminLayout title="عقودُ المدرّبين">
      {missingLegal.length > 0 && (
        <Panel tone="warn" className="mb-5 p-4">
          <h2 className="mb-1 font-bold">هويّةُ الأكاديميّة القانونيّة غيرُ مكتملة</h2>
          <p className="text-sm">
            لا يُركَّب عقدٌ بطرفٍ أوّلَ ناقص. الناقص: <b>{missingLegal.join(" · ")}</b>.
            {" "}يُستكمَل في <code>src/data/academy-legal.ts</code>. والمعاينةُ تعمل قبل ذلك.
          </p>
        </Panel>
      )}

      {err && <Panel tone="danger" className="mb-4 p-3 text-sm" role="alert">{err}</Panel>}
      {note && <Panel tone="positive" className="mb-4 p-3 text-sm" role="status">{note}</Panel>}

      {/* ═══ من ينتظر عقدا ═══ */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
          <FileSignature size={18} aria-hidden="true" /> من ينتظر عقدا ({candidates.length})
        </h2>
        {candidates.length === 0
          ? <p className="text-sm opacity-70">لا أحد — كلُّ من قُبل له عقدٌ قائم.</p>
          : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Inset className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span>
                      <b>{c.fullName}</b>
                      <span className="opacity-70"> — {c.reference} · {c.email}</span>
                    </span>
                    <Button size="sm" tone="primary" onClick={() => void openComposer(c)}>
                      أنشئ عقدا
                    </Button>
                  </Inset>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {/* ═══ شاشةُ التركيب ═══ */}
      {openFor && prefill && (
        <Card id="contract-composer" className="mb-6 scroll-mt-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">تركيبُ عقدٍ لـ{prefill.fullName}</h2>
            <Button size="sm" onClick={() => { setOpenFor(null); setPrefill(null); setPreview(""); }}>
              أغلِقْ
            </Button>
          </div>

          <Panel tone={prefill.gatesActivation ? "default" : "warn"} className="mb-4 p-3 text-sm">
            {prefill.gatesActivation
              ? "هذا العقدُ يحبس التفعيل: يُنقل الطلبُ إلى «عقد قيد التوقيع»، ولا يُفتح حسابُه حتّى يُعتمَد توقيعُه."
              : "المدرّبُ نشطٌ أصلا — فهذا العقدُ توثيقٌ على ملفٍّ حيّ، ولا تُمسُّ حالةُ طلبه ولا وصولُه إلى بوّابته."}
          </Panel>

          {/* وما يمنعه يُقال قبل أن تُملأ خانةٌ واحدة — والخادمُ يردّه بالنصّ نفسِه */}
          {prefill.blockedAr && (
            <Panel tone="danger" className="mb-4 p-3 text-read" role="alert">{prefill.blockedAr}</Panel>
          )}

          {/* ═══ واسمُ الطرف الثاني أوّلُ ما يُملأ ═══

              فهو أوّلُ ما يُطابَق بوثيقة الهويّة، وآخرُ ما يُمكن تصحيحُه بلا
              ثمن: ما دخل المتنَ دخل بصمتَه، وتصحيحُه بعد الإرسال عقدٌ بديل. */}
          <label className="mb-1 block text-sm font-bold" htmlFor="legal-name">
            اسمُ الطرف الثاني — كما في وثيقة هويّته
          </label>
          <input id="legal-name" value={legalNameAr} maxLength={120}
            onChange={(e) => setLegalNameAr(e.target.value)}
            className={`${inputCls} w-full`} />
          <p className="mb-4 mt-1 text-read leading-6 text-muted-foreground">
            {prefill.legalNameSource === "account"
              ? "وهذا ما وصلنا من حسابه — وغالبا ليس اسما ثلاثيّا ولا يطابق جوازَه. طابِقْه بوثيقته قبل الإنشاء: ما يُطبَع هنا يصير اسمَ الطرف الثاني في الوثيقة، ويوقّع هو باسمه القانونيّ تحته."
              : "وهذا اسمُه القانونيُّ المثبَّتُ في ملفّه — يُطبَع طرفا ثانيا، ولك تعديلُه إن تغيّرت وثيقتُه."}
          </p>

          <label className="mb-1 block text-sm font-bold" htmlFor="contract-title">عنوانُ العقد</label>
          <input id="contract-title" value={title} onChange={(e) => setTitle(e.target.value)}
            className={`${inputCls} mb-4 w-full`} />

          {/* الأجر — مقروءٌ لا محرَّر */}
          <h3 className="mb-1 text-sm font-bold">الأتعاب (الملحق ب)</h3>
          {prefill.compensation ? (
            <Inset className="mb-4 p-3 text-sm">
              {RULE_TYPE_AR[prefill.compensation.type] ?? prefill.compensation.type}
              {" — "}<b>{prefill.compensation.rate} {prefill.compensation.currency}</b>
              {prefill.compensation.minSeats ? ` · حدٌّ أدنى ${prefill.compensation.minSeats} مقعدا` : ""}
              {prefill.compensation.referralRate ? ` · مقعدُ الإحالة ${prefill.compensation.referralRate}` : ""}
              <span className="block opacity-70">تُضبط من «أتعاب المدربين» — وتُقرأ هنا ولا تُحرَّر.</span>
            </Inset>
          ) : (
            <Panel tone="warn" className="mb-4 p-3 text-sm">
              <p className="mb-2">لا قاعدةَ أتعابٍ لهذا المدرّب. تضبطها الماليّةُ من «أتعاب المدربين»، أو يُكتب سببُ الإرسال بلا أجرٍ متّفقٍ عليه:</p>
              <label className="sr-only" htmlFor="waived">سببُ الإرسال بلا أجر</label>
              <input id="waived" value={waivedAr} onChange={(e) => setWaivedAr(e.target.value)}
                placeholder="يُحدَّد قبل أوّل إسناد باتفاقٍ مكتوب" className={`${inputCls} w-full`} />
            </Panel>
          )}

          {prefill.feeNotes.length > 0 && (
            <Inset className="mb-4 p-3 text-sm">
              <b>ما قيل في المقابلة عن الأجر</b> — استئناسا، ولا يُحتسب منه شيء:
              <ul className="mt-1 list-inside list-disc opacity-80">
                {prefill.feeNotes.map((f, i) => (
                  <li key={i}>{f.reviewerName ?? "قارئ"}: {f.expectation ?? "—"} / {f.proposal ?? "—"}</li>
                ))}
              </ul>
            </Inset>
          )}

          {/* الدورات — الملحق أ */}
          <h3 className="mb-1 text-sm font-bold">الدوراتُ المؤهَّل لها (الملحق أ)</h3>
          {prefill.courses.length === 0 ? (
            <Panel tone="warn" className="mb-4 p-3 text-sm">
              لا دورةَ مؤهَّلٌ لها بعد. يُؤهَّل من «طلبات المدربين» أوّلا، وإلّا خرج الملحقُ (أ) خاليا —
              والبندُ الثاني هو صلبُ هذا العقد.
            </Panel>
          ) : (
            <Inset className="mb-4 p-3">
              <ul className="space-y-1 text-sm">
                {prefill.courses.map((c) => (
                  <li key={c.courseId}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={picked.has(c.courseId)}
                        onChange={() => setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(c.courseId)) n.delete(c.courseId); else n.add(c.courseId);
                          return n;
                        })} />
                      <span>{c.titleAr}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-read opacity-70">
                إدراجُ الدورة تأهيلٌ لا إسناد — والبندُ 2-3 يقول ذلك صراحةً للمدرّب.
              </p>
            </Inset>
          )}

          {/* الوثائق — الملحق ج */}
          <h3 className="mb-1 text-sm font-bold">الوثائقُ المطلوبةُ منه (الملحق ج)</h3>
          <Inset className="mb-4 p-3">
            <ul className="space-y-1 text-sm">
              {CONTRACT_DOCUMENT_KINDS.map((k) => (
                <li key={k.key}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={docs.some((d) => d.kind === k.key)}
                      onChange={() => toggleDoc(k.key, k.labelAr)} />
                    <span>
                      {k.labelAr}
                      <span className="block text-xs opacity-60">{k.hintAr}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-read opacity-70">
              وثيقةُ هويّةٍ واحدةٌ على الأقلّ — البند 15 يُقرّ باسمه القانونيّ، ولا إقرارَ بلا ما يقابله.
            </p>
          </Inset>

          {/* ═══ الأتعاب — تُضبَط هنا ثمّ يُركَّب العقد ═══ */}
          <Inset className="mb-4">
            <h4 className="mb-1 font-black">الأتعاب</h4>
            <p className="mb-3 text-read opacity-70">
              تُضبَط هنا ثمّ يُركَّب العقد — فلا شاشةَ ثانية. والكتابةُ تمرّ
              بمسلك قاعدة الأتعاب نفسِه، فيبقى كاتبُ القاعدة واحدا. واتركِ
              الخاناتِ كما هي إن لم ترد تغييرَ القاعدة القائمة.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">سعرُ المقعد عبر رابطه</span>
                <input inputMode="decimal" value={feeReferralRate}
                  onChange={(e) => setFeeReferralRate(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="45" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">سعرُ المقعد العامّ</span>
                <input inputMode="decimal" value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="30" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">الحدُّ الأدنى للمقاعد</span>
                <input inputMode="numeric" value={feeMinSeats}
                  onChange={(e) => setFeeMinSeats(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="8" />
              </label>
            </div>
          </Inset>

          {/* ═══ جلسةُ التهيئة — ومنها تبدأ المهلة ═══ */}
          <Inset className="mb-4">
            <h4 className="mb-1 font-black">جلسةُ التهيئة</h4>
            <p className="mb-3 text-read opacity-70">
              ومن تاريخها تبدأ مهلتُه: سبعةُ أيّام. واتركْه فارغا إن لم يُعرَف
              بعد — فيُرسَل العرضُ بلا مهلة، ولا يوسمه العاملُ متأخّرا، ويُكتب
              التاريخُ لاحقا فيصله خبرُه وتبدأ.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">تاريخُها ووقتُها</span>
                <input type="datetime-local" value={orientationAt}
                  onChange={(e) => setOrientationAt(e.target.value)}
                  className={`${areaCls} w-full`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">رابطُ الحضور</span>
                <input type="url" value={orientationUrl}
                  onChange={(e) => setOrientationUrl(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="https://" dir="ltr" />
              </label>
            </div>
          </Inset>

          <label className="mb-1 block text-sm font-bold" htmlFor="hours-note">
            حجمُ العمل المتوقَّع — استرشاديٌّ لا يُحتسب (اختياريّ)
          </label>
          <textarea id="hours-note" value={hoursNoteAr} onChange={(e) => setHoursNoteAr(e.target.value)}
            rows={2} className={`${areaCls} mb-4 w-full`}
            placeholder="مثلا: نحو 20 ساعة تدريبيّة في الفصل، بحسب ما يُسنَد" />

          {/* ═══ البند 21 — بنودٌ خاصّةٌ بهذا المدرّب (١ أكتوبر ٢٠٢٦) ═══

              مُلزِمةٌ لا استرشاديّة، وتُقدَّم على البنود العامّة فيما تخالفها
              فيه — إلّا المال: قرارُ صاحب المنصّة، وعلّتُه أنّ المنصّةَ تحسب
              المستحقّاتِ من خانات الأتعاب أعلاه لا من هذا النصّ. فيُقال ذلك
              هنا قبل الكتابة، لا يُكتشف بعد كشفٍ يخالف العقد. */}
          <label className="mb-1 block text-sm font-bold" htmlFor="special-terms">
            بنودٌ خاصّةٌ بهذا المدرّب — مُلزِمة (البند 21، اختياريّ)
          </label>
          <p className="mb-1 text-read leading-6 opacity-75">
            سطرٌ لكلّ بند. تُقدَّم على البنود العامّة فيما تخالفها فيه — <b>إلّا المال</b>:
            الأتعابُ والحدُّ الأدنى يُضبطان من خاناتهما أعلاه، فمنها تُحسب المستحقّات لا من هذا النصّ.
          </p>
          <textarea id="special-terms" value={specialTermsAr}
            onChange={(e) => setSpecialTermsAr(e.target.value)}
            rows={4} maxLength={SPECIAL_TERMS_MAX_CHARS} className={`${areaCls} mb-4 w-full`}
            placeholder="مثلا: يقدّم المدرّبُ دوراتِه بالإنجليزيّة عند طلب الأكاديميّة" />

          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" icon={FileText} loading={busy}
              onClick={() => void run(async () => {
                const r = await apiPost<{ bodyAr: string }>(
                  `/api/admin/trainer-applications/${prefill.applicationId}/contract-preview`, composeBody);
                setPreview(r.bodyAr);
              }, "عُرضت المعاينة", COMPOSE_ERR)}>
              عايِنِ المتنَ كما يراه
            </Button>
            <Button tone="confirm" icon={FileSignature} loading={busy}
              disabled={title.trim().length < 3 || Boolean(prefill.blockedAr)}
              onClick={() => void run(async () => {
                await apiPost(`/api/admin/trainer-applications/${prefill.applicationId}/contracts/compose`, composeBody);
                setOpenFor(null); setPrefill(null); setPreview("");
                await load();
              }, "أُنشئ العقدُ وجُمّد نصُّه", COMPOSE_ERR)}>
              أنشئ وجمّدِ النصّ
            </Button>
          </div>

          {composeErr && (
            <Panel tone="danger" className="mt-3 p-3 text-read" role="alert">{composeErr}</Panel>
          )}

          {preview && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-bold">المعاينة</h3>
              {/* وتُراجَع بالشكل الذي تُوقَّع به — فلا يُجاز متنٌ رآه الموظّفُ
                  في صورةٍ غيرِ التي يراها المدرّبُ قبل أن يوقّع. */}
              <div dir="rtl" className="max-h-[28rem] overflow-auto rounded-lg">
                <ContractDocument doc={parseContractDoc(preview)} />
              </div>
            </section>
          )}
        </Card>
      )}

      {/* ═══ العقودُ المركَّبة ═══ */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">العقود ({contracts.length})</h2>
          <div className="flex items-center gap-2">
            {/* ═══ ونصُّ العروض المفتوحة يلحق الإصدارَ الحاليَّ (٣٠ سبتمبر ٢٠٢٦) ═══

                أمرُ صاحب المنصّة: من أراد أن يصل الناسَ نصٌّ محدَّثٌ كان عليه أن
                يُلغيَ عقودَهم ويركّب غيرَها فيصلهم رابطٌ جديدٌ ورسالةُ إلغاء.
                فصار النصُّ يُحدَّث في مكانه: الرابطُ هو هو، وتصلهم رسالةٌ تقول
                ما تغيّر نقاطا إن أُشّرت خانةُ البريد (١ أكتوبر ٢٠٢٦) — ولا شريطَ
                على صفحتهم في الحالَين.

                وزرٌّ واحدٌ لا لعقدٍ بعينه: الغرضُ أن يلحق الجميعَ، ولو كان لكلّ
                عقدٍ زرُّه لَنُسي منهم واحد. */}
            <Button size="sm" tone="confirm" icon={FileText}
              onClick={() => void run(async () => {
                const r = await apiPost<{ updated: number; skipped: number }>(
                  "/api/admin/trainer-contracts/refresh-bodies", { notify: refreshNotify });
                await load();
                return r.updated === 0
                  ? "لا عرضَ يحتاج تحديثا — كلُّها على الإصدار الحاليّ"
                  : refreshNotify
                    ? `حُدّث نصُّ ${r.updated} عرضا، ووصل أصحابَها ما تغيّر`
                    : `حُدّث نصُّ ${r.updated} عرضا بلا بريد — ويقرأ كلٌّ منهم الجديدَ كاملا قبل أن يوقّع`;
              }, "حُدّثت العروضُ المفتوحة")}>
              حدِّثْ نصَّ العروض المفتوحة
            </Button>
            <label className="flex items-center gap-1.5 text-fine font-bold text-muted-foreground">
              <input type="checkbox" checked={refreshNotify}
                onChange={(e) => setRefreshNotify(e.target.checked)} />
              وأبلغْهم بالبريد
            </label>
            <Button size="sm" icon={RefreshCw} onClick={() => void load()}>حدِّثْ</Button>
          </div>
        </div>
        {/* ═══ التبويبُ بما يُنتظَر لا بالحالة الخام ═══

            أمرُ صاحب المنصّة: «مكركبه.. اجعلها تابات او ابني فلتر». والتبويبُ
            بالعمل لا بالحالة: من يفتح هذه الشاشةَ يسأل «ما الذي عليّ أن
            أفعله؟» لا «كم حالةً عندي». و«ينتظرك» أوّلُها لأنّ فيها إنسانا
            ينتظر ختمَنا أو جوابَنا، وكان يضيع بين أربعةٍ وعشرين صفّا.

            واللسانُ من `TabBar` لا مكتوبٌ في مكانه: فيه وقفةٌ واحدةٌ للشريط
            كلِّه وتنقّلٌ بالأسهم يعكس في العربيّة، وأدوارُ `tablist` صريحة —
            وكتابتُه بيدي كانت تُسقط ذلك كلَّه، وأمسكها `staff-surface`. */}
        {contracts.length > 0 && (
          <TabBar
            className="mb-3"
            ariaLabel="أطوارُ العقود"
            value={activeTab}
            onChange={(t) => { setContractTab(t); setContractPage(1); }}
            items={CONTRACT_TABS.map((t) => ({
              id: t.id,
              /* والعددُ في اللسان: الخاليةُ تُعرَض بصفرها ولا تُخفى — فغيابُ
                 اللسان يُقرأ «لا وجودَ لهذا الطور»، ووجودُه بصفرٍ يقول «لا
                 شيءَ فيه الآن»، وهما خبران مختلفان. */
              label: (
                <>
                  {t.labelAr}
                  <span className="ms-1.5 text-xs opacity-70">{tabCounts[t.id] ?? 0}</span>
                </>
              ),
            }))} />
        )}
        {contracts.length > 0 && (
          <ListToolbar q={contractQ} onQ={setContractQ} onPage={setContractPage}
            view={contractView} unit="مدرّبا"
            placeholder="ابحث باسم المدرّب أو بريده أو مرجعه أو حالة عقده…" />
        )}
        {contracts.length === 0
          ? <p className="text-sm opacity-70">لا عقودَ بعد.</p>
          : contractView.rows.length === 0
            /* ═══ والفراغُ يقول سببَه ═══
               «لا عقدَ يطابق بحثَك» كذبٌ على من لم يبحث وإنّما فتح تبويبا
               خاليا — فيظنّ بحثا عالقا ويمسح صندوقا فارغا. */
            ? <p className="text-sm opacity-70">
                {contractQ.trim()
                  ? "لا عقدَ يطابق بحثَك في هذا التبويب."
                  : CONTRACT_TABS.find((t) => t.id === activeTab)?.emptyAr ?? "لا عقدَ هنا."}
              </p>
            : (
            <ul className="space-y-2">
              {contractView.rows.map((g) => {
                const c = g.head;
                /* الرأسُ المغلَقُ يقول ما بعده — والحكمُ في `recontractFor` */
                const next = recontractFor(c, candidates);
                return (
                <li key={c.id}>
                  <Inset className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{docNameOf(c)}</b>
                        {/* ورقمُه بجوار اسمه — المدرّبُ يسأل به، ويُبحث به فوق */}
                        {" "}<span dir="ltr" className="text-sm opacity-80">{c.number}</span>
                        <span className="opacity-70">
                          {" "}— {STATUS_AR[c.status] ?? c.status}
                          {/* وبلا رمز الإصدار (١ أكتوبر ٢٠٢٦): «no need» — والمفيدُ منه
                              أحاضرٌ نصُّه أم سابق، فذاك ما يقرّر إعادةَ التوقيع */}
                          {c.bodyVersion
                            ? c.bodyVersion === CONTRACT_BODY_VERSION ? " · على النصّ الحاضر" : " · على نصٍّ سابق"
                            : " · بلا نصّ (البابُ القديم)"}
                          {" · "}{fmtDateTime(c.createdAt)}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {c.status === "draft" && c.bodyHash && (
                          <Button size="sm" tone="confirm" icon={Send}
                            onClick={() => void run(async () => {
                              const r = await apiPost<{ signingUrl: string }>(
                                `/api/admin/trainer-contracts/${c.id}/send`, {});
                              setLink({ id: c.id, url: r.signingUrl });
                              await load();
                            }, "أُرسل العقدُ — والرابطُ أدناه")}>
                            أرسِلْه للتوقيع
                          </Button>
                        )}
                        {c.status === "sent" && (
                          <Button size="sm" icon={RefreshCw}
                            onClick={() => void run(async () => {
                              const r = await apiPost<{ signingUrl: string }>(
                                `/api/admin/trainer-contracts/${c.id}/resend`, {});
                              setLink({ id: c.id, url: r.signingUrl });
                              await load();
                            }, "جُدِّد الرابطُ — والقديمُ بطل")}>
                            جدِّدِ الرابط
                          </Button>
                        )}
                        {/* ═══ والتذكيرُ الأخير — مرّةً واحدة (١ أكتوبر ٢٠٢٦) ═══

                            طلبُ صاحب المنصّة: «زرٌّ يذكّر المدرّبَ آخرَ مرّةٍ بتوقيع
                            الاتفاقيّة، والعقدُ صالحٌ ثلاثةَ أيّام». ويغيب بعد أن يُرسَل:
                            «أخيرٌ» يُرسَل مرّتين يكذّب أوّلَه — والخادمُ يردّ الثاني
                            أيضا. وتحته سطرٌ يقول متى أُرسل وإلى متى العرضُ صالح. */}
                        {c.status === "sent" && !c.finalReminderAt && (
                          <Button size="sm" icon={BellRing} onClick={() => setReminding(c)}>
                            تذكيرٌ أخير — {daysWindowAr(FINAL_REMINDER_DAYS)}
                          </Button>
                        )}
                        {c.bodyHash && (
                          <Button size="sm" icon={FileText}
                            onClick={() => void run(async () => {
                              const full = await apiGet<{ bodyAr: string | null }>(`/api/admin/trainer-contracts/${c.id}/body`);
                              setShownBody({ title: c.title, body: full.bodyAr ?? "" });
                            }, "عُرض النصّ")}>
                            المتن
                          </Button>
                        )}
                        {/* والموقوفُ على طلب تعديلٍ يُلغى أيضا: هو الطريقُ إلى
                            «أُلغي وأُرسل مصحَّحا» — وهو أحدُ الجوابَين المكتوبَين في الخادم. */}
                        {(c.status === "draft" || c.status === "sent" || c.status === "amendment_requested") && (
                          <Button size="sm" tone="danger" icon={Ban} loading={busy}
                            onClick={() => void closeWith(c, "revoke")}>
                            ألغِ
                          </Button>
                        )}
                        {/* ═══ والنافذُ يُفسَخ من صفّه — بالطريق المحروس (٢٦ سبتمبر ٢٠٢٦) ═══

                            كان الزرُّ الوحيدُ على النافذ هو «اعتمِدْ»، وهو مضغوطٌ
                            أصلا: فلا مخرجَ من عقدٍ نافذٍ في هذه الشاشة أبدا. ومن
                            أراد إنهاءَه ذهب إلى شاشةِ الرحيل إن عرفها.

                            والزرُّ يمشي في `trainer-departures` لا في مسارٍ ثانٍ
                            يفسخ العقدَ وحدَه: الرحيلُ يفسخ العقدَ **ويفتح صفّا
                            لكلّ متعلّمٍ ويسحب العروضَ المعلَّقة**. ومن فسخ العقدَ
                            وحدَه ترك شعبا بلا مدرّبٍ وعروضا تنتظر جوابَ راحل. */}
                        {/* ═══ ولا يُقال «تعاقد» عمّا لم نوقّعه (١ أكتوبر ٢٠٢٦) ═══
                            العرضُ الذي اعتُمد توقيعُه ولم نوقّعه ليس عقدا نافذا
                            يُفسَخ: يُنهى عرضا بالطريق نفسِه، ويُسمّى باسمه. */}
                        {(c.status === "countersigned" || c.status === "signature_approved") && c.profile?.id && (
                          <Button size="sm" tone="danger" icon={UserMinus} loading={busy}
                            onClick={() => void closeWith(c, "depart")}>
                            {c.status === "countersigned" ? "أنهِ تعاقدَه" : "أنهِ العرض"}
                          </Button>
                        )}
                        {/* ═══ وعلى الرأس المغلَق عقدٌ جديد (٣٠ سبتمبر ٢٠٢٦) ═══

                            سأل صاحبُ المنصّة عند العقد المفسوخ: «ألا يمكن إعادةُ
                            إنشاء عقدٍ آخرَ لهم؟». وكان يمكن — من «من ينتظر عقدا»
                            في رأس الشاشة، بعيدا عن الصفّ الذي سأل عنده. فالبابُ
                            هنا أيضا، والمركِّبُ نفسُه. ومن لا يُركَّب له بعدُ يُقال
                            له المخرجُ مكانَ الزرّ، لا صمت. */}
                        {next && "compose" in next && (
                          <Button size="sm" tone="confirm" icon={FilePlus2} loading={busy}
                            onClick={() => void openComposer(next.compose).then(() => requestAnimationFrame(
                              () => document.getElementById("contract-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            ))}>
                            ركّبْ له عقدا جديدا
                          </Button>
                        )}
                        {next && "blockedAr" in next && (
                          <span className="self-center text-xs opacity-70">{next.blockedAr}</span>
                        )}
                        {/* ═══ الحذف — وما مسَّه توقيعٌ لا زرَّ له، ويُقال لماذا ═══

                            والشرطُ **هو** `isUntouchableContract` لا صورةٌ منه: كان
                            منسوخا هنا بقائمةِ حالاتٍ مكتوبةٍ باليد، ونسختان من حكمٍ
                            تفترقان يوما فيُخفي أحدُهما زرّا يسمح به الآخر. والحكمُ
                            في الخادم كما كان: هذا يمنع زرّا يُرَدّ، وذاك يمنع الفعلَ
                            نفسَه. ومن اكتفى بإخفاء الزرّ حذف بـ`curl`.

                            وغيابُ الزرّ صامتا هو ما شكا منه صاحبُ المنصّة (٢٦
                            سبتمبر ٢٠٢٦): «العقد الملغى لم يظهر لي زرّ تحميل أو
                            حذف». والملغى الذي كان بين يديه **موقَّعا** رُفض
                            توقيعُه — فالمنعُ صوابٌ والصمتُ خطأ. فيُقال السببُ
                            وتُذكر النسخةُ التي يملكها بدلَه. */}
                        {isUntouchableContract(c)
                          ? (
                            <span className="self-center text-xs opacity-70">
                              مسَّه توقيعٌ — فلا يُحذَف، وتُطبَع نسختُه وتُنزَّل
                            </span>
                          )
                          : (
                            <Button size="sm" tone="danger" icon={Trash2}
                              onClick={() => setDeleting(c)}>
                              احذِفْ
                            </Button>
                          )}
                      </span>
                    </div>
                    {/* ═══ الاسمان معا — وما وراء التنبيه ═══

                        `differs` لا تقول «مزوَّر»: تقول إنّ ثَمَّ ما يُنظَر فيه.
                        والنظرُ مقابلةُ وثيقة الهويّة بعين الموظّف — ولذلك يُذكَر
                        المخرجُ معه: من كان الموقَّعُ به هو الصحيحَ رَدَّ التوقيعَ،
                        فيُركَّب بديلٌ باسمه. */}
                    {nameMatch(namesOf(c)) !== "unsigned" && (
                      <Panel tone={nameMatch(namesOf(c)) === "differs" ? "warn" : "positive"}
                        className="mt-2 p-2 text-read leading-6">
                        <span className="opacity-70">في الوثيقة:</span> <b>{docNameOf(c)}</b>
                        <span className="opacity-40">{"  ×  "}</span>
                        <span className="opacity-70">وقّع به:</span> <b>{c.signerLegalName ?? "—"}</b>
                        {nameMatch(namesOf(c)) !== "differs"
                          ? <span className="opacity-70">{" — مطابق"}</span>
                          : isClosed(c)
                            ? (
                              /* وعقدٌ أُغلق لا توقيعَ فيه يُردّ: تبقى المقابلةُ
                                 سجلّا يُقرأ بعد سنة، ويسقط الأمرُ الذي معها. */
                              <span className="block opacity-80">
                                الاسمان مختلفان — وهذا العقدُ مغلَقٌ فلا إجراءَ عليه. يبقى
                                الفرقُ مكتوبا هنا لمن يسأل عنه بعدُ.
                              </span>
                            )
                            : (
                              <span className="block opacity-80">
                                الاسمان مختلفان — قابِلْهما بوثيقة هويّته قبل الاعتماد. فإن كان
                                الموقَّعُ به هو الصحيحَ فاردُدِ التوقيعَ، ويُركَّب بديلٌ باسمه.
                              </span>
                            )}
                      </Panel>
                    )}
                    {c.status === "sent" && c.finalReminderAt && (
                      <p className="mt-1 text-read opacity-80">
                        أُرسل التذكيرُ الأخيرُ {fmtDateTime(c.finalReminderAt)}
                        {c.tokenExpiresAt && (new Date(c.tokenExpiresAt).getTime() > Date.now()
                          ? ` — والعرضُ صالحٌ حتّى ${fmtDateTime(c.tokenExpiresAt)}`
                          : ` — وانقضى أجلُه ${fmtDateTime(c.tokenExpiresAt)} فسقط العرض؛ وجدِّدِ الرابطَ إن أردتَ مهلةً أخرى`)}
                      </p>
                    )}
                    {link?.id === c.id && (
                      <Panel tone="positive" className="mt-2 p-2">
                        <p className="mb-1 text-read">رابطُ التوقيع — انسخْه الآن، فلا يُعرض ثانية:</p>
                        <code className="block break-all">{link.url}</code>
                      </Panel>
                    )}
                    {/* ═══ ورفضُ التوقيع وعدٌ يُوفى بنقرة (٢٦ سبتمبر ٢٠٢٦) ═══

                        بريدُ الرفض يقول لصاحبه: «ويصلك عقدٌ جديدٌ برابطٍ جديدٍ
                        بعد تصحيحه». وكان لا يُنشأ شيء: الصفُّ يُغلَق، ورمزُه
                        ميّتٌ منذ التوقيع، ولا صفَّ مسودّةٍ ينتظر. فمن رُفض
                        توقيعُه يبقى بلا بابٍ إلى الأبد، والوعدُ مكتوبٌ في
                        بريده. فهذا هو البابُ الذي وُعد به. */}
                    {c.status === "revoked" && (c.revokeReasonAr ?? "").startsWith("رُفض التوقيع") && (
                      <Panel tone="warn" className="mt-2 p-3">
                        <p className="mb-1 font-black">رُفض توقيعُه — ووُعِد بعقدٍ مصحَّح</p>
                        <p className="text-read leading-6 opacity-80">
                          وقّع باسم <b>{c.signerLegalName ?? "—"}</b>، والوثيقةُ تسمّيه{" "}
                          <b>{docNameOf(c)}</b>. اكتبِ اسمَه كما في
                          وثيقة هويّته، فيُركَّب بديلٌ به ويُرسَل إليه برابطٍ جديد — وبنودُه
                          وأتعابُه كما هي.
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">{rowErr.text}</Panel>
                        )}
                        <div className="mt-3 grid gap-2">
                          <input
                            className={inputCls} maxLength={120}
                            placeholder="الاسمُ الكاملُ كما في الهويّة أو جواز السفر"
                            value={fixName?.id === c.id ? fixName.nameAr : ""}
                            onChange={(e) => setFixName({ id: c.id, nameAr: e.target.value })}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button tone="confirm" icon={FilePlus2} loading={busy}
                              disabled={(fixName?.id !== c.id) || fixName.nameAr.trim().length < 4}
                              onClick={() => void run(async () => {
                                await apiPost(`/api/admin/trainer-contracts/${c.id}/name-reissue`,
                                  { legalNameAr: fixName!.nameAr.trim() });
                                setFixName(null);
                                await load();
                              }, "أُنشئ العقدُ البديلُ بالاسم الصحيح، ووصله برابطٍ جديد", c.id)}>
                              صحّحِ الاسمَ وأعِدْ إرساله
                            </Button>
                          </div>
                        </div>
                      </Panel>
                    )}
                    {c.revokeReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الإلغاء: {c.revokeReasonAr}</p>
                    )}
                    {c.declineReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الاعتذار: {c.declineReasonAr}</p>
                    )}

                    {/* ═══ طلبُ التعديل — يُقرأ ويُجاب ═══

                        كان يصل ويُحفَظ ويُشعِر، ولا شيءَ يردّه: فيرى الموظّفُ
                        الحالةَ وحدَها ولا يدري ما المطلوب، فيقف العقدُ أبدا.

                        والجوابان مكتوبان في الخادم منذ كُتِب: إمّا يُرَدّ عليه فيبقى
                        العرضُ، وإمّا يُلغى ويُرسَل مصحَّحا (زرُّ «ألغِ» أعلاه). */}
                    {/* ═══ تصحيحُ الاسم جوابُه نقرةٌ لا صندوقُ نصّ (٢٦ سبتمبر ٢٠٢٦) ═══

                        الوقوفُ واحدٌ في الحالة، والجوابُ مختلف: طلبُ التعديل
                        يُجاب بنعم أو لا، وتصحيحُ الاسم لا يُجاب إلّا بفعلٍ —
                        وثيقةٌ تسمّي غيرَه لا تُوقَّع، ولا رأيَ لنا في اسمه.
                        فيُعرَض ما قاله وزرٌّ واحدٌ يُنفّذه. */}
                    {c.status === "amendment_requested" && c.nameCorrectionAr && (
                      <Panel tone="warn" className="mt-2 p-3">
                        <p className="mb-1 font-black">يقول إنّ اسمَه في هويّته غيرُ المكتوب — والتوقيعُ واقف</p>
                        {c.nameCorrectionAt && (
                          <p className="text-read opacity-70">{fmtDateTime(c.nameCorrectionAt)}</p>
                        )}
                        <p className="mt-2 leading-7">
                          المكتوبُ في الوثيقة: <b>{docNameOf(c)}</b>
                          {" · "}وما يقوله هو: <b>{c.nameCorrectionAr}</b>
                        </p>
                        <p className="mt-2 text-read leading-6 opacity-80">
                          طابِقْه بوثيقة هويّته، ثمّ أعِدْ بنقرةٍ: يُلغى هذا العرضُ ويُركَّب
                          بديلٌ باسمه الصحيح ويُرسَل إليه برابطٍ جديد — وبنودُه وأتعابُه
                          كما هي، لا يتغيّر إلّا الاسم. ويُحفَظ في ملفّه فلا يُسأل عنه ثانية.
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">{rowErr.text}</Panel>
                        )}
                        <Button className="mt-3" tone="confirm" icon={FilePlus2} loading={busy}
                          onClick={() => void run(async () => {
                            await apiPost(`/api/admin/trainer-contracts/${c.id}/name-reissue`, {});
                            await load();
                          }, "أُعيد العقدُ مصحَّحا باسمه، ووصلَه برابطٍ جديد", c.id)}>
                          طابقتُ هويّتَه — أعِدْه مصحَّحا
                        </Button>
                      </Panel>
                    )}

                    {c.status === "amendment_requested" && !c.nameCorrectionAr && (
                      <Panel tone="warn" className="mt-2 p-3">
                        <p className="mb-1 font-black">طلب تعديلا — والتوقيعُ واقفٌ حتّى تجيبَه</p>
                        {c.amendmentRequestedAt && (
                          <p className="text-read opacity-70">{fmtDateTime(c.amendmentRequestedAt)}</p>
                        )}
                        <p className="mt-2 whitespace-pre-wrap leading-7">{c.amendmentRequestAr}</p>
                        {/* ═══ والجوابانِ يُقالان هنا لا في تعليقٍ يقرؤه المبرمج ═══

                            الجوابُ الثاني مبنيٌّ وزرُّه قائمٌ (زرُّ «ألغِ» في صفّ
                            الأفعال أعلاه)، وتعليقُ الشيفرة يشير إليه — **والموظّفُ
                            لا يقرأ التعليقات**. فمن قرأ الطلبَ في هذا اللوح رأى
                            جوابا واحدا، وهو المصيدةُ نفسُها التي وُجدت في إعادة
                            الموادّ: قرارٌ مبنيٌّ لا يُرى عند موضع القرار.

                            ولا يُكرَّر زرُّ الإلغاء هنا: فعلٌ لا رجعةَ فيه لا
                            يُنسَخ في موضعَين من شاشةٍ واحدة. فيُسمّى ويُدَلّ عليه. */}
                        <p className="mt-3 text-read leading-6 opacity-80">
                          جوابان: <b>يبقى العرضُ كما هو</b> فيصله ردُّك برابطٍ جديدٍ ليوقّعه أو
                          يعتذر؛ أو <b>تقبل تعديلَه</b> فتضبط شروطَه وتكتب جوابَك، ويصله ردُّك
                          وعقدُه المصحَّحُ برابطه في رسالةٍ واحدة. وفي الحالين يصله جوابُك
                          بحرفه. ولا يُعدَّل نصُّ عرضٍ أُرسل: هو مجمَّدٌ مهشَّش،
                          فالتصحيحُ عرضٌ جديدٌ لا كتابةٌ فوق القائم — يُغلَق هذا ويُرسَل غيرُه برقمٍ جديد.
                        </p>
                        {replying?.id === c.id ? (
                          <div className="mt-3">
                            <textarea
                              value={replying.replyAr}
                              onChange={(e) => setReplying({ id: c.id, replyAr: e.target.value })}
                              rows={3}
                              placeholder="ردُّك — يقرؤه وهو أمام زرّ التوقيع"
                              className={`${areaCls} w-full`}
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button size="sm" tone="confirm" icon={MessageSquareReply}
                                disabled={replying.replyAr.trim().length < 5}
                                /* ═══ والرابطُ الجديدُ لا يُهدَر ═══

                                   الردُّ يسكّ رمزا جديدا، و`tokenHash` عمودٌ فريدٌ
                                   يُكتب فوقَ القديم — **فرابطُ المدرّب القديمُ
                                   يموت في هذه اللحظة**. والخادمُ يُعيد الجديدَ
                                   للموظّف لعلّةٍ مكتوبةٍ في رأسه: «فقناةُ البريد
                                   قد تتعثّر، ومن يملك الصلاحيّةَ يحتاج نسخةً
                                   يسلّمها بيده».

                                   وكان هذا الموضعُ **يُهمله** — خلافا لـ«أرسِلْه»
                                   و«جدِّدِ الرابط» وكلاهما يعرضه. فإن تعثّر البريدُ
                                   هنا مات رابطُ المدرّب ولا نسخةَ عند أحد، ولا شيءَ
                                   يقول للموظّف إنّ الرابطَ تبدّل أصلا. */
                                onClick={() => void run(async () => {
                                  const r = await apiPost<{ signingUrl: string }>(
                                    `/api/admin/trainer-contracts/${c.id}/amendment-reply`,
                                    { replyAr: replying.replyAr.trim() });
                                  setLink({ id: c.id, url: r.signingUrl });
                                  setReplying(null);
                                  await load();
                                }, "وصلَه جوابُك — وجُدِّد رابطُ التوقيع، والقديمُ بطل", c.id)}>
                                أرسِلْ الردّ — يبقى العرضُ كما هو
                              </Button>
                              {/* ═══ والجوابُ الثاني صار زرّا يُرى (٢٦ سبتمبر ٢٠٢٦) ═══

                                  بلاغُ صاحب المنصّة: «لا يوجد زرٌّ لهذا الأمر». ثمّ
                                  (١ أكتوبر ٢٠٢٦): «محمّد لم يستلم شيئا» — فالزرُّ كان
                                  يُغلق ويَعِد بعقدٍ يُنشأ باليد. فصار يفتح نافذةَ
                                  العقد المصحَّح، وما كُتب هنا يُنقل إليها. */}
                              <Button size="sm" tone="confirm" icon={FilePlus2}
                                onClick={() => { const t = replying.replyAr; setReplying(null); void openResign(c, "amendment", t); }}>
                                قبِلتُ التعديل — أرسِلْ عقدا مصحَّحا
                              </Button>
                              <Button size="sm" tone="ghost" onClick={() => setReplying(null)}>صرفُ النظر</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" tone="confirm" icon={MessageSquareReply}
                              onClick={() => setReplying({ id: c.id, replyAr: "" })}>
                              رُدَّ عليه — يبقى العرضُ كما هو
                            </Button>
                            <Button size="sm" tone="confirm" icon={FilePlus2}
                              onClick={() => void openResign(c, "amendment")}>
                              قبِلتُ التعديل — أرسِلْ عقدا مصحَّحا
                            </Button>
                          </div>
                        )}
                      </Panel>
                    )}
                    {c.amendmentReplyAr && c.status !== "amendment_requested" && (
                      <p className="mt-1 text-read opacity-70">
                        ردُّنا على طلب التعديل: {c.amendmentReplyAr}
                      </p>
                    )}

                    {/* ═══ وقّعه صاحبُه — والاعتمادُ مطابقةُ اسمٍ بوثيقة ═══

                        فالوثائقُ تُفتح هنا قبل الزرّ، لا يُضغط الزرُّ على ثقة.
                        ورابطُ كلٍّ منها موقَّتٌ لعشر دقائق، وكلُّ فتحةٍ تُكتب
                        في الأثر باسم من فتح. */}
                    {c.status === "signed" && (
                      <Panel tone="warn" className="mt-3 p-3">
                        <p className="text-read leading-7">
                          وقّع باسم <b>{c.signerLegalName ?? "—"}</b>
                          {c.signedAt ? ` بتاريخ ${fmtDateTime(c.signedAt)}` : ""}. طابِقِ الاسمَ
                          بوثيقة هويّته قبل الاعتماد —
                          {/* وما يقع بالاعتماد يُقال بحكم `signatureApprovalOf` نفسِه
                              (١ أكتوبر ٢٠٢٦): كانت «فبالاعتماد ينفذ العقدُ» للبابَين،
                              والعرضُ المشروطُ لا ينفذ إلّا يومَ تُعتمَد دوراتُه. */}
                          {APPROVAL_LINE_AR[signatureApprovalOf(c)]}.
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">
                            {rowErr.text}
                          </Panel>
                        )}
                        {c.documents.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {c.documents.map((d) => (
                              <Button key={d.id} size="sm" icon={IdCard}
                                onClick={() => void run(async () => {
                                  const r = await apiGet<{ url: string }>(
                                    `/api/admin/trainer-contracts/${c.id}/documents/${d.id}/url`);
                                  window.open(r.url, "_blank", "noopener,noreferrer");
                                }, "فُتحت الوثيقة — والفتحةُ مكتوبةٌ في الأثر")}>
                                {CONTRACT_DOCUMENT_KINDS.find((k) => k.key === d.kind)?.labelAr ?? d.kind}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-read opacity-70">لا وثيقةَ مرفوعةٌ مع هذا العقد.</p>
                        )}

                        {/* ═══ والقرارُ الثالث: «أعِدِ الموادَّ بملاحظات» ═══

                            كان للموظّف على العرض الموقَّع جوابانِ يبلغهما:
                            **اعتمِدْ**، أو **ارفضِ التوقيع**. والثاني عن
                            مطابقة الهويّة لا عن الموادّ — فمن رأى موادَّ
                            ناقصةً لم يجد ما يقوله.

                            و`returnMaterialsWithNotes` مبنيّةٌ منذ بُني الطورُ
                            المشروط، ولها مسارٌ محروس: تستأنف المهلةَ مضافا
                            إليها **مدّةُ التجميد بالضبط**، وتُرسل ملاحظاتَه
                            إليه نصّا، وتكتب فعلَها في الأثر. ولا شاشةَ كانت
                            تنادِيها.

                            والعاملان يتخطّيان المجمَّد، فلا تذكيرَ ولا وسمَ
                            تأخّر. فمن جمّد موادَّه بقي معلَّقا أبدا — ولا
                            مخرجَ إلّا اعتمادُ ما لم يُعتمَد، أو إلغاءُ عقدٍ
                            وقّعه. وهذا هو المخرجُ الثالثُ الصحيح. */}
                        {conditionBlock(c)}

                        {signOff?.id === c.id ? (
                          <div className="mt-3 grid gap-2">
                            <textarea
                              className={areaCls} rows={2} maxLength={500}
                              placeholder="ما طابقتَه بالوثيقة — أو تفويضُك الخطّيُّ إن لم تكن المفوَّضَ في السجلّ"
                              value={signOff.noteAr}
                              onChange={(e) => setSignOff({ ...signOff, noteAr: e.target.value })}
                            />
                            {signOff.asSigned && (
                              <p className="text-read leading-6"><b>تنبيه:</b> {ACCEPT_AS_SIGNED_AR}</p>
                            )}
                            {/* وأثرُ «كالعقود الجديدة» بحكم الصفّ: على نصٍّ سابقٍ يقول نصُّه
                                غيرَه، وعلى غيرِ المشروط لا يخالف نصَّه (٢ أكتوبر ٢٠٢٦) */}
                            {signOff.likeNew && (
                              <p className="text-read leading-6">
                                <b>تنبيه:</b> {signatureApprovalOf(c) === "seal" ? LIKE_NEW_PLAIN_AR : LIKE_NEW_AR}
                              </p>
                            )}
                            {!signOff.likeNew && !signOff.asSigned && signatureApprovalOf(c) === "seal" && (
                              <p className="text-read leading-6"><b>تنبيه:</b> {SEAL_NOW_AR}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button tone="confirm" icon={BadgeCheck} loading={busy}
                                /* ═══ وما يفعله الزرُّ يقوله (١ أكتوبر ٢٠٢٦) ═══

                                   كان «اعتمِدْ وفعِّلْ»، ويختم العرضَ المشروطَ عنّا في
                                   اللحظة نفسِها — فسأل صاحبُ المنصّة: «هل هذا معناه أنّنا
                                   وقّعنا مع المدرّب؟». وصار للعرض المشروط يعتمد التوقيعَ
                                   ويفتح البوّابةَ ولا يوقّع، ولغير المشروط يوقّع عنّا —
                                   والحكمُ `signatureApprovalOf` يقرؤه الخادمُ وهذا الزرّ.

                                   وما ينقص من تجهيزه يردّه الخادمُ برسالةٍ تعدّده —
                                   وتُرسَم في هذا الصفّ لا في رأس الصفحة (`rowErr`). */
                                onClick={() => void run(async () => {
                                  const asSigned = signOff.asSigned === true;
                                  const likeNew = signOff.likeNew === true;
                                  const plain = signatureApprovalOf(c) === "seal";
                                  const r = await apiPost<{ readiness?: Readiness; sealed?: boolean }>(
                                    `/api/admin/trainer-contracts/${c.id}/countersign`,
                                    {
                                      noteAr: signOff.noteAr.trim() || null,
                                      ...(asSigned ? { asSigned: true } : {}),
                                      ...(likeNew ? { likeNew: true } : {}),
                                    });
                                  setSignOff(null);
                                  await load();
                                  const left = r.readiness?.blockersAr ?? [];
                                  if (asSigned) return "اعتُمد كما وقّعه: وقّعناه عن الأكاديميّة فنفَذ، وفُتحت بوّابتُه وبدأت مهلةُ موادّه";
                                  /* وغيرُ المشروط لا بوّابةَ تُفتح له ولا مهلة — نشطٌ أصلا */
                                  if (likeNew && plain) return "اعتُمد كالعقود الجديدة: لم نوقّعه — وقِّعْه من صفّه حين تعتمد دوراتِه";
                                  if (likeNew) return "اعتُمد كالعقود الجديدة: فُتحت بوّابتُه وبدأت مهلةُ موادّه — ونوقّعه حين تعتمد دوراتِه";
                                  return !r.sealed
                                    ? "اعتُمد توقيعُه وفُتحت بوّابتُه — ولم نوقّع العرض: نوقّعه حين تعتمد دوراتِه"
                                    : left.length === 0
                                      ? "وُقّع العقدُ عنّا ونفَذ — ولم تُمسّ حالتُه، فهو نشطٌ أصلا"
                                      : `وُقّع العقدُ عنّا ونفَذ. وبقي قبل اعتماده مدرّبا: ${left.join(" · ")}`;
                                }, "اعتُمد التوقيع", c.id)}>
                                {signOff.asSigned
                                  ? "اعتمِدْه كما وقّعه — ونوقّعه الآن"
                                  : signOff.likeNew
                                    ? "اعتمِدْه كالعقود الجديدة — ولا نوقّع الآن"
                                    : signatureApprovalOf(c) === "seal" ? "اعتمِدْ ووقِّعْ عن الأكاديميّة" : "اعتمِدِ التوقيعَ وافتحْ بوّابتَه"}
                              </Button>
                              <Button tone="ghost" onClick={() => setSignOff(null)}>تراجعْ</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {/* ═══ ولا يُعرَض زرُّ الختم قبل أن تُعرَض الموادّ (٢٦ سبتمبر ٢٠٢٦) ═══

                                الخادمُ يمنع (`materialsGateProblemAr` في `decide`)، وهذا
                                يمنع زرّا يُرَدّ — والحكمُ **واحدٌ يُستدعى** لا نسختان.
                                ومن عرض زرّا يردّه الخادمُ علّم الموظّفَ ألّا يثق بما يرى.

                                والسببُ يُقال مكانَه: «لم يُعلنْ اكتمالَ موادّه — وأمامه
                                خمسةُ أيّام» أنفعُ من زرٍّ رماديٍّ بلا تفسير. */}
                            {c.gatesActivation && materialsGateProblemAr(conditionFactsOf(c))
                              ? (
                                <Panel tone="warn" className="w-full p-2 text-read leading-6">
                                  <b>لا يُختَم بعد:</b>{" "}
                                  {materialsGateProblemAr(conditionFactsOf(c))}
                                  <span className="block opacity-80">
                                    فطورُ الموادِّ هو ما بُني له العرضُ المشروط — ويُختَم حين
                                    تصير موادُّه بين يديك، لا قبلها.
                                  </span>
                                </Panel>
                              )
                              /* ═══ وعرضٌ وُقّع على نصٍّ يجعل الاعتمادَ توقيعا ═══
                                  وُقّع على v12–v23 («فتوقع من جهتها ويصير العقد نافذا»):
                                  اعتمادُه بنصّه توقيعٌ منّا الآن. فيُعرض ما تغيّر والخياراتُ
                                  كلُّها، ويختار المعتمِد (`SignedEarlierText`). */
                              : signatureApprovalOf(c) === "sealed_by_text"
                                ? (
                                  <>
                                    <SignedEarlierText c={c} />
                                    <Button tone="confirm" icon={BadgeCheck}
                                      onClick={() => setSignOff({ id: c.id, noteAr: "", likeNew: true })}>
                                      طابقتُ الاسمَ — اعتمِدْه كالعقود الجديدة
                                    </Button>
                                    <Button tone="secondary" icon={BadgeCheck}
                                      onClick={() => setSignOff({ id: c.id, noteAr: "", asSigned: true })}>
                                      طابقتُ الاسمَ — اعتمِدْه كما وقّعه
                                    </Button>
                                  </>
                                )
                                /* ═══ وعقدٌ غيرُ مشروط: «كالعقود الجديدة» أوّلا (٢ أكتوبر ٢٠٢٦) ═══
                                    كان زرُّه «اعتمِدْ ووقِّعْ» وحدَه — فالاعتمادُ خَتمٌ لا محالة.
                                    فصار له الخياران وأثرُ كلٍّ (`PlainContractChoices`): الأوّلُ
                                    يعتمد التوقيعَ ولا يوقّع، والثاني يوقّع الآن كما كان. */
                                : signatureApprovalOf(c) === "seal"
                                  ? (
                                    <>
                                      <PlainContractChoices />
                                      <Button tone="confirm" icon={BadgeCheck}
                                        onClick={() => setSignOff({ id: c.id, noteAr: "", likeNew: true })}>
                                        طابقتُ الاسمَ — اعتمِدْه كالعقود الجديدة
                                      </Button>
                                      <Button tone="secondary" icon={BadgeCheck}
                                        onClick={() => setSignOff({ id: c.id, noteAr: "" })}>
                                        طابقتُ الاسمَ — اعتمِدْ ووقِّعْ الآن
                                      </Button>
                                    </>
                                  )
                                  : (
                                    <Button tone="confirm" icon={BadgeCheck}
                                      onClick={() => setSignOff({ id: c.id, noteAr: "" })}>
                                      طابقتُ الاسمَ — اعتمِدِ التوقيع
                                    </Button>
                                  )}
                            {/* ورفضُ التوقيع يُغلق العقدَ ولا يمحو دليلَه: من وقّع
                                باسمٍ غيرِ اسمه وقّع وثيقةً تسمّي طرفا آخر، ولا
                                تُصحَّح تسميةُ طرفٍ بتعديل حقل — يُركَّب عقدٌ جديد. */}
                            <Button tone="danger" icon={X}
                              onClick={() => setAsking({
                                titleAr: `رفضُ توقيعِ «${c.title}»`,
                                confirmLabelAr: "ارفضِ التوقيعَ وأبلغْه",
                                labelAr: "ما الذي لم يطابق؟ — يصل صاحبَه بنصّه",
                                whatAr: "يُغلَق هذا العقدُ ولا يُحذَف: دليلُ توقيعه يبقى. ويصل المدرّبَ ما لم"
                                  + " يطابق ووعدٌ بعقدٍ مصحَّحٍ برابطٍ جديد — ويُوفى بنقرةٍ من صفّه بعد ذلك."
                                  + " وتُعاد مهمّةُ التوقيع في قائمته إلى «لم تُنجَز».",
                                okAr: "رُفض التوقيعُ ووصل صاحبَه",
                                rowId: c.id,
                                post: (reasonAr) =>
                                  apiPost(`/api/admin/trainer-contracts/${c.id}/reject-signature`, { reasonAr }),
                              })}>
                              لم يطابق — ارفضْ
                            </Button>
                            {/* وتوقيعٌ صحيحٌ على نصٍّ قديم بابُه هذا لا الرفض: بريدُ
                                الرفض يقول له «لم نستطع اعتمادَ توقيعك» ولا عيبَ فيه. */}
                            <Button tone="confirm" icon={RefreshCw}
                              onClick={() => void openResign(c)}>
                              حُدّث النصُّ — أعِدْه للتوقيع
                            </Button>
                          </div>
                        )}
                      </Panel>
                    )}

                    {(c.status === "countersigned" || c.status === "signature_approved") && c.gatesActivation && conditionBlock(c)}
                    {c.status === "signature_approved" && c.gatesActivation && (
                      <p className="mt-1 text-read opacity-70">
                        اعتُمد توقيعُه {c.signatureApprovedAt ? fmtDateTime(c.signatureApprovedAt) : ""} وفُتحت بوّابتُه
                        — ولم نوقّعه بعد: نوقّعه حين تعتمد دوراتِه
                        {c.signatureApprovalNoteAr ? ` · ${c.signatureApprovalNoteAr}` : ""}
                      </p>
                    )}
                    {/* ═══ وغيرُ المشروط المعتمَدُ كالعقود الجديدة: يُوقَّع من صفّه (٢ أكتوبر ٢٠٢٦) ═══

                        العرضُ المشروطُ يُختَم باعتماده النهائيّ مع نشر حسابه. وهذا صاحبُه نشطٌ
                        أصلا — لا اعتمادَ نهائيّا يُنادى له. فلو لم يكن زرُّه هنا لبقي بلا
                        توقيعنا أبدا، وبريدُه وعده به. وموادُّ دوراته تُفتح فوقه: «نوقّعه يومَ
                        تعتمد دوراتِه» — فتُقرأ قبل أن يُضغط. والتوقيعُ لا رجعةَ فيه، فنافذةٌ
                        تقول أثرَه قبلَه (`SEAL_NOW_AR`)، كما قيل قبل الاعتماد. */}
                    {c.status === "signature_approved" && !c.gatesActivation && (
                      <Panel tone="warn" className="mt-3 p-3">
                        <p className="text-read leading-7">
                          اعتُمد توقيعُه {c.signatureApprovedAt ? fmtDateTime(c.signatureApprovedAt) : ""} كالعقود
                          الجديدة — ولم نوقّعه بعد، فلا ينفذ حتّى نوقّعه. وقِّعْه حين تعتمد دوراتِه.
                          {c.signatureApprovalNoteAr ? ` · ${c.signatureApprovalNoteAr}` : ""}
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">
                            {rowErr.text}
                          </Panel>
                        )}
                        {c.profile?.id && <MaterialsReview profileId={c.profile.id} />}
                        {sealing?.id === c.id ? (
                          <div className="mt-3 grid gap-2">
                            <textarea
                              className={areaCls} rows={2} maxLength={500}
                              placeholder="ملحوظةٌ تُكتب مع توقيعنا — مثال: «اعتُمدت دوراتُه بعد مراجعة موادّها» (اختياريّة)"
                              value={sealing.noteAr}
                              onChange={(e) => setSealing({ ...sealing, noteAr: e.target.value })}
                            />
                            <p className="text-read leading-6"><b>تنبيه:</b> {SEAL_NOW_AR}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button tone="confirm" icon={BadgeCheck} loading={busy}
                                onClick={() => void run(async () => {
                                  await apiPost(`/api/admin/trainer-contracts/${c.id}/seal`,
                                    { noteAr: sealing.noteAr.trim() || null });
                                  setSealing(null);
                                  await load();
                                }, "وُقّع العقدُ عنّا ونفَذ — ووصلته رسالةٌ بذلك، ولم تُمسّ حالتُه", c.id)}>
                                وقِّعْه الآن عن الأكاديميّة
                              </Button>
                              <Button tone="ghost" onClick={() => setSealing(null)}>تراجعْ</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button tone="confirm" icon={BadgeCheck}
                              onClick={() => setSealing({ id: c.id, noteAr: "" })}>
                              اعتمدتُ دوراتِه — وقِّعْه الآن
                            </Button>
                          </div>
                        )}
                      </Panel>
                    )}
                    {c.status === "countersigned" && (
                      <p className="mt-1 text-read opacity-70">
                        وُقّع عن الأكاديميّة {c.countersignedAt ? fmtDateTime(c.countersignedAt) : ""}
                        {c.academySignatoryName ? ` — ${c.academySignatoryName}` : ""}
                        {c.academySignatoryTitle ? ` (${c.academySignatoryTitle})` : ""}
                        {c.countersignNoteAr ? ` · ${c.countersignNoteAr}` : ""}
                      </p>
                    )}
                    {/* ═══ الملحق (أ) يُطوى — قرارُ صاحب المنصّة (٢٤ سبتمبر) ═══

                        كان الصفُّ يسكب عناوينَ الدورات كلَّها — أربعًا وثلاثين عنوانا
                        في عقدٍ واحد — فتصير القائمةُ جدارا لا تُميَّز فيه عقدةٌ من عقدة.
                        والعددُ هو ما يُقرأ في قائمة، والعناوينُ تُطلب لمن أرادها. */}
                    {c.qualifiedSnapshot && c.qualifiedSnapshot.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-read opacity-70 hover:opacity-100">
                          الملحق (أ): {countAr(c.qualifiedSnapshot.length, ANNEX_A_FORMS)}
                        </summary>
                        <p className="mt-1 text-read leading-6 opacity-70">
                          {c.qualifiedSnapshot.map((q) => q.titleAr).join(" · ")}
                        </p>
                      </details>
                    )}
                  </Inset>
                  {/* ═══ وما مضى يُطوى تحت الحيّ (٢٦ سبتمبر ٢٠٢٦) ═══

                      «لم أفهم لماذا هذا التكرار؟» — وكانت الصفوفُ الثلاثةُ
                      عقدا واحدا في ثلاثة أجيال، مصفوفةً بلا رابطٍ يُرى.

                      والمطويُّ يُعرَض **مختصَرا**: اسمٌ وحالةٌ وتاريخٌ ومتنٌ
                      يُطبَع ويُنزَّل. ولا زرَّ قرارٍ فيه — لا لأنّ الشاشةَ
                      تخفيه، بل لأنّ عقدا مضى لا يُتَّخذ فيه قرار. وهذا وحدَه
                      يُغلق بابا كان مفتوحا: صفُّ من رُفض توقيعُه كان يعرض
                      «صحّحِ الاسمَ وأعِدْ إرساله» وقد أُرسل البديلُ فعلا —
                      فمن ضغطه ثانيةً ركّب جيلا رابعا وأبطل رابطَ الثالث. */}
                  {g.past.length > 0 && (
                    <details className="mt-1 ps-3 text-read">
                      <summary className="cursor-pointer opacity-70">
                        عقودٌ سابقةٌ لهذا المدرّب ({g.past.length}) — مضت، وهذا ما آل إليه أمرُه
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {g.past.map((p) => (
                          <li key={p.id}>
                            <Inset className="p-3 opacity-80">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  <b>{docNameOf(p)}</b>
                                  {" "}<span dir="ltr" className="text-sm opacity-80">{p.number}</span>
                                  <span className="opacity-70">
                                    {" "}— {STATUS_AR[p.status] ?? p.status}
                                    {/* والجيلُ لا يُقال إلّا حيث سُجّل الأبُ فعلا
                                        — وعقودُ ما قبل المرحلة الثالثة بلا أبٍ
                                        مكتوب، فلا يُلفَّق لها واحد. */}
                                    {lineage.get(p.id)?.generation && lineage.get(p.id)!.generation > 1
                                      ? ` · الجيل ${lineage.get(p.id)!.generation}`
                                      : ""}
                                    {" · "}{fmtDateTime(p.createdAt)}
                                  </span>
                                </span>
                                {p.bodyHash && (
                                  <Button size="sm" icon={FileText}
                                    onClick={() => void run(async () => {
                                      const full = await apiGet<{ bodyAr: string | null }>(
                                        `/api/admin/trainer-contracts/${p.id}/body`);
                                      setShownBody({ title: p.title, body: full.bodyAr ?? "" });
                                    }, "عُرض النصّ")}>
                                    المتن
                                  </Button>
                                )}
                              </div>
                              {nameMatch(namesOf(p)) === "differs" && (
                                <p className="mt-1 opacity-70">
                                  في الوثيقة: <b>{docNameOf(p)}</b>{"  ×  "}
                                  وقّع به: <b>{p.signerLegalName ?? "—"}</b> — اختلفا
                                </p>
                              )}
                              {p.revokeReasonAr && (
                                <p className="mt-1 opacity-70">سببُ إغلاقه: {p.revokeReasonAr}</p>
                              )}
                            </Inset>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
                );
              })}
            </ul>
          )}
      </Card>

      {/* ═══════════ جهّز شعبَ التعبئة (٢ أكتوبر ٢٠٢٦) ═══════════

          التأهيلُ وحدَه لا يصنع شعبة، والمدرّبُ لا يعبّئ محتوى دورته إلّا في
          شعبةٍ قبِلها. فهذه تجمع الخطوتين — إنشاءَ الشعبة مسوّدةً وعرضَها عليه —
          لما يُختار هنا واحدا واحدا. العلّةُ عند `prepCandidates`. */}
      {(prep.length > 0 || prepResult) && (
        <Card className="mt-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">جهّز شعبَ التعبئة ({countAr(prep.reduce((n, p) => n + p.courses.length, 0), PREP_FORMS)})</h2>
            {prep.length > 0 && (
              <Button size="sm" tone="ghost" onClick={() => setPrepPicked((s) => {
                const all = prep.flatMap((p) => p.courses.map((c) => prepKey(p.profileId, c.courseId)));
                return s.size === all.length ? new Set() : new Set(all);
              })}>
                {prepPicked.size > 0 && prepPicked.size === prep.reduce((n, p) => n + p.courses.length, 0) ? "ألغِ اختيارَ الكلّ" : "اختر الكلّ"}
              </Button>
            )}
          </div>

          <p className="mb-3 text-read leading-7 opacity-70">
            مدرّبون مؤهَّلون لدوراتٍ ليس لهم فيها شعبةٌ يعبّئون محتواها. ضع علامةً على من تريد؛
            فيُنشأ لكلٍّ منهم شعبةٌ <b>مسوّدةٌ لا تظهر للناس ولا يُسجَّل فيها</b>، ويصله عرضُها
            يقبله أو يعتذر عنه. ومن قبِل وجدها في «شعبي» وعبّأ فيها. وفتحُ الشعبة للتسجيل قرارٌ
            منفصلٌ في صفحة الشعب.
          </p>

          {prep.length > 0 && (
            <ul className="mb-3 space-y-2">
              {prep.map((p) => (
                <li key={p.profileId}>
                  <Inset className="p-3">
                    <p className="mb-1 text-read"><b>{p.fullName}</b> <span className="opacity-70">— {p.reference}</span></p>
                    <ul className="space-y-1">
                      {p.courses.map((c) => {
                        const k = prepKey(p.profileId, c.courseId);
                        return (
                          <li key={k}>
                            <label className="flex items-center gap-2 text-read">
                              <input type="checkbox" checked={prepPicked.has(k)}
                                onChange={() => setPrepPicked((s) => {
                                  const n = new Set(s);
                                  if (n.has(k)) n.delete(k); else n.add(k);
                                  return n;
                                })} />
                              <span>{c.titleAr}</span>
                              {c.acceptedWithoutCohort && (
                                <span className="text-sm opacity-70">— قبِل عرضا بلا شعبة، فلا يجد ما يعبّئه</span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </Inset>
                </li>
              ))}
            </ul>
          )}

          {prep.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-read">
                <span className="font-bold">اسمُ الشعبة — لكلّ ما تختار</span>
                <input className={inputCls} maxLength={120} value={prepTitle}
                  onChange={(e) => setPrepTitle(e.target.value)} />
              </label>
              <label className="grid gap-1 text-read">
                <span className="font-bold">تاريخُ البدء — لا يلزم، ويُضبط لاحقا</span>
                <input type="date" className={inputCls} value={prepStartsAt}
                  onChange={(e) => setPrepStartsAt(e.target.value)} />
              </label>
            </div>
          )}

          {prep.length > 0 && (
            <div className="mt-3">
              <Button tone="confirm" icon={Handshake} loading={busy}
                disabled={prepPicked.size === 0 || prepTitle.trim().length < 3}
                onClick={() => void run(async () => {
                  const r = await apiPost<PrepResult>("/api/admin/trainer-offers/prep", {
                    items: [...prepPicked].map((k) => {
                      const [profileId, courseId] = k.split("|");
                      return { profileId, courseId };
                    }),
                    titleAr: prepTitle.trim(),
                    startsAt: prepStartsAt || null,
                  });
                  setPrepResult(r); setPrepPicked(new Set());
                  await load();
                  return r.failed
                    ? `جُهّز منها ${countAr(r.done, COHORT_FORMS)}، وتعذّر ${countAr(r.failed, COHORT_FORMS)} — أسبابُها في البطاقة`
                    : `جُهّزت ${countAr(r.done, COHORT_FORMS)}، وأُرسل لكلّ مدرّبٍ عرضُها`;
                }, "")}>
                أنشئ الشعب واعرضها ({prepPicked.size})
              </Button>
            </div>
          )}

          {prepResult && prepResult.failed > 0 && (
            <Inset className="mt-3 p-3">
              <p className="mb-1 font-bold">ما تعذّر:</p>
              <ul className="space-y-1 text-read">
                {prepResult.results.filter((r) => !r.ok).map((r) => (
                  <li key={prepKey(r.profileId, r.courseId)}>
                    {offerOptions.find((o) => o.profileId === r.profileId)?.fullName ?? "مدرّب"}
                    {" — "}{offerOptions.flatMap((o) => o.courses).find((c) => c.courseId === r.courseId)?.titleAr ?? r.courseId}
                    {": "}{r.errorAr}
                  </li>
                ))}
              </ul>
            </Inset>
          )}
        </Card>
      )}

      {/* ═══════════ عروضُ الإسناد ═══════════

          «ويحقّ للإدارة إسنادُ دورةٍ واحدةٍ أو لا دورةَ أو كافّةَ الدورات
          لهذا الشخص، لكي لا يُلزِمَنا في عقدٍ ثابت». فالتأهيلُ في الملحق (أ)
          بابٌ لا التزام، والعرضُ هو ما يُفتح منه — ويُقبَل أو يُردّ. */}
      {offerOptions.length > 0 && (
        <Card className="mt-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">عروضُ الإسناد ({offers.length})</h2>
            {offerFor && <Button size="sm" tone="ghost" onClick={() => setOfferFor(null)}>أغلِقِ النموذج</Button>}
          </div>

          <p className="mb-3 text-read leading-7 opacity-70">
            العرضُ دعوةٌ لا توجيه: يقبلها المدرّبُ أو يعتذر عنها، ولا يُكتب
            إسنادٌ ولا يُنشَر اسمُه ولا يدخل كشفَ مستحقّاتٍ قبل قبوله. ومهلةُ
            الردّ {ASSIGNMENT_OFFER_RESPONSE_DAYS} أيّام، وأجلُ الإعداد بعد
            القبول {COURSE_PREP_DEFAULT_DAYS} أيّام ({COURSE_PREP_MIN_DAYS} حدّا أدنى).
          </p>

          {!offerFor && (
            <div className="flex flex-wrap gap-2">
              {offerOptions.map((o) => (
                <Button key={o.profileId} size="sm" icon={Handshake}
                  onClick={() => {
                    setOfferFor(o); setOfferCourseId(""); setOfferCohortId("");
                    setOfferFeeAr(""); setOfferNoteAr(""); setOfferSessions("");
                    setOfferPrepDays(String(COURSE_PREP_DEFAULT_DAYS));
                    setOfferResponseDays(String(ASSIGNMENT_OFFER_RESPONSE_DAYS));
                  }}>
                  {o.fullName}{o.contract ? "" : " (بلا عقدٍ نافذ)"}
                </Button>
              ))}
            </div>
          )}

          {offerFor && (
            <Inset className="grid gap-3 p-3">
              <p className="text-read">
                <b>{offerFor.fullName}</b> — {offerFor.reference}
                {offerFor.contract
                  ? ` · عقدُه النافذ: ${offerFor.contract.title}`
                  : " · لا عقدَ نافذٌ في القاعدة (مدرّبٌ سبق هذه المرحلة)"}
              </p>

              <label className="grid gap-1 text-read">
                <span className="font-bold">الدورةُ — من مؤهّلاته وحدها</span>
                <select className={inputCls} value={offerCourseId}
                  onChange={(e) => { setOfferCourseId(e.target.value); setOfferCohortId(""); }}>
                  <option value="">اختر دورة…</option>
                  {offerFor.courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.titleAr}
                      {c.alreadyOpen ? " — عرضٌ مفتوحٌ عنده" : c.alreadyAccepted ? " — قبِلها" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {offerCourseId && (
                <label className="grid gap-1 text-read">
                  {/* والشعبةُ لازمة (٢ أكتوبر ٢٠٢٦): عرضٌ بلا شعبةٍ يقبله المدرّبُ
                      فلا يجد في «شعبي» ما يعبّئه. ومن لم يجد شعبةً أنشأها في
                      «جهّز شعبَ التعبئة» أعلاه، أو في صفحة الشعب. */}
                  <span className="font-bold">الشعبة — فيها يعبّئ محتوى دورته</span>
                  <select className={inputCls} value={offerCohortId}
                    onChange={(e) => setOfferCohortId(e.target.value)}>
                    <option value="">اختر شعبة…</option>
                    {(offerFor.courses.find((c) => c.courseId === offerCourseId)?.cohorts ?? []).map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title}{h.startsAt ? ` — ${fmtDateTime(h.startsAt)}` : ""}
                        {h.mine ? " (هو مدرّبُها)" : h.hasLead ? " (لها قائدٌ)" : ""}
                      </option>
                    ))}
                  </select>
                  {(offerFor.courses.find((c) => c.courseId === offerCourseId)?.cohorts ?? []).length === 0 && (
                    <span className="text-sm opacity-80">
                      لا شعبةَ لهذه الدورة بعد — أنشئها من «جهّز شعبَ التعبئة» أعلاه (تُنشأ وتُعرَض عليه
                      معا)، أو من صفحة «الشعب» ثمّ عُد إلى هنا.
                    </span>
                  )}
                </label>
              )}

              <label className="grid gap-1 text-read">
                <span className="font-bold">الأجرُ نصّا — يقرؤه إنسان</span>
                <input className={inputCls} maxLength={500} value={offerFeeAr}
                  placeholder="مثلا: ٢٥ دولارا لكلّ متعلّم، وبحدٍّ أدنى ٨ مقاعد"
                  onChange={(e) => setOfferFeeAr(e.target.value)} />
              </label>

              <label className="grid gap-1 text-read">
                <span className="font-bold">ملحوظةٌ له — لا تلزم</span>
                <textarea className={areaCls} rows={2} maxLength={1000} value={offerNoteAr}
                  onChange={(e) => setOfferNoteAr(e.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-read">
                  <span className="font-bold">عددُ الجلسات</span>
                  <input className={inputCls} inputMode="numeric" value={offerSessions}
                    onChange={(e) => setOfferSessions(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="grid gap-1 text-read">
                  <span className="font-bold">مهلةُ الردّ (أيّام)</span>
                  <input className={inputCls} inputMode="numeric" value={offerResponseDays}
                    onChange={(e) => setOfferResponseDays(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="grid gap-1 text-read">
                  <span className="font-bold">أجلُ الإعداد (أيّام)</span>
                  <input className={inputCls} inputMode="numeric" value={offerPrepDays}
                    onChange={(e) => setOfferPrepDays(e.target.value.replace(/\D/g, ""))} />
                </label>
              </div>

              <div>
                <Button tone="confirm" icon={Handshake} loading={busy} disabled={!offerCourseId || !offerCohortId}
                  onClick={() => void run(async () => {
                    await apiPost("/api/admin/trainer-offers", {
                      profileId: offerFor.profileId,
                      courseId: offerCourseId,
                      cohortId: offerCohortId,
                      sessionsCount: offerSessions ? Number(offerSessions) : null,
                      feeNoteAr: offerFeeAr.trim() || null,
                      noteAr: offerNoteAr.trim() || null,
                      prepDays: offerPrepDays ? Number(offerPrepDays) : null,
                      responseDays: offerResponseDays ? Number(offerResponseDays) : null,
                    });
                    setOfferFor(null);
                    await load();
                  }, "أُرسل العرضُ — وينتظر جوابَه")}>
                  اعرِضْها عليه
                </Button>
              </div>
            </Inset>
          )}

          {offers.length > 0 && (
            <div className="mt-4">
              <ListToolbar q={offerQ} onQ={setOfferQ} onPage={setOfferPage}
                view={offerView} unit="عرضا"
                placeholder="ابحث باسم المدرّب أو دورته أو شعبته أو حال عرضه…" />
            </div>
          )}
          {offerView.rows.length > 0 && (
            <ul className="mt-2 space-y-2">
              {offerView.rows.map((o) => (
                <li key={o.id}>
                  <Inset className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{o.profile?.application?.fullName ?? "—"}</b>
                        <span className="opacity-70">
                          {" "}— {o.courseTitleAr}
                          {o.cohort ? ` · شعبةُ «${o.cohort.title}»` : " · بلا شعبة"}
                          {" · "}{OFFER_STATUS_AR[o.status] ?? o.status}
                        </span>
                      </span>
                      {o.status === "offered" && (
                        <Button size="sm" tone="danger" icon={Ban}
                          onClick={() => setAsking({
                            titleAr: `سحبُ عرضِ «${o.courseTitleAr}»`,
                            confirmLabelAr: "اسحبِ العرضَ وأبلغْه",
                            labelAr: "سببُ السحب — يصل صاحبَه بنصّه",
                            whatAr: "يُسحب هذا العرضُ فلا يعود قابلا للجواب، ويصل المدرّبَ أنّه سُحب وبِمَ.",
                            okAr: "سُحب العرضُ ووصل صاحبَه",
                            post: (reasonAr) => apiPost(`/api/admin/trainer-offers/${o.id}/withdraw`, { reasonAr }),
                          })}>
                          اسحبْه
                        </Button>
                      )}
                    </div>
                    {o.status === "offered" && (
                      <p className="mt-1 text-read opacity-70">مهلةُ الردّ تنتهي {fmtDateTime(o.expiresAt)}</p>
                    )}
                    {o.status === "accepted" && o.prepDueAt && (
                      <p className="mt-1 text-read opacity-70">
                        {o.prepConfirmedAt
                          ? `أقرّ بجاهزيّته ${fmtDateTime(o.prepConfirmedAt)}`
                          : `أجلُ إعداده ينتهي ${fmtDateTime(o.prepDueAt)}`}
                        {!o.prepConfirmedAt && o.prepLapsedAt
                          ? " — وقد انقضى بلا إقرار، والإسنادُ قائمٌ كما هو" : ""}
                      </p>
                    )}
                    {o.declineReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ اعتذاره: {o.declineReasonAr}</p>
                    )}
                    {o.withdrawReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ السحب: {o.withdrawReasonAr}</p>
                    )}
                  </Inset>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ═══ نسخةٌ تُحمَل لا تُقرأ على الشاشة وحدَها (٢٦ سبتمبر ٢٠٢٦) ═══

          بلاغُ صاحب المنصّة: «العقد الملغى لم يظهر لي زرّ تحميل أو حذف». والمتنُ
          كان يُعرض ولا يُخرَج: من طُلب منه العقدُ في ملفٍّ ورقيٍّ أو بريدٍ لم
          يجد بابا.

          وبابان لا واحد، لأنّهما شيئان:
          · **الطباعة** صورةٌ للقراءة — ورقةٌ أو PDF بنَسَق الوثيقة نفسِه.
          · **تنزيلُ المتن** هو الحروفُ التي بُصمت (`bodyHash`) حرفا بحرف. فمن
            أراد أن يقابل بصمةً يقابلها بهذا لا بصورةٍ معادِ رسمُها.

          والمطبوعُ هو المعروضُ نفسُه لا رسمٌ ثانٍ له: وثيقةٌ تُرسم مرّتين
          تفترقان يوما، وأخطرُ افتراقٍ في الدنيا افتراقُ الورقةِ عن الشاشة. */}
      {shownBody && (
        <Card className="mt-6 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">{shownBody.title}</h2>
            <span className="flex flex-wrap gap-2">
              <Button size="sm" icon={Printer} onClick={() => window.print()}>
                اطبعْه أو احفظْه PDF
              </Button>
              <Button size="sm" icon={Download} onClick={() => downloadBodyAr(shownBody)}>
                نزّلِ المتن
              </Button>
              <Button size="sm" onClick={() => setShownBody(null)}>أغلِقْ</Button>
            </span>
          </div>
          {/* والمعرّفُ مفتاحُ الطباعة: قاعدةُ `@media print` تُخفي كلَّ ما ليس
              هذا ولا جدّا له، فتخرج الوثيقةُ وحدَها بلا شريطٍ ولا قائمة. */}
          <div id="contract-sheet" dir="rtl" className="max-h-[32rem] overflow-auto rounded-lg">
            <ContractDocument doc={parseContractDoc(shownBody.body)} />
          </div>
        </Card>
      )}

      {/* ═══ التذكيرُ الأخير: ما سيقع يُقال قبل أن يقع ═══ */}
      {reminding && (
        <ConfirmAction
          titleAr={`تذكيرٌ أخيرٌ بتوقيع «${reminding.title}»`}
          confirmLabelAr="أرسِلِ التذكيرَ الأخير"
          tone="default"
          busy={busy}
          onCancel={() => setReminding(null)}
          onConfirm={() => void run(async () => {
            const r = await apiPost<{ signingUrl: string }>(
              `/api/admin/trainer-contracts/${reminding.id}/final-reminder`, {});
            setLink({ id: reminding.id, url: r.signingUrl });
            setReminding(null);
            await load();
          }, `أُرسل التذكيرُ الأخير — والعرضُ صالحٌ ${daysWindowAr(FINAL_REMINDER_DAYS)}`, reminding.id)}
        >
          <p className="text-read leading-7">
            يصله بريدٌ يقول إنّه آخرُ تذكيرٍ بالتوقيع، برابطٍ جديدٍ صالحٍ {daysWindowAr(FINAL_REMINDER_DAYS)} بتوقيت
            عمّان — ويتوقّف رابطُه السابق. فإن لم يوقّع حتّى ذلك سقط العرضُ كما يقول متنُه.
          </p>
          <p className="mt-2 text-read leading-7 opacity-80">
            ويُرسَل مرّةً واحدة. وبعده يبقى «جدِّدِ الرابط» لمن أردتَ أن تمنحه مهلةً أخرى.
          </p>
        </ConfirmAction>
      )}

      {/* والسببُ الذي يصل إنسانا يُكتب في نافذةٍ تُقرأ، لا في سطر متصفّح */}
      {asking && (
        <ConfirmAction
          titleAr={asking.titleAr}
          confirmLabelAr={asking.confirmLabelAr}
          busy={busy}
          reason={{ labelAr: asking.labelAr, minLength: 5 }}
          onCancel={() => setAsking(null)}
          onConfirm={(reasonText) => void run(async () => {
            await asking.post(reasonText ?? "");
            setAsking(null);
            await load();
          }, asking.okAr, asking.rowId)}
        >
          <p className="text-read leading-7">{asking.whatAr}</p>
        </ConfirmAction>
      )}

      {/* والقائمةُ تُعرَض ولا تُحرَّر: الخادمُ يلحقها بعد نصّك من الجدول نفسِه،
          فما يُرى هنا هو ما يصل — ولا سبيلَ إلى أن تسقط منها نقطة. */}
      {resign && (() => {
        const r = resign;
        const subject = r.subjectAr.trim();
        const body = r.bodyAr.trim();
        /* ═══ ما تغيّر في شروطه — يُحسب بالدالّة التي يحسب بها الخادم ═══
           (`personalChangesAr`)، فما يُعايَن هنا هو ما يُرسَل في الرسالة. */
        const active = r.row.profile?.application?.status === "active";
        const rowFee: ContractCompensation | null = r.row.compensationType
          ? { type: r.row.compensationType, rate: r.row.compensationRate ?? "0", currency: r.row.currency,
              minSeats: r.row.compensationMinSeats, referralRate: r.row.compensationReferralRate }
          : null;
        const num = (t: string) => (t.trim() === "" ? null : Number(t));
        const typedRate = num(r.rate);
        const typedFee: ContractCompensation | null = typedRate !== null && Number.isFinite(typedRate) && typedRate > 0
          ? { type: r.row.compensationType ?? "per_seat", rate: String(typedRate), currency: r.row.currency,
              minSeats: num(r.minSeats), referralRate: num(r.referralRate) === null ? null : String(num(r.referralRate)) }
          : rowFee;
        const feeChanged = !active && personalChangesAr(
          { compensation: rowFee, courses: [], specialTermsAr: null },
          { compensation: typedFee, courses: [], specialTermsAr: null },
        ).length > 0;
        const snapshot = r.row.qualifiedSnapshot ?? [];
        const pool = r.available ?? snapshot;
        const chosen = pool.filter((c) => r.picked.has(c.courseId));
        /* والتغييرُ بما نقره الموظّف لا بما تغيّر في مؤهّلاته: دورةٌ لم يعد
           مؤهَّلا لها لا تسقط من عقده ما لم يُغيِّر أحدٌ دوراته. */
        const coursesChanged = r.picked.size !== snapshot.length
          || snapshot.some((q) => !r.picked.has(q.courseId));
        const norm = (t: string | null) => specialTermsItemsAr(t).join("\n");
        const termsChanged = norm(r.specialTermsAr) !== norm(r.row.specialTermsAr);
        const personal = personalChangesAr(
          { compensation: rowFee, courses: snapshot, specialTermsAr: r.row.specialTermsAr },
          {
            compensation: feeChanged ? typedFee : rowFee,
            courses: coursesChanged ? chosen : snapshot,
            specialTermsAr: termsChanged ? norm(r.specialTermsAr) || null : r.row.specialTermsAr,
          },
        );
        const amend = r.mode === "amendment";
        /* ويُقاس ممّا قرأه هو — بالدالّة التي يقيس بها الخادم */
        const readVersion = amend ? versionReadByRequester(r.row) : r.row.bodyVersion;
        /* وما يُقال عمّا تغيّر ببابه — بالدالّة التي تبني بها الرسالةُ نفسُها: لطالب
           التعديل سطرٌ وملخّصٌ عن القالب، ولمن وقّع بطاقاتُه كاملة (`reissueChangesView`) */
        const view = reissueChangesView(r.mode, personal, changeGroupsBetween(readVersion, CONTRACT_BODY_VERSION, { conditional: r.row.gatesActivation }));
        const changes = view.cards;
        const changed = changes.length > 0 || view.templateNoteAr !== null;
        const placeholderLeft = hasAmendmentPlaceholder(body);
        const ready = !busy
          && subject.length >= RESIGN_SUBJECT_MIN && subject.length <= RESIGN_SUBJECT_MAX
          && body.length >= RESIGN_BODY_MIN && body.length <= RESIGN_BODY_MAX
          && !placeholderLeft
          && (!coursesChanged || chosen.length > 0);
        return (
          <Modal onClose={() => setResign(null)}
            label={amend ? `قبولُ تعديل «${resign.row.title}»` : `إعادةُ «${resign.row.title}» للتوقيع`}
            panelClassName="w-full max-w-2xl">
            <Inset dir="rtl" tone="solid" className="max-h-[86vh] overflow-y-auto text-foreground sm:p-6">
              <h2 className="text-sm font-black">
                {amend
                  ? `قبولُ تعديل «${resign.row.title}» — وإرسالُه مصحَّحا`
                  : `إعادةُ «${resign.row.title}» للتوقيع على النصّ المحدَّث`}
              </h2>
              <p className="mt-2 text-read leading-7 opacity-80">
                {amend
                  ? "يُغلَق العرضُ الذي طلب تعديلَه، ويُرسَل إليه عقدٌ مصحَّحٌ على النصّ الحاضر بشروطه كما تضبطها أدناه — في رسالةٍ واحدة: جوابُك، ثمّ ما تغيّر، ثمّ زرُّ التوقيع."
                  : "يُغلَق العقدُ الموقَّع ودليلُ توقيعه باقٍ، ويُعرَض عليه النصُّ الحاضر برابطٍ جديد — في رسالةٍ واحدة: نصُّك، ثمّ ما تغيّر، ثمّ زرُّ التوقيع."}
              </p>
              {amend && r.row.amendmentRequestAr && (
                <Panel tone="warn" className="mt-3 p-3 text-read leading-7">
                  <b className="block">ما طلبه:</b>
                  <span className="block whitespace-pre-wrap">{r.row.amendmentRequestAr}</span>
                </Panel>
              )}
              <label className="mt-4 block">
                <span className={LABEL}>عنوانُ الرسالة</span>
                <input className={FIELD} value={resign.subjectAr} maxLength={RESIGN_SUBJECT_MAX}
                  onChange={(e) => setResign({ ...r, subjectAr: e.target.value })} />
              </label>
              <label className="mt-3 block">
                <span className={LABEL}>
                  {amend ? "جوابُك — قبولا أو اعتذارا عمّا لم تقبله، كما تشاء. فقراتٌ يفصلها سطرٌ فارغ" : "نصُّ الرسالة — فقراتٌ يفصلها سطرٌ فارغ"}
                </span>
                <textarea className={`${FIELD} resize-y leading-7`} rows={10} maxLength={RESIGN_BODY_MAX}
                  value={resign.bodyAr}
                  onChange={(e) => setResign({ ...r, bodyAr: e.target.value })} />
              </label>
              {placeholderLeft && (
                <p className="mt-1 text-read text-danger-ink">
                  في الرسالة سطرٌ بين معقوفَين لم يُستبدَل — اكتب جوابَك مكانه قبل الإرسال.
                </p>
              )}
              {/* ═══ وشروطُه — مطويّةٌ، فالإعادةُ بلا تغييرٍ هي الأصل ═══ */}
              <details className="mt-3" open={r.editTerms}
                onToggle={(e) => setResign({ ...r, editTerms: (e.target as HTMLDetailsElement).open })}>
                <summary className="cursor-pointer text-sm font-bold">
                  {amend ? "شروطُه في العقد المصحَّح — غيّرْ ما قبلتَه منها" : "وغيّرْ شروطَه قبل الإعادة (اختياريّ)"}
                </summary>
                <Inset className="mt-2 grid gap-3 p-3">
                  {active ? (
                    <p className="text-read leading-6 opacity-80">
                      <b>الأتعابُ لا تُغيَّر من هنا:</b> مدرّبٌ نشط، وتغييرُها يسري على ما يُحسب له من اليوم
                      قبل أن يوقّع. غيّرْها من شاشة الأتعاب بتاريخ سريان.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block">
                        <span className={LABEL}>سعرُ المقعد العامّ</span>
                        <input inputMode="decimal" className={FIELD} value={r.rate}
                          onChange={(e) => setResign({ ...r, rate: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={LABEL}>الحدُّ الأدنى للمقاعد</span>
                        <input inputMode="numeric" className={FIELD} value={r.minSeats}
                          onChange={(e) => setResign({ ...r, minSeats: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={LABEL}>سعرُ مقعد رابط الدعوة</span>
                        <input inputMode="decimal" className={FIELD} value={r.referralRate}
                          onChange={(e) => setResign({ ...r, referralRate: e.target.value })} />
                      </label>
                    </div>
                  )}
                  <fieldset>
                    <legend className={LABEL}>الدوراتُ المؤهَّلُ لها (الملحق أ)</legend>
                    <ul className="space-y-1 text-sm">
                      {pool.map((c) => (
                        <li key={c.courseId}>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={r.picked.has(c.courseId)}
                              onChange={() => {
                                const n = new Set(r.picked);
                                if (n.has(c.courseId)) n.delete(c.courseId); else n.add(c.courseId);
                                setResign({ ...r, picked: n });
                              }} />
                            <span>{c.titleAr}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {coursesChanged && chosen.length === 0 && (
                      <p className="mt-1 text-read text-danger-ink">اختر دورةً واحدةً على الأقلّ — الملحق (أ) لا يُطبَع فارغا.</p>
                    )}
                  </fieldset>
                  <label className="block">
                    <span className={LABEL}>بنودٌ خاصّةٌ به — مُلزِمة (البند 21)، سطرٌ لكلّ بند، ولا تمسّ المال</span>
                    <textarea className={`${FIELD} resize-y leading-7`} rows={3} maxLength={SPECIAL_TERMS_MAX_CHARS}
                      value={r.specialTermsAr}
                      onChange={(e) => setResign({ ...r, specialTermsAr: e.target.value })} />
                  </label>
                </Inset>
              </details>
              {changed ? (
                <Panel tone="accent" className="mt-3 p-3 text-read leading-7">
                  <b className="block">{RESIGN_CHANGES_HEADING_AR}</b>
                  <span className="block opacity-70">يُلحَق بعد نصّك دائما — ولا يُحرَّر.</span>
                  {changes.length > 0 && (
                    <div className="mt-2 grid gap-2">
                      {changes.map((g) => (
                        <Inset key={g.titleAr} className="border-s-4 border-teal p-2.5">
                          <b className="block text-xs text-teal-ink">{g.titleAr}</b>
                          <ul className="mt-1 list-disc ps-5">
                            {g.itemsAr.map((pt) => <li key={pt}>{pt}</li>)}
                          </ul>
                        </Inset>
                      ))}
                    </div>
                  )}
                  {view.templateNoteAr && <p className="mt-2">{view.templateNoteAr}</p>}
                </Panel>
              ) : (
                <Panel tone="accent" className="mt-3 p-3 text-read leading-7">
                  <span className="block opacity-70">لا تغييرَ بين نصّه والنصّ الحاضر — فتقول له الرسالة:</span>
                  <b className="block">{noChangesLineAr(r.mode)}</b>
                </Panel>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button tone="confirm" icon={Send} loading={busy} disabled={!ready}
                  onClick={() => void run(async () => {
                    /* وما لم يُمَسّ لا يُرسَل — فيُنسَخ من عقده كما هو في الخادم */
                    await apiPost(`/api/admin/trainer-contracts/${r.row.id}/${amend ? "amendment-reissue" : "resign-request"}`, {
                      subjectAr: subject, bodyAr: body,
                      ...(feeChanged && typedFee ? {
                        compensation: {
                          type: typedFee.type, rate: Number(typedFee.rate),
                          ...(typedFee.minSeats != null ? { minSeats: typedFee.minSeats } : {}),
                          referralRate: typedFee.referralRate === null ? null : Number(typedFee.referralRate),
                        },
                      } : {}),
                      ...(coursesChanged ? { courseIds: chosen.map((c) => c.courseId) } : {}),
                      ...(termsChanged ? { specialTermsAr: norm(r.specialTermsAr) || null } : {}),
                    });
                    setResign(null);
                    await load();
                  }, amend
                    ? "قُبل تعديلُه — وصلته رسالتُك وفيها رابطُ عقده المصحَّح"
                    : "أُعيد العقدُ للتوقيع — وصلته رسالتُك وفيها رابطُ النسخة المحدَّثة", r.row.id)}>
                  {amend ? "أرسِلْ جوابَك وعقدَه المصحَّح" : "أعِدْه للتوقيع وأبلغْه"}
                </Button>
                <Button tone="secondary" onClick={() => setResign(null)}>تراجَع</Button>
              </div>
            </Inset>
          </Modal>
        );
      })()}

      {/* ═══ الإغلاقُ على أرقامٍ لا على تقدير (٢٦ سبتمبر ٢٠٢٦) ═══

          نافذةٌ واحدةٌ لبابَين، لأنّ السؤالَ واحد: **ما سيمسّه هذا؟** والفرقُ
          بينهما في الجواب لا في السؤال:
          · `revoke` يُغلِق عرضا لم يُوقَّع — فالأرقامُ سياقٌ يُطمئن أو يُوقِف.
          · `depart` يفسخ نافذا — فهي عواقبُ تقع بالنقرة.

          ولذلك يختلف نصُّ السبب: سببُ الإلغاء **يصل المدرّبَ بحرفه** (رسالةُ
          `notifyContractRevoked`)، وسببُ الرحيل يُكتب في ملفّه ولا يُنقل إليه —
          رسالةُ الرحيل تقول إنّ التعاقد انتهى ولا تنقل سببَه. ومن وعد بما لا
          يُرسَل صنع شكوى المرحلة السادسة نفسَها. */}
      {closing && (
        <ConfirmAction
          titleAr={closing.mode === "revoke"
            ? `إلغاءُ «${closing.row.title}»`
            : closing.row.status === "signature_approved"
              ? `إنهاءُ عرضِ ${docNameOf(closing.row)}`
              : `إنهاءُ تعاقدِ ${docNameOf(closing.row)}`}
          confirmLabelAr={closing.mode === "revoke"
            ? "ألغِ العقد"
            : closing.row.status === "signature_approved" ? "أنهِ العرضَ وافتحْ ملفَّ الرحيل" : "أنهِ التعاقدَ وافتحْ ملفَّ الرحيل"}
          busy={busy}
          reason={{
            labelAr: closing.mode === "revoke"
              ? "سببُ الإلغاء — يصل المدرّبَ بنصّه، ويُقرأ في السجلّ بعد سنة"
              : "سببُ الرحيل — يُكتب في ملفّه ويُقرأ بعد سنة (ولا يُنقل إليه في رسالته)",
            minLength: 5,
          }}
          onCancel={() => setClosing(null)}
          onConfirm={(reasonText) => void run(async () => {
            if (closing.mode === "revoke") {
              await apiPost(`/api/admin/trainer-contracts/${closing.row.id}/revoke`, { reasonAr: reasonText });
            } else {
              await apiPost(`/api/admin/trainer-departures`,
                { profileId: closing.row.profile!.id, reasonAr: reasonText });
            }
            setClosing(null);
            await load();
          }, closing.mode === "revoke"
            ? "أُلغي العقدُ ووصلَه سببُه"
            : closing.row.status === "signature_approved"
              ? "انتهى العرضُ وفُتح ملفُّ الرحيل"
              : "انتهى التعاقدُ وفُتح ملفُّ الرحيل — ولكلّ متعلّمٍ صفٌّ يُختار")}
        >
          <p className="text-read leading-7">
            {closing.mode === "revoke"
              ? "يُغلَق هذا العقدُ ولا يُحذَف: يبقى في القائمة بحالة «ملغًى» وسببُه معه، ويبطل رابطُ توقيعه. ويصل المدرّبَ أنّه أُلغي وبِمَ."
              : closing.row.status === "signature_approved"
                ? "يُنهى هذا العرضُ — ولم نوقّعه بعد، فلا عقدَ نافذا يُفسَخ — ويُفتح ملفُّ رحيلٍ تُسحب فيه العروضُ التي تنتظر جوابَه. ويصله أنّ العرضَ انتهى ولم يصر عقدا. ولا يمحو ذلك ما كان: نسختُه ودليلُ توقيعه يبقيان."
                : "يُفسَخ هذا العقدُ للمستقبل، ويُفتح ملفُّ رحيلٍ يُعرَض فيه على كلّ متعلّمٍ صفُّه، وتُسحب العروضُ التي تنتظر جوابَه. ولا يمحو ذلك ما كان: نسختُه ودليلُ توقيعه يبقيان، وما استحقّه عن عملٍ أدّاه يبقى مستحقّا له."}
          </p>
          {impactBites(closing.impact)
            ? (
              <Inset className="mt-3 p-3 text-read leading-7">
                <p className="mb-1 font-black">
                  {closing.mode === "depart" ? "وهذا ما سيُمَسّ:" : "ولهذا المدرّبِ اليومَ ما يلي — فانظرْ فيه قبل الإغلاق:"}
                </p>
                <ul className="list-inside list-disc">
                  {closing.impact.liveCohorts > 0 && (
                    <li>شعبٌ حيّةٌ يدرّسها: <b>{closing.impact.liveCohorts}</b></li>
                  )}
                  {closing.impact.enrolledLearners > 0 && (
                    <li>متعلّمون مسجَّلون فيها: <b>{closing.impact.enrolledLearners}</b></li>
                  )}
                  {closing.impact.openOffers > 0 && (
                    <li>عروضُ إسنادٍ تنتظر جوابَه: <b>{closing.impact.openOffers}</b></li>
                  )}
                  {closing.impact.unpaidPayouts > 0 && (
                    <li>
                      مستحقّاتٌ لم تُصرَف: <b>{closing.impact.unpaidPayouts}</b>
                      {" — "}
                      {Object.entries(closing.impact.owedByCurrency)
                        .map(([cur, amount]) => `${amount} ${cur}`).join(" · ")}
                    </li>
                  )}
                </ul>
                {closing.mode === "revoke" && (
                  <p className="mt-2 opacity-80">
                    وهذه قائمةٌ بعقدٍ آخر — إلغاءُ هذا العرضِ لا يمسّها. وإنّما تُقرأ
                    لتعرفَ أنّ للرجلِ عملا قائما قبل أن تُغلِق بابَه.
                  </p>
                )}
              </Inset>
            )
            : (
              <Inset className="mt-3 p-3 text-read leading-7">
                لا شعبَ حيّةً لهذا المدرّب، ولا متعلّمين، ولا عرضا ينتظر جوابَه، ولا
                مستحقّا لم يُصرَف. فلا شيءَ سيُمَسّ غيرَ هذا العقد.
              </Inset>
            )}
        </ConfirmAction>
      )}

      {/* ═══ الحذفُ يقول ماذا سيحدث بالضبط — ولا يطال موقَّعا ═══ */}
      {deleting && (
        <ConfirmAction
          titleAr={`حذفُ «${deleting.title}»`}
          confirmLabelAr="احذِفْ"
          onCancel={() => setDeleting(null)}
          onConfirm={() => void run(async () => {
            await apiDelete(`/api/admin/trainer-contracts/${deleting.id}`);
            setDeleting(null);
            await load();
          }, "حُذِف العقد")}
        >
          <p className="leading-7">
            يُمحى الصفُّ ولا يُستعاد: متنُه وبصمتُه وحالتُه ومرفقاتُه. ويبقى في
            سجلّ الأثر من حذفه ومتى، وعنوانُه وحالتُه يومَ حُذف.
          </p>
          <p className="mt-2 leading-7">
            وهذا العقدُ لم يمسّه توقيع — والموقَّعُ لا يُحذف أصلا، فهو دليلٌ
            يُحتَجّ به للمدرّب وعليه.
          </p>
        </ConfirmAction>
      )}

    </AdminLayout>
  );
}
