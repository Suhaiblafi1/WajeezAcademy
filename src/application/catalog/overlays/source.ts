/* ج-٢ · مُدخل مولّدات التراكبات — عقدٌ واحد يخدم مصدرين:
   ١) السكربتات المحلية تقرؤه من ملفات JSON الموثقة.
   ٢) باني اللقطة يقرؤه من صفوف القاعدة المنشورة.

   ولذلك هو **بنيويّ** (structural) لا مرتبط بأنواع Prisma ولا بأنواع الملفات:
   أي مصدر يستطيع تقديم هذه الحقول يستطيع توليد التراكبات. وهذا هو جوهر البند —
   قبله كان المولّد يقرأ الملفات وحدها، فسؤالٌ يُضاف بعد النشر لا يظهر في
   `question-plan` ولا في `skill-layers`، فيبقى غير مرئي للمحرك إلى الأبد. */

export interface OverlayQuestion {
  question_id: string
  module_id: string
  persona_scope?: string[]
  measures?: string[]
  sensitivity_level?: string
  /** أثر القرار كما كتبه المؤلّف — تقرؤه خطة V2.1 لجملة «هذا السؤال موجود لأن…» */
  decision_impact?: string
  /** غياب الحقل = نشط (نفس دلالة الملف: active !== false). false = متقاعد لا يصل المتعلم */
  active?: boolean
  /** سبب التقاعد الموثق — تنقله الخطة إلى why_ar كي يبقى القرار مقروءا */
  retired_reason_ar?: string
}

export interface OverlaySkill {
  skill_id: string
  slug: string
  /** غياب الحقل = نشطة (نفس دلالة الملف: active !== false) */
  active?: boolean
  merged_into?: string
  merge_date?: string
}

export interface OverlayCourse {
  course_id: string
  skill_slugs?: string[]
}

export interface OverlayPathway {
  id: string
  course_ids: string[]
}

export interface OverlayTemplate {
  template_id: string
  plan?: { represented_pathway_ids?: string[] }
  diagnostic?: {
    required_facts?: { fact_key: string }[]
    positive_signals?: { fact_key: string }[]
    negative_signals?: { fact_key: string }[]
    hard_filters?: { condition?: { fact_key?: string } }[]
  }
}

export interface OverlaySource {
  questions: OverlayQuestion[]
  /** قاموس المهارات الأساسي */
  skills: OverlaySkill[]
  /** امتدادات المهارات في كتالوج الدورات — تُدمج مع الأساسي كما في catalog.ts */
  skillExtensions: OverlaySkill[]
  pathways: OverlayPathway[]
  courses: OverlayCourse[]
  templates: OverlayTemplate[]
}
