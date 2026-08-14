/* خريطة مسارات وجيز — محوّل يقرأ من core-catalog.v2.json (عشرون مسار إطلاق)
   مصدر الحقيقة الوحيد للمسارات؛ لا تُستخدم خريطة الـ45 القديمة ككتالوج حي. */

import coreCatalog from './catalog/core-catalog.v2.json'

export interface Pathway {
  id: string
  name: string
  sector: 'B2C' | 'B2B' | 'B2G' | 'B2B2C'
  level: 'أساسي' | 'متوسط' | 'متقدم'
  durationWeeks: number
  weeklyHours: string
  coreSkills: string[]
  transformation: string
  output: string
  price: number
  badge?: string
}

interface RawCourse {
  course_id: string
  pathway_id: string
  title_ar: string
  total_hours: number
  skill_names_ar: string[]
}
interface RawPathway {
  id: string
  title: string
  audience: string
  after: string
  capstone: string
  duration_weeks: number
  weekly_hours: string
  level: string
  course_ids: string[]
}

const raw = coreCatalog as unknown as { launch_pathways: RawPathway[]; courses: RawCourse[] }

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

export function pathwayCategory(id: string): string {
  const fam = id.split('-')[1]
  switch (fam) {
    case 'FND':
      return 'أساسيات'
    case 'STU':
      return 'طلاب ومهنة'
    case 'EMP':
    case 'COM':
    case 'NEG':
      return 'موظفون'
    case 'GOV':
      return 'حكومي'
    case 'BIZ':
    case 'AUT':
      return 'أعمال'
    case 'LND':
      return 'قيادة'
    default:
      return 'تخصصات وظيفية'
  }
}

function skillsOf(courseIds: string[]): string[] {
  const seen: string[] = []
  for (const cid of courseIds) {
    const c = raw.courses.find((x) => x.course_id === cid)
    if (!c) continue
    for (const n of c.skill_names_ar) if (!seen.includes(n)) seen.push(n)
    if (seen.length >= 5) break
  }
  return seen.slice(0, 5)
}

export const pathways: Pathway[] = raw.launch_pathways.map((p) => ({
  id: p.id,
  name: p.title,
  sector: sectorOf(p.id),
  level: levelOf(p.level),
  durationWeeks: p.duration_weeks,
  weeklyHours: `${p.weekly_hours} ساعات`,
  coreSkills: skillsOf(p.course_ids),
  transformation: p.after,
  output: p.capstone,
  price: 600,
}))

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
