-- قيودُ الحالات — مولَّدةٌ من تعليقات المخطّط.
--
-- العطب: خمسةٌ وخمسون عمودا يحمل حالةً نصّيّةً، وقيمُها المسموحة مكتوبةٌ في
-- تعليقٍ بجانبها لا في قيدٍ يمنع. فخطأٌ مطبعيٌّ واحد (publised) يصنع حالةً
-- لا تعرفها الواجهةُ ولا التقارير، وتبقى سنينَ لا يكتشفها إلّا من يسأل
-- «لماذا هذا الصفُّ لا يظهر؟».
--
-- والقيدُ هنا يجعل التعليقَ عقدا: من أراد حالةً جديدةً يكتبها في التعليق
-- أوّلا ثمّ يولّد الترحيل — ومن كتبها في الشيفرة وحدَها ردّته القاعدة.
--
-- ولا يمسّ هذا نوعا في TypeScript ولا سطرا في الشيفرة: القيدُ يقبل كلَّ ما
-- تكتبه المنصّةُ اليوم. وقد فُحص قبل الإضافة: القيمُ الموجودةُ فعلا في
-- خمسةٍ وثلاثين عمودا مأهولا كلُّها داخلَ تعليقها، وعشرون عمودا بلا بيانات.
--
-- التوليد: npx tsx scripts/status-checks.ts
-- التحقّق: npx tsx scripts/status-checks.ts --check

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_status_allowed";
ALTER TABLE "User" ADD CONSTRAINT "User_status_allowed" CHECK ("status" IN ('invited', 'active', 'suspended', 'archived'));

ALTER TABLE "CatalogVersion" DROP CONSTRAINT IF EXISTS "CatalogVersion_status_allowed";
ALTER TABLE "CatalogVersion" ADD CONSTRAINT "CatalogVersion_status_allowed" CHECK ("status" IN ('draft', 'published', 'superseded'));

ALTER TABLE "Pathway" DROP CONSTRAINT IF EXISTS "Pathway_status_allowed";
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_status_allowed" CHECK ("status" IN ('draft', 'diagnostic_incomplete', 'diagnostic_ready', 'in_review', 'changes_requested', 'approved', 'published', 'paused', 'archived'));

ALTER TABLE "Course" DROP CONSTRAINT IF EXISTS "Course_status_allowed";
ALTER TABLE "Course" ADD CONSTRAINT "Course_status_allowed" CHECK ("status" IN ('draft', 'in_review', 'approved', 'published', 'paused', 'archived'));

ALTER TABLE "LibraryResource" DROP CONSTRAINT IF EXISTS "LibraryResource_kind_allowed";
ALTER TABLE "LibraryResource" ADD CONSTRAINT "LibraryResource_kind_allowed" CHECK ("kind" IN ('video', 'article', 'template', 'post', 'pdf', 'text', 'book'));

ALTER TABLE "LibraryResource" DROP CONSTRAINT IF EXISTS "LibraryResource_status_allowed";
ALTER TABLE "LibraryResource" ADD CONSTRAINT "LibraryResource_status_allowed" CHECK ("status" IN ('draft', 'published', 'archived'));

ALTER TABLE "CourseModule" DROP CONSTRAINT IF EXISTS "CourseModule_status_allowed";
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_status_allowed" CHECK ("status" IN ('draft', 'published', 'archived'));

ALTER TABLE "Assessment" DROP CONSTRAINT IF EXISTS "Assessment_kind_allowed";
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_kind_allowed" CHECK ("kind" IN ('summative', 'formative', 'project_review'));

ALTER TABLE "SkillRelation" DROP CONSTRAINT IF EXISTS "SkillRelation_type_allowed";
ALTER TABLE "SkillRelation" ADD CONSTRAINT "SkillRelation_type_allowed" CHECK ("type" IN ('broader', 'narrower', 'related', 'prerequisite'));

ALTER TABLE "PathwayCourse" DROP CONSTRAINT IF EXISTS "PathwayCourse_kind_allowed";
ALTER TABLE "PathwayCourse" ADD CONSTRAINT "PathwayCourse_kind_allowed" CHECK ("kind" IN ('required', 'optional', 'gift', 'support'));

ALTER TABLE "ScoringConfigVersion" DROP CONSTRAINT IF EXISTS "ScoringConfigVersion_status_allowed";
ALTER TABLE "ScoringConfigVersion" ADD CONSTRAINT "ScoringConfigVersion_status_allowed" CHECK ("status" IN ('draft', 'published', 'superseded'));

ALTER TABLE "ContentChangeRequest" DROP CONSTRAINT IF EXISTS "ContentChangeRequest_status_allowed";
ALTER TABLE "ContentChangeRequest" ADD CONSTRAINT "ContentChangeRequest_status_allowed" CHECK ("status" IN ('draft', 'in_review', 'changes_requested', 'approved', 'rejected', 'applied'));

ALTER TABLE "TrainerApplicationDocument" DROP CONSTRAINT IF EXISTS "TrainerApplicationDocument_kind_allowed";
ALTER TABLE "TrainerApplicationDocument" ADD CONSTRAINT "TrainerApplicationDocument_kind_allowed" CHECK ("kind" IN ('cv', 'training_video', 'certificate', 'evidence', 'reference_letter', 'other'));

ALTER TABLE "TrainerInterview" DROP CONSTRAINT IF EXISTS "TrainerInterview_outcome_allowed";
ALTER TABLE "TrainerInterview" ADD CONSTRAINT "TrainerInterview_outcome_allowed" CHECK ("outcome" IN ('passed', 'hold', 'failed'));

ALTER TABLE "TrainerCourseQualification" DROP CONSTRAINT IF EXISTS "TrainerCourseQualification_status_allowed";
ALTER TABLE "TrainerCourseQualification" ADD CONSTRAINT "TrainerCourseQualification_status_allowed" CHECK ("status" IN ('qualified', 'pending', 'rejected', 'retired'));

ALTER TABLE "TrainerCourseAssignment" DROP CONSTRAINT IF EXISTS "TrainerCourseAssignment_status_allowed";
ALTER TABLE "TrainerCourseAssignment" ADD CONSTRAINT "TrainerCourseAssignment_status_allowed" CHECK ("status" IN ('active', 'completed', 'cancelled'));

ALTER TABLE "SessionRescheduleRequest" DROP CONSTRAINT IF EXISTS "SessionRescheduleRequest_status_allowed";
ALTER TABLE "SessionRescheduleRequest" ADD CONSTRAINT "SessionRescheduleRequest_status_allowed" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn'));

ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_status_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_status_allowed" CHECK ("status" IN ('draft', 'sent', 'signed', 'expired', 'terminated'));

ALTER TABLE "TrainerCompensationRule" DROP CONSTRAINT IF EXISTS "TrainerCompensationRule_type_allowed";
ALTER TABLE "TrainerCompensationRule" ADD CONSTRAINT "TrainerCompensationRule_type_allowed" CHECK ("type" IN ('per_seat', 'fixed_per_cohort', 'revenue_share'));

ALTER TABLE "TrainerPayout" DROP CONSTRAINT IF EXISTS "TrainerPayout_status_allowed";
ALTER TABLE "TrainerPayout" ADD CONSTRAINT "TrainerPayout_status_allowed" CHECK ("status" IN ('pending', 'approved', 'paid', 'cancelled'));

ALTER TABLE "Cohort" DROP CONSTRAINT IF EXISTS "Cohort_status_allowed";
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_status_allowed" CHECK ("status" IN ('draft', 'open', 'full', 'active', 'completed', 'cancelled'));

ALTER TABLE "CohortDeliveryPlan" DROP CONSTRAINT IF EXISTS "CohortDeliveryPlan_status_allowed";
ALTER TABLE "CohortDeliveryPlan" ADD CONSTRAINT "CohortDeliveryPlan_status_allowed" CHECK ("status" IN ('draft', 'approved', 'published', 'superseded'));

ALTER TABLE "CohortSession" DROP CONSTRAINT IF EXISTS "CohortSession_status_allowed";
ALTER TABLE "CohortSession" ADD CONSTRAINT "CohortSession_status_allowed" CHECK ("status" IN ('scheduled', 'live', 'done', 'cancelled'));

ALTER TABLE "LearningMaterial" DROP CONSTRAINT IF EXISTS "LearningMaterial_kind_allowed";
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_kind_allowed" CHECK ("kind" IN ('file', 'link', 'summary_audio', 'summary_text'));

ALTER TABLE "LearningMaterial" DROP CONSTRAINT IF EXISTS "LearningMaterial_status_allowed";
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_status_allowed" CHECK ("status" IN ('active', 'archived', 'disabled'));

ALTER TABLE "Recording" DROP CONSTRAINT IF EXISTS "Recording_status_allowed";
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_status_allowed" CHECK ("status" IN ('active', 'archived', 'disabled'));

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_status_allowed";
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_status_allowed" CHECK ("status" IN ('enrolled', 'waitlisted', 'completed', 'dropped'));

ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_status_allowed";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_status_allowed" CHECK ("status" IN ('present', 'late', 'absent', 'excused'));

ALTER TABLE "CohortAssessment" DROP CONSTRAINT IF EXISTS "CohortAssessment_type_allowed";
ALTER TABLE "CohortAssessment" ADD CONSTRAINT "CohortAssessment_type_allowed" CHECK ("type" IN ('assignment', 'quiz', 'project'));

ALTER TABLE "CohortAssessment" DROP CONSTRAINT IF EXISTS "CohortAssessment_status_allowed";
ALTER TABLE "CohortAssessment" ADD CONSTRAINT "CohortAssessment_status_allowed" CHECK ("status" IN ('draft', 'published', 'closed'));

ALTER TABLE "AssessmentItem" DROP CONSTRAINT IF EXISTS "AssessmentItem_kind_allowed";
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_kind_allowed" CHECK ("kind" IN ('text', 'choice', 'file'));

ALTER TABLE "AssessmentAttempt" DROP CONSTRAINT IF EXISTS "AssessmentAttempt_status_allowed";
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_status_allowed" CHECK ("status" IN ('submitted', 'under_review', 'graded', 'returned'));

ALTER TABLE "GradingRubric" DROP CONSTRAINT IF EXISTS "GradingRubric_status_allowed";
ALTER TABLE "GradingRubric" ADD CONSTRAINT "GradingRubric_status_allowed" CHECK ("status" IN ('active', 'archived'));

ALTER TABLE "ModuleProgress" DROP CONSTRAINT IF EXISTS "ModuleProgress_status_allowed";
ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_status_allowed" CHECK ("status" IN ('not_started', 'in_progress', 'completed'));

ALTER TABLE "CompletionRule" DROP CONSTRAINT IF EXISTS "CompletionRule_type_allowed";
ALTER TABLE "CompletionRule" ADD CONSTRAINT "CompletionRule_type_allowed" CHECK ("type" IN ('attendance_pct', 'modules_completed', 'assignment_accepted', 'project_accepted', 'assessment_passed'));

ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_status_allowed";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_status_allowed" CHECK ("status" IN ('active', 'revoked'));

ALTER TABLE "LearnerRequest" DROP CONSTRAINT IF EXISTS "LearnerRequest_kind_allowed";
ALTER TABLE "LearnerRequest" ADD CONSTRAINT "LearnerRequest_kind_allowed" CHECK ("kind" IN ('course_certificate', 'pathway_certificate', 'recommendation'));

ALTER TABLE "LearnerRequest" DROP CONSTRAINT IF EXISTS "LearnerRequest_status_allowed";
ALTER TABLE "LearnerRequest" ADD CONSTRAINT "LearnerRequest_status_allowed" CHECK ("status" IN ('pending', 'in_review', 'fulfilled', 'declined'));

ALTER TABLE "LearnerPlan" DROP CONSTRAINT IF EXISTS "LearnerPlan_status_allowed";
ALTER TABLE "LearnerPlan" ADD CONSTRAINT "LearnerPlan_status_allowed" CHECK ("status" IN ('active', 'archived'));

ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_status_allowed";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_status_allowed" CHECK ("status" IN ('new', 'converted', 'archived'));

ALTER TABLE "AdvisorCase" DROP CONSTRAINT IF EXISTS "AdvisorCase_status_allowed";
ALTER TABLE "AdvisorCase" ADD CONSTRAINT "AdvisorCase_status_allowed" CHECK ("status" IN ('new', 'contacted', 'needs_review', 'follow_up', 'recommended', 'enrolled', 'not_interested', 'closed'));

ALTER TABLE "AdvisorTask" DROP CONSTRAINT IF EXISTS "AdvisorTask_status_allowed";
ALTER TABLE "AdvisorTask" ADD CONSTRAINT "AdvisorTask_status_allowed" CHECK ("status" IN ('open', 'done'));

ALTER TABLE "FollowUp" DROP CONSTRAINT IF EXISTS "FollowUp_outcome_allowed";
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_outcome_allowed" CHECK ("outcome" IN ('reached', 'no_answer', 'rescheduled'));

ALTER TABLE "ConsentRecord" DROP CONSTRAINT IF EXISTS "ConsentRecord_kind_allowed";
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_kind_allowed" CHECK ("kind" IN ('cv_upload', 'marketing', 'terms'));

ALTER TABLE "CvSubmission" DROP CONSTRAINT IF EXISTS "CvSubmission_status_allowed";
ALTER TABLE "CvSubmission" ADD CONSTRAINT "CvSubmission_status_allowed" CHECK ("status" IN ('active', 'deleted'));

ALTER TABLE "EnrollmentRequest" DROP CONSTRAINT IF EXISTS "EnrollmentRequest_status_allowed";
ALTER TABLE "EnrollmentRequest" ADD CONSTRAINT "EnrollmentRequest_status_allowed" CHECK ("status" IN ('pending', 'seat_held', 'rejected', 'converted', 'cancelled'));

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_status_allowed";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_status_allowed" CHECK ("status" IN ('active', 'cancelled', 'expired'));

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_allowed";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_allowed" CHECK ("status" IN ('pending_payment', 'paid', 'cancelled', 'partially_refunded', 'refunded'));

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_kind_allowed";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_kind_allowed" CHECK ("kind" IN ('course', 'cohort', 'pathway', 'subscription'));

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_status_allowed";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_status_allowed" CHECK ("status" IN ('issued', 'paid', 'void'));

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_status_allowed";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_status_allowed" CHECK ("status" IN ('pending', 'succeeded', 'failed', 'partially_refunded', 'refunded'));

ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_status_allowed";
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_status_allowed" CHECK ("status" IN ('pending', 'processed', 'rejected'));

ALTER TABLE "StaffTask" DROP CONSTRAINT IF EXISTS "StaffTask_status_allowed";
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_status_allowed" CHECK ("status" IN ('open', 'done', 'cancelled'));

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_status_allowed";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_status_allowed" CHECK ("status" IN ('queued', 'sent', 'failed', 'read'));

ALTER TABLE "SupportTicket" DROP CONSTRAINT IF EXISTS "SupportTicket_status_allowed";
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_status_allowed" CHECK ("status" IN ('open', 'pending', 'resolved', 'closed', 'reopened'));

