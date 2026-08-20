/* ─────────────────────────────────────────────────────────────────────────
   Ecosystem Organizations — سجل مركزي للمؤسسات المرتبطة بمنظومة وجيز

   قواعد صارمة (بقرار المالك، 2026-08-20):
   1) هذه المؤسسات تعاملت مع «وجيز مهارات»/منظومة وجيز — وليست بالضرورة
      عملاء «أكاديمية وجيز». ممنوع وصفها بـ«عملاء الأكاديمية».
   2) approved_for_public_display = false ⇒ لا تُعرض إطلاقاً.
   3) الشعارات والأسماء موثقة من شريط العملاء في الصفحة الرسمية
      https://wajeez.com/business (قرئت أسماؤها من artwork الشعار نفسه).
   4) الفصل مستقبلاً: عند وجود عقود Academy فعلية تُسجَّل بـ
      relationship_scope = 'academy_client' وتُعرض في موضعها الخاص —
      لا تُخلط مع عملاء المنظومة.
   ───────────────────────────────────────────────────────────────────────── */

export type RelationshipScope =
  | 'wajeez_skills_client' // عميل وجيز مهارات (B2B)
  | 'wajeez_client' // عميل وجيز الأم
  | 'academy_client' // عميل أكاديمية وجيز فعلياً — لا يُستخدم إلا بعقد حقيقي
  | 'ecosystem_partner' // شريك منظومة بلا علاقة عميل مباشرة

export interface EcosystemOrganization {
  name: string
  /** مسار محلي داخل public/ — لا روابط خارجية هشّة */
  logo: string
  relationship_scope: RelationshipScope
  approved_for_public_display: boolean
  source_reference: string
}

const SRC = 'https://wajeez.com/business — شريط «انضم لأكثر من 100 مؤسسة رائدة»'
const SKILLS: RelationshipScope = 'wajeez_skills_client'

export const ecosystemOrganizations: EcosystemOrganization[] = [
  { name: 'صندوق الاستثمارات العامة', logo: '/assets/ecosystem/public-investment-fund-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'بنك الجزيرة', logo: '/assets/ecosystem/bank-aljazira-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'الهيئة العامة للأوقاف', logo: '/assets/ecosystem/awkaf-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'صندوق التنمية الصناعية السعودي', logo: '/assets/ecosystem/industrial-fund-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'هيئة تنمية الصادرات السعودية', logo: '/assets/ecosystem/saudi-exports-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'هيئة تطوير محمية الإمام عبدالعزيز بن محمد الملكية', logo: '/assets/ecosystem/imam-abdulaziz-royal-reserve-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'مؤسسة الملك خالد الخيرية', logo: '/assets/ecosystem/king-khalid-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'المركز الوطني للفعاليات', logo: '/assets/ecosystem/national-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'مركز الأمير سلطان للدراسات والبحوث الدفاعية', logo: '/assets/ecosystem/psdsarc-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'شركة تحكم التقنية', logo: '/assets/ecosystem/tahakkum-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'شركة دور للضيافة', logo: '/assets/ecosystem/dur-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'مجموعة الخليج للتأمين (GIG)', logo: '/assets/ecosystem/gig-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'ميدغلف', logo: '/assets/ecosystem/medgulf-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'مجموعة العجيمي الصناعية', logo: '/assets/ecosystem/alojaimi-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'شركة حمد محمد بن سعدان العقارية', logo: '/assets/ecosystem/hamad-realestate-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'شركة جدة', logo: '/assets/ecosystem/jeddah-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'سدير للأدوية (SPC)', logo: '/assets/ecosystem/sudair-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'هيكما', logo: '/assets/ecosystem/hikma-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'أصول', logo: '/assets/ecosystem/osool-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'أصيول الحديثة للتمويل', logo: '/assets/ecosystem/osool-modern-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'الأرواح للتعليم', logo: '/assets/ecosystem/arrowad_educational-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'نجد المتوسطة', logo: '/assets/ecosystem/najd-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'جمعية تكنولوجيا الهندسة الطبية الحيوية', logo: '/assets/ecosystem/biomedical-engineering-tech-society-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  { name: 'معهد الاستشارات وحلول الأعمال (SEIZE)', logo: '/assets/ecosystem/seize-v3.png', relationship_scope: SKILLS, approved_for_public_display: true, source_reference: SRC },
  {
    name: 'غير مثبت (nas)',
    logo: '/assets/ecosystem/nas-v3.png',
    relationship_scope: SKILLS,
    approved_for_public_display: false, // مرفوض: الشعار artwork مجرد بلا اسم مقروء — لا يُعرض حتى يثبت الاسم من مصدر رسمي
    source_reference: SRC,
  },
]

/** شريط «مؤسسات وثقت بمنظومة وجيز» — عملاء المنظومة الموثقون فقط */
export function displayedEcosystemOrgs(): EcosystemOrganization[] {
  return ecosystemOrganizations.filter((o) => o.approved_for_public_display)
}

/** مستقبلاً: عملاء الأكاديمية الفعليون فقط — لشريط «عملاء الأكاديمية» المستقل */
export function academyClientOrgs(): EcosystemOrganization[] {
  return ecosystemOrganizations.filter(
    (o) => o.approved_for_public_display && o.relationship_scope === 'academy_client',
  )
}
