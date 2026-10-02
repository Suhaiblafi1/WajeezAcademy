/* خدمة مراجعة واعتماد المدربين — قرارات بشرية بالكامل:
   روبرك تسعة محاور، مقابلات، تقييم Demo، مراجع، قبول مشروط، عقد،
   دعوة آمنة لإنشاء الحساب، تأهيل لدورة، إسناد لشعبة، نشر عام، إيقاف.
   مبدأ الفصل: قبول الطلب ≠ إنشاء الحساب ≠ تفعيل الدور ≠ التأهيل ≠ التعيين ≠ النشر.
   المتقدم لا يمنح نفسه دور trainer أبدا — الحساب يُنشأ فقط عبر دعوة إدارية. */

import { ACADEMY_EMAILS, getCalendlyConfig } from './integrations.service'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError, AuthService } from './auth.service'
import { holdsRoleBeyondTrainer } from '../auth/permissions'
import { recordAudit } from './audit'
import { OPEN_PROPOSAL, seedProposalsFromApplication } from './course-proposal.service'
import { renderMail } from './mail-template'
import { changeGroupsBetween } from '../../src/application/trainer/contract-changelog'
import {
  RESIGN_BODY_MAX, RESIGN_BODY_MIN, RESIGN_REVOKE_REASON_AR, RESIGN_SUBJECT_MAX, RESIGN_SUBJECT_MIN,
  personalChangesAr, resignChangeGroups, reissueChangesView,
  AMENDMENT_ACCEPT_REVOKE_REASON_AR, hasAmendmentPlaceholder, versionReadByRequester,
} from '../../src/application/trainer/contract-resign'
import {
  bookingReminderMail, decisionMailFor, demoRequestMail, draftReminderMail, noShowFollowupMail, rejectionUndoneMail, withdrawalUndoneMail, conditionalOfferMail, finalApprovalMail, conditionReminderMail, conditionLapsedMail, signedCopyMail, amendmentAnsweredMail, contractApprovedMail,
  contractRevokedMail, contractUpdatedMail, contractResignMail, contractFinalReminderMail,
  contractLapsedMail, contractFactsRows, type FinalApprovalSeal } from './trainer-decision-mail'
import {
  FOLLOWUP_BODY_MAX, FOLLOWUP_BODY_MIN, canFollowUpNoShow, followupOf,
} from '../../src/application/trainer/no-show-followup'
import { MAIL_LINK_TTL_MS, MAIL_LINK_WINDOW_AR } from '../../src/application/links/mail-link-window'
import { canRemindToBook, TRAINER_INTERVIEW, trainerInterviewUrl } from '../../src/application/trainer/application-options'
import { REVIEW_OPEN_STATUSES } from '../../src/application/trainer/approval'
import { NO_SHOW } from '../../src/application/trainer/interview-outcome'
import { OUTREACH_ACTIONS } from '../../src/application/trainer/outreach'
import { INVITATION_ACTION } from '../../src/application/trainer/interview-invitation'
import { LIVE_INTERVIEW, pendingInterview, revertWhenNoLiveInterview } from './trainer-interview-state'
import { buildIcs } from './calendar/ics'
import { TERMINAL_STATUSES, TrainerApplicationService, transitionProblemAr, type TrainerStatus } from './trainer-application.service'
import { nextTrainerApplicationReference } from './trainer-application-reference'
import { sendDirectEmail, notifyRole, safeNotify, publicSiteUrl, type DirectMailStatus } from './notification.service'
import { sendStaffInviteEmail } from './account-mail'
import { CohortService } from './cohort.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { TRAINER_GUIDE_PATH } from '../../src/application/trainer/trainer-guide'
import { TrainerMaterialsService } from './trainer-materials.service'
import {
  EXTENSION_DAYS, MATERIALS_WINDOW_DAYS, conditionPhase, daysLeft, extensionsLeft,
  materialsGateProblemAr,
  deadlineAfterPause, deadlineFrom, dueReminder, extendProblemAr, extendedDeadline,
  offerGatesActivation, SEALED_BY_TEXT_AR, signatureApprovalOf,
} from '../../src/application/trainer/conditional-offer'
import {
  AMENDMENT_TEXT_MAX, CONTRACT_AMENDMENT_REQUESTED, canRespondToContract, contractBlockedAr, isAmendmentRequested,
} from '../../src/application/trainer/contract-endings'
import { isUntouchableContract } from '../../src/application/trainer/contract-untouchable'
import {
  SIGNED_COPY_STATES, closedStateOf, sameMailbox,
  type ContractClosedView, type ContractLinkPurpose,
} from '../../src/application/trainer/contract-link-state'
import { PUBLIC_TRAINER_WHERE, trainerPubliclyVisible } from './trainer-visibility'
import { cleanProposals, readProposals } from '../../src/application/trainer/teachable-proposals'
import {
  IDENTITY_MIMES, MAX_CONTRACT_DOC_BYTES,
  MAX_PHOTO_BYTES, PHOTO_KEY_PREFIX, PHOTO_MIMES, SIGNED_URL_TTL_MS,
  assertFileUploadsEnabled, newStorageKey, photoPublicUrl, photoStorageKey, signKey,
} from './storage.service'
import { deleteObject } from './object-store'
import { EarningsService } from './earnings.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import {
  ACADEMY_LEGAL, LEGAL_FIELD_LABELS_AR,
  academyLegalGapMessageAr, academyPartyLineAr, missingAcademyLegalFields,
} from '../../src/data/academy-legal'
import {
  CONTRACT_NUMBER_PENDING_AR,
  CONTRACT_BODY_VERSION, bodyCarriesConditionClause, contractHasBodyAr,
  CONTRACT_CONSENT_AR, CONTRACT_CONSENT_VERSION, contractAcks, noFaultClauseOf,
  renderContractBodyAr,
  SPECIAL_TERMS_MAX_CHARS, SPECIAL_TERMS_MAX_ITEMS, specialTermsItemsAr,
  type ContractBodyInput, type ContractCompensation, type ContractCourseRow, readContractCourses,
} from '../../src/application/trainer/contract-body'
import {
  CONTRACT_DOCUMENT_KINDS, DEFAULT_REQUIRED_DOCUMENTS,
  hasRequiredIdentityDocument, readRequiredDocuments, type RequiredDocument, requiredDocumentLabelsAr } from '../../src/application/trainer/contract-documents'
import { CONTRACT_SIGNING_LINK_DAYS, FINAL_REMINDER_DAYS } from '../../src/application/trainer/notice-periods'
import {
  computeReadiness, overrideReasonProblemAr, readinessBlockMessageAr, type Readiness,
} from '../../src/application/trainer/readiness'

/** ما تُرسله شاشةُ التركيب — والأجرُ ليس منه: يُقرأ من قاعدة الماليّة ولا
    يُكتب من شاشة التعاقد. فمن يركّب العقدَ يرى الرقمَ ولا يملك تغييرَه. */
export interface ContractComposeInput {
  title: string
  /** اسمُ الطرف الثاني كما في وثيقة هويّته — يُطبَع في الديباجة ويُحفَظ في
      الملفّ فيَرِثه كلُّ عقدٍ بعده. وبلا قيمةٍ يبقى ما في الملفّ أو الطلب. */
  trainerLegalNameAr?: string | null
  /** الدوراتُ المختارةُ من مؤهّلاته — وبلا قيمةٍ تُدرَج كلُّها */
  courseIds?: string[]
  requiredDocuments: RequiredDocument[]
  hoursNoteAr?: string | null
  rateWaivedReasonAr?: string | null
  /* ═══ جلسةُ التهيئة تُكتب هنا لا في شاشةٍ أخرى (§٩ من التصميم) ═══

     ومنها يُحسب تاريخُ انتهاء المهلة، **ويُطبَعان في المتن**. ولهذا يُكتبان
     عند التركيب لا عند الإرسال: المتنُ يُركَّب مرّةً ويُجمَّد ويُهشَّم، فلو
     أُخِّرا إلى الإرسال لَوُقِّع مستندٌ يقول «تبدأ من تاريخ تخطرك به» وفي
     القاعدة تاريخٌ لم يقرأه. والتركيبُ والإرسالُ دقائقُ بينهما.

     ═══ وصار الموعدُ لازما في المشروط (٢٦ سبتمبر ٢٠٢٦) ═══

     كان يُكتب هنا: «ولا يلزمان: من رُكِّب له عرضٌ ولمّا يُعرَف موعدُ جلسته
     يُرسَل بلا تاريخ، فلا مهلةَ له حتّى يُكتب ويصله خبرُه». ونسخه قرارُ صاحب
     المنصّة: «نعم — بعد أن يوقّعوا ونوقّعَ العرضَ المشروط، تصلهم دعوةُ جلسة
     التهيئة».

     وعلّةُ النسخ أنّ «المهلةَ تُكتب لاحقا» **لم تكن تقع**: لا مسارَ يكتب
     `conditionDeadlineAt` بعد التركيب إلّا التمديدُ — وهو يشترط مهلةً قائمة.
     فمن رُكّب عرضُه بلا جلسةٍ بقي بلا مهلةٍ أبدا، وبلا مهلةٍ لا يستطيع أن
     يُعلن اكتمالَ موادّه (`openConditionContract`)، فيُوقَّع العرضُ ويُعتمَد
     مباشرةً والشرطُ مكتوبٌ في متنه لا يُنفَّذ منه شيء.

     والشرطُ على `gatesActivation` وحدَه: العقدُ العاديُّ لا طورَ له ولا مهلة.
     و`orientationUrl` يبقى اختياريّا — رابطُ الحضور يُضاف بعد حجز الغرفة. */
  orientationAt?: string | null
  orientationUrl?: string | null
  /* ═══ والأتعابُ تُضبَط في هذه الشاشة نفسِها ═══

     قرارُ صاحب المنصّة: لا شاشةَ ثانية. وحين تحضر تمرّ بمسلك `setRule`
     نفسِه لا بنسخةٍ عنه — فيبقى كاتبُ القاعدة واحدا، ويبقى أثرُها وتاريخُ
     سريانها كما هما. وإن غابت بقيت القاعدةُ القائمةُ على حالها. */
  compensation?: {
    type: string
    rate: number
    minSeats?: number
    referralRate?: number | null
  } | null
  /** بنودٌ خاصّةٌ بهذا المدرّب — تُطبَع البندَ 21 (`specialTermsClauseAr`) */
  specialTermsAr?: string | null
}

/** البنودُ الخاصّةُ كما تُحفَظ وتُطبَع: سطرٌ لكلّ بند، بلا علامات القائمة.
 *
 *  و`null` لما لا بنودَ فيه — فلا يُحفَظ نصٌّ فارغٌ يُقرأ بعد شهرٍ كأنّ شيئا
 *  كُتب ثمّ مُحي. والسقفُ يُقال بالعربيّة هنا لا برسالة مخطّطٍ عامّة. */
export function cleanSpecialTermsAr(text: string | null | undefined): string | null {
  const items = specialTermsItemsAr(text)
  if (items.length === 0) return null
  if (items.length > SPECIAL_TERMS_MAX_ITEMS) {
    throw new AuthError('special_terms_too_many', `البنودُ الخاصّةُ ${SPECIAL_TERMS_MAX_ITEMS} بندا على الأكثر — سطرٌ لكلّ بند`, 422)
  }
  const joined = items.join('\n')
  if (joined.length > SPECIAL_TERMS_MAX_CHARS) {
    throw new AuthError('special_terms_too_long', `البنودُ الخاصّةُ ${SPECIAL_TERMS_MAX_CHARS} حرفٍ على الأكثر`, 422)
  }
  return joined
}

/** الأتعابُ النافذةُ في عقدٍ يُركَّب: المضبوطةُ في الشاشة تغلب القاعدةَ القائمة.
 *
 *  موضعٌ واحدٌ يقرؤه التركيبُ والمعاينةُ والإعادةُ للتوقيع. وكانت المعاينةُ
 *  تقرأ القاعدةَ القائمةَ وحدَها، فيرى الموظّفُ أجرا ويُطبَع في العقد غيرُه —
 *  ورأسُ `contractBodyInput` يقول إنّ المعاينةَ والمحفوظَ لا يفترقان. */
function effectiveCompensation(
  current: { ruleId: string; type: string; rate: string; currency: string; minSeats: number | null; referralRate: string | null } | null,
  typed: ContractComposeInput['compensation'],
) {
  if (typed) {
    return {
      ruleId: null as string | null,
      type: typed.type,
      rate: String(typed.rate),
      currency: current?.currency ?? LEDGER_CURRENCY,
      minSeats: typed.minSeats ?? null,
      referralRate: typed.referralRate == null ? null : String(typed.referralRate),
    }
  }
  return current
    ? {
        ruleId: current.ruleId as string | null,
        type: current.type,
        rate: current.rate,
        currency: current.currency,
        minSeats: current.minSeats,
        referralRate: current.referralRate,
      }
    : null
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const newToken = () => randomBytes(32).toString('base64url')

/* محاور الروبرك البشري التسعة — كل محور من 1 إلى 5 */
/* ═══ ما يُمرَّر مع القرار ولا يُقرأ من الجسم وحدَه ═══

   رتبةُ الفاعل تأتي من الحاجز (`req.auth.roles`) لا تُستنتَج هنا: الخدمةُ
   لا تعرف الرتب، والحاجزُ يعرفها. وسببُ التجاوز يُكتب في الشاشة ويُحفظ في
   الأثر وفي سجلّ الحالة معا — فمن سأل بعد شهرٍ «لمَ صار هذا نشطا بلا عقد؟»
   وجد الجوابَ في الموضعَين اللذَين يُنظَر فيهما. */
export interface DecideOptions {
  /** سببُ تجاوز بوّابة التجهيز — للمدير الأعلى وحدَه، وبحدٍّ أدنى للطول */
  overrideReasonAr?: string | null
  /** رتبُ الفاعل كما قرأها الحاجز */
  actorRoles?: string[]
  /** ما طابقه المعتمِدُ بوثيقة الهويّة — يأتي من شاشة العقود وحدَها، ويُكتب
      في ملحوظة خَتمِ العرض. ولا معنى له في قرارٍ لا عرضَ مشروطَ فيه. */
  sealNoteAr?: string | null
}

export const RUBRIC_CRITERIA = [
  'domain_expertise', 'evidence_of_expertise', 'explanation_facilitation', 'demo_quality',
  'activity_assessment_design', 'feedback_skill', 'digital_training', 'values_fit', 'availability',
] as const
export type RubricKey = (typeof RUBRIC_CRITERIA)[number]

/** الناقصُ جائز — فالقيمةُ قد تغيب، ونوعُها يقول ذلك بدل أن يُكتَم بتحويل */
export type RubricScores = Record<string, number | undefined>

/* مهلةُ دعوة حساب المدرّب المعتمَد — من سقف روابط البريد لا برقمٍ بيدها.

   كانت اثنتَين وسبعين ساعة، وأدخلها صاحبُ المنصّة في السقف (٢٠ سبتمبر
   ٢٠٢٦): «نعم غيّره أيضا لـ٢٤ ساعة». فلم يبقَ فوق السقف رابطٌ يُرسَل بالبريد.
   والمدّةُ ونصُّها في `src/application/links/mail-link-window.ts`، ومن فاتته
   يطلب من الفريق إعادةَ إرسالها — وهو مقولٌ في الرسالة نفسِها. */
const INVITATION_TTL_MS = MAIL_LINK_TTL_MS

/* ملحوظةُ خَتمِ العرض المشروط — تُكتب في الصفّ فتُقرأ بعد سنةٍ حين يُسأل
   «بأيّ شيءٍ خُتم هذا العرض؟». وهي في ثابتٍ واحدٍ لأنّها تُكتب في موضعَين:
   الخَتمُ نفسُه، وضمُّ ملحوظةِ مطابقةِ الهويّة إليها حين يأتي القرارُ من
   شاشة العقود — ونسختان منها تفترقان في أوّل تحريرٍ يلحق إحداهما.

   وكانت تقول «تحقّق شرطُ البند 2-10» — والبندُ 2-10 تمديدُ المهلة. فالشرطُ في
   2-6، وما يقع بتحقّقه (توقيعُنا ونشرُ الحساب والملحق) في 2-12. */
const CONDITION_SEAL_NOTE_AR = 'خَتمٌ باعتماد الموادّ وتفعيل الحساب — تحقّق الشرطُ (البندان 2-6 و2-12)'

/* بابُ كلِّ نهاية: المردودُ لا يُفتح إلّا بالتراجع عن الرفض، والمسحوبُ إلّا
   بالتراجع عن السحب — والقولُ في `decide`. */
const UNDO_DOORS = { rejected: 'undo_reject', withdrawn: 'undo_withdraw' } as const
type UndoAction = (typeof UNDO_DOORS)[keyof typeof UNDO_DOORS]
const UNDO_DOOR_AR: Record<UndoAction, { label: string; of: string }> = {
  undo_reject: { label: 'تراجَعْ عن الرفض', of: 'مردود' },
  undo_withdraw: { label: 'تراجَعْ عن السحب', of: 'مسحوب' },
}

/* ═══ الناقصُ يُقبل، والمجهولُ يُرَدّ ═══

   كان يشترط المحاورَ التسعةَ كلَّها من ١ إلى ٥. وفيه خطآن ظهرا حين صار
   التقييمُ يُملأ في صفحةٍ مشتركةٍ تُحفَظ مرّاتٍ، لا في نموذجٍ يُرسَل دفعةً:

   ١) `demo_quality` **لا يُقاس في المقابلة** — و`rubric.ts` يقول ذلك صراحةً
      في `laterAr`. فكان المُقابِلُ يخترع له درجةً ليمرّ حفظُه، فتدخل القاعدةَ
      درجةٌ لا أصلَ لها.

   ٢) ومن حفظ نصفَ الورقة ليُتمّها بعد ساعةٍ رُدَّ حفظُه كلُّه.

   فصار: ما أُرسل يُتحقَّق منه، والنقصُ جائز.

   **والمفتاحُ المجهولُ يُرَدّ ولا يُتجاهَل** — وهذا مقصود: خطأٌ مطبعيٌّ في
   اسم محورٍ يُقبل صامتا يضيع، فيظنّ القارئُ أنّه قيّم وهو لم يفعل. */
export function assertRubric(scores: RubricScores) {
  for (const [key, v] of Object.entries(scores)) {
    /* المفتاحُ يُفحص قبل قيمته: مجهولٌ بلا قيمةٍ مجهولٌ كذلك */
    if (!(RUBRIC_CRITERIA as readonly string[]).includes(key)) {
      throw new AuthError('bad_rubric', `لا محورَ في الروبرك اسمُه «${key}»`)
    }
    /* ومفتاحٌ حاضرٌ بلا قيمةٍ = محورٌ لم يُقيَّم، لا محورٌ قيمتُه خاطئة */
    if (v === undefined) continue
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new AuthError('bad_rubric', `محور «${key}» يجب أن يكون تقييما صحيحا من 1 إلى 5`)
    }
  }
}

/** يُسقَط ما لم يُقيَّم — فلا يدخل القاعدةَ مفتاحٌ بلا درجة */
export function cleanRubric(scores: RubricScores): Record<string, number> {
  return Object.fromEntries(
    Object.entries(scores).filter((e): e is [string, number] => e[1] !== undefined),
  )
}

/** ما يُرسَل مع العقد البديل — في الإعادة للتوقيع وفي قبول طلب التعديل */
export interface ReissueForSigningInput {
  subjectAr: string; bodyAr: string
  /* ═══ وشروطٌ جديدةٌ إن أُريدت (١ أكتوبر ٢٠٢٦) ═══
     ما غاب منها يُنسَخ من العقد القديم كما هو. و`specialTermsAr: null`
     يرفع بنودَه الخاصّة، وغيابُ المفتاح يُبقيها. */
  compensation?: ContractComposeInput['compensation']
  courseIds?: string[]
  specialTermsAr?: string | null
}

export class TrainerReviewService {
  private prisma: PrismaClient
  private apps: TrainerApplicationService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.apps = new TrainerApplicationService(prisma)
  }

  /* ─────────── عرض الإدارة ─────────── */

  async listApplications(status?: string) {
    const now = new Date()
    const rows = await this.prisma.trainerApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      /* الملغاةُ لا تُعَدّ مقابلةً: ترويسةُ الطابور تقول «أُجريت مقابلتُه» عن
         هذا العدد، ومن ألغى موعدَه عبر Calendly لم يجلس إليه أحد. */
      include: {
        specialties: true,
        /* آخرُ حركةٍ في الطلب — يُحسب بها عمرُه في الشاشة. وواحدةٌ تكفي:
           الشارةُ تقول «منذ متى وهو في حالته هذه» لا تاريخَ السلسلة. */
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        /* ═══ ونتيجةُ لقائه في الصفّ — لا خلفَ فتحةِ ملفّ ═══

           شكا صاحبُ المنصّة (٢٠ سبتمبر ٢٠٢٦) أنّ الصفَّ يقول كلَّ شيءٍ إلّا
           ما يُقرَّر عليه: «أحتاج الاسم والرقم والحالة، وأيضا نتيجة المقابلة
           — يجتاز أو لا يجتاز». وكانت تُكتب في بطاقة المقابلة داخلَ الملفّ،
           فمن أراد أن يعرف من اجتاز فتح خمسةَ ملفّاتٍ ليقرأ خمسَ كلمات.

           والملغاةُ لا تُقرأ: موعدٌ أُلغي لا نتيجةَ له. وتُجلَب القائمةُ
           كلُّها لا صفٌّ واحد، لأنّ منها يُقرأ شيئان لا شيء: أحدثُ نتيجةٍ
           سُجّلت، والموعدُ الذي ما زال ينتظر — وهما قد يكونان صفَّين. */
        interviews: {
          where: { canceledAt: null },
          orderBy: { scheduledAt: 'desc' },
          select: { scheduledAt: true, outcome: true },
        },
        /* ═══ وقرارُ رابط التقييم — هو ما اتُّفق على عرضه (٢١ سبتمبر ٢٠٢٦) ═══

           شكا صاحبُ المنصّة: «قلتَ مرارا إنّك ستضع نتيجةَ التقييم بجانب
           الحالة، والتي اتّفقنا أن تأخذها من روابط التقييم التي استخدمناها
           لمقابلة المدرّب». وكان الصفُّ يقرأ `TrainerInterview.outcome`
           وحدَها — وهي ما يسجّله مُجرِي المقابلة في بطاقة الموعد، لا ما
           يكتبه القارئُ في رابطه.

           و`verdict` لا يُكتب إلّا من مسار الرابط (`dossier-link.routes`):
           `addReview` الداخليّةُ لا تمسّه. فما يصل هنا **هو نتيجةُ رابط
           التقييم بعينها** لا شيءٌ يشبهها.

           والمكرَّرُ يُطوى في الشاشة لا هنا: من قرأه اثنان واتّفقا قولٌ
           واحد، ومن اختلفا فيه قولان يُعرضان — وذاك حكمُ عرضٍ لا حكمُ جلب. */
        reviews: {
          where: { NOT: { verdict: null } },
          orderBy: { updatedAt: 'desc' },
          /* والاسمُ معه: حين يختلف قارئان لا يكفي أن يُعرض القولان — يُعرض
             قائلاهما، وإلّا قرأ المراجعُ تناقضا بلا صاحب. */
          select: { verdict: true, reviewerName: true },
        },
        _count: { select: { documents: true, reviews: true, demoEvaluations: true, interviews: { where: LIVE_INTERVIEW } } },
      },
    })

    /* ═══ وآخرُ ما بعثناه إليه — من الأثر، لا من عمودٍ يُكتب مرّتين ═══

       «أضفْ بجانب كلّ شخصٍ قمنا بتذكيره… موضَّحا بجانب حالته». والخبرُ
       مسجَّلٌ أصلا في `AuditEvent` منذ أوّل تذكيرٍ خرج — فلا يُكتب عمودٌ
       ثانٍ على الطلب يقول الشيءَ نفسَه وينحرف عنه أوّلَ مرّةٍ يُنسى فيه.

       واستعلامٌ واحدٌ لا واحدٌ لكلّ صفّ: الفهرسُ `[entityType, entityId,
       createdAt]` موضوعٌ لهذا، ونازلا يقع أحدثُ ما لكلّ طلبٍ أوّلا — فأوّلُ
       ما يُرى لمعرّفٍ هو آخرُ مراسَلته. */
    const outreach = new Map<string, { action: string; at: Date }>()
    /* ═══ ومتى خرجت إليه دعوةُ الحجز بعينها (٢٦ سبتمبر ٢٠٢٦) ═══

       طلبُ صاحب المنصّة: «أضفْ لي فلترا بجانب "لم يحجز موعدا" وهو: لم يُطلب
       منه تحديد موعد مقابلة».

       و`outreach` أعلاه لا تكفي: هي تحفظ **آخرَ مراسَلةٍ** أيّا كانت، فمن
       دُعي إلى الحجز ثمّ أُرسل إليه شيءٌ آخرُ بعده تُخفي دعوتَه. والسؤالُ
       هنا غيرُه: أخرجت الدعوةُ **يوما**؟

       ومن الحلقة نفسِها لا باستعلامٍ ثانٍ: الفعلُ مجلوبٌ أصلا ضمن
       `OUTREACH_ACTIONS`، فلا يُسأل الأثرُ مرّتين عن صفٍّ واحد. */
    const invited = new Map<string, Date>()
    if (rows.length > 0) {
      const events = await this.prisma.auditEvent.findMany({
        where: {
          entityType: 'trainer_application',
          entityId: { in: rows.map((a) => a.id) },
          action: { in: [...OUTREACH_ACTIONS] },
        },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, action: true, createdAt: true },
      })
      for (const e of events) {
        if (!outreach.has(e.entityId)) outreach.set(e.entityId, { action: e.action, at: e.createdAt })
        /* نازلا: فأوّلُ ما يُرى لمعرّفٍ أحدثُ دعوةٍ خرجت إليه */
        if (e.action === INVITATION_ACTION && !invited.has(e.entityId)) {
          invited.set(e.entityId, e.createdAt)
        }
      }
    }

    return rows.map((a) => ({
      id: a.id, reference: a.reference, status: a.status, fullName: a.fullName, email: a.email,
      country: a.country, jobTitle: a.jobTitle, domainYears: a.domainYears, trainingYears: a.trainingYears,
      specialties: a.specialties.map((s) => s.specialty), createdAt: a.createdAt,
      /* ═══ ومنذ متى يقف ═══

         آخرُ حركةٍ أوّلا: من نُقل أمسِ إلى «مراجعة أكاديميّة» ينتظرنا منذ
         أمسِ لا منذ شهر. فإن لم تكن له حركةٌ بعدُ فمنذ إتمامه، وإلّا فمنذ
         إنشائه — ومسوّدةٌ لم تُكمَل عمرُها من يوم فُتحت. */
      waitingSince: a.statusHistory[0]?.createdAt ?? a.phase2CompletedAt ?? a.createdAt,
      emailVerified: !!a.emailVerifiedAt, phase2Done: !!a.phase2CompletedAt,
      documentsCount: a._count.documents, reviewsCount: a._count.reviews, interviewsCount: a._count.interviews,
      /* ويُقرأ به «طُلب منه درسٌ تجريبيّ» في `outreach.ts`: الطلبُ معلَّقٌ ما
         لم يُسجَّل تقييم. وكان الطلبُ حالةً في الطابور حتّى ٢٦ سبتمبر ٢٠٢٦. */
      demosCount: a._count.demoEvaluations,
      /* `null` = لم تخرج إليه دعوةُ حجزٍ قطّ — وبها يفرّق الطابورُ بين من
         ينتظرنا ومن ننتظره (`awaitsBookingInvite`). */
      interviewInvitedAt: invited.get(a.id) ?? null,
      /* `null` = لا لقاءَ أو لقاءٌ بلا نتيجةٍ بعد — والشاشةُ تفرّق بينهما
         بالحالة لا بهذا الحقل، فلا تُخترع نتيجةٌ لمن لم يُقابَل.

         و«الأحدثُ ممّا سُجّلت نتيجتُه» لا «الأحدثُ مطلقا»: من اجتاز ثمّ
         حجز لقاءً ثانيا كان موعدُه الجديدُ — وهو بلا نتيجةٍ بعد — يمحو
         نتيجةَ الأوّل من الصفّ. والترتيبُ نازلٌ، فأوّلُ ما يحمل نتيجةً
         هو أحدثُها. */
      interviewOutcome: a.interviews.find((iv) => iv.outcome !== null)?.outcome ?? null,
      /* ═══ موعدُه الذي ينتظر ═══

         أقربُ قادمٍ لم تُسجَّل نتيجتُه، وإلّا فآخرُ ماضٍ ينتظر تسجيلَها.
         و`null` لمن لا موعدَ معلَّقا له — حجز وسُجّلت نتيجتُه، أو لم يحجز
         أصلا. والشاشةُ تفرّق بين الحالتين بـ`interviewsCount`.

         والغيابُ ليس موعدا معلَّقا: نتيجتُه مسجَّلةٌ (`no_show`) والطلبُ
         عاد إلى ما قبل الحجز، فصاحبُه في «لم يحجز» لا في «له موعد». */
      pendingInterviewAt: pendingInterview(a.interviews, now),
      /* ═══ ومتى موعدُ لقائه — للترتيب لا للعرض (٢١ سبتمبر ٢٠٢٦) ═══

         طلب صاحبُ المنصّة: «أحتاج ترتيبا إضافيّا للأسماء من خلال تاريخ
         المقابلة، من الأقدم للأحدث مثلا». وكان الطابورُ يُرتَّب بتاريخ
         التقديم أو الاسم أو الرقم أو الحالة — ولا شيءَ فيها يقول متى
         يلتقيه.

         وهو غيرُ `pendingInterviewAt`: ذاك **المعلَّق** وحدَه — يسقط عمّن
         سُجّلت نتيجتُه، فلو رُتّب به لَتذيّل كلُّ من قُوبل وانتهى أمرُه
         وكأنّه بلا موعدٍ أصلا. وهذا آخرُ موعدٍ قائمٍ له مهما كان حالُه،
         فيُرتَّب به من قُوبل ومن ينتظر لقاءه معا.

         والترتيبُ نازلٌ، فأوّلُ القائمة أحدثُها. و`null` لمن لا موعدَ له. */
      interviewAt: a.interviews[0]?.scheduledAt ?? null,
      /* قراراتُ روابط التقييم بأسماء قائليها — أحدثُها أوّلا، والطيُّ في
         الشاشة: من اتّفقا قولٌ واحدٌ بلا اسم، ومن اختلفا قولان بأسمائهما. */
      reviewVerdicts: a.reviews.map((r) => ({ verdict: r.verdict!, reviewerName: r.reviewerName })),
      /* آخرُ مراسَلةٍ ننتظر بها ردَّه — و`null` لمن لم يُراسَل قطّ، وهو خبرٌ
         كالخبر: الحالةُ لا تفرّق بين من ذُكّر أمسِ ومن لم يُذكَّر أصلا. */
      lastOutreach: outreach.get(a.id) ?? null,
    }))
  }

  async getApplication(id: string) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id },
      include: {
        specialties: true, documents: true, reviews: true, interviews: true,
        demoEvaluations: true, references: true, invitations: { select: { id: true, sentTo: true, expiresAt: true, usedAt: true, createdAt: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        profile: {
          include: {
            qualifications: {
              include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } } },
            },
            assignments: true,
            contracts: true,
            /* اقتراحاتُه تُقرأ وتُصنَّف في ملفّه — وطابورُ `/admin/course-proposals`
               يبقى للنظرة العابرة عبر المدرّبين كلِّهم. وهما مصدرٌ واحدٌ ومساران:
               من يجهّز مدرّبا بعينه لا يغادر ملفَّه ليصنّف اقتراحَين. */
            courseProposals: {
              orderBy: { createdAt: 'asc' },
              include: {
                course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
              },
            },
            /* شعبُه الحالية وجلساتُها — لوحُ الملخّص يقرؤها ولا يستنتجها */
            cohortTrainers: {
              include: {
                cohort: {
                  include: {
                    course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
                    sessions: { where: { status: { not: 'cancelled' } }, orderBy: { startsAt: 'asc' } },
                    _count: { select: { enrollments: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    /* لوحُ الملخّص — ما يحتاجه من يقرّر في سطرٍ واحد، محسوبا هنا لا في الشاشة.

       قرارُ صاحب المنصّة: «أضف لوحةَ ملخّص على ملفّ المدرب تعرض: الدورات
       المحالة له، تقييمات الطلبة له، شعبه الحالية، وأقرب جلسة قادمة».
       ومن يبتّ في حالةٍ ينظر إلى أثرها: من له ثلاثُ شعبٍ جارية ليس كمن لا
       شعبةَ له، والقرارُ فيهما ليس واحدا. */
    const now = new Date()
    const cohortLinks = app.profile?.cohortTrainers ?? []
    const upcoming = cohortLinks
      .flatMap((t) => t.cohort.sessions.map((sn) => ({ ...sn, cohortTitle: t.cohort.title })))
      .filter((sn) => sn.startsAt > now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null

    /* ═══ ومن تقدّم سابقا لا يبدو جديدا ═══

       لمّا حُذفت مدّةُ الستّة أشهر (١٩ سبتمبر) صار المردودُ يتقدّم في الغد —
       وهو المقصود. وثمنُه أنّ المراجعَ يفتح الطلبَ الجديدَ ولا يعرف أنّ
       صاحبَه تقدّم قبله ورُدّ، ولا يرى السببَ الذي كُتب حينها. فيُراجَع من
       جديدٍ بلا ذاكرة، وقد يُردّ للسبب نفسِه بعد ساعةٍ من القراءة.

       والسببُ يُقرأ من سجلّ حالات الطلب القديم: آخرُ حركةٍ فيه تحمل مآلَه
       وملاحظةَ من قرّره. وهي ملاحظةٌ داخليّةٌ لم تُرسَل إلى صاحبها أصلا —
       فموضعُها هنا، أمام من يقرّر. */
    const prior = await this.prisma.trainerApplication.findMany({
      /* **ما قبله وحدَه**: لو جُمع كلُّ طلبات البريد لظهر في صفحة الطلب
         القديم طلبٌ جاء بعده تحت عنوان «تقدّم سابقا» — واللوحُ يجيب سؤالا
         واحدا: ما الذي كان قبل هذا الطلب حين نُظر فيه. */
      where: { email: app.email, id: { not: app.id }, createdAt: { lt: app.createdAt } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        reference: true, status: true, createdAt: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, note: true } },
      },
    })

    /* والجاهزيّةُ تُحسب هنا لا في الشاشة: الشاشةُ تعرض ما ينقص، والخادمُ يمنع
       به — ولو حسبت كلٌّ منهما بنفسها لظهر زرٌّ أخضرُ يردّه الخادم. */
    const readiness = await this.readinessFor(app.profile?.id ?? null)

    /* ═══ والقاعدةُ السارية يقولها الخادمُ لا تستنتجها الشاشة ═══

       «أيُّ قاعدةٍ سارية؟» سؤالٌ له جوابٌ واحدٌ في `activeRule`: نطاقُ الشعبة
       ثمّ الدورة ثمّ العامّة، والأحدثُ سريانا. وحسابُه في المتصفّح بمقارنةِ
       تواريخَ نسخةٌ ثانيةٌ تفترق عنه في أوّل تعديل — وتقول للموظّف رقما غيرَ
       الذي يُحتسب به أجرُ إنسان. */
    const activeRule = app.profile
      ? await new EarningsService(this.prisma).activeRule(app.profile.id)
      : null

    return {
      ...app,
      readiness,
      activeCompensationRule: activeRule && {
        id: activeRule.id, type: activeRule.type, rate: activeRule.rate.toString(),
        currency: activeRule.currency, minSeats: activeRule.minSeats,
        referralRate: activeRule.referralRate?.toString() ?? null,
        effectiveFrom: activeRule.effectiveFrom,
      },
      accessTokenHash: undefined, emailVerifyTokenHash: undefined,
      priorApplications: prior.map((p) => ({
        reference: p.reference, status: p.status, createdAt: p.createdAt,
        decidedAt: p.statusHistory[0]?.createdAt ?? null,
        noteAr: p.statusHistory[0]?.note ?? null,
      })),
      documentUrls: this.apps.signedDocumentUrls(app.documents),
      summary: {
        qualifiedCourses: (app.profile?.qualifications ?? [])
          .filter((q) => q.status === 'qualified')
          .map((q) => ({ courseId: q.courseId, titleAr: q.course.versions[0]?.titleAr ?? q.courseId })),
        pendingQualifications: (app.profile?.qualifications ?? []).filter((q) => q.status === 'pending').length,
        cohorts: cohortLinks.map((t) => ({
          id: t.cohort.id, title: t.cohort.title, role: t.role, status: t.cohort.status,
          courseTitle: t.cohort.course.versions[0]?.titleAr ?? t.cohort.courseId,
          enrolled: t.cohort._count.enrollments,
          startsAt: t.cohort.startsAt,
        })),
        nextSession: upcoming
          ? { title: upcoming.title, startsAt: upcoming.startsAt, cohortTitle: upcoming.cohortTitle }
          : null,
        /* التقييمُ من خرّيجين حقيقيّين — و`null` يعني «لا تقييم بعد» لا صفرا */
        rating: app.profile?.ratingAvg ?? null,
        ratingCount: app.profile?.ratingCount ?? 0,
        publicVisibility: app.profile?.publicVisibility ?? false,
        suspendedAt: app.profile?.suspendedAt ?? null,
      },
    }
  }

  /* ═══ جاهزيّةُ التجهيز — تُقرأ من القاعدة ويُحكَم بها في `readiness.ts` ═══

     ولمَ القراءةُ هنا والحكمُ هناك: الحكمُ يُقرأ في الشاشة كذلك (تعرض ما
     ينقص قبل أن يُضغط زرّ)، والقراءةُ لا تصلح في المتصفّح. فما يُقرأ في
     موضعَين يسكن `src/application`، وما يمسّ القاعدةَ يبقى في الخدمة.

     و`profileId` فارغٌ حين لا ملفَّ بعد — وهي حالُ من لم يُقبل داخليّا.
     فتُردّ الخطواتُ الثلاثُ حمراءَ، ورسالةُ المنع تدلّه على أوّل الطريق. */
  async readinessFor(profileId: string | null): Promise<Readiness> {
    if (!profileId) {
      return computeReadiness({
        compensationRules: [], qualifiedCourses: 0, openProposals: 0, contracts: [],
      })
    }
    const [rules, qualifiedCourses, openProposals, contracts] = await Promise.all([
      this.prisma.trainerCompensationRule.findMany({
        where: { profileId },
        select: {
          type: true, rate: true, courseId: true, cohortId: true,
          effectiveFrom: true, effectiveTo: true,
        },
      }),
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'qualified' } }),
      this.prisma.trainerCourseProposal.count({ where: { profileId, status: { in: [...OPEN_PROPOSAL] } } }),
      this.prisma.trainerContract.findMany({ where: { profileId }, select: { status: true } }),
    ])
    return computeReadiness({
      /* `Decimal` لا يُقارَن بـ`>` فيمرّ الصفرُ — والتحويلُ هنا مرّةً واحدة */
      compensationRules: rules.map((r) => ({ ...r, rate: Number(r.rate) })),
      qualifiedCourses,
      openProposals,
      contracts,
    })
  }

  /** جاهزيّةُ طلبٍ بعينه — تُنادى من الشاشة عبر `getApplication` */
  async readinessForApplication(applicationId: string): Promise<Readiness> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { applicationId }, select: { id: true },
    })
    return this.readinessFor(profile?.id ?? null)
  }

  /* ─────────── أدوات المراجعة البشرية ─────────── */

  async addReview(applicationId: string, reviewerId: string, input: RubricScores, overallNote?: string) {
    assertRubric(input)
    const scores = cleanRubric(input)
    /* ═══ والحدُّ حالةٌ حيّةٌ — قائمةً واحدةً لا مكتوبةً بيد (٢٦ سبتمبر ٢٠٢٦) ═══

       كانت ستّا تُعدَّ بيدٍ هنا، فيهنّ `shortlisted` و`demo_requested`. ولمّا
       حُذفتا لزم أن تُنقَص القائمة — ونقصُها بيدٍ يُبقي العطبَ الذي يحذّر
       منه هذا الملفّ: قائمتان لشيءٍ واحدٍ تفترقان.

       فصار الحدُّ `REVIEW_OPEN_STATUSES` نفسَه: من كان متقدّما يُكتَب فيه
       تقييم. وهو قرارُ صاحب المنصّة في ٢٢ سبتمبر ٢٠٢٦ بحرفه — «أبقِ كلَّ
       الخيارات مفتوحةً مهما كانت الحالةُ الحاليّة» — وقد عُمِّم به قبلَ
       اليومِ طلبُ المعلومات وخريطةُ الانتقالات. */
    await this.requireStatus(applicationId, [...REVIEW_OPEN_STATUSES])
    const review = await this.prisma.trainerApplicationReview.create({
      data: { applicationId, reviewerId, scores: scores as unknown as Prisma.InputJsonValue, overallNote },
    })
    await recordAudit(this.prisma, {
      actorId: reviewerId, action: 'trainer.review.add', entityType: 'trainer_application', entityId: applicationId,
      meta: { reviewId: review.id, scores },
    })
    return review
  }

  /* المقابلةُ كانت تُجدوَل في القاعدة ولا يُخبَر بها صاحبُها: لا رسالةَ
     ولا دعوةَ تقويم. فيُنتظَر متقدّمٌ لا يعرف أنّ له موعدا.

     فصار يصله بريدٌ فيه الموعدُ نصّا **ودعوةُ تقويم مرفَقة** يفتحها قوقل
     وآبل وأوتلوك. والإرسالُ لا يُعيق: تعذُّرُ البريد لا يُلغي الجدولة،
     ويعود حالُه في الردّ فيراه من جدول. */
  async scheduleInterview(applicationId: string, actorId: string, input: { scheduledAt: Date; mode?: string; notes?: string }) {
    /* ═══ وعطبٌ أُصلح هنا (٢٦ سبتمبر ٢٠٢٦) ═══

       كان الحدُّ `['shortlisted', 'under_review']` — أي أنّ **من كان في
       «رأيٌ ثانٍ» لا يُجدوَل له موعد**. وهي عينُ الحالة التي قال صاحبُ
       المنصّة إنّه يستعملها لهذا بالضبط: «أستعملها لمن أتردّد في دعوته إلى
       مقابلةٍ وأريد أن يقرأ ملفَّه أحدٌ آخرُ من فريقي». فالخطوةُ التالية
       للرأي الثاني هي المقابلةُ نفسُها، وكانت مقفلةً دونها — واسمُ الحالة
       في الشاشة يقول ذلك صريحا: «رأيٌ ثانٍ — قبل قرار المقابلة».

       ولم يظهر العطبُ لأنّ `shortlisted` كانت تسترُه: من أراد الجدولةَ نقله
       إليها أوّلا. فلمّا حُذفت بانَ.

       والحدُّ الآن حالةٌ حيّةٌ — `REVIEW_OPEN_STATUSES`، قائمةً واحدةً كما
       في `addReview` أعلاه. */
    await this.requireStatus(applicationId, [...REVIEW_OPEN_STATUSES])
    const interview = await this.prisma.trainerInterview.create({
      data: { applicationId, scheduledAt: input.scheduledAt, mode: input.mode ?? 'remote', interviewerId: actorId, notes: input.notes },
    })
    await this.apps.transition(applicationId, 'interview_scheduled', actorId, 'جدولة مقابلة')

    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: { fullName: true, email: true, reference: true },
    })
    let emailDelivery: DirectMailStatus = 'not_configured'
    if (app) {
      const when = fmtDateWith(input.scheduledAt, {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Amman',
      })
      const remote = (input.mode ?? 'remote') !== 'in_person'
      const ics = buildIcs({
        uid: `interview-${interview.id}@wajeez-academy`,
        title: 'مقابلة انضمام إلى نخبة مدرّبي وجيز',
        startsAt: input.scheduledAt,
        durationMinutes: TRAINER_INTERVIEW.minutes,
        description: `مقابلةٌ بشأن طلبك رقم ${app.reference}. ${remote ? 'عن بُعد — يصلك الرابط قبل الموعد.' : 'حضوريّة.'}`,
        url: `${publicSiteUrl()}/join-trainer`,
        organizer: { name: 'أكاديمية وجيز', email: ACADEMY_EMAILS.calendar },
        attendee: { name: app.fullName, email: app.email },
      })
      const res = await sendDirectEmail(this.prisma, {
        to: app.email,
        subject: 'موعد مقابلتك مع أكاديمية وجيز',
        ...renderMail({
          greetingName: app.fullName,
          heading: 'حدّدنا موعد مقابلتك',
          blocks: [
            { kind: 'facts', rows: [
              { label: 'رقم الطلب', value: app.reference },
              { label: 'الموعد', value: `${when} (بتوقيت عمّان)` },
              { label: 'المكان', value: remote ? 'عن بُعد — يصلك الرابط قبل الموعد' : 'حضوريّة' },
            ] },
            { kind: 'p', text: 'أرفقنا دعوةَ تقويمٍ مع هذه الرسالة — افتحها لتُضاف إلى تقويمك مباشرة.' },
            { kind: 'note', text: 'وإن لم يناسبك الموعد فأخبرنا بالردّ على هذه الرسالة.' },
          ],
        }),
        icsContent: ics,
        icsFilename: `wajeez-interview-${interview.id}.ics`,
      })
      emailDelivery = res.status
    }

    return { ...interview, emailDelivery }
  }

  /* ═══ والغيابُ نتيجةٌ كسائرها — ويزيد عليها أنّه يُعيد الطلب ═══

     «لم يحضر» ليس حكما على إنسان، بل خبرٌ بأنّ اللقاءَ لم يقع. فيُكتب في
     صفّ الموعد كما تُكتب النتائج، ثمّ يُردّ الطلبُ إلى ما قبل الحجز — وإلّا
     بقي واقفا في «حُدّد موعدُه» يصف موعدا مضى، فلا يُدعى صاحبُه إلى حجزٍ
     جديد ولا يظهر في طابور من ينتظر قرارا.

     والاثنان في معاملةٍ واحدة: نتيجةٌ تُكتب وحالةٌ لا تتبعها عطبٌ أسوأُ من
     ألّا تُكتب — يُقرأ الغيابُ مسجَّلا والطلبُ يقول إنّ له موعدا.

     ── ولمَ يُسأل عن العودة في كلّ نتيجةٍ لا في الغياب وحدَه ──

     لأنّ الشرطَ الحقيقيَّ ليس اسمَ النتيجة بل أثرُها: **ألم يبقَ له موعدٌ
     قائم؟** وذاك مقيسٌ في `revertWhenNoLiveInterview` نفسِها. و«ناجحٌ» على
     موعدٍ قائمٍ لا يُعيد شيئا لأنّ الموعدَ باقٍ، لا لأنّ اسمَه ليس غيابا.
     وشرطٌ زائدٌ باسم النتيجة يُقرأ حارسا وهو لا يحرس — والمقاسُ بالأثر
     أصدقُ: من أُلغي موعدُه الوحيدُ ثمّ كُتبت له نتيجةٌ متأخّرةٌ يعود كذلك،
     وهو صوابٌ كان يفوت. */
  /* ═══ ومن يسجّلها قد لا يكون له حساب (٢١ سبتمبر ٢٠٢٦) ═══

     صار قرارُ رابط التقييم يُعكَس على الموعد: «وإن وضعنا في التقييم أنّه
     اجتاز فليُعكَس على قسم المقابلة». وصاحبُ الرابط قارئٌ باسمه لا حسابَ
     له، فـ`actorId` يقبل الفراغَ — واسمُه يُكتب في `byAr` فيُقرأ في الأثر
     مَن سجّل. ولا يُفتح بذلك بابٌ: المسارُ الإداريُّ يمرّر معرّفَه كما كان،
     والرابطُ يمرّ من خدمته وحدَها بعد تحقّقها منه. */
  async recordInterviewOutcome(
    interviewId: string, actorId: string | null, outcome: string,
    notes?: string, byAr?: string,
  ) {
    const interview = await this.prisma.trainerInterview.findUnique({ where: { id: interviewId } })
    if (!interview) throw new AuthError('not_found', 'المقابلة غير موجودة', 404)

    const { updated, revertedTo } = await this.prisma.$transaction(async (tx) => {
      const row = await tx.trainerInterview.update({ where: { id: interviewId }, data: { outcome, notes } })
      const back = await revertWhenNoLiveInterview(
        tx, this.apps, interview.applicationId, actorId,
        /* والسببُ يقول ما وقع فعلا — فلا يُقرأ في السجلّ «لم يحضر» عن نتيجةٍ أخرى */
        outcome === NO_SHOW ? 'لم يحضر لقاءَ التعارف' : 'لم يبقَ للطلب موعدٌ قائم',
      )
      return { updated: row, revertedTo: back }
    })

    await recordAudit(this.prisma, {
      actorId, action: 'trainer.interview.outcome', entityType: 'trainer_application', entityId: interview.applicationId,
      meta: { interviewId, outcome, ...(byAr ? { byAr } : {}), ...(revertedTo ? { revertedTo } : {}) },
    })
    return { ...updated, revertedTo }
  }

  /* ═══ وسحبُ النتيجة حين يختلف القرّاء ═══

     العمودُ لا يسع قولَين. فإن اختلف قارئان في اللقاء نفسِه لم يبقَ لنا فيه
     قولٌ متّفَقٌ عليه — فيُسحَب المكتوبُ ويُترك فارغا، ويُعرض القولان في
     الصفّ باسمَي صاحبَيهما.

     ولا يُنادى `revertWhenNoLiveInterview` هنا: السحبُ ليس تسجيلَ نتيجة.
     وما وقع بالغياب من إعادةِ الطلب إلى ما قبل الحجز **لا يُنقَض**: انتقالٌ
     جرى في سجلّ الحالة لا يُمحى بخلافٍ بعده، وصاحبُ الطلب يحجز من جديد. */
  async clearInterviewOutcome(interviewId: string, byAr: string, whyAr: string) {
    const interview = await this.prisma.trainerInterview.findUnique({ where: { id: interviewId } })
    if (!interview || interview.outcome === null) return null
    const updated = await this.prisma.trainerInterview.update({
      where: { id: interviewId }, data: { outcome: null },
    })
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.interview.outcome_cleared',
      entityType: 'trainer_application', entityId: interview.applicationId,
      meta: { interviewId, was: interview.outcome, byAr, whyAr },
    })
    return updated
  }

  /* ═══ طلبُ الدرس التجريبيّ — مراسَلةٌ لا حالة (٢٦ سبتمبر ٢٠٢٦) ═══

     كان قرارا في `decide` يقلب الحالةَ إلى «بانتظار الدرس التجريبيّ». وقبله
     كان يقلبها **ولا يُرسل حرفا**: «فننتظر درسا لم نطلبه منه، وينتظر هو
     طلبا لم يصله» — شكاه صاحبُ المنصّة في ٢٤ سبتمبر ٢٠٢٦ فوُصلت الرسالة.

     ثمّ رأى (٢٦ سبتمبر) أنّ حالاتِ الطلب كثيرةٌ فحُذفت `demo_requested`
     فيمن حُذف. **والرسالةُ هي المقصودُ منها**، فبقيت هنا وذهبت الحالة: من
     طُلب منه درسٌ يبقى حيث هو في الطابور — «قيد المراجعة» أو «رأيٌ ثانٍ» —
     ويُقرأ الطلبُ على صفّه من الأثر (`trainer.demo.request` في
     `OUTREACH`)، كما تُقرأ دعوةُ حجز الموعد.

     وربحٌ لم يكن مقصودا: كانت النقلةُ تمحو حالتَه السابقةَ، فمن طُلب منه
     درسٌ وهو في «رأيٌ ثانٍ» يفقد وسمَ الرأي الثاني بنقرةٍ لا تعني ذلك.

     ولا يُطلب ممّن ليس متقدّما: `REVIEW_OPEN_STATUSES` هو الحدّ. ورسالةٌ
     تُطلب من مردودٍ أو مسحوبٍ أو مدرّبٍ نشطٍ خبرٌ يُحيّر قارئَه.

     وملاحظةُ المراجع تسافر معه كما كانت: «درسا تجريبيا» بلا موضوعٍ ولا
     مدّةٍ يُجيب عنها بسؤالٍ لا بدرس. */
  async requestDemo(applicationId: string, actorId: string, note?: string): Promise<{ emailDelivery: DirectMailStatus }> {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: { email: true, fullName: true, reference: true, status: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!(REVIEW_OPEN_STATUSES as readonly string[]).includes(app.status)) {
      throw new AuthError(
        'not_open',
        `حالةُ الطلب «${app.status}» ليست حالةَ متقدّمٍ يُنتظَر منه درس — فالطلبُ يصله خبرا لا معنى له`,
        409,
      )
    }
    const mail = demoRequestMail({ fullName: app.fullName, reference: app.reference, noteAr: note })
    /* والأثرُ يُكتب قبل البريد: هو الذي تُقرأ منه الشارةُ، فلو كُتب بعده
       لَسقط عن رسالةٍ خرجت حين يتعذّر ردُّ الخادم بعد الإرسال. */
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.demo.request',
      entityType: 'trainer_application', entityId: applicationId,
      meta: { reference: app.reference, noteAr: note ?? null },
    })
    /* ولا يُسقِط تعذُّرُ البريدِ الطلبَ: حالُه يعود إلى الشاشة فيراه من طلب. */
    const sent = await sendDirectEmail(this.prisma, {
      to: app.email, subject: mail.subject, ...renderMail(mail.doc),
    })
    return { emailDelivery: sent.status }
  }

  async recordDemoEvaluation(applicationId: string, evaluatorId: string, input: RubricScores, decision: 'pass' | 'retry' | 'fail', notes?: string) {
    assertRubric(input)
    const scores = cleanRubric(input)
    /* والحدُّ حالةٌ حيّة: كان `demo_requested` أوّلَ القائمة، ولمّا صار
       الطلبُ مراسَلةً لا نقلةً (`requestDemo` أعلاه) بقي صاحبُه حيث هو —
       فحدٌّ لا يقبل «قيد المراجعة» يمنع تسجيلَ درسٍ طُلب فعلا ووقع. */
    await this.requireStatus(applicationId, [...REVIEW_OPEN_STATUSES])
    const demo = await this.prisma.trainerDemoEvaluation.create({
      data: { applicationId, evaluatorId, scores: scores as unknown as Prisma.InputJsonValue, decision, notes },
    })
    await recordAudit(this.prisma, {
      actorId: evaluatorId, action: 'trainer.demo.evaluate', entityType: 'trainer_application', entityId: applicationId,
      meta: { demoId: demo.id, decision },
    })
    return demo
  }

  async addReference(applicationId: string, input: { name: string; relation?: string; contact?: string; note?: string }) {
    return this.prisma.trainerReference.create({ data: { applicationId, ...input } })
  }

  async verifyReference(referenceId: string, actorId: string) {
    return this.prisma.trainerReference.update({
      where: { id: referenceId }, data: { verifiedAt: new Date(), verifiedBy: actorId },
    })
  }

  /* ─────────── القرارات ───────────
     قرار بشري موثق — لا قرار آلي في هذه المنظومة. */

  async decide(applicationId: string, actorId: string, action:
    | 'approve'
    | 'move_to_review' | 'request_info' | 'academic_review'
    | 'conditionally_approve' | 'waitlist' | 'reject' | 'undo_reject' | 'undo_withdraw'
    | 'start_onboarding' | 'activate' | 'reinstate', note?: string,
    opts: DecideOptions = {}): Promise<{
    /* حالُ البريد حيث يكون للقرار بريدٌ يُقرأ خبرُه في الشاشة — و«تمّ» لا
       تُقال عن بريدٍ لم يخرج (`src/application/notifications/delivery.ts`).
       وهي اليومَ للتراجع عن الردّ ولإعادة المسحوب: بقيّةُ القرارات لا تقرأ الشاشةُ
       حالَ بريدها. */
    emailDelivery?: DirectMailStatus
  }> {
    /* حارس التضارب: لا يجوز لأحد اتخاذ قرار في طلب بريده هو */
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } })
    if (actor && actor.email === app.email) {
      throw new AuthError('self_decision', 'لا يجوز اتخاذ قرار في طلب مرتبط ببريدك', 403)
    }

    const targets: Record<typeof action, Parameters<TrainerApplicationService['transition']>[1]> = {
      /* ─────────── النقرةُ الواحدة ───────────

         بقرار صاحب المنصّة: الاعتمادُ نقرةٌ واحدة، وما عداه يجري خارج المنصّة.
         فـ`approve` تفعل في خطوةٍ ما كانت تفعله ثمانٍ: تُنشئ ملفَّ المدرّب،
         وتربط حسابَه وتمنحه دورَه، وتنقله إلى «نشط»، وتُعلمه.

         والسلسلةُ التفصيليّةُ باقيةٌ لمن أرادها — لم يُحذف زرٌّ واحد. */
      approve: 'active',
      move_to_review: 'under_review',
      request_info: 'information_requested',
      /* ورُفع من هنا اثنان في ٢٦ سبتمبر ٢٠٢٦ بحذف حالتَيهما: `shortlist`
         و`request_demo`. وطلبُ الدرس التجريبيّ صار `requestDemo` أسفلَه —
         مراسَلةً بلا نقلةٍ في الطابور، فرسالتُه باقيةٌ وحالتُه ذهبت.
         والقولُ في `TRAINER_STATUSES`. */
      academic_review: 'academic_review',
      conditionally_approve: 'conditionally_approved',
      waitlist: 'waitlisted',
      reject: 'rejected',
      /* التراجعُ عن الردّ — يعود إلى الطابور من أوّله لا إلى ما رُدّ منه */
      undo_reject: 'under_review',
      /* وإعادةُ المسحوب — البابُ نفسُه بسببه (٢٩ سبتمبر ٢٠٢٦، والعلّةُ في خريطة الانتقالات) */
      undo_withdraw: 'under_review',
      /* ─────────── آخرُ السلسلة ───────────

         كانت السلسلةُ تنتهي عند «قبول مشروط»، ولا زرَّ بعده. فمن اجتاز
         المراجعةَ الأكاديميّة يبقى `conditionally_approved` أو
         `contract_pending` إلى الأبد ما لم يُنشئ حسابَه بنفسه من رابط
         الدعوة — أي أنّ آخرَ قرارٍ في مسار المدرّب لم يكن بيد الإدارة أصلا.

         والقرارُ الآن مكتمل: العقدُ يُرسَل، ثمّ `start_onboarding`، ثمّ
         `activate` — وهو الاعتمادُ النهائيّ الذي يجعله مدرّبا نشطا. */
      start_onboarding: 'onboarding',
      activate: 'active',
      reinstate: 'active',
    }

    /* التفعيلُ يشترط حسابا: مدرّبٌ «نشط» بلا حسابٍ لا يفتح بوابتَه ولا يُسنَد
       إليه شيء، وحالتُه في الشاشة تقول غيرَ الحقيقة. ولا يُقال هذا بعد
       الضغط بل يُمنع قبله. */
    /* ═══ بوّابةُ التجهيز — تُفحَص قبل كلّ أثر (٢٠ سبتمبر ٢٠٢٦) ═══

       قرارُ صاحب المنصّة: «لا يُعتمَد أحدٌ اعتمادا كاملا قبل أن يتمّ تجهيزُه —
       أتعابُه ودوراتُه وعقدُه الموقَّع». وكان الاعتمادُ يمرّ بلا فحصٍ واحدٍ من
       أيّ حالة، فيصير «نشطا» بلا أجرٍ متّفقٍ عليه — و«مستحقّاتي» عنده صفرٌ
       لأنّ `computeCohort` ترمي `no_rule`، ولا أحد يعلم لمَ.

       **وتُفحَص قبل `ensureProfile` بقصد**: لو فُحصت بعده لأنشأ الضغطُ
       المردودُ ملفَّ مدرّبٍ ومهامَّ تهيئةٍ ثمّ رُدّ — أثرٌ يبقى من فعلٍ لم
       يقع. فمن لا ملفَّ له تُردّ خطواتُه الثلاثُ حمراءَ، والرسالةُ تدلّه على
       «اقبَلْه داخليّا» أوّلا.

       ── والبابُ الضيّق ──

       قرارُ ٦ سبتمبر جعل الاعتمادَ نقرةً واحدة، وهذا يفحص قبلها. ولا
       يتناقضان ما بقي للأوّل مخرجٌ **يُسمّى من سلكه ولماذا**: المديرُ الأعلى
       وحدَه، بسببٍ مكتوبٍ يُحفظ في الأثر وفي سجلّ الحالة. ومن مرّ منه مرّ
       معلوما، لا في صمت. */
    /* ═══ والنهايةُ تُقال نهايةً قبل أن يُقال «جهِّزْه» ═══

       ترتيبٌ مقصود: من ضغط «اعتمِدْه» على طلبٍ **مردود** كان يُردّ بـ«لا
       يُعتمَد قبل أن يتمّ التجهيز» — وهي دعوةٌ إلى تجهيزِ من لا سبيلَ إلى
       اعتماده. فالخريطةُ تُسأل أوّلا، ثمّ البوّابة. والسؤالُ من الدالّة
       نفسِها التي تمنع في `transition` — لا نسخةَ ثانية. */
    const transitionProblem = transitionProblemAr(app.status as TrainerStatus, targets[action])
    if (transitionProblem) throw new AuthError('bad_transition', transitionProblem, 409)

    /* ═══ ولكلّ نهايةٍ بابُها — لا يُفتح بغيره (٢٩ سبتمبر ٢٠٢٦) ═══

       الخريطةُ تسأل عن الوجهة لا عن الفعل: المردودُ والمسحوبُ يصلان «قيد
       المراجعة» كلاهما، و`move_to_review` وجهتُه هي أيضا. فكان المردودُ يُعاد
       بـ`move_to_review` بلا سببٍ ولا رسالة — أي من فوق الحارس الذي وُضع للتراجع
       — وصار المسحوبُ يُعاد بـ`undo_reject` فتصله «عُدنا في قرارنا» عن قرارٍ لم
       نتّخذه. فالفعلُ يُقابَل بالحالة هنا: النهايةُ لا تُفتح إلّا بفعلها،
       وفعلُها لا يُستعمل على غيرها. والشاشةُ تقول هذا من `DECISIONS`
       (`src/application/trainer/decisions.ts`)، وهذا قولُ الخادم به. */
    const isUndo = action === 'undo_reject' || action === 'undo_withdraw'
    const door: UndoAction | undefined = UNDO_DOORS[app.status as keyof typeof UNDO_DOORS]
    if (door && action !== door) {
      throw new AuthError(
        'bad_transition',
        `هذا الطلبُ ${UNDO_DOOR_AR[door].of} — لا يُفتح إلّا بـ«${UNDO_DOOR_AR[door].label}» وسببٍ يصل صاحبَه`,
        409,
      )
    }
    if (isUndo && !door) {
      throw new AuthError('bad_transition', `«${UNDO_DOOR_AR[action].label}» لطلبٍ ${UNDO_DOOR_AR[action].of} وحدَه`, 409)
    }

    let overrideReason: string | null = null
    if (action === 'activate' || action === 'approve') {
      const readiness = await this.readinessForApplication(applicationId)
      if (!readiness.ready) {
        if (!(opts.actorRoles ?? []).includes('super_admin')) {
          throw new AuthError('not_ready', readinessBlockMessageAr(readiness), 409)
        }
        const reason = (opts.overrideReasonAr ?? '').trim()
        const problem = overrideReasonProblemAr(reason)
        if (problem) {
          throw new AuthError(
            'override_reason_required',
            `${readinessBlockMessageAr(readiness)} — ولك أن تتجاوزها: ${problem}`,
            422,
          )
        }
        overrideReason = reason
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.readiness.override',
          entityType: 'trainer_application', entityId: applicationId,
          meta: { decision: action, reasonAr: reason, missingAr: readiness.blockersAr },
        })
      }
    }

    /* ═══════════ ولا يُعتمَد مَن لم تُقرأ موادُّه (٢٦ سبتمبر ٢٠٢٦) ═══════════

       بلاغُ صاحب المنصّة: «ما وجدتُ بالتجربة أنّك اعتمدتَ المدرّبَ رسميّا عند
       توقيعي — وهذا خطأ. اعتمدِ العقدَ المشروط وينتقل لمرحلة وضع المواد، وبعد
       أن يضع المواد كاملا أقول إنّه ١٠٠٪ نشط».

       وهو خطأٌ منّي: نُفِّذ قرارُه الأوّلُ («بعد أن أوقّع كأدمن يتحوّل إلى
       مدرّب نشط مباشرة») بحرفه بلا الحارس الذي يجعله **اعتمادَ موادَّ** لا
       تخطّيا لها. فكان الزرُّ يعمل بعد توقيع المدرّب بثانية.

       ── ولمَ هنا لا في `approveSignature` ──

       بابا الاعتماد اثنان: زرُّ شاشة العقود (يمرّ من هنا)، وزرُّ شاشة الطلبات
       (`activate` و`approve` مباشرةً). ولو وُضع الحارسُ في الأوّل وحدَه لَبقي
       الثاني مفتوحا — وهو المخنقُ الذي تُنادى منه `completeConditionalOffer`
       أصلا. فالحارسُ حيث يقع القرارُ لا حيث تُضغط إحدى نقراته.

       ── وترتيبُه بعد بوّابة التجهيز بقصد ──

       تلك تقول «لم نجهّزه نحن»، وهذه تقول «لم يفرغْ هو». وقولُ الثانية لمن لم
       تُضبَط أتعابُه بعدُ يُقدّم آخرَ الطريق على أوّله. */
    if (action === 'activate' || action === 'approve') {
      const openOffer = await this.prisma.trainerContract.findFirst({
        where: {
          profile: { applicationId },
          /* ═══ وحالتان لا واحدة (٢٧ سبتمبر ٢٠٢٦) ═══

             صار الاعتمادُ يقع **قبل** طور الموادّ، فالعرضُ في أثناء الطور
             `countersigned` لا `signed`. ولو بقي الشرطُ على `signed` وحدَها
             لَما وجدت هذه البوّابةُ عرضا مفتوحا أصلا — فتمرّ وتُنشَر حساباتٌ
             لم تُعتمَد موادُّها. و`signed` تبقى: من وُقِّع عرضُه ولم نعتمد
             توقيعَه بعدُ أولى بالمنع.

             ═══ وثلاثٌ لا اثنتان (١ أكتوبر ٢٠٢٦) ═══
             صار اعتمادُ التوقيع في العرض المشروط لا يختم (`signature_approved`)،
             ونختمه هنا حين تُعتمَد موادُّه. فهي حالُ طور الموادّ من اليوم،
             و`countersigned` تبقى لصفوف ٢٧ سبتمبر — ١ أكتوبر التي خُتمت عند
             اعتماد التوقيع. */
          gatesActivation: true, status: { in: ['signed', 'signature_approved', 'countersigned'] }, conditionMetAt: null,
        },
        orderBy: { signedAt: { sort: 'desc', nulls: 'last' } },
        select: {
          id: true, orientationAt: true, conditionDeadlineAt: true,
          conditionPausedAt: true, conditionExtendedAt: true, conditionMetAt: true,
          conditionExtensionsUsed: true,
        },
      })
      const materialsProblem = openOffer
        ? materialsGateProblemAr({ ...openOffer, now: new Date() })
        : null
      if (materialsProblem) {
        if (!(opts.actorRoles ?? []).includes('super_admin')) {
          throw new AuthError('materials_pending', materialsProblem, 409)
        }
        /* والمخرجُ مخرجُ بوّابة التجهيز نفسُه: المديرُ الأعلى وحدَه، بسببٍ
           يُكتب. ولا حقلَ ثانٍ له — فمن تجاوز البوّابتَين كتب سببا واحدا،
           وكلُّ واحدةٍ تكتب أثرَها بما نقص عندها. */
        const reason = (opts.overrideReasonAr ?? '').trim()
        const problem = overrideReasonProblemAr(reason)
        if (problem) {
          throw new AuthError(
            'override_reason_required', `${materialsProblem} — ولك أن تتجاوزه: ${problem}`, 422,
          )
        }
        overrideReason = overrideReason ?? reason
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.materials.override',
          entityType: 'trainer_application', entityId: applicationId,
          meta: {
            decision: action, reasonAr: reason,
            contractId: openOffer!.id, problemAr: materialsProblem,
          },
        })
      }
    }

    if (action === 'activate' || action === 'approve') {
      /* النقرةُ الواحدة تُنشئ الملفَّ إن لم يكن — فهي تختصر «القبولَ المشروط»
         الذي كان ينشئه. و`activate` تبقى على شرطها: ملفٌّ موجودٌ مسبقا. */
      const profile = action === 'approve'
        ? await this.ensureProfile(applicationId, app, actorId)
        : await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
      if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب', 409)
      if (!profile.userId) {
        /* للمتقدّم حسابٌ منذ تقديمه: التفعيلُ يربطه بالملفّ ويمنحه دورَ المدرّب
           — فتُفتح له بوّابتُه من الحساب نفسه الذي تابع به طلبه. */
        if (app.userId) {
          await this.linkApplicantAsTrainer(profile.id, app.userId, actorId)
        } else {
          throw new AuthError(
            'no_account',
            'لا حساب لهذا المدرّب بعد — أرسل دعوة إنشاء الحساب أوّلا، فالتفعيل بلا حساب يجعله نشطا ولا يستطيع الدخول',
            409,
          )
        }
      }
      /* ═══ ويُؤهَّل لما قال إنّه يُتقنه ═══

         كان الاعتمادُ يُنشئ ملفّا بلا تأهيلٍ واحد، فيفتح المدرّبُ بوّابتَه
         ويقرأ: «لا تأهيلَ بعد — التأهيلُ يقع من الإدارة». وهو قد كتب في طلبه
         الدوراتِ التي يستطيع تدريسَها، وقرأها المراجعُ واعتمده عليها. فسؤالُه
         عنها مرّةً ثانيةً في طابورِ طلباتٍ تكرارٌ لقرارٍ وقع.

         قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): المعتمَدُ مؤهَّلٌ لكلّ ما ذكره في
         طلبه، وتضيف الإدارةُ فوقَه ما تراه. */
      await this.syncQualificationsFromApplication(profile.id, actorId)
    }

    /* ═══ ولا يُنقض ردٌّ بلا كلمةٍ تُقال لصاحبه ═══

       الشرطُ هنا لا في الشاشة وحدَها: مسارُ الإدارة يُنادى من غيرها (دفعةً
       أو بأداة)، وقرارٌ ينقلب على صاحبه مرّتين بلا سببٍ أسوأُ من قرارٍ واحد.
       والحدُّ عشرةُ أحرف: «خطأ» و«عدنا» لا تشرحان شيئا لمن يقرؤها بعد
       اعتذار. والنصُّ يُرسَل كما كُتب — فهو مكتوبٌ له لا للأثر. */
    const undoReason = isUndo ? (note ?? '').trim() : ''
    if (isUndo && undoReason.length < 10) {
      throw new AuthError(
        'reason_required',
        action === 'undo_reject'
          ? 'اكتب سببَ التراجع عن الرفض — يصل المتقدّمَ بنصّه، ولا يُنقض قرارٌ في صمت'
          : 'اكتب سببَ إعادة الطلب — يصل صاحبَه بنصّه، ولا يُعاد طلبٌ في صمت',
        422,
      )
    }

    /* ═══ ولا يُعاد إلّا آخرُ طلبٍ لصاحبه (٢٩ سبتمبر ٢٠٢٦) ═══

       المردودُ والمسحوبُ نهايتان تسمحان لصاحب البريد بطلبٍ جديد
       (`TERMINAL_STATUSES`). فمن سحب ثمّ تقدّم ثانيةً فأمامنا حالان:

       ① **طلبُه الجديدُ قائم** — وإعادةُ الأوّل تجعل له اثنين في الطابور
          يُقرَّر في كلٍّ منهما بمعزلٍ عن أخيه. فتُردّ ويُسمّى القائم: ذاك يُكمَل.
       ② **أو انتهى هو أيضا** — والقديمُ فُكّ عن الحساب يومَ تقدّم ثانيةً
          (`trainer.application.reapply` في `submitPhase1`). فإعادتُه تُخرج طلبا
          حيّا لا يراه صاحبُه في حسابه، ولا يجده الاعتمادُ حين يبحث عن حسابٍ
          يمنحه دورَه. فتُردّ ويُسمّى الأحدث: هو الذي يُعاد.

       والحارسُ للبابَين معا — فالمردودُ يتقدّم ثانيةً كما يتقدّم المسحوب. */
    if (isUndo) {
      const other = await this.prisma.trainerApplication.findFirst({
        where: {
          email: app.email, id: { not: app.id },
          OR: [{ status: { notIn: TERMINAL_STATUSES } }, { createdAt: { gt: app.createdAt } }],
        },
        orderBy: { createdAt: 'desc' },
        select: { reference: true, status: true },
      })
      if (other && !TERMINAL_STATUSES.includes(other.status as TrainerStatus)) {
        throw new AuthError(
          'live_application_exists',
          `لصاحب هذا البريد طلبٌ قائمٌ غيرُه (${other.reference}) — يُكمَل ذاك، ولا يُعاد هذا فيصيرَ له طلبان`,
          409,
        )
      }
      if (other) {
        throw new AuthError(
          'newer_application_exists',
          `تقدّم صاحبُ هذا البريد بعده بطلبٍ أحدث (${other.reference}) — أعِدْ ذاك إن أردت: هذا فُكّ عن حسابه يومَ تقدّم ثانيةً`,
          409,
        )
      }
    }

    /* وسببُ التجاوز يُكتب في سجلّ الحالة مع الملاحظة — فالأثرُ يُقرأ بصلاحيّة،
       وسجلُّ الحالة يُقرأ في ملفّ المدرّب أمام من يفتحه. */
    const transitionNote = overrideReason
      ? [note?.trim(), `تجاوزُ بوّابة التجهيز: ${overrideReason}`].filter(Boolean).join(' — ')
      : note
    /* ═══ ومن طُلبت منه معلوماتٌ يعود إلى حيث كان (٢٢ سبتمبر ٢٠٢٦) ═══

       لمّا فُتح طلبُ المعلومات من كلّ حالةٍ حيّة — ومنها ما بعد القبول
       الداخليّ — صار الرجوعُ سؤالا: استكمالُ المرحلة الثانية كان ينقل
       صاحبَه إلى `under_review` مسكوكةً، فمن كان في «التهيئة» فطُلبت منه
       ورقةٌ ثمّ أرسلها يهبط إلى **أوّل الطابور** — يخسر تجهيزَه وعقدَه
       وموضعَه لأنّه أجاب.

       فيُحفظ موضعُه هنا، ويُعاد إليه هناك. ويُمحى حين يُقرَّر فيه شيءٌ
       آخر، فلا يبقى وعدٌ بموضعٍ انقضى. */
    if (action === 'request_info') {
      await this.prisma.trainerApplication.update({
        where: { id: applicationId },
        data: { infoRequestedFrom: app.status },
      })
    } else if (app.infoRequestedFrom) {
      await this.prisma.trainerApplication.update({
        where: { id: applicationId },
        data: { infoRequestedFrom: null },
      })
    }

    await this.apps.transition(applicationId, targets[action], actorId, transitionNote)

    /* رفعُ الإيقاف يُعيد الملفَّ والحساب معا — وإلّا بقي «نشطا» وحسابُه موقوف */
    if (action === 'reinstate') {
      const profile = await this.prisma.trainerProfile.findUnique({
        where: { applicationId },
        include: { user: { select: { roles: { select: { roleId: true } } } } },
      })
      if (profile) {
        /* الإيقافُ يطفئ `publicVisibility` (suspendTrainer أدناه) ورفعُه لم يكن
           يعيدها — فيعود المدرّبُ «نشطا» ويبقى مخفيّا من الصفحة العامّة
           والتقويم حتّى يُضغط «اعتمِد ظهورَه العامّ» ثانيةً، ولا أحدَ يعلم أنّ
           ذلك مطلوب. فيعود إلى ما كان عليه: ظاهرا إن كان نشرُه معتمَدا. */
        await this.prisma.trainerProfile.update({
          where: { id: profile.id },
          data: { suspendedAt: null, suspendedBy: null, publicVisibility: profile.publishApprovedAt !== null },
        })
        /* ولا يُرفع عن الحساب إلّا ما أوقفه هذا المسارُ نفسُه: `suspendTrainer`
           لا يوقف دخولَ من له موقعٌ فوقَ التدريب، فرفعُه هنا يُنشِّط حسابا
           أوقفته شاشةُ المستخدمين لسببٍ آخرَ — رفعُ إيقافٍ بلا قرارٍ برفعه. */
        if (profile.userId && !holdsRoleBeyondTrainer(profile.user?.roles.map((r) => r.roleId) ?? [])) {
          await this.prisma.user.update({ where: { id: profile.userId }, data: { status: 'active', suspendedAt: null } })
        }
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.reinstate', entityType: 'trainer_profile', entityId: profile.id, meta: { note },
        })
      }
    }

    /* القبول المشروط ينشئ ملف المدرب — قبل الحساب وقبل الدور.

       ويبذر مؤهّلاتِه معه: العقدُ يُرسَل من هذا الطور، وبندُه الثاني يعدّد
       ما أُهِّل له. وكان البذرُ في `approve`/`activate` وحدَهما، فيخرج
       الملحقُ (أ) فارغا في كلّ عقدٍ يُرسَل على المسار الذي وُصف. والبذرُ
       آمنٌ يُعاد: `skipDuplicates` على `(profileId, courseId)`، فمن أُهِّل
       يدويّا لا يُكرَّر ومن رُدّ يبقى مردودا. */
    if (action === 'conditionally_approve') {
      const profile = await this.ensureProfile(applicationId, app, actorId)
      await this.syncQualificationsFromApplication(profile.id, actorId)
    }

    /* ولا يُعتمَد أحدٌ في صمت: النقرةُ الواحدة تُنهي المسارَ كلَّه، فلو لم
       تُعلمه لَبقي ينتظر ردّا وصل ولا يعلم. وإخفاقُ البريد لا يُسقط الاعتماد
       — هو حقيقةٌ في القاعدة، والرسالةُ إشعارٌ بها؛ فيُسجَّل الإخفاقُ ويُكمَل.

       ═══ و`activate` تُبلّغ كما تُبلّغ `approve` (٢٣ سبتمبر ٢٠٢٦) ═══

       كان البريدُ على `approve` وحدَها — وهي النقرةُ الواحدةُ التي تختصر
       المسار. أمّا من مشى السلسلةَ (عرضٌ ← توقيعٌ ← تفعيل) فيصير نشطا
       **في صمت**: بوّابتُه تُفتح ولا يعلم، فلا يدخلها. وهو أسوأُ صمتٍ في
       المسار كلِّه، إذ يقع في آخره بعد أن وقّع وانتظر. */
    if (action === 'approve' || action === 'activate') {
      await this.completeConditionalOffer(applicationId, app, actorId, opts.sealNoteAr)
    }

    /* ═══ ولا يُطلب من أحدٍ شيءٌ في صمت ═══

       «اطلب معلومات إضافية» كانت تنقل الحالةَ ولا ترسل شيئا. فالمتقدّمُ يقف
       في `information_requested` لا يعلم أنّ شيئا طُلب منه — إلّا أن يفتح
       صفحةَ حالته من تلقاء نفسه ويقرأ اسمَ الحالة. وقد وقع ذلك فعلا.

       والرسالةُ تحمل **نصَّ ما نريده** لا اسمَ الحالة: الملاحظةُ التي يكتبها
       المراجعُ هي السؤال، وبدونها الرسالةُ «نحتاج معلوماتٍ إضافية» — وهي لا
       تقول شيئا. ولذلك تُطلب الملاحظةُ في الشاشة قبل الضغط. */
    if (action === 'request_info') {
      await this.notifyInfoRequested(app.email, app.fullName, app.reference, note, actorId, applicationId)
    }

    /* ═══ ولا يُردّ أحدٌ في صمت، ولا يُترك منتظِرا بلا خبر (ي-٤) ═══

       كان `decide` يفرّق ثلاثةَ قراراتٍ في الإبلاغ: الاعتمادُ يُرسَل، وطلبُ
       المعلومات يُرسَل، و**الردُّ والانتظارُ لا رسالةَ لهما أصلا**. فمن رُدّ
       طلبُه يبقى يتفقّد صفحةَ حالته شهرا، ومن وُضع في الانتظار يظنّ أنّه
       رُدّ — والاثنان أعطيانا وقتَهما وسيرتَهما.

       وهذه هي الثغرةُ التي كان `trainer.status.transition` يخفيها: ذاك
       مَخنقُ ستّةَ عشرَ حالة، والإبلاغُ عنده يوقظ الناسَ على تنقّلاتٍ
       داخليّةٍ لا تعنيهم. وموضعُ الإصلاح هنا، حيث يقع القرارُ ويُعرف.

       ═══ وسببُ الرفض لا يصل صاحبَه (١٨ سبتمبر ٢٠٢٦) ═══

       كان يصله في جدولٍ مؤطَّرٍ عنوانُه «وممّا كُتب في المراجعة». وقرارُ
       صاحب المنصّة أن يبقى في الأثر الداخليّ وحدَه: ما يكتبه المراجعُ يُكتب
       لعينِ مراجعٍ آخرَ لا لعين صاحب الطلب، وسطرٌ واحدٌ منه يُقرأ حكما على
       الشخص. والملاحظةُ تبقى مطلوبةً في الشاشة ومكتوبةً في الأثر — فالقرارُ
       يُسأل عنه بعد شهرٍ ويُجاب.

       وقائمةُ الانتظار تبقى على ملاحظتها: تلك تقول «ننتظرك لأجل كذا»، وهي
       خبرٌ لصاحبها لا حكمٌ عليه. والفرقُ مفحوصٌ في
       `src/tests/trainer-decision-mail.test.ts`. */
    if (action === 'reject' || action === 'waitlist') {
      await this.notifyDecision(app.email, action, {
        fullName: app.fullName, reference: app.reference, noteAr: note,
      })
    }

    /* (وكانت هنا كتلةُ «طلبِ الدرس التجريبيّ» — انتقلت إلى `requestDemo`
       أسفلَه حين رُفعت حالتُها في ٢٦ سبتمبر ٢٠٢٦: صار الطلبُ مراسَلةً
       لا قرارا يقلب الحالة، فلا موضعَ له في خريطة القرارات.) */

    /* ═══ والتراجعُ يصل صاحبَه بسببه — وإلّا فهو تصحيحٌ في دفترنا لا عنده ═══

       من رُدّ طلبُه قرأ اعتذارا وأغلق الباب. فلو نُقض الردُّ في القاعدة وحدَها
       لبقي هو على خبره الأوّل: لا يتفقّد صفحةَ حالةٍ أغلقها، ولا يحجز موعدا
       لا يعلم أنّه فُتح له. والرسالةُ تحمل السببَ بنصّه بقرار صاحب المنصّة —
       وهي الموضعُ الوحيدُ الذي يسافر فيه ما يكتبه المراجعُ في هذا المسار. */
    if (isUndo) {
      const mailInput = {
        fullName: app.fullName, reference: app.reference, noteAr: undoReason,
        statusUrl: `${publicSiteUrl()}/join-trainer`,
      }
      /* ولكلّ بابٍ رسالتُه: «عُدنا في قرارنا» لمن رُدّ، و«أعدنا فتحَ طلبك» لمن
         سُحب — وفيها أنّه إن كان سحبه بيده ولا يريد المضيَّ يردّ فنغلقه. */
      const mail = action === 'undo_reject' ? rejectionUndoneMail(mailInput) : withdrawalUndoneMail(mailInput)
      const sent = await sendDirectEmail(this.prisma, { to: app.email, subject: mail.subject, ...renderMail(mail.doc) })
      /* والحالُ يُعاد إلى الشاشة لا يُبتلع: القرارُ وقع، وما قد لا يقع خروجُ
         البريد وحدَه — فمن رُفع رفضُه ولم يبلغه الخبرُ يُبلَّغ بيد من قرّر. */
      return { emailDelivery: sent.status }
    }

    return {}
  }

  /* ═══ قرارٌ يصل صاحبَه — ولا يُسقط القرارَ إن أخفق البريد ═══

     والنصُّ ليس هنا: هو في `trainer-decision-mail.ts` دالّةً خالصةً يحرسها
     المسارُ السريع. ومكتوبٌ في رأسه لماذا — وفيه يقع إسقاطُ سببِ الرفض عن
     رسالة صاحبه. وهذه تُرسل ما رُدَّ إليها ولا تؤلّف حرفا. */
  private async notifyDecision(
    to: string, action: 'reject' | 'waitlist',
    input: { fullName: string; reference: string; noteAr?: string },
  ): Promise<void> {
    const mail = decisionMailFor(action, input)
    await sendDirectEmail(this.prisma, { to, subject: mail.subject, ...renderMail(mail.doc) })
  }

  /* ═══ رابطُ الحجز في البريد يتبع ما ضُبط في التكاملات ═══

     الشاشةُ تقرأ `interviewBookingUrl` من إعداد المنصّة وتسقط إلى المضمَّن
     حين لا بديل. والبريدُ كان يأخذ المضمَّنَ دائما — فمن بدّل التقويمَ من
     شاشة التكاملات بدّلَه في الموقع وحدَه، وبقيت الرسائلُ تدعو إلى تقويمٍ
     لم يعد أحدٌ يفتحه. والوجهتان يجب أن تكونا واحدة. */
  /* ═══ والحاضرون يركبون رابطَ البريد كما يركبون رابطَ الشاشة ═══

     `guests=` يُضاف في `BookInterview.tsx` من إعداد التكاملات، فمن حجز من
     الموقع خرجت دعوتُه وفيها من ضُبطوا. وكان بريدُ الدعوة يبني رابطَه هنا
     **بلا `guests`** — فمن حجز من البريد خرجت دعوتُه ناقصةً منهم صامتةً:
     لا خطأَ يظهر، ولا فرقَ يُرى إلّا في التقويم يومَ الموعد.

     وصاحبُ المنصّة وصفه بعينه (٢٤ سبتمبر ٢٠٢٦): أن يُرفَق بدعوةِ البريد
     مَن يُرفَق بدعوةِ الموقع — «كما هو الحال لو وصلها من طلب التقديم سابقا».
     والوجهةُ واحدةٌ فالحمولةُ واحدة.

     ولا يُسمَّى أحدُهم هنا: من ضُبطوا في شاشة التكاملات هم من يُرفَقون،
     ويُبدَّلون من هناك بلا نشر. وعنوانٌ يُكتب حرفا في هذا الملفّ يفترق يوما
     عن ذاك — وله حارسٌ يمنعه (`academy-email`).

     ⚠ وشرطُ Calendly باقٍ: «Invitees can add guests» مفعَّلا في نوع الحدث،
     وإلّا تجاهل المعامَلَ صامتا هنا كما يتجاهله هناك. */
  private async bookingLink(input: { name: string; email: string; reference: string }): Promise<string> {
    const calendly = await getCalendlyConfig(this.prisma)
    return trainerInterviewUrl(
      { ...input, guests: calendly.guests || undefined },
      calendly.bookingUrl || undefined,
    )
  }

  /* ═══ دعوةٌ إلى حجزِ موعدٍ آخر — بنقرةٍ واحدة ═══

     الجدولةُ اليدويّةُ فوقَها تفرض موعدا وترسله. وهي تصلح للأوّل، ولا تصلح
     حين نريد لقاءً ثانيا: فالمُقابِلُ لا يعرف فراغَ المتقدّم، والمتقدّمُ لا
     يعرف فراغَنا — فتذهب رسالتان أو ثلاث قبل أن يُتّفق على ساعة.

     فهذه تدعوه ليختار هو من التقويم نفسِه الذي يحجب ما حُجز. ولا تنقل حالةَ
     الطلب: هي دعوةٌ لا قرار، والحالةُ تتغيّر حين يُحجَز فعلا. */
  async inviteToBookInterview(applicationId: string, actorId: string): Promise<{ emailDelivery: string }> {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: { email: true, fullName: true, reference: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    const link = await this.bookingLink({ name: app.fullName, email: app.email, reference: app.reference })
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: `موعدٌ آخر معنا — اختر ما يناسبك (${app.reference})`,
      ...renderMail({
        greetingName: app.fullName,
        heading: 'نودّ أن نلتقيك مرّةً أخرى',
        blocks: [
          { kind: 'p', text: 'اخترْ من التقويم الوقتَ الذي يناسبك — تظهر لك الأوقاتُ المتاحةُ وحدَها، ويصلك التأكيدُ ودعوةُ التقويم فورَ اختيارك.' },
          { kind: 'cta', label: 'اختر موعدك', href: link },
          { kind: 'facts', rows: [
            { label: 'رقم الطلب', value: app.reference },
            { label: 'المدّة', value: `${TRAINER_INTERVIEW.minutes} دقيقة` },
            { label: 'المكان', value: `عن بُعد عبر ${TRAINER_INTERVIEW.platformAr}` },
          ] },
          { kind: 'note', text: 'ولو لم يناسبك أيُّ وقتٍ معروض، ردَّ على هذه الرسالة وسنرتّب غيرَه.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.interview.invite', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, emailDelivery: mail.status },
    })
    return { emailDelivery: mail.status }
  }

  /* ═══ دعوةُ من وصل طلبُه ولم يحجز موعده ═══

     الحجزُ شاشةٌ تُرى مرّةً واحدةً بعد الإرسال، ومن أغلقها ليعود «لاحقا» لا
     يعود. فيقف طلبٌ كاملٌ بلا لقاءٍ ونحسبه متأخّرا وهو ينتظرنا.

     وهي غيرُ الدعوة فوقَها: تلك تقول «نودّ أن نلتقيك مرّةً أخرى» — نصٌّ لا
     يصلح لمن لم يلتقِنا بعد. وهذه تقول «مهتمّون بملفّك ونرغب بلقائك» (قرارُ
     صاحب المنصّة، ٢٢ سبتمبر ٢٠٢٦؛ وكانت تقول «بقيت خطوةٌ واحدة» — نبرةَ
     استمارةٍ ناقصة). ونصُّها في `interview-invitation.ts`، تقرؤه هذه الرسالةُ
     وبطاقةُ صفحته معا، فلا يفترق ما في بريدنا عمّا في موقعنا.

     ═══ ولا يُذكَّر أحدٌ بما فعله ═══

     الحارسان أدناه ليسا تجميلا: رسالةُ «لم تحجز» تصل من حجز أمس فتُقرأ
     إهمالا منّا، ورسالةٌ تصل من رُدَّ طلبُه تدعوه إلى موعدٍ لن يكون — وكلاهما
     أسوأُ من السكوت. فيُردّان قبل الإرسال لا بعده.

     ووجهةُ زرِّها صفحةُ طلبه لا التقويمُ رأسا — في `trainer-decision-mail.ts`
     مكتوبٌ لماذا. */
  /* ═══ تذكيرُ من بدأ ولم يُكمل ═══

     طلبه صاحبُ المنصّة (٢٠ سبتمبر ٢٠٢٦): «ذكّره أن يكمل التقديم إذا كان
     مسوّدة» — فعلا يُضغط من قائمة الصفّ كأخيه تذكيرِ الحجز.

     والشرطُ حالةٌ واحدة: `draft`. فمن أكمل لا يُقال له «أكمل»، ومن وقف عند
     توثيق البريد بابُه غيرُ هذا (رسالةُ التوثيق تُعاد من حسابه). والرفضُ
     يقول أيَّ حالةٍ هو فيها — «لا يُذكَّر» وحدَها لا تقول للموظّف لماذا. */
  async remindDraftApplicant(applicationId: string, actorId: string): Promise<{ emailDelivery: string }> {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: { email: true, fullName: true, reference: true, status: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (app.status !== 'draft') {
      throw new AuthError(
        'not_draft',
        `الطلبُ في حالة «${app.status}» لا في مسوّدة — فلا يُقال لصاحبه «أكمل» وقد أكمل`,
        409,
      )
    }

    const mail = draftReminderMail({
      fullName: app.fullName,
      reference: app.reference,
      statusUrl: `${publicSiteUrl()}/join-trainer/status`,
    })
    const sent = await sendDirectEmail(this.prisma, {
      to: app.email, subject: mail.subject, ...renderMail(mail.doc),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.application.draft_remind', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, emailDelivery: sent.status },
    })
    return { emailDelivery: sent.status }
  }

  /* ═══ متابعةُ من لم يحضر — رسالةٌ تُختار ومتنٌ يُعدَّل (٢٣ سبتمبر ٢٠٢٦) ═══

     طلبُ صاحب المنصّة: زرٌّ يُرسل لمن غاب رسالةَ اطمئنان، «فبعضُهم نريده أن
     يعود ويحجز موعدا آخر، وبعضُهم لا نريد عودتَه — فنشكره بلطفٍ ولا ندعوه».
     والرسالتان ونصُّهما ومن يُتابَع في `no-show-followup.ts`.

     ═══ وما يحرسه هذا المسار ═══

     ① **لا يُتابَع إلّا غائب** — بالمِحَكّ المشترك نفسِه الذي يعرض الزرَّ في
        الشاشة. فرسالةُ «لاحظنا أنّك لم تحضر» تصل من حضر ولُقي فتُقرأ إهمالا
        منّا، أو من رُدَّ طلبُه فتُقرأ أملا كاذبا.
     ② **ولا يُتابَع غيابٌ مرّتين** — الأثرُ يحمل معرّفَ الموعد، فيُسأل عنه
        قبل الإرسال. ورسالةُ اطمئنانٍ ثانيةٌ على الغياب نفسِه تُقرأ آليّةً،
        وتنقض أوّلَ ما جاءت له: أن يشعر بأنّ إنسانا كتب إليه.
     ③ **والمتنُ يُقاس لا يُصدَّق** — صندوقٌ فرّغه الموظّفُ سهوا ثمّ ضغط
        يُنتج رسالةً بعنوانٍ ولا متنَ فيها. فالحدُّ في الوحدة المشتركة،
        تقرؤه الشاشةُ لتُعطّل الزرَّ ويقرؤه الخادمُ ليردّ.
     ④ **والحالةُ تُنقل قبل أن يُرسَل البريد** — لا بعده. فإن تعثّر النقلُ
        لم تخرج رسالةٌ تقول «نتطلّع إلى فرصٍ أخرى» وصاحبُها ما زال يُدعى إلى
        الحجز في صفحته. والعكسُ أهونُ: حالةٌ نُقلت وبريدٌ لم يخرج **يُقال
        صريحا** في جواب المسار، فيُعاد إرسالُه بيدٍ لا يُكتشف بعد شهر. */
  async followUpNoShow(
    applicationId: string, actorId: string,
    input: { variant: string; bodyAr: string },
  ): Promise<{ emailDelivery: string; movedTo: string | null }> {
    const followup = followupOf(input.variant)
    if (!followup) throw new AuthError('unknown_variant', 'رسالةٌ لا نعرفها', 400)

    const bodyAr = input.bodyAr.trim()
    if (bodyAr.length < FOLLOWUP_BODY_MIN || bodyAr.length > FOLLOWUP_BODY_MAX) {
      throw new AuthError(
        'body_out_of_range',
        `نصُّ الرسالة بين ${FOLLOWUP_BODY_MIN} و${FOLLOWUP_BODY_MAX} حرفا — والفارغُ يُنتج رسالةً بعنوانٍ بلا متن`,
        400,
      )
    }

    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: {
        email: true, fullName: true, reference: true, status: true,
        /* أحدثُ ما سُجّلت نتيجتُه — وهو المِحَكُّ نفسُه الذي يبني به الطابورُ
           `interviewOutcome`، فلا يقرأ الزرُّ غيابا لا يراه الصفّ. */
        interviews: {
          where: { outcome: { not: null } },
          orderBy: { scheduledAt: 'desc' },
          take: 1,
          select: { id: true, outcome: true },
        },
      },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    const last = app.interviews[0]
    if (!canFollowUpNoShow({ status: app.status, interviewOutcome: last?.outcome ?? null })) {
      throw last?.outcome === NO_SHOW
        ? new AuthError(
            'not_followable',
            `حالةُ الطلب «${app.status}» بُتَّ فيها — فلا يُدعى صاحبُها إلى موعدٍ ولا يُنقل إلى انتظار`,
            409,
          )
        : new AuthError('no_absence', 'لم يُسجَّل له غيابٌ — ولا يُقال لمن حضر إنّه لم يحضر', 409)
    }

    const already = await this.prisma.auditEvent.count({
      where: {
        entityType: 'trainer_application', entityId: applicationId,
        action: 'trainer.no_show.followup',
        meta: { path: ['interviewId'], equals: last!.id },
      },
    })
    if (already > 0) {
      throw new AuthError('already_followed_up', 'تُوبع غيابُه هذا فعلا — ورسالةٌ ثانيةٌ عليه تُقرأ آليّة', 409)
    }

    /* والنقلُ أوّلا — ولمَ، مكتوبٌ فوقُ في ④ */
    let movedTo: string | null = null
    if (followup.movesTo && app.status !== followup.movesTo) {
      await this.apps.transition(
        applicationId, followup.movesTo, actorId,
        'لم يحضر لقاءَ التعارف — وتُوبع برسالة شكرٍ بلا دعوة',
      )
      movedTo = followup.movesTo
    }

    /* والتقويمُ يُبنى هنا لا في الرسالة: بناؤه يقرأ إعدادَ التكاملات
       (تقويمٌ بديلٌ وحاضرون)، والرسالةُ دالّةٌ خالصة. */
    const mail = noShowFollowupMail({
      followup,
      fullName: app.fullName,
      reference: app.reference,
      bodyAr,
      statusUrl: `${publicSiteUrl()}/join-trainer/status`,
      bookingUrl: await this.bookingLink({
        name: app.fullName, email: app.email, reference: app.reference,
      }),
    })
    const sent = await sendDirectEmail(this.prisma, {
      to: app.email, subject: mail.subject, ...renderMail(mail.doc),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.no_show.followup', entityType: 'trainer_application', entityId: applicationId,
      /* والمتنُ يُكتب في الأثر كما خرج: رسالةٌ يكتبها إنسانٌ إلى إنسانٍ
         تُسأل عنها بعد شهر — «ماذا قلنا له؟» لا يُجاب عنه بمفتاح. */
      meta: {
        interviewId: last!.id, variant: followup.key, bodyAr,
        sentTo: app.email, emailDelivery: sent.status, ...(movedTo ? { movedTo } : {}),
      },
    })
    return { emailDelivery: sent.status, movedTo }
  }

  async remindToBookInterview(applicationId: string, actorId: string): Promise<{ emailDelivery: string }> {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: {
        email: true, fullName: true, reference: true, status: true,
        /* الملغاةُ لا تُحسب: من ألغى موعدَه لم يعد له موعد، وهو أحوجُ الناس
           إلى التذكير. وهو القيدُ نفسُه الذي يعدّ به الطابورُ مقابلاتِه. */
        _count: { select: { interviews: { where: LIVE_INTERVIEW } } },
      },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    /* المِحَكُّ من الوحدة المشتركة — هو نفسُه الذي يقرّر عرضَ الزرّ في الشاشة.
       والسببُ يُفصَّل بعده: «لا يُذكَّر» وحدَها لا تقول للموظّف لماذا. */
    if (!canRemindToBook({ status: app.status, liveInterviews: app._count.interviews })) {
      throw app._count.interviews > 0
        ? new AuthError('already_booked', 'حجز موعدَه فعلا — ولا يُذكَّر بما فعل', 409)
        : new AuthError(
            'not_bookable',
            `حالةُ الطلب «${app.status}» لا يُحجَز فيها موعد — فالتذكيرُ يدعوه إلى بابٍ مغلق`,
            409,
          )
    }

    /* والرابطُ يُبنى هنا لا في الرسالة: بناؤه يقرأ إعدادَ التكاملات (تقويمٌ
       بديلٌ وحاضرون)، والرسالةُ دالّةٌ خالصةٌ لا تلمس قاعدةَ بيانات. */
    const mail = bookingReminderMail({
      fullName: app.fullName,
      reference: app.reference,
      statusUrl: `${publicSiteUrl()}/join-trainer/status`,
      bookingUrl: await this.bookingLink({
        name: app.fullName, email: app.email, reference: app.reference,
      }),
    })
    const sent = await sendDirectEmail(this.prisma, {
      to: app.email, subject: mail.subject, ...renderMail(mail.doc),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.interview.remind', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, emailDelivery: sent.status },
    })
    return { emailDelivery: sent.status }
  }

  /** بريدُ «نحتاج منك» — يحمل السؤالَ نفسَه ورابطَ التعديل */
  private async notifyInfoRequested(
    to: string, fullName: string, reference: string, note: string | undefined,
    actorId: string, applicationId: string,
  ): Promise<void> {
    const statusUrl = `${publicSiteUrl()}/join-trainer`
    const asked = note?.trim()
    const mail = await sendDirectEmail(this.prisma, {
      to,
      subject: `نحتاج منك إضافةً على طلبك — ${reference}`,
      ...renderMail({
        greetingName: fullName,
        heading: 'قرأنا طلبك، ونحتاج منك إضافةً قبل أن نُكمل',
        blocks: [
          ...(asked
            ? ([{ kind: 'h', text: 'وهذا ما نحتاجه' }, { kind: 'callout', text: asked }] as const)
            : ([{ kind: 'p', text: 'راجعْ طلبك وأكمل ما تراه ناقصا فيه — ومستنداتُك أوّلُ ما يُنظَر فيه.' }] as const)),
          { kind: 'p', text: 'طلبك ما زال مفتوحا للتعديل: افتح صفحة حالتك، عدّل ما يلزم، ثمّ أرسله من جديد. ولا يلزمك تعبئتُه من أوّله — يُفتح على ما كتبتَه.' },
          { kind: 'cta', label: 'عدّل طلبك الآن', href: statusUrl },
          { kind: 'facts', rows: [{ label: 'رقم الطلب', value: reference }] },
          { kind: 'note', text: 'ولو كان في السؤال ما يحتاج توضيحا، ردَّ على هذه الرسالة.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.info_requested.notify', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: to, emailDelivery: mail.status, asked: asked ?? null },
    })
  }

  /* ═══ مطابقةُ التأهيل بما في الطلب — تُنادى عند الاعتماد وعند كلّ قراءة ═══

     تعمل على ما يُقبل: `skipDuplicates` على القيد `(profileId, courseId)`،
     فمن أُهِّل يدويّا لا يُكرَّر، ومن رُدّ تأهيلُه لدورةٍ يبقى مردودا — الصفُّ
     موجودٌ فلا يُلمَس. ودورةٌ ذكرها ولم تعد في الكتالوج تُهمَل بصمت.

     ولا أثرَ يُكتب إلّا حين يُضاف شيءٌ فعلا: تُنادى مع كلّ فتحٍ لصفحة
     المؤهّلات كي يلحق من اعتُمد قبل هذا التغيير، فلو كُتب أثرٌ في كلّ نداء
     لامتلأ السجلّ بـ«لا شيء». */
  async syncQualificationsFromApplication(profileId: string, actorId: string | null): Promise<{ added: string[] }> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId },
      select: { application: { select: { teachableCourseIds: true } } },
    })
    const wanted = profile?.application.teachableCourseIds ?? []
    if (wanted.length === 0) return { added: [] }
    const known = await this.prisma.course.findMany({ where: { id: { in: wanted } }, select: { id: true } })
    const existing = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, courseId: { in: known.map((c) => c.id) } }, select: { courseId: true },
    })
    const have = new Set(existing.map((q) => q.courseId))
    const added = known.map((c) => c.id).filter((id) => !have.has(id))
    if (added.length === 0) return { added: [] }
    /* ═══ `pending` لا `qualified` — علامتان لا واحدة (§٥ من التصميم) ═══

       `pending` تعني **اخترنا له هذه الدورة** بما نراه مناسبا، و`qualified`
       تعني **قُبلت موادُّه** لها فله أن يدرّسها.

       ولمَ لا تكفي واحدة: لو كانت «مؤهَّل» تعني ما كُتب يومَ الاعتماد
       الداخليّ، لصار المدرّبُ مؤهَّلا لدورتَين **قبل أن يرفع ملفّا واحدا** —
       فيضيء زرُّ التفعيل يومَ وقّع عرضَه، وتسقط الحمايةُ كلُّها. وما يُكتب
       هنا مصدرُه **قولُه في طلبه** لا تقييمُ موادّه: فهو اختيارٌ منّا على
       كلامه، لا حكمٌ على مادّةٍ رأيناها.

       ولا عمودَ جديد: الكلمتان في القاعدة أصلا. */
    await this.prisma.trainerCourseQualification.createMany({
      data: added.map((courseId) => ({
        profileId, courseId, status: 'pending', qualifiedBy: actorId,
        note: 'من طلب الانضمام — الدوراتُ التي قال إنّه يستطيع تدريسَها، قيد تقييم موادّها',
        decidedAt: new Date(),
      })),
      skipDuplicates: true,
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify.auto', entityType: 'trainer_profile', entityId: profileId,
      meta: { courseIds: added },
    })
    return { added }
  }

  /** ملفُّ المدرّب — يُنشأ مرّةً بمهامّ تهيئته، ويُعاد إن كان موجودا */
  private async ensureProfile(
    applicationId: string,
    app: { jobTitle: string | null; bio: string | null },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.trainerProfile.findUnique({ where: { applicationId } })
      if (existing) return existing
      const profile = await tx.trainerProfile.create({
        data: { applicationId, headline: app.jobTitle ?? null, bioPublic: app.bio ?? null },
      })
      /* ح-٢: دوراتُه المقترحةُ تُبذَر من طلبه إلى جدولها، فيجدها في بوّابته.
         والعمودُ في الطلب يبقى كما هو — سجلُّ ما قدّمه يومَ تقدّم. */
      const submitted = await tx.trainerApplication.findUnique({
        where: { id: applicationId }, select: { teachableProposals: true },
      })
      await seedProposalsFromApplication(tx, profile.id, submitted?.teachableProposals, actorId)
      const taskSeeds = [
        { key: 'sign_contract', title: 'توقيع العقد' },
        { key: 'academy_orientation', title: 'التعريف بمنهجية الأكاديمية' },
        { key: 'lms_setup', title: 'تهيئة حساب منصة التدريب' },
        { key: 'first_cohort_brief', title: 'موجز الشعبة الأولى' },
      ]
      for (const t of taskSeeds) {
        await tx.trainerOnboardingTask.create({ data: { profileId: profile.id, key: t.key, title: t.title } })
      }
      await recordAudit(tx, {
        actorId, action: 'trainer.profile.create', entityType: 'trainer_profile', entityId: profile.id,
        meta: { applicationId },
      })
      return profile
    })
  }

  /* ═══ إتمامُ العرض المشروط — توقيعُنا وبريدُه في لحظةٍ واحدة ═══

     تُنادى حين يصير المتقدّمُ `active`، من `approve` أو من `activate`. وثلاثةٌ
     تقع فيها معا لأنّها حقيقةٌ واحدة: **تحقّق الشرط**.

     · يُختَم العرضُ (`countersigned`) فيصير عقدا نهائيّا موقَّعا من الطرفَين.
     · وتُكتب `conditionMetAt` فتنتهي المهلةُ — فلا يذكّره العاملُ بعدها ولا
       يوسمه متأخّرا، وهو محروسٌ بفحص.
     · ويصله بريدُ الاعتماد بأسماء ما اعتُمد له.

     ═══ وهنا توقيعُنا لا عند اعتماد التوقيع (١ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «لا أريد أن أتعاقد مع أحدٍ قبل أن أعتمد دوراته».
     فاعتمادُ التوقيع في العرض المشروط صار يفتح البوّابةَ ولا يختم
     (`signature_approved`)، والخَتمُ يقع هنا ساعةَ تُعتمَد دوراتُه — كما وعد
     البند 2-12: «فإذا تحقق وقعت الأكاديمية العقد من جهتها».

     ولمَ الترتيبُ هكذا: الخَتمُ في معاملةٍ قبل البريد، فبريدٌ يقول «موقَّعٌ من
     الطرفَين» عن عقدٍ لم يُختَم كذبٌ يقرؤه بنفسه. والبريدُ بعدها خارجَها على
     عرف هذا الملفّ: إخفاقُه لا ينقض اعتمادا وقع.

     ═══ ومن لا عرضَ مشروطَ له يُبلَّغ كذلك ═══

     مدرّبٌ عُيّن داخليّا، أو مرّ بتجاوز بوّابة التجهيز، أو عقدُه وُثِّق وهو
     نشطٌ أصلا. فلا خَتمَ له ولا مهلةَ — ويبقى بريدُ الاعتماد، فصيرورتُه نشطا
     خبرٌ يخصّه في الحالتَين. */
  private async completeConditionalOffer(
    applicationId: string,
    app: { email: string; fullName: string; reference: string },
    actorId: string,
    /** ما طابقه المعتمِدُ بوثيقة الهويّة — يأتي حين يُضغَط الاعتمادُ من
        شاشة العقود، ويكون فارغا حين يُفعَّل من ملفّ المدرّب. */
    sealNoteAr?: string | null,
  ): Promise<void> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { applicationId },
      select: { id: true },
    })

    /* المعتمَدُ وحدَه يُسمّى: `pending` هي ما اخترناه له، ولم تُقيَّم موادُّها.
       فذكرُها في «وما اعتمدناه» يُقرأ اعتمادا لم يقع. */
    const approved = profile
      ? await this.prisma.trainerCourseQualification.findMany({
        where: { profileId: profile.id, status: 'qualified' },
        select: { courseId: true },
      })
      : []
    const approvedCoursesAr = await Promise.all(
      approved.map((q) => this.courseTitleAr(q.courseId)),
    )
    /* ═══ ولقطةُ الملحق تُبنى هنا — البندُ 2-11 يَعِد بها ═══

       «ويعاد إلى المدرب مع ملحق يبين الدورات المعتمدة له» — نصُّ المتن الذي
       وقّعه. وكانت الأسماءُ تُحسب للبريد وحدَه ثمّ تُنسى: الصفُّ يحفظ عددَها
       (`approvedCourses: approved.length` في الأثر) ولا يحفظ أسماءَها، فلا
       يُبنى الملحقُ بعدها من شيء.

       ولا رموزَ لاتينيّةٌ في المعروض: `courseId` للتتبّع، و`titleAr` هو ما
       يُقرأ — على نمط `qualifiedSnapshot`. */
    const approvedSnapshot = approved.map((q, i) => ({
      courseId: q.courseId, titleAr: approvedCoursesAr[i] ?? '',
    }))

    /* ═══ والعرضُ الذي يُختَم: المشروطُ وحدَه، وأحدثُه توقيعا إن كانا اثنين ═══

       و`nulls: 'last'` ليست زينة: PostgreSQL يرتّب الفراغَ **أوّلا** في
       `DESC`. فصفٌّ حالُه `signed` وتاريخُ توقيعه فارغٌ يتقدّم على كلّ موقَّعٍ
       حقيقيّ، فيُختَم هو ويُكتب ملحقُه — ويبقى العرضُ الذي وقّعه المدرّبُ
       فعلا `signed` بلا خَتم.

       ومسالكُ الإنتاج اليومَ تكتب التاريخَ مع الحالة في تحديثٍ واحد (توقيعُ
       الرابط، وإعادةُ العقد بعد سحب طلب التعديل)، فلا صفَّ كهذا **اليوم**.
       لكنّ الترتيبَ كان يتعلّق بذلك ولا يقوله، وصفٌّ من البابِ القديم أو
       تصحيحٌ بيدٍ في القاعدة يكفي لنقضه. فيُقال صريحا.

       وقد انكشف هذا بسقالةِ اختبارٍ تكتب `status: 'signed'` بلا تاريخ
       (`makeReadyForApproval`): فخُتم صفُّ السقالة وبقي العرضُ الحقيقيُّ
       معلَّقا — وهي الصورةُ بعينها. */
    const offer = profile
      ? await this.prisma.trainerContract.findFirst({
        where: {
          profileId: profile.id, gatesActivation: true,
          status: { in: ['signed', 'signature_approved', 'countersigned'] },
        },
        orderBy: { signedAt: { sort: 'desc', nulls: 'last' } },
        select: {
          id: true, profileId: true, signerLegalName: true, signedBodyHash: true, bodyVersion: true,
          /* وبهما يُعرَف أمختومٌ هو سلفا: صفوفُ ٢٧ سبتمبر — ١ أكتوبر خُتمت
             عند اعتماد التوقيع */
          status: true, countersignedAt: true,
          /* وملحوظةُ المطابقة يومَ اعتُمد توقيعُه — تُضَمّ إلى ملحوظة الخَتم */
          signatureApprovalNoteAr: true,
        },
      })
      : null

    const countersignedAt = new Date()
    /* أيُّ خَتمٍ وقع — يقوله البريدُ بحرفه: وقّعنا الآن، أم وقّعنا يومَ اعتمدنا
       توقيعَه، أم لا عرضَ مشروطَ له أصلا */
    let sealed: FinalApprovalSeal = 'none'
    if (offer) {
      await this.prisma.$transaction(async (tx) => {
        /* قارنْ واضبطْ كما في التوقيع والاعتماد: نقرتان متزامنتان على
           «فعّلْه» لا تكتبان خَتمَين ولا تُرسلان بريدَين. */
        /* ═══ والخَتمُ لا يُعاد على مختوم ═══

           صفوفُ ٢٧ سبتمبر — ١ أكتوبر ٢٠٢٦ خُتمت عند اعتماد التوقيع. فما يبقى
           لها هنا هو **تحقّقُ الشرط**: `conditionMetAt` وملحقُ الدورات
           المعتمدة. ولو أُعيد الخَتمُ عليها لَتبدّل تاريخُ توقيعنا إلى يوم
           النشر — فيقرأ العقدُ أنّنا وقّعناه بعد أن رفع موادَّه، وهو خلافُ ما
           جرى يومَها.

           ومن ١ أكتوبر يصل العرضُ هنا غيرَ مختوم — `signature_approved`، أو
           `signed` إن تجاوز مديرٌ أعلى البوّابة — فيُختَم الآن. وهذا توقيعُنا
           بنصّ البند 2-12: «فإذا تحقق وقعت الأكاديمية العقد من جهتها». */
        const alreadySealed = offer.countersignedAt != null
        sealed = alreadySealed ? 'earlier' : 'now'
        /* وملحوظةُ مطابقةِ الهويّة تُضَمّ إلى ملحوظة الخَتم: كتبها من اعتمد
           التوقيعَ يومَ طابق الاسمَ بالوثيقة (`signatureApprovalNoteAr`) — وهي
           محلُّ الحجّة إن نُوزع في الاسم بعد سنة، فلا تُطرح حين يقع الخَتمُ
           بعدها بأيّام. */
        const identityNote = sealNoteAr || offer.signatureApprovalNoteAr
        const done = await tx.trainerContract.updateMany({
          where: { id: offer.id, status: { in: ['signed', 'signature_approved', 'countersigned'] } },
          data: {
            status: 'countersigned',
            ...(alreadySealed ? {} : {
              countersignedAt, countersignedBy: actorId,
              academySignatoryName: ACADEMY_LEGAL.signatoryNameAr,
              academySignatoryTitle: ACADEMY_LEGAL.signatoryTitleAr,
            }),
            ...(alreadySealed && !sealNoteAr ? {} : {
              countersignNoteAr: identityNote
                ? `${CONDITION_SEAL_NOTE_AR} — ومطابقةُ الهويّة: ${identityNote}`.slice(0, 500)
                : CONDITION_SEAL_NOTE_AR,
            }),
            /* وانتهت المهلةُ بتحقّق الشرط، ولا تجميدَ يبقى معلّقا */
            conditionMetAt: countersignedAt,
            conditionPausedAt: null,
            /* وداخلَ المعاملة مع الخَتم نفسِه: خَتمٌ يُكتب وملحقُه لا يُكتب
               يترك عقدا نافذا بلا الملحق الذي وعد به متنُه. */
            approvedCoursesSnapshot: approvedSnapshot,
          },
        })
        if (done.count === 0) return
        /* وما كان نافذا له قبلَه يُزاح في معاملة الخَتم نفسِها — علّتُه في
           `supersedePriorLive`، وأثرُه يُكتب هنا حيث يُخبَر صاحبُه */
        if (!alreadySealed) {
          const moved = await this.supersedePriorLive(tx, { profileId: offer.profileId, contractId: offer.id, at: countersignedAt })
          for (const id of moved) {
            await recordAudit(tx, {
              actorId, action: 'trainer.contract.superseded',
              entityType: 'trainer_contract', entityId: id,
              meta: { byContractId: offer.id, supersededAt: countersignedAt },
            })
          }
        }
        await recordAudit(tx, {
          actorId, action: 'trainer.contract.countersign',
          entityType: 'trainer_contract', entityId: offer.id,
          meta: {
            signerLegalName: offer.signerLegalName, signedBodyHash: offer.signedBodyHash,
            bodyVersion: offer.bodyVersion, gatesActivation: true,
            academySignatoryName: ACADEMY_LEGAL.signatoryNameAr,
            /* ويُقال في الأثر أيُّهما وقع: خَتمٌ الآن، أم تحقُّقُ شرطٍ على
               عقدٍ خُتم يومَ اعتُمد توقيعُه. فمن قرأ السجلَّ بعد سنةٍ يعرف. */
            countersignedAt: alreadySealed ? offer.countersignedAt : countersignedAt,
            sealedEarlier: alreadySealed,
            conditionMet: true, approvedCourses: approved.length,
            /* والأسماءُ مع العدد: من سأل «أيَّ الدورات اعتمدتم؟» عن ختمٍ
               قديمٍ لا يُجاب بعددٍ. والملحقُ في الصفّ، وهذا خطُّ الأثر. */
            approvedCourseIds: approved.map((q) => q.courseId),
          },
        })
      })
    }

    const mail = finalApprovalMail({
      fullName: app.fullName,
      reference: app.reference,
      approvedCoursesAr,
      sealed,
      /* ═══ وصار للمستند بابٌ (٢٥ سبتمبر ٢٠٢٦) ═══

         كان هنا `null` وتعليقُه: «لا رابطَ للمستند بعد… ووعدٌ بزرٍّ لا يفتح
         شيئا أسوأُ من غيابه». وقد فُتحت «عقدي» فصار الزرُّ يفتح الوثيقةَ
         بتوقيعَيها وملحقِها. وهذه الرسالةُ موضعُه: تُرسَل في اللحظة التي
         يصير فيها العقدُ نافذا ويُفتح فيها حسابُه. */
      contractUrl: `${publicSiteUrl()}/trainer/contract`,
      portalUrl: `${publicSiteUrl()}/trainer`,
      approvedOnAr: fmtDateWith(countersignedAt, { year: 'numeric', month: 'long', day: 'numeric' }),
    })
    const sent = await sendDirectEmail(this.prisma, {
      to: app.email, subject: mail.subject, ...renderMail(mail.doc),
    })
    await recordAudit(this.prisma, {
      /* والاسمُ هو هو (`trainer.approved.notify`) ولم يُبدَّل: الفعلُ نفسُه
         — «أُشعِر مدرّبٌ باعتماده» — وصفوفُ الأثر القديمةُ تُقرأ مع الجديدة
         في خطٍّ واحد. واسمٌ جديدٌ لفعلٍ قائمٍ يقطع تاريخَه بلا فائدة. */
      actorId, action: 'trainer.approved.notify',
      entityType: 'trainer_application', entityId: applicationId,
      meta: {
        sentTo: app.email, emailDelivery: sent.status,
        countersignedContractId: offer?.id ?? null,
        approvedCourses: approvedCoursesAr.length,
      },
    })
  }

  /* ═══ وحُذف من هنا `notifyApproved` (٢٣ سبتمبر ٢٠٢٦) ═══

     كانت رسالةً من ثلاثة أسطر: «اعتُمد طلبك، وبوّابتك مفتوحة». ولا تقول ما
     اعتُمد من دوراته، ولا أنّ عرضَه صار عقدا نهائيّا موقَّعا من الطرفَين،
     ولا أنّ حسابَه البنكيَّ صار يُكتب — وهي الحقائقُ الثلاثُ التي تتغيّر
     بالاعتماد فعلا.

     ومحلُّها `finalApprovalMail` في `trainer-decision-mail.ts` دالّةً خالصةً
     يحرسها المسارُ السريع، تُنادى من `completeConditionalOffer` أعلاه مع
     الخَتم في لحظةٍ واحدة. */

  /* ═══════════ جرسُ المدرّب — ولمَ كان فارغا ═══════════

     التعيينُ والتأهيلُ **لا يكتبان إشعارا**، وفي الخادم كلِّه مساران اثنان
     يكتبان إشعارا للمدرّب. فالمدرّبُ يُؤهَّل لدورةٍ ويُسنَد إلى شعبةٍ ولا
     يعلم — يكتشف شعبتَه حين يفتح بوّابتَه، إن فتحها.

     وهذان خبران يترتّب عليهما **عمل**: من أُسنِد إلى شعبةٍ عليه أن يحضر.
     فصنفُهما «عملي في الأكاديمية» ولا يُكتَم، وجمهورُهما `trainer` —
     يقع الخبرُ في بوّابته التي يعمل فيها لا في بوّابةِ متعلّم.

     ولا يُسقط إخفاقُ الإشعار الفعلَ: `safeNotify` يبتلع فشلَه، والتأهيلُ
     والإسنادُ حقيقتان في القاعدة قبله. */
  private async notifyTrainerUser(
    profileId: string,
    payload: { title: string; body: string; templateKey: string; data?: Record<string, unknown> },
  ): Promise<void> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { userId: true },
    })
    /* «نشطٌ» بلا حسابٍ لا جرسَ له — ولا يُخترع له صفٌّ لا يقرؤه أحد */
    if (!profile?.userId) return
    await safeNotify(this.prisma, {
      userId: profile.userId, channel: 'in_app', audience: 'trainer', ...payload,
    })
  }

  /** عنوانُ الدورة بالعربية — أو معرِّفُها إن لم يكن لها إصدار */
  private async courseTitleAr(courseId: string): Promise<string> {
    return (await this.courseFacts(courseId)).titleAr
  }

  /** عنوانُ الدورة وساعاتُها من أحدث نسخةٍ في الكتالوج.
   *
   *  ═══ وتُقرأ عند التركيب لا عند العرض (٢٦ سبتمبر ٢٠٢٦) ═══
   *
   *  الرقمُ يُنسَخ في `qualifiedSnapshot` مع العقد كما يُنسَخ العنوان. ولو
   *  قُرئ من الكتالوج كلَّما عُرض العقدُ لَتبدّل ما في وثيقةٍ موقَّعةٍ بتعديلٍ
   *  في دورة — وهو نقضُ القاعدة التي بُني عليها المتنُ كلُّه: المعروضُ هو
   *  الموقَّع. */
  private async courseFacts(courseId: string): Promise<{
    titleAr: string; totalHours: number | null; recordedHours: number | null
  }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        versions: {
          orderBy: { version: 'desc' }, take: 1,
          select: { titleAr: true, totalHours: true, recordedHours: true },
        },
      },
    })
    const v = course?.versions[0]
    return {
      titleAr: v?.titleAr ?? courseId,
      totalHours: v?.totalHours ?? null,
      recordedHours: v?.recordedHours ?? null,
    }
  }

  /* ═══════════ تعيينُ مدرّبٍ داخليّا — نقرةٌ واحدة ═══════════

     كانت الخاصّيّةُ غيرَ موجودةٍ إطلاقا: **الموضعُ الوحيدُ** الذي يُنشأ فيه
     ملفُّ مدرّبٍ في الخادم كلِّه داخلَ البتّ في طلبٍ عامّ، و**الموضعُ الوحيدُ**
     الذي يُنشأ فيه طلبُ انضمامٍ هو النموذجُ العامُّ بلا مصادقة. فمن أراد
     المديرُ تعيينَه — زميلٌ في الأكاديمية، أو مدرّبٌ تعاقَد معه خارجها —
     لا طريقَ له إلّا أن يملأ نموذجَ التقدّم العامّ بنفسه.

     وما كان يستطيعه المديرُ طريقٌ مسدود: يُنشئ مستخدما بدور «مدرّب» فيرى
     صاحبُه جدارَ «حسابُك يحمل صلاحيّاتِ مدرّبٍ بلا ملفّ مدرّب» — ولا يُؤهَّل
     ولا يُسنَد لأنّ كليهما يطلب معرِّفَ ملفٍّ غيرِ موجود.

     فهذه معاملةٌ واحدةٌ تكتب الأربعةَ معا: الحسابَ، وطلبا بحالة «نشط»،
     والملفَّ، والدور. ثلاثةُ حقولٍ ونقرة.

     ── وثلاثةُ حدودٍ تُقال صراحةً ──

     ١) **لا ظهورَ عامّا**: `publicVisibility` و`publishApprovedAt` تبقيان على
        أصلهما — فلا اسمَ مدرّبٍ يُعرض للناس قبل موافقةِ نشرٍ صريحة.
     ٢) **ولا توثيقَ بريدٍ يُدَّعى**: `emailVerifiedAt` تبقى فارغةً — المديرُ
        يشهد بالشخص، لا بأنّ العنوانَ تحقّق من نفسه.
     ٣) **ولا يُطمَس طلبٌ قائم**: من له طلبٌ في الطابور يُعتمَد من هناك،
        فلا يُنشأ له ثانٍ يزاحمه. */
  async createTrainerDirectly(actorId: string, input: {
    fullName: string; email: string; headline?: string | null
  }): Promise<{
    applicationId: string; profileId: string; userId: string; reference: string
    accountCreated: boolean; inviteSent: boolean; noteAr: string
  }> {
    const email = input.email.trim().toLowerCase()
    const fullName = input.fullName.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة', 400)
    }
    if (fullName.length < 2) throw new AuthError('bad_name', 'الاسم حرفان على الأقلّ', 400)

    const existingApp = await this.prisma.trainerApplication.findFirst({ where: { email } })
    if (existingApp) {
      throw new AuthError(
        'application_exists',
        `لهذا البريد طلبٌ قائم (${existingApp.reference}) — اعتمِدْه من طابور الطلبات بدل إنشاء ثانٍ`,
        409,
      )
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    /* كلمةٌ عشوائيّةٌ لا يعرفها أحد — كما في إنشاء الحساب الإداريّ:
       الدخولُ يبدأ بتعيينِ صاحبه كلمتَه من رابط الدعوة. */
    const passwordHash = existingUser ? null : await bcrypt.hash(randomBytes(24).toString('hex'), 10)

    const created = await this.prisma.$transaction(async (tx) => {
      const userId = existingUser
        ? existingUser.id
        : (await tx.user.create({
            data: { email, displayName: fullName, passwordHash: passwordHash!, status: 'invited' },
          })).id

      /* المرجعُ من المولّد المشترك لا من عدد الصفوف: العدُّ ينقص بالحذف
         النهائيّ فيتصادم — `trainer-application-reference.ts` */
      const reference = await nextTrainerApplicationReference(tx)

      const app = await tx.trainerApplication.create({
        data: {
          reference, email, fullName, userId,
          status: 'active',
          jobTitle: input.headline?.trim() || null,
          statusHistory: {
            create: { fromStatus: null, toStatus: 'active', note: 'تعيينٌ داخليٌّ من الإدارة — بلا نموذج تقدّم' },
          },
        },
      })

      const profile = await tx.trainerProfile.create({
        data: { applicationId: app.id, userId, headline: input.headline?.trim() || null },
      })
      /* مهامُّ التهيئةِ نفسُها التي يبذرها الاعتمادُ العاديّ — فمن عُيّن
         داخليّا يجد في بوّابته ما يجده المعتمَدُ من الطابور. */
      for (const t of [
        { key: 'sign_contract', title: 'توقيع العقد' },
        { key: 'academy_orientation', title: 'التعريف بمنهجية الأكاديمية' },
        { key: 'lms_setup', title: 'تهيئة حساب منصة التدريب' },
        { key: 'first_cohort_brief', title: 'موجز الشعبة الأولى' },
      ]) {
        await tx.trainerOnboardingTask.create({ data: { profileId: profile.id, key: t.key, title: t.title } })
      }

      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: 'trainer' } },
        update: {}, create: { userId, roleId: 'trainer' },
      })
      await tx.userRole.deleteMany({ where: { userId, roleId: 'trainer_applicant' } })

      await recordAudit(tx, {
        actorId, action: 'trainer.create_direct', entityType: 'trainer_profile', entityId: profile.id,
        meta: { applicationId: app.id, reference, email, userId, account: existingUser ? 'linked' : 'created' },
      })
      return { applicationId: app.id, profileId: profile.id, userId, reference }
    })

    /* الدعوةُ والبريدُ خارجَ المعاملة: المدرّبُ حقيقةٌ في القاعدة، والرسالةُ
       إشعارٌ بها — فإخفاقُ البريد لا يمحو تعيينا وقع. */
    let inviteSent = false
    if (!existingUser) {
      try {
        const { token } = await new AuthService(this.prisma).issueInvite(created.userId)
        const actor = await this.prisma.user.findUnique({
          where: { id: actorId }, select: { displayName: true },
        })
        const mail = await sendStaffInviteEmail(this.prisma, {
          to: email,
          displayName: fullName,
          token,
          roleNamesAr: ['مدرّب'],
          invitedByAr: actor?.displayName ?? 'مدير المنصّة',
          dutiesAr: [
            'شعبُك ومواعيدُ جلساتها',
            'حضورُ متعلّميك وموادُّ كلِّ لقاء',
            'طابورُ التصحيح وتقييماتُك',
            'مستحقّاتُك',
          ],
        })
        inviteSent = mail.status === 'sent'
      } catch { /* الدعوةُ رفاهية — التعيينُ وقع، وتُعاد من قائمة المستخدمين */ }
    }

    return {
      ...created,
      accountCreated: !existingUser,
      inviteSent,
      /* لا يُقال «وصلته دعوة» حين لا بريد — انتظارُ رسالةٍ لن تصل أسوأُ من معرفة ذلك */
      noteAr: existingUser
        ? 'عُيّن مدرّبا على حسابه القائم — يفتح بوّابتَه بكلمة سرّه نفسِها.'
        : inviteSent
          ? 'عُيّن مدرّبا، ووصلته دعوةٌ يعيّن بها كلمةَ سرّه ويفتح بوّابته.'
          : 'عُيّن مدرّبا، ولم تُرسَل الدعوة — قناةُ البريد غير مفعّلة. اطلب منه «نسيت كلمة المرور» ببريده.',
    }
  }

  /* ═══════════ العقد — وثيقةٌ تُركَّب وتُجمَّد ═══════════

     التصميمُ ومراحلُه في
     `docs/superpowers/specs/2026-09-19-trainer-contract-design.md`.

     المرحلةُ الأولى تركّب المتنَ وتجمّده وتعاينه. والرابطُ والتوقيعُ ورفعُ
     الوثائق في الثانية، والاعتمادُ والتفعيلُ في الثالثة. */

  /** قائمةُ العقود، ومعها من يصلح أن يُركَّب له عقدٌ ولا عقدَ له.

      والثاني هو نصفُ الشاشة الذي يُنسى: قائمةُ عقودٍ تُري ما صُنع ولا تُري
      **من ينتظر**. فمن قُبل قبولا مشروطا منذ أسبوعين ولم يُرسَل له شيءٌ لا
      يظهر في أيّ موضع، ولا يُكتشف إلّا حين يسأل هو. */
/* ═══ عدُّ ما ينتظر ختمَنا — شارةٌ تبقى بعد أن يمضي الإشعار ═══

     الإشعارُ يُرسَل ساعةَ التوقيع («وقّع مدرّبٌ عقدَه»)، ومن لم يقرأه
     ساعتَه لا يجد بعده ما يناديه: لا عدّادَ ولا شارة. والعقدُ الموقَّعُ
     يقف حتّى نختمه — وبه يُفعَّل حسابُ المدرّب وتُعتمَد موادُّه.

     والحالةُ `signed` بعينها: وُقّع ولم يُختَم. وما قبلها لا ينتظرنا،
     وما بعدها (`countersigned`) تمّ. */
  async countAwaitingCountersign(): Promise<{ count: number }> {
    return { count: await this.prisma.trainerContract.count({ where: { status: 'signed' } }) }
  }

  async listContracts() {
    const [contracts, candidates] = await Promise.all([
      this.prisma.trainerContract.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, number: true, title: true, status: true, kind: true, revision: true,
          bodyVersion: true, bodyHash: true, signerEmail: true,
          /* وبهما تعرف نافذةُ قبول التعديل أيَّ إصدارٍ قرأ صاحبُ الطلب */
          bodyPrevVersion: true, bodyUpdatedAt: true,
          compensationType: true, compensationRate: true, currency: true,
          /* وبقيّةُ الأجر والبنودُ الخاصّة: نافذةُ «أعِدْه للتوقيع» تُملأ بها (١ أكتوبر ٢٠٢٦) */
          compensationMinSeats: true, compensationReferralRate: true, specialTermsAr: true,
          supersededAt: true, supersededByContractId: true,
          gatesActivation: true, sentAt: true, signedAt: true, revokedAt: true,
          revokeReasonAr: true, createdAt: true, qualifiedSnapshot: true,
          /* والتذكيرُ الأخيرُ وأجلُ الرابط: به تقول الشاشةُ «أُرسل في… وصالحٌ حتّى…»
             ولا تعرض الزرَّ ثانية. والأجلُ وحدَه لا يفتح بابا — البصمةُ لا تخرج */
          finalReminderAt: true, tokenExpiresAt: true,
          signerLegalName: true, declinedAt: true, declineReasonAr: true,
          countersignedAt: true, academySignatoryName: true,
          academySignatoryTitle: true, countersignNoteAr: true,
          /* واعتمادُ التوقيع بلا خَتم (١ أكتوبر ٢٠٢٦) — يقول الصفُّ متى فُتحت
             بوّابتُه وبمَ طابق المعتمِدُ اسمَه، وأنّا لم نوقّع بعد */
          signatureApprovedAt: true, signatureApprovalNoteAr: true,
          /* ═══ وأعمدةُ الشرط — بدونها الطابورُ أعمى عن طورٍ يحبس إنسانا ═══

             `returnMaterialsWithNotes` مبنيّةٌ ولها مسارُها المحروس، **ولا
             شاشةَ تنادِيها** — ولا عجب: القائمةُ لم تكن تعرف أنّ للعقد طورا
             أصلا. فيرى الموظّفُ صفّا حالُه `signed` ولا شيءَ يقول إنّ موادَّ
             المدرّب عنده للتقييم منذ أسبوع.

             والعاملان يتخطّيان المجمَّد (`conditionPausedAt: null` في
             شرطَيهما)، فلا تذكيرَ يأتي ولا وسمَ تأخّرٍ يُكتب. فمن جمّد
             موادَّه يبقى معلَّقا أبدا، والمخرجان المتاحان «اعتمِدْ» أو
             «ألغِ» — وكلاهما جوابٌ عن سؤالٍ آخر. */
          conditionDeadlineAt: true, conditionPausedAt: true,
          conditionExtendedAt: true, conditionMetAt: true, orientationAt: true,
          conditionExtensionsUsed: true,
          /* وطلبُ التعديل وجوابُه: كانت القائمةُ تعرض الحالةَ ولا تعرض
             ما طُلِب — فيرى الموظّفُ «amendment_requested» ولا يدري ما المطلوب. */
          amendmentRequestAr: true, amendmentRequestedAt: true,
          amendmentReplyAr: true, amendmentRepliedAt: true,
          /* وبه تعرف الشاشةُ أنّ هذا الوقوفَ تصحيحُ اسمٍ لا اعتراضٌ على بند
             — فتعرض نقرةَ الإعادة بدل صندوق الجواب. */
          nameCorrectionAr: true, nameCorrectionAt: true,
          /* ═══ ونسبُ العقد — كان يُكتب ولا يُقرأ ═══

             `replacesContractId` تكتبه المرحلةُ الثالثة في موضعَي إعادة
             التركيب، **ولم تكن شاشةٌ تطلبه**. فثلاثةُ أجيالٍ لعقدٍ واحدٍ
             تُعرَض ثلاثةَ صفوفٍ لا رابطَ بينها — وهو ما سأل عنه صاحبُ
             المنصّة (٢٦ سبتمبر): «لم أفهم لماذا هذا التكرار؟».

             وأخطرُ من الحيرة: بلا خلَفٍ معروفٍ يبقى «صحّحِ الاسمَ وأعِدْ
             إرساله» معروضا على صفٍّ أُرسل بديلُه فعلا. */
          replacesContractId: true,
          documents: { select: { id: true, kind: true, originalName: true, mime: true, uploadedAt: true }, orderBy: { uploadedAt: 'asc' } },
          profile: {
            select: {
              id: true,
              /* الاسمُ الذي طُبع في الوثيقة — والقائمةُ تقابله بالاسم الموقَّع
                 به. وبلا هذا العمود تقابل الشاشةُ التوقيعَ باسم **الحساب**،
                 فتُنبّه على فرقٍ صحّحه الموظّفُ بنفسه وتسكت عن فرقٍ قائم. */
              legalNameAr: true,
              /* وبه يقول رأسُ السلسلة المغلَقُ لماذا لا يُركَّب له عقدٌ الآن */
              suspendedAt: true,
              application: { select: { id: true, reference: true, fullName: true, email: true, status: true } },
            },
          },
        },
      }),
      this.prisma.trainerApplication.findMany({
        where: {
          status: { in: [...TrainerReviewService.QUALIFIABLE_STATUSES] },
          /* و`countersigned` في القائمة: بدونها يعود المدرّبُ النشطُ المعتمَدُ
             عقدُه إلى طابور «ينتظر عقدا» — فحالتُه `active` وهي من
             `QUALIFIABLE_STATUSES`، وعقدُه النافذُ ليس في المستثنيات. */
          /* والموقوفُ لا ينتظر عقدا: يُرفع إيقافُه أوّلا (`contractBlockedAr`)، ولو
             عُرض هنا لَردّ الخادمُ تركيبَه بعد أن تُملأ خاناتُه. */
          profile: { is: { suspendedAt: null, contracts: { none: { status: { in: ['draft', 'sent', 'signed', 'signature_approved', 'countersigned'] } } } } },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, reference: true, fullName: true, email: true, status: true },
      }),
    ])
    return {
      contracts,
      candidates,
      missingLegal: missingAcademyLegalFields().map((f) => LEGAL_FIELD_LABELS_AR[f]),
    }
  }

  /** المتنُ المجمَّد وحدَه — يُقرأ عند السؤال: «أيَّ صياغةٍ وقّع؟» */
  async contractBody(contractId: string) {
    const c = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      select: { id: true, title: true, bodyAr: true, bodyVersion: true, bodyHash: true, status: true },
    })
    if (!c) throw new AuthError('not_found', 'العقد غير موجود', 404)
    return c
  }

  /** رابطُ قراءةٍ موقَّتٌ لوثيقةِ هويّةٍ رفعها المدرّبُ مع عقده.

      وبدونه لا يُعتمَد توقيعٌ أصلا: الاعتمادُ **مطابقةُ الاسم القانونيِّ
      بالوثيقة**، ومن لا يرى الوثيقةَ لا يطابق شيئا ويضغط الزرَّ على ثقة.

      والوثيقةُ هويّةٌ لا ملفُّ عمل: كلُّ فتحةٍ تُكتب في الأثر باسم من فتح،
      و`lastViewedAt` للعرض. فمن سأل «من نظر في جواز سفري؟» يُجاب. */
  async contractDocumentUrl(contractId: string, documentId: string, actorId: string) {
    const doc = await this.prisma.trainerContractDocument.findFirst({
      where: { id: documentId, contractId },
      select: { id: true, kind: true, storageKey: true, originalName: true, mime: true },
    })
    if (!doc) throw new AuthError('not_found', 'الوثيقة غير موجودة', 404)
    const viewedAt = new Date()
    await this.prisma.trainerContractDocument.update({
      where: { id: doc.id }, data: { lastViewedAt: viewedAt },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.document_view',
      entityType: 'trainer_contract', entityId: contractId,
      meta: { documentId: doc.id, kind: doc.kind, viewedAt },
    })
    const exp = Date.now() + SIGNED_URL_TTL_MS
    return {
      url: `/api/v1/documents/${doc.storageKey}?exp=${exp}&sig=${signKey(doc.storageKey, exp, 'read')}`,
      originalName: doc.originalName, mime: doc.mime, expiresAt: new Date(exp),
    }
  }

  /** ما تحتاجه شاشةُ التركيب قبل أن يكتب الموظّفُ شيئا.

      والأجرُ يُقرأ بـ`activeRule` لا من الجدول مباشرةً — فهي المرجعُ نفسُه
      الذي تحتسب به المستحقّات، فلا يقول العقدُ رقما ويصرف الكشفُ غيرَه. */
  async contractPrefill(applicationId: string) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      include: {
        profile: { include: { contracts: { orderBy: { createdAt: 'desc' } } } },
        reviews: { select: { feeExpectationAr: true, feeProposalAr: true, reviewerName: true } },
      },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!app.profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب — القبول المشروط أولا', 409)

    /* ═══ ويُقرأ المختارُ مع المعتمَد ═══

       العرضُ المشروطُ يُرسَل ولا دورةَ `qualified` بعد — وذاك مقصودُ الطور
       كلِّه. فلو قُرئ المعتمَدُ وحدَه لَطُبع الملحقُ (أ) فارغا، وهو قبيحٌ في
       مستندٍ يُوقَّع. فيُقرأ **ما اخترناه له** (`pending`) كذلك، وتحته في
       المتن سطرٌ أنّ موادَّ كلِّ دورةٍ قيد التقييم.

       والمعتمَدُ يبقى مقروءا لبندٍ يُوثَّق على مدرّبٍ نشطٍ أصلا: تلك دوراتٌ
       قُبلت موادُّها فعلا. */
    const quals = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId: app.profile.id, status: { in: ['pending', 'qualified'] } },
      select: { courseId: true, status: true },
    })
    const courses = await Promise.all(
      quals.map(async (q) => ({
        courseId: q.courseId, ...(await this.courseFacts(q.courseId)),
        /* تُعرَض للموظّف كي يرى ما اختاره ممّا اعتُمد — ولا تُطبَع في المتن */
        mark: q.status,
      })),
    )
    const rule = await new EarningsService(this.prisma).activeRule(app.profile.id)

    return {
      applicationId,
      profileId: app.profile.id,
      reference: app.reference,
      fullName: app.fullName,
      /* ═══ واسمُ الطرف الثاني يُقرأ من الملفّ لا من الطلب (٢٦ سبتمبر ٢٠٢٦) ═══

         `app.fullName` ما كتبه في نموذجه أو أُخذ من حسابه — ثنائيٌّ غالبا،
         وقد لا يطابق وثيقةَ هويّته. وكان يُطبَع طرفا ثانيا في الديباجة، ثمّ
         يوقّع المدرّبُ باسمه القانونيّ في خانة التوقيع — فتخرج وثيقةٌ
         **تسمّي طرفا ويوقّعها آخر**، وهو ما بلّغ به صاحبُ المنصّة.

         فـ`profile.legalNameAr` هو المصدرُ حين يكون، ويكتبه الموظّفُ مطابقا
         للوثيقة أو يكتبه المدرّبُ بنفسه قبل أن يوقّع. و`legalNameSource`
         تقول للشاشة أيُّهما تقرأ، فتُنبّه حين يكون الاسمُ من الحساب بعدُ. */
      legalNameAr: app.profile.legalNameAr ?? app.fullName,
      legalNameSource: app.profile.legalNameAr ? ('verified' as const) : ('account' as const),
      email: app.email,
      applicationStatus: app.status,
      /* يُحسب هنا أيضا كي تقوله الشاشةُ للموظّف قبل أن ينقر — فأثرُ الإرسال
         على مدرّبٍ اعتُمدت موادُّه يختلف عنه على مرشّح، ولا يُكتشف الفرقُ
         بعد وقوعه.

         والمقياسُ اعتمادُ الموادّ لا حالةُ الحساب: علّتُه في رأس
         `offerGatesActivation`. ويُقرأ من عقوده كلِّها لا من أحدثِها —
         فالأحدثُ قد يكون مسوّدةً لم تُختَم بعد. */
      gatesActivation: offerGatesActivation(
        (app.profile?.contracts ?? []).map((c) => ({
          conditionMetAt: c.conditionMetAt, countersignedAt: c.countersignedAt,
          gatesActivation: c.gatesActivation, conditionDeadlineAt: c.conditionDeadlineAt,
        })),
      ),
      courses,
      compensation: rule && {
        ruleId: rule.id, type: rule.type, rate: rule.rate.toString(), currency: rule.currency,
        minSeats: rule.minSeats, referralRate: rule.referralRate?.toString() ?? null,
      },
      /* ما قيل في المقابلة عن الأجر — يُعرض للموظّف ليستأنس به، ولا يُحتسب
         منه شيء. وعمودا المراجعة يقولان ذلك صراحةً في المخطّط. */
      feeNotes: app.reviews
        .filter((r) => r.feeExpectationAr || r.feeProposalAr)
        .map((r) => ({ reviewerName: r.reviewerName, expectation: r.feeExpectationAr, proposal: r.feeProposalAr })),
      defaultDocuments: DEFAULT_REQUIRED_DOCUMENTS,
      documentKinds: CONTRACT_DOCUMENT_KINDS,
      missingLegal: missingAcademyLegalFields().map((f) => LEGAL_FIELD_LABELS_AR[f]),
      openContract: app.profile.contracts.find((c) => c.status === 'draft' || c.status === 'sent') ?? null,
      /* وبنودُه الخاصّةُ من أحدث عقوده تُملأ بها الخانة: من أُلغي عرضُه ليُغيَّر
         فيه شيءٌ لا تُكتب بنودُه من جديد — وتُرى في الخانة وتُحرَّر قبل أن تُطبَع. */
      lastSpecialTermsAr: app.profile.contracts[0]?.specialTermsAr ?? null,
      /* ما يمنع التركيبَ والإرسالَ معا — موقوفٌ أو مردودٌ أو مسحوب — يُقال في
         المركِّب قبل أن تُملأ خاناتُه، لا بعد الضغط (`contractBlockedAr`). */
      blockedAr: contractBlockedAr(app.status, Boolean(app.profile.suspendedAt)),
    }
  }

  /** يبني مُدخلَ المتن من لقطةٍ محفوظةٍ أو من مُدخلِ الشاشة — موضعٌ واحدٌ
      يعرف كيف يُركَّب العقد، فالمعاينةُ والمحفوظُ لا يفترقان. */
  private contractBodyInput(args: {
    fullName: string; email: string; reference: string
    courses: ContractCourseRow[]
    compensation: ContractCompensation | null
    hoursNoteAr: string | null; rateWaivedReasonAr: string | null
    requiredDocuments: RequiredDocument[]
    issuedOn: Date
    /** `true` لعرضٍ مشروط — و`false` لبندٍ يُوثَّق على مدرّبٍ نشط */
    gatesActivation: boolean
    orientationAt: Date | null
    /** البندُ 21 — و`null` لعقدٍ بلا بنودٍ خاصّة */
    specialTermsAr: string | null
    /** رقمُ العقد يُطبَع في ترويسته — و`null` لمعاينةٍ لم يُصرف لها رقم */
    number: string | null
  }): ContractBodyInput {
    return {
      contractNumber: args.number,
      academyPartyLineAr: academyPartyLineAr(),
      academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
      academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
      governingLawAr: ACADEMY_LEGAL.governingLawAr,
      disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
      trainerFullName: args.fullName,
      trainerEmail: args.email,
      applicationReference: args.reference,
      issuedOnAr: fmtDateWith(args.issuedOn, { year: 'numeric', month: 'long', day: 'numeric' }),
      courses: args.courses,
      compensation: args.compensation,
      rateWaivedReasonAr: args.rateWaivedReasonAr,
      hoursNoteAr: args.hoursNoteAr,
      requiredDocuments: args.requiredDocuments,
      specialTermsAr: args.specialTermsAr,
      /* والشرطُ يتبع `gatesActivation` لا تاريخَ الجلسة: عرضٌ بلا تاريخٍ
         مشروطٌ كذلك. وجلسةُ التهيئة موعدٌ يُبلَّغ به بعد التوقيع (٢٧ سبتمبر
         ٢٠٢٦)، فمن عُرف موعدُها وقتَ التركيب طُبع، ومن لم يُعرَف وُعد بها.

         ═══ ولا تاريخَ انتهاءٍ يُطبَع في متنٍ يُجمَّد ═══

         المهلةُ تبدأ من **التوقيع**، وهو لمّا يقع لحظةَ التركيب. فتاريخُ
         انتهائها لا يُعرَف بعد، ولا يُخترَع: متنٌ يُجمَّد ويُوقَّع لا يُكتب
         فيه أجلٌ محسوبٌ على تاريخٍ مفترَض. والبندُ 2-8 يقول المبدأ — «تبدأ
         من تاريخ توقيعه هذا العرض» — فيحسبه صاحبُه بنفسه، وتعرضه له بوّابتُه
         بعد التوقيع من `conditionDeadlineAt` المخزون. */
      conditional: args.gatesActivation
        ? {
          orientationOnAr: args.orientationAt
            ? fmtDateWith(args.orientationAt, {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })
            : null,
          deadlineOnAr: null,
          windowDays: MATERIALS_WINDOW_DAYS,
          extensionDays: EXTENSION_DAYS,
        }
        : null,
    }
  }

  /** معاينةٌ لا تُحفَظ — تعمل ولو نقصت هويّةُ الأكاديميّة، فالموظّفُ يرى
      الوثيقةَ ويرى مواضعَ النقص فيها قبل أن يُطلب منه سدُّها. */
  async previewContract(applicationId: string, input: ContractComposeInput) {
    const pre = await this.contractPrefill(applicationId)
    const chosen = this.chosenCourses(pre.courses, input.courseIds)
    return renderContractBodyAr(this.contractBodyInput({
      /* والمعاينةُ قبل الإنشاء: لا رقمَ يُصرف لما قد لا يُنشأ — فيُقال موضعُه
         («يُسنَد عند الحفظ»)، والمحفوظُ يحمله. وما عداه حرفا بحرف */
      number: CONTRACT_NUMBER_PENDING_AR,
      /* والمعاينةُ تُري ما سيُطبَع: الاسمُ المكتوبُ الآن في الشاشة إن كُتب،
         وإلّا المعتمَدُ في الملفّ — فلا يُفاجأ الموظّفُ باسمٍ غيرِ الذي رأى. */
      fullName: input.trainerLegalNameAr?.trim() || pre.legalNameAr,
      email: pre.email, reference: pre.reference,
      courses: chosen,
      gatesActivation: pre.gatesActivation,
      orientationAt: input.orientationAt ? new Date(input.orientationAt) : null,
      compensation: (() => {
        const e = effectiveCompensation(pre.compensation, input.compensation)
        return e
          ? { type: e.type, rate: e.rate, currency: e.currency, minSeats: e.minSeats, referralRate: e.referralRate }
          : null
      })(),
      hoursNoteAr: input.hoursNoteAr?.trim() || null,
      rateWaivedReasonAr: input.rateWaivedReasonAr?.trim() || null,
      requiredDocuments: input.requiredDocuments,
      specialTermsAr: cleanSpecialTermsAr(input.specialTermsAr),
      issuedOn: new Date(),
    }))
  }

  /* ═══ والساعاتُ لا تدخل اللقطةَ (٢٩ سبتمبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «لا داعي لذكر عدد الساعات لكل دورة من الكاتلوج لانه
     هو من سيحددها بالاتفاق معنا».

     ورقمُ الكتالوج كان يُطبَع أمام كلّ دورةٍ في الملحق (أ) تقديرا، ومعه بندُ
     تسامحٍ ٢٠٪. وهو رقمٌ لم يتّفق عليه أحد: المدرّبُ يحدّده معنا قبل الإسناد،
     ويُثبَت في عرض الإسناد وفق البند 3-2. فطبعُه يُقرأ وعدا بحجمٍ لم يُوعَد به.

     ── ولمَ تُطرَح هنا بعينه ──

     هذا المَقطعُ يُبنى منه **المتنُ واللقطةُ والمعاينةُ** معا (ثلاثةُ مواضعَ
     تناديه). فطرحُها فيه يُبقي ما يراه الموظّفُ قبل الإرسال هو ما يُوقَّع،
     ولا موضعَ رابعٌ يُنسى فيه.

     والمعاينةُ تحتفظ بالرقم قبل الاختيار (`pre.courses`) — فمن يختار يرى
     حجمَ الدورة في الكتالوج، ولا يُطبَع في وثيقة.

     ── ولقطاتُ ما وُقّع تبقى بحروفها ──

     لا يُنزَع رقمٌ من عقدٍ وقّعه صاحبُه: `readContractCourses` تقرأ اللقطةَ
     كما حُفظت، و`coursesHaveHours` تُبقي بندَ التسامح على من طُبع له رقم.
     فالتبديلُ في **ما يُكتب من اليوم** لا في ما كُتب.

     و`mark` تبقى (حالةُ التأهيل، للشاشة لا للمتن): المطروحُ الساعتان
     وحدَهما — تُحذَفان من نسخةِ الصفّ ولا يُعاد بناؤه من حقولٍ تُسمّى، فلا
     يسقط حقلٌ بالسهو يومَ يُزاد في الصفّ حقلٌ جديد. */
  private chosenCourses(all: ContractCourseRow[], picked: string[] | undefined): ContractCourseRow[] {
    const want = picked ? new Set(picked) : null
    return all
      .filter((c) => !want || want.has(c.courseId))
      .map((c) => {
        const row: ContractCourseRow = { ...c }
        delete row.totalHours
        delete row.recordedHours
        return row
      })
  }

  /* ═══════════ ما يفعله المدرّبُ بمهلته ═══════════

     العاملُ (#272) يقرأ `conditionPausedAt` ويحترمها، **ولا أحدَ يكتبها**:
     تُمحى في ثلاثة مواضعَ ولا تُكتب في موضعٍ واحد. فالتجميدُ الذي بُني له
     كلُّ شيءٍ لا يقع، ومن رفع موادَّه في اليوم السادس وأخذت مراجعتُنا يومين
     **يخرج من المهلة بلا ذنبٍ منه** — وهي الشكوى الوحيدةُ التي تصمد في وجه
     عقدٍ كُتب للحماية.

     و`conditionExtendedAt` كذلك: بلا كاتبٍ البتّة، وبريدُ التذكير يَعِد به.

     ومعجمُ الأثر يحمل أسماءَ الثلاثة (`materials_declared` و
     `materials_returned` و`condition_extended`) ولا كاتبَ لأيٍّ منها —
     مفرداتٌ لأفعالٍ لم تُبنَ. وهذه تبنيها. */

  /** ═══ نسختي الموقَّعة — يقرؤها المدرّبُ في بوّابته ويطبعها ═══

      بلاغُ صاحب المنصّة (٢٥ سبتمبر ٢٠٢٦): «عندما يصل العقد الموقع للمدرب
      يصله نصا طويلا غير موقع!! اين نضع توقيعنا؟ … ويجب أن يكون ملف بي دي
      اف يقوم بطباعته هو من جهته، وأيضا الملف يكون في منصته».

      والدليلُ كلُّه محفوظٌ منذ وُقّع — اثنا عشرَ عمودا في صفّ العقد — **ولا
      واحدٌ منها كان يُعرَض له**. فهذا بابُه إليه.

      ── ويُعاد المتنُ المجمَّد لا يُركَّب من جديد ──

      `bodyAr` هو ما وُقّع عليه وبصمتُه محفوظة، فيُعاد بحرفه. ومن ركّبه ثانيةً
      من القالب أعطاه **صياغةَ اليوم** عن عقدٍ وقّعه بصياغة أمس.

      ── وما لا يُقرأ لا يُعاد ──

      `signerIp` و`signerUserAgent` دليلُ فعلٍ للنزاع لا سطرٌ يُقرأ في ورقة،
      و`countersignNoteAr` نصُّ موظّفٍ عن مطابقةٍ يكتبه لعين موظّفٍ آخر. فلا
      يخرج منها حرفٌ إلى بوّابته، على نمط انتقاءِ العقد في `/api/trainer/me`.

      ── والموقَّعُ وحدَه ──

      مسوّدةٌ لم تُرسَل، وعقدٌ أُرسل ولم يُوقَّع، لا سجلَّ تنفيذٍ لهما: الأوّلُ
      ليس وثيقةً بعد، والثاني يُوقَّع من رابط بريده لا من هنا. فالشرطُ
      `signedAt: { not: null }`. */
  async myContract(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, select: { id: true },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب مرتبطا بهذا الحساب', 404)
    const c = await this.prisma.trainerContract.findFirst({
      where: { profileId: profile.id, signedAt: { not: null } },
      orderBy: { signedAt: 'desc' },
      select: {
        id: true, number: true, title: true, status: true, kind: true, revision: true,
        bodyAr: true, bodyVersion: true, bodyHash: true,
        signedAt: true, signerLegalName: true, signerAddressAr: true, signerPhone: true,
        consentTextAr: true, consentAcksAr: true, signedBodyHash: true,
        countersignedAt: true, academySignatoryName: true, academySignatoryTitle: true,
        /* واعتمادُ توقيعه — به تقول «عقدي» «اعتمدنا توقيعَك ونوقّعها حين نعتمد
           دوراتك» بدل «نافذة»، والختمُ لم يقع (١ أكتوبر ٢٠٢٦) */
        signatureApprovedAt: true, gatesActivation: true,
        conditionMetAt: true, terminatedAt: true,
        approvedCoursesSnapshot: true,
      },
    })
    if (!c) throw new AuthError('no_contract', 'لا عقدَ موقَّعا في ملفك بعد', 404)
    /* واسمُ الطرف الأوّل يُعاد من المصدر الواحد لا يُكتب في الشاشة حرفا —
       `src/tests/academy-legal.test.ts` يحرس أن لا تُنسخ هذه القيمُ في ملفّ. */
    return { ...c, academyLegalNameAr: ACADEMY_LEGAL.legalNameAr }
  }

  /** عقدُ الطور المفتوحُ لصاحب هذه الجلسة — أو لا شيء */
  private async openConditionContract(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: true },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب مرتبطا بهذا الحساب', 404)
    const contract = await this.prisma.trainerContract.findFirst({
      where: { profileId: profile.id, conditionDeadlineAt: { not: null }, conditionMetAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!contract) throw new AuthError('no_condition', 'لا مهلةَ قائمةً على حسابك', 409)
    return { profile, contract }
  }

  /** «أعلنتُ اكتمالها» — تتجمّد المهلةُ ويصل الطابورَ أنّ موادَّه تنتظر تقييما */
  async declareMaterialsComplete(userId: string, now = new Date()) {
    const { profile, contract } = await this.openConditionContract(userId)
    const phase = conditionPhase({ ...contract, now })
    if (phase === 'under_review') {
      throw new AuthError('already_declared', 'موادُّك عندنا للتقييم أصلا — سيصلك خبرُها', 409)
    }
    /* ويُقبل الإعلانُ ولو انقضت المهلة: من تأخّر يوما ثمّ أتمّ موادَّه أولى
       به أن تُقرأ من أن يُردَّ بابُه، والقرارُ بعدُ لإنسانٍ ينظر. */
    if (phase !== 'running' && phase !== 'lapsed') {
      throw new AuthError('bad_phase', 'لا مهلةَ تسير على حسابك الآن', 409)
    }
    /* ═══ ولا يُعلَن اكتمالُ ما لم يُكتب (٣٠ سبتمبر ٢٠٢٦) ═══
       كان الإعلانُ رايةً وحدَها: يجمّد المهلةَ ولا يحمل شيئا، إذ لم يكن
       للموادّ موضع. وصار لها لوحٌ في «مؤهّلاتي» — فيُردّ الإعلانُ بما ينقص
       دورةً دورة، بالنصّ نفسِه الذي تقوله الشاشة (`course-materials.ts`). */
    const gaps = await new TrainerMaterialsService(this.prisma).declareGapsAr(profile.id)
    if (gaps.length > 0) {
      throw new AuthError('materials_incomplete', `أكمِل موادَّ دوراتك قبل الإعلان — ${gaps.join(' · ')}`, 409)
    }
    await this.prisma.trainerContract.update({
      where: { id: contract.id }, data: { conditionPausedAt: now },
    })
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.contract.materials_declared',
      entityType: 'trainer_contract', entityId: contract.id,
      meta: { lateDeclare: phase === 'lapsed' },
    })
    try {
      await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
        channel: 'in_app',
        templateKey: 'trainer.contract.materials_declared',
        title: 'أعلن مدرّبٌ اكتمالَ موادّه',
        body: `أعلن ${profile.application.fullName} اكتمالَ موادّه — والمهلةُ متجمّدةٌ حتّى يُردّ عليه.`,
        data: { contractId: contract.id, applicationId: profile.applicationId },
      })
    } catch { /* الإشعارُ رفاهيةٌ لا تُسقط التجميد */ }
    return { pausedAt: now }
  }

  /** «امنحني يومين» — مرّتان، والثالثةُ تُردّ بنصٍّ يُقرأ لا بزرٍّ مطفإ */
  async requestConditionExtension(userId: string, now = new Date()) {
    const { contract } = await this.openConditionContract(userId)
    const problem = extendProblemAr({ ...contract, now })
    if (problem) throw new AuthError('cannot_extend', problem, 409)
    const next = extendedDeadline({ ...contract, now })
    if (!next) throw new AuthError('cannot_extend', 'لا مهلةَ تُمدَّد', 409)
    await this.prisma.trainerContract.update({
      where: { id: contract.id },
      data: {
        conditionDeadlineAt: next,
        conditionExtendedAt: now,
        /* والعدُّ يُزاد ذرّيّا: نقرتان متزامنتان تقرآن العددَ نفسَه ثمّ تكتبانه
           فيُمنَح تمديدان بحساب واحد. و`increment` يَعُدّ في القاعدة لا هنا. */
        conditionExtensionsUsed: { increment: 1 },
        /* ويُمحى خَتمُ التذكير: المهلةُ الجديدةُ تستحقّ تذكيرَها قبل يومين
           منها هي، لا أن يُحسَب مذكَّرا بمهلةٍ لم تعد قائمة. */
        conditionRemindedAt: null,
      },
    })
    const left = extensionsLeft({
      conditionExtensionsUsed: (contract.conditionExtensionsUsed ?? 0) + 1,
    })
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.contract.condition_extended',
      entityType: 'trainer_contract', entityId: contract.id,
      meta: { until: next.toISOString(), days: EXTENSION_DAYS, extensionsLeft: left },
    })
    /* وهو طلبَه، لكنّ **الرقمَ الجديدَ هو الخبر**: مهلةٌ تُمدَّد بلا أن يُقال
       إلى متى تترك صاحبَها يحسبها بنفسه. */
    await this.notifyTrainerUser(contract.profileId, {
      templateKey: 'trainer.contract.condition_extended',
      title: `مُدّت مهلتُك ${EXTENSION_DAYS === 2 ? 'يومين' : `${EXTENSION_DAYS} أيّام`}`,
      /* وكم بقي له يُقال في الخبر نفسِه: «وهو التمديدُ الوحيد» كانت تصدُق
         يومَ كان واحدا. وصارت مرّتين، فيُقال ما بقي — لا يُترك يحسبه. */
      body: `تنتهي مهلتُك الآن في ${fmtDateWith(next, { year: 'numeric', month: 'long', day: 'numeric' })}. `
        + (left > 0 ? `ولك تمديدٌ ${left === 1 ? 'واحدٌ' : `${left}`} بعدُ.` : 'وهو آخرُ تمديدٍ لك.'),
      data: { contractId: contract.id, deadlineAt: next.toISOString() },
    })
    return { deadlineAt: next }
  }

  /** «أعِدْها بملاحظات» — تُستأنف المهلةُ **مضافا إليها مدّةُ التجميد بالضبط** */
  async returnMaterialsWithNotes(contractId: string, actorId: string, notesAr: string, now = new Date()) {
    const notes = notesAr.trim()
    if (notes.length < 5) {
      throw new AuthError('no_notes', 'اكتب ما ينقص موادَّه — سطرٌ واحدٌ يكفي، وهو ما سيقرؤه', 422)
    }
    const c = await this.prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    if (!c.conditionPausedAt) {
      throw new AuthError('not_paused', 'موادُّه ليست عندنا للتقييم — لا شيءَ يُعاد', 409)
    }
    /* والمهلةُ تُزاد بمقدار مدّةِ التجميد بالضبط: وقتُ مراجعتنا لا يُحسب
       عليه، ولا يُهدى له يوما لم ننتظره فيه. */
    const resumed = deadlineAfterPause({ ...c, now }, now)
    await this.prisma.trainerContract.update({
      where: { id: contractId },
      data: { conditionDeadlineAt: resumed, conditionPausedAt: null, conditionRemindedAt: null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.materials_returned',
      entityType: 'trainer_contract', entityId: contractId,
      meta: { notesAr: notes.slice(0, 500), deadlineAt: resumed?.toISOString() ?? null },
    })
    /* ═══ والملاحظاتُ تصله، وإلّا فلا معنى لكتابتها ═══

       حلقةُ «يعدّل ويقدّم ثانيةً» تدور بما يقرؤه هو. فملاحظاتٌ تُكتب في
       عمودٍ لا يراه توقف الحلقةَ عند أوّل دورة: تُستأنف مهلتُه ولا يعرف ما
       ينقصه، فيعيد رفعَ ما رُدّ عليه. */
    await this.notifyTrainerUser(c.profileId, {
      templateKey: 'trainer.contract.materials_returned',
      title: 'أُعيدت موادُّك بملاحظات',
      body: `ما ينقص: ${notes.slice(0, 300)}`,
      data: { contractId, deadlineAt: resumed?.toISOString() ?? null },
    })
    return { deadlineAt: resumed }
  }

  /** ═══ التركيبُ والتجميد ═══

      ومعاملةٌ واحدة: كانت `createContract` تُنشئ الصفَّ ثمّ تنقل الحالةَ في
      نداءين. فإن ردَّ النقلُ (وهو يردُّ من أكثر الحالات — الخريطةُ لا تسمح
      بـ`contract_pending` إلّا من `conditionally_approved`) بقي الصفُّ يتيما
      حالتُه `sent`، ويتراكم واحدٌ مع كلّ محاولةٍ فاشلة. */
  async composeContract(applicationId: string, actorId: string, input: ContractComposeInput) {
    const missing = missingAcademyLegalFields()
    if (missing.length > 0) {
      throw new AuthError('academy_identity_missing', academyLegalGapMessageAr(missing), 422)
    }
    const pre = await this.contractPrefill(applicationId)
    /* ═══ ولا يُركَّب ما لا يُرسَل (٣٠ سبتمبر ٢٠٢٦) ═══

       كان الموقوفُ تُركَّب له مسودّةٌ ثمّ يُردّ إرسالُها برموز حالتَين لا
       يقرؤهما أحد، فتبقى يتيمة. فيُسأل هنا ما يُسأل عند الإرسال — قبل أن
       يُكتب صفّ، وبالمخرج مسمّى. والعلّةُ في `contractBlockedAr`. */
    if (pre.blockedAr) throw new AuthError('not_contractable', pre.blockedAr, 409)
    if (pre.openContract) {
      throw new AuthError('contract_open', 'لهذا المدرّب عقدٌ مفتوحٌ — يُلغى أوّلا ثمّ يُركَّب غيرُه', 409)
    }

    /* ═══ وسقط شرطُ الجلسة عند التركيب (٢٧ سبتمبر ٢٠٢٦) ═══

       كان يُردّ التركيبُ بلا جلسةِ تهيئة، وعلّتُه أنّ المهلةَ تُحسَب منها:
       «بلا مهلةٍ لا يستطيع المدرّبُ أن يُعلن اكتمالَها أصلا».

       ونسخه صاحبُ المنصّة: «معه ٥ أيّام **من بعد التوقيع** لإتمام الموادّ…
       وأبلغهم أنّ هناك ستكون جلسةُ توتوريال **تُحدَّد بعد التوقيع**». فصار
       أصلُ المهلة التوقيعَ، وصارت الجلسةُ موعدا يُحدَّد بعده.

       فالشرطُ لم يُنقَض حكمُه بل سقطت علّتُه: لم يكن حكما قائما بنفسه، وإنّما
       كان يحرس أنّ للمهلة أصلا. وأصلُها اليومَ فعلُ المدرّب نفسِه — يقع
       ويُكتب في الصفّ لحظةَ وقوعه، فلا يحتاج إلى وعدٍ من أحد.

       والجلسةُ تبقى خانةً في الشاشة لمن عرف موعدَها وقتَ التركيب: تُطبَع في
       المتن ويحملها بريدُ العرض. ومن لم يعرفْه بعدُ تركها فارغةً، والمتنُ
       يَعِد بها ولا يدّعي تاريخا. */
    const chosen = this.chosenCourses(pre.courses, input.courseIds)

    /* ولا أجرَ مسكوتٌ عنه: بلا قاعدةٍ قائمةٍ وبلا سببٍ مكتوبٍ يُردّ التركيب.
       فعقدٌ يُوقَّع ولا أساسَ لأتعابه يترك «مستحقّاتي» صفرا إلى الأبد، ولا
       يعرف أحدٌ بعد شهرين أكان ذلك قصدا أم سهوا. */
    /* ═══ والأتعابُ المضبوطةُ في الشاشة تغلب القائمة ═══

       وهي تُكتب في المعاملة أدناه. لكنّ المتنَ يُركَّب **قبلها**، ولقطةَ
       الأعمدة تُنسخ معه — فلولا هذا السطرُ لَقُرئت القاعدةُ القديمةُ في
       الاثنين، ولَخرج عقدٌ يقول رقما وتقول القاعدةُ غيرَه بعد ثوانٍ.

       فتُبنى هنا الصورةُ النافذةُ مرّةً، ويقرؤها المتنُ واللقطةُ معا. */
    const effective = effectiveCompensation(pre.compensation, input.compensation)
    const specialTermsAr = cleanSpecialTermsAr(input.specialTermsAr)

    if (!effective && !input.rateWaivedReasonAr?.trim()) {
      throw new AuthError('no_rate', 'لا قاعدةَ أتعابٍ لهذا المدرّب — اضبطها في هذه الشاشة، أو اكتب سببَ إرساله بلا أجرٍ متّفقٍ عليه', 422)
    }
    if (!hasRequiredIdentityDocument(input.requiredDocuments)) {
      throw new AuthError('no_identity_document', 'وثيقةُ هويّةٍ واحدةٌ إلزاميّةٌ على الأقلّ — البند 15 يُقرّ باسمه القانونيّ، ولا إقرارَ بلا ما يقابله', 422)
    }

    /* وتاريخُ الجلسة يُقرأ مرّةً فيُطبَع في المتن. ولم يعد تُحسب منه مهلةٌ
       (٢٧ سبتمبر ٢٠٢٦): الجلسةُ وعدٌ علينا لا أصلٌ لأجل. */
    const orientationAt = input.orientationAt ? new Date(input.orientationAt) : null
    if (input.orientationAt && Number.isNaN(orientationAt!.getTime())) {
      throw new AuthError('bad_orientation', 'تاريخُ جلسة التهيئة غيرُ مقروء', 422)
    }
    /* ولا مهلةَ تُكتب هنا: أصلُها **اعتمادُنا لتوقيعه** ولمّا يقع.
       و`approveSignature` تكتبها في اللحظة التي تُفتح فيها بوّابتُه ويُمنَح
       فيها دورَه — ثلاثتُها في معاملةٍ واحدة، وهو الموضعُ الوحيد.

       (وكان هذا التعليقُ يُحيل إلى `signContractByToken`، وصدَق يوما: أصلُ
       المهلة كان التوقيعَ. فنُقل الأصلُ وبقي التعليقُ يدلّ على موضعٍ لا
       يكتب شيئا.) */

    /* ═══ واسمُ الطرف الثاني يُثبَّت قبل أن يُجمَّد المتن ═══

       فما دخل `bodyAr` دخل البصمةَ ولا يُحرَّر بعدها. وتصحيحُه بعد الإرسال
       عقدٌ بديلٌ لا تعديلُ حقل — وهذا هو الموضعُ الوحيدُ الذي يُكتب فيه
       بلا ثمن. */
    const typedName = input.trainerLegalNameAr?.trim() ?? ''
    /* ولا يُثبَّت في الملفّ اسمٌ من حرفين: هو ما يُطبَع طرفا ثانيا في كلّ عقدٍ
       بعده. والحدُّ حدُّ `reissueWithCorrectedName` نفسُه. */
    if (typedName && typedName.length < 4) {
      throw new AuthError('no_name', 'اكتب الاسمَ القانونيَّ كما في وثيقة الهويّة', 422)
    }
    const legalNameAr = typedName || pre.legalNameAr

    const issuedOn = new Date()
    /* ورقمُه قبل متنه: يُطبَع في ترويسته، فيُؤخذ من التسلسل قبل الإنشاء */
    const number = await this.nextContractNumber()
    const bodyAr = renderContractBodyAr(this.contractBodyInput({
      number,
      fullName: legalNameAr, email: pre.email, reference: pre.reference,
      courses: chosen,
      gatesActivation: pre.gatesActivation,
      orientationAt,
      compensation: effective
        ? { type: effective.type, rate: effective.rate, currency: effective.currency,
            minSeats: effective.minSeats, referralRate: effective.referralRate }
        : null,
      hoursNoteAr: input.hoursNoteAr?.trim() || null,
      rateWaivedReasonAr: input.rateWaivedReasonAr?.trim() || null,
      requiredDocuments: input.requiredDocuments,
      specialTermsAr,
      issuedOn,
    }))

    return this.prisma.$transaction(async (tx) => {
      /* في المعاملة نفسِها: فإن ردَّ التركيبُ بعدها لم تبقَ قاعدةُ أتعابٍ
         جديدةٌ على مدرّبٍ بلا عقدٍ يفسّرها. */
      let ruleId = effective?.ruleId ?? null
      if (input.compensation) {
        const rule = await new EarningsService(tx as unknown as PrismaClient).setRule(actorId, {
          profileId: pre.profileId,
          type: input.compensation.type,
          rate: input.compensation.rate,
          minSeats: input.compensation.minSeats,
          referralRate: input.compensation.referralRate ?? undefined,
        })
        /* ويُحفَظ معرّفُ القاعدة المولودةِ هنا لا `null`: العمودُ للتتبّع
           («من أيّ قاعدةٍ نُقلت هذه الأرقام؟»)، وقاعدةٌ بلا أثرٍ تصل إليها
           تجعل السؤالَ بلا جواب بعد شهور. */
        ruleId = rule.id
      }
      /* ═══ ويُحفَظ في الملفّ لا في هذا العقد وحدَه ═══

         فالاسمُ صفةُ الإنسان لا صفةُ الورقة: من صُحّح اسمُه مرّةً لا يُسأل
         عنه في كلّ عقدٍ بعده، ولا يعود الخطأُ من الباب نفسِه. */
      if (legalNameAr && legalNameAr !== pre.legalNameAr) {
        await tx.trainerProfile.update({
          where: { id: pre.profileId }, data: { legalNameAr },
        })
        await recordAudit(tx, {
          actorId, action: 'trainer.legal_name.set',
          entityType: 'trainer_profile', entityId: pre.profileId,
          meta: { legalNameAr, wasAr: pre.legalNameAr, source: 'compose' },
        })
      }
      const contract = await tx.trainerContract.create({
        data: {
          number,
          profileId: pre.profileId,
          title: input.title.trim(),
          kind: 'original',
          status: 'draft',
          bodyVersion: CONTRACT_BODY_VERSION,
          bodyAr,
          bodyHash: sha256(bodyAr),
          compensationRuleId: ruleId,
          compensationType: effective?.type ?? null,
          compensationRate: effective?.rate ?? null,
          currency: effective?.currency ?? LEDGER_CURRENCY,
          compensationMinSeats: effective?.minSeats ?? null,
          compensationReferralRate: effective?.referralRate ?? null,
          hoursNoteAr: input.hoursNoteAr?.trim() || null,
          rateWaivedReasonAr: input.rateWaivedReasonAr?.trim() || null,
          specialTermsAr,
          qualifiedSnapshot: chosen as unknown as Prisma.InputJsonValue,
          requiredDocuments: input.requiredDocuments as unknown as Prisma.InputJsonValue,
          signerEmail: pre.email,
          gatesActivation: pre.gatesActivation,
          /* ولا مهلةَ لبندٍ يُوثَّق على مدرّبٍ نشط — لا شرطَ يُلحَق بملفٍّ حيّ */
          orientationAt: pre.gatesActivation ? orientationAt : null,
          orientationUrl: pre.gatesActivation ? (input.orientationUrl?.trim() || null) : null,
          createdBy: actorId,
        },
      })
      /* ═══ ولا تتحرّك حالةُ الطلب هنا ═══

         «عقد قيد التوقيع» تعني أنّ العقدَ عنده وأنّنا ننتظره — لا أنّنا
         كتبنا مسودّة. ونقلُه عند التركيب يجعل المرشّحَ يرى في صفحة حالته
         أنّه مطالَبٌ بتوقيعٍ لا رابطَ له بعد.

         فالنقلُ مع الإرسال (المرحلة ٢)، وقيمةُ `gatesActivation` تُحسب
         هنا وتُطبَّق هناك — فتُقرأ من حالةِ يومِ التركيب لا من حالةٍ قد
         تتغيّر بين التركيب والإرسال. */
      await recordAudit(tx, {
        actorId, action: 'trainer.contract.compose', entityType: 'trainer_contract', entityId: contract.id,
        meta: {
          applicationId, bodyVersion: CONTRACT_BODY_VERSION, bodyHash: contract.bodyHash,
          courseCount: chosen.length, gatesActivation: pre.gatesActivation,
          specialTerms: specialTermsAr ? specialTermsAr.split('\n').length : 0,
        },
      })
      return contract
    })
  }

  /* ═══════════ الإرسالُ — وهنا يقع ما يمسّ المدرّب ═══════════

     التركيبُ تهيئةٌ داخليّةٌ لا يعلم بها أحد. والإرسالُ هو الفعلُ: يُسكّ
     الرمزُ، وتتحرّك حالةُ الطلب، ويصل البريدُ صاحبَه. فهنا وحدَه يُنقل إلى
     `contract_pending` — ومعناها «العقدُ عنده وننتظره»، لا «كتبنا مسودّة». */

  private signingUrl(token: string): string {
    return `${publicSiteUrl()}/c/${encodeURIComponent(token)}`
  }

  /** يسكّ رمزا جديدا ويكتب هاشَه — يُستعمل للإرسال ولتجديد رابطٍ انقضى */
  /** رمزُ توقيعٍ جديد — وأجلُه نافذةُ التوقيع، إلّا أن يُعطى غيرَها (التذكيرُ الأخير) */
  private mintContractToken(days: number = CONTRACT_SIGNING_LINK_DAYS): { token: string; tokenHash: string; expiresAt: Date } {
    const token = newToken()
    return {
      token,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + days * 86_400_000),
    }
  }

  /* ═══ وكلُّ رمزٍ يُصرف يُحفَظ — ليقول القديمُ حالَ عقده (١ أكتوبر ٢٠٢٦) ═══

     `tokenHash` في العقد يحمل الحيَّ وحدَه، ويُكتب فوقه كلّما سُكّ غيرُه. فكان
     الرابطُ القديمُ لا يُعرَف لأيّ عقدٍ كان، فيُقال له «غيرُ صالح» ولو كان عقدُه
     قد وُقّع وخُتم. فيُحفَظ هنا كلُّ رمزٍ بعد أن يُكتب، وإلى أين ذهب — ومنه يقرأ
     `contractByOldToken`. وكلُّ `mintContractToken` في هذا الملفّ يتبعه هذا
     النداء (`server/tests/trainer/contract-link-states.test.ts`). */
  private async rememberContractLink(
    db: PrismaClient | Prisma.TransactionClient,
    link: { contractId: string; tokenHash: string; expiresAt: Date; sentTo: string | null; purpose: ContractLinkPurpose },
  ) {
    await db.trainerContractLink.create({ data: link })
  }

  /** رقمُ العقد التالي — من الدالّة نفسِها التي تملأ العمودَ إن لم يُمرَّر
   *  (`next_trainer_contract_number`)، فلا يفترق رقمٌ يُطبَع ورقمٌ يُحفَظ */
  private async nextContractNumber(): Promise<string> {
    const [row] = await this.prisma.$queryRaw<{ n: string }[]>`SELECT next_trainer_contract_number() AS n`
    return row.n
  }

  /* ═══ المثالُ الحسابيُّ يُرسَل ولا يُوقَّع ═══

     قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): يُعرض على المدرّب مثالٌ بأرقامه هو
     ليرى ما يعنيه أساسُ أتعابه بالأرقام — **خارجَ الوثيقة الموقَّعة**. وعلّةُ
     الموضع في رأس `fee-example.ts`: ما دخل الملحقَ صار بندا بالبند 18-4، وما
     سبق التوقيعَ في بريدٍ أسقطه البندُ نفسُه.

     ولا يُرسَل حين لا قاعدةَ أتعابٍ أو حين تكون نسبةً من الإيراد — فالرقمُ
     هناك دالّةٌ في سعرٍ نملكه نحن. */
  /* ═══ بريدُ العقد — طريقان لا واحد ═══

     · **عرضٌ مشروط** (`gatesActivation`): بريدُ العرض المشروط بنصّه الكامل في
       `trainer-decision-mail.ts` — شرطُه وجلستُه ومهلتُه وما بعد التوقيع.
     · **بندٌ يُوثَّق على مدرّبٍ نشطٍ أصلا**: رسالةٌ قصيرةٌ لا شرطَ فيها ولا
       مهلة — فإرسالُ «بلغتَ مرحلةَ العرض المشروط» إلى مدرّبٍ يدرّس منذ شهرين
       كذبٌ يقرؤه بنفسه.

     ولمَ `gatesActivation` هو الفرقُ: هي بعينها القيمةُ التي تقول «أيحبس هذا
     العقدُ التفعيل؟»، وتُحسب عند التركيب من حالة الطلب. فلا مِحَكَّ ثانيَ
     يفترق عنها.

     ═══ ولا مثالَ حسابيّا في البريد ═══

     جوابُ صاحب المنصّة: «في العقد وحدَه». وهو مطبوعٌ في المتن أصلا (بندُ 4-1
     والملحق ب)، فحُذف من هنا وحدَه — ولا رقمَ يتغيّر، موضعُ قراءته وحدَه.
     وبهذا فقدت `feeExampleFactsAr` قارئَها الوحيد فحُذفت. */
  private async mailContract(args: {
    contract: {
      title: string
      gatesActivation: boolean
      orientationAt: Date | null
      orientationUrl: string | null
      conditionDeadlineAt: Date | null
      requiredDocuments: unknown
      /** رقمُ العقد — يُقال في الوقائع */
      number?: string
    }
    to: string; fullName: string; reference: string; url: string; expiresAt: Date; resend: boolean
    /** سطرٌ يُقدَّم على كلّ شيءٍ حين يكون لهذا الإرسالِ بعينه سببٌ يخصّه —
        كأنّ يكون بديلا صُحّح فيه اسمُ الطرف الثاني. وبلا قيمةٍ لا يُرسَم. */
    noticeAr?: string | null
  }) {
    const { contract } = args
    /* ═══ والسببُ يُقدَّم على المتن ═══

       من طلب تصحيحَ اسمه ثمّ وصلته رسالةُ «هذا عقدُك للقراءة والتوقيع»
       بحرفها لا يعرف أهذا جوابُ طلبه أم إرسالٌ ثانٍ بالخطأ — فيقرأ الوثيقةَ
       كلَّها باحثا عمّا تغيّر، أو يتركها. */
    const notice = args.noticeAr?.trim()
    const lead = notice ? ([{ kind: 'callout' as const, text: notice }] as const) : ([] as const)

    /* والتجديدُ رسالتُه: من ضاع منه الرابطُ لا يُعاد عليه شرحُ الطور كلِّه،
       وإنّما يُعطى بابا جديدا. */
    if (args.resend) {
      return sendDirectEmail(this.prisma, {
        to: args.to,
        subject: `رابطٌ جديدٌ للتوقيع — ${contract.title}`,
        ...renderMail({
          greetingName: args.fullName,
          heading: contract.gatesActivation ? 'هذا رابطٌ جديدٌ لتوقيع الاتفاقيّة' : 'هذا رابطٌ جديدٌ لتوقيع عقدك',
          blocks: [
            ...lead,
            { kind: 'p', text: 'اقرأ الوثيقة كاملة قبل التوقيع — وما فيها لم يتغيّر، الرابطُ وحدَه هو الجديد.' },
            /* والزرُّ يدلّ ولا يأمر — «اقرأ ووقّع» تُقرأ إلزاما بالتوقيع (#405) */
            { kind: 'cta', label: 'افتح الاتفاقيّة', href: args.url },
            { kind: 'callout', text: `الرابطُ صالحٌ حتّى ${fmtDateWith(args.expiresAt, { year: 'numeric', month: 'long', day: 'numeric' })}، ولك أن تعتذر عنه بلا حرج.` },
            { kind: 'facts', rows: contractFactsRows(args.reference, contract.number) },
          ],
        }),
      })
    }

    if (contract.gatesActivation) {
      const mail = conditionalOfferMail({
        fullName: args.fullName,
        reference: args.reference,
        contractNumber: contract.number,
        url: args.url,
        noticeAr: notice ?? null,
        expiresAt: args.expiresAt,
        orientationOnAr: contract.orientationAt
          ? fmtDateWith(contract.orientationAt, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
          })
          : null,
        orientationUrl: contract.orientationUrl,
        deadlineOnAr: contract.conditionDeadlineAt
          ? fmtDateWith(contract.conditionDeadlineAt, { year: 'numeric', month: 'long', day: 'numeric' })
          : null,
        windowDays: MATERIALS_WINDOW_DAYS,
        extensionDays: EXTENSION_DAYS,
        requiredDocumentsAr: requiredDocumentLabelsAr(contract.requiredDocuments),
        portalUrl: `${publicSiteUrl()}/trainer`,
      })
      return sendDirectEmail(this.prisma, { to: args.to, subject: mail.subject, ...renderMail(mail.doc) })
    }

    return sendDirectEmail(this.prisma, {
      to: args.to,
      subject: `عقدُك مع أكاديمية وجيز — للقراءة والتوقيع (${args.reference})`,
      ...renderMail({
        greetingName: args.fullName,
        heading: 'هذا عقدُك للقراءة والتوقيع',
        blocks: [
          ...lead,
          { kind: 'p', text: 'اقرأ الاتفاقية كاملة قبل التوقيع — وفيها ما يخصّ أتعابك والدورات التي أُهِّلتَ لها وحقوقَ الطرفين.' },
          { kind: 'cta', label: 'اقرأ العقدَ ووقّعه', href: args.url },
          { kind: 'callout', text: `الرابطُ صالحٌ حتّى ${fmtDateWith(args.expiresAt, { year: 'numeric', month: 'long', day: 'numeric' })}، ولك أن تعتذر عنه بلا حرج.` },
          { kind: 'facts', rows: contractFactsRows(args.reference, contract.number) },
          { kind: 'note', text: 'فإن انقضى قبل أن توقّع فاطلب من فريقنا إعادةَ إرساله.' },
        ],
      }),
    })
  }

  /** الإرسالُ — معاملةٌ واحدةٌ، والبريدُ بعدها */
  /** و`silent` يُرسل العقدَ ويسكّ رابطَه ولا يُخرج بريدَه العامّ — لمن يضع
      الرابطَ في رسالته هو (إعادةُ التوقيع). و`emailDelivery` حينئذٍ `skipped`. */
  async sendContract(contractId: string, actorId: string, noticeAr?: string | null, opts?: { silent?: boolean }) {
    const contract = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!contract) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (contract.status !== 'draft') {
      throw new AuthError('bad_state', 'لا يُرسَل إلّا عقدٌ مسودّة — الملغى والموقَّعُ والمرسَلُ لها أبوابُها', 409)
    }
    if (!contractHasBodyAr(contract.bodyAr)) {
      throw new AuthError('no_body', 'عقدٌ بلا نصّ — من البابِ القديم. أنشئ عقدا جديدا', 409)
    }
    /* ═══ ولا يُرسَل عرضٌ مشروطٌ متنُه لا يحمل شرطَه (٢٣ سبتمبر ٢٠٢٦) ═══

       عرضٌ رُكِّب قبل بند الشرط يحمل `gatesActivation = true` في القاعدة ولا
       شرطا في متنه. فإن أُرسل خرج **بريدُ العرض المشروط** يحدّثه عن جلسةٍ
       ومهلةٍ وشرطٍ، والوثيقةُ التي يفتحها لا تذكر من ذلك حرفا. ورسالةٌ تَعِد
       بما لا تحمله الوثيقةُ أسوأُ من رسالةٍ ناقصة: يوقّع على أحدهما ويُحاسَب
       بالآخر.

       فيُردّ الإرسالُ ويُقال ما يُفعَل. ولا يُصلَح المتنُ هنا: التركيبُ
       يُجمَّد ويُهشَّم مرّةً بقصد، فمن بُدّل متنُه تحته صار له هاشان.
       وترحيلُ العقود القائمة سكربتٌ يُشغَّل بيدٍ (§١٢ من التصميم). */
    if (contract.gatesActivation && !bodyCarriesConditionClause(contract.bodyAr)) {
      throw new AuthError(
        'body_without_condition',
        'هذا عرضٌ مشروطٌ ونصُّه أُعِدَّ قبل بند الشرط — فبريدُه يحدّث المتقدّمَ عن شرطٍ ومهلةٍ لا تحملهما الوثيقة. ألغِ هذا العرضَ وأنشئ غيرَه، فيخرج متنُه ببند الشرط وتاريخِ جلسة التهيئة.',
        409,
      )
    }
    const app = contract.profile.application
    /* والسؤالُ نفسُه عند الإرسال: مسودّةٌ رُكّبت ثمّ أُوقف صاحبُها كان يُردّ
       إرسالُها بـ«لا يمكن الانتقال من «suspended» إلى «contract_pending»». */
    const blocked = contractBlockedAr(app.status, Boolean(contract.profile.suspendedAt))
    if (blocked) throw new AuthError('not_contractable', blocked, 409)
    const { token, tokenHash, expiresAt } = this.mintContractToken()

    await this.prisma.$transaction(async (tx) => {
      /* قارنْ واضبطْ: نقرتان متزامنتان لا تُرسلان رمزين، والثانيةُ تجد صفرا */
      const moved = await tx.trainerContract.updateMany({
        where: { id: contractId, status: 'draft' },
        data: { status: 'sent', sentAt: new Date(), tokenHash, tokenExpiresAt: expiresAt, signerEmail: app.email },
      })
      if (moved.count === 0) throw new AuthError('bad_state', 'العقدُ لم يعد مسودّة', 409)
      await this.rememberContractLink(tx, { contractId, tokenHash, expiresAt, sentTo: app.email, purpose: 'sent' })
      /* ═══ وحالةُ الطلب تُسأل بنفسها لا بعلَم الاشتراط ═══

         كان الشرطُ `contract.gatesActivation`، وكان يساوي `status !== 'active'`
         بحكم حسابه — فأدّى العملَين معا: يطبع بندَ الشرط، ويحرّك الحالة.

         ثمّ صار الاشتراطُ يُقاس **باعتماد الموادّ** (٢٥ سبتمبر)، فافترق
         المعنيان: مدرّبٌ نشطٌ لم تُعتمَد موادُّه يُشترَط عقدُه — ولو حرّكنا
         حالتَه لَرُدّ إلى `contract_pending`، أي **عُطّل مدرّبٌ يعمل**.

         فسؤالُ الحالة يُسأل بنفسه. والمحصّلةُ قبل التغيير هي هي: كان
         `gatesActivation` يعني `status !== 'active'` فحُلّ محلَّه نصّا. */
      if (app.status !== 'active' && app.status !== 'contract_pending') {
        await this.apps.transition(app.id, 'contract_pending', actorId, 'إرسالُ العقد للتوقيع', tx)
      }
      await recordAudit(tx, {
        actorId, action: 'trainer.contract.send', entityType: 'trainer_contract', entityId: contractId,
        meta: { applicationId: app.id, sentTo: app.email, expiresAt, gatesActivation: contract.gatesActivation },
      })
    })

    /* والبريدُ خارجَ المعاملة على عرف هذا الملفّ: بريدٌ يُخفق لا ينقض إرسالا
       وقع. والرابطُ يُعاد للموظّف كذلك — فقناةُ البريد قد تتعثّر، ومن يملك
       الصلاحيّةَ يحتاج نسخةً يسلّمها بيده. */
    if (opts?.silent) {
      return { ok: true, signingUrl: this.signingUrl(token), expiresAt, emailDelivery: 'skipped' as const }
    }
    const mail = await this.mailContract({
      contract, to: app.email, fullName: app.fullName, reference: app.reference,
      url: this.signingUrl(token), expiresAt, resend: false, noticeAr,
    })
    return { ok: true, signingUrl: this.signingUrl(token), expiresAt, emailDelivery: mail.status }
  }

  /* ═══ جوابُ الإدارة على طلب التعديل ═══

     كان الطلبُ يصل ويُحفَظ ويُشعِر، **ولا شيءَ يردّه**: لا شاشةَ تقرؤه
     ولا فعلَ يُنهيه، فيقف العقدُ في `amendment_requested` أبدا — وهو ما رآه
     صاحبُ المنصّة في قائمته (٢٤ سبتمبر ٢٠٢٦).

     والجوابان مكتوبان في رأس `requestContractAmendment` منذ كُتِبت: «فإمّا
     أُلغي وأُرسل مصحَّحا وإمّا رُدَّ عليه بأنّه يبقى». فهذا الثاني،
     والأوّلُ صار ممكنا بقبول `revokeContract` لهذه الحالة.

     ── ولمَ يُجدَّد الرابط ──

     الرمزُ لم يُمحَ يومَ طلب التعديل، لكنّا لا نملك نصَّه (المحفوظُ هاشُه)،
     فلا سبيلَ إلى إرسالِه مرّةً أخرى. وجوابٌ لا يصل صاحبَه ليس جوابا —
     فيُسكَّ رمزٌ جديدٌ ويُرسَل، كما يفعل `resendContract` بنصّه. */
  async replyToAmendment(contractId: string, actorId: string, replyAr: string) {
    const reply = replyAr.trim()
    if (reply.length < 5) {
      throw new AuthError('no_reply', 'اكتب ردَّك — يقرؤه المدرّبُ وهو أمام زرّ التوقيع', 422)
    }
    const contract = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!contract) throw new AuthError('not_found', 'العقد غير موجود', 404)
    /* ═══ وهذا إرسالٌ ثانٍ، فيُسأل ما يُسأل عنه الأوّل ═══

       الردُّ يردّ العقدَ إلى `sent` ويسكّ رمزا جديدا — أي يفتح بابَ توقيعٍ
       يعمل. و`sendContract` يمنع الخروجَ بلا متن، وهذا كان يخرج منه بلا
       سؤال: عقدٌ من البابِ القديم يقف في «طُلب تعديلُه» يصله رابطٌ يعمل
       على وثيقةٍ خاوية. فالقيدُ يُعاد حيث يقع الفعل. */
    if (!contractHasBodyAr(contract.bodyAr)) {
      throw new AuthError('no_body', 'عقدٌ بلا نصّ — من البابِ القديم. ألغِه وأنشئ عقدا جديدا', 409)
    }

    const { token, tokenHash, expiresAt } = this.mintContractToken()
    /* قارنْ واضبطْ في نداءٍ واحد: نقرتان متزامنتان تكتبان جوابَين */
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: contractId, status: CONTRACT_AMENDMENT_REQUESTED },
      data: {
        status: 'sent',
        amendmentReplyAr: reply.slice(0, AMENDMENT_TEXT_MAX),
        amendmentRepliedAt: new Date(),
        amendmentRepliedBy: actorId,
        tokenHash, tokenExpiresAt: expiresAt,
      },
    })
    if (done.count === 0) {
      throw new AuthError('bad_state', 'لا طلبَ تعديلٍ قائمٌ على هذا العقد', 409)
    }
    await this.rememberContractLink(this.prisma, {
      contractId, tokenHash, expiresAt, sentTo: contract.profile.application.email, purpose: 'amendment_reply',
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.amendment_replied',
      entityType: 'trainer_contract', entityId: contractId,
      meta: { replyAr: reply.slice(0, AMENDMENT_TEXT_MAX) },
    })
    /* ═══ والجوابُ يصل في الرسالة لا في الصفّ وحدَه (٢٦ سبتمبر ٢٠٢٦) ═══

       كان يُرسَل هنا بريدُ `mailContract({ resend: true })`، ونصُّه: «اقرأ
       الوثيقة كاملة قبل التوقيع — وما فيها لم يتغيّر، الرابطُ وحدَه هو
       الجديد». فجوابُ الموظّف يُحفَظ في `amendmentReplyAr` **ولا يخرج**،
       ويُقرأ على من طلب تعديلا: وقّعْ ثانية.

       وهو بلاغُ صاحب المنصّة بحرفه (٢٦ سبتمبر): «أرسل له أنّنا لن نغيّر
       العقد ولم تظهر له رسالتي في الإيميل وإنّما طُلب منه التوقيع مرّةً
       أخرى». */
    const app = contract.profile.application
    const doc = amendmentAnsweredMail({
      fullName: app.fullName,
      reference: app.reference,
      title: contract.title,
      replyAr: reply.slice(0, AMENDMENT_TEXT_MAX),
      contractNumber: contract.number,
      url: this.signingUrl(token),
      expiresOnAr: fmtDateWith(expiresAt, { year: 'numeric', month: 'long', day: 'numeric' }),
      /* وما تغيّر تحته بعد طلبه — علّتُه في `versionReadByRequester` */
      changeGroups: contract.bodyVersion
        ? changeGroupsBetween(versionReadByRequester(contract), contract.bodyVersion, { conditional: contract.gatesActivation })
        : [],
    })
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email, subject: doc.subject, ...renderMail(doc.doc),
    })
    return { ok: true, signingUrl: this.signingUrl(token), expiresAt, emailDelivery: mail.status }
  }

  /* ═══ الجوابُ الثالث: «سنعدّل ونرسل عقدا جديدا» (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «وإذا أردت أن أردّ عليه بأنّنا سنعدّل العقد ونرسل
     لك عقدا جديدا لا يوجد زرٌّ لهذا الأمر — والذي يجب أن يستقبل المدرّبُ
     رسالةً تقول إنّنا سنرسل العقد مرّةً أخرى مع التعديلات المقبولة فقط».

     وكان البابُ موجودا بمعناه لا باسمه: يُلغى العقدُ بزرّ «ألغِ» ثمّ يُركَّب
     غيرُه. وفيه عطبان: الإلغاءُ كان لا يرسل شيئا أصلا، وسببُه يُكتب في خانةٍ
     عامّةٍ لا تقول إنّ طلبَه قُبل. فمن قُبل طلبُه كان يقرأ — لو قرأ شيئا —
     «أُلغي عقدُك»، وهو عكسُ ما وقع.

     ولمَ يُلغى ولا يُعدَّل: متنُ العقد مجمَّدٌ ومهشَّمٌ بـ`bodyHash`، وما
     عُرض للتوقيع لا يُحرَّر تحت قارئه. فالتصحيحُ عرضٌ جديدٌ بمتنٍ جديدٍ
     وبصمةٍ جديدة، والقديمُ يُغلَق بسببٍ يقول الحقيقة. */
  /* ═══ وصار العقدُ المصحَّحُ في الرسالة نفسِها (١ أكتوبر ٢٠٢٦) ═══

     كان هذا البابُ يُغلق العرضَ ويرسل «قبلنا طلبك ويصلك عقدٌ مصحَّح» بلا
     رابط، ثمّ ينتظر من يُنشئ العقدَ بيده من «عقدٌ جديد» — فإن لم يفعل بقي
     المدرّبُ ينتظر وعدا. وإن فعل وصله بريدُ العقد العامُّ لا يقول ما تغيّر.

     أمرُ صاحب المنصّة: أن يصله جوابُنا وعقدُه المصحَّحُ معا، بنصٍّ يكتبه
     كما يشاء، وشروطٍ تُغيَّر قبل الإرسال. فهو بابُ الإعادة للتوقيع نفسُه
     (`reissueForSigning`)، والمتنُ الجديدُ الإصدارُ الحاضر. */
  async answerAmendmentWithNewContract(contractId: string, actorId: string, input: ReissueForSigningInput) {
    return this.reissueForSigning(contractId, actorId, input, 'amendment')
  }

  /** يصل صاحبَ العقد أنّ عقدَه أُغلق ولماذا — ولا يُرسَل عن مسودّةٍ لم يرَها.
   *
   *  فالمسودّةُ لم تخرج إليه أصلا: رسالةٌ عنها تُخبره بوجود عقدٍ ثمّ بإلغائه
   *  في نفَسٍ واحد، وهو خبرٌ لا يعنيه ويُقلقه. */
  private async notifyContractRevoked(
    contract: {
      status: string; title: string; number?: string
      signerEmail: string | null
      profile: { application: { email: string; fullName: string; reference: string } }
    },
    reasonAr: string,
    reissue: boolean,
  ): Promise<DirectMailStatus | null> {
    /* و`null` تعني «لا رسالةَ مستحقّة» — لا «حاولنا فتعذّر». والفرقُ يُقرأ:
       `not_configured` تقول إنّ قناةَ البريد مغلقة، وهي حالٌ تُصلَح. وصفٌّ
       لم يخرج إلى صاحبه لا يُوصف بأنّ بريدَه تعذّر. */
    if (contract.status === 'draft') return null
    const app = contract.profile.application
    try {
      const doc = contractRevokedMail({
        fullName: app.fullName, reference: app.reference, contractNumber: contract.number,
        title: contract.title, reasonAr, reissue,
      })
      const sent = await sendDirectEmail(this.prisma, {
        to: contract.signerEmail ?? app.email, subject: doc.subject, ...renderMail(doc.doc),
      })
      return sent.status
    } catch {
      /* البريدُ رفاهية — الإلغاءُ وقع، والأثرُ يحفظه */
      return 'failed'
    }
  }

  /* ═══════════ أثرُ الإغلاق — يُقرأ قبل النقرة لا بعدها ═══════════

     بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «يجب أن يكون زرُّ إلغاء العقد فيرسل
     للمدرّب أنّ العقد قد أُلغي ولماذا.. **والنظام يجب أن يحذّرني إذا كان
     للإلغاء أثر**».

     وهو طلبٌ في محلّه: الإلغاءُ والفسخُ نقرتان متشابهتان في الشاشة وأثرُهما
     مختلفٌ اختلافا تامّا. فعرضٌ لم يُوقَّع يُغلَق ولا يمسّ شيئا؛ وعقدٌ نافذٌ
     على مدرّبٍ يدرّس يمسّ **شعبَه ومتعلّميه وعروضَه ومستحقّاتِه**. والموظّفُ
     لا يعرف أيُّهما بين يديه من صفٍّ يقول «نافذ».

     ولا يُحسَب الأثرُ من نوع العقد وحدَه: المدرّبُ قد يكون نشطا بعقدٍ آخرَ
     فيبقى ما له قائما. فتُقرأ أرقامُه هو، وتُعرَض كما هي، ويقرّر الإنسان. */

  /** ما لهذا المدرّب اليومَ من ارتباطاتٍ حيّة — عددا لا حكما.
   *
   *  والقراءةُ من المواضع التي يمسّها الرحيلُ فعلا
   *  (`TrainerDepartureService.open`) لا من تقديرٍ مستقلّ: أرقامٌ تُعرَض
   *  للتحذير ثمّ يقع غيرُها عند التنفيذ أسوأُ من لا تحذير. */
  async contractCloseImpact(contractId: string) {
    const c = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, profileId: true, gatesActivation: true },
    })
    if (!c) throw new AuthError('not_found', 'العقد غير موجود', 404)

    /* الشعبُ الحيّةُ وحدَها: المنتهيةُ لا يمسّها رحيلٌ ولا فسخ — وهي
       الحالاتُ الأربعُ نفسُها التي يقرؤها `open`. */
    const live = await this.prisma.cohortTrainer.findMany({
      where: { profileId: c.profileId, cohort: { status: { in: ['draft', 'open', 'full', 'active'] } } },
      select: { cohortId: true },
    })
    const cohortIds = live.map((x) => x.cohortId)
    const [learners, openOffers, owed] = await Promise.all([
      cohortIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.enrollment.count({
          where: { cohortId: { in: cohortIds }, status: 'enrolled' },
        }),
      this.prisma.trainerAssignmentOffer.count({
        where: { profileId: c.profileId, status: 'offered' },
      }),
      /* ما استحقّ ولم يُصرَف: `pending` و`approved`. والمصروفُ انتهى أمرُه،
         والملغى لا يُطالَب به. */
      this.prisma.trainerPayout.findMany({
        where: { profileId: c.profileId, status: { in: ['pending', 'approved'] } },
        select: { total: true, currency: true },
      }),
    ])

    /* والمبالغُ تُجمَع بعملتها: مجموعٌ واحدٌ لعملتَين رقمٌ لا معنى له */
    const owedByCurrency: Record<string, number> = {}
    for (const p of owed) {
      owedByCurrency[p.currency] = (owedByCurrency[p.currency] ?? 0) + Number(p.total)
    }

    return {
      contractId: c.id,
      status: c.status,
      /* أيُنهي إغلاقُ هذا الصفِّ عقدا **نافذا**؟ فالتحذيرُ يختلف به */
      isLive: c.status === 'countersigned',
      liveCohorts: cohortIds.length,
      enrolledLearners: learners,
      openOffers,
      unpaidPayouts: owed.length,
      owedByCurrency,
    }
  }

  /* ═══ الحذف — وما لا يُحذَف أبدا ═══

     طلبَه صاحبُ المنصّة (٢٤ سبتمبر ٢٠٢٦): قائمةُ العقود تمتلئ بمسودّاتٍ
     وملغَياتٍ لا تُفيد أحدا.

     **والموقَّعُ لا يُحذَف ولو طُلِب.** وثيقةٌ وقّعها إنسانٌ دليلٌ يُحتَجّ
     به له وعليه، ومحوُها يمحو ما التزم به الطرفان. والمميِّزُ هو
     `isUntouchableContract` في `contract-untouchable.ts` — وموضعاه
     يسألان السؤالَ نفسَه: أمَسَّ هذا العقدَ توقيعٌ؟

     والأثرُ يبقى بعد الصفّ: من حذف، ومتى، وما كان عنوانُه وحالتُه. */
  async deleteContract(contractId: string, actorId: string) {
    const c = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      select: {
        id: true, title: true, status: true, revision: true,
        signedAt: true, countersignedAt: true, profileId: true,
      },
    })
    if (!c) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (isUntouchableContract(c)) {
      throw new AuthError(
        'signed_contract',
        'لا يُحذَف عقدٌ مسَّه توقيع — وهو دليلٌ يُحتَجّ به للمدرّب وعليه',
        409,
      )
    }
    /* والأثرُ يُكتب قبل المحو: بعده لا يبقى ما يُقرأ منه عنوانٌ ولا حالة */
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.delete',
      entityType: 'trainer_contract', entityId: contractId,
      meta: { title: c.title, status: c.status, revision: c.revision, profileId: c.profileId },
    })
    const done = await this.prisma.trainerContract.deleteMany({
      /* والقيدُ يُعاد في المحو نفسِه: بين القراءة والمحو قد يُوقَّع */
      where: { id: contractId, signedAt: null, countersignedAt: null },
    })
    if (done.count === 0) {
      throw new AuthError('signed_contract', 'وُقِّع العقدُ قبل أن يُحذَف — فلا يُحذَف', 409)
    }
    /* ويُخبَر به إنسان: محوٌ لا رجعةَ فيه يقع بنقرةٍ واحدة، ومن كان
       يعمل على هذا الملفّ يجدُه غائبا ولا يدري أذهب أم لم يكن. والأثرُ
       يُقرأ بطلب، والإشعارُ يصل بلا طلب. */
    try {
      await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
        channel: 'in_app',
        templateKey: 'trainer.contract.deleted',
        title: 'حُذِف عقدٌ لم يُوقّع',
        body: `حُذِف «${c.title}» (حالتُه ${c.status}) — ولم يمسّه توقيع. والأثرُ يحفظ تفصيلَه.`,
        data: { contractId, profileId: c.profileId },
      })
    } catch { /* الإشعارُ رفاهيةٌ لا تُعيد صفّا مُحي */ }
    return { ok: true }
  }

  /** تجديدُ الرابط — الرمزُ القديم يموت لحظتَها، فلا يبقى بابان */
  /* ═══ تحديثُ العروض المفتوحة في مكانها — أمرُ صاحب المنصّة (٣٠ سبتمبر) ═══

     «الا يمكن ان لا يصله ايميل ويكون لنا خانه تحديث العقد ويتغير العقد
     الموجود لكل شخص لم يوقعه بدون ان يصل له رابط جديد ويتحدث ما لديه
     حالياً؟» ثمّ: كلاهما (المرسَلُ وما طُلب فيه تعديل)، «والايميل يجب ان
     يقول ما هي التحديثات… في نقاط سهلة القراءة».

     وكان الوحيدُ سبيلا إلى متنٍ جديدٍ عقدا جديدا: يُلغى القائمُ فيصل صاحبَه
     رابطٌ آخرُ ورسالةُ إلغاء. وهو ثقيلٌ على من لم يفعل شيئا.

     ─────────── وما يجعله سالما ───────────

     ① **الرمزُ لا يُمَسّ** — فالرابطُ الذي بيده يبقى، ولا رسالةَ «رابطٌ جديد».
     ② **ولا يُوقَّع ما لم يُقرأ**: التوقيعُ يقابل `bodyHash` بما عُرض على
        صاحبه، فمن كانت صفحتُه مفتوحةً على القديم يُردّ بـ`body_changed`
        ويُؤمر أن يُعيد التحميل — وهو حارسٌ قائمٌ قبل هذا كلِّه.
     ③ **ومن أغلق الصفحةَ وعاد** لا يمسكه ذلك الحارس: يقرأ النصَّ الجديدَ
        كاملا، فالتوقيعُ لا يُفتح إلّا بالقراءة إلى آخره. وتصله الرسالةُ
        بالنقاط إن اختيرت. ويُكتب `bodyUpdatedAt` و`bodyPrevVersion` سجلًّا
        لا شريطا — نُزع الشريطُ عن صفحته بقرار صاحب المنصّة (١ أكتوبر ٢٠٢٦)،
        وعلّتُه عند `contractByToken`.
     ④ **ولا يُمَسّ موقَّع**: الشرطُ `status` في الاستعلام، و`isUntouchableContract`
        يُقرأ صفّا صفّا — فحتّى لو تسرّب صفٌّ بحالةٍ مفتوحةٍ وتاريخِ توقيع،
        يُترَك.

     ─────────── وما لا يتغيّر ───────────

     تاريخُ الإصدار من `createdAt` لا من ساعة اليوم: العرضُ صدر يومَ صدر،
     والمحدَّثُ نصُّه لا ميلادُه. ولقطتُه (دوراتُه وأتعابُه ووثائقُه) تُقرأ من
     صفّه كما جُمّدت، فلا يُدخَل عليه ما لم يُتَّفق عليه. */
  /* ═══ وبلا بريدٍ إن شاء (١ أكتوبر ٢٠٢٦) ═══

     أمرُ صاحب المنصّة: «I want to refresh them silently». فالبريدُ يُختار
     ولا يُفرَض: `notify: false` يحدّث النصَّ في مكانه ولا يرسل شيئا.

     **والصامتُ لا يُعلَم به من الصفحة كذلك**: شريطُ «حُدّث هذا العرضُ» نُزع
     بقرار صاحب المنصّة في اليوم نفسِه (علّتُه عند `contractByToken`). فمن
     حُدّث نصُّه صامتا لا يقول له شيءٌ إنّه تبدّل — ويقرأ الجديدَ كاملا قبل
     أن يوقّع، لأنّ التوقيعَ لا يُفتح إلّا بالقراءة إلى آخره.

     ⚠️ وهذا يعني أنّ نقاطَ إصدارٍ لم يُرسَل بريدُه لا تصل صاحبَها أبدا —
     ومنها في `v19` نقصٌ في حدّه الأدنى المضمون. فمن أراد أن تصله يختار
     البريد. والأثرُ يحمل `notified` فيُعرف بعد شهرٍ أيُّهما وقع. */
  async refreshOpenContracts(actorId: string, opts: { notify?: boolean } = {}) {
    const notify = opts.notify ?? true
    const rows = await this.prisma.trainerContract.findMany({
      where: {
        status: { in: ['sent', CONTRACT_AMENDMENT_REQUESTED] },
        bodyVersion: { not: CONTRACT_BODY_VERSION },
      },
      include: { profile: { include: { application: true } } },
    })

    const updated: { id: string; fullName: string; from: string | null }[] = []
    const skipped: { id: string; whyAr: string }[] = []

    for (const c of rows) {
      /* والموقَّعُ لا يُمَسّ ولو تسرّب صفُّه: الحكمُ في موضعٍ واحدٍ يقرؤه
         الحذفُ وهذا معا (`contract-untouchable.ts`). */
      if (isUntouchableContract(c)) {
        skipped.push({ id: c.id, whyAr: 'مسّه توقيعٌ فلا يُمَسّ متنُه' })
        continue
      }
      if (!contractHasBodyAr(c.bodyAr)) {
        skipped.push({ id: c.id, whyAr: 'عقدٌ بلا نصّ — من البابِ القديم' })
        continue
      }
      const app = c.profile.application
      const nextBody = renderContractBodyAr(this.contractBodyInput({
        /* والرقمُ رقمُه: التحديثُ يُعيد الصياغةَ لا يصنع عقدا جديدا */
        number: c.number,
        fullName: c.signerLegalName || app.fullName,
        email: c.signerEmail ?? app.email,
        reference: app.reference,
        courses: readContractCourses(c.qualifiedSnapshot),
        compensation: c.compensationType
          ? {
            type: c.compensationType,
            rate: String(c.compensationRate ?? '0'),
            currency: c.currency,
            minSeats: c.compensationMinSeats,
            referralRate: c.compensationReferralRate == null ? null : String(c.compensationReferralRate),
          }
          : null,
        hoursNoteAr: c.hoursNoteAr,
        rateWaivedReasonAr: c.rateWaivedReasonAr,
        requiredDocuments: readRequiredDocuments(c.requiredDocuments),
        /* ═══ ويومُ الإصدار يومُه لا اليوم ═══
           العرضُ صدر يومَ صدر. ولو كُتب تاريخُ اليومَ لَقرأ صاحبُه وثيقةً
           تقول إنّها صدرت بعد أن قرأها. */
        issuedOn: c.createdAt,
        gatesActivation: c.gatesActivation,
        orientationAt: c.orientationAt,
        /* وبنودُه الخاصّةُ من صفّه — وإلّا محاها التحديثُ وهو يحسب أنّه يُحدّث القالب */
        specialTermsAr: c.specialTermsAr,
      }))
      if (nextBody === c.bodyAr) {
        skipped.push({ id: c.id, whyAr: 'نصُّه هو نفسُه — لا جديد' })
        continue
      }

      const from = c.bodyVersion
      const now = new Date()
      const wrote = await this.prisma.$transaction(async (tx) => {
        /* قارنْ واضبطْ: عرضٌ وُقّع أو أُلغي بين القراءة والكتابة لا يُكتب فوقه */
        const done = await tx.trainerContract.updateMany({
          where: { id: c.id, status: c.status, bodyHash: c.bodyHash },
          data: {
            bodyAr: nextBody,
            bodyHash: sha256(nextBody),
            bodyVersion: CONTRACT_BODY_VERSION,
            bodyUpdatedAt: now,
            bodyPrevVersion: from,
          },
        })
        if (done.count === 0) return false
        await recordAudit(tx, {
          actorId, action: 'trainer.contract.body_refreshed',
          entityType: 'trainer_contract', entityId: c.id,
          meta: { fromVersion: from, toVersion: CONTRACT_BODY_VERSION, status: c.status, notified: notify },
        })
        return true
      })

      /* ═══ وما لم يُكتب لا يُقال إنّه كُتب ═══

         «قارنْ واضبطْ» يمتنع عن الكتابة إن وُقّع العرضُ بين القراءة والكتابة.
         فلو مضى العدُّ والبريدُ بعدها لَبلغ صاحبَه «حُدّث عرضُك» عن تحديثٍ
         لم يقع — وهو أسوأُ الوجهَين: الوثيقةُ سليمةٌ وصاحبُها مُخبَرٌ بغيرها. */
      if (!wrote) {
        skipped.push({ id: c.id, whyAr: 'تبدّلت حالتُه بين القراءة والكتابة — لم يُكتب فوقه' })
        continue
      }

      updated.push({ id: c.id, fullName: app.fullName, from })

      /* والرسالةُ رفاهيةٌ كأخواتها: النصُّ حُدّث ولو لم يصل بريد، ولا يُوقَّع
         إلّا بقراءته إلى آخره. (وكان هنا «والشريطُ على صفحته يقوله» — نُزع
         الشريطُ في ١ أكتوبر ٢٠٢٦، وعلّتُه عند `contractByToken`.) */
      if (!notify) continue
      try {
        const mail = contractUpdatedMail({
          fullName: app.fullName,
          reference: app.reference,
          contractNumber: c.number,
          title: c.title,
          changeGroups: changeGroupsBetween(from, CONTRACT_BODY_VERSION, { conditional: c.gatesActivation }),
          awaitingReply: isAmendmentRequested(c.status),
          /* ═══ ولا رابطَ توقيعٍ يُسكّ هنا ═══

             الذي بيده هو هو، ولا سبيلَ إلى إعادة بنائه أصلا: `tokenHash`
             وحدَه في الجدول لا الرمزُ. فلو سُكّ رمزٌ جديدٌ ليُوضَع في هذه
             الرسالة لَمات الذي بيده — وهو بعينه العطبُ الذي شكاه صاحبُ
             المنصّة («ضغط على فتح العقد فلم يُفتح») وأُصلح في #351 و#353.

             فالزرُّ يقصد بابَ الاستعادة: من فقد رابطَه طلبه ببريده. */
          contractUrl: `${publicSiteUrl()}/contract-link`,
        })
        await sendDirectEmail(this.prisma, {
          to: c.signerEmail ?? app.email, subject: mail.subject, ...renderMail(mail.doc),
        })
      } catch { /* لا يُنقَض تحديثٌ وقع لأنّ بريدا تعثّر */ }
    }

    return { ok: true, updated: updated.length, skipped: skipped.length, rows: updated, skippedRows: skipped }
  }

  /** ═══ ويستعيد المدرّبُ رابطَه بنفسه ═══

      رمزُ التوقيع لا يُحفَظ نصّا — `tokenHash` وحدَه في الجدول (وهو صواب:
      الرمزُ بطاقةُ دخولٍ لمن حملها). فما ضاع من صاحبه لا نستطيع أن نعيده
      إليه، ولا أن نضعه في رسالةٍ تاليةٍ نرسلها — ولذلك خلت رسالةُ التحديث
      من زرّ.

      فصار له أن يطلبه بنفسه ببريده. ويُسكّ رمزٌ جديدٌ عند الطلب، **فيموت
      القديمُ** — وهو ثمنٌ مقبولٌ لمن طلب بنفسه، ويُقال له في الرسالة.

      **ولا يُكشَف بهذا الباب وجودُ عقدٍ من عدمه**: الجوابُ واحدٌ في
      الحالَين، كأخيه `resendVerification`. ولولا ذلك لَصار بابا يُسأل به
      «أهذا البريدُ لمدرّبٍ عندكم؟» عن ألفِ بريدٍ في دقيقة. */
  async requestContractLink(email: string) {
    const at = email.trim().toLowerCase()
    /* والمرسَلُ إليه `signerEmail` إن كُتب، وإلّا بريدُ الطلب — كما يُرسَل أصلا */
    const rows = await this.prisma.trainerContract.findMany({
      where: {
        status: { in: ['sent', CONTRACT_AMENDMENT_REQUESTED] },
        OR: [
          { signerEmail: { equals: at, mode: 'insensitive' } },
          { profile: { application: { email: { equals: at, mode: 'insensitive' } } } },
        ],
      },
      include: { profile: { include: { application: true } } },
      orderBy: { createdAt: 'desc' },
    })
    /* وأحدثُها وحدَه: من له عرضان مفتوحان (نادر) يأخذ الأخير، ولا تُرسَل رسالتان */
    const contract = rows.find((c) => !isUntouchableContract(c))
    if (!contract) return { ok: true as const, emailDelivery: 'skipped' as const }

    const app = contract.profile.application
    const to = contract.signerEmail ?? app.email

    /* ═══ وبعد التذكير الأخير لا يمدّ الطلبُ أجلا ولا يقصّره (١ أكتوبر ٢٠٢٦) ═══

       التذكيرُ الأخيرُ وعدٌ بأجلٍ مسمّى («صالحٌ ثلاثةَ أيّام»)، وهذا البابُ بلا
       حساب. فلو سكّ بعده رمزا بيومَي النافذة لَصار الأجلُ كلمةً لا تُنفَّذ: يسقط
       العرضُ فيُطلب رابطٌ فيُوقَّع. ولو سكّه في أثناء الأجل لَمدّه أو قصّره بحسب
       ساعة الطلب.

       فبعد التذكير: في الأجل رابطٌ جديدٌ **بالأجل نفسِه**؛ وبعده لا رابط، بل
       رسالةٌ تقول إنّ المهلةَ انقضت ومتى — وتجديدُ العرض بيد الأكاديمية
       («جدِّدِ الرابط» قائم). والجوابُ لطالبه واحدٌ في كلّ حالٍ كما كان. */
    const promised = contract.status === 'sent' && contract.finalReminderAt ? contract.tokenExpiresAt : null
    if (promised && promised < new Date()) {
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.contract.link_requested',
        entityType: 'trainer_contract', entityId: contract.id,
        meta: { sentTo: to, status: contract.status, lapsed: true, expiredAt: promised.toISOString() },
      })
      let emailDelivery: DirectMailStatus = 'failed'
      try {
        const mail = contractLapsedMail({
          fullName: app.fullName, reference: app.reference, title: contract.title, expiredAt: promised,
          contractNumber: contract.number,
        })
        emailDelivery = (await sendDirectEmail(this.prisma, { to, subject: mail.subject, ...renderMail(mail.doc) })).status
      } catch {
        /* البريدُ يسقط والجوابُ واحد: لا يُكشَف بالخطأ ما لا يُكشَف بالنجاح */
      }
      return { ok: true as const, emailDelivery }
    }

    const minted = this.mintContractToken()
    const expiresAt = promised ?? minted.expiresAt
    await this.prisma.trainerContract.update({
      where: { id: contract.id }, data: { tokenHash: minted.tokenHash, tokenExpiresAt: expiresAt },
    })
    await this.rememberContractLink(this.prisma, {
      contractId: contract.id, tokenHash: minted.tokenHash, expiresAt, sentTo: to, purpose: 'link_request',
    })
    /* والفاعلُ هو المدرّبُ نفسُه لا موظّف — فلا `actorId` يُنسَب إليه غيرُه.
       والأجلُ نصّا: `sanitize` الأثرِ يجعل `Date` كائنا فارغا */
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.contract.link_requested',
      entityType: 'trainer_contract', entityId: contract.id,
      meta: { sentTo: to, expiresAt: expiresAt.toISOString(), status: contract.status },
    })
    const mail = await this.mailContract({
      contract, to, fullName: app.fullName,
      reference: app.reference, url: this.signingUrl(minted.token), expiresAt, resend: true,
    })
    return { ok: true as const, emailDelivery: mail.status }
  }

  async resendContract(contractId: string, actorId: string) {
    const contract = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!contract) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (contract.status !== 'sent') {
      throw new AuthError('bad_state', 'لا يُجدَّد رابطٌ إلّا لعقدٍ مرسَلٍ بانتظار التوقيع', 409)
    }
    const app = contract.profile.application
    const { token, tokenHash, expiresAt } = this.mintContractToken()
    await this.prisma.trainerContract.update({
      where: { id: contractId }, data: { tokenHash, tokenExpiresAt: expiresAt },
    })
    await this.rememberContractLink(this.prisma, { contractId, tokenHash, expiresAt, sentTo: app.email, purpose: 'resend' })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.resend', entityType: 'trainer_contract', entityId: contractId,
      meta: { sentTo: app.email, expiresAt },
    })
    const mail = await this.mailContract({
      contract, to: app.email, fullName: app.fullName, reference: app.reference,
      url: this.signingUrl(token), expiresAt, resend: true,
    })
    return { ok: true, signingUrl: this.signingUrl(token), expiresAt, emailDelivery: mail.status }
  }

  /* ═══ التذكيرُ الأخير — مرّةً واحدة، وأجلُه ثلاثةُ أيّام (١ أكتوبر ٢٠٢٦) ═══

     طلبُ صاحب المنصّة: «زرٌّ يذكّر المدرّبَ آخرَ مرّةٍ بتوقيع الاتفاقيّة، والعقدُ
     صالحٌ ثلاثةَ أيّام». وهو «جدِّدِ الرابط» بوجهٍ آخر: رمزٌ جديدٌ — فالقديمُ لا
     يُعرَف إلّا ببصمته، ولا يُرسَل ما لا يُعرَف — بأجل `FINAL_REMINDER_DAYS`،
     ورسالةٌ تقول إنّه الأخير وإلى متى.

     **ومرّةً واحدة**: «أخيرٌ» يُرسَل مرّتين يكذّب أوّلَه. فالشرطُ في الكتابة
     نفسِها (`finalReminderAt: null` مع `status: 'sent'`)، فنقرتان معا لا تُخرجان
     رسالتين، ولا يُذكَّر من وقّع بين القراءة والكتابة. ومن أراد مهلةً بعده
     فـ«جدِّدِ الرابط» قائمٌ بيومَيه. */
  async sendFinalReminder(contractId: string, actorId: string) {
    const contract = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!contract) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (contract.status !== 'sent') {
      throw new AuthError('bad_state', 'لا يُذكَّر إلّا بعرضٍ مرسَلٍ لم يُوقَّع بعد', 409)
    }
    if (contract.finalReminderAt) {
      throw new AuthError('already_reminded', 'أُرسل التذكيرُ الأخيرُ بهذا العرض من قبل — وجدِّدِ الرابطَ إن أردتَ مهلةً أخرى', 409)
    }
    const app = contract.profile.application
    const { token, tokenHash, expiresAt } = this.mintContractToken(FINAL_REMINDER_DAYS)
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: contractId, status: 'sent', finalReminderAt: null },
      data: { tokenHash, tokenExpiresAt: expiresAt, finalReminderAt: new Date() },
    })
    if (done.count === 0) {
      throw new AuthError('already_reminded', 'تغيّر العرضُ قبل الإرسال — أُرسل تذكيرُه أو وُقّع. حدِّثِ الصفحة', 409)
    }
    const to = contract.signerEmail ?? app.email
    await this.rememberContractLink(this.prisma, { contractId, tokenHash, expiresAt, sentTo: to, purpose: 'final_reminder' })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.final_reminder_sent', entityType: 'trainer_contract', entityId: contractId,
      /* والأجلُ نصّا: `sanitize` الأثرِ يجعل `Date` كائنا فارغا — فيضيع الأجلُ من سجلّه */
      meta: { sentTo: to, expiresAt: expiresAt.toISOString(), days: FINAL_REMINDER_DAYS },
    })
    const url = this.signingUrl(token)
    let emailDelivery: DirectMailStatus = 'failed'
    try {
      const mail = contractFinalReminderMail({
        fullName: app.fullName, reference: app.reference, title: contract.title, url, expiresAt,
        contractNumber: contract.number,
      })
      emailDelivery = (await sendDirectEmail(this.prisma, { to, subject: mail.subject, ...renderMail(mail.doc) })).status
    } catch {
      /* البريدُ يسقط والتذكيرُ وقع: الرابطُ الجديدُ يُعاد إلى الشاشة فيُرسَل بيد */
    }
    return { ok: true as const, signingUrl: url, expiresAt, emailDelivery }
  }

  /** الإلغاء — وما أُرسل لا يُحذف. الصفُّ يبقى دليلا على ما رُكّب ومن ألغاه */
  async revokeContract(contractId: string, actorId: string, reasonAr: string) {
    if (reasonAr.trim().length < 5) {
      throw new AuthError('no_reason', 'سببُ الإلغاء يُكتب — يُقرأ بعد شهرٍ حين يُسأل عنه، ويصل صاحبَه بحرفه', 422)
    }
    /* ═══ ويُقرأ الصفُّ قبل إغلاقه — لا لحارسٍ بل لرسالةٍ تخرج (٢٦ سبتمبر) ═══

       الإلغاءُ كان يحدّث الصفَّ ويكتب أثرَه ويميت رمزَه ثمّ **يسكت**. فمن
       ينتظر عقدا يفتح رابطَه فلا يعمل، ولا خبرَ عنده أنّه أُلغي ولا لماذا.
       وبلاغُ صاحب المنصّة (٢٦ سبتمبر): «يجب أن يكون زرُّ إلغاء العقد فيرسل
       للمدرّب أنّ العقد قد أُلغي ولماذا».

       والحارسُ يبقى حيث كان — `updateMany` بشرط الحالة — فالقراءةُ هنا
       للبريد لا للتحقّق: بين القراءة والكتابة قد يُوقَّع، والكتابةُ وحدَها
       تحكم. وحالُه المقروءةُ تقول أكان الصفُّ قد خرج إليه أصلا. */
    const before = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!before) throw new AuthError('not_found', 'العقد غير موجود', 404)
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: contractId, status: { in: ['draft', 'sent', CONTRACT_AMENDMENT_REQUESTED] } },
      /* ═══ والرمزُ يبقى ليُقال «أُلغي» لا «انتهى» (٣٠ سبتمبر ٢٠٢٦) ═══

             كان يُمسح، وحجّتُه: «ومن يفتحه يوقّع ما سُحب من تحته». ولا يقع:
             ولا يُخشى توقيعٌ بعده: `CONTRACT_OPEN_STATUSES` لا تحمل إلّا
             `sent`، وكلُّ مسلكٍ يكتب يدخل من `openByToken` فيُردّ
             بـ`bad_state`. فالذي كان يُحسَب أنّ المسحَ يمنعه يمنعه شرطُ
             الحالة، والمسحُ إنّما كان يمنع قراءةً — فيُقال للواقف «انتهى هذا
             الرابط» ولا يُعرَف أيُّ بابٍ هو.

             ولا يُسكب بالبقاء متنٌ: فرعُ `revoked` يردّ الحالَ والعنوانَ
             وحدَهما — لا بندا ولا أتعابا ولا سببَ الإلغاء (وهو ملاحظتُنا
             نحن، تُكتب لنا لا له). */
      data: {
        status: 'revoked', revokedAt: new Date(), revokedBy: actorId, revokeReasonAr: reasonAr.trim(),
      },
    })
    if (done.count === 0) throw new AuthError('bad_state', 'العقدُ ليس مفتوحا — لا يُلغى موقَّعٌ ولا ملغًى', 409)
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.revoke', entityType: 'trainer_contract', entityId: contractId,
      meta: { reasonAr: reasonAr.trim() },
    })
    /* والسببُ يصل بحرفه: ما كُتب ليُقرأ بعد شهرٍ يُقرأ اليومَ ممّن يخصّه */
    const emailDelivery = await this.notifyContractRevoked(before, reasonAr.trim(), false)
    return { ok: true, emailDelivery }
  }

  /* ═══════════ من الرابط — حيث يقرأ المدرّبُ ويوقّع ═══════════

     ولا حسابَ له هنا: `profile.userId` فارغٌ حتّى الدعوة، فالرمزُ هو الهويّة
     كما في رابط السجلّ. والفرقُ أنّ ذاك يقرأ ويُقيّم، وهذا **يلتزم بمال** —
     فرسائلُ الردّ تفرّق بين «لم يعد صالحا» و«وُقّع» و«أُلغي»، لأنّ من يقف
     أمام بابٍ مغلقٍ يحتاج أن يعرف أيَّ بابٍ هو. */

  /** العقدُ الذي هذا رمزُه الحيّ — أو `null` */
  private async findByLiveToken(token: string) {
    if (!token || token.length < 16) throw new AuthError('invalid_token', 'الرابطُ غيرُ صالح', 400)
    return this.prisma.trainerContract.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        documents: { orderBy: { uploadedAt: 'asc' } },
        profile: { include: { application: true } },
      },
    })
  }

  /** العقدُ برمزه الحيّ — وكلُّ فعلٍ يكتب يدخل من هنا وحدَه، لا من رابطٍ قديم */
  private async byToken(token: string) {
    const c = await this.findByLiveToken(token)
    if (!c) throw new AuthError('invalid_token', 'الرابطُ غيرُ صالح — تحقّقْ منه أو اطلب إعادةَ إرساله', 404)
    return c
  }

  /* ═══ رابطٌ ليس الحيَّ — يُقرأ من سجلّ الروابط (١ أكتوبر ٢٠٢٦) ═══

     فيقول حالَ عقده كما هي اليوم، ومتى بُعث بعده الأحدث. ولا يُفتَح للتوقيع
     أبدا: العرضُ المفتوحُ يُقال لرابطه القديم «بُعث بعدك أحدث» (`replaced`)،
     وكلُّ فعلٍ يكتب يمرّ بـ`byToken` على الحيّ وحدَه. وما لم يُحفَظ — رابطٌ
     صُرف قبل السجلّ أو حرفٌ مغلوط — يبقى «غيرُ صالح» كما كان. */
  private async contractByOldToken(token: string) {
    const link = await this.prisma.trainerContractLink.findUnique({
      where: { tokenHash: sha256(token) },
      include: { contract: { include: { profile: { include: { application: true } } } } },
    })
    if (!link) throw new AuthError('invalid_token', 'الرابطُ غيرُ صالح — تحقّقْ منه أو اطلب إعادةَ إرساله', 404)
    const newer = await this.prisma.trainerContractLink.findFirst({
      where: { contractId: link.contractId, createdAt: { gt: link.createdAt } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    })
    const view = await this.closedContractView(link.contract, { sentTo: link.sentTo, newerLinkAt: newer?.createdAt ?? null })
    if (!view) throw new AuthError('invalid_token', 'الرابطُ غيرُ صالح', 404)
    return view
  }

  /* ═══ حالُ عقدٍ لا يُوقَّع من رابطه — بحالٍ واحدةٍ مسمّاة ورقمِه وتواريخه ═══

     ① المتنُ مقفلا لعقدٍ **وُقّع** وحدَه (`SIGNED_COPY_STATES` مع `signedAt`) —
        نافذا كان أو منتهيا أو أزاحه أحدثُ منه أو أُعيد إليه. فمن وقّع يقرأ ما
        وقّعه من رابطه أبدا (طلبُ صاحب المنصّة). وما لم يُوقَّع لا متنَ على بابه
        المغلق، ولا سببَ إلغاءٍ ولا اعتذار — كما كان (`closed-doors-say-which`).
     ② والرابطُ القديمُ الذي ذهب إلى غير بريد الحيّ يُقال له الحالُ وحدَها
        (`detailed: false`): من صُحّح بريدُه بعد خطإٍ لا يقرأ عقدَه من وصله الأوّل. */
  private async closedContractView(
    c: Prisma.TrainerContractGetPayload<{ include: { profile: { include: { application: true } } } }>,
    old: { sentTo: string | null; newerLinkAt: Date | null } | null,
  ): Promise<ContractClosedView<Date> | null> {
    const state = closedStateOf(c, { old: old !== null, now: new Date() })
    if (!state) return null
    let detailed = true
    if (old) {
      const live = c.tokenHash
        ? await this.prisma.trainerContractLink.findUnique({ where: { tokenHash: c.tokenHash }, select: { sentTo: true } })
        : null
      detailed = sameMailbox(old.sentTo, live?.sentTo ?? c.signerEmail ?? c.profile.application.email)
    }
    const showBody = detailed && Boolean(c.signedAt) && SIGNED_COPY_STATES.includes(state)
    return {
      state,
      number: c.number,
      title: c.title,
      newerLinkAt: old?.newerLinkAt ?? null,
      detailed,
      signedAt: c.signedAt,
      signerLegalName: detailed ? c.signerLegalName : null,
      conditional: c.gatesActivation,
      signatureApprovedAt: c.signatureApprovedAt,
      countersignedAt: c.countersignedAt,
      supersededAt: c.supersededAt,
      terminatedAt: c.terminatedAt,
      declinedAt: c.declinedAt,
      revokedAt: c.revokedAt,
      revokedForResign: state === 'revoked' && c.revokeReasonAr === RESIGN_REVOKE_REASON_AR,
      requestedAt: state === 'amendment_requested' ? c.amendmentRequestedAt : null,
      requestAr: detailed && state === 'amendment_requested' ? c.amendmentRequestAr : null,
      expiredAt: state === 'expired' ? c.tokenExpiresAt : null,
      afterFinalReminder: state === 'expired' && Boolean(c.finalReminderAt),
      successor: state === 'revoked' || state === 'superseded' ? await this.successorOf(c) : null,
      bodyAr: showBody ? c.bodyAr : null,
      bodyHash: showBody ? c.bodyHash : null,
    }
  }

  /** العقدُ الذي جاء بعد هذا — ليُقال رقمُه. والمسمّى أوّلا: من أزاحه بالختم
   *  (`supersededByContractId`) ثمّ بديلُه المصرَّحُ به (`replacesContractId`)،
   *  ثمّ أوّلُ عقدٍ أُرسل إليه بعده (جوابُ التعديل بعقدٍ يُركَّب بيد). ولا تُذكَر
   *  مسوّدةٌ لم تخرج إليه، ولا ملحقٌ يُضاف إلى نافذٍ فلا يحلّ محلَّ شيء. */
  private async successorOf(c: { id: string; profileId: string; createdAt: Date; supersededByContractId: string | null }) {
    const pick = { number: true, title: true, status: true, sentAt: true } as const
    if (c.supersededByContractId) {
      return this.prisma.trainerContract.findUnique({ where: { id: c.supersededByContractId }, select: pick })
    }
    const named = await this.prisma.trainerContract.findFirst({
      where: { replacesContractId: c.id, status: { not: 'draft' } },
      orderBy: { createdAt: 'asc' },
      select: pick,
    })
    if (named) return named
    return this.prisma.trainerContract.findFirst({
      where: { profileId: c.profileId, createdAt: { gt: c.createdAt }, status: { not: 'draft' }, kind: { not: 'annex' } },
      orderBy: { createdAt: 'asc' },
      select: pick,
    })
  }

  /** يُقرأ العقدُ من رابطه — الحيِّ أو القديم — ويُسجَّل أنّ الحيَّ فُتح.
   *
   *  وكلُّ حالٍ غيرِ «مفتوحٍ للتوقيع» تُقال باسمها من `closedContractView`:
   *  كانت أربعٌ منها — المعتمَدُ والمُزاحُ والمنتهي والقديمُ المستبدَل — تسقط
   *  على «غيرُ صالح» فتقرأ «انتهى هذا الرابط: إمّا اعتُذر أو سُحب أو…».
   *  والمتنُ مع الموقَّع: من وقّع له أن يقرأ ما وقّعه، ولا يُوسَّع بذلك ما
   *  يُرى — الرابطُ نفسُه كان يعرض المتنَ كاملا قبل التوقيع. */
  async contractByToken(token: string) {
    const c = await this.findByLiveToken(token)
    if (!c) return this.contractByOldToken(token)
    const now = new Date()
    if (c.status !== 'sent' || (c.tokenExpiresAt && c.tokenExpiresAt < now)) {
      const closed = await this.closedContractView(c, null)
      if (!closed) throw new AuthError('invalid_token', 'الرابطُ غيرُ صالح', 404)
      return closed
    }

    await this.prisma.trainerContract.update({
      where: { id: c.id },
      data: { firstOpenedAt: c.firstOpenedAt ?? now, lastOpenedAt: now },
    })

    const required = readRequiredDocuments(c.requiredDocuments)
    return {
      state: 'open' as const,
      /* ═══ ولا قائمةَ تحديثٍ فوق النصّ — قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦) ═══

         كان يُحمَل هنا `bodyUpdatedAt` ونقاطُ ما تغيّر، فيُرسَم فوق النصّ شريطُ
         «حُدّث هذا العرضُ بتاريخ…» (٣٠ سبتمبر). وقولُ صاحب المنصّة وهو يراه على
         عقدٍ أُبلغ صاحبُه بالبريد: «no need for the update list on the top of
         the contract, because they have received an email with these changes».

         فالبريدُ وحدَه يحمل ما تغيّر إن اختير (`refreshOpenContracts` بـ
         `notify`)، والصامتُ صامتٌ تماما. وما يمنع التوقيعَ على غير ما قُرئ باقٍ
         بلا الشريط: حارسُ `body_changed` لمن كانت صفحتُه مفتوحةً على القديم،
         وشرطُ القراءة إلى آخر النصّ في الصفحة. والتاريخُ والإصدارُ السابقُ
         يُكتبان في الصفّ سجلًّا يُسأل عنه، ولا يُعرضان عليه.

         ولا يُعاد الحقلان هنا بلا قرارٍ جديد: يحرس ذلك
         `contract-body-refresh.test.ts` و`contract-refresh-silent.test.ts`.

         ═══ وسطرٌ واحدٌ بلا قائمة — قرارُ صاحب المنصّة في اليوم نفسِه ═══

         «فقط ابلغهم رساله بالاعلى يرجى اعاده قراءته… اختر جمله اقصر». فيُحمَل
         علَمٌ لا تاريخٌ ولا نقاط: حُدّث أم لم يُحدَّث. وتقول الصفحةُ سطرا
         واحدا: «حُدّث نصُّ هذا العرض — اقرأه كاملا قبل أن توقّعه».

         ولا يقول السطرُ «تغيّرت الصياغة»: في `v19` و`v20` تغييرٌ في المعنى
         يمسّ المال، وسطرٌ يقول «صياغةٌ فحسب» يُحتجّ به على الأكاديميّة. */
      bodyUpdated: Boolean(c.bodyUpdatedAt),
      contractId: c.id,
      /* ورقمُه فوق النصّ — يُقال ويُبحث به (١ أكتوبر ٢٠٢٦) */
      number: c.number,
      title: c.title,
      /* والمعروضُ في رأس الصفحة هو **المطبوعُ في الديباجة** لا اسمُ الحساب:
         رأسٌ يقول اسما والوثيقةُ تحته تقول آخرَ يجعل القارئَ يظنّ الفرقَ
         خطأً في الرأس فيمضي — وهو الفرقُ الذي وُضع زرُّ التصحيح له. */
      trainerName: c.profile.legalNameAr ?? c.profile.application.fullName,
      trainerEmail: c.signerEmail ?? c.profile.application.email,
      bodyAr: c.bodyAr,
      bodyVersion: c.bodyVersion,
      /* يُعاد ليُردَّ مع التوقيع، فيُقابَل بما في القاعدة — ولا يُوثَق به
         وحدَه: المقابلةُ في الخادم على `bodyAr` المحفوظ لا على ما يُرسَل. */
      bodyHash: c.bodyHash,
      expiresAt: c.tokenExpiresAt,
      requiredDocuments: required,
      /* أسماءٌ وأنواعٌ فقط — ولا مفاتيحَ تخزينٍ إلى واجهةٍ عامّة */
      uploaded: c.documents.map((d) => ({ id: d.id, kind: d.kind, originalName: d.originalName })),
      /* والسابعُ لمن عرضُه مشروطٌ وحدَه — تُسأل الدالّةُ ولا تُقرأ قائمةٌ،
         فما عُرض هو ما يُفحَص هو ما يُحفَظ (علّتُه في `contract-body.ts`). */
      acks: contractAcks(c.gatesActivation, c.bodyVersion),
      consentTextAr: CONTRACT_CONSENT_AR,
      consentVersion: CONTRACT_CONSENT_VERSION,
      /* وبه تقول الصفحةُ بعد التوقيع ما يلي — في العرض المشروط بوّابةٌ تُفتح
         وتوقيعُنا حين تُعتمَد دوراتُه، وفي غيره نفاذٌ باعتماده */
      conditional: c.gatesActivation,
    }
  }

  /** عقدٌ مفتوحٌ للكتابة — يُستعمل قبل كلّ فعلٍ يغيّر شيئا من الرابط */
  private async openByToken(token: string) {
    const c = await this.byToken(token)
    /* والقائمةُ مصدرُ الحقيقة، لا حرفُ 'sent' مكرّرا في مواضع — فطلبُ
       التعديل يوقف التوقيعَ بها وحدَها، في كلّ فعلٍ يُفعَل من الرابط. */
    if (!canRespondToContract(c.status)) {
      if (isAmendmentRequested(c.status)) {
        throw new AuthError('amendment_pending', 'طلبُك بالتعديل عندنا — ننظر فيه ونعيد إليك العرضَ مصحَّحا أو نجيبك', 409)
      }
      throw new AuthError('bad_state', 'هذا العقدُ لم يعد بانتظار التوقيع', 409)
    }
    if (c.tokenExpiresAt && c.tokenExpiresAt < new Date()) {
      throw new AuthError('expired_token', 'انقضى أجلُ الرابط — اطلب من الأكاديمية إعادةَ إرساله', 410)
    }
    return c
  }

  /** وعدُ رفعٍ لوثيقةٍ مطلوبة — كـ`requestDocumentUpload` في مسار الطلب */
  async requestContractDocumentUpload(token: string, input: {
    kind: string; originalName: string; mime: string; sizeBytes: number
  }) {
    assertFileUploadsEnabled('والبديلُ الآن: أرسِلْ وثيقتَك إلى فريق الأكاديمية بالبريد.')
    const c = await this.openByToken(token)
    const required = readRequiredDocuments(c.requiredDocuments)
    if (!required.some((d) => d.kind === input.kind)) {
      throw new AuthError('bad_kind', 'هذه الوثيقةُ ليست مطلوبةً في هذا العقد', 422)
    }
    if (!(IDENTITY_MIMES as readonly string[]).includes(input.mime)) {
      throw new AuthError('bad_mime', 'الصيغُ المقبولة: JPEG أو PNG أو WebP أو PDF', 422)
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_CONTRACT_DOC_BYTES) {
      throw new AuthError('too_large', `حجمُ الملفّ يتجاوز ${Math.round(MAX_CONTRACT_DOC_BYTES / 1048576)} ميغابايت`, 413)
    }

    const storageKey = newStorageKey()
    const doc = await this.prisma.$transaction(async (tx) => {
      /* ورفعُ وثيقةٍ من نوعٍ رُفع من قبلُ يحلّ محلَّه: من رفع صورةً مقلوبةً
         ثمّ أعاد الرفعَ أراد الثانيةَ، ولا يُقرأ عند المطابقة صفّان لنوعٍ واحد. */
      const old = await tx.trainerContractDocument.findMany({
        where: { contractId: c.id, kind: input.kind }, select: { id: true, storageKey: true },
      })
      if (old.length > 0) {
        await tx.trainerContractDocument.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
      }
      const created = await tx.trainerContractDocument.create({
        data: {
          contractId: c.id, kind: input.kind, storageKey,
          originalName: input.originalName.slice(0, 200), mime: input.mime, sizeBytes: input.sizeBytes,
        },
      })
      await recordAudit(tx, {
        actorId: null, action: 'trainer.contract.document_register',
        entityType: 'trainer_contract', entityId: c.id,
        meta: { kind: input.kind, storageKey, replaced: old.length },
      })
      return { created, old }
    })
    /* وبايتاتُ المستبدَل تُمحى بعد المعاملة — فمحوٌ يُخفق لا ينقض صفّا */
    for (const o of doc.old) { try { await deleteObject(o.storageKey) } catch { /* ما يبقى يُكنَس لاحقا */ } }

    const exp = Date.now() + SIGNED_URL_TTL_MS
    return {
      documentId: doc.created.id, storageKey,
      uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`,
    }
  }

  /** ═══ التوقيع ═══

      ومقابلةُ الهاش قبل كلِّ شيء: من فتح الصفحةَ ثمّ بُدّل المتنُ تحته —
      بإلغاءٍ وتركيبٍ جديدٍ مثلا — لا يمرّ توقيعُه على ما لم يره. */
  async signContractByToken(token: string, input: {
    legalName: string; addressAr: string; phone: string
    bodyHash: string; acks: string[]; ip?: string | null; userAgent?: string | null
  }) {
    const c = await this.openByToken(token)
    const legalName = input.legalName.trim()
    if (legalName.length < 4) {
      throw new AuthError('bad_name', 'اكتب اسمَك القانونيَّ كاملا كما في وثيقة هويّتك', 422)
    }
    /* ═══ ويكتب عنوانَه وهاتفَه بخطّه ═══

       ولا يُنقلان من نموذج التقديم: ذاك بياناتُ ترشُّحٍ تُملأ على عجل وقد
       تمضي شهورٌ قبل العقد، وهذه بياناتُ **طرفٍ في عقد** يُراسَل بها ويُعرَف
       بها. ومن نُقلت عنه بياناتُه بلا أن يراها له أن يقول إنّه لم يثبتها. */
    const addressAr = input.addressAr.trim()
    const phone = input.phone.trim()
    if (addressAr.length < 5) {
      throw new AuthError('bad_address', 'اكتب عنوانَك الكامل — وهو بيانُ طرفٍ في العقد', 422)
    }
    if (phone.length < 6) {
      throw new AuthError('bad_phone', 'اكتب رقمَ هاتفك', 422)
    }
    /* ═══ ولا تُوقَّع وثيقةٌ خاوية ═══

       كان المنعُ بالعرَض: `bodyHash` يُكتب مع المتن فيسقط بسقوطه، فترتدّ
       المقابلةُ أدناه. لكنّ `sha256('')` هاشٌ صحيحٌ تامّ — فمتنٌ خاوٍ لا
       `null` يمرّ نظيفا. ورسالةُ «تغيّر نصُّ العقد» تكذب على من لا نصَّ
       عنده أصلا: تأمره أن يعيد التحميلَ ويقرأ، ولا شيءَ يُقرأ. */
    if (!contractHasBodyAr(c.bodyAr)) {
      throw new AuthError('no_body', 'لا نصَّ لهذا العقد، فلا يُوقَّع. راسلِ الأكاديميةَ ليُرسَل إليك عقدٌ بنصّه', 409)
    }
    if (!c.bodyHash || input.bodyHash !== c.bodyHash) {
      throw new AuthError('body_changed', 'تغيّر نصُّ العقد بعد فتحك الصفحة — أعِدْ تحميلَها واقرأ النصَّ الجديد قبل التوقيع', 409)
    }
    const missingAcks = contractAcks(c.gatesActivation, c.bodyVersion).filter((a) => !input.acks.includes(a.key))
    if (missingAcks.length > 0) {
      throw new AuthError('acks_missing', 'لم تُقرّ ببنودٍ لا بدّ من الإقرار بها قبل التوقيع', 422)
    }
    const required = readRequiredDocuments(c.requiredDocuments).filter((d) => d.required)
    const have = new Set(c.documents.map((d) => d.kind))
    const missingDocs = required.filter((d) => !have.has(d.kind))
    if (missingDocs.length > 0) {
      throw new AuthError(
        'documents_missing',
        `لم تُرفَع بعد: ${missingDocs.map((d) => d.labelAr).join(' · ')}`,
        422,
      )
    }

    const signedAt = new Date()
    await this.prisma.$transaction(async (tx) => {
      /* قارنْ واضبطْ داخل المعاملة: قراءةٌ ثمّ كتابةٌ تسمح لنقرتين متزامنتين
         أن تمرّا معا، فيُكتب توقيعان ويُغلَق أثران لتوقيعٍ واحد. و«وُقّع
         مرّتين» على وثيقةٍ قانونيّةٍ لا معنى له. */
      const done = await tx.trainerContract.updateMany({
        where: { id: c.id, status: 'sent' },
        data: {
          status: 'signed', signedAt,
          signerLegalName: legalName,
          signerAddressAr: addressAr.slice(0, 300),
          signerPhone: phone.slice(0, 40),
          signerIp: input.ip?.slice(0, 64) ?? null,
          signerUserAgent: input.userAgent?.slice(0, 300) ?? null,
          consentTextAr: CONTRACT_CONSENT_AR,
          /* ═══ والجملُ الستُّ تُحفَظ نصّا لا مفاتيحَ ═══

             رأسُ `contract-body.ts` كان يقول إنّها تُحفَظ ولم تكن تُحفَظ:
             `consentTextAr` جملةُ التوقيع وحدَها، و`consentVersion` في الأثر
             يقول ما قرأه **بدلالةِ شيفرةٍ تتغيّر**. وقد صار للإقرارات
             إصداران، فيُكتب النصُّ كما عُرض عليه في هذه اللحظة.

             وداخلَ المعاملة مع التوقيع نفسِه: توقيعٌ يُكتب وجملُه لا تُكتب
             يترك الفجوةَ التي وُضع العمودُ لسدّها. */
          consentAcksAr: contractAcks(c.gatesActivation, c.bodyVersion).map((a) => ({ key: a.key, textAr: a.textAr })),
          signedBodyHash: input.bodyHash,
          /* ═══ ولا مهلةَ تُكتب هنا — أصلُها الاعتمادُ (٢٧ سبتمبر ٢٠٢٦) ═══

             كانت تُكتب من `signedAt`. وقولُ صاحب المنصّة في خطواته: «② نراجع
             توقيعَك ونعتمده … ④ **بعدها** لديك ٥ أيّام». فـ«بعدها» اعتمادُنا
             لا توقيعُه.

             وهو الأصحُّ أثرا: المهلةُ كانت تجري على من لا يستطيع الوفاءَ بها،
             لأنّ بوّابةَ الموادّ لا تُفتح له قبل أن يُمنَح دورَ المدرّب —
             ولا يُمنَحه إلّا بالاعتماد. فكانت ساعةٌ تدور على بابٍ مقفل.

             وموضعُها الآن في `approveSignature` مع فتح البوّابة ومنحِ
             الدور، ثلاثتُها في معاملةٍ واحدة. */
          /* ═══ والرمزُ يبقى حيّا بعد التوقيع (٢٩ سبتمبر ٢٠٢٦) ═══

             كان يُمسح هنا، وتعليقُه: «وُقّع مرّةً، فلا بابَ يُفتح ثانية».
             وشكا مدرّبٌ أنّه نقر «افتح العقد» بعد توقيعه فلم يُفتح له شيء:
             فمسحُ الرمز يُسقط `byToken` على `invalid_token` **قبل** أن
             يُقرأ فرعُ `signed` في `contractByToken` — فالأبوابُ الثلاثةُ
             التي كُتبت ليعرف الواقفُ أيَّ بابٍ هو لا يُطرَق أيٌّ منها، ويُقال
             له بدلَها «انتهى هذا الرابط».

             ولا يُخشى منه توقيعٌ ثانٍ: الكتابةُ أعلاه مشروطةٌ بـ`status:
             'sent'` داخل معاملةٍ، و`CONTRACT_OPEN_STATUSES` لا تحمل غيرَها —
             فكلُّ مسلكٍ يكتب يدخل من `openByToken` ويُردّ بـ`bad_state`.
             فالذي كان يحرسه المسحُ يحرسه الشرطُ، والمسحُ لم يكن يمنع توقيعا
             بل يمنع قراءةً.

             وهو بابُ نسخته الوحيدُ قبل ختمنا العقد: لا حسابَ له في المنصّة
             حتّى الاعتماد (`profile.userId` فارغٌ حتّى الدعوة)، وبريدُ
             التوقيع يحمل بصمةَ النصّ لا النصَّ. فلو مات الرمزُ هنا لم يبقَ
             للموقِّع موضعٌ يقرأ فيه ما التزم به. */
        },
      })
      if (done.count === 0) throw new AuthError('bad_state', 'العقدُ لم يعد بانتظار التوقيع', 409)
      await tx.trainerOnboardingTask.updateMany({
        where: { profileId: c.profileId, key: 'sign_contract' }, data: { doneAt: signedAt },
      })
      /* والفاعلُ هو المدرّبُ لا موظّف — ولا حسابَ له، فاسمُه في `meta`
         كما يفعل رابطُ السجلّ. ولا يُكتب في الأثر متنٌ ولا عنوانُ شبكة:
         الهاشُ يكفي دليلا، والعنوانُ في صفّه محروسا بصلاحيّته. */
      await recordAudit(tx, {
        actorId: null, action: 'trainer.contract.sign_by_trainer',
        entityType: 'trainer_contract', entityId: c.id,
        meta: {
          signerLegalName: legalName, bodyVersion: c.bodyVersion, bodyHash: c.bodyHash,
          consentVersion: CONTRACT_CONSENT_VERSION, signedAt,
        },
      })

      /* ═══ ولا ينقل التوقيعُ الطلبَ — الاعتمادُ ينقله (٢٧ سبتمبر ٢٠٢٦) ═══

         كان التوقيعُ ينقله إلى `onboarding` فورا. وثلاثةٌ تُبنى على النقل:
         بابُ الموادّ، وعاملُ التذكير، وعاملُ الانقضاء — كلُّها تشترط
         `onboarding`.

         والعطبُ أنّ البابَ لم يكن يُفتح بالنقل وحدَه: من وقّع يبقى دورُه
         `trainer_applicant`، ولا `trainer.portal` فيه. فكان النقلُ يوقظ
         عامِلَي المهلة على مدرّبٍ لا يستطيع الدخولَ أصلا — يُذكَّر بمهلةٍ
         ويُنذَر بانقضائها وبابُه مقفل.

         فصار النقلُ حيث يُفتح البابُ فعلا: في الاعتماد، ومعه منحُ الدور
         وبدءُ المهلة. ومن وقّع يبقى `contract_pending` حتّى ننظر في توقيعه
         — وهي الحالُ الصادقة: عقدٌ أُرسل ووُقّع وينتظر جوابَنا. */
    })

    /* ═══ ونسخةُ صاحبِه تصله — وصلةً لا سكبَ متن، ولا وعدَ طباعةٍ قبل أوانها ═══

       نصُّها ودواعيه في رأس `signedCopyMail` (`trainer-decision-mail.ts`):
       سُحبت من هنا إلى دالّةٍ خالصةٍ ليُقاس ما يصل الإنسانَ بفحصٍ يقرؤه كما
       يقرؤه هو، لا بمسحٍ على شيفرة هذه الخدمة. */
    const app = c.profile.application
    try {
      const mail = signedCopyMail({
        legalName,
        title: c.title,
        contractNumber: c.number,
        signedOnAr: fmtDateWith(signedAt, { year: 'numeric', month: 'long', day: 'numeric' }),
        bodyHash: c.bodyHash ?? '—',
        conditional: c.gatesActivation,
        /* وبابُ نسخته هو الرابطُ الذي وقّع منه — يبقى حيّا بعد التوقيع.
           ولا يُسرَّب بذلك رمزٌ إلى أحد: هو الرمزُ نفسُه، إلى البريد نفسِه
           الذي أُرسل إليه أوّلا. */
        contractUrl: this.signingUrl(token),
      })
      await sendDirectEmail(this.prisma, {
        to: c.signerEmail ?? app.email, subject: mail.subject, ...renderMail(mail.doc),
      })
    } catch { /* البريدُ رفاهية — التوقيعُ وقع، والنسخةُ في بوّابته */ }

    /* ═══ والخبرُ يحمل الخطوةَ التالية لا وقوعَ الفعل وحدَه ═══

       كانت الرسالةُ تقول «وقّع فلانٌ عقدَه» وتسكت. ومن قرأها لا يعرف أبقيَ
       شيءٌ قبل أن يعتمده أم لا — فيفتح ملفَّه ليرى، أو ينتظر ولا شيءَ يأتي.
       وتوقيعُ العقد آخرُ الخطوات الثلاث غالبا، فأكثرُ ما يُقال بعده: «اكتمل
       تجهيزُه، اعتمِدْه». وهذه تقولها، وتعدّد الباقيَ حين يبقى. */
    const readiness = await this.readinessForApplication(app.id)
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      templateKey: 'trainer.contract.signed',
      title: 'وقّع مدرّبٌ عقدَه',
      body: readiness.ready
        ? `وقّع ${legalName} «${c.title}» — واكتمل تجهيزُه. افتح ملفَّه واعتمِدْه اعتمادا كاملا.`
        : `وقّع ${legalName} «${c.title}» — وبقي قبل اعتماده: ${readiness.blockersAr.join(' · ')}`,
      data: { contractId: c.id, applicationId: app.id },
    })
    return { ok: true, signedAt, readiness }
  }

  /** الاعتذارُ — جوابٌ مشروعٌ لا عطب. والعقدُ عرضٌ يُقبَل ويُردّ. */
  /** النهايةُ الثالثة: يطلب تعديلا فيقف التوقيعُ ويصل طلبُه طابورَ الإدارة.

      ولا يُمحى الرمزُ هنا خلافا للاعتذار: العقدُ باقٍ ينتظر جوابَنا، فإمّا
      أُلغي وأُرسل مصحَّحا وإمّا رُدَّ عليه بأنّه يبقى — وفي الحالين يعود
      إليه بابٌ. والاعتذارُ نهايةٌ، وهذا وقفةٌ. */
  async requestContractAmendment(token: string, textAr: string) {
    const c = await this.openByToken(token)
    const body = textAr.trim()
    if (body.length < 5) {
      throw new AuthError('no_text', 'اكتب ما تريد تعديلَه — سطرٌ واحدٌ يكفي', 422)
    }
    const requestedAt = new Date()
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: c.id, status: 'sent' },
      data: {
        status: CONTRACT_AMENDMENT_REQUESTED,
        amendmentRequestAr: body.slice(0, AMENDMENT_TEXT_MAX),
        amendmentRequestedAt: requestedAt,
      },
    })
    if (done.count === 0) throw new AuthError('bad_state', 'العقدُ لم يعد بانتظار التوقيع', 409)
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.contract.amendment_requested',
      entityType: 'trainer_contract', entityId: c.id,
      meta: { textAr: body.slice(0, AMENDMENT_TEXT_MAX) },
    })
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      templateKey: 'trainer.contract.amendment_requested',
      title: 'طلب مدرّبٌ تعديلا على عرضه',
      body: `طلب ${c.profile.application.fullName} تعديلا على «${c.title}» — ونصُّه: ${body.slice(0, 200)}`,
      data: { contractId: c.id, applicationId: c.profile.applicationId },
    })
    return { requestedAt }
  }

  async declineContractByToken(token: string, reasonAr: string) {
    const c = await this.openByToken(token)
    const reason = reasonAr.trim()
    if (reason.length < 5) {
      throw new AuthError('no_reason', 'اكتب سببَ اعتذارك — سطرٌ واحدٌ يكفي، ويساعدنا أن نفهم', 422)
    }
    const declinedAt = new Date()
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: c.id, status: 'sent' },
      data: {
        status: 'declined', declinedAt, declineReasonAr: reason.slice(0, 500),
        /* ═══ والرمزُ يبقى ليُعرَف أنّه اعتذارٌ لا انتهاءُ رابط (٣٠ سبتمبر) ═══

             فرعُ `declined` في `contractByToken` كان لا يُبلَغ: مسحُ الرمز
             يُسقط `byToken` على `invalid_token` قبله. فمن اعتذر ثمّ عاد إلى
             رابطه — أو نقره سهوا — قيل له «انتهى هذا الرابط» بدل «سُجّل
             اعتذارُك ووصل فريقَنا. وإن كان ذلك سهوا فتواصل معنا»، وهي الجملةُ
             التي تُصلح السهوَ إن وقع.
             ولا يُخشى توقيعٌ بعده: `CONTRACT_OPEN_STATUSES` لا تحمل إلّا
             `sent`، وكلُّ مسلكٍ يكتب يدخل من `openByToken` فيُردّ
             بـ`bad_state`. فالذي كان يُحسَب أنّ المسحَ يمنعه يمنعه شرطُ
             الحالة، والمسحُ إنّما كان يمنع قراءةً — فيُقال للواقف «انتهى هذا
             الرابط» ولا يُعرَف أيُّ بابٍ هو. */
      },
    })
    if (done.count === 0) throw new AuthError('bad_state', 'العقدُ لم يعد بانتظار التوقيع', 409)
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.contract.decline',
      entityType: 'trainer_contract', entityId: c.id,
      meta: { reasonAr: reason.slice(0, 500) },
    })
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      templateKey: 'trainer.contract.declined',
      title: 'اعتذر مدرّبٌ عن عقده',
      body: `اعتذر ${c.profile.application.fullName} عن «${c.title}» — وسببُه: ${reason.slice(0, 200)}`,
      data: { contractId: c.id, applicationId: c.profile.applicationId },
    })
    /* ويُعاد تاريخُه: الرمزُ مات بالاعتذار، فالشاشةُ تبني حالَها من هذا
       الجواب ولا تسأل بابا أغلقناه (رأسُ `sign` في `ContractSign.tsx`). */
    return { ok: true, declinedAt }
  }

  /* ═══════════ اعتمادُ التوقيع — وبه يُفتح طورُ الموادّ ═══════════

     التوقيعُ إقرارُ طرفٍ واحد. واعتمادُه أن **ينظر إنسانٌ في وثيقة الهويّة
     ويطابق بها الاسمَ القانونيَّ المكتوب** — وهو عملُ نظرٍ لا شرطٌ تفحصه آلة،
     فله زرٌّ لا مؤقِّت.

     ═══ ولا نوقّع به العرضَ المشروط (١ أكتوبر ٢٠٢٦) ═══

     سأل صاحبُ المنصّة: «عندما أصادق على توقيعٍ هل هذا معناه أنّنا وقّعنا مع
     المدرّب؟». وكان الجوابُ نعم منذ ٢٧ سبتمبر: كان هذا الموضعُ يكتب توقيعَ
     المفوَّض عنّا ويُنفذ العقد، ويقول بريدُه «فصار العقدُ نافذا بين الطرفين».
     وقرارُه: «لا أريد أن أتعاقد مع أحدٍ قبل أن أعتمد دوراته… نحن نعتمد توقيعَك
     وسوف نقوم بتوقيع العقد وتحويله إلى عقدٍ غير مشروط عندما نقوم باعتماد
     دوراتك… ولك الآن المنصّةُ مفتوحة».

     فثلاثةُ أبوابٍ يحكمها `signatureApprovalOf` بما وقّعه صاحبُ العقد:
     · `approve_only` — العرضُ المشروط: يُكتب اعتمادُ التوقيع (`signature_approved`)
       وتُفتح بوّابتُه وتبدأ مهلتُه، ولا يُمَسّ عمودٌ من أعمدة الخَتم. ونوقّعه في
       `completeConditionalOffer` يومَ تُعتمَد دوراتُه.
     · `seal` — العقدُ غيرُ المشروط: يُكتب لمن اعتُمدت موادُّه أصلا، فاعتمادُ
       توقيعه خَتمُه كما كان.
     · `sealed_by_text` — عرضٌ مشروطٌ وُقّع على متنٍ يقول إنّ اعتمادَ التوقيع
       توقيعُنا (v12 إلى v23). فلا يُعتمَد إلّا خاتما — واعتمادُه بلا خَتمٍ خلافُ
       ما وقّعه. وكان يُردّ فيُعاد للتوقيع لا محالة؛ فصار المعتمِدُ يختار
       (٢ أكتوبر ٢٠٢٦، قرارُ صاحب المنصّة: «Do not force me to do any action»):
       يعتمده كالعقود الجديدة بطلبٍ صريح (`likeNew`) فيُفتح طورُه بلا خَتمٍ
       كـ`approve_only` — باختياره بعد أن قيل له إنّ نصَّه يقول غيرَ ذلك — أو
       يعتمده كما وقّعه (`asSigned`) فيُختَم الآن بنصّه، أو يعيده للتوقيع على
       النصّ الحاضر (`requestResign`).

     وهو المعبرُ الوحيدُ من «وقّع» إلى «بوّابةٌ مفتوحة». */

  /** يعتمد توقيعَ المدرّب: يفتح طورَ الموادّ إن كان العرضُ مشروطا، ويختم العقدَ
      إن لم يكن.

      والنشرُ لا يقع من هنا: `decide('activate')` بعد اعتماد الموادّ هي التي
      تربط حسابَه وتنشره وتختم عرضَه — وعلّةُ الفصل أدناه. */
  async approveSignature(
    contractId: string, actorId: string,
    input: {
      noteAr?: string | null; actorRoles?: string[]
      /** «اعتمِدْه كما وقّعه» — لما وُقّع على نصٍّ يجعل الاعتمادَ توقيعا منّا:
          يقول المعتمِدُ إنّه يريد ذلك الخَتمَ بعينه، وقد قرأ قبله أنّه يوقّع الآن */
      asSigned?: boolean
      /** «اعتمِدْه كالعقود الجديدة» — للنصّ نفسِه: يُعتمَد التوقيعُ ويُفتح الطورُ
          ولا نوقّع إلّا يومَ تُعتمَد دوراتُه، وقد قرأ قبله أنّ نصَّه يقول غيرَ ذلك */
      likeNew?: boolean
    } = {},
  ) {
    const c = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!c) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (c.status !== 'signed') {
      throw new AuthError('bad_state', 'لا يُعتمَد إلّا عقدٌ وقّعه صاحبُه ولم يُعتمَد بعد', 409)
    }
    /* ═══ والاعتمادُ يفتح طورَ الموادّ، ولا يَنشُر الحساب (٢٧ سبتمبر ٢٠٢٦) ═══

       خطواتُ صاحب المنصّة بنصّها: «① تقرأه وتوقّعه · ② نراجع توقيعَك ونطابق
       الاسمَ القانونيَّ ونعتمده · ③ نرسل لك أنّنا اعتمدنا توقيعَك ونمنحك حقَّ
       فتح الحساب · ④ بعدها لديك ٥ أيّام لتعديل محاور ومصادر دوراتك · ⑤ يُنشر
       حسابُك رسميّا وتبدأ باستقبال الطلبات».

       فالاعتمادُ والنشرُ **قراران لا قرار**، وبينهما طورُ الموادّ.

       ── وما كان يقع قبل اليوم: قفلٌ مغلقٌ على نفسه ──

       كان هذا الموضعُ ينادي `decide('activate')` فورا — أي أنّ زرَّ الاعتماد
       ينشر الحسابَ ويتخطّى طورَ الموادّ كلَّه. وكان التوقيعُ وحدَه ينقل الطلبَ
       إلى `onboarding` ويبدأ المهلة.

       **ولم يكن أحدٌ يبلغ ذلك الطور.** `trainer_applicant` — دورُ من وقّع ولم
       يُنشَر حسابُه — لا يملك `trainer.portal` أصلا (`server/auth/permissions.ts`:
       «حتى ذلك الحين لا يملك إلا رؤية طلبه»). فبوّابةُ الموادّ مفتوحةٌ في
       `portal-access.ts` لحالة `onboarding`، وحارسُ الصلاحيّة فوقها يردّه قبل
       أن تُسأل الحالةُ أصلا. فالمهلةُ تجري عليه وهو محبوسٌ خارجَ البوّابة،
       والتذكيرُ يصله بمهلةٍ لا يستطيع الوفاءَ بها.

       فصار الاعتمادُ يفعل ما وُصف في ③: **يمنحه حقَّ الولوج فعلا** (ربطُ
       الحساب ودورُ المدرّب)، وينقل حالتَه إلى طور الموادّ، ومن هذه اللحظة تبدأ
       مهلتُه. والنشرُ (`decide('activate')`) يبقى قرارا تاليا بعد اعتماد
       الموادّ — وهو الخطوة ⑤. وكان يختم توقيعَنا معها حتّى ١ أكتوبر، ثمّ صار
       الخَتمُ مع النشر (رأسُ هذه الدالّة).

       ── وأمانُ منح الدور مقيسٌ لا مفترَض ──

       دورُ `trainer` يحمل معه أبوابَ الشعب والمال. وهي مغلقةٌ عليه بعدُ:
       بابُ الحساب البنكيّ محروسٌ بـ`active_only` في `trainer-bank.service`،
       وأبوابُ الشعب تُقيَّد بشعبه هو — ولا شعبةَ له قبل الإسناد، والإسنادُ
       لا يقع قبل النشر (البند 2-11). فما يُفتح بهذا الدور اليومَ هو طورُ
       الموادّ وحدَه. */
    /* حارسُ التضارب نفسُه الذي في `decide`: من يعتمد عقدا يفتح به حسابا
       ويمنح دورا. وهو يجري هنا أيضا لأنّ العقدَ قد لا يحبس التفعيلَ
       (`gatesActivation = false`)، فلا يُنادى `decide` أصلا ولا يجري حارسُها. */
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } })
    if (actor && actor.email === c.profile.application.email) {
      throw new AuthError('self_decision', 'لا يجوز اعتمادُ عقدٍ مرتبطٍ ببريدك', 403)
    }

    /* ═══ ونصٌّ يجعل الاعتمادَ توقيعا يُعتمَد بما يختاره المعتمِدُ صريحا (٢ أكتوبر ٢٠٢٦) ═══

       ما وُقّع على v12–v23 يقول نصُّه إنّ اعتمادَه خَتم. فلا يُختَم بنقرةٍ لم تقل
       إنّها تريده — صفحةٌ مفتوحةٌ من قبلُ، أو شاشةُ خطوات التجهيز — ولا يُعتمَد
       بلا خَتمٍ بنقرةٍ لم تقل ذلك. بل بالزرّ الذي يقول قبله ما يقع: «كما وقّعه»
       (`asSigned`) فيُختَم الآن، أو «كالعقود الجديدة» (`likeNew`) فيُفتح طورُه
       ولا نوقّع إلّا يومَ تُعتمَد دوراتُه — باختيار صاحب المنصّة («Option 4»)
       وقد قيل له إنّ ذلك يغيّر ما تقوله المنصّةُ لا ما وقّعه الرجل.
       وبلا أحدهما يُردّ بالخيارات كلِّها لا بأحدها، ومعًا يُردّان: لا يُخمَّن
       أيُّهما أُريد. */
    if (input.asSigned === true && input.likeNew === true) {
      throw new AuthError('two_choices', 'اخترْ واحدا: «كما وقّعه» أو «كالعقود الجديدة»', 400)
    }
    const rule = signatureApprovalOf(c)
    if (rule === 'sealed_by_text' && input.asSigned !== true && input.likeNew !== true) {
      throw new AuthError('sealed_by_text', SEALED_BY_TEXT_AR, 409)
    }
    /* و`likeNew` لا يمسّ إلّا ما نصُّه يجعل الاعتمادَ توقيعا: العقدُ غيرُ المشروط
       يُختَم كما كان، وv24 لا يُختَم أصلا */
    const approvedLikeNew = rule === 'sealed_by_text' && input.likeNew === true
    const mode: 'seal' | 'approve_only' = rule === 'approve_only' || approvedLikeNew ? 'approve_only' : 'seal'

    const note = (input.noteAr ?? '').trim().slice(0, 500)
    const approvedAt = new Date()
    await this.prisma.$transaction(async (tx) => {
      /* قارنْ واضبطْ داخل المعاملة كما في التوقيع: نقرتان متزامنتان تمرّان
         معا فيُكتب اعتمادان ويُمنَح الدورُ مرّتين. */
      if (mode === 'seal') {
        const done = await tx.trainerContract.updateMany({
          where: { id: c.id, status: 'signed' },
          data: {
            status: 'countersigned', countersignedAt: approvedAt, countersignedBy: actorId,
            /* المطبوعُ في المستند اسمُ المفوَّض في السجلّ، والمحفوظُ في
               `countersignedBy` **من ضغط فعلا**. فإن اختلفا كان وكيلا عنه
               بتفويضٍ خطّيٍّ يُكتب في الملحوظة — والسجلُّ يقول من فعل. */
            academySignatoryName: ACADEMY_LEGAL.signatoryNameAr,
            academySignatoryTitle: ACADEMY_LEGAL.signatoryTitleAr,
            countersignNoteAr: note.length > 0 ? note : null,
            /* واعتمادُ التوقيع يُكتب هنا أيضا — وقع مع الخَتم في اللحظة نفسِها.
               فكلُّ عقدٍ اعتُمد توقيعُه يقول متى ومن اعتمده، خُتم معه أم بعده. */
            signatureApprovedAt: approvedAt, signatureApprovedBy: actorId,
            signatureApprovalNoteAr: note.length > 0 ? note : null,
          },
        })
        if (done.count === 0) throw new AuthError('bad_state', 'اعتُمد العقدُ قبل ثوانٍ — حدّثْ الصفحة', 409)
        await recordAudit(tx, {
          actorId, action: 'trainer.contract.countersign',
          entityType: 'trainer_contract', entityId: c.id,
          meta: {
            signerLegalName: c.signerLegalName, signedBodyHash: c.signedBodyHash,
            bodyVersion: c.bodyVersion, gatesActivation: c.gatesActivation,
            academySignatoryName: ACADEMY_LEGAL.signatoryNameAr,
            noteAr: note.length > 0 ? note : null, countersignedAt: approvedAt,
            /* ومن قرأ السجلَّ بعد سنةٍ يعرف لمَ خُتم عرضٌ مشروطٌ قبل اعتماد دوراته:
               اعتُمد كما وقّعه، ونصُّه يجعل الاعتمادَ توقيعا */
            acceptedAsSigned: rule === 'sealed_by_text',
          },
        })
        const moved = await this.supersedePriorLive(tx, { profileId: c.profileId, contractId: c.id, at: approvedAt })
        for (const id of moved) {
          await recordAudit(tx, {
            actorId, action: 'trainer.contract.superseded',
            entityType: 'trainer_contract', entityId: id,
            meta: { byContractId: c.id, supersededAt: approvedAt },
          })
        }
      } else {
        /* ═══ اعتمادٌ بلا خَتم ═══
           أعمدةُ الخَتم (`countersignedAt` واسمُ المفوَّض وصفتُه) لا تُمَسّ: هي
           توقيعُنا، ويقع يومَ تُعتمَد دوراتُه. وملحوظةُ المطابقة تُحفَظ هنا
           وتُضَمّ إلى ملحوظة الخَتم يومئذ (`completeConditionalOffer`). ولا
           يُزاح عقدٌ نافذٌ قبله: لا ينفذ هذا بعدُ ليحلّ محلَّ شيء. */
        const done = await tx.trainerContract.updateMany({
          where: { id: c.id, status: 'signed' },
          data: {
            status: 'signature_approved', signatureApprovedAt: approvedAt, signatureApprovedBy: actorId,
            signatureApprovalNoteAr: note.length > 0 ? note : null,
          },
        })
        if (done.count === 0) throw new AuthError('bad_state', 'اعتُمد التوقيعُ قبل ثوانٍ — حدّثْ الصفحة', 409)
        await recordAudit(tx, {
          actorId, action: 'trainer.contract.approve_signature',
          entityType: 'trainer_contract', entityId: c.id,
          meta: {
            signerLegalName: c.signerLegalName, signedBodyHash: c.signedBodyHash,
            bodyVersion: c.bodyVersion, gatesActivation: c.gatesActivation,
            noteAr: note.length > 0 ? note : null, signatureApprovedAt: approvedAt,
            /* ومن قرأ السجلَّ بعد سنةٍ يعرف لمَ لم يُختَم عرضٌ نصُّه يجعل الاعتمادَ
               توقيعا: اعتُمد كالعقود الجديدة باختيار المعتمِد */
            approvedLikeNew,
          },
        })
      }

      /* ═══ وهنا يُفتح طورُ الموادّ — ومن هنا تبدأ مهلتُه ═══

         ثلاثةٌ معا في المعاملة نفسِها، لأنّ واحدا منها بلا أخيه يترك المدرّبَ
         في حالٍ لا مخرجَ منها: مهلةٌ تجري بلا بوّابةٍ تُفتح، أو بوّابةٌ تُفتح
         بلا مهلةٍ تُقاس، أو حالةٌ تنتقل بلا دورٍ يعبر بها حارسَ الصلاحيّة.

         ولا شيءَ منها لعقدٍ لا يحبس التفعيل (`gatesActivation = false`): ذاك
         بندٌ يُوثَّق على مدرّبٍ نشطٍ أصلا — لا طورَ موادٍّ له ولا مهلة. */
      if (c.gatesActivation) {
        /* ① المهلةُ من الاعتماد لا من التوقيع: «بعدها لديك ٥ أيّام» — ﻭ«بعدها»
              في كلام صاحب المنصّة هي الخطوةُ ③، اعتمادُنا. وهو نصُّ البند 2-8
              («تبدأ من تاريخ اعتماد الأكاديمية لتوقيعه») — وبنودُ الطور كلُّها
              تسري قبل توقيعنا بنصّ البند 17-1 من v24. */
        await tx.trainerContract.update({
          where: { id: c.id },
          data: { conditionDeadlineAt: deadlineFrom(approvedAt) },
        })

        /* ② وحقُّ الولوج يُمنَح فعلا لا اسما: ربطُ حسابِ المتقدّم بالملفّ،
              ورفعُه من `trainer_applicant` إلى `trainer`. وبلا هذا تبقى
              البوّابةُ مقفلةً مهما قالت الحالةُ — وهي العلّةُ التي جعلت طورَ
              الموادّ غيرَ مطروقٍ منذ بُني. */
        const applicantUserId = c.profile.application.userId
        if (applicantUserId) {
          if (c.profile.userId == null) {
            await tx.trainerProfile.update({
              where: { id: c.profileId }, data: { userId: applicantUserId },
            })
          }
          await tx.userRole.deleteMany({
            where: { userId: applicantUserId, roleId: 'trainer_applicant' },
          })
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: applicantUserId, roleId: 'trainer' } },
            create: { userId: applicantUserId, roleId: 'trainer' },
            update: {},
          })
        }

        /* ③ والحالةُ تنتقل إلى طور الموادّ. وشرطُه شرعيّةُ النقل من الخريطة
              نفسِها التي تمنع في `transition` — لا بمِحَكٍّ ثانٍ يفترق عنها. */
        if (transitionProblemAr(c.profile.application.status as TrainerStatus, 'onboarding') === null) {
          await this.apps.transition(
            c.profile.applicationId, 'onboarding', actorId,
            'اعتمادُ التوقيع — وبه يُفتح طورُ الموادّ', tx,
          )
        }
      }
    })

    /* ═══ ولا يُفتح الحساب من هنا (٢٠ سبتمبر ٢٠٢٦) ═══

       كان الاعتمادُ يستدعي `decide('activate')` فيصير المدرّبُ نشطا بمجرّد
       أن يُختم عقدُه. وقرارُ صاحب المنصّة أن يبقى القبولُ الكاملُ **قرارَه
       هو**: «حين يوقّع يصلني خبرُه، فأقبله قبولا كاملا». فاعتمادُ العقد
       يُتمّ الخطوةَ الثالثةَ من التجهيز ولا يتجاوز القرارَ الذي بعدها.

       ── ولمَ هو تحسينٌ لا تعقيد ──

       العقدُ واحدٌ من ثلاثة، والاثنان الآخران قد ينقصان وقتَ ختمه: يُوقَّع
       عقدٌ ولا أتعابَ مضبوطةً بعد، فيصير نشطا ومستحقّاتُه صفر. والقرارُ بعده
       يقرأ الثلاثَ معا (`readinessFor`) فلا يمرّ ناقص.

       و`gatesActivation` يبقى في الصفّ كما هو: يقول إن كان هذا العقدُ حابسا
       لتفعيل صاحبه أم بندا يُوثَّق على ملفٍّ حيّ — ويُقرأ في الشاشة. وإنّما
       زال أثرُه الآليُّ هنا. */
    const readiness = await this.readinessForApplication(c.profile.applicationId)

    /* ولا يُعتمَد عقدٌ في صمت: من وقّع ينتظر جوابا، وهو اليومَ ملزَمٌ بما وقّع */
    const app = c.profile.application
    try {
      const mail = contractApprovedMail({
        legalName: c.signerLegalName ?? app.fullName,
        title: c.title,
        approvedOnAr: fmtDateWith(approvedAt, { year: 'numeric', month: 'long', day: 'numeric' }),
        portalUrl: `${publicSiteUrl()}/trainer`,
        guideUrl: `${publicSiteUrl()}${TRAINER_GUIDE_PATH}`,
        gatesActivation: c.gatesActivation,
        sealedNow: mode === 'seal',
        contractNumber: c.number,
      })
      await sendDirectEmail(this.prisma, {
        to: c.signerEmail ?? app.email,
        subject: mail.subject,
        ...renderMail(mail.doc),
      })
    } catch { /* البريدُ رفاهية — الاعتمادُ وقع، والنسخةُ تُعاد من الإدارة */ }

    /* وتُردّ الجاهزيّةُ مع النتيجة: الشاشةُ تقول «بقي كذا» أو «اكتمل — اعتمِدْه»
       في الموضع الذي ضُغط فيه، فلا يُبحَث عن الخطوة التالية في شاشةٍ أخرى. */
    /* و`activated: false` صريحةً لا مسكوتا عنها: هذا بندٌ يُوثَّق على مدرّبٍ
       نشطٍ أصلا، فلا حسابَ يُفتح به — والشاشةُ تقرأ الحقلَ نفسَه في الحالَين. */
    /* و`sealed` يقول للشاشة أيُّ البابَين وقع — فتقول «اعتُمد توقيعُه وفُتحت
       بوّابتُه» أو «خُتم العقدُ ونفَذ» بحرفه، لا جملةً واحدةً للبابَين. */
    return {
      ok: true as const, sealed: mode === 'seal', approvedAt,
      countersignedAt: mode === 'seal' ? approvedAt : null,
      readiness, activated: false as const,
    }
  }

  /* ═══ وما كان نافذا له قبلَه يُزاح — في معاملة الخَتم نفسِها (١ أكتوبر ٢٠٢٦) ═══

     كان لا شيءَ يكتب `superseded` على عقد مدرّب: من اعتُمد له عقدٌ جديدٌ وله
     عقدٌ نافذٌ بقي له عقدان نافذان بشرطَين، ولا يُعرف أيُّهما يحكم. والقرّاءُ
     يسألون «عقدَه النافذ» بصيغة المفرد (`trainer-offer.service`
     و`trainer-bank.service` و`trainer-application.service`) — فيأخذ كلٌّ منهم
     ما يقع له.

     فالأحدثُ خَتما يُزيح ما قبله لحظةَ خَتمه. ودليلُ توقيع القديم لا يُمَسّ
     (`signedAt` والاسمُ والهاشُ والخَتم): ما وقع بين الطرفين وقع، ونفاذُه
     انتهى للمستقبل وحدَه. وقارنْ واضبطْ على `countersigned`: فسخٌ يقع في
     اللحظة نفسِها لا يُكتب فوقه.

     وهي دالّةٌ لا كتلةٌ في موضعٍ واحد: الخَتمُ يقع في بابَين — اعتمادُ توقيعِ
     عقدٍ غيرِ مشروط (`approveSignature`)، واعتمادُ دوراتِ صاحب العرض المشروط
     (`completeConditionalOffer`). وكتلةٌ في أحدهما تُنسى في الآخر.

     ═══ وأثرُها يكتبه مُناديها لا هي ═══

     `trainer.contract.superseded` فعلٌ عالٍ: يغيّر سجلَّ إنسان. و«ما يمسّ
     إنسانا يُخبَر به إنسان» (`audit-high-reaches-person`) يقرأ **المعالِجَ**
     الذي كُتب فيه الأثر — وهذه الدالّةُ لا تُخبر أحدا، والبابان يُخبران
     المدرّبَ بالخَتم الذي أزاح عقدَه. فتردّ ما أزاحت، ويكتب كلُّ بابٍ أثرَه
     حيث يُرسل بريدَه. والبابان محروسان: `contract-supersede` و
     `countersign-then-publish`. */
  private async supersedePriorLive(
    tx: Prisma.TransactionClient,
    a: { profileId: string; contractId: string; at: Date },
  ): Promise<string[]> {
    const prior = await tx.trainerContract.findMany({
      where: { profileId: a.profileId, status: 'countersigned', id: { not: a.contractId } },
      select: { id: true },
    })
    const moved: string[] = []
    for (const p of prior) {
      const r = await tx.trainerContract.updateMany({
        where: { id: p.id, status: 'countersigned' },
        data: { status: 'superseded', supersededAt: a.at, supersededByContractId: a.contractId },
      })
      if (r.count > 0) moved.push(p.id)
    }
    return moved
  }

  /* ═══════════ اسمُ الطرف الثاني — تصحيحُه قبل التوقيع وبعده ═══════════

     بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «الطرف الثاني كاسم يجب أن يكون
     مطابقا للهويّة أو أعطِه الحقَّ بكتابته بنفسه، لأنّ الاسم الموجود هنا هو
     ما أُخذ من حسابه وغالبا ليس اسما ثلاثيّا ولا يشبه جواز السفر أو الهويّة».

     وهو أخطرُ ما في هذا المسار: وثيقةٌ تسمّي طرفا في ديباجتها ويوقّعها إنسانٌ
     باسمٍ آخرَ في خانة التوقيع ليست وثيقةً تامّة، ومن ينازع فيها بعد سنةٍ
     يجد الثغرةَ مكتوبةً في متنها.

     والأبوابُ ثلاثةٌ كانت، فصارت اثنين (٢٧ سبتمبر ٢٠٢٦):

     ① **قبل التجميد** — الموظّفُ يكتب الاسمَ مطابقا للوثيقة في شاشة التركيب،
        ويُحفَظ في الملفّ فيَرِثه كلُّ عقدٍ بعده (`composeContract`).
     ② **في التوقيع نفسِه** — المدرّبُ يكتب اسمَه القانونيَّ في خانة التوقيع،
        فيكون هو `signerLegalName` الذي نطابقه بوثيقته قبل أن نعتمد. وهو
        الأصدق: صاحبُ الاسم أعلمُ به منّا. وفوق الخانة تنبيهٌ يقول له أن
        يتأكّد أنّه ما في هويّته أو جوازه.
     ③ **وبعد وقوع الخطأ** — يُرفَض التوقيعُ فيُعاد العقدُ مصحَّحا بنقرةٍ
        (`reissueWithCorrectedName`) — فيُوفى بما وعد به بريدُ الرفض.

     ــ وبابٌ رابعٌ أُغلق: زرُّ «اسمي في هويّتي غيرُ هذا» قبل التوقيع. علّتُه
     أدناه، وخلاصتُها أنّه كان بابا ثانيا إلى ما يفعله ② أصلا، ويوقف العقدَ
     بحالةِ اعتراضٍ على بند. */

  /** ═══ وبابُ المدرّب أُغلق — قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) ═══

      كان هنا `requestNameCorrection`: المدرّبُ يضغط «اسمي في هويّتي غيرُ هذا»
      فيقف عقدُه. وعلّةُ حذفه أنّ الوقوفَ كان بحالة `amendment_requested`
      نفسِها — فيُرسَم له لوحُ «طلبُك بالتعديل عندنا… ويقف التوقيعُ حتّى
      نجيبك». ووقع ذلك لمدرّبٍ حقيقيّ: صحّح اسمَه فظنّ أنّه اعترض على بند،
      وظنّ صاحبُ المنصّة أنّ تصحيحا داخليّا حُسب توقيعا.

      وقولُ صاحب المنصّة: «لا داعيَ للزرّ أصلا — قبل التوقيع يضع المدرّبُ
      اسمَه القانونيَّ فنطابقه». وخانةُ `legalName` في شاشة التوقيع تفعل
      ذلك بعينه: ما يُكتب فيها هو `signerLegalName`، وعليه تقع المطابقةُ قبل
      الاعتماد. فالزرُّ كان بابا ثانيا إلى بابٍ مفتوح.

      ── وما بقي عمدا ──

      `reissueWithCorrectedName` أدناه، وعمودا `nameCorrection*`، وعرضُهما في
      شاشة العقود، ومعجمُ الأثر. فصفوفٌ سلكت هذا البابَ قبل إغلاقه **قائمةٌ
      في الإنتاج** — وأداةُ إصلاحها تبقى، وإلّا بقي أصحابُها بلا مخرج. */

  /** يُعاد العقدُ مصحَّحا باسمه القانونيّ — بنقرةٍ واحدةٍ تُنشئ البديلَ وترسله.
   *
   *  ═══ ولمَ بديلٌ لا تحريرُ حقل ═══
   *
   *  اسمُ الطرف الثاني في **متن** الوثيقة، والمتنُ مجمَّدٌ ومهشَّشٌ بـ
   *  `bodyHash` وعليه يُقابَل ما وُقّع. فتحريرُ الاسم يجعل المعروضَ غيرَ
   *  الموقَّع عليه — وهو القيدُ الذي بُنيت عليه هذه الوحدةُ كلُّها.
   *
   *  ═══ والبنودُ تُنسَخ من الصفّ لا تُعادُ من الحاضر ═══
   *
   *  الأتعابُ والدوراتُ والوثائقُ وموعدُ الجلسة تُقرأ من **العقد القديم**،
   *  لا من حال المدرّب اليوم. فالبديلُ تصحيحُ اسمٍ لا إعادةُ تفاوض: لو قُرئ
   *  الحاضرُ لَتبدّل معه أجرُه أو دوراتُه بلا أن يقصد أحدٌ ذلك، ولَوقّع على
   *  غير ما اتُّفق عليه.
   */
  async reissueWithCorrectedName(
    contractId: string, actorId: string, input: { legalNameAr?: string | null } = {},
  ) {
    const old = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!old) throw new AuthError('not_found', 'العقد غير موجود', 404)

    /* الاسمُ: ما كتبه الموظّفُ الآن، وإلّا ما قاله المدرّبُ في طلبه */
    const name = (input.legalNameAr ?? old.nameCorrectionAr ?? '').trim()
    if (name.length < 4) {
      throw new AuthError('no_name', 'اكتب الاسمَ القانونيَّ كما في وثيقة الهويّة', 422)
    }
    if (!contractHasBodyAr(old.bodyAr)) {
      throw new AuthError('no_body', 'عقدٌ بلا نصّ — من البابِ القديم. أنشئ عقدا جديدا', 409)
    }
    /* ولا يُعاد عن عقدٍ نافذ: ما خُتم بين الطرفين لا يُستبدَل بنقرة، وبابُه
       الفسخُ لا التصحيح. والموقَّعُ الذي لم يُرفَض توقيعُه بعدُ كذلك: يُرفَض
       أوّلا بسببٍ مكتوبٍ يصل صاحبَه، ثمّ يُعاد. */
    const REPLACEABLE = ['draft', 'sent', CONTRACT_AMENDMENT_REQUESTED, 'revoked', 'declined', 'expired']
    if (!REPLACEABLE.includes(old.status)) {
      throw new AuthError(
        'bad_state',
        'لا يُستبدَل عقدٌ مسَّه ختمُنا أو ينتظره — ارفضِ التوقيعَ أوّلا بسببٍ يصل صاحبَه، ثمّ أعِدْه مصحَّحا',
        409,
      )
    }

    const app = old.profile.application
    const issuedOn = new Date()
    const replacement = await this.composeReplacement(old, name, actorId, issuedOn)

    const created = await this.prisma.$transaction(async (tx) => {
      /* ① ويُغلَق القائمُ إن كان مفتوحا — ولا يبقى بابان على وثيقتَين */
      if (['draft', 'sent', CONTRACT_AMENDMENT_REQUESTED].includes(old.status)) {
        await tx.trainerContract.updateMany({
          where: { id: old.id, status: old.status },
          data: {
            status: 'revoked', revokedAt: issuedOn, revokedBy: actorId,
            revokeReasonAr: `أُنشئ عقدٌ بديلٌ بالاسم الصحيح للطرف الثاني: ${name}`.slice(0, 500),
            /* والرمزُ يبقى كأخواته (٣٠ سبتمبر ٢٠٢٦): أزاحه أحدثُ منه، فيُقال
               ذلك على بابه بدل «انتهى هذا الرابط». والتوقيعُ ممنوعٌ بشرط
               الحالة لا بمسح الرمز. */
          },
        })
      }
      /* ② والاسمُ يُحفَظ في الملفّ فلا يعود الخطأُ من البابِ نفسِه */
      await tx.trainerProfile.update({
        where: { id: old.profileId }, data: { legalNameAr: name },
      })
      /* ③ والبديلُ يُنشأ مسودّةً، ويقول صفُّه من حلَّ محلَّه */
      const next = await tx.trainerContract.create({ data: replacement })
      await recordAudit(tx, {
        actorId, action: 'trainer.contract.name_reissue',
        entityType: 'trainer_contract', entityId: next.id,
        meta: {
          replacesContractId: old.id, legalNameAr: name,
          wasAr: old.profile.legalNameAr ?? app.fullName,
          revision: next.revision, bodyHash: next.bodyHash,
        },
      })
      await recordAudit(tx, {
        actorId, action: 'trainer.legal_name.set',
        entityType: 'trainer_profile', entityId: old.profileId,
        meta: { legalNameAr: name, wasAr: old.profile.legalNameAr, source: 'reissue' },
      })
      return next
    })

    /* ④ ويعلم صاحبُه أنّ اسمَه صار كما قال — في جرسه إن كان له حساب.
       والبريدُ يخرج في ⑤ بالرابط، وهذا خبرُ **ما تغيّر في سجلّه**: من
       أُعيدت تسميتُه في وثائقنا يجب أن يعرف، ولو لم يفتح بريدَه. */
    if (old.profile.userId) {
      await safeNotify(this.prisma, {
        userId: old.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.contract.name_reissued',
        title: 'أُعيد عقدُك مصحَّحا باسمك',
        body: `صار اسمُك في الطرف الثاني «${name}» كما في وثيقة هويّتك، وأُعيد عقدُك بهذا الاسم. ورابطُ توقيعه في بريدك — والرابطُ السابقُ بطل.`,
        data: { contractId: created.id, replacesContractId: old.id },
      })
    }

    /* ⑤ ويُرسَل بسببه مقولا: من طلب تصحيحا يعرف أنّ هذا جوابُ طلبه */
    const sent = await this.sendContract(
      created.id, actorId,
      `هذا عقدُك مصحَّحا: صار اسمُك في الطرف الثاني «${name}» كما في وثيقة هويّتك. والنسخةُ السابقةُ أُلغيت ورابطُها بطل — فوقّعْ هذه وحدَها.`,
    )
    return { ...sent, ok: true as const, contractId: created.id, revision: created.revision }
  }

  /** يُركَّب بديلُ عقدٍ قائمٍ على الإصدار الحاضر من المتن — صفٌّ جاهزٌ للإنشاء.
   *
   *  مشتركٌ بين بابَين: تصحيحِ الاسم (`reissueWithCorrectedName`)، وإعادةِ
   *  الموقَّع للتوقيع على نصٍّ محدَّث (`requestResign`). والبنودُ تُنسَخ من
   *  الصفّ القديم لا تُعاد من الحاضر — علّتُه في رأس الأوّل.
   *
   *  ═══ إلّا ما يُطلَب تغييرُه صراحةً (١ أكتوبر ٢٠٢٦) ═══
   *
   *  الإعادةُ للتوقيع صارت تقبل أتعابا ودوراتٍ وبنودا خاصّةً جديدة. فما مُرِّر
   *  في `over` يغلب، وما لم يُمرَّر يُنسَخ كما هو — فتصحيحُ الاسم لا يمسّ شيئا
   *  غيرَ الاسم، كما كان. */
  private async composeReplacement(
    old: Prisma.TrainerContractGetPayload<{ include: { profile: { include: { application: true } } } }>,
    name: string, actorId: string, issuedOn: Date,
    over: {
      compensation?: ReturnType<typeof effectiveCompensation>
      courses?: ContractCourseRow[]
      specialTermsAr?: string | null
    } = {},
  ): Promise<Prisma.TrainerContractUncheckedCreateInput> {
    const app = old.profile.application
    const pre = await this.contractPrefill(old.profile.applicationId)
    const fee = over.compensation !== undefined
      ? over.compensation
      : old.compensationType
        ? {
          ruleId: old.compensationRuleId,
          type: old.compensationType,
          rate: old.compensationRate == null ? '0' : String(old.compensationRate),
          currency: old.currency ?? LEDGER_CURRENCY,
          minSeats: old.compensationMinSeats,
          referralRate: old.compensationReferralRate == null ? null : String(old.compensationReferralRate),
        }
        : null
    const courses = over.courses ?? readContractCourses(old.qualifiedSnapshot)
    const specialTermsAr = over.specialTermsAr !== undefined ? over.specialTermsAr : old.specialTermsAr
    /* والبديلُ عقدٌ آخرُ برقمٍ آخر: من وقّع الأوّلَ ثمّ أُعيد إليه يعرف أيَّهما بين يديه */
    const number = await this.nextContractNumber()
    const bodyAr = renderContractBodyAr(this.contractBodyInput({
      number,
      fullName: name,
      email: old.signerEmail ?? app.email,
      reference: app.reference,
      /* الملحق (أ) كما كان: لقطةُ يومِ التركيب لا مؤهّلاتُ اليوم — إلّا ما اختير الآن */
      courses,
      gatesActivation: old.gatesActivation,
      orientationAt: old.orientationAt,
      compensation: fee
        ? { type: fee.type, rate: fee.rate, currency: fee.currency, minSeats: fee.minSeats, referralRate: fee.referralRate }
        : null,
      hoursNoteAr: old.hoursNoteAr,
      rateWaivedReasonAr: old.rateWaivedReasonAr,
      requiredDocuments: readRequiredDocuments(old.requiredDocuments),
      specialTermsAr,
      issuedOn,
    }))
    /* والبديلُ يُنشأ مسودّةً، ويقول صفُّه من حلَّ محلَّه */
    return {
      number,
      profileId: old.profileId,
      title: old.title,
      kind: 'replacement',
      revision: old.revision + 1,
      replacesContractId: old.id,
      status: 'draft',
      bodyVersion: CONTRACT_BODY_VERSION,
      bodyAr,
      bodyHash: sha256(bodyAr),
      compensationRuleId: fee?.ruleId ?? null,
      compensationType: fee?.type ?? null,
      compensationRate: fee?.rate ?? null,
      currency: fee?.currency ?? old.currency,
      compensationMinSeats: fee?.minSeats ?? null,
      compensationReferralRate: fee?.referralRate ?? null,
      hoursNoteAr: old.hoursNoteAr,
      rateWaivedReasonAr: old.rateWaivedReasonAr,
      specialTermsAr,
      qualifiedSnapshot: (over.courses ?? old.qualifiedSnapshot) as Prisma.InputJsonValue,
      requiredDocuments: old.requiredDocuments as Prisma.InputJsonValue,
      signerEmail: old.signerEmail ?? app.email,
      /* ويُقرأ الاشتراطُ من الحاضر لا من الصفّ القديم: قد تكون موادُّه
         اعتُمدت بين الإرسالَين، فيصير عقدُه نهائيّا لا عرضا مشروطا. */
      gatesActivation: pre.gatesActivation,
      orientationAt: pre.gatesActivation ? old.orientationAt : null,
      orientationUrl: pre.gatesActivation ? old.orientationUrl : null,
      conditionDeadlineAt: pre.gatesActivation ? old.conditionDeadlineAt : null,
      createdBy: actorId,
    }
  }

  /** ═══ «حُدّث النصُّ — أعِدْه للتوقيع» (١ أكتوبر ٢٠٢٦) ═══

      مدرّبٌ وقّع إصدارا سابقا من المتن، ولم تعتمده الأكاديميّةُ بعد — فهو
      عرضٌ مشروطٌ لا يلزم إلّا بختمنا (البند 2-6)، وعدمُ تمامه ليس إخلالا من
      أحد (البند 2-11). فلنا أن نسحبه ونعرض الإصدارَ الحاضر.

      ── ولمَ لا يُستعمَل «رفضُ التوقيع» ──

      ذاك بابُ **عيبٍ في التوقيع** (اسمٌ لا يطابق الوثيقة): سؤالُه «ما الذي لم
      يطابق؟» وبريدُه «لم نستطع اعتمادَ توقيعك». ومن وقّع صحيحا ثمّ قرأ ذلك
      ظنّ أنّا وجدنا فيه خللا. فهذا بابٌ آخر بسببٍ آخرَ وبريدٍ آخر.

      ── ودليلُ التوقيع لا يُمَسّ ──

      كما في `rejectSignature`: `signedAt` والاسمُ والهاشُ وعنوانُ الشبكة تبقى
      في الصفّ المغلَق — ما وقّعه وقع، والسؤالُ بعد سنةٍ يجد جوابَه فيه. */
  async requestResign(contractId: string, actorId: string, input: ReissueForSigningInput) {
    return this.reissueForSigning(contractId, actorId, input, 'resign')
  }

  /** البابان معا: الإعادةُ للتوقيع (`resign`) وقبولُ طلب التعديل (`amendment`).
   *
   *  والفرقُ بينهما في أربعة: الحالُ التي يُغلَق منها القديم (`signed` أو
   *  `amendment_requested`)، وسببُ إغلاقه، وفعلُ الأثر، **وأيُّ إصدارٍ قرأه
   *  صاحبُه** فتُقاس منه التغييرات (`versionReadByRequester`). وما سوى ذلك
   *  واحد: بديلٌ بشروطٍ تُغيَّر إن أُريد، ورسالةٌ واحدةٌ فيها نصُّ الموظّف
   *  وما تغيّر ورابطُ التوقيع. */
  private async reissueForSigning(
    contractId: string, actorId: string, input: ReissueForSigningInput, mode: 'resign' | 'amendment',
  ) {
    const subject = (input.subjectAr ?? '').trim()
    const body = (input.bodyAr ?? '').trim()
    if (subject.length < RESIGN_SUBJECT_MIN || subject.length > RESIGN_SUBJECT_MAX) {
      throw new AuthError('no_subject', `اكتب عنوانَ الرسالة (${RESIGN_SUBJECT_MIN}–${RESIGN_SUBJECT_MAX} حرفا)`, 422)
    }
    if (body.length < RESIGN_BODY_MIN || body.length > RESIGN_BODY_MAX) {
      throw new AuthError('no_body_text', `اكتب نصَّ الرسالة (${RESIGN_BODY_MIN}–${RESIGN_BODY_MAX} حرفا)`, 422)
    }
    if (hasAmendmentPlaceholder(body)) {
      throw new AuthError('placeholder_left', 'في الرسالة سطرٌ لم يُستبدَل بعد («اكتب هنا…») — اكتب جوابَك مكانه', 422)
    }
    const old = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!old) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (!contractHasBodyAr(old.bodyAr)) {
      throw new AuthError('no_body', 'عقدٌ بلا نصّ — من البابِ القديم. أنشئ عقدا جديدا', 409)
    }
    /* والاسمُ ما وقّع به صاحبُه: هو أعلمُ باسمه، وكتبه بيده في خانة التوقيع */
    const app = old.profile.application
    const name = (old.signerLegalName ?? old.profile.legalNameAr ?? app.fullName).trim()

    /* ═══ ولا تُغيَّر أتعابُ مدرّبٍ نشطٍ من هنا ═══

       قاعدةُ الأتعاب تُكتب لحظةَ الإعادة — كما في التركيب — والمستحقّاتُ
       تُحسب بالقاعدة السارية ساعةَ الحساب (`activeRule(…, new Date())`). فمدرّبٌ
       نشطٌ له شعبٌ تجري يتبدّل ما يُحسب له عنها **قبل أن يوقّع على الجديد**،
       ولو لم يوقّعه أبدا. ومن لم يُفعَّل بعدُ لا شعبةَ له يمسّها ذلك. */
    if (input.compensation && app.status === 'active') {
      throw new AuthError(
        'fee_active_trainer',
        'مدرّبٌ نشط: تغييرُ أتعابه هنا يسري على ما يُحسب له من اليوم قبل أن يوقّع. أعِدْه بأتعابه القائمة، وغيّرْها من شاشة الأتعاب بتاريخ سريان',
        409,
      )
    }
    const typedTerms = input.specialTermsAr !== undefined
      ? cleanSpecialTermsAr(input.specialTermsAr)
      : undefined
    let courses: ContractCourseRow[] | undefined
    if (input.courseIds) {
      const pre = await this.contractPrefill(old.profile.applicationId)
      courses = this.chosenCourses(pre.courses, input.courseIds)
      if (courses.length === 0) {
        throw new AuthError('no_courses', 'اختر دورةً واحدةً على الأقلّ ممّا هو مؤهَّلٌ له — الملحق (أ) لا يُطبَع فارغا', 422)
      }
    }
    const oldFee: ContractCompensation | null = old.compensationType
      ? {
        type: old.compensationType,
        rate: old.compensationRate == null ? '0' : String(old.compensationRate),
        currency: old.currency ?? LEDGER_CURRENCY,
        minSeats: old.compensationMinSeats,
        referralRate: old.compensationReferralRate == null ? null : String(old.compensationReferralRate),
      }
      : null
    const newFee = input.compensation
      ? effectiveCompensation(
        oldFee && { ruleId: old.compensationRuleId ?? '', ...oldFee },
        input.compensation,
      )
      : undefined

    const issuedOn = new Date()
    const replacement = await this.composeReplacement(old, name, actorId, issuedOn, {
      compensation: newFee, courses, specialTermsAr: typedTerms,
    })
    /* وما تغيّر فيه هو يتقدّم ما تغيّر في القالب — وكلاهما لا يُحذَف
       (علّتُه في `personalChangesAr`) */
    const personalAr = personalChangesAr(
      {
        compensation: oldFee,
        courses: readContractCourses(old.qualifiedSnapshot),
        specialTermsAr: old.specialTermsAr,
      },
      {
        compensation: newFee
          ? { type: newFee.type, rate: newFee.rate, currency: newFee.currency, minSeats: newFee.minSeats, referralRate: newFee.referralRate }
          : oldFee,
        courses: courses ?? readContractCourses(old.qualifiedSnapshot),
        specialTermsAr: typedTerms !== undefined ? typedTerms : old.specialTermsAr,
      },
    )
    /* ويُقاس ما تغيّر ممّا قرأه هو — لا من صفٍّ حُدّث نصُّه تحته (علّتُه
       عند `versionReadByRequester`). والموقَّعُ لا يُحدَّث، فهما سواءٌ فيه. */
    const readVersion = mode === 'amendment' ? versionReadByRequester(old) : old.bodyVersion
    /* ونقاطُ العرض المشروط لمن عرضُه مشروطٌ وحدَه (`conditionalOnly`). والبديلُ
       يتبع أصلَه في هذا: لو اعتُمدت موادُّه بينهما لَخُتم الأصلُ ولم يُعَد. */
    const templateGroups = changeGroupsBetween(readVersion, CONTRACT_BODY_VERSION, { conditional: old.gatesActivation })
    /* والأثرُ يحفظ ما تغيّر كلَّه نقطةً نقطة — والرسالةُ تقوله بما يليق ببابها:
       لطالب التعديل سطرٌ وملخّصٌ عن القالب (`reissueChangesView`) */
    const changesAr = resignChangeGroups(personalAr, templateGroups).flatMap((g) => g.itemsAr)
    const view = reissueChangesView(mode, personalAr, templateGroups)

    const created = await this.prisma.$transaction(async (tx) => {
      /* قارنْ واضبطْ: الموقَّعُ وحدَه. فالمعتمَدُ نافذٌ وبابُه رضا صاحبه لا
         نقرتُنا، والمرسَلُ لا توقيعَ عليه يُسحَب — يُحدَّث نصُّه في مكانه. */
      const done = mode === 'resign'
        ? await tx.trainerContract.updateMany({
          where: { id: old.id, status: 'signed' },
          data: {
            status: 'revoked', revokedAt: issuedOn, revokedBy: actorId,
            /* وبادئةٌ غيرُ «رُفض التوقيع» بقصد: شاشةُ العقود تبني لوحَ الرفض
               عليها، وهذا ليس رفضا */
            revokeReasonAr: RESIGN_REVOKE_REASON_AR,
          },
        })
        : await tx.trainerContract.updateMany({
          where: { id: old.id, status: CONTRACT_AMENDMENT_REQUESTED },
          data: {
            status: 'revoked', revokedAt: issuedOn, revokedBy: actorId,
            revokeReasonAr: AMENDMENT_ACCEPT_REVOKE_REASON_AR,
            /* والجوابُ في خانته: خطُّ زمنِ الطلب يُقرأ كاملا — طُلب،
               وأُجيب، وبمَ أُجيب — ولو أُغلق الصفُّ بعده. والرمزُ يبقى:
               بابُه يقول «أزاحه أحدثُ منه» (علّتُه في `closed-doors-say-which`). */
            amendmentReplyAr: body.slice(0, AMENDMENT_TEXT_MAX),
            amendmentRepliedAt: issuedOn, amendmentRepliedBy: actorId,
          },
        })
      if (done.count === 0) {
        throw new AuthError('bad_state', mode === 'resign'
          ? 'لا يُعاد للتوقيع إلّا عقدٌ موقَّعٌ لم يُعتمَد'
          : 'لا طلبَ تعديلٍ قائمٌ على هذا العقد', 409)
      }
      /* ومهمّةُ «توقيع العقد» تُفتَح ثانيةً — علّتُه في `rejectSignature`.
         ومن طلب تعديلا لم يوقّع، فلا مهمّةَ أُغلقت تُفتَح. */
      if (mode === 'resign') {
        await tx.trainerOnboardingTask.updateMany({
          where: { profileId: old.profileId, key: 'sign_contract' }, data: { doneAt: null },
        })
      }
      /* والأجرُ الجديدُ يُكتب قاعدةً في المعاملة نفسِها — كما في التركيب —
         فلا يخرج عقدٌ يقول رقما والقاعدةُ تقول غيرَه */
      if (input.compensation) {
        const rule = await new EarningsService(tx as unknown as PrismaClient).setRule(actorId, {
          profileId: old.profileId,
          type: input.compensation.type,
          rate: input.compensation.rate,
          minSeats: input.compensation.minSeats,
          referralRate: input.compensation.referralRate ?? undefined,
        })
        replacement.compensationRuleId = rule.id
      }
      const next = await tx.trainerContract.create({ data: replacement })
      await recordAudit(tx, {
        actorId, action: mode === 'resign' ? 'trainer.contract.resign_requested' : 'trainer.contract.amendment_reissue',
        entityType: 'trainer_contract', entityId: old.id,
        meta: {
          nextContractId: next.id, fromVersion: readVersion, toVersion: CONTRACT_BODY_VERSION,
          subjectAr: subject, bodyAr: body, changesAr: [...changesAr],
          personalChangesAr: personalAr,
          signerLegalName: old.signerLegalName,
        },
      })
      return next
    })

    /* ═══ رسالةٌ واحدةٌ فيها ما تغيّر ورابطُ التوقيع (١ أكتوبر ٢٠٢٦) ═══

       كانت رسالتان: هذه، ثمّ بريدُ العقد العامُّ برابطه. وسؤالُ صاحب المنصّة:
       «ألا يمكن أن يكون في نفس الإيميل رابطُ العقد الجديد؟». فيُرسَل البديلُ
       **صامتا** (يُسكّ رابطُه ولا يخرج بريدُه العامّ)، ثمّ يُوضَع رابطُه في
       رسالة الإعادة. وإن أخفق البريدُ فالرابطُ يعود إلى الموظّف كما كان
       يعود — يسلّمه بيده. */
    const sent = await this.sendContract(created.id, actorId, null, { silent: true })
    let emailDelivery: DirectMailStatus = 'failed'
    try {
      const mail = contractResignMail({
        greetingName: name, subjectAr: subject, bodyAr: body,
        changeGroups: view.cards, templateNoteAr: view.templateNoteAr,
        signingUrl: sent.signingUrl,
        expiresOnAr: fmtDateWith(sent.expiresAt, { year: 'numeric', month: 'long', day: 'numeric' }),
        contractNumber: created.number,
        mode,
      })
      const out = await sendDirectEmail(this.prisma, {
        to: old.signerEmail ?? app.email, subject: mail.subject, ...renderMail(mail.doc),
      })
      emailDelivery = out.status
    } catch { /* البريدُ رفاهية — السحبُ والإرسالُ وقعا، والرابطُ بيد الموظّف */ }

    return { ...sent, ok: true as const, contractId: created.id, revision: created.revision, emailDelivery, noticeDelivery: emailDelivery }
  }

  /** رفضُ التوقيع — الاسمُ لا يطابق الوثيقةَ، أو الوثيقةُ ليست له.

      ولا يُمحى توقيعُه: ما فعله وقع، وأعمدةُ الدليل (`signedAt` والاسمُ
      والهاشُ وعنوانُ الشبكة) تبقى كما هي. والصفُّ يُغلَق بسببٍ مكتوب،
      ويُركَّب عقدٌ جديدٌ إن أُريد — فمن وقّع باسمٍ غيرِ اسمه وقّع وثيقةً
      تسمّي طرفا آخر، ولا تُصحَّح تسميةُ طرفٍ بتعديل حقل. */
  async rejectSignature(contractId: string, actorId: string, reasonAr: string) {
    const reason = (reasonAr ?? '').trim()
    if (reason.length < 5) {
      throw new AuthError('no_reason', 'اكتب ما لم يطابق — يصل صاحبَه ويُقرأ بعد شهرٍ حين يُسأل عنه', 422)
    }
    const c = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!c) throw new AuthError('not_found', 'العقد غير موجود', 404)
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: contractId, status: 'signed' },
      data: {
        status: 'revoked', revokedAt: new Date(), revokedBy: actorId,
        revokeReasonAr: `رُفض التوقيع: ${reason}`.slice(0, 500),
      },
    })
    if (done.count === 0) {
      throw new AuthError('bad_state', 'لا يُرفَض توقيعٌ إلّا على عقدٍ موقَّعٍ لم يُعتمَد', 409)
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.reject_signature',
      entityType: 'trainer_contract', entityId: contractId,
      meta: { reasonAr: reason.slice(0, 500), signerLegalName: c.signerLegalName },
    })
    /* ═══ وتُفتَح مهمّةُ «توقيع العقد» ثانيةً (٢٦ سبتمبر ٢٠٢٦) ═══

       `signContractByToken` تغلقها بالتوقيع (`doneAt`)، ورفضُ التوقيع كان
       يتركها مغلقة. فيقرأ المدرّبُ في تهيئته «توقيع العقد ✓» وعقدُه ملغًى
       وتوقيعُه مرفوض — والمهمّةُ تقول إنّ شيئا تمّ ولم يتمّ.

       ولا يُمَسّ دليلُ التوقيع نفسُه: `signedAt` والاسمُ والهاشُ تبقى في
       الصفّ كما هي. المهمّةُ حالٌ في تهيئته، لا شهادةٌ على ما فعل. */
    await this.prisma.trainerOnboardingTask.updateMany({
      where: { profileId: c.profileId, key: 'sign_contract' }, data: { doneAt: null },
    })

    const app = c.profile.application
    try {
      await sendDirectEmail(this.prisma, {
        to: c.signerEmail ?? app.email,
        subject: `نحتاج مراجعةَ بيانات عقدك — ${c.title}`,
        ...renderMail({
          greetingName: c.signerLegalName ?? app.fullName,
          heading: 'لم نستطع اعتمادَ توقيعك بعد',
          blocks: [
            { kind: 'p', text: `راجعنا توقيعَك على «${c.title}» ولم نستطع اعتمادَه.` },
            { kind: 'callout', text: reason },
            { kind: 'note', text: 'ويصلك عقدٌ جديدٌ برابطٍ جديدٍ بعد تصحيحه — ولا يلزمك ما لم يُعتمَد.' },
          ],
        }),
      })
    } catch { /* البريدُ رفاهية — الرفضُ وقع، ويُبلَّغ من الإدارة */ }
    return { ok: true }
  }

  /* ─────────── العقد: البابُ القديم ───────────

     ⚠️ **مهجورٌ، ويُحذف في المرحلة الثانية.** يكتب عنوانا بلا متنٍ ولا هاش،
     ويسجّل المسؤولُ به توقيعا بالنيابة عن المدرّب. وهو اليومَ مسارُ اختبارات
     دورة الحياة وحدَها، ويبقى حتّى تُنقل إلى `composeContract`. */

  async createContract(applicationId: string, actorId: string, input: { title: string; terms?: unknown }) {
    const profile = await this.profileFor(applicationId)
    const contract = await this.prisma.trainerContract.create({
      data: { profileId: profile.id, title: input.title, terms: input.terms as Prisma.InputJsonValue, createdBy: actorId, status: 'sent', sentAt: new Date() },
    })
    await this.apps.transition(applicationId, 'contract_pending', actorId, 'إرسال العقد')
    return contract
  }

  async signContract(contractId: string, actorId: string) {
    const contract = await this.prisma.trainerContract.findUnique({ where: { id: contractId }, include: { profile: true } })
    if (!contract || contract.status !== 'sent') throw new AuthError('bad_state', 'العقد ليس بانتظار التوقيع', 409)
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerContract.update({ where: { id: contractId }, data: { status: 'signed', signedAt: new Date() } })
      await tx.trainerOnboardingTask.updateMany({
        where: { profileId: contract.profileId, key: 'sign_contract' }, data: { doneAt: new Date() },
      })
      await recordAudit(tx, {
        actorId, action: 'trainer.contract.sign', entityType: 'trainer_contract', entityId: contractId,
      })
    })
    /* ═══ ويعلم صاحبُ العقد أنّ توقيعَه سُجّل (ي-٤) ═══

       المعاملةُ فوقُ تُغلق مهمّةَ «توقيع العقد» في تهيئته وتنقل طلبَه إلى
       طورِ التهيئة — وكان يقع بلا خبر: يوقّع ثمّ ينتظر ولا يعرف أوصل توقيعُه
       أم لا.

       و**بريدٌ لا جرس**: `profile.userId` موجودٌ في المدى لكنّه فارغٌ عادةً
       في هذا الطور — الربطُ بين الملفّ والحساب يقع لاحقا بالدعوة الآمنة
       (`consumeInvitation`). فالعنوانُ يُقرأ من الطلب، وهو ما يملكه المتقدّمُ
       قبل أن يكون له حسابٌ أصلا. */
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: contract.profile.applicationId },
      select: { email: true, fullName: true },
    })
    if (app) {
      await sendDirectEmail(this.prisma, {
        to: app.email,
        subject: 'سُجّل توقيعُ عقدك — أكاديمية وجيز',
        ...renderMail({
          greetingName: app.fullName,
          heading: 'سُجّل توقيعُ عقدك',
          blocks: [
            { kind: 'p', text: 'وانتقل طلبُك إلى طورِ التهيئة. تبقّت مهامُّ التهيئة، وتُفتح لك في بوّابتك حين يُنشأ حسابُك بدعوةٍ تصلك على هذا العنوان.' },
            { kind: 'note', text: 'وإن لم تكن أنت من وقّع فأبلغنا بردٍّ على هذه الرسالة.' },
          ],
        }),
      })
    }
    await this.apps.transition(contract.profile.applicationId, 'onboarding', actorId, 'توقيع العقد')
  }

  /* ─────────── الدعوة الآمنة وإنشاء الحساب ───────────
     تُرسل بعد الاعتماد والعقد فقط. الرمز يُحفظ هاش، وعمرُه سقفُ روابط البريد
     (`INVITATION_TTL_MS` أعلاه)، ويُستخدم مرة. */

  /** ربطُ حساب المتقدّم بملفّ المدرّب ومنحُه دورَ المدرّب — دورُ التقديم يسقط */
  private async linkApplicantAsTrainer(profileId: string, userId: string, actorId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerProfile.update({ where: { id: profileId }, data: { userId } })
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: 'trainer' } },
        update: {}, create: { userId, roleId: 'trainer' },
      })
      await tx.userRole.deleteMany({ where: { userId, roleId: 'trainer_applicant' } })
      await recordAudit(tx, {
        actorId, action: 'trainer.account.link', entityType: 'trainer_profile', entityId: profileId,
        meta: { userId },
      })
    })
  }

  async createInvitation(applicationId: string, actorId: string): Promise<{
    tokenForDelivery: string
    expiresAt: Date
    acceptUrl: string
    emailDelivery: DirectMailStatus
  }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId }, include: { profile: true } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!['onboarding', 'contract_pending'].includes(app.status)) {
      throw new AuthError('bad_state', 'الدعوة تُرسل بعد الاعتماد المشروط ومرحلة العقد فقط', 409)
    }
    if (!app.profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب', 409)
    if (app.profile.userId) throw new AuthError('already_linked', 'الحساب أُنشئ وربط مسبقا', 409)
    if (app.userId) {
      throw new AuthError('has_account', 'للمتقدّم حسابٌ منذ تقديمه — لا دعوةَ تلزمه؛ زرّ التفعيل يربطه بملفّه ويفتح له بوّابته', 409)
    }

    const token = newToken()
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)
    await this.prisma.trainerInvitation.create({
      data: { applicationId, tokenHash: sha256(token), sentTo: app.email, expiresAt, createdBy: actorId },
    })
    const acceptUrl = `${publicSiteUrl()}/trainer/accept-invite?token=${encodeURIComponent(token)}`
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: 'دعوتك لإنشاء حساب مدرب — أكاديمية وجيز',
      ...renderMail({
        greetingName: app.fullName,
        heading: `اكتمل اعتماد طلبك (${app.reference}) — وهذه دعوتك لإنشاء حسابك`,
        blocks: [
          { kind: 'cta', label: 'أنشئ حسابك واختر كلمتك', href: acceptUrl },
          { kind: 'callout', text: `الرابط صالحٌ ${MAIL_LINK_WINDOW_AR}، ويُستخدم مرّةً واحدة.` },
          { kind: 'note', text: 'فإن انتهى فاطلب من فريقنا إعادةَ إرساله.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.invitation.create', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, expiresAt, emailDelivery: mail.status },
    })
    return { tokenForDelivery: token, expiresAt, acceptUrl, emailDelivery: mail.status }
  }

  /** استهلاك الدعوة — ينشئ الحساب بدور trainer ويربط الملف ويفعّل الحالة */
  async consumeInvitation(token: string, password: string, displayName?: string): Promise<{ userId: string }> {
    if (password.length < 8) throw new AuthError('weak_password', 'كلمة المرور 8 أحرف على الأقل')
    const inv = await this.prisma.trainerInvitation.findUnique({
      where: { tokenHash: sha256(token) }, include: { application: { include: { profile: true } } },
    })
    if (!inv || inv.usedAt) throw new AuthError('invalid_token', 'الدعوة غير صالحة أو مستخدمة', 400)
    if (inv.expiresAt < new Date()) throw new AuthError('expired_token', 'الدعوة منتهية — اطلب إعادة إرسالها', 410)
    const app = inv.application
    if (!app.profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذه الدعوة', 409)

    const email = app.email
    const existing = await this.prisma.user.findUnique({ where: { email } })
    /* حسابُ المتقدّم نفسِه (أُنشئ عند التقديم) يُربَط لا يُرفض — وحسابُ غيرِه يُردّ */
    if (existing && existing.id !== app.userId) {
      throw new AuthError('email_taken', 'يوجد حساب بهذا البريد — سجّل الدخول واطلب ربط الملف من الإدارة', 409)
    }

    const out = await this.prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              passwordHash: await bcrypt.hash(password, 10),
              roles: {
                deleteMany: { roleId: 'trainer_applicant' },
                connectOrCreate: { where: { userId_roleId: { userId: existing.id, roleId: 'trainer' } }, create: { roleId: 'trainer' } },
              },
            },
          })
        : await tx.user.create({
            data: {
              email, displayName: displayName?.trim() || app.fullName,
              passwordHash: await bcrypt.hash(password, 10),
              roles: { create: { roleId: 'trainer' } },
            },
          })
      await tx.trainerProfile.update({ where: { id: app.profile!.id }, data: { userId: user.id } })
      await tx.trainerInvitation.update({ where: { id: inv.id }, data: { usedAt: new Date() } })
      await recordAudit(tx, {
        actorId: user.id, action: 'trainer.account.activate', entityType: 'trainer_profile', entityId: app.profile!.id,
        meta: { applicationId: app.id },
      })
      /* تفعيل الحالة — من onboarding أو contract_pending إلى active */
      const from = app.status
      await tx.trainerApplication.update({ where: { id: app.id }, data: { status: 'active' } })
      await tx.trainerStatusHistory.create({
        data: { applicationId: app.id, fromStatus: from, toStatus: 'active', actorId: user.id, note: 'إنشاء الحساب عبر الدعوة الآمنة' },
      })
      return { userId: user.id }
    })
    /* والتأكيدُ خارجَ المعاملة على عرف هذا الملفّ («الدعوةُ والبريدُ خارجَ
       المعاملة»): بريدٌ يُخفق لا ينقض حسابا أُنشئ. */
    await this.confirmActivation(email, app.fullName)
    return out
  }

  /** تأكيدُ إنشاء الحساب — يخرج بعد المعاملة على عرف هذا الملفّ (ي-٤).

      وصاحبُه هو الفاعلُ وهو على الشاشة، فهذا أخفُّ ما في الباب. وقيمتُه
      الباقيةُ أمنيّة: هنا تُعيَّن كلمةُ المرور ويصير الحسابُ حيّا، ورابطُ
      الدعوة يُستهلك مرّةً واحدة. فمن لم يكن هو من فعلَه يعلم في حينه. */
  private async confirmActivation(email: string, fullName: string): Promise<void> {
    await sendDirectEmail(this.prisma, {
      to: email,
      subject: 'أُنشئ حسابُك في أكاديمية وجيز',
      ...renderMail({
        greetingName: fullName,
        heading: 'أُنشئ حسابُك وفُتحت بوّابتُك',
        blocks: [
          { kind: 'p', text: 'تدخلها ببريدك هذا وكلمتك الجديدة.' },
          { kind: 'note', text: 'وإن لم تكن أنت من أنشأه فتواصل معنا فورا بردٍّ على هذه الرسالة — فرابطُ الدعوة يُستخدم مرّةً واحدةً وقد استُهلك.' },
        ],
      }),
    })
  }

  /* ─────────── التأهيل والإسناد والنشر العام والإيقاف ─────────── */

  async qualifyForCourse(profileId: string, courseId: string, actorId: string, note?: string) {
    const profile = await this.requireLiveProfile(profileId)
    const course = await this.prisma.course.findUnique({ where: { id: courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة في الكتالوج')
    const q = await this.prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId, courseId } },
      update: { status: 'qualified', qualifiedBy: actorId, note },
      create: { profileId, courseId, status: 'qualified', qualifiedBy: actorId, note },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId },
    })
    await this.notifyTrainerUser(profileId, {
      templateKey: 'trainer.qualified',
      title: 'أُهِّلتَ لتدريس دورة',
      body: `صرتَ مؤهَّلا لتدريس «${await this.courseTitleAr(courseId)}» — وتصلك شعبُها حين تُسنَد إليك.`,
      data: { courseId },
    })
    return q
  }

  /* ─────────── طلبُ التأهيل من الشعبة ───────────

     كان التأهيلُ والإسنادُ فعلين منفصلين في شاشتين: يُؤهَّل المدرّب من
     «عمليات المدربين»، ثمّ يُسنَد من «عمليات الشعبة». فمن أراد مدرّبا لشعبةٍ
     بعينها مشى ثلاث خطوات في مكانين، وأوّلُها لا يعرف شيئا عن آخرها — ولو
     نسي الثانية بقي المدرّب مؤهَّلا بلا شعبة والشعبةُ بلا مدرّب.

     وقرارُ صاحب المنصّة: «لو المدرب مؤهَّل مسبقا، الإسنادُ من الشعبة يكفي
     وحدَه. ولو غيرَ مؤهَّل، زرٌّ واحد "أهّله وأسنده الآن" يرسل طلبَ تأهيلٍ
     لموافقة المدير الأكاديميّ، وعند الموافقة يُضاف تلقائيا لتأهيلاته
     ويُسنَد».

     فالطلبُ يحمل شعبتَه، وبوّابةُ نزاهة التأهيل تبقى كما هي: من يطلب
     (`cohort.manage`) ليس من يقرّر (`trainer.qualify`). ولو جاز للطالب أن
     يقرّر لصارت الموافقةُ ختما لا مراجعة. */
  async requestQualification(
    profileId: string, courseId: string, cohortId: string, actorId: string, note?: string,
  ) {
    const profile = await this.requireLiveProfile(profileId)
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
    if (cohort.courseId !== courseId) {
      throw new AuthError('course_mismatch', 'الدورة لا تطابق دورة الشعبة', 409)
    }
    const existing = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId, courseId } },
    })
    if (existing?.status === 'qualified') {
      throw new AuthError('already_qualified', 'المدرب مؤهَّل لهذه الدورة — أسنده مباشرة', 409)
    }

    /* تعارضُ الجدول يُفحص عند الطلب لا عند الموافقة وحدَها: من يقرأ الطلب
       يستحقّ أن يعرف أنّه غيرُ قابلٍ للتنفيذ قبل أن يوقّعه، ومن يطلب يستحقّ
       أن يُردّ الآن لا بعد يومين. ويُفحص عند الموافقة أيضا — فالجدولُ يتحرّك
       بينهما. */
    await new CohortService(this.prisma).assertTrainerFreeFor(profileId, cohortId)

    const row = await this.prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId, courseId } },
      update: {
        status: 'pending', note, requestedCohortId: cohortId,
        requestedBy: actorId, requestedAt: new Date(), decidedAt: null, qualifiedBy: null,
      },
      create: {
        profileId, courseId, status: 'pending', note, requestedCohortId: cohortId,
        requestedBy: actorId, requestedAt: new Date(),
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify.request', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, cohortId },
    })
    /* من يبتّ يُعلَم — وإلّا بقي الطلبُ في طابورٍ لا أحد يعرف أنّه امتلأ */
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      title: 'طلب تأهيل مدرّب — بانتظار قرارك',
      body: `طُلب تأهيلُ «${profile.application.fullName}» لدورة شعبة «${cohort.title}»، والموافقةُ تؤهّله وتُسنده معا.`,
      templateKey: 'trainer.qualify.request',
      data: { profileId: profile.id, courseId, cohortId },
    })
    return row
  }

  /** طلباتُ التأهيل المعلّقة — لمن يملك البتّ فيها */
  async pendingQualifications() {
    const rows = await this.prisma.trainerCourseQualification.findMany({
      where: { status: 'pending' },
      include: {
        profile: { include: { application: { select: { fullName: true, status: true } } } },
        course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
      },
      orderBy: { requestedAt: 'asc' },
    })
    /* الشعبةُ المطلوبةُ تُقرأ باسمها لا بمعرّفها: الموافقةُ **تؤهّل وتُسند
       معا**، فمن يوقّع يستحقّ أن يرى في أيّ شعبةٍ يضع المدرّبَ وفي أيّ تاريخ
       — لا أن يوافق على معرّفٍ سداسيّ عشر. */
    const cohortIds = [...new Set(rows.map((r) => r.requestedCohortId).filter((id): id is string => Boolean(id)))]
    const cohorts = cohortIds.length
      ? await this.prisma.cohort.findMany({
          where: { id: { in: cohortIds } },
          select: { id: true, title: true, startsAt: true, status: true },
        })
      : []
    const byId = new Map(cohorts.map((c) => [c.id, c]))
    return rows.map((r) => ({
      ...r,
      requestedCohort: r.requestedCohortId ? byId.get(r.requestedCohortId) ?? null : null,
    }))
  }

  /* ─────────── لوحُ التشغيل ───────────

     خمسةُ مساراتٍ في هذا الملفّ كانت بلا شاشةٍ تصل إليها: البتُّ في طلبات
     التأهيل، والتأهيلُ المباشر، والإسنادُ لشعبة، واعتمادُ الظهور العامّ،
     والإيقاف. فالخادمُ يعرف كيف يفعلها كلَّها ولا أحدَ يستطيع أن يطلبها.

     وبناءُ الشاشة كشف عطبا ثانيا: **قائمةُ المدرّبين نفسُها كانت وراء صلاحيةِ
     المستحقّات** (`trainer-profiles` ← `trainer.compensation.manage`) — وهي
     ليست للمدير الأكاديميّ. فمن يملك التأهيلَ والإسنادَ والإيقاف **لا يستطيع
     أن يرى من يؤهّله**. وهو عطبُ «من يبدأ لا يستطيع أن ينهي» نفسُه في موضعٍ
     آخر.

     فهذه قائمةٌ بصلاحيةِ التأهيل، وحمولتُها ما يلزم القرارَ لا أكثر: لا
     مبالغَ ولا قواعدَ تعويض. */
  async listForOps() {
    const profiles = await this.prisma.trainerProfile.findMany({
      include: {
        application: { select: { fullName: true, email: true, status: true } },
        qualifications: {
          include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } } },
        },
        assignments: {
          where: { status: 'active' },
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
            cohort: { select: { id: true, title: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return profiles.map((p) => ({
      profileId: p.id,
      applicationId: p.applicationId,
      name: p.application.fullName,
      email: p.application.email,
      applicationStatus: p.application.status,
      /* حسابٌ مربوطٌ أم لا: «نشطٌ» بلا حسابٍ لا يفتح بوّابتَه ولا يُسنَد إليه */
      hasAccount: Boolean(p.userId),
      suspended: Boolean(p.suspendedAt),
      publiclyVisible: p.publicVisibility && Boolean(p.publishApprovedAt),
      isVerified: p.isVerified,
      /* ما تعرضه صفحةُ الفريق — يُقرأ هنا ليُحرَّر هنا */
      headline: p.headline,
      bioPublic: p.bioPublic,
      photoUrl: photoPublicUrl(p.photoUrl),
      /* وصورةٌ رفعها هو وتنتظر قرارَنا — تُقرأ من مسار صور الحسابات لا من
         مسار الصور العامّة، فالعامُّ لا يخدم ما لم يُعتمد بعد. */
      pendingPhotoUrl: p.photoPendingKey ? `/api/v1/avatars/${p.photoPendingKey}` : null,
      qualifications: p.qualifications.map((q) => ({
        courseId: q.courseId,
        courseTitle: q.course.versions[0]?.titleAr ?? q.courseId,
        status: q.status,
      })),
      assignments: p.assignments.map((a) => ({
        courseId: a.courseId,
        courseTitle: a.course.versions[0]?.titleAr ?? a.courseId,
        cohortId: a.cohortId,
        cohortTitle: a.cohort?.title ?? null,
        cohortStatus: a.cohort?.status ?? null,
      })),
    }))
  }

  /* البتُّ في الطلب — والموافقةُ تؤهّل وتُسند في فعلٍ واحد.

     ولو تعذّر الإسناد (تغيّر الجدول، أو أُغلقت الشعبة بين الطلب والقرار)
     بقي التأهيلُ قائما ورجع سببُ التعذُّر: التأهيلُ حكمٌ على كفاءة المدرّب
     في الدورة، ولا يبطله أنّ شعبةً بعينها لم تعد تقبله. */
  async decideQualification(
    qualificationId: string, approve: boolean, actorId: string, note?: string,
  ) {
    const q = await this.prisma.trainerCourseQualification.findUnique({
      where: { id: qualificationId },
      include: { profile: true },
    })
    if (!q) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (q.status !== 'pending') throw new AuthError('not_pending', 'بُتَّ في هذا الطلب من قبل', 409)

    if (!approve) {
      /* لا رفضَ صامت: السببُ يُخزَّن ويُقرأ في ملفّ المدرّب */
      if (!note?.trim()) throw new AuthError('reason_required', 'الرفض يحتاج سببا يُقرأ', 400)
      const row = await this.prisma.trainerCourseQualification.update({
        where: { id: qualificationId },
        data: { status: 'rejected', note, qualifiedBy: actorId, decidedAt: new Date() },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.qualify.reject', entityType: 'trainer_profile', entityId: q.profileId,
        meta: { courseId: q.courseId, note },
      })
      /* والرفضُ خبرٌ أيضا: من طُلب تأهيلُه ولم يُقبل كان يبقى ينتظر بلا ردّ */
      await this.notifyTrainerUser(q.profileId, {
        templateKey: 'trainer.qualify.rejected',
        title: 'لم يُقبل تأهيلُك لدورة',
        body: `لم يُقبل تأهيلُك لتدريس «${await this.courseTitleAr(q.courseId)}» — والسبب: ${note}`,
        data: { courseId: q.courseId },
      })
      return { qualification: row, assigned: false, assignNote: null as string | null }
    }

    const row = await this.prisma.trainerCourseQualification.update({
      where: { id: qualificationId },
      data: { status: 'qualified', qualifiedBy: actorId, decidedAt: new Date(), note },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify', entityType: 'trainer_profile', entityId: q.profileId,
      meta: { courseId: q.courseId, viaRequest: true, cohortId: q.requestedCohortId },
    })
    await this.notifyTrainerUser(q.profileId, {
      templateKey: 'trainer.qualified',
      title: 'أُهِّلتَ لتدريس دورة',
      body: `صرتَ مؤهَّلا لتدريس «${await this.courseTitleAr(q.courseId)}» — وتصلك شعبُها حين تُسنَد إليك.`,
      data: { courseId: q.courseId },
    })

    let assigned = false
    let assignNote: string | null = null
    if (q.requestedCohortId) {
      try {
        await this.assignToCohort(q.profileId, q.courseId, q.requestedCohortId, actorId)
        assigned = true
      } catch (e) {
        /* التأهيلُ تمّ ولم يقع الإسناد — يُقال لا يُبتلع */
        assignNote = e instanceof Error ? e.message : 'تعذّر الإسناد'
      }
    }
    return { qualification: row, assigned, assignNote }
  }

  async assignToCohort(profileId: string, courseId: string, cohortId: string | undefined, actorId: string) {
    const profile = await this.requireActiveProfile(profileId)
    /* الإسناد يتطلب تأهيلا قائما للدورة */
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId, courseId } },
    })
    if (!qual || qual.status !== 'qualified') {
      throw new AuthError('not_qualified', 'المدرب غير مؤهل لهذه الدورة — أهّله أولا', 409)
    }
    if (cohortId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
      if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
    }
    const assignment = await this.prisma.trainerCourseAssignment.create({
      data: { profileId, courseId, cohortId, assignedBy: actorId },
    })
    /* الربط التشغيلي بالشعبة — CohortTrainer.

       كان الإسناد من شاشة «عمليات المدربين» يكتب TrainerCourseAssignment وحده،
       بينما كل سطح المدرب يقرأ CohortTrainer: شعبي، وطابور التصحيح، والحضور،
       والتسجيلات، وحارس assertCohortTrainer. فالمدرب يُسنَد ثم يفتح منصته
       فيجدها فارغة — ولا رسالة خطأ، لأن لا خطأ وقع في نظر أيٍّ من الطرفين.
       الجدولان مفهومان مختلفان (تأهيل وإسناد إداري مقابل تشغيل شعبة) فلا يُدمجان،
       لكن إسنادا إلى شعبة بعينها يجب أن يُنتج الاثنين معا.

       ويمرّ عبر CohortService لا بكتابة مباشرة: هناك حارس تعارض الجدول — مدرب
       في شعبتين جلستاهما متداخلتان — وتخطّيه هنا يفتح بابا خلفيا لما يمنعه
       الباب الأمامي. */
    if (cohortId) {
      await new CohortService(this.prisma).assignTrainer(cohortId, profileId, actorId, 'lead')
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.assign', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, cohortId, cohortLinked: Boolean(cohortId) },
    })
    const courseTitle = await this.courseTitleAr(courseId)
    const cohort = cohortId
      ? await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { title: true, startsAt: true } })
      : null
    /* ي-٤: وإسنادُ الشعبة صار يُبلَّغ به من `assignTrainer` نفسِها، فيغطّي
       البابَين معا — هذا البابَ وبابَ الإدارة المباشر. فلا يبقى هنا إلّا
       ما لا تعرفه تلك الطريقة: إسنادُ **دورةٍ بلا شعبة**. */
    if (!cohort) {
      await this.notifyTrainerUser(profileId, {
        templateKey: 'trainer.assigned',
        title: 'أُسنِدت إليك دورة',
        body: `أُسنِدت إليك دورة «${courseTitle}» — وتصلك شعبُها حين تُجدوَل.`,
        data: { courseId, cohortId },
      })
    }
    return assignment
  }

  /* ═══ الملفُّ العامُّ للمدرّب — عنوانُه ونبذتُه وصورتُه ═══

     كان `headline` و`bioPublic` يُبذران مرّةً من نصّ الطلب ثمّ **لا يُعدَّلان
     أبدا**: لا في الإدارة ولا في بوّابة المدرّب. وهما ما تعرضه صفحةُ الفريق
     للعامّة. فنبذةٌ كُتبت في نموذج تقديمٍ قبل أشهرٍ هي وجهُ المدرّب إلى
     الناس، ولا سبيلَ إلى تحسينها إلّا بيدٍ في القاعدة.

     و`photoUrl` أسوأ: عمودٌ في المخطَّط **لا يكتبه شيءٌ في الشيفرة كلِّها**.

     وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): صورةُ المدرّب تُرفع، وأمرُ التخزين
     يُضبط بيده — «اجعل الموقعَ مستعدّا لهذا فورا». */
  async savePublicProfile(
    profileId: string, actorId: string,
    input: { headline?: string | null; bioPublic?: string | null; photoUrl?: string | null },
  ) {
    const profile = await this.requireActiveProfile(profileId)
    const data: Prisma.TrainerProfileUpdateInput = {}
    if (input.headline !== undefined) data.headline = input.headline?.trim() || null
    if (input.bioPublic !== undefined) data.bioPublic = input.bioPublic?.trim() || null

    if (input.photoUrl !== undefined) {
      const next = input.photoUrl?.trim() || null
      /* لا يُلصق في العمود إلّا رابطٌ آمنٌ أو مفتاحُ مخزنٍ أصدرناه نحن.
         عمودٌ يخرج إلى `src` في صفحةٍ عامّةٍ يقبل `javascript:` لو تُرك. */
      if (next && !next.startsWith('https://') && !next.startsWith(PHOTO_KEY_PREFIX)) {
        throw new AuthError('bad_photo', 'رابطُ الصورة يجب أن يبدأ بـhttps://', 422)
      }
      /* والصورةُ القديمةُ تُمحى من القرص حين تُستبدل — وإلّا بقيت بايتاتٌ
         لا يشير إليها سجلٌّ، ولا يعرف أحدٌ أنّها هناك ليحذفها. */
      const oldKey = photoStorageKey(profile.photoUrl)
      if (oldKey && oldKey !== photoStorageKey(next)) {
        try { await deleteObject(oldKey) } catch { /* غيابُها ليس عطبا */ }
      }
      data.photoUrl = next
    }

    const saved = await this.prisma.trainerProfile.update({ where: { id: profile.id }, data })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.public_profile.save', entityType: 'trainer_profile', entityId: profile.id,
      meta: { fields: Object.keys(data) },
    })
    return {
      headline: saved.headline, bioPublic: saved.bioPublic, photoUrl: photoPublicUrl(saved.photoUrl),
    }
  }

  /* ═══ ورفعُ الصورة: المفتاحُ يُكتب في العمود قبل أن تُرفع البايتات ═══

     `resolveStorageOwner` تعرف المالكَ من القاعدة. فلو أُصدر الرابطُ ثمّ
     كُتب العمودُ بعد الرفع، لَردّ مسارُ الرفع «لا مالك» — والمفتاحُ الذي
     أصدرناه توّا لا يقبله خادمُنا.

     فالعمودُ يُكتب أوّلا، والصورةُ تظهر حين تصل بايتاتُها. ومن بدأ رفعا ثمّ
     تركه يبقى عمودُه يشير إلى كائنٍ لا وجودَ له — فيردّ مسارُ العرض ٤٠٤،
     وهو أهونُ من رفعٍ لا يُقبل. */
  async startPhotoUpload(profileId: string, actorId: string, mime: string) {
    assertFileUploadsEnabled('والبديلُ الآن: ألصِق رابطَ الصورة مباشرةً في الحقل.')
    if (!(PHOTO_MIMES as readonly string[]).includes(mime)) {
      throw new AuthError('bad_mime', 'الصورةُ JPEG أو PNG أو WebP', 422)
    }
    const profile = await this.requireActiveProfile(profileId)
    const oldKey = photoStorageKey(profile.photoUrl)
    const storageKey = newStorageKey()
    await this.prisma.trainerProfile.update({
      where: { id: profile.id }, data: { photoUrl: `${PHOTO_KEY_PREFIX}${storageKey}` },
    })
    if (oldKey) { try { await deleteObject(oldKey) } catch { /* غيابُها ليس عطبا */ } }

    const exp = Date.now() + SIGNED_URL_TTL_MS
    const sig = signKey(storageKey, exp, 'write')
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.photo.upload', entityType: 'trainer_profile', entityId: profile.id,
    })
    return {
      storageKey,
      uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${sig}`,
      maxBytes: MAX_PHOTO_BYTES,
      photoUrl: photoPublicUrl(`${PHOTO_KEY_PREFIX}${storageKey}`),
    }
  }

  /* ═══ اعتمادُ صورةٍ رفعها المدرّبُ لنفسه — أو ردُّها ═══

     قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «everyone can put their picture and
     the admin approves it». فالمدرّبُ يرفع من حسابه، فتسكن صورتُه
     `photoPendingKey` — عمودا لا تقرؤه الصفحةُ العامّة — ولا تصير
     `photoUrl` إلّا بيدِ الإدارة.

     والاعتمادُ ينقل المفتاحَ ويحذف الصورةَ العامّةَ القديمةَ من القرص. والردُّ
     يخلي العمودَ **ولا يحذف البايتات**: هي صورةُ حسابه التي يراها في ترويسته،
     وليست ملكَ الإدارة لتُمحى. فالمردودُ عرضُها عامّةً لا وجودُها. */
  async approvePendingPhoto(profileId: string, actorId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, photoUrl: true, photoPendingKey: true },
    })
    if (!profile) throw new AuthError('not_found', 'الملفُّ غيرُ موجود', 404)
    if (!profile.photoPendingKey) {
      throw new AuthError('no_pending_photo', 'لا صورةَ تنتظر الاعتماد', 409)
    }
    const oldKey = photoStorageKey(profile.photoUrl)
    const updated = await this.prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { photoUrl: `${PHOTO_KEY_PREFIX}${profile.photoPendingKey}`, photoPendingKey: null },
    })
    /* والقديمةُ تُحذف بعد النقل لا قبله: لو انقطع شيءٌ بينهما بقيت الأولى */
    if (oldKey && oldKey !== profile.photoPendingKey) {
      try { await deleteObject(oldKey) } catch { /* غيابُها ليس عطبا */ }
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.photo.approve', entityType: 'trainer_profile', entityId: profile.id,
    })
    return { photoUrl: photoPublicUrl(updated.photoUrl) }
  }

  async rejectPendingPhoto(profileId: string, actorId: string, reasonAr?: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, photoPendingKey: true },
    })
    if (!profile) throw new AuthError('not_found', 'الملفُّ غيرُ موجود', 404)
    if (!profile.photoPendingKey) {
      throw new AuthError('no_pending_photo', 'لا صورةَ تنتظر الاعتماد', 409)
    }
    await this.prisma.trainerProfile.update({
      where: { id: profile.id }, data: { photoPendingKey: null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.photo.reject', entityType: 'trainer_profile', entityId: profile.id,
      reason: reasonAr,
    })
    return { ok: true }
  }

  /* ═══ اقتراحاتُ الدورات يحرّرها الأدمن ═══

     ─────────── العطبُ الذي كُتبت له ───────────

     الطلباتُ التي سبقت أ-٣ (١٣ سبتمبر) تحمل **فقرةً حرّةً واحدة**
     (`teachableOther`) لا صفوفا. وأوّلُ مدرّبةٍ حقيقيّةٍ في المنصّة من
     هؤلاء: كتبت ثماني دوراتٍ في فقرةٍ واحدة، فلا صفَّ يُربط بالكتالوج ولا
     اسمَ يُصحَّح.

     وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «أعطني المجال في ملفّها أن أضع اسمَ
     الدورة المقترحة بنفسي لغايات الربط… لأنّي كأدمن قد أقوم بتغيير اسم
     الدورة أو تصحيحٍ إملائيّ — فهذا الخيار ليس فقط لحلّ مشكلة اليوم بل
     تفادٍ مستقبليّ».

     ─────────── ولماذا العمودُ نفسُه لا عمودٌ ثانٍ ───────────

     `teachableProposals` هو ما تقرؤه الشاشةُ وما يُربط بالكتالوج. فلو كُتب
     تصحيحُ الأدمن في عمودٍ ثانٍ لصار للطلب مصدران للحقيقة، ولاحتاج كلُّ
     قارئٍ أن يعرف أيَّهما يغلب. فالأدمنُ يكتب في العمود نفسِه.

     **والفقرةُ القديمةُ تبقى كما كتبها صاحبُها**: لا تُمحى ولا تُقسَّم أسطرا
     تخمينا — التخمينُ يبتر جملةً كتبها إنسانٌ عن نفسه. وتُعرض تحت الصفوف
     مرجعا يُقارَن به.

     ─────────── والأثرُ يقول من غيّر ماذا ───────────

     ما يكتبه الأدمنُ في ملفّ متقدّمٍ عن نفسه يجب أن يُعرف أنّه ليس بقلمه —
     وإلّا قُرئ بعد شهرٍ كأنّ المتقدّمَ قاله. */
  async saveTeachableProposals(
    applicationId: string, actorId: string, rows: readonly { titleAr: string; summaryAr: string }[],
  ) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { id: true, teachableProposals: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    /* التشذيبُ بالدالّة المشتركة لا بيدٍ هنا: الشاشةُ والخادمُ يناديان
       الواحدةَ، فلا يفترق ما يُعرض عمّا يُخزَّن. */
    const next = cleanProposals(rows as { titleAr: string; summaryAr: string }[])
    const before = readProposals(app.teachableProposals)

    await this.prisma.trainerApplication.update({
      where: { id: applicationId },
      data: { teachableProposals: next as unknown as Prisma.InputJsonValue },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.application.proposals_edit',
      entityType: 'trainer_application', entityId: applicationId,
      before: { count: before.length, titles: before.map((p) => p.titleAr) },
      after: { count: next.length, titles: next.map((p) => p.titleAr) },
    })
    return next
  }

  /** الموافقة على الظهور العام — لا ظهور إلا بملف موثق وموافقة نشر */
  async approvePublicVisibility(profileId: string, actorId: string) {
    const profile = await this.requireActiveProfile(profileId)
    await this.prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { isVerified: true, publicVisibility: true, publishApprovedBy: actorId, publishApprovedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.publish_approve', entityType: 'trainer_profile', entityId: profile.id,
    })
    /* ═══ ويعلم صاحبُ الاسم أنّ اسمَه صار يُعرض (ي-٤) ═══

       هذا السطرُ فوقُ يضع اسمَه وسيرتَه وصورتَه على الموقع العامّ وفي صفحته
       باسمه. وكان يقع بلا خبر: يُنشَر ملفُّ إنسانٍ للناس ولا يعلم متى نُشر
       ولا أنّ ما فيه صار يُقرأ. وقاعدةُ المستودَع نفسُها تقول «لا اسمَ
       مدرّبٍ يُعرض قبل اعتماد نشره» — فاللحظةُ التي يقع فيها الاعتمادُ
       أولى اللحظات بأن تبلغه. */
    await this.notifyTrainerUser(profile.id, {
      templateKey: 'trainer.publish.approved',
      title: 'اعتُمد ظهورُك للعامّة',
      body: 'صار ملفُّك — اسمُك وسيرتُك وما أُهِّلتَ له — يظهر في صفحة مدرّبي الأكاديمية وفي صفحتك باسمك. راجِعه، فما فيه هو ما يقرؤه الناس.',
    })
  }

  /* ═══ إيقافُ التدريب لا يُسقط الحساب إلّا لمن لا موقعَ له سواه ═══

     كان هذا المسارُ يوقف `User.status` ويُبطل الجلساتِ **لكلّ من رُبط بالملفّ**،
     بلا نظرٍ إلى من يكون. ووقع ما يقع: صاحبُ المنصّة — وله ملفُّ مدرّبٍ كما
     لغيره — رأى اسمَه في قائمة المدرّبين فأوقفه، فأُوقف **دخولُه هو**، وذهبت
     معه لوحةُ الإدارة ورفعُ الإيقاف نفسُه. ولا سبيلَ إليه من المتصفّح، وهو لا
     يملك خادما (`server/auth/founders.ts`).

     وإيقافُ التدريب لا يحتاج ذلك أصلا: `suspendedAt` على الملفّ مفحوصةٌ في كلّ
     مسارٍ يخصّ المدرّب — البوّابةُ والعروضُ والشعبُ والإحالةُ والحسابُ البنكيُّ
     والظهورُ العامُّ والمستحقّات. فالإيقافُ تامٌّ بها وحدَها.

     والقاعدة: يُوقَف الدخولُ لمن **قيامُه على المنصّة تدريبُه** — فبوّابتُه هي
     دخولُه، وتركُه داخلا إلى لا شيءٍ عبث. ومن له موقعٌ فوقَ التدريب يبقى
     دخولُه: أُوقف تدريبُه لا هو. */
  async suspendTrainer(profileId: string, actorId: string, note?: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId },
      include: { application: true, user: { select: { roles: { select: { roleId: true } } } } },
    })
    if (!profile) throw new AuthError('not_found', 'ملف المدرب غير موجود', 404)

    /* ولا يوقف نفسَه من هنا — كما لا يوقفها من شاشة المستخدمين.
       والرفضُ يدلّ على البديل: قرارُه على نفسه يقع من ملفّه لا من قائمةٍ يراجعها. */
    if (profile.userId && profile.userId === actorId) {
      throw new AuthError(
        'self_suspend',
        'هذا ملفُّك أنت — لا توقف نفسَك من قائمة المدرّبين. وإن أردتَ إيقافَ حسابك فمن ملفّك الشخصيّ.',
        409,
      )
    }

    const locksAccount = profile.userId !== null
      && !holdsRoleBeyondTrainer((profile.user?.roles ?? []).map((r) => r.roleId))

    await this.prisma.$transaction(async (tx) => {
      await tx.trainerProfile.update({
        where: { id: profileId }, data: { suspendedAt: new Date(), suspendedBy: actorId, publicVisibility: false },
      })
      if (profile.userId && locksAccount) {
        await tx.user.update({ where: { id: profile.userId }, data: { status: 'suspended', suspendedAt: new Date() } })
        await tx.session.updateMany({ where: { userId: profile.userId, revokedAt: null }, data: { revokedAt: new Date() } })
      }
      await recordAudit(tx, {
        actorId, action: 'trainer.suspend', entityType: 'trainer_profile', entityId: profileId,
        /* ويُقرأ بعد شهرٍ أيُّ إيقافٍ وقع: أدخلَ البابَ أم وقف عند التدريب */
        meta: { note, accountSuspended: locksAccount },
      })
    })
    /* ═══ ولا يُترك يكتشف الإيقافَ عند الباب (ي-٤) ═══

       المعاملةُ فوقُ توقف حسابَه وتُبطل جلساتِه كلَّها، فيجد بوّابتَه مغلقةً
       بلا كلمة. و**البريدُ لا الجرس**: `auth.service` يمنع الدخولَ على غير
       `active`، فصفُّ إشعارٍ في القاعدة لا يقرؤه أحدٌ أبدا — وهو أسوأُ من
       الصمت لأنّه يُحسَب إخبارا وليس به.

       وبعد المعاملة لا داخلَها: بريدٌ يُخفق لا ينقض إيقافا وقع، والإيقافُ
       حقيقةٌ في القاعدة قبله.

       والعنوانُ يقول ما وقع بعينه: «أُوقف حسابُك» لمن أُوقف حسابُه، و«أُوقف
       تدريبُك» لمن بقي دخولُه. فرسالةٌ تقول له إنّ حسابَه أُوقف وهو يدخل من
       فوره أسوأُ من لا رسالة — تُكذّبها الشاشةُ أمامه. */
    const portalUrl = `${publicSiteUrl()}/trainer`
    const heading = locksAccount ? 'أُوقف حسابُك في أكاديمية وجيز' : 'أُوقف تدريبُك في أكاديمية وجيز'
    await sendDirectEmail(this.prisma, {
      to: profile.application.email,
      subject: heading,
      ...renderMail({
        greetingName: profile.application.fullName,
        heading,
        blocks: [
          { kind: 'p', text: locksAccount
            ? 'لا تُفتح بوّابتُك ولا تُسنَد إليك شعبةٌ جديدة حتّى يُرفع الإيقاف، وشعبُك القائمةُ تبقى كما هي عند الأكاديمية.'
            : 'لا تُفتح بوّابتُك التدريبيّةُ ولا تُسنَد إليك شعبةٌ جديدة حتّى يُرفع الإيقاف، وشعبُك القائمةُ تبقى كما هي عند الأكاديمية. ودخولُك إلى ما سوى التدريب باقٍ كما كان.' },
          ...(note ? [{ kind: 'p' as const, text: `والسببُ الذي كُتب: ${note}` }] : []),
          { kind: 'p', text: [
            'وإن كان في الأمر لبسٌ فردَّ على هذه الرسالة. و',
            { text: 'بوّابتك', href: portalUrl }, ' تفتح من موضعها حين يُرفع الإيقاف.',
          ] },
        ],
      }),
    })

    if (profile.application.status === 'active') {
      await this.apps.transition(profile.applicationId, 'suspended', actorId, note ?? 'إيقاف المدرب')
    }
  }

  /** القائمة العامة — بوّابةُ الظهور الواحدة (`trainer-visibility.ts`) + طلبٌ نشط */
  async listPublicTrainers() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: { ...PUBLIC_TRAINER_WHERE, application: { status: 'active' } },
      include: {
        application: { select: { fullName: true, country: true, specialties: true } },
        assignments: { where: { status: 'active' }, select: { courseId: true, cohortId: true } },
      },
    })
    /* التعليقات المعتمَدة للنشر (١و) — نداءٌ واحد لكل المدرّبين المعروضين ثم
       تجميع، لا استعلامٌ داخل حلقة. والدرجة والعدد يأتيان من عمودَي الملفّ
       اللذين يكتبهما RatingService بعد بلوغ عتبة إخفاء الهوية. */
    const approved = profiles.length
      ? await this.prisma.rating.findMany({
          where: { subjectType: 'trainer', subjectId: { in: profiles.map((p) => p.id) }, publishStatus: 'approved', commentAr: { not: null } },
          orderBy: { createdAt: 'desc' },
          /* لا raterId ولا enrollmentId: ما يخرج للعامّة لا يدلّ على قائله */
          select: { subjectId: true, score: true, commentAr: true },
        })
      : []
    const bySubject = new Map<string, { score: number; commentAr: string }[]>()
    for (const r of approved) {
      const list = bySubject.get(r.subjectId) ?? []
      if (list.length < 5) list.push({ score: r.score, commentAr: r.commentAr as string })
      bySubject.set(r.subjectId, list)
    }

    return profiles.map((p) => ({
      id: p.id, name: p.application.fullName, headline: p.headline, bio: p.bioPublic,
      country: p.application.country,
      specialties: p.application.specialties.map((s) => s.specialty),
      photoUrl: photoPublicUrl(p.photoUrl),
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      /* التعليق لا يُعرض إلا مع متوسّط معروض: تعليقٌ بلا رقم يُقرأ انتقاءً */
      testimonials: p.ratingAvg != null ? bySubject.get(p.id) ?? [] : [],
      hoursTaught: p.hoursTaught,
      graduatesCount: p.graduatesCount,
      assignedCourseIds: p.assignments.map((a) => a.courseId),
    }))
  }

  /** مدربو دورة معينة للعرض العام — أو عبارة الإعلان عند غياب معتمد */
  async publicCourseTrainer(courseId: string) {
    const assignments = await this.prisma.trainerCourseAssignment.findMany({
      where: { courseId, status: 'active', cohort: { status: { in: ['open', 'full', 'active'] } } },
      include: {
        profile: {
          include: { application: { select: { fullName: true } } },
        },
      },
    })
    /* البوّابةُ نفسُها التي تحكم الصفحةَ العامّة — كانت هنا بلا شرط اعتمادِ
       النشر، فبطاقةُ الدورة تُظهر ما تخفيه الصفحةُ العامّة عند أوّل افتراق. */
    const visible = assignments.filter((a) => trainerPubliclyVisible(a.profile))
    if (!visible.length) return { announced: false, messageAr: 'سيتم تعيين المدرب قريبا', trainers: [] }
    return {
      announced: true,
      trainers: visible.map((a) => ({ id: a.profile.id, name: a.profile.application.fullName, headline: a.profile.headline })),
    }
  }

  /* ─────────── الشعب وخطط التنفيذ ─────────── */

  async createCohort(actorId: string, input: { courseId: string; pathwayId?: string; title: string; startsAt?: Date; endsAt?: Date }) {
    const course = await this.prisma.course.findUnique({ where: { id: input.courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)
    const cohort = await this.prisma.cohort.create({
      data: { courseId: input.courseId, pathwayId: input.pathwayId, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.create', entityType: 'cohort', entityId: cohort.id, meta: { courseId: input.courseId, title: input.title },
    })
    return cohort
  }

  async publishCohort(cohortId: string, actorId: string) {
    const cohort = await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: 'open' } })
    await recordAudit(this.prisma, { actorId, action: 'cohort.publish', entityType: 'cohort', entityId: cohortId })
    return cohort
  }

  /* ─────────── أدوات داخلية ─────────── */

  private async requireStatus(applicationId: string, allowed: string[]) {
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId }, select: { status: true } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!allowed.includes(app.status)) {
      throw new AuthError('bad_state', `حالة الطلب «${app.status}» لا تسمح بهذا الإجراء`, 409)
    }
  }

  private async profileFor(applicationId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب — القبول المشروط أولا', 409)
    return profile
  }

  private async requireActiveProfile(profileId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: profileId }, include: { application: true } })
    if (!profile) throw new AuthError('not_found', 'ملف المدرب غير موجود', 404)
    if (profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('not_active', 'المدرب ليس في حالة active', 409)
    }
    return profile
  }

  /* ═══ التأهيلُ يصحّ قبل التفعيل، والإسنادُ لا ═══

     كان حارسٌ واحدٌ يحرس الفعلين، فيشترط `active` لكليهما. وثمنُ ذلك ظهر
     يومَ صار العقدُ وثيقةً تُرسَل: العقدُ يَعِد بأن يُعدَّد فيه ما أُهِّل
     له، والقبولُ المشروطُ لا يبذر مؤهّلا، **ولا يستطيع المسؤولُ أن يؤهّله
     يدويّا لأنّه ليس `active` بعد** — فيخرج الملحقُ (أ) فارغا في كلّ عقدٍ
     يُرسَل على المسار الذي وُصف.

     والفعلان مختلفان في طبيعتهما لا في تشدُّدهما:

     · **التأهيلُ وصفٌ لقدرته.** «يصلح لتدريس هذه الدورة» حكمٌ يصحّ على
       مرشّحٍ لم يُفتح له حسابٌ بعد — بل هو الحكمُ الذي نبني عليه قرارَ
       التعاقد نفسَه. فيُقبل من `conditionally_approved` فصاعدا.

     · **والإسنادُ ارتباطٌ بشعبةٍ فيها متعلّمون.** لا يقع إلّا على مدرّبٍ
       نشطٍ فُتحت بوّابتُه وتمّ التعاقدُ معه. فيبقى `requireActiveProfile`
       على `assignToCohort` بلا تخفيف، ومعه حارسا `CohortService`.

     وبهذا يبقى «مؤهَّلٌ ≠ مُسنَدٌ إليه» — وهو نفسُه البندُ الذي يقوم عليه
     العقد — محروسا في مواضعه الثلاثة، ولا يصير هذا التخفيفُ بابا خلفيّا
     حوله. ويحرسه `server/tests/trainer/qualify-before-active.test.ts`.

     وعامّةٌ لا خاصّة: ملفُّ القرارات (`course-decisions.service.ts`) يسأل بها
     قبل أن يطبّق «هل يُؤهَّل هذا؟» — وقائمةٌ ثانيةٌ هناك تفترق عن هذه يوما. */
  static readonly QUALIFIABLE_STATUSES = [
    'conditionally_approved', 'contract_pending', 'onboarding', 'active',
  ] as const

  private async requireLiveProfile(profileId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: profileId }, include: { application: true } })
    if (!profile) throw new AuthError('not_found', 'ملف المدرب غير موجود', 404)
    const allowed: readonly string[] = TrainerReviewService.QUALIFIABLE_STATUSES
    if (profile.suspendedAt || !allowed.includes(profile.application.status)) {
      throw new AuthError('not_live', 'ملفُّ المدرّب ليس في طورٍ يُؤهَّل فيه — القبولُ المشروطُ أوّلا', 409)
    }
    return profile
  }
  /* ═══════════ مهلةُ العرض المشروط — عملُ العامل ═══════════

     «التذكيرُ ووسمُ التأخّر عملُ العامل لا نقرةٌ يتذكّرها إنسان — وهذا بعينه
     ما يجعل الحمايةَ تعمل سواءٌ انتبهتَ أم لم تنتبه» (§٣ من التصميم).

     ولا يُغيَّر حالُ أحدٍ هنا: «لم يستوفِ الشروط» **وسمٌ محسوبٌ لا حالةٌ
     جديدة** — فهو لم ينتقل مكانا، بل تأخّر في مكانه. فالعاملُ يُبلِّغ ويكتب
     أنّه أبلغ، والقرارُ بعده لإنسان: يمدّد، أو يؤجّل، أو يحذف.

     ═══ ومن يُقصَد بهذا كلِّه ═══

     عرضٌ **وقّعه صاحبُه** (`signed`) ولم نختمه بعد، مشروطٌ (`gatesActivation`)،
     له مهلةٌ مكتوبة، ولم يتحقّق شرطُه. فتُستثنى بذلك ثلاثةٌ لا يُطرَق بابُها:

     · **المسودّةُ والمرسَلُ** — كُتبت لهما مهلةٌ عند التركيب، لكنّ صاحبَهما
       لم يوقّع فلم يقبل مهلةً ولا شرطا. فتذكيرُه بمهلةٍ لم يلتزم بها عبثٌ
       يُقرأ تهديدا.
     · **ومن لا تاريخَ لجلسته** — مهلتُه `NULL`، ولا يُذكَّر قطّ. وهو ضمانُ
       الترحيل نفسُه (§١٢): من كان في التهيئة قبل النشر لا تبدأ عليه ساعةٌ
       صامتة.
     · **ومن تجمّدت مهلتُه** بإعلان الاكتمال — الكرةُ عندنا لا عنده. */

  /** تذكيرُ من قاربت مهلتُه — مرّةً واحدةً لكلّ عرض */
  async remindConditionDeadlines(now = new Date()): Promise<{ reminded: number }> {
    const candidates = await this.prisma.trainerContract.findMany({
      where: {
        /* ═══ حالُ العرض في طور الموادّ — والصفوفُ التي كانت في الطريق ═══

           ── أوّلا: الحالُ تبدّلت (٢٧ سبتمبر ٢٠٢٦) ──

           كان الطورُ يبدأ بتوقيعه، فالعرضُ فيه `signed`. وصار يبدأ باعتمادنا،
           فهو فيه `countersigned`. ولو بقي الشرطُ على `signed` لَوجد العاملُ
           صفرا أبدا — فلا يُذكَّر أحدٌ ولا يُنذَر، **وينقضي في صمت**. وهو
           بعينه العطبُ الذي بُني هذا العاملُ ليدفعه، يعود من بابٍ آخر.

           ── وثانيا: ومن كان في الطريق يومَ تبدّلت ──

           وقُصر الشرطُ على `countersigned` وحدَها، **فسقط من كان في مهلته
           تلك اللحظة**: صفٌّ وُقِّع أمسِ حالُه `signed`، وطلبُه `onboarding`
           لأنّ التوقيعَ كان ينقله، ومهلتُه مكتوبةٌ تجري. فلا يجده عاملٌ بعد
           اليوم. وقِيس ذلك بصفٍّ حقيقيّ: **صفرٌ في التذكير وصفرٌ في الانقضاء**
           — العطبُ نفسُه، لمن كان في الطريق.

           فالحالتان معا. ولا يلتقط هذا صفّا جديدا بالخطأ: `signed` بعد اليوم
           **لا مهلةَ له أصلا** — لا يكتبها إلّا الاعتماد — والشرطُ أدناه
           يقتضي `conditionDeadlineAt: { not: null }`. فاجتماعُهما لا يقع إلّا
           في صفٍّ من العالم القديم، وهو يخلو بانقضاء آخرِ مهلةٍ منه.

           ── ولمَ لا تُنقَل الصفوفُ إلى `countersigned` ──

           ذاك أسهلُ استعلاما، وهو **إثباتُ توقيعٍ لم يقع**: الحالةُ تقول إنّ
           الأكاديميّةَ وقّعت، ولم توقّعْ. فتزويرُ سجلٍّ لأجل راحةِ شرط.

           ── و`signature_approved` معهما (١ أكتوبر ٢٠٢٦) ──

           هي حالُ طور الموادّ من اليوم: اعتمدنا توقيعَه ولم نوقّع، والمهلةُ
           تجري. ولو غابت من هنا لَما ذُكّر أحدٌ دخل الطورَ بعد اليوم. */
        status: { in: ['signed', 'signature_approved', 'countersigned'] },
        gatesActivation: true,
        conditionMetAt: null,
        conditionPausedAt: null,
        conditionRemindedAt: null,
        conditionDeadlineAt: { not: null },
        profile: { application: { status: 'onboarding' } },
      },
      select: {
        id: true, conditionDeadlineAt: true, conditionExtendedAt: true,
        conditionExtensionsUsed: true,
        profile: { select: { application: { select: { fullName: true, email: true, reference: true } } } },
      },
      take: 200,
    })

    let reminded = 0
    for (const c of candidates) {
      /* والمِحَكُّ من الوحدة الخالصة لا من شرطِ الاستعلام: الاستعلامُ يُضيّق
         المسحَ، والحكمُ واحدٌ يقرؤه العاملُ والشاشةُ معا. */
      const facts = {
        conditionDeadlineAt: c.conditionDeadlineAt,
        conditionExtendedAt: c.conditionExtendedAt,
        now,
      }
      if (!dueReminder(facts)) continue
      const left = daysLeft(facts)
      if (left == null) continue

      const app = c.profile.application
      const mail = conditionReminderMail({
        fullName: app.fullName,
        reference: app.reference,
        deadlineOnAr: fmtDateWith(c.conditionDeadlineAt!, { year: 'numeric', month: 'long', day: 'numeric' }),
        daysLeft: left,
        extensionDays: EXTENSION_DAYS,
        portalUrl: `${publicSiteUrl()}/trainer`,
        extensionsLeft: extensionsLeft(c),
      })

      /* ═══ ويُكتب «ذُكِّر» قبل الإرسال ═══

         فبريدٌ يخرج ولا يُكتب أثرُه يُعاد في الدورة التالية — ويُطرَق بابُه
         كلَّ ساعةٍ حتّى تنتهي مهلتُه. والعكسُ أهونُ ويُقرأ في الأثر: أُشِّر
         ولم يخرج، فيُرى `emailDelivery` ويُعاد بيد. */
      const marked = await this.prisma.trainerContract.updateMany({
        where: { id: c.id, conditionRemindedAt: null },
        data: { conditionRemindedAt: now },
      })
      if (marked.count === 0) continue

      const sent = await sendDirectEmail(this.prisma, {
        to: app.email, subject: mail.subject, ...renderMail(mail.doc),
      })
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.condition.remind',
        entityType: 'trainer_contract', entityId: c.id,
        meta: { sentTo: app.email, emailDelivery: sent.status, daysLeft: left, deadlineAt: c.conditionDeadlineAt },
      })
      reminded += 1
    }
    return { reminded }
  }

  /** إبلاغُ من انقضت مهلتُه — ولا يُغيَّر حالُه، فالوسمُ محسوب */
  async noticeLapsedConditions(now = new Date()): Promise<{ noticed: number }> {
    const candidates = await this.prisma.trainerContract.findMany({
      where: {
        /* الحالتان معا — وعلّتُهما في `remindConditionDeadlines` أعلاه:
           الطورُ صار يبدأ بالاعتماد، ومن كان في الطريق يومَ تبدّل بقي
           `signed` ومهلتُه تجري. ولا يلتقط هذا صفّا جديدا: الجديدُ
           `signed` بلا مهلة، والشرطُ أدناه يقتضي مهلةً قائمة. و`signature_approved`
           حالُ الطور من ١ أكتوبر ٢٠٢٦ — اعتمدنا توقيعَه ولم نوقّع بعد. */
        status: { in: ['signed', 'signature_approved', 'countersigned'] },
        gatesActivation: true,
        conditionMetAt: null,
        conditionPausedAt: null,
        conditionDeadlineAt: { not: null, lt: now },
        profile: { application: { status: 'onboarding' } },
      },
      select: {
        id: true, conditionDeadlineAt: true,
        /* ومتنُه — منه يُقرأ رقمُ بند «لا إخلال» كما وقّعه (`noFaultClauseOf`) */
        bodyAr: true,
        profile: { select: { application: { select: { fullName: true, email: true, reference: true } } } },
      },
      take: 200,
    })
    if (candidates.length === 0) return { noticed: 0 }

    /* ═══ ومن أُبلِغ لا يُبلَّغ ثانية — والأثرُ هو السجلّ ═══

       ولمَ الأثرُ لا عمودٌ جديد: الإبلاغُ **فعلٌ وقع**، وموضعُ ما وقع هو
       الأثر. وعمودٌ سابعٌ عشرَ في العقد يقول ما يقوله الأثرُ أصلا. وهو عرفُ
       متابعةِ الغياب نفسُه (`already_followed_up`).

       ويُقرأ للمجموعة كلِّها في استعلامٍ واحد، لا استعلامٌ لكلّ صفّ. */
    const already = await this.prisma.auditEvent.findMany({
      where: {
        action: 'trainer.condition.lapsed',
        entityType: 'trainer_contract',
        entityId: { in: candidates.map((c) => c.id) },
      },
      select: { entityId: true },
    })
    const told = new Set(already.map((a) => a.entityId))

    let noticed = 0
    for (const c of candidates) {
      if (told.has(c.id)) continue
      /* ═══ وحاجزان على الانقضاء بقصد ═══

         `lt: now` في الاستعلام يضيّق المسحَ، وهذا يحكم — والحكمُ من الوحدة
         الخالصة لا من شرطِ استعلام، فما يقرؤه العاملُ هو ما تقرؤه الشاشةُ
         وطابورُ الإدارة. وأحدُهما يكفي وحدَه، وبقاؤهما معا مقصود: رفعُ
         أحدِهما لا يُخرج بريدا إلى من مهلتُه قائمة (ومقيسٌ أنّ رفعَهما معا
         يُخرجه، فالحارسُ ليس زينة). */
      if (conditionPhase({ conditionDeadlineAt: c.conditionDeadlineAt, now }) !== 'lapsed') continue

      const app = c.profile.application
      const mail = conditionLapsedMail({
        fullName: app.fullName,
        reference: app.reference,
        deadlineOnAr: fmtDateWith(c.conditionDeadlineAt!, { year: 'numeric', month: 'long', day: 'numeric' }),
        portalUrl: `${publicSiteUrl()}/trainer`,
        noFaultClause: noFaultClauseOf(c.bodyAr),
      })
      const sent = await sendDirectEmail(this.prisma, {
        to: app.email, subject: mail.subject, ...renderMail(mail.doc),
      })
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.condition.lapsed',
        entityType: 'trainer_contract', entityId: c.id,
        meta: { sentTo: app.email, emailDelivery: sent.status, deadlineAt: c.conditionDeadlineAt },
      })
      noticed += 1
    }
    return { noticed }
  }
}
