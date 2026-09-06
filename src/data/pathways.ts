/* خريطة مسارات وجيز — محوّل يقرأ من مصدر الكتالوج الجوهري (core-catalog-source)
   الافتراضي: الحزمة المضمنة الموثقة (عشرون مسار إطلاق)؛ وعند توفر خادم API
   تُستبدل المحتويات باللقطة المنشورة من قاعدة البيانات عبر المحوّل نفسه.
   مصدر الحقيقة الوحيد للمسارات؛ لا تُستخدم خريطة الـ45 القديمة ككتالوج حي. */

import {
  getCoreCatalogRaw,
  onCoreCatalogInstalled,
  type CoreCatalogRaw,
} from './core-catalog-source'
import { domainsOfPathway } from '@/domain/diagnostic/v2/data'

export interface Pathway {
  id: string
  name: string
  /** الاسمُ القصير — للبطاقات. العنوانُ الكامل يصلح للصفحة لا لبطاقةٍ في شبكة:
      متوسّطُه ٤٥ حرفا، و١٦ من ٢٠ فيه نقطتان. والحقلُ مؤلَّفٌ لكلّ مسارٍ في
      الكتالوج (`short_title`) ولم يكن يُعرض لأحد. */
  shortName: string
  /** لمن هذا المسار — نصُّ المؤلِّف (`audience`)، مؤلَّفٌ ولا يُعرض */
  audience: string
  /** **ولمن ليس** (`not_for`) — أصدقُ سطرٍ في الكتالوج، ولم يكن يُقرأ.
      وقولُ «ليست لك إن…» يمنع شراءً خاطئا، والمنعُ خدمةٌ لا خسارة. */
  notFor: string
  sector: 'B2C' | 'B2B' | 'B2G' | 'B2B2C'
  level: 'أساسي' | 'متوسط' | 'متقدم'
  durationWeeks: number
  weeklyHours: string
  coreSkills: string[]
  transformation: string
  output: string
  /** عددُ دورات المسار وساعاتُه — رقمان يقولان حجمَ ما يُشترى */
  courseCount: number
  totalHours: number
  price: number
  badge?: string
}

function sectorOf(id: string): Pathway['sector'] {
  const fam = id.split('-')[1]
  if (fam === 'GOV') return 'B2G'
  if (['BIZ', 'AUT', 'MKT', 'SAL', 'HR', 'FIN', 'PRD', 'OPS', 'CYB', 'SCM', 'LND'].includes(fam)) return 'B2B'
  return 'B2C'
}

function levelOf(level: string): Pathway['level'] {
  if (level.includes('متقدم')) return 'متقدم'
  if (level === 'تأسيسي') return 'أساسي'
  return 'متوسط'
}

/* الفئة المستهدفة — لمن هذا المسار، لا مجاله المعرفي (ذاك في pathwayDomain
   أدناه). أربعُ فئاتٍ فقط: كانت سبعا، وتصفيةُ الدورات بها (courseCategories)
   ترهق زائرا يقارن سبع رقاقاتٍ متقاربة — «موظفون» و«تخصصات وظيفية» و«قيادة»
   كلّها تصف موظفا يتطوّر في عمله. فأُدمجت إلى ما يفرّقه الزائر فعلا: فردٌ
   يبدأ، موظفٌ يتخصّص أو يقود، صاحبُ عملٍ أو مشروع، أو جهةٌ حكومية. */
export function pathwayCategory(id: string): string {
  const fam = id.split('-')[1]
  switch (fam) {
    case 'FND':
    case 'STU':
      return 'أفراد ومهن ناشئة'
    case 'GOV':
      return 'حكومي'
    case 'BIZ':
    case 'AUT':
    case 'LND':
      return 'قيادة وريادة الأعمال'
    default:
      return 'موظفون ومختصون'
  }
}

/* القطاع/المجال — موضوعُ المسار المهنيّ، لا جمهورُه (نفس تمييز courseDomain
   في data/courses.ts). المصدرُ خريطةُ مجالات التشخيص V2
   (pathway-domains.v2.json عبر domainsOfPathway) — نفسُ ما يقرأه محرّك
   التشخيص لكلّ مسار — مجمّعةً في عناقيدَ أوسعَ تصلح لأزرار تصفية بدل ثمانيةَ
   عشرَ مجالا دقيقا. ومسارٌ بلا مجالٍ موثّق يقع في «تخصصات أخرى» — لا يختفي
   بصمت (نفس قاعدة courseDomain). */
const SECTOR_BY_DOMAIN: Record<string, string> = {
  marketing_growth: 'التسويق والمبيعات',
  sales: 'التسويق والمبيعات',
  people_leadership: 'القيادة والموارد البشرية',
  learning_design: 'القيادة والموارد البشرية',
  project_management: 'إدارة المشاريع والعمليات',
  operations: 'إدارة المشاريع والعمليات',
  ai_productivity: 'التقنية والذكاء الاصطناعي',
  data_decision: 'التقنية والذكاء الاصطناعي',
  cyber_risk: 'التقنية والذكاء الاصطناعي',
  finance_mgmt: 'المالية وريادة الأعمال',
  entrepreneurship: 'المالية وريادة الأعمال',
  product_mgmt: 'المالية وريادة الأعمال',
  gov_services: 'القطاع الحكومي',
  career_direction: 'التطوير المهني والتواصل',
  employment_readiness: 'التطوير المهني والتواصل',
  communication_influence: 'التطوير المهني والتواصل',
  family_parenting: 'التطوير المهني والتواصل',
  personal_development: 'التطوير المهني والتواصل',
}

export function pathwayDomain(id: string): string {
  const [domainId] = domainsOfPathway(id)
  return (domainId && SECTOR_BY_DOMAIN[domainId]) || 'تخصصات أخرى'
}

export const pathwayDomains = [
  'الكل',
  'التسويق والمبيعات',
  'القيادة والموارد البشرية',
  'إدارة المشاريع والعمليات',
  'التقنية والذكاء الاصطناعي',
  'المالية وريادة الأعمال',
  'القطاع الحكومي',
  'التطوير المهني والتواصل',
]

function skillsOf(raw: CoreCatalogRaw, courseIds: string[]): string[] {
  const seen: string[] = []
  for (const cid of courseIds) {
    const c = raw.courses.find((x) => x.course_id === cid)
    if (!c) continue
    for (const n of c.skill_names_ar) if (!seen.includes(n)) seen.push(n)
    if (seen.length >= 5) break
  }
  return seen.slice(0, 5)
}

function buildPathways(raw: CoreCatalogRaw): Pathway[] {
  return raw.launch_pathways.map((p) => ({
    id: p.id,
    name: p.title,
    /* والقصيرُ يرتدّ إلى الكامل إن غاب — لا بطاقةَ بلا اسم */
    shortName: p.short_title?.trim() || p.title,
    audience: p.audience ?? '',
    notFor: p.not_for ?? '',
    sector: sectorOf(p.id),
    level: levelOf(p.level),
    durationWeeks: p.duration_weeks,
    weeklyHours: `${p.weekly_hours} ساعات`,
    coreSkills: skillsOf(raw, p.course_ids),
    transformation: p.after,
    output: p.capstone,
    courseCount: p.course_count ?? p.course_ids.length,
    totalHours: p.total_hours ?? 0,
    price: 600,
  }))
}

export const pathways: Pathway[] = buildPathways(getCoreCatalogRaw())

/* عند تثبيت لقطة API المنشورة: إعادة ملء المصفوفة نفسها في مكانها —
   المراجع المصدَّرة تبقى صالحة، والمشتركون يعيدون الرسم */
onCoreCatalogInstalled(() => {
  pathways.splice(0, pathways.length, ...buildPathways(getCoreCatalogRaw()))
})

export const pathwayById = (id: string) => pathways.find((p) => p.id === id)

/* مختارات وجيز — انتقاء تحريري صادق بلا ادعاءات مبيعات، 2–3 لكل مجال */
export const bestsellers: { id: string; note: string }[] = [
  /* أساسيات */
  { id: 'PW-FND-003', note: 'اختيار وجيز' },
  /* طلاب ومهنة */
  { id: 'PW-STU-002', note: 'الأنسب للخريجين' },
  { id: 'PW-STU-003', note: 'لمن يستكشف اتجاهه' },
  /* موظفون */
  { id: 'PW-EMP-004', note: 'الأنسب للموظفين' },
  { id: 'PW-EMP-003', note: 'رحلة متوازنة' },
  { id: 'PW-COM-001', note: 'مهارة يحتاجها الجميع' },
  /* حكومي */
  { id: 'PW-GOV-002', note: 'أثر مباشر على الواجهة' },
  /* أعمال */
  { id: 'PW-BIZ-001', note: 'الأنسب لرواد الأعمال' },
  { id: 'PW-AUT-001', note: 'من مختارات وجيز' },
  /* تخصصات وظيفية */
  { id: 'PW-MKT-001', note: 'نظام نمو متكامل' },
  { id: 'PW-FIN-001', note: 'للمدير غير المالي' },
  /* قيادة */
  { id: 'PW-EMP-005', note: 'الأنسب للمدراء الجدد' },
  { id: 'PW-LND-001', note: 'للمدربين ومصممي التعلم' },
]
